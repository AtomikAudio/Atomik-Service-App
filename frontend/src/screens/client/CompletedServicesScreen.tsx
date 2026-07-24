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
import { Header } from '../../components/common/Header';
import { Screen } from '../../components/common/Screen';
import { LoadingView } from '../../components/common/LoadingView';
import { ErrorView } from '../../components/common/ErrorView';
import { bookingService, Booking } from '../../services/bookings';
import { formatServiceTypeLabel } from '../../utils/bookingDisplay';
import { formatBookingSchedule } from '../../utils/schedule';
import { COLORS } from '../../constants/colors';

interface Props {
  navigation: any;
  route?: { params?: { title?: string } };
}

export const CompletedServicesScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const title = route?.params?.title?.trim() || 'Completed Services';
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

  if (loading) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <Header showBack title={title} />
        <LoadingView />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <Header showBack title={title} />
        <ErrorView message={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Header showBack title={title} />
      <FlatList
        data={items}
        style={styles.list}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-outline" size={48} color={COLORS.grayDark} />
            <Text style={styles.emptyText}>No completed services yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.serviceCard}
            activeOpacity={0.85}
            onPress={() =>
              navigation.navigate('ServiceDetails', {
                id: item._id,
                readOnly: true,
              })
            }
          >
            <Text style={styles.serviceType}>
              {formatServiceTypeLabel(item.serviceType)}
            </Text>
            <Text style={styles.venue}>{item.venueId?.name ?? '—'}</Text>
            <Text style={styles.meta}>
              #{item.bookingId} ·{' '}
              {formatBookingSchedule(item.scheduledDate, item.scheduledTime)}
            </Text>
            <View style={styles.checkRow}>
              <Ionicons name="checkmark-circle" size={18} color={COLORS.ashGray} />
              <Text style={styles.completed}>Completed</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 40, flexGrow: 1 },
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
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  completed: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: COLORS.ashGray,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 28,
    gap: 16,
  },
  emptyText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 15,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 22,
  },
});
