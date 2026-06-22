import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { toE164 } from '../utils/phone';

type StaffRole = 'admin' | 'master_technician' | 'technician';

interface StaffAccount {
  name: string;
  /** 10-digit phone — stored as +91XXXXXXXXXX so users only type the number. */
  phone: string;
  /** Env var that holds this account's password (kept out of source/git). */
  passwordEnv: string;
  role: StaffRole;
}

/**
 * Real staff accounts. Login = phone number (10 digits) + password.
 * Phones are normalised to +91 on save, so users only enter the 10 digits.
 *
 * Passwords are read from environment variables so they are never committed.
 * Set these in backend/.env (gitignored) or inline before running:
 *   STAFF_ADMIN_PASSWORD, STAFF_MASTER_PASSWORD, STAFF_TECH_PASSWORD
 */
const STAFF: StaffAccount[] = [
  {
    name: 'Sahil',
    phone: '8088675627',
    passwordEnv: 'STAFF_ADMIN_PASSWORD',
    role: 'admin',
  },
  {
    name: 'Sultan',
    phone: '8088644033',
    passwordEnv: 'STAFF_MASTER_PASSWORD',
    role: 'master_technician',
  },
  {
    name: 'Sourav',
    phone: '8310243378',
    passwordEnv: 'STAFF_TECH_PASSWORD',
    role: 'technician',
  },
];

function resolvePassword(account: StaffAccount): string {
  const password = process.env[account.passwordEnv]?.trim();
  if (!password) {
    throw new Error(
      `Missing ${account.passwordEnv} for ${account.role} (+91${account.phone}). ` +
        `Set it in backend/.env or inline before running.`
    );
  }
  if (password.length < 8) {
    throw new Error(`${account.passwordEnv} must be at least 8 characters`);
  }
  return password;
}

/**
 * The `email` index must be sparse so multiple phone-only (no-email) staff
 * accounts can coexist. Older databases may have a non-sparse unique index,
 * which rejects a second document with a missing/null email.
 */
async function ensureSparseEmailIndex(): Promise<void> {
  const indexes = await User.collection.indexes();
  const emailIndex = indexes.find((i) => i.name === 'email_1');
  if (emailIndex && !emailIndex.sparse) {
    await User.collection.dropIndex('email_1');
    console.log('  fixed: rebuilt email index as sparse');
  }
  await User.collection.createIndex(
    { email: 1 },
    { unique: true, sparse: true, name: 'email_1' }
  );
}

async function upsertStaff(account: StaffAccount): Promise<'created' | 'updated'> {
  const phone = toE164(account.phone); // -> +91XXXXXXXXXX
  const password = resolvePassword(account);

  // Only one master_technician is allowed by the schema; reuse the existing
  // slot if we're seeding the master and no account exists at this phone yet.
  const user =
    (await User.findOne({ phone }).select('+password')) ??
    (account.role === 'master_technician'
      ? await User.findOne({ role: 'master_technician' }).select('+password')
      : null);

  if (user) {
    user.name = account.name;
    user.phone = phone;
    user.role = account.role;
    user.password = password; // hashed by the User pre-save hook
    user.isActive = true;
    user.phoneVerified = true;
    await user.save();
    return 'updated';
  }

  await User.create({
    name: account.name,
    phone,
    password,
    role: account.role,
    isActive: true,
    phoneVerified: true,
  });
  return 'created';
}

async function run(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing — set it in backend/.env (or the shell) before running.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Connected to database: ${mongoose.connection.db?.databaseName}`);
  console.log('Seeding staff accounts (non-destructive)...\n');

  await ensureSparseEmailIndex();

  for (const account of STAFF) {
    const result = await upsertStaff(account);
    console.log(`  ${result.padEnd(7)} ${account.role.padEnd(18)} +91${account.phone}`);
  }

  console.log('\nDone. Sign in with the phone number (10 digits) + password.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
