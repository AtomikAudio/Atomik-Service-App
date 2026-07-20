import { Response, NextFunction } from 'express';
import { Booking } from '../models/Booking';
import { Invoice } from '../models/Invoice';
import { Notification } from '../models/Notification';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import mongoose from 'mongoose';
import { notifyByRoles } from '../utils/notifyUsers';
import {
  formatStatusLabel,
  notifyClientBooking,
  technicianContactLabel,
} from '../utils/notifyClient';
import {
  isBookingAssignable,
  isJobOpenForPool,
  openJobFilter,
  resolveTechnicianId,
} from '../utils/bookingAssignment';
import { parseScheduledDate, normalizeScheduledTime, formatDateIST } from '../utils/schedule';
import {
  redactBookingForPoolView,
  serializeBookingForRole,
  serializeBookingsForRole,
  syncInvoiceSparePartsFromBooking,
  ensureInvoiceReflectsBookingSpareParts,
  getInvoiceBalanceDue,
  sumSparePartsLineItems,
  hasBaseServicePayment,
} from '../utils/bookingPayment';
import { parseBookingStatus, parsePagination, toObjectId } from '../utils/mongoQuery';
import { Venue } from '../models/Venue';
import {
  assertValidHoldForBooking,
  consumeHold,
  normalizeSlotDate,
  normalizeSlotTime,
} from '../services/slotHoldService';
import {
  proposeRescheduleForBooking,
  respondToRescheduleForBooking,
} from '../services/rescheduleService';

const generateBookingId = (): string => {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `ATM${num}`;
};

const generateInvoiceNumber = (): string => {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `INV${num}`;
};

export const createBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { serviceType, venueId, scheduledDate, scheduledTime, notes } = req.body;
    const venueObjectId = toObjectId(venueId, 'venueId');
    const venue = await Venue.findOne({
      _id: venueObjectId,
      ownerId: req.user!.id,
      isActive: true,
    });
    if (!venue) {
      res.status(400).json({ success: false, message: 'Invalid or inaccessible venue' });
      return;
    }

    const normalizedTime = normalizeScheduledTime(scheduledTime);
    const parsedDate = parseScheduledDate(scheduledDate);
    const slotDate = normalizeSlotDate(scheduledDate);
    const slotTime = normalizeSlotTime(scheduledTime);

    await assertValidHoldForBooking(req.user!.id, slotDate, slotTime);

    const booking = await Booking.create({
      bookingId: generateBookingId(),
      clientId: req.user!.id,
      venueId: venueObjectId,
      serviceType,
      scheduledDate: parsedDate,
      scheduledTime: normalizedTime,
      notes: notes || undefined,
      status: 'pending',
      statusHistory: [
        {
          status: 'pending',
          timestamp: new Date(),
          updatedBy: req.user!.id,
        },
      ],
    });

    // Create invoice
    const serviceCharges = serviceType === 'emergency' ? 9000 : 6500;
    const technicianCharges = 2500;
    const spareParts = 0;
    const subtotal = serviceCharges + technicianCharges + spareParts;
    const taxAmount = Math.round(subtotal * 0.18);
    const totalAmount = subtotal + taxAmount;

    const invoice = await Invoice.create({
      invoiceNumber: generateInvoiceNumber(),
      bookingId: booking._id,
      clientId: req.user!.id,
      serviceCharges,
      technicianCharges,
      spareParts,
      taxAmount,
      totalAmount,
      dueDate: parsedDate,
    });

    await Booking.findByIdAndUpdate(booking._id, { invoiceId: invoice._id });
    await consumeHold(req.user!.id, slotDate, slotTime);

    const populated = await Booking.findById(booking._id).populate(
      'venueId',
      'name area city'
    );
    const venueName =
      (populated?.venueId as { name?: string })?.name ?? 'venue';
    const scheduleLabel = `${formatDateIST(parsedDate)} ${normalizedTime}`;

    await Notification.create({
      userId: req.user!.id,
      title: 'Booking placed',
      body: `Your ${serviceType} request ${booking.bookingId} is pending payment. Complete payment to confirm — technicians are assigned after payment.`,
      type: 'success',
      category: 'booking',
      data: { bookingId: booking._id },
    });

    await notifyByRoles(['admin'], {
      title: 'New client booking',
      body: `${booking.bookingId} · ${serviceType} at ${venueName}. ${scheduleLabel}. Awaiting client payment.`,
      type: 'info',
      category: 'booking',
      data: { bookingId: booking._id },
    });

    res.status(201).json({
      success: true,
      booking: populated,
      invoice,
    });
  } catch (err) {
    next(err);
  }
};

