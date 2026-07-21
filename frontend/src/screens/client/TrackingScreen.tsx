import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { LoadingView } from '../../components/common/LoadingView';
import { ErrorView } from '../../components/common/ErrorView';
import { TechnicianAssignedCard } from '../../components/client/TechnicianAssignedCard';
import { bookingService, Booking } from '../../services/bookings';
import {
  formatServiceTypeLabel,
  getBookedServiceSummary,
  getTechnicianFromBooking,
  parseBookingClientNotes,
} from '../../utils/bookingDisplay';
import { formatBookingSchedule } from '../../utils/schedule';
import { SparePartsSummary } from '../../components/common/SparePartsSummary';
import { PaymentBreakdownCard } from '../../components/common/PaymentBreakdownCard';
import { bookingHasSpareParts } from '../../utils/spareParts';
import { invoiceNeedsPayment, isExtraPartsOnlyPayment } from '../../utils/invoice';
import { navigateToBookingPayment } from '../../utils/navigatePayment';
import { RescheduleProposalCard } from '../../components/client/RescheduleProposalCard';
import { formatINR } from '../../utils/payment';
import { COLORS } from '../../constants/colors';

const POLL_MS = 20_000;

interface Props {
  navigation: any;
  route: { params: { id: string } };
}

export const TrackingScreen: React.FC<Props> = ({ navigation, route }) => {
  const { id } = route.params;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBill, setShowBill] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      if (!silent) setError('');
      try {
        const b = await bookingService.getBookingById(id);
        setBooking(b);
      } catch (e: any) {
        if (!silent) setError(e.message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id]
  );

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  useLiveRefresh(() => load(true), { intervalMs: POLL_MS });

  if (loading && !booking) return <LoadingView />;
  if (error && !booking) return <ErrorView message={error} onRetry={() => load(false)} />;
  if (!booking) return null;

  const technician = getTechnicianFromBooking(booking);
  const needsPay = invoiceNeedsPayment(booking.invoice);
  const hasSpare = bookingHasSpareParts(booking);
  const extraPartsOnly = isExtraPartsOnlyPayment(
    booking.invoice,
    booking.spareParts
  );
  const pay = () => navigateToBookingPayment(navigation, booking, booking.invoice);
  const serviceTypeLabel = formatServiceTypeLabel(booking.serviceType);
  const bookedServices = getBookedServiceSummary(booking);
  const clientNotes = parseBookingClientNotes(booking.notes);
  const venueAddress = [
    booking.venueId?.address,
    booking.venueId?.area,
    booking.venueId?.city,
    booking.venueId?.state,
    booking.venueId?.pincode,
  ]
    .filter(Boolean)
    .join(', ');

  const invoice = booking.invoice;
  const taxRate = invoice?.taxRate ?? 0.18;
  const basePreTax =
    (invoice?.serviceCharges ?? 0) + (invoice?.technicianCharges ?? 0);
  const baseGst = Math.round(basePreTax * taxRate);
  const baseTotal = basePreTax + baseGst;
  const amountPaid = invoice?.amountPaid ?? 0;
  const showPreviousPayment = !!invoice && amountPaid > 0;

  return (
    <View style={styles.container}>
      <Header showBack showLogo title="Service details" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card padding={18}>
          <Text style={styles.sectionLabel}>SERVICE TYPE</Text>
          <Text style={styles.title}>{serviceTypeLabel}</Text>
          <Text style={styles.meta}>#{booking.bookingId}</Text>
        </Card>

        <Card padding={16} style={styles.detailsCard}>
          <Text style={styles.sectionLabel}>WHAT YOU BOOKED</Text>
          <View style={styles.serviceChipRow}>
            {bookedServices.map((service) => (
              <View key={service} style={styles.serviceChip}>
                <Text style={styles.serviceChipText}>{service}</Text>
              </View>
            ))}
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Schedule</Text>
            <Text style={styles.detailValue}>
              {formatBookingSchedule(booking.scheduledDate, booking.scheduledTime)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Venue</Text>
            <Text style={styles.detailValue}>{booking.venueId?.name ?? '—'}</Text>
          </View>
          {venueAddress ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Address</Text>
              <Text style={styles.detailValue}>{venueAddress}</Text>
            </View>
          ) : null}
          {clientNotes ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Your notes</Text>
              <Text style={styles.detailValue}>{clientNotes}</Text>
            </View>
          ) : null}
        </Card>

        <RescheduleProposalCard
          booking={booking}
          onUpdated={setBooking}
        />

        {technician ? (
          <TechnicianAssignedCard
            name={technician.name}
            phone={technician.phone}
            showCallButton
          />
        ) : needsPay && !extraPartsOnly ? (
          <Card padding={16} style={styles.waitingCard}>
            <Text style={styles.waitingTitle}>Complete payment to confirm</Text>
            <Text style={styles.waitingBody}>
              Your booking is held until payment succeeds. Technicians are
              assigned only after you pay.
            </Text>
          </Card>
        ) : (
          <Card padding={16} style={styles.waitingCard}>
            <Text style={styles.waitingTitle}>Technician not assigned yet</Text>
            <Text style={styles.waitingBody}>
              You will see your technician&apos;s name and contact here once
              someone accepts the job.
            </Text>
          </Card>
        )}

        <View style={styles.actionsRow}>
          <Button
            label={showBill ? 'HIDE BILL' : 'VIEW BILL'}
            variant="outline"
            onPress={() => setShowBill((v) => !v)}
          />
        </View>

        {showBill ? (
          <View style={styles.billSection}>
            {showPreviousPayment ? (
              <Card
                padding={16}
                style={[
                  styles.billCard,
                  styles.billCardTop,
                  hasSpare ? null : styles.billCardAlone,
                ]}
              >
                <Text style={styles.sectionLabel}>PREVIOUS PAYMENT</Text>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Service charges</Text>
                  <Text style={styles.billValue}>
                    {formatINR(invoice!.serviceCharges ?? 0)}
                  </Text>
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Technician charges</Text>
                  <Text style={styles.billValue}>
                    {formatINR(invoice!.technicianCharges ?? 0)}
                  </Text>
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>
                    GST ({Math.round(taxRate * 100)}%)
                  </Text>
                  <Text style={styles.billValue}>{formatINR(baseGst)}</Text>
                </View>
                <View style={styles.billDivider} />
                <View style={styles.billRow}>
                  <Text style={styles.billTotalLabel}>Amount paid</Text>
                  <Text style={styles.billPaidValue}>
                    {formatINR(amountPaid)}
                  </Text>
                </View>
                {invoice?.paidAt ? (
                  <Text style={styles.billMeta}>
                    Paid on{' '}
                    {new Date(invoice.paidAt).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                    })}
                  </Text>
                ) : (
                  <Text style={styles.billMeta}>
                    Base service total {formatINR(baseTotal)} settled
                  </Text>
                )}
              </Card>
            ) : null}

            {hasSpare ? (
              <Card
                padding={16}
                style={[
                  styles.billCard,
                  showPreviousPayment
                    ? styles.billCardBottom
                    : styles.billCardAlone,
                ]}
              >
                <Text style={styles.sectionLabel}>EXTRA PARTS</Text>
                <SparePartsSummary
                  parts={booking.spareParts}
                  title=""
                  showWithGst
                  taxRate={taxRate}
                />
                {invoice ? (
                  <>
                    {needsPay ? (
                      <Button
                        label={
                          extraPartsOnly ? 'PAY EXTRA PARTS' : 'PAY NOW'
                        }
                        onPress={pay}
                        style={styles.billPayBtn}
                      />
                    ) : (
                      <Text style={styles.billMeta}>Extra parts settled</Text>
                    )}
                  </>
                ) : null}
              </Card>
            ) : invoice && !showPreviousPayment ? (
              <PaymentBreakdownCard
                invoice={invoice}
                sparePartsLines={booking.spareParts}
                onPayPress={needsPay ? pay : undefined}
              />
            ) : !invoice ? (
              <Card padding={16} style={styles.billCardAlone}>
                <Text style={styles.waitingBody}>
                  No invoice available for this booking yet.
                </Text>
              </Card>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, paddingBottom: 40 },
  sectionLabel: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    color: COLORS.grayDark,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: COLORS.white,
  },
  meta: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 6,
  },
  detailsCard: {
    marginTop: 16,
  },
  serviceChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  serviceChip: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.redMuted,
    borderWidth: 1,
    borderColor: 'rgba(142, 48, 47, 0.25)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  serviceChipText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: COLORS.white,
  },
  detailRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  detailLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 10,
    color: COLORS.grayDark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  detailValue: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.grayLight,
    lineHeight: 19,
  },
  partsCard: {
    marginTop: 16,
  },
  waitingCard: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  waitingTitle: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.white,
  },
  waitingBody: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 8,
    lineHeight: 18,
  },
  actionsRow: {
    marginTop: 16,
  },
  billSection: {
    marginTop: 12,
  },
  billCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  billCardTop: {
    marginTop: 0,
    marginBottom: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  billCardBottom: {
    marginTop: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  billCardAlone: {
    marginTop: 0,
    borderRadius: 14,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  billLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
  },
  billValue: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: COLORS.white,
  },
  billDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 10,
  },
  billTotalLabel: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: COLORS.white,
  },
  billPaidValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 15,
    color: COLORS.ashGray,
  },
  billMeta: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: COLORS.grayDark,
    marginTop: 8,
  },
  billPayBtn: {
    marginTop: 14,
  },
});
