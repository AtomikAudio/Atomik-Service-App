import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

interface Props {
  rating?: number | null;
  ratingCount?: number | null;
  style?: ViewStyle;
}

function formatOutOfFive(rating: number, ratingCount: number): string {
  if (ratingCount <= 0) return '—/5';
  return `${(Math.round(rating * 100) / 100).toFixed(2)}/5`;
}

/**
 * Compact technician rating chip for admin / assign lists.
 * Shows client average as 4.86/5 with a Rating caption.
 */
export const TechRatingBadge: React.FC<Props> = ({
  rating = 0,
  ratingCount = 0,
  style,
}) => {
  const count = Number(ratingCount) || 0;
  const value = Number(rating) || 0;
  const hasReviews = count > 0;

  return (
    <View style={[styles.wrap, style]} accessibilityLabel={`Rating ${formatOutOfFive(value, count)}`}>
      <View style={styles.row}>
        <Ionicons
          name={hasReviews ? 'star' : 'star-outline'}
          size={11}
          color={hasReviews ? COLORS.ashGray : COLORS.grayDark}
        />
        <Text
          style={[styles.value, !hasReviews && styles.valueMuted]}
          numberOfLines={1}
        >
          {formatOutOfFive(value, count)}
        </Text>
      </View>
      <Text style={styles.caption}>RATING</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.ashGrayBorder,
    backgroundColor: COLORS.ashGrayBg,
    minWidth: 72,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  value: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: COLORS.ashGray,
    letterSpacing: 0.2,
  },
  valueMuted: {
    color: COLORS.grayDark,
  },
  caption: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 7,
    color: COLORS.gray,
    letterSpacing: 1.2,
    marginTop: 2,
  },
});
