import Razorpay from 'razorpay';
import crypto from 'crypto';

const PLACEHOLDER_KEY = 'rzp_test_your_key_here';
const PLACEHOLDER_SECRET = 'your_razorpay_secret_here';

let client: Razorpay | null = null;

export function isRazorpayConfigured(): boolean {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  return Boolean(
    keyId &&
      keySecret &&
      keyId !== PLACEHOLDER_KEY &&
      keySecret !== PLACEHOLDER_SECRET
  );
}

function getClient(): Razorpay {
  if (!isRazorpayConfigured()) {
    throw new Error(
      'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env, or use demo payment mode.'
    );
  }

  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!.trim(),
      key_secret: process.env.RAZORPAY_KEY_SECRET!.trim(),
    });
  }

  return client;
}

export const createOrder = async (
  amount: number,
  currency = 'INR',
  receipt: string,
  notes?: Record<string, string>
) => {
  const razorpay = getClient();
  const uniqueReceipt = `${receipt.slice(0, 24)}_${Date.now()}`.slice(0, 40);
  return razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency,
    receipt: uniqueReceipt,
    payment_capture: true,
    ...(notes && Object.keys(notes).length > 0 ? { notes } : {}),
  });
};

export function isRazorpayAuthError(err: unknown): boolean {
  const e = err as {
    statusCode?: number;
    error?: { code?: string; description?: string };
    message?: string;
  };
  return (
    e?.statusCode === 401 ||
    e?.error?.code === 'BAD_REQUEST_ERROR' ||
    e?.error?.description?.includes('Authentication failed') === true ||
    e?.message?.includes('Authentication failed') === true
  );
}

export const verifyPaymentSignature = (
  orderId: string,
  paymentId: string,
  signature: string
): boolean => {
  if (!isRazorpayConfigured()) return false;

  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!.trim())
    .update(body)
    .digest('hex');
  return expectedSignature === signature;
};

export function createDemoPaymentIds(invoiceId: string) {
  const suffix = Date.now();
  return {
    orderId: `demo_order_${invoiceId}_${suffix}`,
    paymentId: `demo_pay_${invoiceId}_${suffix}`,
    signature: `demo_sig_${invoiceId}_${suffix}`,
  };
}

type DemoPaymentRequest = {
  ip?: string;
  socket?: { remoteAddress?: string };
};

function isLocalRequest(req?: DemoPaymentRequest): boolean {
  if (!req) return false;
  const ip = req.ip || req.socket?.remoteAddress || '';
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.endsWith('127.0.0.1')
  );
}

/** Demo payments: localhost by default, or set ALLOW_DEMO_PAYMENTS=true for LAN dev. */
export function isDemoPaymentAllowed(req?: DemoPaymentRequest): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  const hostOk =
    process.env.ALLOW_DEMO_PAYMENTS === 'true' || isLocalRequest(req);
  if (!hostOk) return false;
  if (process.env.RAZORPAY_FORCE_DEMO === 'true') return true;
  return !isRazorpayConfigured();
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch {
    return false;
  }
}