export const getMyBookings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const status = parseBookingStatus(req.query.status);
    const role = req.user!.role;

    if (role === 'admin') {
      res.status(403).json({
        success: false,
        message: 'Admins should use GET /api/bookings',
      });
      return;
    }

    const filter: Record<string, unknown> =
      role === 'technician' || role === 'master_technician'
        ? { status: { $nin: ['cancelled'] } }
        : { clientId: req.user!.id };

    if (status) filter.status = status;

    // Technicians only see jobs after the client has paid the base service.
    if (role === 'technician' || role === 'master_technician') {
      const paidInvoices = await Invoice.find({
        $or: [
          { amountPaid: { $gt: 0 } },
          { status: 'paid' },
          { paidAt: { $ne: null } },
        ],
      }).select('_id');
      filter.invoiceId = { $in: paidInvoices.map((inv) => inv._id) };
    }

    const bookings = await Booking.find(filter)
      .populate('venueId', 'name area city address state pincode')
      .populate('technicianId', 'name phone avatar')
      .populate('assignedByMasterId', 'name phone')
      .populate('clientId', 'name phone')
      .populate('invoiceId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    let bookingsForResponse = bookings;
    if (role === 'client') {
      let synced = false;
      for (const b of bookings) {
        if (b.spareParts?.length) {
          synced =
            (await ensureInvoiceReflectsBookingSpareParts(
              b._id,
              b.spareParts
            )) || synced;
        }
      }
      if (synced) {
        bookingsForResponse = await Booking.find(filter)
          .populate('venueId', 'name area city address state pincode')
          .populate('technicianId', 'name phone avatar')
          .populate('clientId', 'name phone')
          .populate('invoiceId')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit);
      }
    }

    const total = await Booking.countDocuments(filter);

    res.status(200).json({
      success: true,
      bookings: serializeBookingsForRole(bookingsForResponse, role),
      pagination: { page, limit, total },
    });
  } catch (err) {
    next(err);
  }
};

export const getBookingById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const bookingId = toObjectId(req.params.id);
    let booking = await Booking.findById(bookingId)
      .populate('venueId')
      .populate('technicianId', 'name phone avatar')
      .populate('assignedByMasterId', 'name phone')
      .populate('clientId', 'name phone')
      .populate('invoiceId');

    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    const assignedTechId = resolveTechnicianId(booking);
    const role = req.user!.role;
    const invoicePaid = hasBaseServicePayment(booking.invoiceId);

    const isOwner = booking.clientId._id.toString() === req.user!.id;
    const isTech = assignedTechId === req.user!.id;
    const isAdmin = role === 'admin';
    const isOpenPool =
      isJobOpenForPool(booking) &&
      booking.status !== 'cancelled' &&
      invoicePaid;

    let allowed = isOwner || isAdmin;
    if (!allowed && role === 'technician') {
      allowed = isTech || isOpenPool;
    }
    if (!allowed && role === 'master_technician') {
      allowed = invoicePaid && booking.status !== 'cancelled';
    }

    if (!allowed) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const poolView = role === 'technician' && !isTech && isOpenPool;

    if (
      (req.user!.role === 'client' || req.user!.role === 'admin') &&
      booking.spareParts?.length
    ) {
      const synced = await ensureInvoiceReflectsBookingSpareParts(
        bookingId,
        booking.spareParts
      );
      if (synced) {
        booking = await Booking.findById(bookingId)
          .populate('venueId')
          .populate('technicianId', 'name phone avatar')
          .populate('clientId', 'name phone')
          .populate('invoiceId');
      }
    }

    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    let payload = serializeBookingForRole(booking, role);
    if (poolView) {
      payload = redactBookingForPoolView(payload) as typeof payload;
    }

    res.status(200).json({
      success: true,
      booking: payload,
    });
  } catch (err) {
    next(err);
  }
};

