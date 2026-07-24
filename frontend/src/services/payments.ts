import api from './api';

export type InvoicePaymentType = 'base_service' | 'extra_parts' | 'full';

export interface InvoicePaymentEntry {
  amount: number;
  type: InvoicePaymentType;
  paidAt: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  bookingId: {
    _id: string;
    bookingId: string;
    serviceType: string;
    scheduledDate: string;
    scheduledTime?: string;
    status?: string;
    spareParts?: { name: string; quantity: number; unitCost: number }[];
  } | string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  serviceCharges: number;
  technicianCharges: number;
  spareParts: number;
  taxRate?: number;
  taxAmount: number;
  totalAmount: number;
  couponCode?: string;
  discountPercent?: number;
  discountAmount?: number;
  amountPaid?: number;
  balanceDue?: number;
  amountReceived?: number;
  dueDate: string;
  paidAt?: string;
  paymentHistory?: InvoicePaymentEntry[];
}

export interface PaymentHistoryRow {
  key: string;
  amount: number;
  type: InvoicePaymentType;
  paidAt: string;
  invoiceNumber: string;
  serviceType?: string;
  bookingRef?: string;
  bookingMongoId?: string;
  quotedTotal?: number;
  discountAmount?: number;
  couponCode?: string;
}

export function flattenPaymentHistory(invoices: Invoice[]): PaymentHistoryRow[] {
  const rows: PaymentHistoryRow[] = [];

  for (const inv of invoices) {
    const booking =
      typeof inv.bookingId === 'object' ? inv.bookingId : null;
    const history = inv.paymentHistory ?? [];
    const discountAmount = Math.max(0, Number(inv.discountAmount) || 0);

    history.forEach((entry, idx) => {
      const amount = Number(entry?.amount);
      if (!Number.isFinite(amount) || amount <= 0) return;
      const paidAt = entry?.paidAt
        ? String(entry.paidAt)
        : new Date().toISOString();
      const type =
        entry?.type === 'extra_parts' ||
        entry?.type === 'base_service' ||
        entry?.type === 'full'
          ? entry.type
          : 'full';
      rows.push({
        key: `${inv._id}-${idx}-${paidAt}-${amount}`,
        amount,
        type,
        paidAt,
        invoiceNumber: inv.invoiceNumber,
        serviceType: booking?.serviceType,
        bookingRef: booking?.bookingId,
        bookingMongoId: booking?._id,
        quotedTotal: inv.totalAmount,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        couponCode: inv.couponCode,
      });
    });
  }

  return rows.sort(
    (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
  );
}

export function formatPaymentAmount(amount: number | undefined | null): string {
  return (Number(amount) || 0).toLocaleString('en-IN');
}

export function paymentHistoryTypeLabel(type?: InvoicePaymentType): string {
  switch (type) {
    case 'extra_parts':
      return 'EXTRA PARTS';
    case 'base_service':
      return 'SERVICE';
    default:
      return 'INVOICE';
  }
}

export const paymentService = {
  async getMyInvoices(status?: string) {
    const res = (await api.get('/payments/invoices', {
      params: status ? { status } : undefined,
    })) as { invoices: Invoice[] };
    return res.invoices ?? [];
  },

  async createOrder(
    invoiceId: string,
    payFor?: 'full' | 'extra_parts',
    couponCode?: string
  ) {
    const code = String(couponCode ?? '').trim();
    return api.post('/payments/create-order', {
      invoiceId,
      payFor,
      ...(code ? { couponCode: code } : {}),
    }) as Promise<{
      demo?: boolean;
      order: { id: string; amount: number; currency: string };
      invoice: { invoiceNumber: string; totalAmount: number; balanceDue?: number };
      coupon?: {
        couponCode: string;
        discountPercent: number;
        discountAmount: number;
        originalAmount: number;
        label: string;
      } | null;
      key: string;
      demoPayment?: {
        orderId: string;
        paymentId: string;
        signature: string;
      };
      message?: string;
    }>;
  },

  // ₹1 dev test payment — TEMPORARY (remove after QA).
  async createDevTestOrder() {
    return api.post('/payments/dev-test-order') as Promise<{
      devTest: true;
      invoiceId: string;
      bookingId: string;
      order: { id: string; amount: number; currency: string };
      invoice: { invoiceNumber: string; totalAmount: number; balanceDue: number };
      key: string;
    }>;
  },

  async verifyPayment(payload: {
    invoiceId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) {
    return api.post('/payments/verify', payload);
  },
};
