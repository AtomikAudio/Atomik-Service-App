import 'dotenv/config';
import mongoose from 'mongoose';
import { Booking } from '../models/Booking';
import { Invoice } from '../models/Invoice';
import { SlotHold } from '../models/SlotHold';

/**
 * One-off maintenance: free every slot for a clean slate.
 *
 * - Deletes all temporary slot holds.
 * - Deletes UNPAID bookings (no payment recorded) and their unpaid invoices.
 * - Cancels remaining PAID active bookings so their slots free up, while
 *   keeping the booking + invoice (payment history is preserved).
 *
 * NEVER touches the User collection (logins) and NEVER removes invoices that
 * carry any payment (payment history stays intact).
 */

// Statuses that actively occupy a future slot.
const ACTIVE_STATUSES = [
  'pending',
  'confirmed',
  'technician_assigned',
  'en_route',
  'arrived',
  'in_progress',
] as const;

function invoiceIsPaid(inv: {
  amountPaid?: number;
  status?: string;
  paidAt?: Date | null;
  paymentHistory?: unknown[];
} | null): boolean {
  if (!inv) return false;
  return (
    (inv.amountPaid ?? 0) > 0 ||
    inv.status === 'paid' ||
    !!inv.paidAt ||
    (inv.paymentHistory?.length ?? 0) > 0
  );
}

async function run(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing — set it in backend/.env (or the shell).');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Connected to database: ${mongoose.connection.db?.databaseName}`);
  console.log('Freeing slots (non-destructive to logins & payment history)...\n');

  // 1) Drop all temporary holds.
  const holdsResult = await SlotHold.deleteMany({});
  console.log(`  slot holds deleted:        ${holdsResult.deletedCount ?? 0}`);

  // 2 + 3) Walk active bookings and either delete (unpaid) or cancel (paid).
  const activeBookings = await Booking.find({
    status: { $in: ACTIVE_STATUSES as unknown as string[] },
  });

  let deletedBookings = 0;
  let deletedInvoices = 0;
  let cancelledBookings = 0;

  for (const b of activeBookings) {
    const invoice = b.invoiceId ? await Invoice.findById(b.invoiceId) : null;

    if (invoiceIsPaid(invoice)) {
      // Paid: free the slot by cancelling, keep the record + invoice/history.
      b.status = 'cancelled';
      b.cancelledAt = new Date();
      b.cancellationReason = 'Data reset — slot freed (paid booking retained)';
      b.statusHistory.push({
        status: 'cancelled',
        timestamp: new Date(),
        notes: 'Slots freed for clean slate',
        updatedBy: b.clientId,
      });
      await b.save();
      cancelledBookings += 1;
    } else {
      // Unpaid: remove the service entirely, plus its unpaid invoice.
      if (invoice && !invoiceIsPaid(invoice)) {
        await Invoice.deleteOne({ _id: invoice._id });
        deletedInvoices += 1;
      }
      await Booking.deleteOne({ _id: b._id });
      deletedBookings += 1;
    }
  }

  console.log(`  unpaid bookings deleted:   ${deletedBookings}`);
  console.log(`  unpaid invoices deleted:   ${deletedInvoices}`);
  console.log(`  paid bookings cancelled:   ${cancelledBookings}`);
  console.log('\nDone. All slots are free. Logins and payment history untouched.');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
