import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { useLayoutInsets } from '../../hooks/useLayoutInsets';
import { SlotHoldBadge } from './SlotHoldBadge';

interface Props {
  title: string;
  onBack: () => void;
  rightLabel?: string;
  onRight?: () => void;
  rightDisabled?: boolean;
}

export const BookingFlowHeader: React.FC<Props> = ({
  title,
  onBack,
  rightLabel,
  onRight,
  rightDisabled,
}) => {
  const { headerTopPadding } = useLayoutInsets();

  return (
    <View style={styles.wrap}>
      <View style={[styles.bar, { paddingTop: headerTopPadding + 8 }]}>
        <TouchableOpacity onPress={onBack} style={styles.back} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {rightLabel && onRight ? (
          <TouchableOpacity onPress={onRight} disabled={rightDisabled}>
            <Text
              style={[
                styles.right,
                rightDisabled && styles.rightDisabled,
              ]}
            >
              {rightLabel}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.spacer} />
        )}
      </View>
      <SlotHoldBadge />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: COLORS.background,
  },
  back: { width: 40 },
  title: {
    flex: 1,
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 17,
    color: COLORS.white,
    textAlign: 'center',
  },
  right: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.red,
    width: 56,
    textAlign: 'right',
  },
  rightDisabled: { color: COLORS.grayDark },
  spacer: { width: 40 },
});
