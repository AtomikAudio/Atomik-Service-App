import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import { NotificationBell } from './NotificationBell';
import { ScreenTopBar } from './ScreenTopBar';

/** Shared dashboard header: centered logo + optional right slot + notifications */
export const DASHBOARD_LOGO_SIZE = 'lg' as const;
export const DASHBOARD_BELL_SIZE = 28;

const LOGO_HEIGHT = 63;
const LOGO_WIDTH = Math.round(LOGO_HEIGHT * 4.2);
const LOGO_SOURCE = require('../../../assets/atomik-logo-hero.png');

interface Props {
  onNotificationsPress: () => void;
  rightAccessory?: React.ReactNode;
  style?: ViewStyle;
}

const DashboardLogo = () => (
  <View style={logoStyles.wrap} pointerEvents="none">
    <Image
      source={LOGO_SOURCE}
      style={logoStyles.image}
      resizeMode="contain"
      accessibilityLabel="ATOMIK"
    />
  </View>
);

export const DashboardTopBar: React.FC<Props> = ({
  onNotificationsPress,
  rightAccessory,
  style,
}) => (
  <ScreenTopBar style={[styles.bar, style]}>
    <View style={styles.side} />
    <View style={styles.center}>
      <DashboardLogo />
    </View>
    <View style={styles.end}>
      {rightAccessory ? (
        <View style={styles.accessory}>{rightAccessory}</View>
      ) : null}
      <NotificationBell size={DASHBOARD_BELL_SIZE} onPress={onNotificationsPress} />
    </View>
  </ScreenTopBar>
);

const logoStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  image: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
    backgroundColor: 'transparent',
  },
});

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    overflow: 'visible',
  },
  side: {
    width: 52,
    flexShrink: 0,
  },
  center: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  end: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    minWidth: 52,
    flexShrink: 0,
    maxWidth: '46%',
  },
  accessory: {
    flexShrink: 0,
  },
});
