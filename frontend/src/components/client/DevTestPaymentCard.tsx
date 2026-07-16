/**
 * DISABLED — ₹1 dev test payment UI (not mounted on HomeScreen).
 * To re-enable: uncomment DevTestPaymentCard in HomeScreen.tsx + createDevTestOrder in payments.ts.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { paymentService } from '../../services/payments';
import { COLORS } from '../../constants/colors';

const escapeJsString = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

const razorpayHtml = (key: string, orderId: string, amount: number) => `
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
    description: "Dev test payment (₹1)",
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

interface Props {
  onPaymentSuccess?: () => void;
}

/** Temporary dev-only ₹1 live payment test — remove after QA. */
export const DevTestPaymentCard: React.FC<Props> = ({ onPaymentSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [webviewVisible, setWebviewVisible] = useState(false);
  const [checkoutHtml, setCheckoutHtml] = useState('');
  const [invoiceId, setInvoiceId] = useState('');

  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return null;
  }

  const handlePay = async () => {
    setLoading(true);
    try {
      const orderData = await paymentService.createDevTestOrder();
      const key =
        orderData.key || process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '';
      if (!key || key.includes('your_key')) {
        Alert.alert(
          'Razorpay not configured',
          'Set live Razorpay keys on the backend (and EXPO_PUBLIC_RAZORPAY_KEY_ID locally if needed).'
        );
        return;
      }
      setInvoiceId(orderData.invoiceId);
      setCheckoutHtml(
        razorpayHtml(key, orderData.order.id, orderData.order.amount)
      );
      setWebviewVisible(true);
    } catch (e: any) {
      Alert.alert('Could not start test payment', e.message || 'Try again');
    } finally {
      setLoading(false);
    }
  };

  const onWebViewMessage = async (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'dismiss' || data.type === 'failed') {
        setWebviewVisible(false);
        if (data.type === 'failed') {
          Alert.alert('Payment Failed', 'Please try again');
        }
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
          'Test payment successful',
          '₹1 live Razorpay payment verified. You can refund it from the Razorpay dashboard.'
        );
        onPaymentSuccess?.();
      }
    } catch (e: any) {
      Alert.alert('Verification failed', e.message || 'Could not verify payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card style={styles.card} padding={16}>
        <View style={styles.badgeRow}>
          <Text style={styles.badge}>DEV ONLY</Text>
        </View>
        <Text style={styles.title}>₹1 live payment test</Text>
        <Text style={styles.subtitle}>
          Temporary button for testing real Razorpay payments locally. Remove
          before production release.
        </Text>
        <Button
          label="PAY ₹1 (TEST)"
          onPress={handlePay}
          loading={loading}
          disabled={loading}
          style={styles.btn}
        />
      </Card>

      <Modal visible={webviewVisible} animationType="slide">
        <View style={styles.webviewWrap}>
          {checkoutHtml ? (
            <WebView
              source={{ html: checkoutHtml }}
              onMessage={onWebViewMessage}
              javaScriptEnabled
              originWhitelist={['*']}
            />
          ) : (
            <ActivityIndicator color={COLORS.red} size="large" />
          )}
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 20,
    borderColor: 'rgba(255, 193, 7, 0.35)',
    borderWidth: 1,
  },
  badgeRow: {
    marginBottom: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    fontFamily: 'Montserrat_700Bold',
    fontSize: 10,
    color: '#ffc107',
    letterSpacing: 1,
  },
  title: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 15,
    color: COLORS.white,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
    marginBottom: 14,
  },
  btn: {
    minHeight: 44,
  },
  webviewWrap: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});
