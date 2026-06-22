import { Notification } from '../models/Notification';
import { User } from '../models/User';
import mongoose from 'mongoose';

export const notifyUsers = async (
  userIds: mongoose.Types.ObjectId[],
  payload: {
    title: string;
    body: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    category?: 'booking' | 'payment' | 'technician' | 'system';
    data?: Record<string, unknown>;
  }
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
};

export const notifyByRoles = async (
  roles: ('admin' | 'technician' | 'master_technician' | 'client')[],
  payload: Parameters<typeof notifyUsers>[1]
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
