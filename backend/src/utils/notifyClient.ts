import mongoose from 'mongoose';
import { Notification } from '../models/Notification';
import { User } from '../models/User';
import { sendExpoPushToTokens } from '../services/expoPush';

export const resolveUserId = (
  ref:
    | mongoose.Types.ObjectId
    | { _id?: mongoose.Types.ObjectId }
    | string
    | undefined
): mongoose.Types.ObjectId | null => {
  if (!ref) return null;
  if (typeof ref === 'object' && '_id' in ref && ref._id) {
    return ref._id as mongoose.Types.ObjectId;
  }
  return ref as mongoose.Types.ObjectId;
};

export const formatStatusLabel = (status: string): string =>
  status.replace(/_/g, ' ');

export const notifyClientBooking = async (
  booking: {
    _id: mongoose.Types.ObjectId;
    bookingId: string;
    clientId: mongoose.Types.ObjectId | { _id?: mongoose.Types.ObjectId };
  },
  payload: {
    title: string;
    body: string;
    type?: 'info' | 'success' | 'warning' | 'error';
  }
): Promise<void> => {
  const userId = resolveUserId(booking.clientId);
  if (!userId) return;

  const data = { bookingId: booking._id };

  await Notification.create({
    userId,
    title: payload.title,
    body: payload.body,
    type: payload.type ?? 'info',
    category: 'booking',
    data,
  });

  const user = await User.findById(userId).select('fcmToken isActive');
  if (user?.isActive && user.fcmToken) {
    const { invalidTokens } = await sendExpoPushToTokens([user.fcmToken], {
      title: payload.title,
      body: payload.body,
      data,
    });
    if (invalidTokens.length > 0) {
      await User.updateMany(
        { fcmToken: { $in: invalidTokens } },
        { $unset: { fcmToken: '' } }
      );
    }
  }
};

export const technicianContactLabel = (tech?: {
  name?: string;
  phone?: string;
} | null): string => {
  if (!tech?.name) return 'Your technician';
  return tech.phone ? `${tech.name} (${tech.phone})` : tech.name;
};
