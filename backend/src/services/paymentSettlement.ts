import mongoose from 'mongoose';
import { Invoice, IInvoice } from '../models/Invoice';
import { Booking } from '../models/Booking';
import { Notification } from '../models/Notification';
import { User } from '../models/User';
import { notifyByRoles, notifyUsers } from '../utils/notifyUsers';
import { sendExpoPushToTokens } from './expoPush';
import { toObjectId } from '../utils/mongoQuery';

export interface SettlePaymentParams {
  invoiceId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  /** Required for client-initiated verify; omitted for webhook. */
  clientId?: string;
  updatedByUserId?: string;
}

/**
 * Atomically mark invoice paid only when order id matches and status is unpaid.
 */
export async function settleInvoicePayment(
  params: SettlePaymentParams
): Promise<IInvoice | null> {
  const invoiceOid = toObjectId(params.invoiceId, 'invoiceId');
  const filter: Record<string, unknown> = {
    _id: invoiceOid,
    status: { $in: ['pending', 'overdue'] },
    razorpayOrderId: params.razorpayOrderId,
  };

  if (params.clientId) {
    filter.clientId = toObjectId(params.clientId, 'clientId');
  }

  const existing = await Invoice.findOne(filter);
  if (!existing) {
    return null;
  }

  const alreadyRecorded = (existing.paymentHistory ?? []).some(
    (entry) => entry.razorpayPaymentId === params.razorpayPaymentId
  );
  if (alreadyRecorded) {
    return existing;
  }

  const previousPaid = existing.amountPaid ?? 0;
  const discountAmount = Math.max(0, existing.discountAmount ?? 0);
  const remaining = Math.max(0, existing.totalAmount - previousPaid);
  const paidNow = Math.max(0, Math.round((remaining - discountAmount) * 100) / 100);
  const paidAt = new Date();
  const paymentType =
    previousPaid > 0
      ? 'extra_parts'
      : (existing.spareParts ?? 0) > 0
        ? 'full'
        : 'base_service';
  const isExtraPartsPayment = paymentType === 'extra_parts';
  const couponNote =
    existing.couponCode && discountAmount > 0
      ? ` (coupon ${existing.couponCode} −₹${discountAmount.toLocaleString('en-IN')})`
      : '';

  const invoice = await Invoice.findByIdAndUpdate(
    existing._id,
    {
      $set: {
        status: 'paid',
        amountPaid: existing.totalAmount,
        paidAt,
        razorpayPaymentId: params.razorpayPaymentId,
      },
      $push: {
        paymentHistory: {
          amount: paidNow,
          type: paymentType,
          paidAt,
          razorpayOrderId: params.razorpayOrderId,
          razorpayPaymentId: params.razorpayPaymentId,
        },
      },
    },
    { new: true }
  );

  if (!invoice) {
    return null;
  }

  const notifyUserId = invoice.clientId;
  const updatedBy =
    params.updatedByUserId && mongoose.Types.ObjectId.isValid(params.updatedByUserId)
      ? new mongoose.Types.ObjectId(params.updatedByUserId)
      : invoice.clientId;

  const booking = invoice.bookingId
    ? await Booking.findById(invoice.bookingId).select(
        'status technicianId assignedTechnicianId bookingId'
      )
    : null;

  if (invoice.bookingId) {
    const activeStatuses = [
      'technician_assigned',
      'en_route',
      'arrived',
      'in_progress',
      'completed',
    ];
    const historyEntry = {
      status: 'confirmed',
      timestamp: new Date(),
      notes: isExtraPartsPayment
        ? undefined
        : `Payment received — ₹${paidNow.toLocaleString('en-IN')}${couponNote}`,
      updatedBy,
    };

    if (isExtraPartsPayment || (booking && activeStatuses.includes(booking.status))) {
      // Extra parts / in-progress job: do not add timeline noise; spare parts stay on invoice only.
    } else if (booking?.status === 'pending') {
      await Booking.findByIdAndUpdate(invoice.bookingId, {
        status: 'confirmed',
        $push: { statusHistory: historyEntry },
      });
    } else if (!isExtraPartsPayment) {
      await Booking.findByIdAndUpdate(invoice.bookingId, {
        $push: { statusHistory: historyEntry },
      });
    }
  }

  const paymentTitle = 'Payment Successful';
  const paymentBody = `Payment of ₹${paidNow.toLocaleString('en-IN')} for invoice ${invoice.invoiceNumber} confirmed${couponNote}.`;
  const paymentData = {
    invoiceId: invoice._id,
    bookingId: invoice.bookingId,
  };

  await Notification.create({
    userId: notifyUserId,
    title: paymentTitle,
    body: paymentBody,
    type: 'success',
    category: 'payment',
    data: paymentData,
  });

  const payer = await User.findById(notifyUserId).select('fcmToken isActive');
  if (payer?.isActive && payer.fcmToken) {
    await sendExpoPushToTokens([payer.fcmToken], {
      title: paymentTitle,
      body: paymentBody,
      data: paymentData,
    });
  }

  const bookingRef = booking?.bookingId
    ? `booking ${booking.bookingId}`
    : `invoice ${invoice.invoiceNumber}`;
  const notificationData = paymentData;

  if (isExtraPartsPayment) {
    // Extra parts payment: notify admin, master technician, and the assigned technician.
    await notifyByRoles(['admin', 'master_technician'], {
      title: 'Extra parts payment received',
      body: `₹${paidNow.toLocaleString('en-IN')} extra parts payment received for ${bookingRef} (invoice ${invoice.invoiceNumber}).`,
      type: 'success',
      category: 'payment',
      data: notificationData,
    });

    const technicianInCharge = booking?.technicianId ?? booking?.assignedTechnicianId;
    if (technicianInCharge) {
      await notifyUsers([technicianInCharge], {
        title: 'Extra parts payment received',
        body: `The client paid ₹${paidNow.toLocaleString('en-IN')} for extra parts on ${bookingRef}.`,
        type: 'success',
        category: 'payment',
        data: notificationData,
      });
    }
  } else {
    await notifyByRoles(['admin'], {
      title: 'Payment received',
      body: `Invoice ${invoice.invoiceNumber} paid — ₹${invoice.totalAmount.toLocaleString('en-IN')}. Booking ready to assign.`,
      type: 'success',
      category: 'payment',
      data: notificationData,
    });

    // Only after payment: technicians can see and claim the job.
    const bookingDoc = invoice.bookingId
      ? await Booking.findById(invoice.bookingId)
          .populate('venueId', 'name')
          .select('bookingId serviceType scheduledDate scheduledTime venueId')
      : null;
    const venueName =
      (bookingDoc?.venueId as { name?: string } | undefined)?.name ?? 'venue';
    const jobRef = booking?.bookingId ?? bookingDoc?.bookingId ?? invoice.invoiceNumber;
    await notifyByRoles(['technician', 'master_technician'], {
      title: 'New job available',
      body: `${jobRef} · paid · ready at ${venueName}. Accept or await assignment.`,
      type: 'info',
      category: 'booking',
      data: notificationData,
    });
  }

  return invoice;
}
