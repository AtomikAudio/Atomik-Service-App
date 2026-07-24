export const IST = 'Asia/Kolkata';
export const IST_LABEL = 'IST';

const pad2 = (n: number) => String(n).padStart(2, '0');

function istCalendarDateFromDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Parse client date (YYYY-MM-DD or ISO) as noon IST on that calendar day. */
export function parseScheduledDate(dateInput: string | Date): Date {
  if (dateInput instanceof Date) {
    if (Number.isNaN(dateInput.getTime())) return dateInput;
    return new Date(`${istCalendarDateFromDate(dateInput)}T12:00:00+05:30`);
  }

  const trimmed = String(dateInput).trim();
  const dateOnly = trimmed.slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return new Date(`${dateOnly}T12:00:00+05:30`);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return parsed;

  return new Date(`${istCalendarDateFromDate(parsed)}T12:00:00+05:30`);
}

export function normalizeScheduledTime(time: string): string {
  const cleaned = String(time).replace(/\s*IST\s*$/i, '').trim();
  return cleaned ? `${cleaned} ${IST_LABEL}` : cleaned;
}

export function formatDateIST(date: Date | string): string {
  const parsed = date instanceof Date ? date : parseScheduledDate(date);
  if (Number.isNaN(parsed.getTime())) return '—';

  return parsed.toLocaleDateString('en-IN', {
    timeZone: IST,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTimeIST(date: Date | string): string {
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return '—';

  return parsed.toLocaleString('en-IN', {
    timeZone: IST,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function toISODateStringIST(date: Date | string): string {
  const parsed = date instanceof Date ? date : parseScheduledDate(date);
  return istCalendarDateFromDate(parsed);
}

/** Tomorrow (IST) as YYYY-MM-DD — first day a client may book or reschedule to. */
export function earliestBookableDateIST(now = new Date()): string {
  const today = toISODateStringIST(now);
  const tomorrow = new Date(parseScheduledDate(today).getTime() + 24 * 60 * 60 * 1000);
  return toISODateStringIST(tomorrow);
}