export const updateBookingStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, notes, technicianNotes, spareParts } = req.body;
    const bookingId = toObjectId(req.params.id);
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    if (
      req.user!.role === 'technician' ||
      req.user!.role === 'master_technician'
    ) {
      const assignedTechId = resolveTechnicianId(booking);
      if (!assignedTechId || assignedTechId !== req.user!.id) {
        res.status(403).json({
          success: false,
          message: assignedTechId
            ? 'This job is assigned to another technician'
            : 'Accept the job before updating status',
        });
        return;
      }
    }

    const updatedBy = new mongoose.Types.ObjectId(req.user!.id);
    const sparePartsLines = Array.isArray(spareParts) ? spareParts : undefined;
    const hasSparePartsUpdate =
      sparePartsLines !== undefined && sparePartsLines.length > 0;

    const updates: Record<string, unknown> = {
      status,
      $push: {
        statusHistory: {
          status,
          timestamp: new Date(),
          notes,
          updatedBy,
        },
      },
    };

    if (technicianNotes !== undefined) updates.technicianNotes = technicianNotes;
    if (hasSparePartsUpdate) updates.spareParts = sparePartsLines;

    if (status === 'completed') updates.completedAt = new Date();
    if (status === 'cancelled') {
      updates.cancelledAt = new Date();
      updates.cancellationReason = notes;
    }

    let updated = await Booking.findByIdAndUpdate(bookingId, updates, {
      new: true,
    })
      .populate('clientId', 'name phone fcmToken')
      .populate('technicianId', 'name phone avatar')
      .populate('venueId', 'name area city')
      .populate('invoiceId');

    if (updated && hasSparePartsUpdate) {
      await syncInvoiceSparePartsFromBooking(bookingId, sparePartsLines!);
      const partsTotal = sumSparePartsLineItems(sparePartsLines);
      if (partsTotal > 0) {
        const inv = await Invoice.findById(updated.invoiceId);
        const balanceDue = inv ? getInvoiceBalanceDue(inv) : 0;
        if (balanceDue > 0) {
          await Notification.create({
            userId: booking.clientId,
            title: 'Extra parts — payment due',
            body: `₹${balanceDue.toLocaleString('en-IN')} for spare parts on booking ${booking.bookingId}. Open the app to pay.`,
            type: 'warning',
            category: 'payment',
            data: { bookingId: booking._id, invoiceId: inv?._id },
          });
        }
      }
      updated = await Booking.findById(bookingId)
        .populate('clientId', 'name phone fcmToken')
        .populate('technicianId', 'name phone avatar')
        .populate('venueId', 'name area city')
        .populate('invoiceId');
    }

    if (updated) {
      const statusLabel = formatStatusLabel(status);
      let techLabel = 'Your technician';

      if (req.user!.role === 'technician') {
        const tech = await User.findById(req.user!.id).select('name phone');
        techLabel = technicianContactLabel(tech);
      } else if (updated.technicianId) {
        techLabel = technicianContactLabel(
          updated.technicianId as { name?: string; phone?: string }
        );
      }

      const noteSuffix = notes?.trim() ? ` Note: ${notes.trim()}` : '';

      await notifyClientBooking(booking, {
        title: `Service ${statusLabel}`,
        body: `${techLabel} updated booking ${booking.bookingId} to ${statusLabel}.${noteSuffix}`,
        type: status === 'completed' ? 'success' : 'info',
      });

    }

    res.status(200).json({
      success: true,
      booking: serializeBookingForRole(updated, req.user!.role),
    });
  } catch (err) {
    next(err);
  }
};

