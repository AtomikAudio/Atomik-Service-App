import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { registerForPushNotifications } from '../../services/pushNotifications';

/**
 * When the user is signed in, request notification permission and register
 * the Expo push token with the backend so alerts appear in the system tray.
 * Retries when the app returns to foreground (covers denied→allowed permission).
 */
export const PushNotificationsBootstrap: React.FC = () => {
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated
  );
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const registeredForUser = useRef<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      registeredForUser.current = null;
      return undefined;
    }

    const tryRegister = () => {
      if (inFlight.current) return;
      if (registeredForUser.current === userId) return;
      inFlight.current = true;
      registerForPushNotifications()
        .then((token) => {
          if (token) {
            registeredForUser.current = userId;
          }
        })
        .finally(() => {
          inFlight.current = false;
        });
    };

    tryRegister();

    const sub = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'active') {
          // Allow a fresh attempt if the previous one failed (no token yet).
          if (registeredForUser.current !== userId) {
            tryRegister();
          }
        }
      }
    );

    return () => {
      sub.remove();
    };
  }, [isAuthenticated, userId]);

  return null;
};
