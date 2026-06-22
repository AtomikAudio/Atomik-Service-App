import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Header } from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { paymentService } from '../../services/payments';
import { bookingService } from '../../services/bookings';
import { SparePartLine } from '../../utils/spareParts';
import {
  getClientSparePartsPayAmount,
  getInvoiceBalanceDue,
  getExtraPartsGstAmount,
  isExtraPartsOnlyPayment,
} from '../../utils/invoice';
import { sumSparePartsTotal } from '../../utils/sparePartsCalc';
import { COLORS } from '../../constants/colors';

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
  const { invoiceId, bookingId, serviceType, date, time, payFor } = route.params || {};
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceState | null>(null);
  const [sparePartsLines, setSparePartsLines] = useState<SparePartLine[]>([]);
  const [webviewVisible, setWebviewVisible] = useState(false);
  const [checkoutHtml, setCheckoutHtml] = useState('');

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
        } catch {
          setSparePartsLines([]);
        }
      }
    })();
  }, [invoiceId, bookingId]);

  const serviceLabel =
    {
      general: 'General Service',
      inspection: 'Inspection',
      installation: 'Installation',
      emergency: 'Emergency Visit',
    }[serviceType as string] ?? 'Service';

  const isExtraParts =
    payFor === 'extra_parts' ||
    (invoice ? isExtraPartsOnlyPayment(invoice, sparePartsLines) : false);
  const balanceDue = invoice ? getInvoiceBalanceDue(invoice) : 0;
  const amountToPay = isExtraParts
    ? getClientSparePartsPayAmount(invoice, sparePartsLines)
    : balanceDue;
  const sparePreTax = sumSparePartsTotal(sparePartsLines) || (invoice?.spareParts ?? 0);
  const gstOnExtra = invoice
    ? getExtraPartsGstAmount(invoice, sparePartsLines, invoice.taxRate)
    : 0;
  const gstLabel = `GST (${Math.round((invoice?.taxRate ?? 0.18) * 100)}%)`;

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
      const orderData = await paymentService.createOrder(
        invoiceId,
        isExtraParts ? 'extra_parts' : 'full'
      );

      if (orderData.demo && orderData.demoPayment) {
        await paymentService.verifyPayment({
          invoiceId,
          razorpay_order_id: orderData.demoPayment.orderId,
          razorpay_payment_id: orderData.demoPayment.paymentId,
          razorpay_signature: orderData.demoPayment.signature,
        });
        Alert.alert(
          'Payment Successful',
          isExtraParts
            ? 'Extra parts payment received. Thank you!'
            : 'Demo payment completed. Your booking is confirmed.',
          [
            {
              text: 'Track Service',
              onPress: () =>
                navigation.navigate('TrackService', { id: bookingId }),
            },
          ]
        );
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
      Alert.alert('Payment Failed', e.message || 'Could not start payment');
    } finally {
      setLoading(false);
    }
  };

  const onWebViewMessage = async (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'dismiss' || data.type === 'failed') {
        setWebviewVisible(false);
        if (data.type === 'failed') Alert.alert('Payment Failed', 'Please try again');
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
        Alert.alert(
          'Payment Successful',
          isExtraParts
            ? 'Extra parts payment received. Thank you!'
            : 'Your booking is confirmed.',
          [
            {
              text: 'Track Service',
              onPress: () =>
                navigation.navigate('TrackService', { id: bookingId }),
            },
          ]
        );
      }
    } catch (e: any) {
      Alert.alert('Verification failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header showBack showLogo />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>
          {isExtraParts ? 'Pay extra parts' : 'Payment'}
        </Text>
        <Card style={styles.bookingCard} padding={18}>
          <Text style={styles.bookingService}>{serviceLabel}</Text>
          <Text style={styles.bookingDate}>
            {date || '—'} • {time || '—'}
          </Text>
        </Card>
        {invoice && (
          <Card style={styles.billCard} padding={18}>
            <Text style={styles.billTitle}>
              {isExtraParts ? 'Extra parts due' : 'Bill Summary'}
            </Text>
            {isExtraParts ? (
              <>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Extra parts (quoted)</Text>
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
      </View>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 24, paddingBottom: 120 },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 24,
    color: COLORS.white,
    marginBottom: 20,
  },
  bookingCard: { marginBottom: 16 },
  bookingService: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 16,
    color: COLORS.white,
  },
  bookingDate: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 8,
  },
  billCard: { marginBottom: 16 },
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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 36,
    backgroundColor: COLORS.background,
  },
  webviewWrap: { flex: 1, backgroundColor: COLORS.background },
});
