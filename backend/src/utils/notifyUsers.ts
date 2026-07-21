import { Notification } from '../models/Notification';
import { User } from '../models/User';
import mongoose from 'mongoose';
import { sendExpoPushToTokens } from '../services/expoPush';

type NotifyPayload = {
  title: string;
  body: string;
  type?: 'info' | 'warning' | 'success' | 'error';
  category?: 'booking' | 'payment' | 'technician' | 'system';
  data?: Record<string, unknown>;
};

export const notifyUsers = async (
  userIds: mongoose.Types.ObjectId[],
  payload: NotifyPayload
) => {
  if (userIds.length === 0) return;

  await Notification.insertMany(
    userIds.map((userId) => ({
      userId,
      title: payload.title,
      body: payload.body,
      type: payload.type ?? 'info',
      category: payload.category ?? 'system',
      data: payload.data,
      isRead: false,
    }))
  );

  const users = await User.find({
    _id: { $in: userIds },
    isActive: true,
    fcmToken: { $exists: true, $nin: [null, ''] },
  }).select('fcmToken');

  const { invalidTokens } = await sendExpoPushToTokens(
    users.map((u) => u.fcmToken),
    {
      title: payload.title,
      body: payload.body,
      data: payload.data,
    }
  );

  // Drop tokens Expo says are dead so they don't linger and mask real delivery.
  if (invalidTokens.length > 0) {
    await User.updateMany(
      { fcmToken: { $in: invalidTokens } },
      { $unset: { fcmToken: '' } }
    );
  }
};

export const notifyByRoles = async (
  roles: ('admin' | 'technician' | 'master_technician' | 'client')[],
  payload: NotifyPayload
) => {
  const users = await User.find({
    role: { $in: roles },
    isActive: true,
  }).select('_id');
  await notifyUsers(
    users.map((u) => u._id as mongoose.Types.ObjectId),
    payload
  );
};
