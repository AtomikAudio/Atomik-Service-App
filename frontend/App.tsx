import 'react-native-gesture-handler';
import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import {
  Montserrat_300Light,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  useFonts,
} from '@expo-google-fonts/montserrat';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';

import { store } from './src/store';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AuthBootstrap } from './src/components/auth/AuthBootstrap';
import { AppUpdateGate } from './src/components/common/AppUpdateGate';
import { COLORS } from './src/constants/colors';
import { usePhonePortraitLock } from './src/hooks/usePhonePortraitLock';

function AppShell() {
  usePhonePortraitLock();

  return (
    <>
      {/* Android 15+ edge-to-edge: status bar is transparent; only style/hidden are supported */}
      <StatusBar style="light" />
      <AuthBootstrap>
        <AppNavigator />
      </AuthBootstrap>
      <AppUpdateGate />
    </>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Montserrat_300Light,
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    SpaceMono_400Regular,
  });

  if (fontError) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>Font load failed. Shake device and reload.</Text>
      </View>
    );
  }

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>ATOMIK</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <Provider store={store}>
          <AppShell />
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 22,
    color: COLORS.white,
    letterSpacing: 6,
    fontWeight: '700',
  },
  errorText: {
    color: COLORS.white,
    fontSize: 14,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
});
