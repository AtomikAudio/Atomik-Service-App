/**
 * Send a test Expo push to every user that has a token and print ticket results.
 */
import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { sendExpoPushToTokens } from '../services/expoPush';

dns.setServers(['8.8.8.8', '1.1.1.1']);

async function run(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const users = await User.find({
    fcmToken: { $exists: true, $nin: [null, ''] },
  }).select('name role fcmToken');

  console.log(`Sending test push to ${users.length} token(s)...\n`);

  for (const u of users) {
    const token = String(u.fcmToken);
    console.log(`→ ${u.role} ${u.name}`);
    console.log(`  token: ${token.slice(0, 28)}…${token.slice(-10)}`);

    // Hit Expo directly so we see the raw ticket (sendExpoPushToTokens only logs warns).
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          to: token,
          title: 'ATOMIK test',
          body: `Test push for ${u.name} (${u.role})`,
          sound: 'default',
          channelId: 'default',
          priority: 'high',
          data: { test: '1' },
        },
      ]),
    });
    const json = await res.json();
    console.log(`  HTTP ${res.status}`);
    console.log(`  ticket: ${JSON.stringify(json, null, 2)}`);
    console.log('');
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
