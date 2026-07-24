import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import { User } from '../models/User';

dns.setServers(['8.8.8.8', '1.1.1.1']);

async function run(): Promise<void> {
  await mongoose.connect(process.env.MONGODB_URI!);
  const r = await User.updateMany(
    { name: /raju/i, fcmToken: { $exists: true, $nin: [null, ''] } },
    { $unset: { fcmToken: '' } }
  );
  console.log(`Cleared Raju push token(s): ${r.modifiedCount}`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
