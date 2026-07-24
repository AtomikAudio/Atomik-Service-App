import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { LoadingView } from '../../components/common/LoadingView';
import { ErrorView } from '../../components/common/ErrorView';
import { TechnicianAssignedCard } from '../../components/client/TechnicianAssignedCard';
import { RateTechnicianModal } from '../../components/client/RateTechnicianModal';
import { bookingService, Booking, BookingInvoice } from '../../services/bookings';
import { paymentService, Invoice } from '../../services/payments';
import { reviewService } from '../../services/reviews';
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
import { resolveBillInvoice } from '../../utils/billInvoice';
import { navigateToBookingPayment } from '../../utils/navigatePayment';
import { RescheduleProposalCard } from '../../components/client/RescheduleProposalCard';
import {
  hasRatedBooking,
  markBookingRated,
  markRatingSkipped,
  shouldPromptRating,
} from '../../utils/ratingPrompt';
import { COLORS } from '../../constants/colors';

const POLL_MS = 20_000;

interface Props {
  navigation: any;
  route: { params: { id: string } };
}

export const TrackingScreen: React.FC<Props> = ({ navigation, route }) => {
  const { id } = route.params;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBill, setShowBill] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [canRate, setCanRate] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      if (!silent) setError('');
      try {
        const b = await bookingService.getBookingById(id);
        setBooking(b);
        try {
          const invoices = await paymentService.getMyInvoices();
          const inv =
            invoices.find((i) => {
              const bid =
                typeof i.bookingId === 'object' ? i.bookingId._id : i.bookingId;
              return bid === b._id;
            }) ?? null;
          setPaymentInvoice(inv);
        } catch {
          setPaymentInvoice(null);
        }

        let prompt = false;
        if (b.status === 'completed' && getTechnicianFromBooking(b)) {
          if (await shouldPromptRating(b._id)) {
            try {
              const { reviewed } = await reviewService.getForBooking(b._id);
              if (reviewed) {
                await markBookingRated(b._id);
              } else {
                prompt = true;
              }
            } catch {
              prompt = true;
            }
          }
        }
        setCanRate(prompt);
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

  const invoice: BookingInvoice | undefined = resolveBillInvoice(
    booking.invoice,
    paymentInvoice
  );
  const technician = getTechnicianFromBooking(booking);
  const needsPay = invoiceNeedsPayment(invoice);
  const hasSpare = bookingHasSpareParts(booking);
  const extraPartsOnly = isExtraPartsOnlyPayment(invoice, booking.spareParts);
  const pay = () => navigateToBookingPayment(navigation, booking, invoice);
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

  const taxRate = invoice?.taxRate ?? 0.18;

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

        {canRate ? (
          <Button
            label="RATE TECHNICIAN"
            onPress={() => setRateOpen(true)}
            style={styles.rateBtn}
          />
        ) : null}

        {showBill ? (
          <View style={styles.billSection}>
            {invoice ? (
              <PaymentBreakdownCard
                invoice={invoice}
                sparePartsLines={booking.spareParts}
                onPayPress={needsPay ? pay : undefined}
              />
            ) : (
              <Card padding={16} style={styles.billCardAlone}>
                <Text style={styles.waitingBody}>
                  No invoice available for this booking yet.
                </Text>
              </Card>
            )}

            {hasSpare ? (
              <Card
                padding={16}
                style={[
                  styles.billCard,
                  invoice ? styles.billCardBottom : styles.billCardAlone,
                ]}
              >
                <Text style={styles.sectionLabel}>EXTRA PARTS DETAIL</Text>
                <SparePartsSummary
                  parts={booking.spareParts}
                  title=""
                  showWithGst
                  taxRate={taxRate}
                />
                {invoice && !needsPay ? (
                  <Text style={styles.billMeta}>Extra parts settled</Text>
                ) : null}
              </Card>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <RateTechnicianModal
        visible={rateOpen}
        technicianName={technician?.name || 'your technician'}
        loading={ratingLoading}
        onSubmit={async (rating) => {
          setRatingLoading(true);
          try {
            await reviewService.submit(booking._id, rating);
            await markBookingRated(booking._id);
            setCanRate(false);
          } catch (e: unknown) {
            const msg =
              e instanceof Error ? e.message : 'Could not submit rating';
            Alert.alert('Rating failed', msg);
            throw e;
          } finally {
            setRatingLoading(false);
          }
        }}
        onDismiss={() => {
          void (async () => {
            if (!(await hasRatedBooking(booking._id))) {
              await markRatingSkipped(booking._id);
            }
            setRateOpen(false);
          })();
        }}
      />
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
  rateBtn: {
    marginTop: 12,
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
