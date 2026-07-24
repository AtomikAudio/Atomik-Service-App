import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { LoadingView } from '../../components/common/LoadingView';
import { ErrorView } from '../../components/common/ErrorView';
import {
  ThemedAlertModal,
  ThemedConfirmModal,
} from '../../components/common/ThemedConfirmModal';
import { TechnicianAssignedCard } from '../../components/client/TechnicianAssignedCard';
import { bookingService, Booking } from '../../services/bookings';
import { paymentService, Invoice } from '../../services/payments';
import { getTechnicianFromBooking } from '../../utils/bookingDisplay';
import { SparePartsSummary } from '../../components/common/SparePartsSummary';
import { PaymentBreakdownCard } from '../../components/common/PaymentBreakdownCard';
import { bookingHasSpareParts } from '../../utils/spareParts';
import {
  invoiceNeedsPayment,
  isExtraPartsOnlyPayment,
} from '../../utils/invoice';
import { resolveBillInvoice } from '../../utils/billInvoice';
import { navigateToBookingPayment } from '../../utils/navigatePayment';
import { COLORS } from '../../constants/colors';

interface Props {
  navigation: any;
  route: { params: { id: string; readOnly?: boolean } };
}

export const ServiceDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { id, readOnly = false } = route.params;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [resultAlert, setResultAlert] = useState<{
    title: string;
    message: string;
    icon?: 'checkmark-circle-outline' | 'alert-circle-outline';
    goBack?: boolean;
  } | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const b = await bookingService.getBookingById(id);
      setBooking(b);
      const invoices = await paymentService.getMyInvoices();
      const inv = invoices.find((i) => {
        const bid = typeof i.bookingId === 'object' ? i.bookingId._id : i.bookingId;
        return bid === b._id;
      });
      setPaymentInvoice(inv ?? null);
    } catch (e: any) {
      if (!silent) setError(e.message || 'Failed to load');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useLiveRefresh(() => load(true));

  const confirmCancelBooking = async () => {
    if (!booking) return;
    setCancelling(true);
    try {
      await bookingService.cancelBooking(booking._id, 'Cancelled by client');
      setCancelConfirmOpen(false);
      setResultAlert({
        title: 'Cancelled',
        message: 'Your booking has been cancelled.',
        icon: 'checkmark-circle-outline',
        goBack: true,
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
      setCancelling(false);
    }
  };

  if (loading) return <LoadingView />;
  if (error || !booking) return <ErrorView message={error} onRetry={load} />;

  const technician = getTechnicianFromBooking(booking);
  const canCancel = !readOnly && !['completed', 'cancelled'].includes(booking.status);
  const invoice = resolveBillInvoice(booking.invoice, paymentInvoice);

  return (
    <View style={styles.container}>
      <Header showBack title="Service Details" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card padding={18}>
          <Text style={styles.label}>Booking ID</Text>
          <Text style={styles.value}>{booking.bookingId}</Text>
          <Text style={styles.label}>Service</Text>
          <Text style={styles.value}>{booking.serviceType}</Text>
          <Text style={styles.label}>Venue</Text>
          <Text style={styles.value}>{booking.venueId?.name ?? '—'}</Text>
        </Card>

        {technician ? (
          <TechnicianAssignedCard
            name={technician.name}
            phone={technician.phone}
          />
        ) : null}

        {bookingHasSpareParts(booking) ? (
          <Card padding={16} style={{ marginTop: 16 }}>
            <SparePartsSummary
              parts={booking.spareParts}
              showWithGst={!!booking.invoice?.amountPaid}
            />
          </Card>
        ) : null}

        {invoice ? (
          <View style={styles.invoiceCard}>
            <PaymentBreakdownCard
              invoice={invoice}
              sparePartsLines={booking.spareParts}
            />
          </View>
        ) : null}

        {!readOnly ? (
          <>
            <Button
              label="TRACK SERVICE"
              onPress={() =>
                navigation.navigate('TrackService', { id: booking._id })
              }
              style={{ marginTop: 16 }}
            />
            {invoice && invoiceNeedsPayment(invoice) ? (
              <View style={styles.payCancelRow}>
                <Button
                  label={
                    isExtraPartsOnlyPayment(invoice, booking.spareParts)
                      ? 'PAY EXTRA PARTS'
                      : 'PAY NOW'
                  }
                  onPress={() =>
                    navigateToBookingPayment(navigation, booking, invoice)
                  }
                  style={styles.payBtnFlex}
                  fullWidth={false}
                />
                {canCancel ? (
                  <Button
                    label="CANCEL"
                    variant="outline"
                    onPress={() => setCancelConfirmOpen(true)}
                    loading={cancelling}
                    style={styles.cancelBtnFlex}
                    fullWidth={false}
                  />
                ) : null}
              </View>
            ) : canCancel ? (
              <Button
                label="CANCEL BOOKING"
                variant="outline"
                onPress={() => setCancelConfirmOpen(true)}
                loading={cancelling}
                style={{ marginTop: 10 }}
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <ThemedConfirmModal
        visible={cancelConfirmOpen}
        title="Cancel booking?"
        message="Cancel this booking? This cannot be undone."
        confirmLabel="CANCEL BOOKING"
        cancelLabel="KEEP"
        confirmDestructive
        loading={cancelling}
        icon="close-circle-outline"
        showNoRefundPolicy
        onConfirm={confirmCancelBooking}
        onCancel={() => {
          if (!cancelling) setCancelConfirmOpen(false);
        }}
      />

      <ThemedAlertModal
        visible={!!resultAlert}
        title={resultAlert?.title ?? ''}
        message={resultAlert?.message ?? ''}
        icon={resultAlert?.icon}
        onClose={() => {
          const goBack = resultAlert?.goBack;
          setResultAlert(null);
          if (goBack) navigation.goBack();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, paddingBottom: 40 },
  label: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 10,
  },
  value: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 15,
    color: COLORS.white,
    textTransform: 'capitalize',
  },
  invoiceCard: { marginTop: 16 },
  payCancelRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    alignItems: 'stretch',
  },
  payBtnFlex: {
    flex: 1,
    minHeight: 44,
    minWidth: 0,
  },
  cancelBtnFlex: {
    flex: 1,
    minHeight: 44,
    minWidth: 0,
  },
});
