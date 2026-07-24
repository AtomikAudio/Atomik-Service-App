import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  FlatList,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { Header } from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { LoadingView } from '../../components/common/LoadingView';
import { PaymentBreakdownCard } from '../../components/common/PaymentBreakdownCard';
import { SparePartsSummary } from '../../components/common/SparePartsSummary';
import { TechAvailabilityBadge } from '../../components/common/TechAvailabilityBadge';
import { ServiceImagesGallery } from '../../components/common/ServiceImagesGallery';
import { bookingHasSpareParts } from '../../utils/spareParts';
import { bookingService, Booking } from '../../services/bookings';
import { adminService } from '../../services/admin';
import { authService } from '../../services/auth';
import { subscribeBookingChanged } from '../../services/liveUpdates';
import { COLORS } from '../../constants/colors';
import { formatBookingSchedule } from '../../utils/schedule';
import {
  formatBookingStatus,
  formatServiceTypeLabel,
  formatVenueAddress,
  formatVenuePlace,
  getBookedServiceSummary,
  getTechnicianFromBooking,
  parseBookingClientNotes,
} from '../../utils/bookingDisplay';

interface Props {
  navigation: any;
  route: { params: { bookingId: string } };
}

const formatRescheduleLine = (booking: Booking): string => {
  const r = booking.reschedule;
  if (!r?.status) return 'NA';
  const when = formatBookingSchedule(r.proposedDate, r.proposedTime);
  if (!when || when === '—') return formatBookingStatus(r.status) || 'NA';
  return `${formatBookingStatus(r.status)} · ${when}`;
};

