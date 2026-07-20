import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Header } from '../../components/common/Header';
import { Screen } from '../../components/common/Screen';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { LoadingView } from '../../components/common/LoadingView';
import { ErrorView } from '../../components/common/ErrorView';
import { PressableScale } from '../../components/common/PressableScale';
import {
  ThemedAlertModal,
  ThemedConfirmModal,
} from '../../components/common/ThemedConfirmModal';
import { bookingService, Booking } from '../../services/bookings';
import {
  formatServiceTypeLabel,
  getTechnicianFromBooking,
} from '../../utils/bookingDisplay';
import {
  invoiceNeedsPayment,
  isExtraPartsOnlyPayment,
} from '../../utils/invoice';
import { navigateToBookingPayment } from '../../utils/navigatePayment';
import { formatBookingSchedule } from '../../utils/schedule';
import { COLORS } from '../../constants/colors';

interface Props {
  navigation: any;
}

export const UpcomingServicesScreen: React.FC<Props> = ({ navigation }) => {
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resultAlert, setResultAlert] = useState<{
    title: string;
    message: string;
    icon?: 'checkmark-circle-outline' | 'alert-circle-outline';
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const bookings = await bookingService.getMyBookings({ limit: 50 });
      setItems(
        bookings.filter((b) => !['completed', 'cancelled'].includes(b.status))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const confirmDeleteBooking = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await bookingService.cancelBooking(
        deleteTarget._id,
        'Cancelled by client'
      );
      setDeleteTarget(null);
      await load();
      setResultAlert({
        title: 'Cancelled',
        message: 'Your booking has been cancelled.',
        icon: 'checkmark-circle-outline',
      });
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : 'Could not cancel booking';
      setResultAlert({
        title: 'Could not cancel',
        message: msg,
        icon: 'alert-circle-outline',
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <Header showBack title="Upcoming Services" />
        <LoadingView />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <Header showBack title="Upcoming Services" />
        <ErrorView message={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Header showBack title="Upcoming Services" />
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No upcoming services</Text>
            <Text style={styles.emptyHint}>
              Go ahead and place a service now
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const tech = getTechnicianFromBooking(item);
          const needsPay = invoiceNeedsPayment(item.invoice);
          const openTracking = () =>
            navigation.navigate('TrackService', { id: item._id });

          return (
            <PressableScale onPress={openTracking} style={styles.cardWrap}>
              <Card padding={16}>
                <Text style={styles.serviceType}>
                  {formatServiceTypeLabel(item.serviceType)}
                </Text>
                <Text style={styles.venue}>
                  {item.venueId?.name ?? 'Venue'}
                </Text>
                <Text style={styles.meta}>
                  #{item.bookingId} ·{' '}
                  {formatBookingSchedule(item.scheduledDate, item.scheduledTime)}
                </Text>
                {tech ? (
                  <Text style={styles.tech}>{tech.name}</Text>
                ) : needsPay ? (
                  <Text style={styles.awaiting}>
                    Complete payment to confirm booking
                  </Text>
                ) : (
                  <Text style={styles.awaiting}>Awaiting technician</Text>
                )}

                <View style={styles.actions}>
                  <View style={styles.halfSlot}>
                    {needsPay ? (
                      <Button
                        label={
                          isExtraPartsOnlyPayment(item.invoice, item.spareParts)
                            ? 'PAY EXTRA'
                            : 'PAY NOW'
                        }
                        onPress={() =>
                          navigateToBookingPayment(
                            navigation,
                            item,
                            item.invoice
                          )
                        }
                        style={styles.actionBtn}
                        textStyle={styles.actionBtnText}
                      />
                    ) : (
                      <View style={styles.paidBadge}>
                        <Text style={styles.paidBadgeText}>PAID</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.halfSlot}>
                    <Button
                      label="DELETE"
                      variant="outline"
                      onPress={() => setDeleteTarget(item)}
                      style={styles.actionBtn}
                      textStyle={styles.actionBtnText}
                    />
                  </View>
                </View>

                <TouchableOpacity style={styles.viewMore} onPress={openTracking}>
                  <Text style={styles.viewMoreText}>VIEW MORE</Text>
                </TouchableOpacity>
              </Card>
            </PressableScale>
          );
        }}
      />

      <ThemedConfirmModal
        visible={!!deleteTarget}
        title="Cancel booking?"
        message="Cancel this booking? This cannot be undone."
        confirmLabel="CANCEL BOOKING"
        cancelLabel="KEEP"
        confirmDestructive
        loading={deleting}
        icon="close-circle-outline"
        onConfirm={confirmDeleteBooking}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />

      <ThemedAlertModal
        visible={!!resultAlert}
        title={resultAlert?.title ?? ''}
        message={resultAlert?.message ?? ''}
        icon={resultAlert?.icon}
        onClose={() => setResultAlert(null)}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  cardWrap: { marginBottom: 14 },
  serviceType: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 15,
    color: COLORS.white,
  },
  venue: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 6,
  },
  meta: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    color: COLORS.grayDark,
    marginTop: 8,
  },
  tech: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: COLORS.white,
    marginTop: 8,
  },
  awaiting: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.grayDark,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    alignItems: 'stretch',
    width: '100%',
  },
  halfSlot: {
    flex: 1,
    minWidth: 0,
  },
  actionBtn: {
    width: '100%',
    height: 44,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 11,
    letterSpacing: 1,
  },
  paidBadge: {
    width: '100%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.ashGrayBorder,
    backgroundColor: COLORS.ashGrayBg,
  },
  paidBadgeText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    color: COLORS.ashGray,
    letterSpacing: 1,
  },
  viewMore: {
    marginTop: 10,
    width: '100%',
    alignSelf: 'stretch',
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewMoreText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    color: COLORS.red,
    letterSpacing: 1,
  },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: COLORS.gray,
  },
  emptyHint: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.grayDark,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
});
