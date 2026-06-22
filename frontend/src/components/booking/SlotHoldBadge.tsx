import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { useBookingDraft } from '../../context/BookingDraftContext';
import {
  formatHoldCountdown,
  useSlotHoldTimer,
} from '../../hooks/useSlotHoldTimer';

/**
 * Persistent slot-hold countdown shown across the booking flow (in the header)
 * whenever the client is holding a slot. Reads the active hold from the draft so
 * it stays visible outside the Schedule screen too.
 */
export const SlotHoldBadge: React.FC = () => {
  const { draft } = useBookingDraft();
  const expiresAt = draft.slotHoldExpiresAt ?? null;
  const secondsLeft = useSlotHoldTimer(expiresAt);

  const active =
    Boolean(expiresAt) && new Date(expiresAt as string).getTime() > Date.now();

  if (!active) return null;

  const low = secondsLeft <= 60;

  return (
    <View style={styles.wrap}>
      <View style={[styles.pill, low && styles.pillLow]}>
        <Ionicons name="time-outline" size={14} color={COLORS.white} />
        <Text style={styles.text}>
          {formatHoldCountdown(secondsLeft)} left to confirm your slot
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingBottom: 10,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.red,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  pillLow: {
    backgroundColor: COLORS.redDark,
  },
  text: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: COLORS.white,
    letterSpacing: 0.3,
  },
});
