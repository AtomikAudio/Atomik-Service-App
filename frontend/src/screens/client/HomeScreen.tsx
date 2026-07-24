import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { useResponsive } from '../../hooks/useResponsive';
import { DashboardTopBar } from '../../components/common/DashboardTopBar';
import { Card } from '../../components/common/Card';
import { FadeIn } from '../../components/common/FadeIn';
import { PressableScale } from '../../components/common/PressableScale';
import { LoadingView } from '../../components/common/LoadingView';
import {
  ThemedAlertModal,
  ThemedConfirmModal,
} from '../../components/common/ThemedConfirmModal';
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

interface Props {
  navigation: any;
}

const QuickActionItem = ({
  icon,
  label,
  onPress,
  width,
  tileSize,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  width: number;
  tileSize: number;
}) => (
  <PressableScale
    onPress={onPress}
    style={[styles.quickAction, { width }]}
    scaleTo={0.92}
  >
    <View
      style={[
        styles.quickActionIcon,
        { width: tileSize, height: tileSize, borderRadius: tileSize * 0.26 },
      ]}
    >
      <Ionicons name={icon} size={Math.round(tileSize * 0.36)} color={COLORS.white} />
    </View>
    <Text style={styles.quickActionLabel} numberOfLines={2}>
      {label}
    </Text>
  </PressableScale>
);

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { width, isTablet } = useResponsive();
  // Fully dynamic Quick Actions grid: derive the column count and tile size from
  // the actual space available, so it fits any screen (Fold cover, phones,
  // tablets) without hardcoded breakpoints or clipping.
  const quickGridWidth = width - 40; // scroll paddingHorizontal (20) * 2
  const quickColumnGap = 12;
  const quickMinCol = 76; // smallest comfortable width per action before wrapping
  const quickMaxColumns = isTablet ? 5 : 4;
  const quickColumns = Math.max(
    2,
    Math.min(
      quickMaxColumns,
      Math.floor((quickGridWidth + quickColumnGap) / (quickMinCol + quickColumnGap))
    )
  );
  const quickItemWidth = Math.floor(
    (quickGridWidth - quickColumnGap * (quickColumns - 1)) / quickColumns
  );
  const quickTileSize = Math.max(46, Math.min(64, quickItemWidth - 22));
  // Horizontal cards should never exceed the screen; leave a peek of the next.
  const serviceCardWidth = Math.min(268, Math.round(width * 0.82));

  const user = useSelector((state: any) => state.auth.user);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resultAlert, setResultAlert] = useState<{
    title: string;
    message: string;
    icon?: 'checkmark-circle-outline' | 'alert-circle-outline';
  } | null>(null);

  const load = useCallback(async (silent = false) => {
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
      if (!silent) setBookings([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const confirmDeleteBooking = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await bookingService.cancelBooking(
        deleteTarget._id,
        'Cancelled by client'
      );
      setDeleteTarget(null);
      await load();
      setResultAlert({
        title: 'Cancelled',
        message: 'Your booking has been cancelled.',
        icon: 'checkmark-circle-outline',
      });
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : 'Could not cancel booking';
      setResultAlert({
        title: 'Could not cancel',
        message: msg,
        icon: 'alert-circle-outline',
      });
    } finally {
      setDeleting(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useLiveRefresh(() => load(true));

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
          <View style={styles.statWrap}>
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
          </View>
          <View style={styles.statWrap}>
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
          </View>
          <View style={styles.statWrap}>
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
          </View>
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
                    style={[styles.serviceCardPressable, { width: serviceCardWidth }]}
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
                      ) : needsPay ? (
                        <Text style={styles.awaitingTech} numberOfLines={2}>
                          Complete payment to confirm
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
                            onPress={() => setDeleteTarget(item)}
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
          <View style={[styles.quickActionsGrid, { columnGap: quickColumnGap }]}>
            <QuickActionItem
              icon="calendar-outline"
              label="Book Service"
              width={quickItemWidth}
              tileSize={quickTileSize}
              onPress={() =>
                navigation.navigate('ServiceCategories', { reset: true })
              }
            />
            <QuickActionItem
              icon="hardware-chip-outline"
              label="General Service"
              width={quickItemWidth}
              tileSize={quickTileSize}
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
              width={quickItemWidth}
              tileSize={quickTileSize}
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
              width={quickItemWidth}
              tileSize={quickTileSize}
              onPress={() => navigation.getParent()?.navigate('Payments')}
            />
          </View>
        </FadeIn>
      </SafeScrollView>

      <ThemedConfirmModal
        visible={!!deleteTarget}
        title="Cancel booking?"
        message="Cancel this booking? This cannot be undone."
        confirmLabel="CANCEL BOOKING"
        cancelLabel="KEEP"
        confirmDestructive
        loading={deleting}
        icon="close-circle-outline"
        showNoRefundPolicy
        onConfirm={confirmDeleteBooking}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />

      <ThemedAlertModal
        visible={!!resultAlert}
        title={resultAlert?.title ?? ''}
        message={resultAlert?.message ?? ''}
        icon={resultAlert?.icon}
        onClose={() => setResultAlert(null)}
      />
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
  statWrap: { flex: 1, minWidth: 0 },
  statPressable: { width: '100%' },
  statCard: { width: '100%' },
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
    maxWidth: '100%',
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
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    rowGap: 18,
  },
  quickAction: {
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  quickActionIcon: {
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
