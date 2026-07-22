/**
 * One-off: wipe all stored Expo push tokens so stale Expo Go tokens stop
 * receiving pushes. Users re-register on next login in a real (non-Expo-Go) build.
 */
import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import { User } from '../models/User';

dns.setServers(['8.8.8.8', '1.1.1.1']);

async function run(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const result = await User.updateMany(
    { fcmToken: { $exists: true, $nin: [null, ''] } },
    { $unset: { fcmToken: '' } }
  );
  console.log(`Cleared push tokens on ${result.modifiedCount} user(s).`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
