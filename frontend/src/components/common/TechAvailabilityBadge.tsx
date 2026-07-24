import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS } from '../../constants/colors';

interface Props {
  free: boolean | null;
  style?: ViewStyle;
}

/** Compact FREE / BUSY chip — ash gray like the PAID badge. */
export const TechAvailabilityBadge: React.FC<Props> = ({ free, style }) => {
  if (free === null) return null;
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.text}>{free ? 'FREE' : 'BUSY'}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.ashGrayBorder,
    backgroundColor: COLORS.ashGrayBg,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 10,
    color: COLORS.ashGray,
    letterSpacing: 1,
  },
});
