import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { DashboardTopBar } from '../../components/common/DashboardTopBar';
import { Badge } from '../../components/common/Badge';
import { PressableScale } from '../../components/common/PressableScale';
import { LoadingView } from '../../components/common/LoadingView';
import { bookingService, Booking } from '../../services/bookings';
import { COLORS } from '../../constants/colors';
import { Screen } from '../../components/common/Screen';
import { SafeScrollView } from '../../components/common/SafeScrollView';
import { formatINR, paymentBadgeVariant, paymentLabel } from '../../utils/payment';
import { sumSparePartsTotal } from '../../utils/sparePartsCalc';
import { formatBookingSchedule } from '../../utils/schedule';
import { getInvoiceCashPaid } from '../../utils/invoice';
import {
  formatBookingStatus,
  formatVenuePlace,
  getTechnicianFromBooking,
  matchesAdminBookingTab,
} from '../../utils/bookingDisplay';

type DashFilter = 'pending' | 'ongoing' | 'total';

interface Props {
  navigation: any;
}

export const AdminDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DashFilter>('pending');

  const load = useCallback(async () => {
    try {
      const all = await bookingService.getAllBookings({ limit: 100 });
      setBookings(all);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const pending = useMemo(
    () => bookings.filter((b) => matchesAdminBookingTab(b.status, 'pending')),
    [bookings]
  );
  const ongoing = useMemo(
    () => bookings.filter((b) => matchesAdminBookingTab(b.status, 'ongoing')),
    [bookings]
  );

  const visible =
    filter === 'pending'
      ? pending
      : filter === 'ongoing'
        ? ongoing
        : bookings;

  const openBooking = (id: string) =>
    navigation.navigate('AdminBookingDetail', { bookingId: id });

  if (loading) return <LoadingView />;

  const sectionTitle =
    filter === 'pending'
      ? 'Pending'
      : filter === 'ongoing'
        ? 'Ongoing'
        : 'All bookings';

  return (
    <Screen>
      <DashboardTopBar
        onNotificationsPress={() => navigation.navigate('Notifications')}
      />
      <SafeScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.dashTitle}>Dashboard</Text>
        <Text style={styles.dashSub}>Operations overview</Text>
        <View style={styles.statsRow}>
          <View style={styles.statWrap}>
            <PressableScale
              style={[
                styles.statCard,
                filter === 'pending' && styles.statCardActive,
              ]}
              onPress={() => setFilter('pending')}
            >
              <Text style={styles.statNum}>{pending.length}</Text>
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
              <Text style={styles.statNum}>{ongoing.length}</Text>
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

        <View style={styles.colHeader}>
          <Text style={styles.colTitle}>{sectionTitle}</Text>
          <PressableScale
            onPress={() =>
              navigation.navigate('AdminBookings', { filter })
            }
          >
            <Text style={styles.viewAll}>View All</Text>
          </PressableScale>
        </View>

        {visible.length === 0 ? (
          <Text style={styles.colEmpty}>None</Text>
        ) : (
          visible.slice(0, 8).map((item) => {
            const tech = getTechnicianFromBooking(item);
            return (
              <PressableScale
                key={item._id}
                style={styles.miniCard}
                onPress={() => openBooking(item._id)}
              >
                <Text style={styles.miniCardType}>{item.serviceType}</Text>
                <Text style={styles.miniCardId}>#{item.bookingId}</Text>
                <Text style={styles.miniCardSchedule}>
                  {formatBookingSchedule(
                    item.scheduledDate,
                    item.scheduledTime
                  )}
                </Text>
                <Text style={styles.miniCardVenue}>
                  {formatVenuePlace(item.venueId)}
                </Text>
                <Text style={styles.miniCardTech}>
                  Tech: {tech?.name ?? 'Unassigned'}
                </Text>
                <View style={styles.miniBadges}>
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
                {sumSparePartsTotal(item.spareParts) > 0 ? (
                  <Text style={styles.miniExtra}>
                    Extra parts: {formatINR(sumSparePartsTotal(item.spareParts))}
                  </Text>
                ) : null}
                {item.invoice && item.paymentStatus === 'paid' ? (
                  <Text style={styles.miniPaid}>
                    {formatINR(getInvoiceCashPaid(item.invoice))}
                  </Text>
                ) : null}
              </PressableScale>
            );
          })
        )}
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
  miniCardSchedule: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    color: COLORS.white,
    marginBottom: 2,
  },
  miniCardVenue: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 11,
    color: COLORS.white,
  },
  miniCardTech: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 4,
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
