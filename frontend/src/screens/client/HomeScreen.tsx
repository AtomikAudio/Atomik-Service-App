import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { DashboardTopBar } from '../../components/common/DashboardTopBar';
import { Card } from '../../components/common/Card';
import { FadeIn } from '../../components/common/FadeIn';
import { PressableScale } from '../../components/common/PressableScale';
import { LoadingView } from '../../components/common/LoadingView';
import { bookingService, Booking } from '../../services/bookings';
import { paymentService } from '../../services/payments';
import {
  formatServiceTypeLabel,
  getTechnicianFromBooking,
} from '../../utils/bookingDisplay';
import { Button } from '../../components/common/Button';
import {
  getInvoiceBalanceDue,
  invoiceNeedsPayment,
  isExtraPartsOnlyPayment,
} from '../../utils/invoice';
import { navigateToBookingPayment } from '../../utils/navigatePayment';
import { formatBookingSchedule, getISTGreetingHour } from '../../utils/schedule';
import { COLORS } from '../../constants/colors';
import { Screen } from '../../components/common/Screen';
import { SafeScrollView } from '../../components/common/SafeScrollView';
import { RescheduleProposalCard } from '../../components/client/RescheduleProposalCard';
// ₹1 dev test payment — disabled; re-enable import + block below when needed.
// import { DevTestPaymentCard } from '../../components/client/DevTestPaymentCard';

interface Props {
  navigation: any;
}

