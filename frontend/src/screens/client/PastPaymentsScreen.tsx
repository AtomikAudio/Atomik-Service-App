import React, { useCallback, useState } from 'react';
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
  flattenPaymentHistory,
  formatPaymentAmount,
  paymentHistoryTypeLabel,
  paymentService,
  PaymentHistoryRow,
} from '../../services/payments';
import { formatDateTimeIST } from '../../utils/schedule';
import { COLORS } from '../../constants/colors';

interface Props {
  navigation: any;
}

export const PastPaymentsScreen: React.FC<Props> = ({ navigation }) => {
  const [items, setItems] = useState<PaymentHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const all = await paymentService.getMyInvoices();
      setItems(flattenPaymentHistory(all));
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

  if (loading) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={load} />;

  return (
    <FlatList
      data={items}
      style={styles.list}
      contentContainerStyle={styles.content}
      keyExtractor={(item) => item.key}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() => {
            if (item.bookingMongoId) {
              navigation.navigate('ServiceDetails', { id: item.bookingMongoId });
            }
          }}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderText}>
              <Text style={styles.serviceType}>
                {item.serviceType ?? 'Service'}
              </Text>
              <Text style={styles.invoice}>{item.invoiceNumber}</Text>
            </View>
            <Badge
              label={paymentHistoryTypeLabel(item.type)}
              variant="confirmed"
            />
          </View>
          <Text style={styles.amount}>₹{formatPaymentAmount(item.amount)}</Text>
          <Text style={styles.paidAt}>
            Paid {formatDateTimeIST(item.paidAt)} IST
          </Text>
          {item.type === 'extra_parts' ? (
            <Text style={styles.extraHint}>
              Technician spare parts (incl. GST on quote)
            </Text>
          ) : null}
          {item.bookingRef ? (
            <Text style={styles.bookingRef}>Booking #{item.bookingRef}</Text>
          ) : null}
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={48} color={COLORS.grayDark} />
          <Text style={styles.emptyText}>No payment history yet</Text>
          <Text style={styles.emptyHint}>
            Each service payment and extra-parts payment will appear here as
            separate entries.
          </Text>
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.ashGrayBorder,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  cardHeaderText: { flex: 1 },
  serviceType: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.white,
    textTransform: 'capitalize',
  },
  invoice: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
  },
  amount: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: COLORS.white,
  },
  paidAt: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    color: COLORS.grayDark,
    marginTop: 8,
  },
  extraHint: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 6,
    fontStyle: 'italic',
  },
  bookingRef: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    color: COLORS.gray,
    marginTop: 4,
  },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24, gap: 10 },
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
    lineHeight: 18,
  },
});
