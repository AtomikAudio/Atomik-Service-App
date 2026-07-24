/**
 * One-off: send a test Expo push to client@atomikaudio.com
 */
import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import { User } from '../models/User';

dns.setServers(['8.8.8.8', '1.1.1.1']);

const EMAIL = 'client@atomik.demo';
const BODY = '(this is a test message)';

async function run(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const user = await User.findOne({ email: new RegExp(`^${EMAIL}$`, 'i') }).select(
    'name email role fcmToken isActive'
  );

  if (!user) {
    console.error(`No user found for ${EMAIL}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(
    `User: ${user.name} <${user.email}> role=${user.role} active=${user.isActive}`
  );

  if (!user.fcmToken) {
    console.error(
      'No push token on this user. Expo Go cannot register remote push tokens — use a development/production build.'
    );
    await mongoose.disconnect();
    process.exit(2);
  }

  const token = String(user.fcmToken);
  console.log(
    `Token: ${token.startsWith('ExponentPushToken') ? 'ExponentPushToken' : 'other'} …${token.slice(-10)}`
  );

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      {
        to: token,
        title: 'ATOMIK',
        body: BODY,
        sound: 'default',
        channelId: 'default',
        priority: 'high',
        data: { test: '1' },
      },
    ]),
  });

  const json = await res.json();
  console.log(`HTTP ${res.status}`);
  console.log(JSON.stringify(json, null, 2));
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
