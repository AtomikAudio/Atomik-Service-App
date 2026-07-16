import mongoose from 'mongoose';
import { BOOKING_TIME_SLOTS, SLOT_HOLD_DURATION_MS } from '../config/timeSlots';
import { SlotHold } from '../models/SlotHold';
import { Booking } from '../models/Booking';
import { BadRequestError } from '../utils/mongoQuery';
import {
  normalizeScheduledTime,
  parseScheduledDate,
  toISODateStringIST,
} from '../utils/schedule';

export type SlotStatus = 'available' | 'booked' | 'held_by_you' | 'held_by_other';

export type SlotAvailabilityItem = {
  time: string;
  status: SlotStatus;
  expiresAt?: string;
  secondsRemaining?: number;
};

function displayTimeFromNormalized(normalized: string): string {
  return normalized.replace(/\s*IST\s*$/i, '').trim();
}

export function normalizeSlotDate(dateInput: string): string {
  return toISODateStringIST(parseScheduledDate(dateInput));
}

export function normalizeSlotTime(time: string): string {
  const cleaned = time.replace(/\s*IST\s*$/i, '').trim();
  return normalizeScheduledTime(cleaned);
}

function secondsUntil(expiresAt: Date): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
}

export async function purgeExpiredHolds(): Promise<void> {
  await SlotHold.deleteMany({ expiresAt: { $lte: new Date() } });
}

export async function isSlotBooked(
  scheduledDate: string,
  scheduledTime: string,
  excludeBookingId?: string
): Promise<boolean> {
  const day = parseScheduledDate(scheduledDate);
  const normalizedTime = normalizeSlotTime(scheduledTime);
  const filter: Record<string, unknown> = {
    scheduledDate: day,
    scheduledTime: normalizedTime,
    status: { $ne: 'cancelled' },
  };
  if (excludeBookingId) {
    filter._id = { $ne: new mongoose.Types.ObjectId(excludeBookingId) };
  }
  const existing = await Booking.findOne(filter).select('_id');
  return Boolean(existing);
}

export async function assertRescheduleSlotAvailable(
  scheduledDate: string,
  scheduledTime: string,
  excludeBookingId: string
): Promise<void> {
  const normalizedTime = normalizeSlotTime(scheduledTime);
  const cleaned = normalizedTime.replace(/\s*IST\s*$/i, '').trim();
  if (!(BOOKING_TIME_SLOTS as readonly string[]).includes(cleaned)) {
    throw new BadRequestError('Invalid time slot');
  }
  if (await isSlotBooked(scheduledDate, normalizedTime, excludeBookingId)) {
    throw new BadRequestError('This time slot is already booked');
  }
}

export async function getClientHold(clientId: string) {
  await purgeExpiredHolds();
  return SlotHold.findOne({ clientId }).sort({ updatedAt: -1 });
}

export async function releaseClientHold(clientId: string): Promise<void> {
  await SlotHold.deleteMany({ clientId: toObjectId(clientId) });
}

function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

