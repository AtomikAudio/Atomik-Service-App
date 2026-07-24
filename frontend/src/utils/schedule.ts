export const IST = 'Asia/Kolkata';
export const IST_LABEL = 'IST';

const pad2 = (n: number) => String(n).padStart(2, '0');

export function getISTDateParts(date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
} {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date);

  return {
    year: Number(parts.find((p) => p.type === 'year')?.value),
    month: Number(parts.find((p) => p.type === 'month')?.value) - 1,
    day: Number(parts.find((p) => p.type === 'day')?.value),
    hour: Number(parts.find((p) => p.type === 'hour')?.value),
  };
}

export function toISODateString(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

/** True when the day is today (IST) or earlier — earliest bookable day is tomorrow IST. */
export function isPastISTDate(year: number, month: number, day: number): boolean {
  const today = getISTDateParts();
  const candidate = toISODateString(year, month, day);
  const todayStr = toISODateString(today.year, today.month, today.day);
  return candidate <= todayStr;
}

/** Tomorrow (IST) as YYYY-MM-DD — first day a client may book. */
export function earliestBookableISODateIST(date = new Date()): string {
  const today = getISTDateParts(date);
  const noonToday = parseDateInIST(
    toISODateString(today.year, today.month, today.day)
  );
  const tomorrow = new Date(noonToday.getTime() + 24 * 60 * 60 * 1000);
  const parts = getISTDateParts(tomorrow);
  return toISODateString(parts.year, parts.month, parts.day);
}

export function parseDateInIST(dateStr: string): Date {
  const dateOnly = dateStr.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return new Date(`${dateOnly}T12:00:00+05:30`);
  }

  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return parsed;

  const istDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed);

  return new Date(`${istDate}T12:00:00+05:30`);
}

/** Format booking date in IST (avoids UTC day-shift from ISO midnight). */
export function formatBookingDate(
  dateStr: string,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return '—';

  const parsed = parseDateInIST(dateStr);
  if (Number.isNaN(parsed.getTime())) return '—';

  return parsed.toLocaleDateString('en-IN', {
    timeZone: IST,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  });
}

/** Normalize stored time label for display. */
export function formatBookingTime(time?: string): string {
  if (!time?.trim()) return '—';
  return time.replace(/\s*IST\s*$/i, '').trim();
}

export function formatBookingSchedule(dateStr: string, time?: string): string {
  const date = formatBookingDate(dateStr);
  const slot = formatBookingTime(time);
  if (date === '—' && slot === '—') return '—';
  if (slot === '—') return `${date} ${IST_LABEL}`;
  return `${date} · ${slot} ${IST_LABEL}`;
}

export function formatDateTimeIST(value: string | Date): string {
  const parsed = value instanceof Date ? value : new Date(value);
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

export function parseDraftScheduleDate(dateStr?: string): {
  year: number;
  month: number;
  day: number;
} | null {
  if (!dateStr) return null;

  const dateOnly = dateStr.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    const [y, m, d] = dateOnly.split('-').map(Number);
    return { year: y, month: m - 1, day: d };
  }

  const parts = getISTDateParts(parseDateInIST(dateStr));
  return { year: parts.year, month: parts.month, day: parts.day };
}

export function getISTGreetingHour(): number {
  return getISTDateParts().hour;
}

export function formatMonthYearIST(year: number, month: number): string {
  return parseDateInIST(toISODateString(year, month, 1)).toLocaleString('en-IN', {
    timeZone: IST,
    month: 'long',
    year: 'numeric',
  });
}

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Calendar grid metadata for a month, aligned to IST. */
export function getCalendarMonthMeta(year: number, month: number): {
  firstWeekday: number;
  daysInMonth: number;
} {
  const firstDate = toISODateString(year, month, 1);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: IST,
    weekday: 'short',
  }).format(parseDateInIST(firstDate));

  const nextMonth = month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
  const firstNext = parseDateInIST(toISODateString(nextMonth.year, nextMonth.month, 1));
  const firstCurrent = parseDateInIST(firstDate);
  const daysInMonth = Math.round(
    (firstNext.getTime() - firstCurrent.getTime()) / (24 * 60 * 60 * 1000)
  );

  return {
    firstWeekday: WEEKDAY_TO_INDEX[weekday] ?? 0,
    daysInMonth,
  };
}

export function generateISTCalendarDays(year: number, month: number): (number | null)[] {
  const { firstWeekday, daysInMonth } = getCalendarMonthMeta(year, month);
  const days: (number | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}