export const AdminBookingDetailScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const { bookingId } = route.params;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [technicians, setTechnicians] = useState<
    { _id: string; name: string; phone?: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const [freeById, setFreeById] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const [b, users] = await Promise.all([
        bookingService.getBookingById(bookingId),
        adminService.getUsers({ role: 'technician' }),
      ]);
      setBooking(b);
      setTechnicians(users);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadAvailability = useCallback(async () => {
    if (!booking) return;
    try {
      const dateStr =
        typeof booking.scheduledDate === 'string'
          ? booking.scheduledDate
          : String(booking.scheduledDate ?? '');
      const rows = await authService.listTechnicianAvailability({
        scheduledDate: dateStr,
        scheduledTime: booking.scheduledTime,
        excludeBookingId: booking._id,
      });
      const next: Record<string, boolean> = {};
      for (const row of rows) next[row.id] = row.free;
      setFreeById(next);
    } catch {
      // Keep last known map.
    }
  }, [booking]);

  useEffect(() => {
    if (!pickerOpen) return undefined;
    void loadAvailability();
    const interval = setInterval(() => {
      void loadAvailability();
    }, 15000);
    const unsubscribe = subscribeBookingChanged(() => {
      void loadAvailability();
    });
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [pickerOpen, loadAvailability]);

  const assign = async (technicianId: string) => {
    setAssigning(true);
    setPickerOpen(false);
    try {
      await bookingService.assignTechnician(bookingId, technicianId);
      Alert.alert('Assigned', 'Technician assigned successfully.');
      load();
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setAssigning(false);
    }
  };

  const cancel = () => {
    Alert.alert('Cancel booking?', 'This cannot be undone.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: async () => {
          try {
            await bookingService.cancelBooking(bookingId, 'Cancelled by admin');
            Alert.alert('Cancelled');
            navigation.goBack();
          } catch (e: any) {
            Alert.alert('Failed', e.message);
          }
        },
      },
    ]);
  };

  const tech = booking ? getTechnicianFromBooking(booking) : null;
  const isAssigned = Boolean(tech);
  const assignedTechId =
    booking?.technicianId && typeof booking.technicianId !== 'string'
      ? booking.technicianId._id
      : typeof booking?.technicianId === 'string'
        ? booking.technicianId
        : undefined;

  const pickerList = useMemo(() => {
    if (!assignedTechId) return technicians;
    return technicians.filter((t) => t._id !== assignedTechId);
  }, [technicians, assignedTechId]);

  if (loading) return <LoadingView />;
  if (!booking) return null;

  const client = booking.clientId;
  const clientName =
    client && typeof client !== 'string' ? client.name : null;
  const clientPhone =
    client && typeof client !== 'string' ? client.phone : null;
  const services = getBookedServiceSummary(booking);
  const clientNotes = parseBookingClientNotes(booking.notes);
  const isCancelled = booking.status === 'cancelled';

  return (
    <View style={styles.container}>
      <Header showBack title={`#${booking.bookingId}`} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card padding={18}>
          <Text style={styles.title}>
            {formatServiceTypeLabel(booking.serviceType)}
          </Text>
          <Text style={styles.status}>
            {formatBookingStatus(booking.status)}
          </Text>

          <Text style={styles.label}>When</Text>
          <Text style={styles.valueStrong}>
            {formatBookingSchedule(
              booking.scheduledDate,
              booking.scheduledTime
            )}
          </Text>

          <Text style={styles.label}>Where</Text>
          <Text style={styles.valueStrong}>
            {formatVenuePlace(booking.venueId)}
          </Text>
          <Text style={styles.valueMuted}>
            {formatVenueAddress(booking.venueId)}
          </Text>

          <Text style={styles.label}>Technician</Text>
          <Text style={styles.valueStrong}>
            {tech?.name ?? 'Unassigned'}
          </Text>
          {tech?.phone ? (
            <Text style={styles.valueMuted}>{tech.phone}</Text>
          ) : null}

          <Text style={styles.label}>Client</Text>
          <Text style={styles.valueStrong}>{clientName ?? '—'}</Text>
          {clientPhone ? (
            <Text style={styles.valueMuted}>{clientPhone}</Text>
          ) : null}

          {services.length > 0 ? (
            <>
              <Text style={styles.label}>Services</Text>
              <Text style={styles.valueStrong}>{services.join(', ')}</Text>
            </>
          ) : null}

          <Text style={styles.label}>Reschedule</Text>
          <Text style={styles.valueStrong}>{formatRescheduleLine(booking)}</Text>

          {clientNotes ? (
            <>
              <Text style={styles.label}>Notes</Text>
              <Text style={styles.valueMuted}>{clientNotes}</Text>
            </>
          ) : null}

          {booking.technicianNotes ? (
            <>
              <Text style={styles.label}>Technician notes</Text>
              <Text style={styles.valueMuted}>{booking.technicianNotes}</Text>
            </>
          ) : null}
        </Card>
        {bookingHasSpareParts(booking) ? (
          <Card padding={16}>
            <SparePartsSummary parts={booking.spareParts} />
          </Card>
        ) : null}

        {booking.serviceImages && booking.serviceImages.length > 0 ? (
          <Card padding={16}>
            <ServiceImagesGallery
              images={booking.serviceImages}
              title="Client photos"
            />
          </Card>
        ) : null}

        <Button
          label={showBill ? 'HIDE BILL' : 'VIEW BILL'}
          variant="outline"
          onPress={() => setShowBill((v) => !v)}
          fullWidth
        />

        {showBill ? (
          booking.invoice ? (
            <PaymentBreakdownCard
              invoice={booking.invoice}
              sparePartsLines={booking.spareParts}
            />
          ) : (
            <Card padding={18}>
              <Text style={styles.valueMuted}>
                No invoice linked to this booking.
              </Text>
            </Card>
          )
        ) : null}

        {!isCancelled ? (
          <View style={styles.actions}>
            <View style={styles.actionHalf}>
              <Button
                label="Cancel Booking"
                onPress={cancel}
                variant="outline"
                fullWidth
              />
            </View>
            <View style={styles.actionHalf}>
              <Button
                label={isAssigned ? 'Reassign Technician' : 'Assign Technician'}
                onPress={() => setPickerOpen(true)}
                loading={assigning}
                fullWidth
              />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>
              {isAssigned ? 'Reassign technician' : 'Assign technician'}
            </Text>
            {pickerList.length === 0 ? (
              <Text style={styles.empty}>No technicians available.</Text>
            ) : (
              <FlatList
                data={pickerList}
                keyExtractor={(item) => item._id}
                style={styles.list}
                renderItem={({ item }) => {
                  const free =
                    item._id in freeById ? freeById[item._id] : null;
                  return (
                    <TouchableOpacity
                      style={styles.option}
                      onPress={() => assign(item._id)}
                      disabled={assigning}
                    >
                      <View style={styles.optionRow}>
                        <View style={styles.optionMain}>
                          <Text style={styles.optionText}>{item.name}</Text>
                          {item.phone ? (
                            <Text style={styles.optionSub}>{item.phone}</Text>
                          ) : null}
                        </View>
                        <TechAvailabilityBadge free={free} />
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            <Button
              label="Close"
              onPress={() => setPickerOpen(false)}
              variant="ghost"
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, paddingBottom: 40, gap: 12 },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: COLORS.white,
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  status: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 13,
    color: COLORS.red,
    marginBottom: 14,
  },
  label: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  valueStrong: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.white,
  },
  valueMuted: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  actions: {
    gap: 10,
    marginTop: 8,
  },
  actionHalf: {
    width: '100%',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 15,
    color: COLORS.white,
    marginBottom: 12,
  },
  list: { maxHeight: 320 },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionMain: { flex: 1, minWidth: 0 },
  optionText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.white,
  },
  optionSub: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  empty: {
    color: COLORS.gray,
    fontFamily: 'Montserrat_400Regular',
    marginBottom: 16,
  },
});
