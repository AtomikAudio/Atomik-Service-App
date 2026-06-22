import { verifyWebhookSignature, isDemoPaymentAllowed } from '../utils/razorpay';
import { settleInvoicePayment } from '../services/paymentSettlement';
import crypto from 'crypto';

jest.mock('../models/Invoice', () => ({
  Invoice: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.mock('../models/Booking', () => ({
  Booking: { findByIdAndUpdate: jest.fn() },
}));

jest.mock('../models/Notification', () => ({
  Notification: { create: jest.fn() },
}));

jest.mock('../models/User', () => ({
  User: { findById: jest.fn(() => ({ select: jest.fn() })) },
}));

jest.mock('../utils/notifyUsers', () => ({
  notifyByRoles: jest.fn(),
}));

describe('razorpay webhook signature verification', () => {
  test('returns false when secret missing', () => {
    const prev = process.env.RAZORPAY_WEBHOOK_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    expect(verifyWebhookSignature('{"a":1}', 'sig')).toBe(false);
    process.env.RAZORPAY_WEBHOOK_SECRET = prev;
  });

  test('returns true for valid signature', () => {
    const prev = process.env.RAZORPAY_WEBHOOK_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test_secret';

    const body = '{"a":1}';
    const signature = crypto
      .createHmac('sha256', 'test_secret')
      .update(body)
      .digest('hex');

    expect(
      verifyWebhookSignature(body, signature)
    ).toBe(true);

    process.env.RAZORPAY_WEBHOOK_SECRET = prev;
  });
});

describe('demo payments', () => {
  test('demo payments are never allowed in production', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    expect(isDemoPaymentAllowed()).toBe(false);
    process.env.NODE_ENV = prevEnv;
  });
});

describe('settleInvoicePayment', () => {
  test('returns null when atomic update finds nothing', async () => {
    const { Invoice } = await import('../models/Invoice');
    (Invoice.findOne as jest.Mock).mockResolvedValueOnce(null);

    const result = await settleInvoicePayment({
      invoiceId: '507f191e810c19729de860ea',
      clientId: '507f191e810c19729de860eb',
      razorpayOrderId: 'order_123',
      razorpayPaymentId: 'pay_123',
      updatedByUserId: '507f191e810c19729de860eb',
    });

    expect(result).toBeNull();
  });
});

