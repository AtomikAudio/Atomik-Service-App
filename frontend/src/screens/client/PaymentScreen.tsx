import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Header } from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { paymentService } from '../../services/payments';
import { bookingService } from '../../services/bookings';
import { SparePartLine } from '../../utils/spareParts';
import {
  getInvoiceBalanceDue,
  isExtraPartsOnlyPayment,
} from '../../utils/invoice';
import { sumSparePartsTotal } from '../../utils/sparePartsCalc';
import { applyLocalCoupon, normalizeCouponCode } from '../../utils/coupons';
import { formatRateLimitMessage } from '../../utils/rateLimitMessage';
import {
  ThemedAlertModal,
  ThemedConfirmModal,
} from '../../components/common/ThemedConfirmModal';
import { formatBookingSchedule } from '../../utils/schedule';
import { formatServiceTypeLabel } from '../../utils/bookingDisplay';
import { useBookingDraft } from '../../context/BookingDraftContext';
import { COLORS } from '../../constants/colors';
import { keyboardBehavior } from '../../utils/layout';

interface Props {
  navigation: any;
  route: any;
}

const formatINR = (amount: number) =>
  `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return ch;
    }
  });

const escapeJsString = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

const razorpayHtml = (key: string, orderId: string, amount: number, name: string) => `
<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#231f20;display:flex;align-items:center;justify-content:center;height:100vh">
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  var options = {
    key: "${escapeJsString(key)}",
    amount: ${amount},
    currency: "INR",
    name: "ATOMIK",
    description: "${escapeJsString(escapeHtml(name))}",
    order_id: "${escapeJsString(orderId)}",
    theme: { color: "#8e302f" },
    handler: function (response) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'success',
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature
      }));
    },
    modal: {
      ondismiss: function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'dismiss' }));
      }
    }
  };
  var rzp = new Razorpay(options);
  rzp.on('payment.failed', function () {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'failed' }));
  });
  rzp.open();
