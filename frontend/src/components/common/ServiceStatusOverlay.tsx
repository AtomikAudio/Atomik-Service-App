import React, { useEffect, useRef, useState } from 'react';
import { subscribeServiceBusy } from '../../services/appStatus';
import { ThemedAlertModal } from './ThemedConfirmModal';

/**
 * Root-level branded box shown when the backend is temporarily unavailable
 * (rate limited / overloaded). It never exposes the raw developer message — the
 * user just sees an on-brand "under maintenance" notice.
 *
 * Debounced so a burst of failed requests only surfaces one box, and so it does
 * not immediately reappear after the user dismisses it.
 */
const RESHOW_COOLDOWN_MS = 30000;

export const ServiceStatusOverlay: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const lastShownRef = useRef(0);

  useEffect(() => {
    const unsubscribe = subscribeServiceBusy(() => {
      const now = Date.now();
      if (now - lastShownRef.current < RESHOW_COOLDOWN_MS) return;
      lastShownRef.current = now;
      setVisible(true);
    });
    return unsubscribe;
  }, []);

  return (
    <ThemedAlertModal
      visible={visible}
      title="Under maintenance"
      message="We're making the app better right now. Please try again in a moment."
      buttonLabel="OKAY"
      icon="construct-outline"
      onClose={() => setVisible(false)}
    />
  );
};
