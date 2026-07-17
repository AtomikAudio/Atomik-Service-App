import React, { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { registerForPushNotifications } from '../services/pushNotifications';

/**
 * When the user is signed in, request notification permission and register
 * the Expo push token with the backend so alerts appear in the system tray.
 */
export const PushNotificationsBootstrap: React.FC = () => {
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated
  );
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const registeredForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      registeredForUser.current = null;
      return;
    }
    if (registeredForUser.current === userId) return;

    let cancelled = false;
    registerForPushNotifications().then((token) => {
      if (!cancelled && token) {
        registeredForUser.current = userId;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userId]);

  return null;
};
