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
import { formatPaymentAmount, paymentService, Invoice } from '../../services/payments';
import {
  getClientSparePartsPayAmount,
  getInvoiceBalanceDue,
  isExtraPartsOnlyPayment,
} from '../../utils/invoice';
import { COLORS } from '../../constants/colors';

interface Props {
  navigation: any;
}

export const PendingPaymentsScreen: React.FC<Props> = ({ navigation }) => {
  const [items, setItems] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const all = await paymentService.getMyInvoices();
      setItems(all.filter((i) => getInvoiceBalanceDue(i) > 0));
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
      payFor: isExtraPartsOnlyPayment(item, lines) ? 'extra_parts' : 'full',
    });
  };

  if (loading) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={load} />;

  return (
    <View style={styles.container}>
      <View style={styles.totalBanner}>
        <Text style={styles.totalLabel}>Total Outstanding</Text>
        <Text style={styles.totalAmount}>₹{formatPaymentAmount(totalDue)}</Text>
      </View>

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
              </View>
            </View>
          );
        }}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={48} color={COLORS.ashGray} />
            <Text style={styles.emptyText}>No pending payments</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  },
  amount: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: COLORS.white,
  },
  payBtn: {
    backgroundColor: COLORS.red,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  payBtnText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    color: COLORS.white,
    letterSpacing: 1,
  },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: COLORS.grayDark,
  },
});
