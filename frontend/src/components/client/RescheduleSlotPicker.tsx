import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import {
  SlotAvailabilityItem,
  slotDisplayLabel,
  slotsForServiceType,
} from '../../constants/timeSlots';
import { bookingService } from '../../services/bookings';
import {
  formatMonthYearIST,
  generateISTCalendarDays,
  getISTDateParts,
  isPastISTDate,
  toISODateString,
} from '../../utils/schedule';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

interface Props {
  bookingId: string;
  serviceType: string;
  selectedDate: string | null;
  selectedTime: string;
  onSelectDate: (date: string) => void;
  onSelectTime: (time: string) => void;
}

export const RescheduleSlotPicker: React.FC<Props> = ({
  bookingId,
  serviceType,
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
}) => {
  const istNow = getISTDateParts();
  const [month, setMonth] = useState(istNow.month);
  const [year, setYear] = useState(istNow.year);
  const [slotMap, setSlotMap] = useState<Record<string, SlotAvailabilityItem>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);

  const timeSlots = slotsForServiceType(serviceType);
  const calendarDays = generateISTCalendarDays(year, month);

  const loadAvailability = useCallback(
    async (date: string) => {
      setLoadingSlots(true);
      try {
        const data = await bookingService.getSlotAvailability(date, bookingId);
        const map: Record<string, SlotAvailabilityItem> = {};
        for (const slot of data.slots) {
          map[slot.time] = slot;
        }
        setSlotMap(map);
      } catch {
        setSlotMap({});
      } finally {
        setLoadingSlots(false);
      }
    },
    [bookingId]
  );

  useEffect(() => {
    if (selectedDate) loadAvailability(selectedDate);
  }, [selectedDate, loadAvailability]);

  const selectDay = (day: number) => {
    if (isPastISTDate(year, month, day)) return;
    const date = toISODateString(year, month, day);
    onSelectDate(date);
    onSelectTime('');
  };

  const selectedDay =
    selectedDate != null
      ? Number(selectedDate.split('-')[2])
      : null;

  const shiftMonth = (delta: number) => {
    let nextMonth = month + delta;
    let nextYear = year;
    if (nextMonth < 0) {
      nextMonth = 11;
      nextYear -= 1;
    } else if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    setMonth(nextMonth);
    setYear(nextYear);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.monthRow}>
        <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{formatMonthYearIST(year, month)}</Text>
        <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={8}>
          <Ionicons name="chevron-forward" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {DAYS.map((d) => (
          <Text key={d} style={styles.weekDay}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {calendarDays.map((day, idx) => {
          if (day == null) {
            return <View key={`empty-${idx}`} style={styles.dayCell} />;
          }
          const past = isPastISTDate(year, month, day);
          const active = selectedDay === day;
          return (
            <TouchableOpacity
              key={day}
              style={[
                styles.dayCell,
                active && styles.dayCellActive,
                past && styles.dayCellPast,
              ]}
              disabled={past}
              onPress={() => selectDay(day)}
            >
              <Text
                style={[
                  styles.dayText,
                  active && styles.dayTextActive,
                  past && styles.dayTextPast,
                ]}
              >
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedDate ? (
        <View style={styles.slotsSection}>
          <Text style={styles.slotsTitle}>Select a time</Text>
          {loadingSlots ? (
            <ActivityIndicator color={COLORS.red} style={styles.loader} />
          ) : (
            <View style={styles.slotsRow}>
              {timeSlots.map((slot) => {
                const info = slotMap[slot];
                const booked = info?.status === 'booked' || info?.status === 'held_by_other';
                const active = selectedTime === slot;
                return (
                  <TouchableOpacity
                    key={slot}
                    style={[
                      styles.slotBtn,
                      active && styles.slotBtnActive,
                      booked && styles.slotBtnDisabled,
                    ]}
                    disabled={booked}
                    onPress={() => onSelectTime(slot)}
                  >
                    <Text
                      style={[
                        styles.slotText,
                        active && styles.slotTextActive,
                        booked && styles.slotTextDisabled,
                      ]}
                    >
                      {slotDisplayLabel(slot, serviceType)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthLabel: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.white,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Montserrat_500Medium',
    fontSize: 10,
    color: COLORS.gray,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  dayCellActive: {
    backgroundColor: COLORS.red,
  },
  dayCellPast: {
    opacity: 0.35,
  },
  dayText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 13,
    color: COLORS.white,
  },
  dayTextActive: {
    color: COLORS.black,
  },
  dayTextPast: {
    color: COLORS.grayDark,
  },
  slotsSection: { marginTop: 16 },
  slotsTitle: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 10,
  },
  loader: { marginVertical: 12 },
  slotsRow: { gap: 8 },
  slotBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  slotBtnActive: {
    borderColor: COLORS.red,
    backgroundColor: 'rgba(255,193,7,0.12)',
  },
  slotBtnDisabled: {
    opacity: 0.4,
  },
  slotText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 13,
    color: COLORS.white,
  },
  slotTextActive: {
    color: COLORS.red,
  },
  slotTextDisabled: {
    color: COLORS.grayDark,
  },
});
