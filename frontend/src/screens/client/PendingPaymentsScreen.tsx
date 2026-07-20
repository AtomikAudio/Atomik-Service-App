import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Badge } from '../../components/common/Badge';
import { LoadingView } from '../../components/common/LoadingView';
import { ErrorView } from '../../components/common/ErrorView';
import {
  ThemedAlertModal,
  ThemedConfirmModal,
} from '../../components/common/ThemedConfirmModal';
import { formatPaymentAmount, paymentService, Invoice } from '../../services/payments';
import { bookingService } from '../../services/bookings';
import {
  getClientSparePartsPayAmount,
  getInvoiceBalanceDue,
  isExtraPartsOnlyPayment,
} from '../../utils/invoice';
import { COLORS } from '../../constants/colors';

interface Props {
  navigation: any;
}

type AlertState = {
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
} | null;

export const PendingPaymentsScreen: React.FC<Props> = ({ navigation }) => {
  const [items, setItems] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelTarget, setCancelTarget] = useState<Invoice | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const all = await paymentService.getMyInvoices();
      setItems(
        all.filter((i) => {
          if (i.status === 'cancelled') return false;
          const booking =
            typeof i.bookingId === 'object' ? i.bookingId : null;
          if (booking?.status === 'cancelled') return false;
          return getInvoiceBalanceDue(i) > 0;
        })
      );
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const totalDue = items.reduce((sum, p) => sum + getInvoiceBalanceDue(p), 0);

  const spareLinesFor = (item: Invoice) => {
    const booking =
      typeof item.bookingId === 'object' ? item.bookingId : null;
    return booking?.spareParts;
  };

  const handlePay = (item: Invoice) => {
    const booking =
      typeof item.bookingId === 'object' ? item.bookingId : null;
    const lines = spareLinesFor(item);
    navigation.navigate('Payment', {
      invoiceId: item._id,
      bookingId: booking?._id,
      serviceType: booking?.serviceType,
      date: booking?.scheduledDate,
      time: booking?.scheduledTime,
      payFor: isExtraPartsOnlyPayment(item, lines) ? 'extra_parts' : 'full',
    });
  };

  const openCancel = (item: Invoice) => {
    const booking =
      typeof item.bookingId === 'object' ? item.bookingId : null;
    if (!booking?._id) {
      setAlert({
        title: 'Unavailable',
        message: 'Could not find this booking to cancel.',
        icon: 'alert-circle-outline',
      });
      return;
    }
    setCancelTarget(item);
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    const booking =
      typeof cancelTarget.bookingId === 'object'
        ? cancelTarget.bookingId
        : null;
    if (!booking?._id) {
      setCancelTarget(null);
      return;
    }

    setCancelling(true);
    try {
      await bookingService.cancelBooking(booking._id, 'Cancelled by client');
      setCancelTarget(null);
      await load();
      setAlert({
        title: 'Cancelled',
        message: 'Your booking has been cancelled.',
        icon: 'checkmark-circle-outline',
      });
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : 'Could not cancel booking';
      if (/already cancelled|cannot cancel a cancelled/i.test(msg)) {
        setCancelTarget(null);
        await load();
        setAlert({
          title: 'Cancelled',
          message: 'This booking is already cancelled.',
          icon: 'checkmark-circle-outline',
        });
      } else {
        setAlert({
          title: 'Could not cancel',
          message: msg,
          icon: 'alert-circle-outline',
        });
      }
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={load} />;

  return (
    <View style={styles.container}>
      <View style={styles.totalBanner}>
        <Text style={styles.totalLabel}>Total Outstanding</Text>
        <Text style={styles.totalAmount}>₹{formatPaymentAmount(totalDue)}</Text>
      </View>
      <Text style={styles.payHint}>
        Complete payment to confirm your booking. Technicians are assigned after
        payment succeeds.
      </Text>

      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => {
          const booking =
            typeof item.bookingId === 'object' ? item.bookingId : null;
          const lines = spareLinesFor(item);
          return (
            <View style={styles.paymentCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.serviceType}>
                    {booking?.serviceType ?? 'Service'}
                  </Text>
                  <Text style={styles.venue}>{item.invoiceNumber}</Text>
                </View>
                <Badge
                  label={
                    isExtraPartsOnlyPayment(item, lines)
                      ? 'EXTRA PARTS'
                      : 'PAYMENT DUE'
                  }
                  variant="due"
                />
              </View>
              {isExtraPartsOnlyPayment(item, lines) ? (
                <Text style={styles.spareLine}>
                  Technician quote (incl. GST): ₹
                  {formatPaymentAmount(
                    getClientSparePartsPayAmount(item, lines)
                  )}
                </Text>
              ) : null}
              <View style={styles.cardFooter}>
                <Text style={styles.amount}>
                  ₹
                  {formatPaymentAmount(
                    isExtraPartsOnlyPayment(item, lines)
                      ? getClientSparePartsPayAmount(item, lines)
                      : getInvoiceBalanceDue(item)
                  )}
                </Text>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.payBtn}
                    onPress={() => handlePay(item)}
                  >
                    <Text style={styles.payBtnText}>
                      {isExtraPartsOnlyPayment(item, lines)
                        ? 'PAY EXTRA'
                        : 'PAY NOW'}
                    </Text>
                  </TouchableOpacity>
                  {booking?.status !== 'cancelled' ? (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => openCancel(item)}
                    >
                      <Text style={styles.cancelBtnText}>CANCEL</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
          );
        }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={48} color={COLORS.ashGray} />
            <Text style={styles.emptyText}>No pending payments</Text>
          </View>
        }
      />

      <ThemedConfirmModal
        visible={!!cancelTarget}
        title="Cancel booking?"
        message="Cancel this booking? This cannot be undone."
        confirmLabel="CANCEL BOOKING"
        cancelLabel="KEEP"
        confirmDestructive
        loading={cancelling}
        icon="close-circle-outline"
        onConfirm={confirmCancel}
        onCancel={() => {
          if (!cancelling) setCancelTarget(null);
        }}
      />

      <ThemedAlertModal
        visible={!!alert}
        title={alert?.title ?? ''}
        message={alert?.message ?? ''}
        icon={alert?.icon}
        onClose={() => setAlert(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  payHint: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.gray,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  totalBanner: {
    backgroundColor: 'rgba(142,48,47,0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(142,48,47,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 13,
    color: COLORS.gray,
  },
  totalAmount: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: COLORS.red,
  },
  list: { padding: 20, gap: 12, paddingBottom: 100 },
  paymentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(142,48,47,0.15)',
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  spareLine: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 11,
    color: COLORS.red,
    marginBottom: 10,
  },
  serviceType: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.white,
    textTransform: 'capitalize',
  },
  venue: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  amount: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: COLORS.white,
    flexShrink: 0,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  payBtn: {
    backgroundColor: COLORS.red,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  payBtnText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    color: COLORS.white,
    letterSpacing: 1,
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: COLORS.borderActive,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    color: COLORS.grayLight,
    letterSpacing: 1,
  },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: COLORS.grayDark,
  },
});
