import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { COLORS } from '../../constants/colors';
import { Booking, bookingService } from '../../services/bookings';
import { formatBookingSchedule } from '../../utils/schedule';
import { RescheduleSlotPicker } from './RescheduleSlotPicker';

interface Props {
  booking: Booking;
  onUpdated?: (booking: Booking) => void;
  compact?: boolean;
}

export const RescheduleProposalCard: React.FC<Props> = ({
  booking,
  onUpdated,
  compact = false,
}) => {
  const reschedule = booking.reschedule;
  const [acting, setActing] = useState(false);
  const [showCounter, setShowCounter] = useState(false);
  const [counterDate, setCounterDate] = useState<string | null>(null);
  const [counterTime, setCounterTime] = useState('');
  const [note, setNote] = useState('');

  if (!reschedule || reschedule.status !== 'pending_client') {
    return null;
  }

  const proposedLabel = formatBookingSchedule(
    reschedule.proposedDate,
    reschedule.proposedTime
  );
  const currentLabel = formatBookingSchedule(
    booking.scheduledDate,
    booking.scheduledTime
  );
  const proposedByLabel =
    reschedule.proposedBy === 'technician' ? 'Proposed by technician' : 'Proposed by you';

  const accept = async () => {
    setActing(true);
    try {
      const updated = await bookingService.respondToReschedule(booking._id, {
        action: 'accept',
      });
      onUpdated?.(updated);
      Alert.alert('Confirmed', 'Your service has been rescheduled.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not accept proposal';
      Alert.alert('Failed', msg);
    } finally {
      setActing(false);
    }
  };

  const counter = async () => {
    if (!counterDate || !counterTime) {
      Alert.alert('Select date and time', 'Pick a new date and slot to counter-propose.');
      return;
    }
    setActing(true);
    try {
      const updated = await bookingService.respondToReschedule(booking._id, {
        action: 'counter',
        scheduledDate: counterDate,
        scheduledTime: counterTime,
        note: note.trim() || undefined,
      });
      onUpdated?.(updated);
      setShowCounter(false);
      setCounterDate(null);
      setCounterTime('');
      setNote('');
      Alert.alert('Sent', 'Your preferred time was sent to the technician.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not send counter-proposal';
      Alert.alert('Failed', msg);
    } finally {
      setActing(false);
    }
  };

  return (
    <Card padding={compact ? 14 : 16} style={styles.card}>
      <Text style={styles.title}>Reschedule requested</Text>
      <Text style={styles.body}>
        Your technician proposed a new time. Your current booking stays at{' '}
        <Text style={styles.emphasis}>{currentLabel}</Text> until you accept.
      </Text>

      <View style={styles.proposedBox}>
        <Text style={styles.proposedLabel}>{proposedByLabel}</Text>
        <Text style={styles.proposedTime}>{proposedLabel}</Text>
        {reschedule.note ? (
          <Text style={styles.note}>"{reschedule.note}"</Text>
        ) : null}
      </View>

      {!showCounter ? (
        <View style={styles.actions}>
          <Button label="ACCEPT PROPOSED TIME" onPress={accept} loading={acting} />
          <Button
            label="PROPOSE DIFFERENT TIME"
            variant="outline"
            onPress={() => setShowCounter(true)}
            disabled={acting}
            style={styles.secondaryBtn}
          />
        </View>
      ) : (
        <View style={styles.counterSection}>
          <Text style={styles.counterTitle}>Suggest another time</Text>
          <RescheduleSlotPicker
            bookingId={booking._id}
            serviceType={booking.serviceType}
            selectedDate={counterDate}
            selectedTime={counterTime}
            onSelectDate={setCounterDate}
            onSelectTime={setCounterTime}
          />
          <Input
            label="Note (optional)"
            value={note}
            onChangeText={setNote}
            placeholder="Reason for the change..."
            multiline
          />
          <Button label="SEND COUNTER-PROPOSAL" onPress={counter} loading={acting} />
          <Button
            label="CANCEL"
            variant="ghost"
            onPress={() => setShowCounter(false)}
            disabled={acting}
          />
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,193,7,0.35)',
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 15,
    color: COLORS.red,
  },
  body: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 8,
    lineHeight: 18,
  },
  emphasis: {
    color: COLORS.white,
    fontFamily: 'Montserrat_600SemiBold',
  },
  proposedBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,193,7,0.08)',
  },
  proposedLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 10,
    color: COLORS.red,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  proposedTime: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: COLORS.white,
    marginTop: 6,
  },
  note: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 8,
    fontStyle: 'italic',
  },
  actions: { marginTop: 16, gap: 10 },
  secondaryBtn: { marginTop: 4 },
  counterSection: { marginTop: 12, gap: 10 },
  counterTitle: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: COLORS.white,
  },
});