</script>
<p style="color:#888;font-family:sans-serif;text-align:center">Opening Razorpay...</p>
</body></html>`;

type InvoiceState = {
  totalAmount: number;
  invoiceNumber: string;
  serviceCharges: number;
  technicianCharges: number;
  spareParts: number;
  taxAmount: number;
  taxRate: number;
  amountPaid?: number;
  balanceDue?: number;
  paidAt?: string;
};

export const PaymentScreen: React.FC<Props> = ({ navigation, route }) => {
  const { invoiceId, bookingId, serviceType, date, time, payFor, fromBookingFlow } =
    route.params || {};
  const { resetDraft } = useBookingDraft();
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceState | null>(null);
  const [sparePartsLines, setSparePartsLines] = useState<SparePartLine[]>([]);
  const [webviewVisible, setWebviewVisible] = useState(false);
  const [checkoutHtml, setCheckoutHtml] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    couponCode: string;
    discountPercent: number;
    discountAmount: number;
    originalAmount: number;
    chargeAmount: number;
    label: string;
  } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [scheduleLabel, setScheduleLabel] = useState(
    [date, time].filter(Boolean).join(' · ') || ''
  );
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [resultAlert, setResultAlert] = useState<{
    title: string;
    message: string;
    icon?: 'checkmark-circle-outline' | 'alert-circle-outline';
    onClose?: () => void;
  } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const couponOffsetY = useRef(0);

  const scrollCouponIntoView = useCallback(() => {
    const y = Math.max(0, couponOffsetY.current - 20);
    // Wait for keyboard / layout adjust before scrolling.
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: true });
    });
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y, animated: true });
    }, 280);
  }, []);

  useEffect(() => {
    if (!invoiceId) return;
    (async () => {
      const list = await paymentService.getMyInvoices();
      const inv = list.find((i) => i._id === invoiceId);
      if (inv) {
        setInvoice({
          totalAmount: inv.totalAmount,
          invoiceNumber: inv.invoiceNumber,
          serviceCharges: inv.serviceCharges,
          technicianCharges: inv.technicianCharges,
          spareParts: inv.spareParts ?? 0,
          taxAmount: inv.taxAmount,
          taxRate: inv.taxRate ?? 0.18,
          amountPaid: inv.amountPaid ?? 0,
          balanceDue: inv.balanceDue,
          paidAt: inv.paidAt,
        });
      }
      if (bookingId) {
        try {
          const b = await bookingService.getBookingById(bookingId);
          setSparePartsLines(b.spareParts ?? []);
          const formatted = formatBookingSchedule(
            b.scheduledDate,
            b.scheduledTime
          );
          if (formatted) {
            setScheduleLabel(formatted);
          } else if (date || time) {
            setScheduleLabel(
              formatBookingSchedule(String(date ?? ''), String(time ?? '')) ||
                [date, time].filter(Boolean).join(' · ')
            );
          }
        } catch {
          setSparePartsLines([]);
        }
      } else if (date || time) {
        setScheduleLabel(
          formatBookingSchedule(String(date ?? ''), String(time ?? '')) ||
            [date, time].filter(Boolean).join(' · ')
        );
      }
    })();
  }, [invoiceId, bookingId]);

  const serviceLabel = formatServiceTypeLabel(serviceType);

  // GST is always exactly 18% — never derived from a drifting invoice.taxRate
  // or from (charge − subtotal), which could round to something other than 18%.
  const GST_RATE = 0.18;
  const gstLabel = 'GST (18%)';

  const isExtraParts =
    payFor === 'extra_parts' ||
    (invoice ? isExtraPartsOnlyPayment(invoice, sparePartsLines) : false);
  const balanceDue = invoice ? getInvoiceBalanceDue(invoice) : 0;
  const sparePreTax =
    sumSparePartsTotal(sparePartsLines) || (invoice?.spareParts ?? 0);
  // Exactly 18% of the parts subtotal, rounded to the nearest rupee.
  const gstOnExtra = Math.round(sparePreTax * GST_RATE);
  const extraPartsTotal = sparePreTax + gstOnExtra;
  const baseAmountToPay = isExtraParts ? extraPartsTotal : balanceDue;
  const amountToPay = appliedCoupon
    ? appliedCoupon.chargeAmount
    : baseAmountToPay;

  const applyCoupon = () => {
    const result = applyLocalCoupon(baseAmountToPay, couponInput);
    if (!result) {
      setAppliedCoupon(null);
      setCouponError('Invalid coupon code');
      return;
    }
    if (result.chargeAmount <= 0) {
      setAppliedCoupon(null);
      setCouponError('Coupon cannot be applied to this amount');
      return;
    }
    setAppliedCoupon(result);
    setCouponError('');
    setCouponInput(result.couponCode);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponError('');
    setCouponInput('');
  };

  const handlePayment = async () => {
    if (!invoiceId) {
      Alert.alert('Error', 'No invoice found for this booking');
      return;
    }
    if (amountToPay <= 0) {
      Alert.alert('Error', 'Nothing due on this invoice');
      return;
    }
    setLoading(true);
    try {
      const couponCode = appliedCoupon
        ? normalizeCouponCode(appliedCoupon.couponCode)
        : undefined;
      const expectedPaise = Math.round(amountToPay * 100);

      const orderData = await paymentService.createOrder(
        invoiceId,
        isExtraParts ? 'extra_parts' : 'full',
        couponCode
      );

      const orderPaise = Number(orderData.order?.amount);
      // The backend is authoritative for the charge — it validates and applies
      // the coupon, and the checkout is opened with orderData.order.amount. Only
      // block if the gateway would charge MORE than we showed the user (genuine
      // overcharge, e.g. the balance grew). Charging the same or less must never
      // spuriously fail a valid coupon due to minor rounding / balance drift.
      if (
        Number.isFinite(orderPaise) &&
        Number.isFinite(expectedPaise) &&
        orderPaise > expectedPaise + 1
      ) {
        Alert.alert(
          'Amount updated',
          `The amount due is now ₹${(orderPaise / 100).toFixed(2)} (was ₹${amountToPay.toFixed(2)}). Please review the total and try the payment again.`
        );
        return;
      }

      if (couponCode && !orderData.coupon) {
        Alert.alert(
          'Coupon not applied',
          'The coupon was not applied to the payment order. Please try again.'
        );
        return;
      }

      if (orderData.demo && orderData.demoPayment) {
        await paymentService.verifyPayment({
          invoiceId,
          razorpay_order_id: orderData.demoPayment.orderId,
          razorpay_payment_id: orderData.demoPayment.paymentId,
          razorpay_signature: orderData.demoPayment.signature,
        });
        showPaymentSuccess();
        return;
      }

      const key =
        orderData.key || process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '';
      if (!key || key.includes('your_key')) {
        Alert.alert(
          'Razorpay not configured',
          'Set RAZORPAY_KEY_ID in backend .env and EXPO_PUBLIC_RAZORPAY_KEY_ID in frontend .env'
        );
        return;
      }
      setCheckoutHtml(
        razorpayHtml(
          key,
          orderData.order.id,
          orderData.order.amount,
          isExtraParts
            ? `Extra parts · ${orderData.invoice.invoiceNumber}`
            : orderData.invoice.invoiceNumber
        )
      );
      setWebviewVisible(true);
    } catch (e: any) {
      showPaymentFailed(
        formatRateLimitMessage(
          e,
          'Could not start payment. Please try again later.'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const showPaymentSuccess = () => {
    resetDraft();
    setResultAlert({
      title: 'Payment successful',
      message: isExtraParts
        ? 'Extra parts payment received. Thank you!'
        : 'Your payment is complete and your booking is confirmed.',
      icon: 'checkmark-circle-outline',
      onClose: () =>
        bookingId
          ? navigation.navigate('TrackService', { id: bookingId })
          : navigation.goBack(),
    });
  };

  const showPaymentFailed = (message?: string) => {
    setResultAlert({
      title: 'Payment unsuccessful',
      message: message || 'Payment was not completed. Please try again.',
      icon: 'alert-circle-outline',
    });
  };

  const onWebViewMessage = async (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'dismiss' || data.type === 'failed') {
        setWebviewVisible(false);
        showPaymentFailed();
        return;
      }
      if (data.type === 'success' && invoiceId) {
        setWebviewVisible(false);
        setLoading(true);
        await paymentService.verifyPayment({
          invoiceId,
          razorpay_order_id: data.razorpay_order_id,
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_signature: data.razorpay_signature,
        });
        showPaymentSuccess();
      }
    } catch (e: any) {
      setWebviewVisible(false);
      showPaymentFailed(
        e?.status === 429
          ? formatRateLimitMessage(e, 'Too many attempts. Please try again later.')
          : 'We could not verify your payment. If money was deducted, it will be reflected shortly.'
      );
    } finally {
      setLoading(false);
    }
  };

  const cancelBooking = () => {
    if (!bookingId) {
      setResultAlert({
        title: 'Unavailable',
        message: 'Could not find this booking to cancel.',
        icon: 'alert-circle-outline',
      });
      return;
    }
    setCancelConfirmOpen(true);
  };

  const confirmCancelBooking = async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      await bookingService.cancelBooking(
        bookingId,
        'Cancelled by client before payment'
      );
      if (fromBookingFlow) resetDraft();
      setCancelConfirmOpen(false);
      setResultAlert({
        title: 'Cancelled',
        message: 'Your booking has been cancelled.',
        icon: 'checkmark-circle-outline',
        onClose: () =>
          navigation.navigate('ServiceCategories', { reset: true }),
      });
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : 'Could not cancel booking';
      if (/already cancelled|cannot cancel a cancelled/i.test(msg)) {
        if (fromBookingFlow) resetDraft();
        setCancelConfirmOpen(false);
        setResultAlert({
          title: 'Cancelled',
          message: 'This booking is already cancelled.',
          icon: 'checkmark-circle-outline',
          onClose: () =>
            navigation.navigate('ServiceCategories', { reset: true }),
        });
      } else {
        setResultAlert({
          title: 'Could not cancel',
          message: msg,
          icon: 'alert-circle-outline',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        showBack
        showLogo
        onBackPress={
          fromBookingFlow ? () => navigation.goBack() : undefined
        }
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={keyboardBehavior}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
        <Text style={styles.title}>
          {isExtraParts ? 'Pay extra parts' : 'Payment'}
        </Text>
        {!isExtraParts ? (
          <View style={styles.confirmNotice}>
            <Text style={styles.confirmNoticeTitle}>Payment required</Text>
            <Text style={styles.confirmNoticeBody}>
              Complete payment to confirm your booking. Technicians are assigned
              only after payment is successful.
            </Text>
          </View>
        ) : null}
        <View style={styles.bookingCard}>
          <Text style={styles.bookingService}>{serviceLabel}</Text>
          <Text style={styles.bookingDate}>
            {scheduleLabel || 'Schedule details will appear here'}
          </Text>
        </View>
        {invoice && (
          <Card style={styles.billCard} padding={18}>
            <Text style={styles.billTitle}>
              {isExtraParts ? 'Extra parts due' : 'Bill Summary'}
            </Text>
            {isExtraParts ? (
              <>
                {sparePartsLines.length > 0 ? (
                  <View style={styles.partsBreakdown}>
                    <Text style={styles.partsBreakdownTitle}>
                      Parts added by technician
                    </Text>
                    {sparePartsLines.map((p, i) => {
                      const qty = p.quantity ?? 1;
                      const lineCost = qty * (p.unitCost ?? 0);
                      return (
                        <View key={`${p.name}-${i}`} style={styles.partItemRow}>
                          <Text style={styles.partItemName} numberOfLines={2}>
                            {p.name}
                            {qty > 1 ? ` × ${qty}` : ''}
                          </Text>
                          <Text style={styles.partItemCost}>
                            {formatINR(lineCost)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>
                    {sparePartsLines.length > 0
                      ? 'Parts subtotal'
                      : 'Extra parts (quoted)'}
                  </Text>
                  <Text style={styles.billValue}>{formatINR(sparePreTax)}</Text>
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>{gstLabel}</Text>
                  <Text style={styles.billValue}>{formatINR(gstOnExtra)}</Text>
                </View>
                {(invoice.amountPaid ?? 0) > 0 ? (
                  <Text style={styles.paidNote}>
                    Base service invoice already paid (
                    {formatINR(invoice.amountPaid ?? 0)}).
                  </Text>
                ) : null}
                <View style={[styles.billRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Amount to pay now</Text>
                  <Text style={styles.totalValue}>{formatINR(amountToPay)}</Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Service Charges</Text>
                  <Text style={styles.billValue}>
                    {formatINR(invoice.serviceCharges)}
                  </Text>
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Technician Charges</Text>
                  <Text style={styles.billValue}>
                    {formatINR(invoice.technicianCharges)}
                  </Text>
                </View>
                {invoice.spareParts > 0 ? (
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Extra parts</Text>
                    <Text style={styles.billValue}>
                      {formatINR(invoice.spareParts)}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>{gstLabel}</Text>
                  <Text style={styles.billValue}>{formatINR(invoice.taxAmount)}</Text>
                </View>
                <View style={[styles.billRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Invoice total</Text>
                  <Text style={styles.totalValue}>
                    {formatINR(invoice.totalAmount)}
                  </Text>
                </View>
                {(invoice.amountPaid ?? 0) > 0 && balanceDue > 0 ? (
                  <>
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Already paid</Text>
                      <Text style={styles.billValue}>
                        {formatINR(invoice.amountPaid ?? 0)}
                      </Text>
                    </View>
                    <View style={[styles.billRow, styles.totalRow]}>
                      <Text style={styles.totalLabel}>Amount to pay now</Text>
                      <Text style={styles.totalValue}>{formatINR(balanceDue)}</Text>
                    </View>
                  </>
                ) : null}
              </>
            )}
          </Card>
        )}

        {baseAmountToPay > 0 ? (
          <View
            onLayout={(e) => {
              couponOffsetY.current = e.nativeEvent.layout.y;
            }}
          >
            <Card style={styles.couponCard} padding={18}>
              <Text style={styles.billTitle}>Apply coupon</Text>
              {appliedCoupon ? (
                <View style={styles.couponAppliedBox}>
                  <View style={styles.couponAppliedTextWrap}>
                    <Text style={styles.couponAppliedCode}>
                      {appliedCoupon.couponCode} applied
                    </Text>
                    <Text style={styles.couponAppliedLabel}>
                      {appliedCoupon.label} · save{' '}
                      {formatINR(appliedCoupon.discountAmount)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={removeCoupon} hitSlop={10}>
                    <Text style={styles.couponRemove}>REMOVE</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.couponRow}>
                    <View style={styles.couponInputWrap}>
                      <Input
                        placeholder="Enter coupon code"
                        value={couponInput}
                        onChangeText={(text) => {
                          setCouponInput(text);
                          if (couponError) setCouponError('');
                        }}
                        autoCapitalize="characters"
                        error={couponError || undefined}
                        onFocus={scrollCouponIntoView}
                      />
                    </View>
                    <Button
                      label="APPLY"
                      variant="outline"
                      onPress={applyCoupon}
                      fullWidth={false}
                      style={styles.couponApplyBtn}
                    />
                  </View>
                </>
              )}
              {appliedCoupon ? (
                <>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Subtotal</Text>
                    <Text style={styles.billValue}>
                      {formatINR(appliedCoupon.originalAmount)}
                    </Text>
                  </View>
                  <View style={styles.billRow}>
                    <Text style={styles.discountLabel}>
                      Discount ({appliedCoupon.discountPercent}%)
                    </Text>
                    <Text style={styles.discountValue}>
                      −{formatINR(appliedCoupon.discountAmount)}
                    </Text>
                  </View>
                  <View style={[styles.billRow, styles.totalRow]}>
                    <Text style={styles.totalLabel}>Amount to pay now</Text>
                    <Text style={styles.totalValue}>
                      {formatINR(appliedCoupon.chargeAmount)}
                    </Text>
                  </View>
                </>
              ) : null}
            </Card>
          </View>
        ) : null}
        </ScrollView>
        <View style={styles.footer}>
          <Button
            label={
              process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID?.includes('your_key')
                ? `CONFIRM DEMO · ${formatINR(amountToPay)}`
                : isExtraParts
                  ? `PAY EXTRA PARTS · ${formatINR(amountToPay)}`
                  : `PAY NOW · ${formatINR(amountToPay)}`
            }
            onPress={handlePayment}
            loading={loading}
          />
          {!isExtraParts && bookingId ? (
            <Button
              label="CANCEL BOOKING"
              variant="outline"
              onPress={cancelBooking}
              disabled={loading}
              style={styles.cancelBtn}
            />
          ) : null}
        </View>
      </KeyboardAvoidingView>
      <Modal visible={webviewVisible} animationType="slide">
        <View style={styles.webviewWrap}>
          <WebView
            source={{ html: checkoutHtml }}
            onMessage={onWebViewMessage}
            style={{ flex: 1 }}
          />
          {loading && (
            <ActivityIndicator
              style={StyleSheet.absoluteFill}
              color={COLORS.red}
            />
          )}
        </View>
      </Modal>

      <ThemedConfirmModal
        visible={cancelConfirmOpen}
        title="Cancel booking?"
        message="Cancel this booking before payment? This cannot be undone."
        confirmLabel="CANCEL BOOKING"
        cancelLabel="KEEP"
        confirmDestructive
        loading={loading}
        icon="close-circle-outline"
        onConfirm={confirmCancelBooking}
        onCancel={() => {
          if (!loading) setCancelConfirmOpen(false);
        }}
      />

      <ThemedAlertModal
        visible={!!resultAlert}
        title={resultAlert?.title ?? ''}
        message={resultAlert?.message ?? ''}
        icon={resultAlert?.icon}
        onClose={() => {
          const next = resultAlert?.onClose;
          setResultAlert(null);
          next?.();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 32 },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 24,
    color: COLORS.white,
    marginBottom: 20,
  },
  confirmNotice: {
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(142,48,47,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(142,48,47,0.45)',
  },
  confirmNoticeTitle: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: COLORS.red,
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  confirmNoticeBody: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.white,
  },
  bookingCard: {
    marginBottom: 16,
    padding: 18,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  bookingService: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 16,
    lineHeight: 28,
    color: COLORS.white,
    includeFontPadding: true,
  },
  bookingDate: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    lineHeight: 22,
    color: COLORS.gray,
    marginTop: 8,
    includeFontPadding: true,
  },
  billCard: { marginBottom: 16, overflow: 'visible' },
  couponCard: { marginBottom: 16 },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  couponInputWrap: {
    flex: 1,
    minWidth: 0,
  },
  couponApplyBtn: {
    marginTop: 4,
    minWidth: 88,
    height: 48,
  },
  couponAppliedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(178, 190, 181, 0.35)',
    backgroundColor: 'rgba(178, 190, 181, 0.08)',
  },
  couponAppliedTextWrap: { flex: 1, minWidth: 0 },
  couponAppliedCode: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 13,
    color: COLORS.ashGray,
  },
  couponAppliedLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
  },
  couponRemove: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    color: COLORS.red,
    letterSpacing: 0.8,
  },
  discountLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.ashGray,
  },
  discountValue: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: COLORS.ashGray,
  },
  billTitle: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.white,
    marginBottom: 16,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  partsBreakdown: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  partsBreakdownTitle: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    color: COLORS.red,
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  partItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  partItemName: {
    flex: 1,
    flexShrink: 1,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 17,
  },
  partItemCost: {
    flexShrink: 0,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12,
    color: COLORS.white,
    textAlign: 'right',
  },
  billLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
  },
  billValue: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 13,
    color: COLORS.white,
  },
  paidNote: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: COLORS.grayDark,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  totalLabel: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 15,
    color: COLORS.white,
  },
  totalValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: COLORS.red,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    backgroundColor: COLORS.background,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  cancelBtn: {
    marginTop: 0,
  },
  webviewWrap: { flex: 1, backgroundColor: COLORS.background },
});
