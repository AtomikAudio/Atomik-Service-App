import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/common/Screen';
import { Header } from '../../components/common/Header';
import { PressableScale } from '../../components/common/PressableScale';
import { useLayoutInsets } from '../../hooks/useLayoutInsets';
import { Badge } from '../../components/common/Badge';
import { LoadingView } from '../../components/common/LoadingView';
import { bookingService, Booking } from '../../services/bookings';
import { COLORS } from '../../constants/colors';
import { formatINR, paymentBadgeVariant, paymentLabel } from '../../utils/payment';
import { formatBookingSchedule } from '../../utils/schedule';
import { getInvoiceCashPaid } from '../../utils/invoice';
import {
  AdminBookingTab,
  formatBookingStatus,
  formatVenuePlace,
  getTechnicianFromBooking,
  matchesAdminBookingTab,
} from '../../utils/bookingDisplay';

type ListFilter = 'pending' | 'ongoing' | 'total';

interface Props {
  navigation: any;
  route?: { params?: { status?: string; filter?: ListFilter | AdminBookingTab } };
}

const resolveInitialFilter = (params?: {
  status?: string;
  filter?: ListFilter | AdminBookingTab;
}): ListFilter => {
  const raw = params?.filter ?? params?.status;
  if (raw === 'ongoing') return 'ongoing';
  if (
    raw === 'completed' ||
    raw === 'cancelled' ||
    raw === 'total'
  ) {
    return 'total';
  }
  if (raw === 'pending' || raw === 'confirmed') return 'pending';
  return 'pending';
};

export const AdminBookingsScreen: React.FC<Props> = ({ navigation, route }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ListFilter>(() =>
    resolveInitialFilter(route?.params)
  );

  const load = useCallback(async () => {
    try {
      const list = await bookingService.getAllBookings({ limit: 100 });
      setBookings(list);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setFilter(resolveInitialFilter(route?.params));
  }, [route?.params?.filter, route?.params?.status]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const pendingCount = useMemo(
    () => bookings.filter((b) => matchesAdminBookingTab(b.status, 'pending')).length,
    [bookings]
  );
  const ongoingCount = useMemo(
    () => bookings.filter((b) => matchesAdminBookingTab(b.status, 'ongoing')).length,
    [bookings]
  );

  const filtered = useMemo(() => {
    if (filter === 'pending') {
      return bookings.filter((b) => matchesAdminBookingTab(b.status, 'pending'));
    }
    if (filter === 'ongoing') {
      return bookings.filter((b) => matchesAdminBookingTab(b.status, 'ongoing'));
    }
    return bookings;
  }, [bookings, filter]);

  const { scrollBottomPadding } = useLayoutInsets();

  if (loading && bookings.length === 0) return <LoadingView />;

  return (
    <Screen>
      <Header title="Bookings" />
      <View style={styles.statsRow}>
        <View style={styles.statWrap}>
          <PressableScale
            style={[
              styles.statCard,
              filter === 'pending' && styles.statCardActive,
            ]}
            onPress={() => setFilter('pending')}
          >
            <Text style={styles.statNum}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </PressableScale>
        </View>
        <View style={styles.statWrap}>
          <PressableScale
            style={[
              styles.statCard,
              filter === 'ongoing' && styles.statCardActive,
            ]}
            onPress={() => setFilter('ongoing')}
          >
            <Text style={styles.statNum}>{ongoingCount}</Text>
            <Text style={styles.statLabel}>Ongoing</Text>
          </PressableScale>
        </View>
        <View style={styles.statWrap}>
          <PressableScale
            style={[
              styles.statCard,
              filter === 'total' && styles.statCardActive,
            ]}
            onPress={() => setFilter('total')}
          >
            <Text style={styles.statNum}>{bookings.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </PressableScale>
        </View>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        contentContainerStyle={[styles.list, { paddingBottom: scrollBottomPadding }]}
        ListEmptyComponent={
          <Text style={styles.empty}>No bookings found.</Text>
        }
        renderItem={({ item }) => {
          const tech = getTechnicianFromBooking(item);
          return (
            <PressableScale
              style={styles.card}
              onPress={() =>
                navigation.navigate('AdminBookingDetail', {
                  bookingId: item._id,
                })
              }
            >
              <View style={styles.row}>
                <Text style={styles.type}>{item.serviceType}</Text>
                <View style={styles.badges}>
                  {item.paymentStatus ? (
                    <Badge
                      label={paymentLabel(item.paymentStatus)}
                      variant={paymentBadgeVariant(item.paymentStatus)}
                    />
                  ) : null}
                  <Badge
                    label={formatBookingStatus(item.status)}
                    variant="ongoing"
                  />
                </View>
              </View>
              <Text style={styles.meta}>#{item.bookingId}</Text>
              <Text style={styles.schedule}>
                {formatBookingSchedule(item.scheduledDate, item.scheduledTime)}
              </Text>
              <Text style={styles.place}>{formatVenuePlace(item.venueId)}</Text>
              <Text style={styles.tech}>
                Tech: {tech?.name ?? 'Unassigned'}
              </Text>
              {item.invoice ? (
                <Text style={styles.amount}>
                  {item.paymentStatus === 'paid'
                    ? `Received ${formatINR(getInvoiceCashPaid(item.invoice))}`
                    : `Due ${formatINR(item.invoice.totalAmount)}`}
                </Text>
              ) : null}
            </PressableScale>
          );
        }}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 8,
    marginBottom: 4,
  },
  statWrap: { flex: 1 },
  statCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statCardActive: {
    borderColor: COLORS.red,
    backgroundColor: 'rgba(142,48,47,0.16)',
  },
  statNum: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 24,
    color: COLORS.white,
  },
  statLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: COLORS.gray,
  },
  list: { padding: 20, paddingTop: 16 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    flexShrink: 0,
  },
  type: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.white,
    textTransform: 'capitalize',
    flex: 1,
  },
  meta: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    color: COLORS.grayDark,
    marginBottom: 6,
  },
  schedule: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12,
    color: COLORS.white,
    marginBottom: 4,
  },
  place: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 13,
    color: COLORS.white,
  },
  tech: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 6,
  },
  amount: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: COLORS.white,
    marginTop: 8,
  },
  empty: {
    color: COLORS.gray,
    fontFamily: 'Montserrat_400Regular',
    textAlign: 'center',
    marginTop: 40,
  },
});