export const acceptJob = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const techId = new mongoose.Types.ObjectId(req.user!.id);
    const isMaster = req.user!.role === 'master_technician';
    const acceptNote = isMaster
      ? 'Master Technician accepted the job'
      : 'Technician accepted the job';

    const existingForPay = await Booking.findById(req.params.id).populate(
      'invoiceId'
    );
    if (!existingForPay) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }
    if (!hasBaseServicePayment(existingForPay.invoiceId)) {
      res.status(400).json({
        success: false,
        message: 'This job is available only after the client completes payment.',
      });
      return;
    }

    const booking = await Booking.findOneAndUpdate(
      {
        _id: req.params.id,
        ...openJobFilter,
      },
      {
        technicianId: techId,
        status: 'technician_assigned',
        $unset: { assignedTechnicianId: 1, assignedByMasterId: 1 },
        $pull: { rejectedBy: techId },
        $push: {
          statusHistory: {
            status: 'technician_assigned',
            timestamp: new Date(),
            notes: acceptNote,
            updatedBy: techId,
          },
        },
      },
      { new: true }
    )
      .populate('venueId', 'name area city address state pincode')
      .populate('technicianId', 'name phone avatar')
      .populate('clientId', 'name phone email')
      .populate('invoiceId');

    if (!booking) {
      const existing = await Booking.findById(req.params.id).populate(
        'technicianId',
        'name'
      );
      if (existing && !isJobOpenForPool(existing)) {
        const techName =
          (existing.technicianId as { name?: string }).name ?? 'another technician';
        res.status(409).json({
          success: false,
          message: `Already assigned to ${techName}`,
          assignedTo: techName,
        });
        return;
      }
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    const tech = booking.technicianId as { name?: string; phone?: string };
    await notifyClientBooking(booking, {
      title: 'Technician assigned',
      body: `${technicianContactLabel(tech)} has accepted your booking ${booking.bookingId}.`,
      type: 'success',
    });

    res.status(200).json({
      success: true,
      booking: serializeBookingForRole(booking, req.user!.role),
    });
  } catch (err) {
    next(err);
  }
};

export const rejectJob = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const techId = new mongoose.Types.ObjectId(req.user!.id);
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    if (!isJobOpenForPool(booking)) {
      res.status(400).json({
        success: false,
        message: 'This job has already been assigned',
      });
      return;
    }

    const invoice = booking.invoiceId
      ? await Invoice.findById(booking.invoiceId)
      : null;
    if (!hasBaseServicePayment(invoice)) {
      res.status(400).json({
        success: false,
        message: 'This job is available only after the client completes payment.',
      });
      return;
    }

    const tech = await User.findById(req.user!.id).select('name phone');

    const updated = await Booking.findByIdAndUpdate(
      req.params.id,
      {
        $addToSet: { rejectedBy: techId },
        $push: {
          statusHistory: {
            status: 'pending',
            timestamp: new Date(),
            notes: `${tech?.name ?? 'Technician'} declined this job`,
            updatedBy: techId,
          },
        },
      },
      { new: true }
    )
      .populate('venueId', 'name area city address state pincode')
      .populate('technicianId', 'name phone avatar')
      .populate('clientId', 'name phone')
      .populate('invoiceId');

    if (updated) {
      await notifyClientBooking(booking, {
        title: 'Technician unavailable',
        body: `${tech?.name ?? 'A technician'} is unavailable for ${booking.bookingId}. We are finding another technician for you.`,
        type: 'info',
      });
    }

    res.status(200).json({
      success: true,
      booking: serializeBookingForRole(updated, req.user!.role),
      message: 'Job declined',
    });
  } catch (err) {
    next(err);
  }
};

export const dropJob = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const techId = new mongoose.Types.ObjectId(req.user!.id);
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    if (resolveTechnicianId(booking) !== req.user!.id) {
      res.status(403).json({
        success: false,
        message: 'You can only drop jobs assigned to you',
      });
      return;
    }

    if (['completed', 'cancelled'].includes(booking.status)) {
      res.status(400).json({
        success: false,
        message: `Cannot drop a ${booking.status} job`,
      });
      return;
    }

    if (booking.assignedByMasterId) {
      const master = await User.findById(booking.assignedByMasterId).select('name phone');
      const masterName = master?.name ?? 'Master Technician';
      res.status(403).json({
        success: false,
        message: `This job was assigned by Master Technician ${masterName}. Contact them to drop this job.`,
        assignedByMaster: master
          ? {
              id: master._id.toString(),
              name: master.name,
              phone: master.phone ?? '',
            }
          : undefined,
      });
      return;
    }

    const updated = await Booking.findByIdAndUpdate(
      req.params.id,
      {
        $unset: { technicianId: 1, assignedTechnicianId: 1, assignedByMasterId: 1 },
        status: 'pending',
        $push: {
          statusHistory: {
            status: 'pending',
            timestamp: new Date(),
            notes: 'Technician dropped the job — returned to pool',
            updatedBy: techId,
          },
        },
      },
      { new: true }
    )
      .populate('venueId', 'name area city address state pincode')
      .populate('technicianId', 'name phone avatar')
      .populate('clientId', 'name phone')
      .populate('invoiceId');

    await notifyClientBooking(booking, {
      title: 'Technician update',
      body: `Your booking ${booking.bookingId} is awaiting a new technician.`,
      type: 'warning',
    });

    await notifyByRoles(['technician'], {
      title: 'Job available again',
      body: `${booking.bookingId} is open for acceptance.`,
      type: 'info',
      category: 'booking',
      data: { bookingId: booking._id },
    });

    res.status(200).json({
      success: true,
      booking: serializeBookingForRole(updated, req.user!.role),
    });
  } catch (err) {
    next(err);
  }
};

