import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LoadingView } from '../../components/common/LoadingView';
import { ErrorView } from '../../components/common/ErrorView';
import { bookingService, Booking } from '../../services/bookings';
import { formatBookingSchedule } from '../../utils/schedule';
import { COLORS } from '../../constants/colors';

interface Props {
  navigation: any;
}

export const PastServicesScreen: React.FC<Props> = ({ navigation }) => {
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const bookings = await bookingService.getMyBookings({
        status: 'completed',
        limit: 50,
      });
      setItems(bookings);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={load} />;

  return (
    <FlatList
      data={items}
      style={styles.list}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.serviceCard}
          onPress={() =>
            navigation.navigate('ServiceDetails', { id: item._id })
          }
        >
          <Text style={styles.serviceType}>{item.serviceType}</Text>
          <Text style={styles.venue}>{item.venueId?.name ?? '—'}</Text>
          <Text style={styles.meta}>
            #{item.bookingId} · {formatBookingSchedule(item.scheduledDate, item.scheduledTime)}
          </Text>
          <View style={styles.checkRow}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.ashGray} />
            <Text style={styles.completed}>Completed</Text>
          </View>
        </TouchableOpacity>
      )}
      keyExtractor={(item) => item._id}
      contentContainerStyle={styles.content}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No completed services yet</Text>
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 100 },
  serviceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
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
    marginTop: 4,
  },
  meta: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    color: COLORS.grayDark,
    marginTop: 8,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  completed: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: COLORS.ashGray,
  },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.gray, fontFamily: 'Montserrat_400Regular' },
});
