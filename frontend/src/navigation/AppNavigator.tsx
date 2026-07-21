import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import {
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';

import { AuthNavigator } from './AuthNavigator';
import { COLORS } from '../constants/colors';
import { RootState } from '../store';
import { ClientNavigator } from './ClientNavigator';
import { TechNavigator } from './TechNavigator';
import { AdminNavigator } from './AdminNavigator';
import { RoleGuard } from '../components/auth/RoleGuard';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { rootStackOptions } from './screenOptions';
import { PushNotificationsBootstrap } from '../components/auth/PushNotificationsBootstrap';
import {
  addNotificationReceivedListener,
  addNotificationResponseListener,
} from '../services/pushNotifications';
import { emitBookingChanged } from '../services/liveUpdates';
import { navigateToBookingFromNotification } from './navigateFromNotification';
import { ClientLiveEvents } from '../components/client/ClientLiveEvents';
import { ServiceStatusOverlay } from '../components/common/ServiceStatusOverlay';

const Stack = createNativeStackNavigator();

export const AppNavigator: React.FC = () => {
  const { isAuthenticated, isOnboarded, user, initializing } = useSelector(
    (state: RootState) => state.auth
  );
  const navigationRef =
    useRef<NavigationContainerRef<Record<string, object | undefined>>>(null);

  useEffect(() => {
    const sub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as {
        bookingId?: string;
      };
      const bookingId = data?.bookingId;
      const nav = navigationRef.current;
      if (!bookingId || !nav) return;

      navigateToBookingFromNotification(
        {
          dispatch: nav.dispatch.bind(nav),
          navigate: nav.navigate.bind(nav) as any,
        },
        user?.role,
        String(bookingId)
      );
    });
    return () => sub.remove();
  }, [user?.role]);

  // Foreground pushes (e.g. technician assigned/dropped, status changes) refresh
  // any focused screen live, without the user switching tabs.
  useEffect(() => {
    const sub = addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as {
        bookingId?: string;
      };
      emitBookingChanged(
        data?.bookingId ? String(data.bookingId) : undefined
      );
    });
    return () => sub.remove();
  }, []);

  if (initializing) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.red} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <PushNotificationsBootstrap />
      <ServiceStatusOverlay />
      <ClientLiveEvents
        navigationRef={navigationRef}
        enabled={
          isAuthenticated && isOnboarded && user?.role === 'client'
        }
      />
      <Stack.Navigator screenOptions={rootStackOptions}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : !isOnboarded ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : user?.role === 'technician' || user?.role === 'master_technician' ? (
          <Stack.Screen name="Tech">
            {() => (
              <RoleGuard allowedRoles={['technician', 'master_technician']}>
                <TechNavigator />
              </RoleGuard>
            )}
          </Stack.Screen>
        ) : user?.role === 'admin' ? (
          <Stack.Screen name="Admin">
            {() => (
              <RoleGuard allowedRole="admin">
                <AdminNavigator />
              </RoleGuard>
            )}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="Client">
            {() => (
              <RoleGuard allowedRole="client">
                <ClientNavigator />
              </RoleGuard>
            )}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
