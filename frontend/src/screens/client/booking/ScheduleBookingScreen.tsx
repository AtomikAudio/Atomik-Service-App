import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { BookingFlowHeader } from '../../../components/booking/BookingFlowHeader';
import { Button } from '../../../components/common/Button';
import { useBookingDraft } from '../../../context/BookingDraftContext';
import { COLORS } from '../../../constants/colors';
import {
  slotsForServiceType,
  slotDisplayLabel,
  SlotAvailabilityItem,
  SlotStatus,
} from '../../../constants/timeSlots';
import { resolvePrimaryServiceType } from '../../../constants/audioServices';
import { bookingService } from '../../../services/bookings';
import { useSlotHoldTimer } from '../../../hooks/useSlotHoldTimer';
import {
  parseDraftScheduleDate,
  formatMonthYearIST,
  isPastISTDate,
  getISTDateParts,
  generateISTCalendarDays,
  toISODateString,
} from '../../../utils/schedule';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

interface Props {
  navigation: any;
}

export const ScheduleBookingScreen: React.FC<Props> = ({ navigation }) => {
  const { draft, setDraft } = useBookingDraft();
  const serviceType = resolvePrimaryServiceType(draft.categoryIds);
  const timeSlots = slotsForServiceType(serviceType);
  const istNow = getISTDateParts();
  const [month, setMonth] = useState(istNow.month);
  const [year, setYear] = useState(istNow.year);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [slotMap, setSlotMap] = useState<Record<string, SlotAvailabilityItem>>({});
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(
    draft.slotHoldExpiresAt ?? null
  );
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [holdingSlot, setHoldingSlot] = useState(false);
  const selectedDateRef = useRef<string | null>(null);

  // secondsLeft drives a re-render each second so holdActive re-evaluates.
  const secondsLeft = useSlotHoldTimer(holdExpiresAt);
  const holdActive =
    Boolean(holdExpiresAt) &&
    new Date(holdExpiresAt as string).getTime() > Date.now();

  const dateIso =
    selectedDay != null
      ? toISODateString(year, month, selectedDay)
      : null;

  const loadAvailability = useCallback(async (date: string) => {
    setLoadingSlots(true);
    try {
      const data = await bookingService.getSlotAvailability(date);
      const map: Record<string, SlotAvailabilityItem> = {};
      for (const slot of data.slots) {
        map[slot.time] = slot;
      }
      setSlotMap(map);
      if (data.myHold?.scheduledDate === date) {
        setHoldExpiresAt(data.myHold.expiresAt);
        setSelectedTime(data.myHold.displayTime);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not load slots';
      Alert.alert('Slots unavailable', msg);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    const parsed = parseDraftScheduleDate(draft.scheduledDate);
    if (parsed && !isPastISTDate(parsed.year, parsed.month, parsed.day)) {
      setYear(parsed.year);
      setMonth(parsed.month);
      setSelectedDay(parsed.day);
    }
    if (draft.scheduledTime) {
      setSelectedTime(draft.scheduledTime.replace(/\s*IST\s*$/i, '').trim());
    }
    if (draft.slotHoldExpiresAt) {
      setHoldExpiresAt(draft.slotHoldExpiresAt);
    }
  }, [draft.scheduledDate, draft.scheduledTime, draft.slotHoldExpiresAt]);

  useEffect(() => {
    if (!dateIso) return;
    selectedDateRef.current = dateIso;
    loadAvailability(dateIso);
    const poll = setInterval(() => loadAvailability(dateIso), 15000);
    return () => clearInterval(poll);
  }, [dateIso, loadAvailability]);

  useFocusEffect(
    useCallback(() => {
      if (dateIso) loadAvailability(dateIso);
    }, [dateIso, loadAvailability])
  );

  useEffect(() => {
    if (!holdExpiresAt || !selectedTime) return;
    // Only treat the hold as expired once its timestamp has actually passed.
    // Relying on `secondsLeft === 0` alone is unsafe because the timer starts
    // at 0 before its first tick, which would wrongly clear a brand-new hold
    // and trigger an endless clear -> reload -> restore loop.
    const expired = new Date(holdExpiresAt).getTime() <= Date.now();
    if (!expired) return;
    setSelectedTime('');
    setHoldExpiresAt(null);
    setDraft((d) => ({
      ...d,
      scheduledTime: undefined,
      slotHoldExpiresAt: undefined,
    }));
    if (dateIso) loadAvailability(dateIso);
  }, [secondsLeft, holdExpiresAt, selectedTime, dateIso, loadAvailability, setDraft]);

  const selectDay = async (day: number) => {
    const nextDate = toISODateString(year, month, day);
    if (selectedDay !== day && (selectedTime || holdExpiresAt)) {
      try {
        await bookingService.releaseSlotHold();
      } catch {
        // ignore release errors when switching day
      }
      setSelectedTime('');
      setHoldExpiresAt(null);
    }
    setSelectedDay(day);
    if (selectedDateRef.current !== nextDate) {
      setSlotMap({});
    }
  };

  const selectSlot = async (slot: string) => {
    if (!dateIso || holdingSlot) return;

    const info = slotMap[slot];
    if (info?.status === 'booked' || info?.status === 'held_by_other') {
      return;
    }

    setHoldingSlot(true);
    try {
      const hold = await bookingService.holdSlot(dateIso, slot);
      setSelectedTime(slot);
      setHoldExpiresAt(hold.expiresAt);
      setDraft((d) => ({
        ...d,
        scheduledDate: dateIso,
        scheduledTime: slot,
        slotHoldExpiresAt: hold.expiresAt,
      }));
      await loadAvailability(dateIso);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not reserve this slot';
      Alert.alert('Slot unavailable', msg);
      if (dateIso) await loadAvailability(dateIso);
    } finally {
      setHoldingSlot(false);
    }
  };

  const save = () => {
    if (!selectedDay || !selectedTime || !holdActive) return;
    const scheduledDate = toISODateString(year, month, selectedDay);
    setDraft((d) => ({
      ...d,
      scheduledDate,
      scheduledTime: selectedTime,
      slotHoldExpiresAt: holdExpiresAt ?? undefined,
    }));
    // Return to Place Order hub — do not push another PlaceOrder (breaks Back).
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('PlaceOrder');
  };

  const slotStyle = (slot: string, status?: SlotStatus) => {
    const disabled =
      status === 'booked' ||
      status === 'held_by_other' ||
      holdingSlot ||
      !dateIso;
    const selected = selectedTime === slot && holdActive;
    return {
      touchable: [
        styles.slot,
        selected && styles.slotSelected,
        disabled && !selected && styles.slotDisabled,
        status === 'booked' && styles.slotBooked,
      ],
      text: [
        styles.slotText,
        selected && styles.slotTextSel,
        disabled && !selected && styles.slotTextDisabled,
      ],
      disabled: disabled && !selected,
    };
  };

  const days = generateISTCalendarDays(year, month);
  const monthName = formatMonthYearIST(year, month);

  return (
    <View style={styles.container}>
      <BookingFlowHeader
        title="Schedule"
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {!holdActive && selectedTime ? (
          <View style={styles.holdExpiredBanner}>
            <Text style={styles.holdExpiredText}>
              Your slot reservation expired — select a time again
            </Text>
          </View>
        ) : null}

        <Text style={styles.tz}>TIMEZONE: IST (Asia/Kolkata)</Text>
        <Text style={styles.hint}>
          Earliest booking is tomorrow — same-day slots are not available.
        </Text>
        <View style={styles.calendar}>
          <View style={styles.calHeader}>
            <TouchableOpacity
              onPress={() =>
                month === 0
                  ? (setMonth(11), setYear((y) => y - 1))
                  : setMonth((m) => m - 1)
              }
            >
              <Ionicons name="chevron-back" size={20} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.month}>{monthName}</Text>
            <TouchableOpacity
              onPress={() =>
                month === 11
                  ? (setMonth(0), setYear((y) => y + 1))
                  : setMonth((m) => m + 1)
              }
            >
              <Ionicons name="chevron-forward" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>
          <View style={styles.dayNames}>
            {DAYS.map((d) => (
              <Text key={d} style={styles.dayName}>
                {d}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {days.map((d, i) => {
              if (d === null) return <View key={`e${i}`} style={styles.cell} />;
              const past = isPastISTDate(year, month, d);
              return (
                <TouchableOpacity
                  key={d}
                  style={styles.cell}
                  disabled={past}
                  onPress={() => selectDay(d)}
                >
                  <View
                    style={[
                      styles.cellInner,
                      selectedDay === d && styles.cellSelected,
                      past && styles.cellPast,
                    ]}
                  >
                    <Text
                      style={[
                        styles.cellText,
                        selectedDay === d && styles.cellTextSel,
                      ]}
                    >
                      {d}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.slotsHeader}>
          <Text style={styles.slotsLabel}>AVAILABLE SLOTS</Text>
          {loadingSlots ? (
            <ActivityIndicator size="small" color={COLORS.red} />
          ) : null}
        </View>

        {!selectedDay ? (
          <Text style={styles.hint}>Select a date to see available time slots</Text>
        ) : (
          <View style={styles.slots}>
            {timeSlots.map((slot) => {
              const info = slotMap[slot];
              const { touchable, text, disabled } = slotStyle(slot, info?.status);
              return (
                <TouchableOpacity
                  key={slot}
                  style={touchable}
                  disabled={disabled}
                  onPress={() => selectSlot(slot)}
                >
                  <Text style={text}>{slotDisplayLabel(slot, serviceType)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="SAVE"
          onPress={save}
          disabled={!selectedDay || !selectedTime || !holdActive}
          loading={holdingSlot}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, paddingBottom: 120 },
  holdBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.red,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  holdBannerText: {
    flex: 1,
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: COLORS.white,
  },
  holdExpiredBanner: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
  },
  holdExpiredText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: COLORS.red,
  },
  tz: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    color: COLORS.red,
    letterSpacing: 1,
    marginBottom: 8,
  },
  calendar: {
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 24,
    marginTop: 12,
  },
  calHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  month: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 15,
    color: COLORS.white,
  },
  dayNames: { flexDirection: 'row', marginBottom: 8 },
  dayName: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 8,
    color: COLORS.grayDark,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellInner: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSelected: { backgroundColor: COLORS.red },
  cellPast: { opacity: 0.3 },
  cellText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 13,
    color: COLORS.white,
  },
  cellTextSel: { color: COLORS.white },
  slotsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  slotsLabel: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    color: COLORS.grayDark,
    letterSpacing: 2,
  },
  hint: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
  },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: {
    height: 46,
    paddingHorizontal: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotSelected: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  slotDisabled: {
    opacity: 0.45,
  },
  slotBooked: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  slotText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    color: COLORS.white,
  },
  slotTextSel: { color: COLORS.white },
  slotTextDisabled: { color: COLORS.grayDark },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 32,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});
