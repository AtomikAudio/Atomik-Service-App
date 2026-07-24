/**
 * Send a test push to Sid and poll Expo receipts for the real FCM outcome.
 */
import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import { User } from '../models/User';

dns.setServers(['8.8.8.8', '1.1.1.1']);

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function run(): Promise<void> {
  await mongoose.connect(process.env.MONGODB_URI!);
  const sid = await User.findOne({
    name: /^sid$/i,
    fcmToken: { $exists: true, $nin: [null, ''] },
  }).select('name role fcmToken phone email');

  if (!sid?.fcmToken) {
    console.error('No Sid user with a push token found.');
    process.exit(1);
  }

  const token = String(sid.fcmToken);
  console.log(`Sid: ${sid.name} (${sid.role}) ${sid.phone || sid.email || ''}`);
  console.log(`Token: ${token}\n`);

  const sendRes = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      {
        to: token,
        title: 'ATOMIK tray test',
        body: 'If you see this in the phone notification shade, FCM works.',
        sound: 'default',
        channelId: 'default',
        priority: 'high',
        ttl: 60,
        data: { test: 'tray' },
      },
    ]),
  });
  const sendJson = (await sendRes.json()) as {
    data?: Array<{ status: string; id?: string; message?: string; details?: { error?: string } }>;
  };
  console.log('Ticket:', JSON.stringify(sendJson, null, 2));

  const ticketId = sendJson.data?.[0]?.id;
  if (!ticketId) {
    console.error('No ticket id — cannot fetch receipt.');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('\nWaiting 20s for FCM receipt...');
  await sleep(20000);

  const receiptRes = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids: [ticketId] }),
  });
  const receiptText = await receiptRes.text();
  console.log(`Receipt HTTP ${receiptRes.status}`);
  console.log(receiptText);

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
