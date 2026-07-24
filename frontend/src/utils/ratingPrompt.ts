import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Booking } from '../services/bookings';

const RATED_KEY = 'atomik_rated_bookings_v1';
const SKIPPED_KEY = 'atomik_rating_skipped_v1';

async function readIds(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

async function addId(key: string, bookingId: string): Promise<void> {
  const ids = await readIds(key);
  if (ids.includes(bookingId)) return;
  ids.push(bookingId);
  await AsyncStorage.setItem(key, JSON.stringify(ids.slice(-100)));
}

export async function hasRatedBooking(bookingId: string): Promise<boolean> {
  const ids = await readIds(RATED_KEY);
  return ids.includes(bookingId);
}

export async function markBookingRated(bookingId: string): Promise<void> {
  await addId(RATED_KEY, bookingId);
}

export async function hasSkippedRating(bookingId: string): Promise<boolean> {
  const ids = await readIds(SKIPPED_KEY);
  return ids.includes(bookingId);
}

export async function markRatingSkipped(bookingId: string): Promise<boolean> {
  await addId(SKIPPED_KEY, bookingId);
  return true;
}

/**
 * Whether to show the rate prompt.
 * Prefer server fields on the booking (survive logout); local cache is a fallback.
 */
export async function shouldPromptRating(
  bookingId: string,
  booking?: Pick<
    Booking,
    'clientHasReviewed' | 'clientRatingDismissedAt'
  > | null
): Promise<boolean> {
  if (booking?.clientHasReviewed) return false;
  if (booking?.clientRatingDismissedAt) return false;
  if (await hasRatedBooking(bookingId)) return false;
  if (await hasSkippedRating(bookingId)) return false;
  return true;
}

/** Whether to show the "Service completed" dialog (server ack preferred). */
export function shouldShowCompletionDialog(
  booking?: Pick<Booking, 'clientCompletionAckAt' | 'clientHasReviewed'> | null
): boolean {
  if (!booking) return true;
  if (booking.clientCompletionAckAt) return false;
  if (booking.clientHasReviewed) return false;
  return true;
}
