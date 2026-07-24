import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Button } from '../common/Button';
import { TechnicianSelect } from './TechnicianSelect';
import { AuthUser } from '../../services/auth';
import { Booking, bookingService } from '../../services/bookings';
import { COLORS } from '../../constants/colors';

interface Props {
  job: Booking;
  technicians: AuthUser[];
  onUpdated?: () => void;
  showHint?: boolean;
}

export const MasterJobAssignPanel: React.FC<Props> = ({
  job,
  technicians,
  onUpdated,
  showHint = true,
}) => {
  const [selectedTechId, setSelectedTechId] = useState('');
  const [loading, setLoading] = useState<'assign' | 'self' | null>(null);

  const assignToTechnician = async () => {
    if (!selectedTechId) {
      Alert.alert('Select technician', 'Choose a technician from the dropdown first.');
      return;
    }
    setLoading('assign');
    try {
      await bookingService.assignJobByMaster(job._id, selectedTechId);
      Alert.alert('Assigned', 'Job assigned to the selected technician.');
      setSelectedTechId('');
      onUpdated?.();
    } catch (e: any) {
      Alert.alert('Could not assign', e.message || 'Please try again');
    } finally {
      setLoading(null);
    }
  };

  const acceptForSelf = async () => {
    setLoading('self');
    try {
      await bookingService.acceptJob(job._id);
      Alert.alert('Accepted', 'Job is now assigned to you.');
      onUpdated?.();
    } catch (e: any) {
      Alert.alert('Could not accept', e.message || 'Please try again');
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={styles.wrap}>
      {showHint ? (
        <Text style={styles.hint}>
          Assign to a technician or accept this job yourself.
        </Text>
      ) : null}

      <Text style={styles.label}>Available technicians</Text>
      <TechnicianSelect
        technicians={technicians}
        value={selectedTechId}
        onChange={setSelectedTechId}
        disabled={loading !== null || technicians.length === 0}
        scheduledDate={
          typeof job.scheduledDate === 'string'
            ? job.scheduledDate
            : String(job.scheduledDate ?? '')
        }
        scheduledTime={job.scheduledTime}
        excludeBookingId={job._id}
      />

      <View style={styles.actions}>
        <Button
          label="ASSIGN"
          onPress={assignToTechnician}
          loading={loading === 'assign'}
          disabled={loading !== null || !selectedTechId}
          fullWidth={false}
          style={styles.actionBtn}
        />
        <Button
          label="ACCEPT MYSELF"
          variant="outline"
          onPress={acceptForSelf}
          loading={loading === 'self'}
          disabled={loading !== null}
          fullWidth={false}
          style={styles.actionBtn}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  hint: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 20,
    marginBottom: 12,
  },
  label: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    color: COLORS.grayLight,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    minWidth: 0,
    height: 48,
  },
});
