import { Response, NextFunction } from 'express';
import { Invoice } from '../models/Invoice';
import { Booking } from '../models/Booking';
import { AuthRequest } from '../middleware/auth';
import {
  createOrder,
  verifyPaymentSignature,
  isRazorpayConfigured,
  createDemoPaymentIds,
  isDemoPaymentAllowed,
  isRazorpayAuthError,
} from '../utils/razorpay';
import { parseInvoiceStatus } from '../utils/mongoQuery';
import { settleInvoicePayment } from '../services/paymentSettlement';
import {
  getExtraPartsChargeAmount,
  getInvoiceBalanceDue,
  getInvoiceCashReceived,
  shouldPayExtraPartsOnly,
  ensureInvoiceReflectsBookingSpareParts,
  buildPaymentHistoryForClient,
} from '../utils/bookingPayment';
import { applyCouponToAmount, resolveCoupon } from '../utils/coupons';
import { RazorpayWebhookRequest } from '../middleware/razorpayWebhook';
// ₹1 dev test payment — TEMPORARY (remove after QA).
import {
  ensureDevTestInvoice,
  isDevTestPaymentAllowed,
} from '../services/devTestPayment';

export const createPaymentOrder = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (process.env.NODE_ENV === 'production' && !isRazorpayConfigured()) {
      res.status(503).json({ success: false, message: 'Payments are temporarily unavailable' });
      return;
    }

    const { invoiceId, payFor, couponCode } = req.body as {
      invoiceId: string;
      payFor?: 'full' | 'extra_parts';
      couponCode?: string;
    };
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      res.status(404).json({ success: false, message: 'Invoice not found' });
      return;
    }

    if (invoice.clientId.toString() !== req.user!.id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const booking = await Booking.findById(invoice.bookingId).select('spareParts');
    const spareLines = booking?.spareParts as
      | { name?: string; quantity?: number; unitCost?: number }[]
      | undefined;

    const balanceDue = getInvoiceBalanceDue(invoice);
    if (balanceDue <= 0) {
      res.status(400).json({ success: false, message: 'Invoice already paid' });
      return;
    }

    const extraCharge = getExtraPartsChargeAmount(invoice, spareLines);
    let chargeAmount =
      payFor === 'extra_parts' ? extraCharge : balanceDue;

    if (payFor === 'extra_parts') {
      if (!shouldPayExtraPartsOnly(invoice, spareLines) || chargeAmount <= 0) {
        res.status(400).json({
          success: false,
          message:
            'Extra-parts-only payment applies after the base invoice is paid. Pay the full balance instead.',
        });
        return;
      }
    }

    if (chargeAmount <= 0) {
      res.status(400).json({ success: false, message: 'Nothing due on this invoice' });
      return;
    }

    let couponPayload: {
      couponCode: string;
      discountPercent: number;
      discountAmount: number;
      originalAmount: number;
      label: string;
    } | null = null;

    const trimmedCoupon = String(couponCode ?? '').trim();
    if (trimmedCoupon) {
      if (!resolveCoupon(trimmedCoupon)) {
        res.status(400).json({
          success: false,
          message: 'Invalid coupon code',
        });
        return;
      }
      const applied = applyCouponToAmount(chargeAmount, trimmedCoupon);
      if (!applied || applied.chargeAmount <= 0) {
        res.status(400).json({
          success: false,
          message: 'Coupon could not be applied to this amount',
        });
        return;
      }
      couponPayload = {
        couponCode: applied.couponCode,
        discountPercent: applied.discountPercent,
        discountAmount: applied.discountAmount,
        originalAmount: applied.originalAmount,
        label: applied.label,
      };
      chargeAmount = applied.chargeAmount;

      // Persist coupon on the invoice before creating the Razorpay order so
      // checkout and settlement always see the discounted charge.
      await Invoice.findByIdAndUpdate(invoiceId, {
        couponCode: couponPayload.couponCode,
        discountPercent: couponPayload.discountPercent,
        discountAmount: couponPayload.discountAmount,
      });
    } else {
      await Invoice.findByIdAndUpdate(invoiceId, {
        $unset: {
          couponCode: 1,
          discountPercent: 1,
          discountAmount: 1,
        },
      });
    }

    const respondDemoOrder = async (note: string) => {
      const demo = createDemoPaymentIds(String(invoice._id));
      await Invoice.findByIdAndUpdate(invoiceId, {
        razorpayOrderId: demo.orderId,
      });

      res.status(200).json({
        success: true,
        demo: true,
        message: note,
        order: {
          id: demo.orderId,
          amount: Math.round(chargeAmount * 100),
          currency: 'INR',
        },
        invoice: {
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: invoice.totalAmount,
          balanceDue: chargeAmount,
          spareParts: invoice.spareParts ?? 0,
        },
        coupon: couponPayload,
        key: 'demo',
        demoPayment: demo,
      });
    };

    if (isDemoPaymentAllowed(req)) {
      await respondDemoOrder(
        'Demo payment mode — Razorpay keys not configured or RAZORPAY_FORCE_DEMO=true'
      );
      return;
    }

    try {
      const order = await createOrder(
        chargeAmount,
        'INR',
        invoice.invoiceNumber,
        couponPayload
          ? {
              coupon: String(couponPayload.couponCode),
              discount_percent: String(couponPayload.discountPercent),
              discount_amount: String(couponPayload.discountAmount),
              original_amount: String(couponPayload.originalAmount),
            }
          : undefined
      );

      await Invoice.findByIdAndUpdate(invoiceId, {
        razorpayOrderId: order.id,
      });

      res.status(200).json({
        success: true,
        demo: false,
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
        },
        invoice: {
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: invoice.totalAmount,
          balanceDue: chargeAmount,
          spareParts: invoice.spareParts ?? 0,
        },
        coupon: couponPayload,
        key: process.env.RAZORPAY_KEY_ID,
      });
    } catch (err) {
      if (process.env.NODE_ENV !== 'production' && isRazorpayAuthError(err)) {
        console.warn(
          '[payments] Razorpay authentication failed — falling back to demo payment in development'
        );
        await respondDemoOrder(
          'Demo payment mode — Razorpay test keys invalid. Update backend/.env with keys from dashboard.razorpay.com'
        );
        return;
      }
      next(err);
    }
  } catch (err) {
    next(err);
  }
};

