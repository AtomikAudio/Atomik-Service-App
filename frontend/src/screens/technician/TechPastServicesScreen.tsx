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
import { useSelector } from 'react-redux';
import { Header } from '../../components/common/Header';
import { Screen } from '../../components/common/Screen';
import { LoadingView } from '../../components/common/LoadingView';
import { ErrorView } from '../../components/common/ErrorView';
import { bookingService, Booking } from '../../services/bookings';
import { formatServiceTypeLabel } from '../../utils/bookingDisplay';
import { resolveAssignedTechnicianId } from '../../utils/technicianBooking';
import { formatBookingSchedule } from '../../utils/schedule';
import { COLORS } from '../../constants/colors';

interface Props {
  navigation: any;
}

const formatVenueLine = (venue: Booking['venueId']) => {
  if (!venue) return '—';
  const parts = [venue.name, venue.area, venue.city].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
};

export const TechPastServicesScreen: React.FC<Props> = ({ navigation }) => {
  const user = useSelector((state: any) => state.auth.user);
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
      const myId = String(user?.id ?? '');
      setItems(
        bookings.filter(
          (b) =>
            b.status === 'completed' &&
            resolveAssignedTechnicianId(b) === myId
        )
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <Header showBack title="Past Services" />
        <LoadingView />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <Header showBack title="Past Services" />
        <ErrorView message={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Header showBack title="Past Services" />
      <FlatList
        data={items}
        style={styles.list}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name="briefcase-outline"
              size={48}
              color={COLORS.grayDark}
            />
            <Text style={styles.emptyText}>No past services yet</Text>
            <Text style={styles.emptyHint}>
              Completed jobs you attend will show up here.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const clientName =
            typeof item.clientId === 'object' && item.clientId
              ? item.clientId.name
              : undefined;
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() =>
                navigation.navigate('JobDetail', { jobId: item._id })
              }
            >
              <View style={styles.cardTop}>
                <Text style={styles.serviceType}>
                  {formatServiceTypeLabel(item.serviceType)}
                </Text>
                <View style={styles.doneBadge}>
                  <Text style={styles.doneBadgeText}>COMPLETED</Text>
                </View>
              </View>
              <Text style={styles.venue}>{formatVenueLine(item.venueId)}</Text>
              {clientName ? (
                <Text style={styles.client}>Client: {clientName}</Text>
              ) : null}
              <Text style={styles.meta}>
                #{item.bookingId} ·{' '}
                {formatBookingSchedule(item.scheduledDate, item.scheduledTime)}
              </Text>
              <View style={styles.footer}>
                <Text style={styles.viewDetails}>VIEW DETAILS</Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={COLORS.red}
                />
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 40, flexGrow: 1 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  serviceType: {
    flex: 1,
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 15,
    color: COLORS.white,
  },
  doneBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  doneBadgeText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 9,
    color: COLORS.ashGray,
    letterSpacing: 1,
  },
  venue: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 8,
    lineHeight: 18,
  },
  client: {
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 4,
  },
  viewDetails: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    color: COLORS.red,
    letterSpacing: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 28,
    gap: 12,
  },
  emptyText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 15,
    color: COLORS.gray,
    textAlign: 'center',
  },
  emptyHint: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.grayDark,
    textAlign: 'center',
    lineHeight: 18,
  },
});
