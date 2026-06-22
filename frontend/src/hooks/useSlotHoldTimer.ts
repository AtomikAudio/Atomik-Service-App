import { useEffect, useState } from 'react';

export function formatHoldCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function computeSecondsLeft(expiresAt: string | null | undefined): number {
  if (!expiresAt) return 0;
  return Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)
  );
}

export function useSlotHoldTimer(expiresAt: string | null | undefined): number {
  // Initialize from the real timestamp so the value is correct on the first
  // render (avoids a stale 0 that can misfire expiry logic in consumers).
  const [secondsLeft, setSecondsLeft] = useState(() =>
    computeSecondsLeft(expiresAt)
  );

  useEffect(() => {
    if (!expiresAt) {
      setSecondsLeft(0);
      return;
    }

    const tick = () => {
      setSecondsLeft(computeSecondsLeft(expiresAt));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return secondsLeft;
}