// ₹1 dev test payment — TEMPORARY (remove after QA).
export const createDevTestPaymentOrder = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!isDevTestPaymentAllowed()) {
      res.status(404).json({ success: false, message: 'Not found' });
      return;
    }

    if (!isRazorpayConfigured()) {
      res.status(503).json({
        success: false,
        message: 'Razorpay keys not configured on the server',
      });
      return;
    }

    const { invoice, booking } = await ensureDevTestInvoice(req.user!.id);
    const chargeAmount = getInvoiceBalanceDue(invoice);
    if (chargeAmount <= 0) {
      res.status(400).json({ success: false, message: 'Dev test invoice already paid' });
      return;
    }

    const order = await createOrder(chargeAmount, 'INR', invoice.invoiceNumber);
    await Invoice.findByIdAndUpdate(invoice._id, { razorpayOrderId: order.id });

    res.status(200).json({
      success: true,
      devTest: true,
      invoiceId: String(invoice._id),
      bookingId: String(booking._id),
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: invoice.totalAmount,
        balanceDue: chargeAmount,
      },
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    next(err);
  }
};

export const verifyPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { invoiceId, razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const orderId = String(razorpay_order_id);
    const paymentId = String(razorpay_payment_id);

    const isDemoPayment =
      orderId.startsWith('demo_order_') || paymentId.startsWith('demo_pay_');

    if (isDemoPayment) {
      if (!isDemoPaymentAllowed(req)) {
        res.status(403).json({ success: false, message: 'Demo payments are not allowed' });
        return;
      }

      const invoice = await settleInvoicePayment({
        invoiceId: String(invoiceId),
        clientId: req.user!.id,
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        updatedByUserId: req.user!.id,
      });

      if (!invoice) {
        res.status(400).json({
          success: false,
          message: 'Invoice not found, already paid, or order mismatch',
        });
        return;
      }

      res.status(200).json({ success: true, message: 'Demo payment verified', invoice });
      return;
    }

    const isValid = verifyPaymentSignature(orderId, paymentId, String(razorpay_signature));
    if (!isValid) {
      res.status(400).json({ success: false, message: 'Payment verification failed' });
      return;
    }

    const invoice = await settleInvoicePayment({
      invoiceId: String(invoiceId),
      clientId: req.user!.id,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      updatedByUserId: req.user!.id,
    });

    if (!invoice) {
      // The Razorpay webhook may have settled this payment first (race condition).
      // Treat an already-paid invoice for the same order/payment as success so the
      // app does not show a false "verification failed" after a successful payment.
      const alreadyPaid = await Invoice.findOne({
        _id: String(invoiceId),
        clientId: req.user!.id,
        status: 'paid',
        $or: [
          { razorpayOrderId: orderId },
          { 'paymentHistory.razorpayPaymentId': paymentId },
        ],
      });

      if (alreadyPaid) {
        res
          .status(200)
          .json({ success: true, message: 'Payment verified', invoice: alreadyPaid });
        return;
      }

      res.status(400).json({
        success: false,
        message: 'Invoice not found, already paid, or order mismatch',
      });
      return;
    }

    res.status(200).json({ success: true, message: 'Payment verified', invoice });
  } catch (err) {
    next(err);
  }
};

