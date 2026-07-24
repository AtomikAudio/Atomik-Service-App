import { CommonActions } from '@react-navigation/native';

type UserRole = 'client' | 'technician' | 'master_technician' | 'admin';

type NavLike = {
  dispatch: (action: ReturnType<typeof CommonActions.navigate>) => void;
  navigate: (...args: any[]) => void;
};

export type NavigateBookingOptions = {
  /**
   * True when calling from the root NavigationContainer ref (AppNavigator /
   * LiveEvents). Nested role navigators need the full path.
   * Leave false when calling from an in-role screen (e.g. Notifications).
   */
  fromRoot?: boolean;
};

/** Open the booking related to a notification — route depends on user role. */
export function navigateToBookingFromNotification(
  navigation: NavLike,
  role: UserRole | string | undefined,
  bookingId: string,
  options?: NavigateBookingOptions
): void {
  const id = String(bookingId);
  const fromRoot = options?.fromRoot === true;

  if (role === 'technician' || role === 'master_technician') {
    if (fromRoot) {
      navigation.dispatch(
        CommonActions.navigate({
          name: 'Tech',
          params: {
            screen: 'TechTabs',
            params: {
              screen: 'Jobs',
              params: {
                screen: 'JobDetail',
                params: { jobId: id },
              },
            },
          },
        })
      );
    } else {
      navigation.dispatch(
        CommonActions.navigate({
          name: 'Jobs',
          params: {
            screen: 'JobDetail',
            params: { jobId: id },
          },
        })
      );
    }
    return;
  }

  if (role === 'admin') {
    if (fromRoot) {
      navigation.dispatch(
        CommonActions.navigate({
          name: 'Admin',
          params: {
            screen: 'AdminTabs',
            params: {
              screen: 'Dashboard',
              params: {
                screen: 'AdminBookingDetail',
                params: { bookingId: id },
              },
            },
          },
        })
      );
    } else {
      // NotificationsScreen lives in stacks that already include this screen.
      navigation.navigate('AdminBookingDetail', { bookingId: id });
    }
    return;
  }

  // Client
  if (fromRoot) {
    navigation.dispatch(
      CommonActions.navigate({
        name: 'Client',
        params: {
          screen: 'ClientTabs',
          params: {
            screen: 'Home',
            params: {
              screen: 'TrackService',
              params: { id },
            },
          },
        },
      })
    );
  } else {
    navigation.dispatch(
      CommonActions.navigate({
        name: 'Home',
        params: {
          screen: 'TrackService',
          params: { id },
        },
      })
    );
  }
}
