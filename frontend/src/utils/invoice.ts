import { BookingInvoice } from '../services/bookings';
import { Invoice } from '../services/payments';
import {
  quotedSparePartsWithTax,
  SparePartLine,
  sumSparePartsTotal,
} from './sparePartsCalc';

type InvoiceLike =
  | BookingInvoice
  | Invoice
  | {
      totalAmount?: number;
      amountPaid?: number;
      balanceDue?: number;
      amountReceived?: number;
      spareParts?: number;
      taxRate?: number;
      status?: string;
      paidAt?: string;
      serviceCharges?: number;
      technicianCharges?: number;
      couponCode?: string;
      discountPercent?: number;
      discountAmount?: number;
      paymentHistory?: { amount?: number }[];
    }
  | null
  | undefined;

export function getInvoiceDiscountAmount(invoice: InvoiceLike): number {
  if (!invoice) return 0;
  return Math.max(0, Number(invoice.discountAmount) || 0);
}

/** Cash the client actually paid (after discount). */
export function getInvoiceCashPaid(invoice: InvoiceLike): number {
  if (!invoice) return 0;

  const history = invoice.paymentHistory ?? [];
  if (history.length > 0) {
    return (
      Math.round(
        history.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0) * 100
      ) / 100
    );
  }

  const discount = getInvoiceDiscountAmount(invoice);
  const total = invoice.totalAmount ?? 0;
  const paidMarker = invoice.amountPaid ?? 0;

  if (discount > 0 && paidMarker >= total && total > 0) {
    return Math.max(0, Math.round((total - discount) * 100) / 100);
  }

  if (typeof invoice.amountReceived === 'number' && invoice.amountReceived > 0) {
    // Older booking APIs set amountReceived = quoted total on settle — ignore that.
    const echoesQuote =
      total > 0 &&
      Math.abs(invoice.amountReceived - total) < 0.01 &&
      paidMarker >= total;
    if (!echoesQuote) {
      return invoice.amountReceived;
    }
  }

  if (discount > 0 && total > 0) {
    return Math.max(0, Math.round((total - discount) * 100) / 100);
  }

  return paidMarker;
}

export function getInvoiceBalanceDue(invoice: InvoiceLike): number {
  if (!invoice) return 0;
  if (typeof invoice.balanceDue === 'number') {
    return Math.max(0, invoice.balanceDue);
  }
  const total = invoice.totalAmount ?? 0;
  const paid = invoice.amountPaid ?? 0;
  return Math.max(0, total - paid);
}

export function invoiceNeedsPayment(invoice: InvoiceLike): boolean {
  if (!invoice) return false;
  return getInvoiceBalanceDue(invoice) > 0;
}

function baseServiceWasPaid(invoice: InvoiceLike): boolean {
  if (!invoice) return false;
  const paid = invoice.amountPaid ?? 0;
  if (paid > 0) return true;
  return !!(invoice.paidAt && (invoice.spareParts ?? 0) > 0);
}

/** @deprecated use baseServiceWasPaid */
export const baseInvoiceWasPaid = baseServiceWasPaid;

export function hasQuotedSpareParts(
  invoice: InvoiceLike,
  sparePartsLines?: SparePartLine[] | null
): boolean {
  return (
    sumSparePartsTotal(sparePartsLines) > 0 || (invoice?.spareParts ?? 0) > 0
  );
}

/** Technician-quoted spare parts total incl. GST (for display). */
export function getDisplayExtraPartsAmount(
  invoice: InvoiceLike,
  sparePartsLines?: SparePartLine[] | null
): number {
  if (isExtraPartsOnlyPayment(invoice, sparePartsLines)) {
    return getClientSparePartsPayAmount(invoice, sparePartsLines);
  }

  const taxRate = invoice?.taxRate ?? 0.18;
  const fromLines = quotedSparePartsWithTax(sparePartsLines, taxRate);
  if (fromLines > 0) return fromLines;

  const sparePreTax = invoice?.spareParts ?? 0;
  if (sparePreTax > 0) {
    return sparePreTax + Math.round(sparePreTax * taxRate);
  }

  return 0;
}

/**
 * Amount client pays for technician-quoted spare parts only (incl. GST).
 * Uses live booking line items when provided.
 */
export function getClientSparePartsPayAmount(
  invoice: InvoiceLike,
  sparePartsLines?: SparePartLine[] | null
): number {
  const balance = getInvoiceBalanceDue(invoice);
  if (balance <= 0) return 0;

  const taxRate = invoice?.taxRate ?? 0.18;
  const quotedFromLines = quotedSparePartsWithTax(sparePartsLines, taxRate);
  const sparePreTax = invoice?.spareParts ?? 0;
  const quotedFromInvoice =
    sparePreTax > 0
      ? sparePreTax + Math.round(sparePreTax * taxRate)
      : 0;
  const quoted = quotedFromLines > 0 ? quotedFromLines : quotedFromInvoice;

  if (quoted <= 0) return balance;

  if (baseServiceWasPaid(invoice)) {
    return Math.min(balance, quoted);
  }

  return balance;
}

/** True when payment due is only the technician spare-parts quote (not full invoice). */
export function isExtraPartsOnlyPayment(
  invoice: InvoiceLike,
  sparePartsLines?: SparePartLine[] | null
): boolean {
  if (!invoiceNeedsPayment(invoice)) return false;
  const linesTotal = sumSparePartsTotal(sparePartsLines);
  const spareOnInvoice = invoice?.spareParts ?? 0;
  if (linesTotal <= 0 && spareOnInvoice <= 0) return false;

  const payAmount = getClientSparePartsPayAmount(invoice, sparePartsLines);
  const balance = getInvoiceBalanceDue(invoice);
  if (payAmount <= 0) return false;

  return baseServiceWasPaid(invoice) && payAmount <= balance;
}

/** @deprecated prefer isExtraPartsOnlyPayment with booking.spareParts */
export function shouldPayExtraPartsOnly(
  invoice: InvoiceLike,
  sparePartsLines?: SparePartLine[] | null
): boolean {
  if (sparePartsLines?.length) {
    return isExtraPartsOnlyPayment(invoice, sparePartsLines);
  }
  const spare = invoice?.spareParts ?? 0;
  const paid = invoice?.amountPaid ?? 0;
  const balance = getInvoiceBalanceDue(invoice);
  return spare > 0 && paid > 0 && balance > 0;
}

export function getExtraPartsPaymentAmount(
  invoice: InvoiceLike,
  sparePartsLines?: SparePartLine[] | null
): number {
  if (isExtraPartsOnlyPayment(invoice, sparePartsLines)) {
    return getClientSparePartsPayAmount(invoice, sparePartsLines);
  }
  const spare = invoice?.spareParts ?? 0;
  const paid = invoice?.amountPaid ?? 0;
  const balance = getInvoiceBalanceDue(invoice);
  if (spare > 0 && paid > 0 && balance > 0) {
    return balance;
  }
  return 0;
}

export function getExtraPartsGstAmount(
  invoice: InvoiceLike,
  sparePartsLines?: SparePartLine[] | null,
  taxRate = 0.18
): number {
  const amount = getClientSparePartsPayAmount(invoice, sparePartsLines);
  if (amount <= 0) return 0;
  const preTax =
    sumSparePartsTotal(sparePartsLines) ||
    (invoice?.spareParts ?? 0);
  return Math.max(0, amount - preTax);
}

export function isExtraPartsPaymentDue(
  invoice: InvoiceLike,
  sparePartsLines?: SparePartLine[] | null
): boolean {
  return isExtraPartsOnlyPayment(invoice, sparePartsLines);
}
