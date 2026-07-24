/**
 * Hash any plaintext User.password values with bcryptjs.
 * Already-hashed ($2a$/$2b$/$2y$) rows are left untouched.
 *
 * Usage:
 *   CONFIRM=YES npx ts-node src/scripts/hashPlaintextPasswords.ts
 */
import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { isBcryptHash } from '../models/User';

dns.setServers(['8.8.8.8', '1.1.1.1']);

const BCRYPT_ROUNDS = 12;

async function main() {
  if (process.env.CONFIRM !== 'YES') {
    console.error('Refusing to run without CONFIRM=YES');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) {
    console.error('No database connection');
    process.exit(1);
  }

  console.log(`Connected to database: ${db.databaseName}`);
  console.log('Hashing plaintext passwords with bcryptjs (cost 12)...\n');

  const users = await db
    .collection('users')
    .find({})
    .project({ password: 1, role: 1, name: 1 })
    .toArray();

  let hashed = 0;
  let already = 0;
  let skipped = 0;

  for (const user of users) {
    const password = typeof user.password === 'string' ? user.password : '';
    if (!password) {
      skipped += 1;
      continue;
    }
    if (isBcryptHash(password)) {
      already += 1;
      continue;
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { password: hash } }
    );
    hashed += 1;
    console.log(
      `  hashed ${user.role ?? 'user'} account (${String(user._id).slice(-6)})`
    );
  }

  console.log('\nDone.');
  console.log(`  newly hashed: ${hashed}`);
  console.log(`  already bcrypt: ${already}`);
  console.log(`  skipped (empty): ${skipped}`);
  console.log(`  total users: ${users.length}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
