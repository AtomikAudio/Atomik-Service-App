import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { DashboardTopBar } from '../../components/common/DashboardTopBar';
import { Badge } from '../../components/common/Badge';
import { LoadingView } from '../../components/common/LoadingView';
import { adminService } from '../../services/admin';
import { bookingService, Booking } from '../../services/bookings';
import { COLORS } from '../../constants/colors';
import { Screen } from '../../components/common/Screen';
import { SafeScrollView } from '../../components/common/SafeScrollView';
import { formatINR, paymentBadgeVariant, paymentLabel } from '../../utils/payment';
import { sumSparePartsTotal } from '../../utils/sparePartsCalc';

const PENDING_STATUSES = ['pending', 'confirmed'];
const ONGOING_STATUSES = [
  'technician_assigned',
  'en_route',
  'arrived',
  'in_progress',
];

interface Props {
  navigation: any;
}

export const AdminDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const [stats, setStats] = useState({
    pendingBookings: 0,
    totalBookings: 0,
    totalRevenue: 0,
    activeTechnicians: 0,
  });
  const [pending, setPending] = useState<Booking[]>([]);
  const [ongoing, setOngoing] = useState<Booking[]>([]);
  const [completed, setCompleted] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [{ stats: s }, all] = await Promise.all([
        adminService.getStats(),
        bookingService.getAllBookings({ limit: 100 }),
      ]);
      setStats(s);
      setPending(all.filter((b) => PENDING_STATUSES.includes(b.status)));
      setOngoing(all.filter((b) => ONGOING_STATUSES.includes(b.status)));
      setCompleted(all.filter((b) => b.status === 'completed').slice(0, 5));
    } catch {
      /* keep defaults */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openBooking = (id: string) =>
    navigation.navigate('AdminBookingDetail', { bookingId: id });

  if (loading) return <LoadingView />;

  const renderColumn = (
    title: string,
    items: Booking[],
    onViewAll: () => void
  ) => (
    <View style={styles.column}>
      <View style={styles.colHeader}>
        <Text style={styles.colTitle}>{title}</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
      </View>
      {items.length === 0 && (
        <Text style={styles.colEmpty}>None</Text>
      )}
      {items.slice(0, 3).map((item) => (
        <TouchableOpacity
          key={item._id}
          style={styles.miniCard}
          onPress={() => openBooking(item._id)}
        >
          <Text style={styles.miniCardType}>{item.serviceType}</Text>
          <Text style={styles.miniCardId}>#{item.bookingId}</Text>
          <Text style={styles.miniCardVenue}>{item.venueId?.name}</Text>
          <View style={styles.miniBadges}>
            {item.paymentStatus ? (
              <Badge
                label={paymentLabel(item.paymentStatus)}
                variant={paymentBadgeVariant(item.paymentStatus)}
              />
            ) : null}
            <Badge label={item.status} variant="ongoing" />
          </View>
          {sumSparePartsTotal(item.spareParts) > 0 ? (
            <Text style={styles.miniExtra}>
              Extra parts: {formatINR(sumSparePartsTotal(item.spareParts))}
            </Text>
          ) : null}
          {item.invoice && item.paymentStatus === 'paid' ? (
            <Text style={styles.miniPaid}>{formatINR(item.invoice.amountPaid)}</Text>
          ) : null}
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <Screen>
      <DashboardTopBar
        onNotificationsPress={() => navigation.navigate('Notifications')}
      />
      <SafeScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.dashTitle}>Dashboard</Text>
        <Text style={styles.dashSub}>Operations overview</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats.pendingBookings}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{ongoing.length}</Text>
            <Text style={styles.statLabel}>Ongoing</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats.totalBookings}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
        <View style={styles.columnsRow}>
          {renderColumn('Pending', pending, () =>
            navigation.navigate('AdminBookings', { status: 'pending' })
          )}
          {renderColumn('Ongoing', ongoing, () =>
            navigation.navigate('AdminBookings')
          )}
          {renderColumn('Completed', completed, () =>
            navigation.navigate('AdminBookings', { status: 'completed' })
          )}
        </View>
      </SafeScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 100 },
  dashTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 22,
    color: COLORS.white,
  },
  dashSub: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 20,
  },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
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
  columnsRow: { gap: 16 },
  column: { marginBottom: 20 },
  colHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  colTitle: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.white,
  },
  viewAll: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 11,
    color: COLORS.red,
  },
  colEmpty: { color: COLORS.gray, fontSize: 12 },
  miniCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  miniCardType: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: COLORS.white,
    textTransform: 'capitalize',
  },
  miniCardId: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    color: COLORS.grayDark,
    marginVertical: 4,
  },
  miniCardVenue: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: COLORS.gray,
  },
  miniBadges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  miniExtra: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 10,
    color: COLORS.red,
    marginTop: 6,
  },
  miniPaid: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: COLORS.ashGray,
    marginTop: 6,
  },
});
