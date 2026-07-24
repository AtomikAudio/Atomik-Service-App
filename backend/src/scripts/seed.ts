import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Booking } from '../models/Booking';
import { Invoice } from '../models/Invoice';
import { Venue } from '../models/Venue';
import { AppConfig } from '../models/AppConfig';
import { clearDemoData } from './clearDemoData';
import { upsertAllStaff } from './seedStaff';
import { resolveInvoiceCharges } from '../config/pricing';

// Windows / corporate DNS often fails SRV lookups for mongodb+srv — use public resolvers.
dns.setServers(['8.8.8.8', '1.1.1.1']);

const SENDGRID_SEED = {
  fromName: 'ATOMIK',
  purpose: 'welcome_and_order_emails',
};

function requireDemoPassword(): string {
  const password = process.env.DEMO_USER_PASSWORD?.trim();
  if (!password) {
    throw new Error(
      'DEMO_USER_PASSWORD is required in backend/.env to run seed (local dev only). See backend/.env.example'
    );
  }
  if (password.length < 8) {
    throw new Error('DEMO_USER_PASSWORD must be at least 8 characters');
  }
  return password;
}

function buildDemoUsers(password: string) {
  return [
    {
      name: 'Saurav Kumar',
      email: 'client@atomik.demo',
      phone: '+919876543210',
      password,
      role: 'client' as const,
    },
    {
      name: 'Rahul Master',
      email: 'master@atomik.demo',
      phone: '+919876543213',
      password,
      role: 'master_technician' as const,
    },
    {
      name: 'Aditya',
      email: 'tech@atomik.demo',
      phone: '+919876543211',
      password,
      role: 'technician' as const,
    },
    {
      name: 'Admin',
      email: 'admin@atomik.demo',
      phone: '+919876543212',
      password,
      role: 'admin' as const,
    },
  ];
}

async function seedTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
  if (!accountSid || !fromNumber) {
    console.log(
      '  skip twilio_sms seed — set TWILIO_ACCOUNT_SID and TWILIO_FROM_NUMBER in backend/.env'
    );
    return;
  }

  const envToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const value: Record<string, string> = {
    accountSid,
    fromNumber,
    purpose: 'signup_otp',
  };
  if (envToken && envToken !== 'your_twilio_auth_token_here') {
    value.authToken = envToken;
  }

  await AppConfig.findOneAndUpdate(
    { key: 'twilio_sms' },
    { key: 'twilio_sms', value },
    { upsert: true, new: true }
  );
  console.log(`  twilio_sms config seeded (SID + From number)`);
  if (value.authToken) {
    console.log(`  twilio auth token saved to database from TWILIO_AUTH_TOKEN env`);
  } else {
    console.log(`  Set TWILIO_AUTH_TOKEN in backend/.env (replace [AuthToken] from Twilio curl)`);
  }
}

async function seedSendgridConfig() {
  await AppConfig.findOneAndUpdate(
    { key: 'sendgrid_email' },
    {
      key: 'sendgrid_email',
      value: {
        fromName: SENDGRID_SEED.fromName,
        purpose: SENDGRID_SEED.purpose,
      },
    },
    { upsert: true, new: true }
  );
  console.log(`  sendgrid_email config seeded (from name: ${SENDGRID_SEED.fromName})`);
  console.log(`  Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL in backend/.env`);
}