const QuickActionItem = ({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) => (
  <PressableScale onPress={onPress} style={styles.quickAction} scaleTo={0.92}>
    <View style={styles.quickActionIcon}>
      <Ionicons name={icon} size={20} color={COLORS.white} />
    </View>
    <Text style={styles.quickActionLabel} numberOfLines={2}>
      {label}
    </Text>
  </PressableScale>
);

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const user = useSelector((state: any) => state.auth.user);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [b, invoices] = await Promise.all([
        bookingService.getMyBookings({ limit: 20 }),
        paymentService.getMyInvoices(),
      ]);
      setBookings(b);
      setPendingCount(
        invoices.filter((i) => getInvoiceBalanceDue(i) > 0).length
      );
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteBooking = (booking: Booking) => {
    Alert.alert(
      'Delete booking?',
      `Delete booking ${booking.bookingId}? This cannot be undone.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await bookingService.cancelBooking(
                booking._id,
                'Cancelled by client'
              );
              await load();
              Alert.alert('Deleted', 'Your booking has been deleted.');
            } catch (e: unknown) {
              const msg =
                e instanceof Error ? e.message : 'Could not delete booking';
              Alert.alert('Failed', msg);
            }
          },
        },
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const upcomingServices = bookings.filter(
    (b) => !['completed', 'cancelled'].includes(b.status)
  );
  const pendingReschedules = upcomingServices.filter(
    (b) => b.reschedule?.status === 'pending_client'
  );

  const hour = getISTGreetingHour();
  const greeting =
    hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  if (loading) return <LoadingView />;

  return (
    <Screen>
      <DashboardTopBar
        onNotificationsPress={() => navigation.navigate('Notifications')}
      />

      <SafeScrollView contentContainerStyle={styles.scroll}>
        <FadeIn index={1} style={styles.greetingRow}>
          <View>
            <Text style={styles.greetingLabel}>{greeting},</Text>
            <Text style={styles.greetingName}>{user?.name || 'Client'}</Text>
          </View>
        </FadeIn>

        <FadeIn index={2} style={styles.statsRow}>
          <PressableScale
            onPress={() => navigation.navigate('UpcomingServices')}
            style={styles.statPressable}
            scaleTo={0.96}
          >
            <Card style={styles.statCard} padding={14}>
              <Text style={styles.statNum}>
                {bookings.filter(
                  (b) => !['completed', 'cancelled'].includes(b.status)
                ).length}
              </Text>
              <Text style={styles.statLabel}>Upcoming{'\n'}Services</Text>
            </Card>
          </PressableScale>
          <PressableScale
            onPress={() => navigation.getParent()?.navigate('Payments')}
            style={styles.statPressable}
            scaleTo={0.96}
          >
            <Card style={styles.statCard} padding={14}>
              <Text style={styles.statNum}>{pendingCount}</Text>
              <Text style={styles.statLabel}>Pending{'\n'}Payment</Text>
            </Card>
          </PressableScale>
          <PressableScale
            onPress={() => navigation.navigate('CompletedServices')}
            style={styles.statPressable}
            scaleTo={0.96}
          >
            <Card style={styles.statCard} padding={14}>
              <Text style={styles.statNum}>
                {bookings.filter((b) => b.status === 'completed').length}
              </Text>
              <Text style={styles.statLabel}>Completed{'\n'}Services</Text>
            </Card>
          </PressableScale>
        </FadeIn>

        <FadeIn index={3} style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Services</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('UpcomingServices')}
          >
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </FadeIn>

        {pendingReschedules.length > 0 ? (
          <FadeIn index={3.5}>
            {pendingReschedules.map((item) => (
              <RescheduleProposalCard
                key={`reschedule-${item._id}`}
                booking={item}
                compact
                onUpdated={(updated) => {
                  setBookings((prev) =>
                    prev.map((b) => (b._id === updated._id ? updated : b))
                  );
                }}
              />
            ))}
          </FadeIn>
        ) : null}

        <FadeIn index={4}>
          {upcomingServices.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {upcomingServices.map((item) => {
                const tech = getTechnicianFromBooking(item);
                const needsPay = invoiceNeedsPayment(item.invoice);
                const openTracking = () =>
                  navigation.navigate('TrackService', { id: item._id });
                return (
                  <PressableScale
                    key={item._id}
                    onPress={openTracking}
                    style={styles.serviceCardPressable}
                  >
                    <Card style={styles.serviceCardHorizontal} padding={16}>
                      <Text style={styles.serviceType} numberOfLines={1}>
                        {formatServiceTypeLabel(item.serviceType)}
                      </Text>
                      <Text style={styles.serviceDetailValue} numberOfLines={1}>
                        {item.venueId?.name ?? 'Venue'}
                      </Text>
                      <Text style={styles.serviceDate} numberOfLines={1}>
                        {formatBookingSchedule(
                          item.scheduledDate,
                          item.scheduledTime
                        )}
                      </Text>
                      {tech ? (
                        <Text style={styles.techInlineText} numberOfLines={1}>
                          {tech.name}
                        </Text>
                      ) : (
                        <Text style={styles.awaitingTech}>Awaiting technician</Text>
                      )}
                      <View style={styles.payCancelRow}>
                        <View style={styles.halfSlot}>
                          {needsPay ? (
                            <Button
                              label={
                                isExtraPartsOnlyPayment(
                                  item.invoice,
                                  item.spareParts
                                )
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
                              style={styles.cardActionBtn}
                              textStyle={styles.cardActionBtnText}
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
                            onPress={() => deleteBooking(item)}
                            style={styles.cardActionBtn}
                            textStyle={styles.cardActionBtnText}
                          />
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.detailsBtn}
                        onPress={openTracking}
                      >
                        <Text style={styles.detailsBtnText}>VIEW MORE</Text>
                      </TouchableOpacity>
                    </Card>
                  </PressableScale>
                );
              })}
            </ScrollView>
          ) : (
            <Card padding={16}>
              <Text style={styles.empty}>No upcoming services. Book one below.</Text>
            </Card>
          )}
        </FadeIn>

        <FadeIn index={5} style={styles.quickActionsSection}>
          <Text style={styles.sectionTitleInline}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <QuickActionItem
              icon="calendar-outline"
              label="Book Service"
              onPress={() =>
                navigation.navigate('ServiceCategories', { reset: true })
              }
            />
            <QuickActionItem
              icon="hardware-chip-outline"
              label="General Service"
              onPress={() =>
                navigation.navigate('ServiceCategories', {
                  reset: true,
                  preselect: 'general-service',
                })
              }
            />
            <QuickActionItem
              icon="navigate-outline"
              label="General Visit"
              onPress={() =>
                navigation.navigate('ServiceCategories', {
                  reset: true,
                  preselect: 'general-visit',
                })
              }
            />
            <QuickActionItem
              icon="card-outline"
              label="Payment History"
              onPress={() => navigation.getParent()?.navigate('Payments')}
            />
          </View>
        </FadeIn>
      </SafeScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  payCancelRow: {
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
  paidBadge: {
    width: '100%',
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.ashGrayBorder,
    backgroundColor: COLORS.ashGrayBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paidBadgeText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 11,
    color: COLORS.ashGray,
    letterSpacing: 1,
  },
  cardActionBtn: {
    width: '100%',
    height: 44,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  cardActionBtnText: {
    fontSize: 11,
    letterSpacing: 1,
  },
  detailsBtn: {
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
  detailsBtnText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    color: COLORS.red,
    letterSpacing: 1,
  },
  scroll: { paddingHorizontal: 20 },
  greetingRow: { marginBottom: 20 },
  greetingLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: COLORS.gray,
  },
  greetingName: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 28,
    color: COLORS.white,
  },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 22 },
  statPressable: { flex: 1 },
  statCard: { flex: 1 },
  statNum: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 22,
    color: COLORS.white,
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 10,
    color: COLORS.gray,
    lineHeight: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 15,
    color: COLORS.white,
  },
  viewAll: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: COLORS.red,
  },
  horizontalList: { paddingBottom: 8, gap: 14, paddingRight: 8 },
  serviceCardPressable: {
    width: 268,
  },
  serviceCardHorizontal: {
    width: '100%',
    marginRight: 0,
  },
  serviceType: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 15,
    color: COLORS.white,
  },
  serviceDetailValue: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 13,
    color: COLORS.white,
    marginTop: 8,
  },
  serviceDate: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 10,
    marginBottom: 6,
  },
  techInlineText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 6,
  },
  awaitingTech: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.grayDark,
    marginTop: 6,
  },
  empty: { color: COLORS.gray, fontFamily: 'Montserrat_400Regular' },
  quickActionsSection: { marginTop: 16, marginBottom: 24 },
  sectionTitleInline: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 15,
    color: COLORS.white,
    marginBottom: 14,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickAction: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 11,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 15,
    width: '100%',
  },
});
