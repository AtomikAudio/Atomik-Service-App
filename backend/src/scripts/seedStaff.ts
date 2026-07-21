import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { toE164 } from '../utils/phone';

type StaffRole = 'admin' | 'master_technician' | 'technician';

interface StaffAccount {
  name: string;
  /** 10-digit phone — stored as +91XXXXXXXXXX so users only type the number. */
  phone?: string;
  /** Email login (used for accounts without a phone, e.g. the developer). */
  email?: string;
  /** Env var that holds this account's password (kept out of source/git). */
  passwordEnv: string;
  role: StaffRole;
}

/**
 * Real staff accounts. Login = phone number (10 digits) OR email + password.
 * Phones are normalised to +91 on save, so users only enter the 10 digits.
 *
 * Passwords are NEVER hardcoded here — they are read from environment variables
 * so they never land in git. Set them in backend/.env (gitignored). The plaintext
 * values live only in the local, gitignored STAFF_CREDENTIALS.local.md.
 */
const STAFF: StaffAccount[] = [
  // Technicians
  {
    name: 'Raju',
    phone: '9538544497',
    passwordEnv: 'STAFF_RAJU_PASSWORD',
    role: 'technician',
  },
  {
    name: 'Sourav',
    phone: '8310243378',
    passwordEnv: 'STAFF_SOURAV_PASSWORD',
    role: 'technician',
  },
  {
    name: 'Hassan',
    phone: '6201543477',
    passwordEnv: 'STAFF_HASSAN_PASSWORD',
    role: 'technician',
  },
  // Master technician (only one allowed by the schema)
  {
    name: 'Sultan',
    phone: '8088644033',
    passwordEnv: 'STAFF_SULTAN_PASSWORD',
    role: 'master_technician',
  },
  // Admins
  {
    name: 'Sahil Madaan',
    phone: '8088675627',
    passwordEnv: 'STAFF_SAHIL_PASSWORD',
    role: 'admin',
  },
  {
    name: 'Developer',
    email: 'developer@atomikaudio.com',
    passwordEnv: 'STAFF_DEVELOPER_PASSWORD',
    role: 'admin',
  },
];

function resolvePassword(account: StaffAccount): string {
  const password = process.env[account.passwordEnv]?.trim();
  if (!password) {
    const who = account.phone ? `+91${account.phone}` : account.email ?? account.name;
    throw new Error(
      `Missing ${account.passwordEnv} for ${account.role} (${who}). ` +
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
  if (!account.phone && !account.email) {
    throw new Error(`${account.name}: a phone or email is required`);
  }
  const phone = account.phone ? toE164(account.phone) : undefined; // -> +91XXXXXXXXXX
  const email = account.email?.trim().toLowerCase();
  const password = resolvePassword(account);

  // Match an existing account by phone or email. Only one master_technician is
  // allowed by the schema, so reuse the existing master slot when seeding it.
  const user =
    (phone ? await User.findOne({ phone }).select('+password') : null) ??
    (email ? await User.findOne({ email }).select('+password') : null) ??
    (account.role === 'master_technician'
      ? await User.findOne({ role: 'master_technician' }).select('+password')
      : null);

  if (user) {
    user.name = account.name;
    if (phone) user.phone = phone;
    if (email) user.email = email;
    user.role = account.role;
    user.password = password; // hashed by the User pre-save hook
    user.isActive = true;
    if (phone) user.phoneVerified = true;
    await user.save();
    return 'updated';
  }

  await User.create({
    name: account.name,
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    password,
    role: account.role,
    isActive: true,
    phoneVerified: Boolean(phone),
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
    const login = account.phone ? `+91${account.phone}` : account.email ?? '';
    console.log(`  ${result.padEnd(7)} ${account.role.padEnd(18)} ${login}`);
  }

  console.log('\nDone. Sign in with the phone number (10 digits) or email + password.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
