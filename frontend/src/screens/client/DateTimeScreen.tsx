import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { bookingService } from '../../services/bookings';
import { COLORS } from '../../constants/colors';
import {
  formatMonthYearIST,
  generateISTCalendarDays,
  getISTDateParts,
  isPastISTDate,
} from '../../utils/schedule';
import { slotsForServiceType, slotDisplayLabel } from '../../constants/timeSlots';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

interface Props {
  navigation: any;
  route: any;
}

export const DateTimeScreen: React.FC<Props> = ({ navigation, route }) => {
  const { serviceType, venueId } = route.params || {};
  const timeSlots = slotsForServiceType(serviceType);
  const istNow = getISTDateParts();
  const [month, setMonth] = useState(istNow.month);
  const [year, setYear] = useState(istNow.year);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const days = generateISTCalendarDays(year, month);
  const monthName = formatMonthYearIST(year, month);
  const todayIST = getISTDateParts();

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  return (
    <View style={styles.container}>
      <Header showBack showLogo />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepLabel}>Step 3 of 4</Text>

        <View style={styles.progressBar}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.progressSegment,
                i < 3 && styles.progressSegmentActive,
              ]}
            />
          ))}
        </View>

        <Text style={styles.title}>Select Date & Time</Text>
        <Text style={styles.desc}>Pick a convenient date & time (IST)</Text>

        {/* Calendar */}
        <View style={styles.calendar}>
          {/* Month Header */}
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={prevMonth}>
              <Ionicons name="chevron-back" size={20} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{monthName}</Text>
            <TouchableOpacity onPress={nextMonth}>
              <Ionicons name="chevron-forward" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          {/* Day Names */}
          <View style={styles.dayNames}>
            {DAYS.map((d) => (
              <Text key={d} style={styles.dayName}>{d}</Text>
            ))}
          </View>

          {/* Date Grid */}
          <View style={styles.dateGrid}>
            {days.map((day, i) => {
              if (!day) return <View key={`empty-${i}`} style={styles.dateCell} />;
              const isToday =
                day === todayIST.day &&
                month === todayIST.month &&
                year === todayIST.year;
              const isPast = isPastISTDate(year, month, day);
              const isSelected = day === selectedDay;

              return (
                <TouchableOpacity
                  key={`day-${i}`}
                  style={[
                    styles.dateCell,
                    isToday && styles.dateCellToday,
                    isSelected && styles.dateCellSelected,
                    isPast && styles.dateCellPast,
                  ]}
                  onPress={() => !isPast && setSelectedDay(day)}
                  disabled={isPast}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.dateCellText,
                      isToday && styles.dateCellTextToday,
                      isSelected && styles.dateCellTextSelected,
                      isPast && styles.dateCellTextPast,
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Time Slots */}
        <Text style={styles.timeSectionTitle}>Available Time Slots</Text>
        <View style={styles.timeGrid}>
          {timeSlots.map((slot) => (
            <TouchableOpacity
              key={slot}
              style={[
                styles.timeSlot,
                selectedTime === slot && styles.timeSlotSelected,
              ]}
              onPress={() => setSelectedTime(slot)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.timeSlotText,
                  selectedTime === slot && styles.timeSlotTextSelected,
                ]}
              >
                {slotDisplayLabel(slot, serviceType)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="CONTINUE"
          loading={submitting}
          onPress={async () => {
            if (!selectedDay || !selectedTime || !venueId) return;
            setSubmitting(true);
            try {
              const pad = (n: number) => String(n).padStart(2, '0');
              const scheduledDate = `${year}-${pad(month + 1)}-${pad(selectedDay)}`;
              const { booking, invoice } = await bookingService.createBooking({
                serviceType,
                venueId,
                scheduledDate,
                scheduledTime: selectedTime,
              });
              navigation.navigate('Payment', {
                serviceType,
                venueId,
                bookingId: booking._id,
                invoiceId: invoice._id,
                date: monthName,
                time: selectedTime,
              });
            } catch (e: any) {
              Alert.alert('Booking failed', e.message || 'Try again');
            } finally {
              setSubmitting(false);
            }
          }}
          disabled={!selectedDay || !selectedTime}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 120 },
  stepLabel: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 16,
  },
  progressBar: { flexDirection: 'row', gap: 6, marginBottom: 28 },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.surface,
  },
  progressSegmentActive: { backgroundColor: COLORS.red },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 24,
    color: COLORS.white,
    marginBottom: 4,
  },
  desc: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 24,
  },
  calendar: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    marginBottom: 28,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthLabel: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 15,
    color: COLORS.white,
  },
  dayNames: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayName: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    color: COLORS.grayDark,
    letterSpacing: 0.5,
  },
  dateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dateCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCellToday: {
    backgroundColor: 'rgba(142,48,47,0.15)',
    borderRadius: 8,
  },
  dateCellSelected: {
    backgroundColor: COLORS.red,
    borderRadius: 8,
  },
  dateCellPast: {
    opacity: 0.3,
  },
  dateCellText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 13,
    color: COLORS.white,
  },
  dateCellTextToday: {
    color: COLORS.red,
  },
  dateCellTextSelected: {
    color: COLORS.white,
  },
  dateCellTextPast: {
    color: COLORS.grayDark,
  },
  timeSectionTitle: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.white,
    marginBottom: 14,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timeSlot: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  timeSlotSelected: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  timeSlotText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    color: COLORS.white,
  },
  timeSlotTextSelected: {
    color: COLORS.white,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 16,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
});
