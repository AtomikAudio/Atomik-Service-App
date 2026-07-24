import { Platform, StyleSheet } from 'react-native';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { EdgeInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import { TAB_BAR_CONTENT_HEIGHT } from '../utils/layout';

export function createTabBarScreenOptions(
  insets: EdgeInsets,
  extra?: BottomTabNavigationOptions
): BottomTabNavigationOptions {
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 4);

  return {
    headerShown: false,
    tabBarHideOnKeyboard: true,
    tabBarActiveTintColor: COLORS.red,
    tabBarInactiveTintColor: COLORS.grayDark,
    tabBarLabelStyle: tabStyles.label,
    tabBarItemStyle: tabStyles.item,
    tabBarStyle: {
      backgroundColor: COLORS.surface,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.06)',
      height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
      paddingBottom: bottomInset,
      paddingTop: 8,
    },
    ...extra,
  };
}

const tabStyles = StyleSheet.create({
  label: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 10,
    marginTop: 2,
  },
  item: {
    flex: 1,
  },
});
