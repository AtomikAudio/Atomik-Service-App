/** All bookable slots (union across service types) — 3-hour cadence from 11 AM. */
export const BOOKING_TIME_SLOTS = ['11:00 AM', '02:00 PM', '05:00 PM'] as const;

/** General Service is a full-day job — a single 11 AM slot. */
export const GENERAL_SERVICE_SLOTS = ['11:00 AM'] as const;

/** General Visit — three 3-hour slots starting at 11 AM. */
export const GENERAL_VISIT_SLOTS = ['11:00 AM', '02:00 PM', '05:00 PM'] as const;

/** Slots shown for a given API service type. */
export const slotsForServiceType = (serviceType: string): readonly string[] =>
  serviceType === 'inspection' ? GENERAL_VISIT_SLOTS : GENERAL_SERVICE_SLOTS;

/** General Visit slots are 3-hour windows — shown as a range, booked by start time. */
const VISIT_SLOT_LABELS: Record<string, string> = {
  '11:00 AM': '11 AM – 2 PM',
  '02:00 PM': '2 PM – 5 PM',
  '05:00 PM': '5 PM – 8 PM',
};

/**
 * Display label for a slot. General Visit shows the full 3-hour window;
 * the underlying value (start time) is what gets sent to the backend.
 */
export const slotDisplayLabel = (slot: string, serviceType: string): string =>
  serviceType === 'inspection' ? VISIT_SLOT_LABELS[slot] ?? slot : slot;

export type SlotStatus = 'available' | 'booked' | 'held_by_you' | 'held_by_other';

export interface SlotAvailabilityItem {
  time: string;
  status: SlotStatus;
  expiresAt?: string;
  secondsRemaining?: number;
}

export interface SlotHoldInfo {
  scheduledDate: string;
  scheduledTime: string;
  displayTime: string;
  expiresAt: string;
  secondsRemaining: number;
}
