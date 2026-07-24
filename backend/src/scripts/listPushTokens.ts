/**
 * Diagnostic: list which users currently have push tokens registered.
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
  const withToken = await User.find({
    fcmToken: { $exists: true, $nin: [null, ''] },
  }).select('name role phone email fcmToken isActive');

  console.log(`Users with push tokens: ${withToken.length}`);
  for (const u of withToken) {
    const token = String(u.fcmToken ?? '');
    const kind = token.startsWith('ExponentPushToken')
      ? 'Exponent'
      : token.startsWith('ExpoPushToken')
        ? 'Expo'
        : 'OTHER';
    console.log(
      `  ${u.role.padEnd(18)} ${(u.name || '').padEnd(20)} active=${u.isActive} ${kind} …${token.slice(-12)}`
    );
  }

  const totalUsers = await User.countDocuments({});
  console.log(`Total users: ${totalUsers}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
