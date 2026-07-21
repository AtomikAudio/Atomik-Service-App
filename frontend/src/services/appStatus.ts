/**
 * Global app-status signals (currently: "service busy / rate limited").
 *
 * When the API returns 429 we never want to leak the raw developer message
 * ("Too many API requests…") to end users. Instead the API layer emits here and
 * a single root-level overlay shows a branded "under maintenance" box.
 */
type ServiceBusyListener = () => void;

const listeners = new Set<ServiceBusyListener>();

/** Signal that the backend is temporarily refusing requests (429 / overload). */
export function emitServiceBusy(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // A misbehaving listener must not break the others.
    }
  });
}

/** Subscribe to service-busy signals. Returns an unsubscribe function. */
export function subscribeServiceBusy(listener: ServiceBusyListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
