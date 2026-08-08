/**
 * Seed 4 paid, unassigned open jobs (past dates) for technicians to accept.
 *
 * Keeps existing credentials. Creates a demo venue on the chosen client if needed.
 *
 * Usage:
 *   npx ts-node src/scripts/seedDemoOpenJobs.ts
 */
import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Venue } from '../models/Venue';
import { Booking } from '../models/Booking';
import { Invoice } from '../models/Invoice';
import { resolveInvoiceCharges } from '../config/pricing';

dns.setServers(['8.8.8.8', '1.1.1.1']);

type DemoJob = {
  bookingId: string;
  invoiceNumber: string;
  serviceType: 'general' | 'inspection' | 'installation' | 'emergency';
  daysAgo: number;
  scheduledTime: string;
  notes: string;
  venueName: string;
  area: string;
};

const DEMO_JOBS: DemoJob[] = [
  {
    bookingId: 'ATM91001',
    invoiceNumber: 'INV91001',
    serviceType: 'inspection',
    daysAgo: 1,
    scheduledTime: '11:00 AM',
    notes: 'Demo open job — General Visit (yesterday)',
    venueName: 'Demo Hall A',
    area: 'Indiranagar',
  },
  {
    bookingId: 'ATM91002',
    invoiceNumber: 'INV91002',
    serviceType: 'general',
    daysAgo: 2,
    scheduledTime: '02:00 PM',
    notes: 'Demo open job — General Service (2 days ago)',
    venueName: 'Demo Studio B',
    area: 'Koramangala',
  },
  {
    bookingId: 'ATM91003',
    invoiceNumber: 'INV91003',
    serviceType: 'inspection',
    daysAgo: 3,
    scheduledTime: '05:00 PM',
    notes: 'Demo open job — General Visit (3 days ago)',
    venueName: 'Demo Club C',
    area: 'HSR Layout',
  },
  {
    bookingId: 'ATM91004',
    invoiceNumber: 'INV91004',
    serviceType: 'general',
    daysAgo: 4,
    scheduledTime: '11:00 AM',
    notes: 'Demo open job — General Service (4 days ago)',
    venueName: 'Demo Lounge D',
    area: 'Whitefield',
  },
];

function pastDate(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function resolveClient() {
  const preferred = await User.findOne({
    email: 'client@atomik.demo',
    role: 'client',
    isActive: true,
  });
  if (preferred) return preferred;

  const anyClient = await User.findOne({ role: 'client', isActive: true }).sort({
    createdAt: 1,
  });
  if (anyClient) return anyClient;

  return User.create({
    name: 'Demo Client',
    email: 'client@atomik.demo',
    phone: '+919999990001',
    password: process.env.DEMO_USER_PASSWORD?.trim() || 'DemoClient!234',
    role: 'client',
    isActive: true,
  });
}

async function resolveVenue(
  clientId: mongoose.Types.ObjectId,
  job: DemoJob
) {
  let venue = await Venue.findOne({
    ownerId: clientId,
    name: job.venueName,
  });
  if (venue) return venue;

  venue = await Venue.create({
    name: job.venueName,
    address: `Demo address, ${job.area}`,
    area: job.area,
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
    ownerId: clientId,
    isActive: true,
  });
  return venue;
}

async function upsertOpenJob(
  clientId: mongoose.Types.ObjectId,
  job: DemoJob
): Promise<'created' | 'reset' | 'kept'> {
  const venue = await resolveVenue(clientId, job);
  const scheduledDate = pastDate(job.daysAgo);
  const now = new Date();
  const charges = resolveInvoiceCharges(job.serviceType);

  const existing = await Booking.findOne({ bookingId: job.bookingId });
  if (existing) {
    existing.technicianId = undefined;
    existing.assignedTechnicianId = undefined;
    existing.assignedByMasterId = undefined;
    existing.rejectedBy = [];
    existing.status = 'confirmed';
    existing.scheduledDate = scheduledDate;
    existing.scheduledTime = job.scheduledTime;
    existing.notes = job.notes;
    existing.venueId = venue._id;
    existing.clientId = clientId;
    existing.serviceType = job.serviceType;
    await existing.save();

    if (existing.invoiceId) {
      await Invoice.findByIdAndUpdate(existing.invoiceId, {
        $set: {
          status: 'paid',
          amountPaid: charges.totalAmount,
          totalAmount: charges.totalAmount,
          serviceCharges: charges.serviceCharges,
          taxAmount: charges.taxAmount,
          taxRate: charges.taxRate,
          paidAt: now,
          dueDate: scheduledDate,
        },
      });
    }
    return 'reset';
  }

  const booking = await Booking.create({
    bookingId: job.bookingId,
    clientId,
    venueId: venue._id,
    serviceType: job.serviceType,
    scheduledDate,
    scheduledTime: job.scheduledTime,
    status: 'confirmed',
    notes: job.notes,
    rejectedBy: [],
    statusHistory: [
      {
        status: 'pending',
        timestamp: now,
        notes: 'Demo booking created',
        updatedBy: clientId,
      },
      {
        status: 'confirmed',
        timestamp: now,
        notes: 'Payment confirmed (demo seed)',
        updatedBy: clientId,
      },
    ],
  });

  const invoice = await Invoice.create({
    invoiceNumber: job.invoiceNumber,
    bookingId: booking._id,
    clientId,
    serviceCharges: charges.serviceCharges,
    technicianCharges: charges.technicianCharges,
    spareParts: charges.spareParts,
    taxRate: charges.taxRate,
    taxAmount: charges.taxAmount,
    totalAmount: charges.totalAmount,
    amountPaid: charges.totalAmount,
    status: 'paid',
    dueDate: scheduledDate,
    paidAt: now,
    paymentHistory: [
      {
        amount: charges.totalAmount,
        type: 'base_service',
        paidAt: now,
      },
    ],
  });

  booking.invoiceId = invoice._id;
  await booking.save();
  return 'created';
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Connected to database: ${mongoose.connection.db?.databaseName}`);
  console.log(
    'Seeding 4 paid open jobs (past dates, unassigned) for technician accept…\n'
  );

  const client = await resolveClient();
  console.log(
    `  client: ${client.name} (${client.email || client.phone || client._id})`
  );

  for (const job of DEMO_JOBS) {
    const result = await upsertOpenJob(client._id, job);
    const when = pastDate(job.daysAgo).toISOString().slice(0, 10);
    console.log(
      `  ${result.padEnd(7)} ${job.bookingId} · ${job.serviceType} · ${when} ${job.scheduledTime} · ${job.venueName}`
    );
  }

  console.log(
    '\nDone. Technicians can open Available jobs and Accept any of ATM91001–ATM91004.'
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
