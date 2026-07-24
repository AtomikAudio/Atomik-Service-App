import { BookingInvoice } from '../services/bookings';
import { Invoice } from '../services/payments';

/** Map payments-list invoice → booking bill shape. */
export function toBookingInvoice(inv: Invoice): BookingInvoice {
  return {
    _id: inv._id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    serviceCharges: inv.serviceCharges,
    technicianCharges: inv.technicianCharges,
    spareParts: inv.spareParts,
    taxRate: inv.taxRate ?? 0.18,
    taxAmount: inv.taxAmount,
    totalAmount: inv.totalAmount,
    couponCode: inv.couponCode,
    discountPercent: inv.discountPercent,
    discountAmount: inv.discountAmount,
    amountPaid: inv.amountPaid,
    balanceDue: inv.balanceDue,
    amountReceived: inv.amountReceived,
    paidAt: inv.paidAt,
    paymentHistory: inv.paymentHistory,
  };
}

/**
 * Prefer the payments API invoice for cash/discount/history.
 * Older booking serializers set amountReceived = quoted total and omit coupon fields.
 */
export function resolveBillInvoice(
  bookingInvoice?: BookingInvoice | null,
  paymentInvoice?: Invoice | null
): BookingInvoice | undefined {
  if (paymentInvoice) {
    const fromPayments = toBookingInvoice(paymentInvoice);
    if (!bookingInvoice) return fromPayments;
    return {
      ...bookingInvoice,
      ...fromPayments,
      // Keep display charges from whichever has them
      serviceCharges:
        fromPayments.serviceCharges || bookingInvoice.serviceCharges,
      technicianCharges:
        fromPayments.technicianCharges || bookingInvoice.technicianCharges,
      taxAmount: fromPayments.taxAmount || bookingInvoice.taxAmount,
      totalAmount: fromPayments.totalAmount || bookingInvoice.totalAmount,
    };
  }
  return bookingInvoice ?? undefined;
}
