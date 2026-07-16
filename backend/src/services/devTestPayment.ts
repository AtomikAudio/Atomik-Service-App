/**
 * DISABLED — ₹1 dev test payment backend helper.
 * To re-enable: uncomment createDevTestPaymentOrder in paymentController.ts + route in routes/payments.ts.
 */
import { Booking } from '../models/Booking';
import { Invoice } from '../models/Invoice';
import { Venue } from '../models/Venue';
import { getInvoiceBalanceDue } from '../utils/bookingPayment';
import { toObjectId } from '../utils/mongoQuery';

const DEV_TEST_AMOUNT = 1;
const DEV_INVOICE_PREFIX = 'DEVTEST';

const generateBookingId = (): string => {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `ATM${num}`;
};

const generateDevInvoiceNumber = (): string => {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `${DEV_INVOICE_PREFIX}${num}`;
};

export function isDevTestPaymentAllowed(): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.ALLOW_DEV_TEST_PAYMENT === 'true'
  );
}

/** Temporary ₹1 invoice for local/dev Razorpay testing — remove after QA. */
export async function ensureDevTestInvoice(clientId: string) {
  const clientOid = toObjectId(clientId, 'clientId');

  const existing = await Invoice.findOne({
    clientId: clientOid,
    invoiceNumber: { $regex: /^DEVTEST/ },
    status: { $in: ['pending', 'overdue'] },
  }).sort({ createdAt: -1 });

  if (existing && getInvoiceBalanceDue(existing) > 0) {
    const booking = await Booking.findById(existing.bookingId);
    if (booking) {
      return { invoice: existing, booking };
    }
  }

  const venue = await Venue.findOne({ ownerId: clientOid, isActive: true });
  if (!venue) {
    throw new Error(
      'Add a venue in your account before running the ₹1 dev payment test.'
    );
  }

  const scheduledDate = new Date();
  scheduledDate.setHours(12, 0, 0, 0);

  const booking = await Booking.create({
    bookingId: generateBookingId(),
    clientId: clientOid,
    venueId: venue._id,
    serviceType: 'general',
    scheduledDate,
    scheduledTime: '12:00 PM',
    notes: 'DEV TEST — ₹1 payment (temporary, remove after testing)',
    status: 'pending',
    statusHistory: [
      {
        status: 'pending',
        timestamp: new Date(),
        updatedBy: clientOid,
      },
    ],
  });

  const invoice = await Invoice.create({
    invoiceNumber: generateDevInvoiceNumber(),
    bookingId: booking._id,
    clientId: clientOid,
    serviceCharges: DEV_TEST_AMOUNT,
    technicianCharges: 0,
    spareParts: 0,
    taxRate: 0,
    taxAmount: 0,
    totalAmount: DEV_TEST_AMOUNT,
    dueDate: scheduledDate,
  });

  await Booking.findByIdAndUpdate(booking._id, { invoiceId: invoice._id });

  return { invoice, booking };
}
