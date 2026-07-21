/**
 * Lightweight in-app pub/sub for "booking data changed" signals.
 *
 * The backend already sends a push notification (with `data.bookingId`) for
 * every booking event — technician assigned, dropped, status change, etc.
 * When such a push arrives while the app is open we broadcast here so any
 * focused screen can refetch immediately, giving near-instant live updates.
 */
type BookingChangedListener = (bookingId?: string) => void;

const listeners = new Set<BookingChangedListener>();

/** Notify all subscribers that booking data likely changed. */
export function emitBookingChanged(bookingId?: string): void {
  listeners.forEach((listener) => {
    try {
      listener(bookingId);
    } catch {
      // A misbehaving listener must not break the others.
    }
  });
}

/** Subscribe to booking-changed signals. Returns an unsubscribe function. */
export function subscribeBookingChanged(
  listener: BookingChangedListener
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
