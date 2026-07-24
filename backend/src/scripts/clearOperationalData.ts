/**
 * Production-prep wipe: remove bookings, payments, slots, and related noise.
 * KEEPS all User accounts (credentials), Venues, and Technician profiles.
 *
 * Usage:
 *   CONFIRM=YES npx ts-node src/scripts/clearOperationalData.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Booking } from '../models/Booking';
import { Invoice } from '../models/Invoice';
import { Notification } from '../models/Notification';
import { Review } from '../models/Review';
import { AdminAuditLog } from '../models/AdminAuditLog';
import { OtpVerification } from '../models/OtpVerification';
import { SlotHold } from '../models/SlotHold';
import { Technician } from '../models/Technician';
import { Venue } from '../models/Venue';

async function main() {
  if (process.env.CONFIRM !== 'YES') {
    console.error(
      'Refusing to run without CONFIRM=YES (this deletes bookings/invoices/slots).'
    );
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const dbName = mongoose.connection.db?.databaseName;
  console.log(`Connected to database: ${dbName}`);
  console.log(
    'Clearing payments / bookings / slots — keeping all user accounts, venues, technician profiles.\n'
  );

  const userCount = await User.countDocuments();
  const venueCount = await Venue.countDocuments();
  const techCount = await Technician.countDocuments();

  const [
    bookings,
    invoices,
    notifications,
    reviews,
    audits,
    otps,
    holds,
  ] = await Promise.all([
    Booking.deleteMany({}),
    Invoice.deleteMany({}),
    Notification.deleteMany({}),
    Review.deleteMany({}),
    AdminAuditLog.deleteMany({}),
    OtpVerification.deleteMany({}),
    SlotHold.deleteMany({}),
  ]);

  // Reset job counters on technician profiles (accounts stay).
  const techReset = await Technician.updateMany(
    {},
    {
      $set: {
        totalJobsCompleted: 0,
        rating: 0,
        ratingCount: 0,
        isAvailable: true,
        currentLocation: undefined,
      },
    }
  );

  console.log(`  deleted ${bookings.deletedCount} booking(s) / service(s)`);
  console.log(`  deleted ${invoices.deletedCount} invoice(s) / payment(s)`);
  console.log(`  deleted ${holds.deletedCount} slot hold(s)`);
  console.log(`  deleted ${notifications.deletedCount} notification(s)`);
  console.log(`  deleted ${reviews.deletedCount} review(s)`);
  console.log(`  deleted ${audits.deletedCount} audit log(s)`);
  console.log(`  deleted ${otps.deletedCount} OTP record(s)`);
  console.log(
    `  reset ${techReset.modifiedCount} technician profile job counter(s)`
  );
  console.log('');
  console.log(`  kept ${userCount} user account(s)`);
  console.log(`  kept ${venueCount} venue(s)`);
  console.log(`  kept ${techCount} technician profile(s)`);
  console.log('\nDone. Database is ready for production traffic.');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
