import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Booking } from '../models/Booking';
import { Invoice } from '../models/Invoice';
import { Notification } from '../models/Notification';
import { Venue } from '../models/Venue';
import { Review } from '../models/Review';
import { Technician } from '../models/Technician';
import { AdminAuditLog } from '../models/AdminAuditLog';
import { OtpVerification } from '../models/OtpVerification';
import { SlotHold } from '../models/SlotHold';
import {
  getStaffPreserveEmails,
  getStaffPreservePhones,
} from './seedStaff';

const DEMO_EMAILS = [
  'client@atomik.demo',
  'master@atomik.demo',
  'tech@atomik.demo',
  'admin@atomik.demo',
];

export async function clearDemoData(): Promise<void> {
  const preserveEmails = [
    ...DEMO_EMAILS.map((e) => e.toLowerCase()),
    ...getStaffPreserveEmails(),
  ];
  const preservePhones = getStaffPreservePhones();

  const demoUsers = await User.find({
    email: { $in: DEMO_EMAILS.map((e) => e.toLowerCase()) },
  }).select('_id email');

  const staffUsers = await User.find({
    $or: [
      { email: { $in: getStaffPreserveEmails() } },
      { phone: { $in: preservePhones } },
    ],
  }).select('_id name phone email role');

  const [
    bookings,
    invoices,
    notifications,
    venues,
    reviews,
    technicians,
    audits,
    otps,
    holds,
    otherUsers,
  ] = await Promise.all([
    Booking.deleteMany({}),
    Invoice.deleteMany({}),
    Notification.deleteMany({}),
    Venue.deleteMany({}),
    Review.deleteMany({}),
    Technician.deleteMany({}),
    AdminAuditLog.deleteMany({}),
    OtpVerification.deleteMany({}),
    SlotHold.deleteMany({}),
    // Keep demo + real staff accounts forever — never wipe STAFF_CREDENTIALS logins.
    User.deleteMany({
      $nor: [
        { email: { $in: preserveEmails } },
        { phone: { $in: preservePhones } },
      ],
    }),
  ]);

  console.log(`  deleted ${bookings.deletedCount} booking(s)`);
  console.log(`  deleted ${invoices.deletedCount} invoice(s)`);
  console.log(`  deleted ${notifications.deletedCount} notification(s)`);
  console.log(`  deleted ${venues.deletedCount} venue(s)`);
  console.log(`  deleted ${reviews.deletedCount} review(s)`);
  console.log(`  deleted ${technicians.deletedCount} technician profile(s)`);
  console.log(`  deleted ${audits.deletedCount} audit log(s)`);
  console.log(`  deleted ${otps.deletedCount} OTP record(s)`);
  console.log(`  deleted ${holds.deletedCount} slot hold(s)`);
  console.log(`  deleted ${otherUsers.deletedCount} non-demo/non-staff user(s)`);
  console.log(`  kept ${demoUsers.length} demo account(s):`);
  demoUsers.forEach((u) => console.log(`    - ${u.email}`));
  console.log(`  kept ${staffUsers.length} staff account(s):`);
  staffUsers.forEach((u) =>
    console.log(`    - ${u.name} (${u.role}) ${u.phone || u.email || ''}`)
  );
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to clear demo data in production.');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Connected to database: ${mongoose.connection.db?.databaseName}`);
  console.log(
    'Clearing operational demo data (keeping @atomik.demo + staff accounts)...\n'
  );

  await clearDemoData();

  console.log('\nDone. Run npm run seed to refresh demo + staff accounts.');
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