export async function getSlotAvailability(
  dateInput: string,
  clientId: string,
  excludeBookingId?: string
): Promise<{
  date: string;
  slots: SlotAvailabilityItem[];
  myHold: {
    scheduledDate: string;
    scheduledTime: string;
    displayTime: string;
    expiresAt: string;
    secondsRemaining: number;
  } | null;
}> {
  await purgeExpiredHolds();
  const scheduledDate = normalizeSlotDate(dateInput);
  const day = parseScheduledDate(scheduledDate);
  const clientOid = toObjectId(clientId);

  const bookingFilter: Record<string, unknown> = {
    scheduledDate: day,
    status: { $ne: 'cancelled' },
  };
  if (excludeBookingId) {
    bookingFilter._id = { $ne: new mongoose.Types.ObjectId(excludeBookingId) };
  }

  const [bookings, holds, myHold] = await Promise.all([
    Booking.find(bookingFilter).select('scheduledTime'),
    SlotHold.find({
      scheduledDate,
      expiresAt: { $gt: new Date() },
    }),
    SlotHold.findOne({ clientId: clientOid }),
  ]);

  const bookedTimes = new Set(bookings.map((b) => b.scheduledTime));
  const holdByTime = new Map<string, (typeof holds)[0]>();
  for (const h of holds) {
    holdByTime.set(h.scheduledTime, h);
  }

  const slots: SlotAvailabilityItem[] = BOOKING_TIME_SLOTS.map((displayTime) => {
    const normalized = normalizeSlotTime(displayTime);
    if (bookedTimes.has(normalized)) {
      return { time: displayTime, status: 'booked' };
    }
    const hold = holdByTime.get(normalized);
    if (hold) {
      const isMine = hold.clientId.equals(clientOid);
      const expiresAt = hold.expiresAt.toISOString();
      return {
        time: displayTime,
        status: isMine ? 'held_by_you' : 'held_by_other',
        expiresAt: isMine ? expiresAt : undefined,
        secondsRemaining: isMine ? secondsUntil(hold.expiresAt) : undefined,
      };
    }
    return { time: displayTime, status: 'available' };
  });

  let myHoldPayload = null;
  if (myHold && myHold.expiresAt > new Date()) {
    myHoldPayload = {
      scheduledDate: myHold.scheduledDate,
      scheduledTime: myHold.scheduledTime,
      displayTime: displayTimeFromNormalized(myHold.scheduledTime),
      expiresAt: myHold.expiresAt.toISOString(),
      secondsRemaining: secondsUntil(myHold.expiresAt),
    };
  }

  return { date: scheduledDate, slots, myHold: myHoldPayload };
}

export async function holdSlot(
  clientId: string,
  dateInput: string,
  timeInput: string
): Promise<{
  scheduledDate: string;
  scheduledTime: string;
  displayTime: string;
  expiresAt: string;
  secondsRemaining: number;
}> {
  await purgeExpiredHolds();
  const scheduledDate = normalizeSlotDate(dateInput);
  const scheduledTime = normalizeSlotTime(timeInput);
  const clientOid = toObjectId(clientId);

  if (await isSlotBooked(scheduledDate, scheduledTime)) {
    throw new BadRequestError('This slot is already booked');
  }

  const otherHold = await SlotHold.findOne({
    scheduledDate,
    scheduledTime,
    expiresAt: { $gt: new Date() },
    clientId: { $ne: clientOid },
  });
  if (otherHold) {
    throw new BadRequestError('This slot is temporarily held by another client');
  }

  const expiresAt = new Date(Date.now() + SLOT_HOLD_DURATION_MS);

  const hold = await SlotHold.findOneAndUpdate(
    { clientId: clientOid },
    {
      scheduledDate,
      scheduledTime,
      expiresAt,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    scheduledDate: hold.scheduledDate,
    scheduledTime: hold.scheduledTime,
    displayTime: displayTimeFromNormalized(hold.scheduledTime),
    expiresAt: hold.expiresAt.toISOString(),
    secondsRemaining: secondsUntil(hold.expiresAt),
  };
}

export async function assertValidHoldForBooking(
  clientId: string,
  dateInput: string,
  timeInput: string
): Promise<void> {
  await purgeExpiredHolds();
  const scheduledDate = normalizeSlotDate(dateInput);
  const scheduledTime = normalizeSlotTime(timeInput);

  if (await isSlotBooked(scheduledDate, scheduledTime)) {
    throw new BadRequestError('This time slot is no longer available');
  }

  const hold = await SlotHold.findOne({
    clientId: toObjectId(clientId),
    scheduledDate,
    scheduledTime,
    expiresAt: { $gt: new Date() },
  });

  if (!hold) {
    throw new BadRequestError(
      'Your slot reservation expired. Return to Schedule and select the slot again.'
    );
  }

  const otherHold = await SlotHold.findOne({
    scheduledDate,
    scheduledTime,
    expiresAt: { $gt: new Date() },
    clientId: { $ne: toObjectId(clientId) },
  });
  if (otherHold) {
    throw new BadRequestError('This slot was taken by another client');
  }
}

export async function consumeHold(
  clientId: string,
  dateInput: string,
  timeInput: string
): Promise<void> {
  const scheduledDate = normalizeSlotDate(dateInput);
  const scheduledTime = normalizeSlotTime(timeInput);
  await SlotHold.deleteOne({
    clientId: toObjectId(clientId),
    scheduledDate,
    scheduledTime,
  });
}
