/**
 * One-off: attach demo spare parts to ATM90001 so client can see PAY EXTRA / VIEW BILL.
 * Usage: cd backend && npx ts-node src/scripts/addDemoSpareParts.ts
 */
import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import { Booking } from '../models/Booking';
import { syncInvoiceSparePartsFromBooking } from '../utils/bookingPayment';

dns.setServers(['8.8.8.8', '1.1.1.1']);

const DEMO_PARTS = [
  { name: 'Amplifier fuse kit', quantity: 2, unitCost: 450 },
  { name: 'Speaker cable (5m)', quantity: 1, unitCost: 1200 },
  { name: 'DSP mounting bracket', quantity: 1, unitCost: 800 },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI missing');

  await mongoose.connect(uri);
  console.log(`Connected: ${mongoose.connection.db?.databaseName}`);

  const booking = await Booking.findOne({ bookingId: 'ATM90001' });
  if (!booking) {
    console.error('Booking ATM90001 not found — run npm run seed first');
    process.exit(1);
  }

  booking.spareParts = DEMO_PARTS;
  booking.technicianNotes =
    'Demo spare parts added for client UI preview (fuse kit, cable, bracket).';
  if (!['in_progress', 'arrived', 'en_route', 'technician_assigned'].includes(booking.status)) {
    booking.status = 'in_progress';
  }
  await booking.save();

  await syncInvoiceSparePartsFromBooking(booking._id, DEMO_PARTS);

  const preTax = DEMO_PARTS.reduce((s, p) => s + p.quantity * p.unitCost, 0);
  const withGst = preTax + Math.round(preTax * 0.18);

  console.log(`Updated ${booking.bookingId} with ${DEMO_PARTS.length} spare part lines`);
  console.log(`  pre-tax: ₹${preTax.toLocaleString('en-IN')}`);
  console.log(`  with GST (~18%): ₹${withGst.toLocaleString('en-IN')} due as extra parts`);
  console.log('Open client Home → upcoming card should show PAY EXTRA + VIEW MORE / VIEW BILL');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
