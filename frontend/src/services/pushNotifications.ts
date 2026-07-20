import { Platform } from 'react-native';
import Constants from 'expo-constants';
import api from './api';
import type * as NotificationsTypes from 'expo-notifications';

/**
 * Expo Go (SDK 53+) removed remote push support, and merely importing
 * expo-notifications there logs an error. Load the module lazily and only
 * outside Expo Go (development/production builds).
 */
function canUseRemotePush(): boolean {
  return Constants.appOwnership !== 'expo';
}

let notificationsModule: typeof NotificationsTypes | null = null;

function getNotifications(): typeof NotificationsTypes | null {
  if (!canUseRemotePush()) return null;
  if (!notificationsModule) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    notificationsModule = require('expo-notifications') as typeof NotificationsTypes;
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
  return notificationsModule;
}

function getExpoProjectId(): string | undefined {
  return (
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
      ?.eas?.projectId
  );
}

async function ensureAndroidChannel(
  Notifications: typeof NotificationsTypes
): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'ATOMIK',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#8e302f',
    sound: 'default',
  });
}

/**
 * Request permission, obtain an Expo push token, and register it with the API
 * so the backend can deliver system notification-bar alerts.
 * No-ops in Expo Go (use a development build for real device pushes).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  const Notifications = getNotifications();
  if (!Notifications) {
    if (__DEV__) {
      console.log(
        '[push] Skipped in Expo Go — use a development build for system notifications'
      );
    }
    return null;
  }

  try {
    await ensureAndroidChannel(Notifications);

    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') {
      return null;
    }

    const projectId = getExpoProjectId();
    if (!projectId) {
      console.warn('[push] Missing EAS projectId — cannot get Expo push token');
      return null;
    }

    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResult.data;
    if (!token) return null;

    await api.patch('/auth/fcm-token', { fcmToken: token });
    return token;
  } catch (err) {
    console.warn('[push] Registration failed:', err);
    return null;
  }
}

export function addNotificationReceivedListener(
  listener: (notification: NotificationsTypes.Notification) => void
) {
  const Notifications = getNotifications();
  if (!Notifications) {
    return { remove: () => undefined };
  }
  return Notifications.addNotificationReceivedListener(listener);
}

export function addNotificationResponseListener(
  listener: (response: NotificationsTypes.NotificationResponse) => void
) {
  const Notifications = getNotifications();
  if (!Notifications) {
    return { remove: () => undefined };
  }
  return Notifications.addNotificationResponseReceivedListener(listener);
}