export const assignJobByMaster = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { technicianId } = req.body;
    const techObjectId = toObjectId(technicianId, 'technicianId');
    const bookingId = toObjectId(req.params.id);
    const masterId = new mongoose.Types.ObjectId(req.user!.id);

    const targetTech = await User.findOne({
      _id: techObjectId,
      role: 'technician',
      isActive: true,
    });
    if (!targetTech) {
      res.status(400).json({
        success: false,
        message: 'Select an active technician account to assign this job',
      });
      return;
    }

    const existing = await Booking.findById(bookingId);
    if (!existing) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }
    if (!isBookingAssignable(existing.status)) {
      res.status(400).json({
        success: false,
        message: `Cannot assign a ${existing.status} booking`,
      });
      return;
    }

    const invoiceForMaster = existing.invoiceId
      ? await Invoice.findById(existing.invoiceId)
      : null;
    if (!hasBaseServicePayment(invoiceForMaster)) {
      res.status(400).json({
        success: false,
        message: 'Assign only after the client completes payment.',
      });
      return;
    }

    const master = await User.findById(masterId).select('name');
    const masterName = master?.name ?? 'Master Technician';

    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      {
        technicianId: techObjectId,
        assignedByMasterId: masterId,
        status: 'technician_assigned',
        $unset: { assignedTechnicianId: 1 },
        $pull: { rejectedBy: techObjectId },
        $push: {
          statusHistory: {
            status: 'technician_assigned',
            timestamp: new Date(),
            notes: `Assigned to ${targetTech.name} by Master Technician ${masterName}`,
            updatedBy: masterId,
          },
        },
      },
      { new: true }
    )
      .populate('clientId', 'name phone email fcmToken')
      .populate('technicianId', 'name phone avatar')
      .populate('assignedByMasterId', 'name phone')
      .populate('venueId', 'name area city address state pincode')
      .populate('invoiceId');

    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    await notifyClientBooking(booking, {
      title: 'Technician assigned',
      body: `${technicianContactLabel(
        booking.technicianId as { name?: string; phone?: string }
      )} has been assigned to booking ${booking.bookingId}.`,
      type: 'success',
    });

    await Notification.create({
      userId: techObjectId,
      title: 'Job assigned by Master Technician',
      body: `${masterName} assigned booking ${booking.bookingId} to you.`,
      type: 'info',
      category: 'booking',
      data: { bookingId: booking._id },
    });

    res.status(200).json({
      success: true,
      booking: serializeBookingForRole(booking, req.user!.role),
      message: `Job assigned to ${targetTech.name}`,
    });
  } catch (err) {
    next(err);
  }
};

export const assignTechnician = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { technicianId } = req.body;
    const techObjectId = toObjectId(technicianId, 'technicianId');
    const bookingId = toObjectId(req.params.id);

    const targetTech = await User.findOne({
      _id: techObjectId,
      role: 'technician',
      isActive: true,
    });
    if (!targetTech) {
      res.status(400).json({
        success: false,
        message: 'Select an active technician account to assign this job',
      });
      return;
    }

    const existing = await Booking.findById(bookingId);
    if (!existing) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }
    if (!isBookingAssignable(existing.status)) {
      res.status(400).json({
        success: false,
        message: `Cannot assign a ${existing.status} booking`,
      });
      return;
    }

    const invoiceForAdmin = existing.invoiceId
      ? await Invoice.findById(existing.invoiceId)
      : null;
    if (!hasBaseServicePayment(invoiceForAdmin)) {
      res.status(400).json({
        success: false,
        message: 'Assign only after the client completes payment.',
      });
      return;
    }

    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      {
        technicianId: techObjectId,
        status: 'technician_assigned',
        $unset: { assignedByMasterId: 1 },
        $push: {
          statusHistory: {
            status: 'technician_assigned',
            timestamp: new Date(),
            updatedBy: req.user!.id,
          },
        },
      },
      { new: true }
    )
      .populate('clientId', 'name phone email fcmToken')
      .populate('technicianId', 'name phone')
      .populate('assignedByMasterId', 'name phone')
      .populate('invoiceId');

    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    await notifyClientBooking(booking, {
      title: 'Technician assigned',
      body: `${technicianContactLabel(
        booking.technicianId as { name?: string; phone?: string }
      )} has been assigned to booking ${booking.bookingId}.`,
      type: 'success',
    });

    await Notification.create({
      userId: techObjectId,
      title: 'New Job Assigned',
      body: `You have been assigned to booking ${booking.bookingId}.`,
      type: 'info',
      category: 'booking',
      data: { bookingId: booking._id },
    });

    res.status(200).json({
      success: true,
      booking: serializeBookingForRole(booking, req.user!.role),
    });
  } catch (err) {
    next(err);
  }
};