async function seedDemoOpenJob(): Promise<void> {
  const client = await User.findOne({ email: 'client@atomik.demo' });
  if (!client) {
    console.log('  skip demo job — client account not found');
    return;
  }

  let venue = await Venue.findOne({
    ownerId: client._id,
    name: 'Demo Studio (Seed)',
  });

  if (!venue) {
    venue = await Venue.create({
      name: 'Demo Studio (Seed)',
      address: '12 MG Road',
      area: 'Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560038',
      ownerId: client._id,
      isActive: true,
    });
    console.log('  demo venue created (Demo Studio)');
  }

  const bookingId = 'ATM90001';
  const existing = await Booking.findOne({ bookingId });
  if (existing) {
    if (!existing.technicianId && !existing.assignedTechnicianId) {
      console.log(`  demo open job ${bookingId} already exists (unassigned)`);
    } else {
      existing.technicianId = undefined;
      existing.assignedTechnicianId = undefined;
      existing.status = 'confirmed';
      await existing.save();
      console.log(`  reset demo job ${bookingId} to unassigned for master assign`);
    }
    return;
  }

  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() + 2);
  scheduledDate.setHours(0, 0, 0, 0);

  const {
    serviceCharges,
    technicianCharges,
    spareParts,
    taxRate,
    taxAmount,
    totalAmount,
  } = resolveInvoiceCharges('general');
  const now = new Date();

  const booking = await Booking.create({
    bookingId,
    clientId: client._id,
    venueId: venue._id,
    serviceType: 'general',
    scheduledDate,
    scheduledTime: '10:00',
    status: 'confirmed',
    notes: 'Demo seeded job — assign via master technician dashboard',
    statusHistory: [
      {
        status: 'pending',
        timestamp: now,
        notes: 'Demo booking created',
        updatedBy: client._id,
      },
      {
        status: 'confirmed',
        timestamp: now,
        notes: 'Payment confirmed (demo seed)',
        updatedBy: client._id,
      },
    ],
  });

  const invoice = await Invoice.create({
    invoiceNumber: 'INV90001',
    bookingId: booking._id,
    clientId: client._id,
    serviceCharges,
    technicianCharges,
    spareParts,
    taxRate,
    taxAmount,
    totalAmount,
    amountPaid: totalAmount,
    status: 'paid',
    dueDate: scheduledDate,
    paidAt: now,
    paymentHistory: [
      {
        amount: totalAmount,
        type: 'base_service',
        paidAt: now,
      },
    ],
  });

  booking.invoiceId = invoice._id;
  await booking.save();

  console.log(`  demo open job ${bookingId} created (unassigned — for master assign)`);
}

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run seed in production. Create admin users via a secure ops script.');
    process.exit(1);
  }

  const demoPassword = requireDemoPassword();
  const demoUsers = buildDemoUsers(demoPassword);

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const dbName = mongoose.connection.db?.databaseName;
  console.log(`Connected to database: ${dbName}`);

  console.log('Clearing bookings, invoices, venues, and other demo data...\n');
  await clearDemoData();
  console.log('');

  for (const demo of demoUsers) {
    const email = demo.email.toLowerCase();
    const existing =
      (await User.findOne({ email }).select('_id')) ??
      (await User.findOne({ phone: demo.phone }).select('_id'));

    if (existing) {
      // Keep existing password/credentials — only refresh profile fields for demo dashboards.
      await User.updateOne(
        { _id: existing._id },
        {
          $set: {
            name: demo.name,
            phone: demo.phone,
            email,
            role: demo.role,
            isActive: true,
          },
        }
      );
      console.log(`  kept credentials for ${email} (${demo.role})`);
      continue;
    }

    await User.create({ ...demo, email });
    console.log(`  created ${email} (${demo.role})`);
  }

  console.log('');
  await seedDemoOpenJob();
  await seedTwilioConfig();
  await seedSendgridConfig();

  console.log('\nSeeding / refreshing staff accounts (never removed by seed)...\n');
  try {
    await upsertAllStaff();
  } catch (err) {
    console.error(
      '  Staff seed skipped/failed — set STAFF_*_PASSWORD vars in backend/.env'
    );
    console.error(err instanceof Error ? err.message : err);
  }

  console.log(`\nDemo login (password from DEMO_USER_PASSWORD env)`);
  console.log('Sign in with email OR phone + password — role routes automatically.');
  console.log('Master technician: master@atomik.demo — open job ATM90001 ready to assign.');
  console.log('Staff logins: see STAFF_CREDENTIALS.local.md (local only).');
  console.log('Emails: welcome on signup, order details on booking (SendGrid).');
  if (process.env.TWILIO_FROM_NUMBER?.trim()) {
    console.log('Twilio From:', process.env.TWILIO_FROM_NUMBER.trim());
  }
  console.log('See DEMO_CREDENTIALS.md in project root.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
