/**
 * Bookable time slots (IST labels — normalized with `normalizeScheduledTime`).
 * 3-hour cadence starting 11 AM. General Service uses only 11 AM (1 slot);
 * General Visit uses all three. Both are valid here so the backend accepts either.
 */
export const BOOKING_TIME_SLOTS = ['11:00 AM', '02:00 PM', '05:00 PM'] as const;

export type BookingTimeSlot = (typeof BOOKING_TIME_SLOTS)[number];

export const SLOT_HOLD_DURATION_MS = 5 * 60 * 1000;

export const isValidBookingTimeSlot = (time: string): boolean => {
  const cleaned = time.replace(/\s*IST\s*$/i, '').trim();
  return (BOOKING_TIME_SLOTS as readonly string[]).includes(cleaned);
};
