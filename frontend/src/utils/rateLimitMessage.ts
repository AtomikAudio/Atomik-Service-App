/** Format API 429 / rate-limit errors for user-facing alerts. */
export function formatRateLimitMessage(
  err: { message?: string; retryAfter?: number; status?: number } | null | undefined,
  fallback = 'Too many requests. Please try again later.'
): string {
  const base =
    (err?.message && String(err.message).trim()) ||
    (err?.status === 429 ? fallback : fallback);

  const seconds =
    typeof err?.retryAfter === 'number' && err.retryAfter > 0
      ? Math.ceil(err.retryAfter)
      : null;

  if (!seconds) return base;

  // Avoid duplicating an already-specific wait message.
  if (/\d+\s*s(ec(ond)?s?)?\b/i.test(base) || /\d+\s*min/i.test(base)) {
    return base;
  }

  if (seconds < 60) {
    return `${base.replace(/\.\s*$/, '')}. Try again in ${seconds} seconds.`;
  }

  const minutes = Math.ceil(seconds / 60);
  return `${base.replace(/\.\s*$/, '')}. Try again in about ${minutes} minute${
    minutes === 1 ? '' : 's'
  }.`;
}

export function isRateLimitError(err: { status?: number } | null | undefined): boolean {
  return err?.status === 429;
}
