import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { notificationService } from '../services/notifications';

const POLL_MS = 30000;

export const useUnreadNotifications = () => {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setUnreadCount(await notificationService.getUnreadCount());
    } catch {
      setUnreadCount(0);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const id = setInterval(refresh, POLL_MS);
      return () => clearInterval(id);
    }, [refresh])
  );

  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        refresh();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [refresh]);

  return { unreadCount, refreshUnread: refresh };
};