export const razorpayWebhook = async (
  req: RazorpayWebhookRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const body = req.webhookBody as {
      event?: string;
      payload?: { payment?: { entity?: { order_id?: string; id?: string; amount?: number } } };
    };

    const event = body?.event;
    const payment = body?.payload?.payment?.entity;

    if (event !== 'payment.captured' || !payment?.order_id || !payment?.id) {
      res.status(200).json({ received: true });
      return;
    }

    const existing = await Invoice.findOne({ razorpayOrderId: payment.order_id });
    if (!existing) {
      res.status(200).json({ received: true });
      return;
    }

    if (payment.amount != null) {
      const spareBooking = await Booking.findById(existing.bookingId).select(
        'spareParts'
      );
      const balanceDue = getInvoiceBalanceDue(existing);
      const extraCharge = getExtraPartsChargeAmount(
        existing,
        spareBooking?.spareParts as { name?: string; quantity?: number; unitCost?: number }[]
      );
      let expectedAmount =
        extraCharge > 0 && extraCharge < balanceDue ? extraCharge : balanceDue;
      if (existing.couponCode) {
        const applied = applyCouponToAmount(expectedAmount, existing.couponCode);
        if (applied) expectedAmount = applied.chargeAmount;
      }
      const expectedPaise = Math.round(expectedAmount * 100);
      if (payment.amount !== expectedPaise) {
        console.error(
          `[webhook] Amount mismatch for order ${payment.order_id}: expected ${expectedPaise}, got ${payment.amount}`
        );
        res.status(200).json({ received: true });
        return;
      }
    }

    await settleInvoicePayment({
      invoiceId: existing._id.toString(),
      razorpayOrderId: payment.order_id,
      razorpayPaymentId: payment.id,
    });

    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
};

export const getMyInvoices = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const status = parseInvoiceStatus(req.query.status);
    const filter: Record<string, unknown> = { clientId: req.user!.id };
    if (status) filter.status = status;

    const invoices = await Invoice.find(filter)
      .populate(
        'bookingId',
        'bookingId serviceType scheduledDate scheduledTime spareParts status'
      )
      .sort({ createdAt: -1 });

    for (const inv of invoices) {
      const booking = inv.bookingId as {
        _id?: unknown;
        spareParts?: { name?: string; quantity?: number; unitCost?: number }[];
      } | null;
      const lines = booking?.spareParts;
      if (!lines?.length || !booking?._id) continue;
      await ensureInvoiceReflectsBookingSpareParts(String(booking._id), lines);
    }

    const refreshed =
      invoices.length > 0
        ? await Invoice.find({ _id: { $in: invoices.map((i) => i._id) } })
            .populate(
              'bookingId',
              'bookingId serviceType scheduledDate scheduledTime spareParts status'
            )
            .sort({ createdAt: -1 })
        : [];

    // Heal stale rows: booking cancelled but invoice still pending/overdue.
    const staleIds = refreshed
      .filter((inv) => {
        if (!['pending', 'overdue'].includes(inv.status)) return false;
        const booking = inv.bookingId as { status?: string } | null;
        return (
          booking &&
          typeof booking === 'object' &&
          booking.status === 'cancelled'
        );
      })
      .map((inv) => inv._id);

    if (staleIds.length > 0) {
      await Invoice.updateMany(
        { _id: { $in: staleIds } },
        { $set: { status: 'cancelled' } }
      );
    }

    const serialized = refreshed
      .filter((inv) => {
        if (staleIds.some((id) => String(id) === String(inv._id))) return false;
        if (inv.status === 'cancelled') return false;
        const booking = inv.bookingId as { status?: string } | null;
        if (booking && typeof booking === 'object' && booking.status === 'cancelled') {
          return false;
        }
        return true;
      })
      .map((inv) => {
      const obj = inv.toObject();
      let amountPaid = obj.amountPaid ?? 0;
      if (obj.status === 'paid' && amountPaid === 0) {
        amountPaid = obj.totalAmount ?? 0;
      }
      const balanceDue = getInvoiceBalanceDue({ ...obj, amountPaid });
      const paymentHistory = buildPaymentHistoryForClient({ ...obj, amountPaid }).map(
        (entry) => ({
          amount: Number(entry.amount) || 0,
          type: entry.type,
          paidAt: entry.paidAt,
          razorpayOrderId: entry.razorpayOrderId,
          razorpayPaymentId: entry.razorpayPaymentId,
        })
      );
      const amountReceived = getInvoiceCashReceived({
        ...obj,
        amountPaid,
        paymentHistory,
      });
      return {
        ...obj,
        amountPaid,
        balanceDue,
        amountReceived,
        discountAmount: Math.max(0, obj.discountAmount ?? 0),
        discountPercent: obj.discountPercent ?? 0,
        couponCode: obj.couponCode || undefined,
        paymentHistory,
      };
    });

    res.status(200).json({ success: true, invoices: serialized });
  } catch (err) {
    next(err);
  }
};
