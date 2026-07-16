import { Booking } from '../services/bookings';
import { formatBookingStatus } from './bookingDisplay';

/** Statuses shown in client Live updates (no payments / spare-parts events). */
export const LIVE_TRACKING_STATUSES = new Set([
  'pending',
  'confirmed',
  'technician_assigned',
  'en_route',
  'arrived',
  'in_progress',
  'completed',
  'cancelled',
]);

const TECHNICIAN_TRACKING_STATUSES = new Set([
  'technician_assigned',
  'en_route',
  'arrived',
  'in_progress',
  'completed',
]);

const STATUS_RANK: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  technician_assigned: 2,
  en_route: 3,
  arrived: 4,
  in_progress: 5,
  completed: 6,
  cancelled: 7,
};

function statusRank(status: string): number {
  return STATUS_RANK[status] ?? -1;
}

export type TrackingTimelineEvent = {
  id: string;
  status: string;
  label: string;
  timestamp: string;
  notes?: string;
  isCurrent?: boolean;
  /** Latest step (bottom of ascending timeline) — show active glow */
  isLatest?: boolean;
};

export function formatTrackingStatus(status: string): string {
  return formatBookingStatus(status);
}

function timelineNotesForStatus(
  status: string,
  notes?: string
): string | undefined {
  const trimmed = notes?.trim();
  if (!trimmed) return undefined;
  if (TECHNICIAN_TRACKING_STATUSES.has(status)) return trimmed;
  return undefined;
}

function dedupeTimelineEvents(
  events: TrackingTimelineEvent[]
): TrackingTimelineEvent[] {
  const out: TrackingTimelineEvent[] = [];
  let seenConfirmed = false;

  for (const event of events) {
    if (event.status === 'confirmed') {
      if (seenConfirmed) continue;
      seenConfirmed = true;
    }
    const prev = out[out.length - 1];
    if (prev && prev.status === event.status) continue;
    out.push(event);
  }
  return out;
}

/** Ascending timeline (oldest → newest) for Flipkart-style tracker; latest step glows. */
export function buildTrackingTimeline(booking: Booking): TrackingTimelineEvent[] {
  const raw = booking.statusHistory ?? [];
  const events: TrackingTimelineEvent[] = raw
    .filter((h) => LIVE_TRACKING_STATUSES.has(h.status))
    .map((h, idx) => ({
      id: `${h.status}-${h.timestamp}-${idx}`,
      status: h.status,
      label: formatTrackingStatus(h.status),
      timestamp: h.timestamp,
      notes: timelineNotesForStatus(h.status, h.notes),
    }));

  for (const entry of booking.reschedule?.history ?? []) {
    const who = entry.proposedBy === 'client' ? 'You proposed' : 'Technician proposed';
    const when = entry.at ?? booking.reschedule?.updatedAt ?? new Date().toISOString();
    const displayTime = entry.proposedTime.replace(/\s*IST\s*$/i, '').trim();
    const dateLabel = formatBookingSchedule(entry.proposedDate, displayTime);
    events.push({
      id: `reschedule-${when}-${entry.proposedBy}`,
      status: 'reschedule_proposed',
      label: `${who}: ${dateLabel}`,
      timestamp: when,
      notes: entry.note?.trim() || undefined,
    });
  }

  const confirmedNote = raw.find((h) =>
    h.notes?.toLowerCase().includes('reschedule confirmed')
  );
  if (confirmedNote) {
    events.push({
      id: `reschedule-confirmed-${confirmedNote.timestamp}`,
      status: 'reschedule_confirmed',
      label: 'Reschedule confirmed',
      timestamp: confirmedNote.timestamp,
      notes: confirmedNote.notes,
    });
  }

  let sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  sorted = dedupeTimelineEvents(sorted);

  const latestInHistory = sorted[sorted.length - 1]?.status;
  const liveStatus = LIVE_TRACKING_STATUSES.has(booking.status)
    ? booking.status
    : null;
  const liveRank = liveStatus ? statusRank(liveStatus) : -1;
  const latestRank = statusRank(latestInHistory ?? '');

  // Only append when live booking status is ahead of history (avoids extra Confirmed at bottom).
  if (liveStatus && liveRank > latestRank) {
    sorted.push({
      id: `current-${liveStatus}-${Date.now()}`,
      status: liveStatus,
      label: formatTrackingStatus(liveStatus),
      timestamp: new Date().toISOString(),
      notes: timelineNotesForStatus(liveStatus, booking.technicianNotes),
      isCurrent: true,
    });
  }

  const lastIndex = sorted.length - 1;
  return sorted.map((event, index) => ({
    ...event,
    isLatest: index === lastIndex,
  }));
}

export function trackingBadgeVariant(
  status: string
): 'confirmed' | 'due' | 'pending' | 'ongoing' | 'completed' {
  if (status === 'completed') return 'completed';
  if (['confirmed', 'extra_parts_paid'].includes(status)) return 'confirmed';
  if (['technician_assigned', 'en_route', 'arrived', 'in_progress'].includes(status)) {
    return 'ongoing';
  }
  if (status === 'cancelled') return 'due';
  return 'pending';
}