export const getAllBookings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const status = parseBookingStatus(req.query.status);
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;

    const bookings = await Booking.find(filter)
      .populate('clientId', 'name email phone')
      .populate('technicianId', 'name phone')
      .populate('venueId', 'name area city')
      .populate('invoiceId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Booking.countDocuments(filter);

    res.status(200).json({
      success: true,
      bookings: serializeBookingsForRole(bookings, 'admin'),
      pagination: { page, limit, total },
    });
  } catch (err) {
    next(err);
  }
};

const populateBookingDetail = (bookingId: mongoose.Types.ObjectId) =>
  Booking.findById(bookingId)
    .populate('venueId', 'name area city address state pincode')
    .populate('technicianId', 'name phone avatar')
    .populate('clientId', 'name phone')
    .populate('assignedByMasterId', 'name phone')
    .populate('invoiceId');

export const proposeReschedule = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const bookingId = toObjectId(req.params.id);
    await proposeRescheduleForBooking(bookingId.toString(), req.user!.id, req.user!.role, {
      scheduledDate: String(req.body.scheduledDate),
      scheduledTime: String(req.body.scheduledTime),
      note: req.body.note,
    });

    const booking = await populateBookingDetail(bookingId);
    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Reschedule proposed',
      booking: serializeBookingForRole(booking, req.user!.role),
    });
  } catch (err) {
    next(err);
  }
};

export const respondToReschedule = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const bookingId = toObjectId(req.params.id);
    await respondToRescheduleForBooking(bookingId.toString(), {
      id: req.user!.id,
      role: req.user!.role,
    }, {
      action: req.body.action,
      scheduledDate: req.body.scheduledDate,
      scheduledTime: req.body.scheduledTime,
      note: req.body.note,
    });

    const booking = await populateBookingDetail(bookingId);
    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message:
        req.body.action === 'accept'
          ? 'Reschedule confirmed'
          : 'Counter-proposal sent',
      booking: serializeBookingForRole(booking, req.user!.role),
    });
  } catch (err) {
    next(err);
  }
};

export const cancelBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const bookingId = toObjectId(req.params.id);
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    if (booking.clientId.toString() !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const reason =
      typeof req.body.reason === 'string' ? req.body.reason.slice(0, 500) : undefined;
    const now = new Date();
    const updatedBy = new mongoose.Types.ObjectId(req.user!.id);

    const cancelOpenInvoices = async () => {
      await Invoice.updateMany(
        {
          bookingId: booking._id,
          status: { $in: ['pending', 'overdue'] },
        },
        {
          $set: {
            status: 'cancelled',
          },
        }
      );
    };

    // Idempotent: already cancelled → still sync invoices and succeed.
    if (booking.status === 'cancelled') {
      await cancelOpenInvoices();
      res.status(200).json({
        success: true,
        message: 'Booking already cancelled',
        alreadyCancelled: true,
      });
      return;
    }

    if (booking.status === 'completed') {
      res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed booking',
      });
      return;
    }

    await Booking.findByIdAndUpdate(bookingId, {
      status: 'cancelled',
      cancelledAt: now,
      cancellationReason: reason,
      $push: {
        statusHistory: {
          status: 'cancelled',
          timestamp: now,
          notes: reason || 'Cancelled by client',
          updatedBy,
        },
      },
    });

    await cancelOpenInvoices();

    res.status(200).json({ success: true, message: 'Booking cancelled' });
  } catch (err) {
    next(err);
  }
};
