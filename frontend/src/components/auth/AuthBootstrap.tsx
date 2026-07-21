import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useDispatch } from 'react-redux';
import { sessionRestoreFailed, restoreSession, logout } from '../../store/authSlice';
import { setUnauthorizedHandler } from '../../services/api';
import { getToken, purgeDemoSessionToken } from '../../services/tokenStore';
import { authService } from '../../services/auth';
import { warmupApi } from '../../services/apiWarmup';
import { runAppVersionCacheGuard } from '../../utils/appCache';
import { COLORS } from '../../constants/colors';

interface Props {
  children: React.ReactNode;
}

export const AuthBootstrap: React.FC<Props> = ({ children }) => {
  const dispatch = useDispatch();
  const [ready, setReady] = React.useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      dispatch(logout());
    });

    const bootstrap = async () => {
      // Warm the API in the background so login / validation are fast later,
      // without blocking first paint on a cold start.
      warmupApi().catch(() => {});

      try {
        // Clear stale caches first if the app was updated, so the fresh build
        // never renders data left over from the previous version.
        await runAppVersionCacheGuard();

        await purgeDemoSessionToken();

        // Fast path: restore the locally cached session instantly so returning
        // users see the app immediately, then validate/refresh in the background.
        const cached = await authService.loadCachedSession();
        if (cached) {
          dispatch(
            restoreSession({
              user: cached.user,
              token: cached.token,
              isOnboarded: cached.isOnboarded,
            })
          );
          authService
            .loadStoredSession()
            .then(async (fresh) => {
              if (fresh) {
                dispatch(
                  restoreSession({
                    user: fresh.user,
                    token: fresh.token,
                    isOnboarded: fresh.isOnboarded,
                  })
                );
                return;
              }
              const token = await getToken();
              if (!token) dispatch(logout());
            })
            .catch(() => {});
          return;
        }

        // No usable cache: validate any stored token, otherwise show login.
        const session = await authService.loadStoredSession();
        if (session) {
          dispatch(
            restoreSession({
              user: session.user,
              token: session.token,
              isOnboarded: session.isOnboarded,
            })
          );
        } else {
          dispatch(sessionRestoreFailed());
        }
      } catch {
        dispatch(sessionRestoreFailed());
      } finally {
        setReady(true);
      }
    };

    bootstrap();
  }, [dispatch]);

  if (!ready) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.red} />
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
