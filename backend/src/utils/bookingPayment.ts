import mongoose from 'mongoose';
import { Booking } from '../models/Booking';
import { Invoice } from '../models/Invoice';

type InvoiceLike =
  | {
      _id?: unknown;
      invoiceNumber?: string;
      status?: string;
      serviceCharges?: number;
      technicianCharges?: number;
      spareParts?: number;
      taxRate?: number;
      taxAmount?: number;
      totalAmount?: number;
      amountPaid?: number;
      paidAt?: Date;
      razorpayPaymentId?: string;
    }
  | string
  | null
  | undefined;

export type PaymentStatus = 'paid' | 'unpaid';

export type InvoicePaymentType = 'base_service' | 'extra_parts' | 'full';

export type InvoicePaymentEntry = {
  amount: number;
  type: InvoicePaymentType;
  paidAt: Date | string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
};

export type SparePartLine = {
  name?: string;
  quantity?: number;
  unitCost?: number;
};

export function sumSparePartsLineItems(parts: SparePartLine[] | undefined): number {
  if (!parts?.length) return 0;
  return parts.reduce(
    (sum, p) => sum + (p.quantity ?? 1) * (p.unitCost ?? 0),
    0
  );
}

export function getInvoiceBalanceDue(invoice: InvoiceLike): number {
  if (!invoice || typeof invoice === 'string') return 0;
  const total = invoice.totalAmount ?? 0;
  const paid = invoice.amountPaid ?? 0;
  return Math.max(0, total - paid);
}

export function quotedSparePartsWithTax(
  parts: SparePartLine[] | undefined,
  taxRate = 0.18
): number {
  const preTax = sumSparePartsLineItems(parts);
  if (preTax <= 0) return 0;
  return preTax + Math.round(preTax * taxRate);
}

function baseServiceWasPaid(invoice: InvoiceLike): boolean {
  if (!invoice || typeof invoice === 'string') return false;
  if ((invoice.amountPaid ?? 0) > 0) return true;
  if (invoice.status === 'paid') return true;
  return !!invoice.paidAt;
}

/** True when the client has paid the base service (extra-parts top-ups may still be due). */
export function hasBaseServicePayment(invoice: InvoiceLike): boolean {
  return baseServiceWasPaid(invoice);
}

/** Charge amount for technician-quoted spare parts (incl. GST), capped by balance due. */
export function getExtraPartsChargeAmount(
  invoice: InvoiceLike,
  sparePartsLines?: SparePartLine[]
): number {
  if (!invoice || typeof invoice === 'string') return 0;
  const balance = getInvoiceBalanceDue(invoice);
  if (balance <= 0) return 0;

  const taxRate = invoice.taxRate ?? 0.18;
  const quotedFromLines = quotedSparePartsWithTax(sparePartsLines, taxRate);
  const sparePreTax = invoice.spareParts ?? 0;
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

/** True when base invoice was settled and only spare-parts top-up remains. */
export function shouldPayExtraPartsOnly(
  invoice: InvoiceLike,
  sparePartsLines?: SparePartLine[]
): boolean {
  if (!invoice || typeof invoice === 'string') return false;
  if (sparePartsLines?.length) {
    const charge = getExtraPartsChargeAmount(invoice, sparePartsLines);
    const balance = getInvoiceBalanceDue(invoice);
    return charge > 0 && baseServiceWasPaid(invoice) && charge <= balance;
  }
  const spare = invoice.spareParts ?? 0;
  const paid = invoice.amountPaid ?? 0;
  const balance = getInvoiceBalanceDue(invoice);
  return spare > 0 && paid > 0 && balance > 0;
}

function getBaseServiceTotal(invoice: {
  serviceCharges?: number;
  technicianCharges?: number;
  taxRate?: number;
}): number {
  const subtotal =
    (invoice.serviceCharges ?? 0) + (invoice.technicianCharges ?? 0);
  const taxRate = invoice.taxRate ?? 0.18;
  return subtotal + Math.round(subtotal * taxRate);
}

/** Summarize recorded payments by type (coupon-safe; ignores cash amounts). */
function summarizeRecordedPayments(invoice: {
  paymentHistory?: { type?: string }[];
}): { hasAny: boolean; hasExtraOrFull: boolean } {
  const history = invoice.paymentHistory ?? [];
  return {
    hasAny: history.length > 0,
    hasExtraOrFull: history.some(
      (entry) => entry.type === 'extra_parts' || entry.type === 'full'
    ),
  };
}

/** Ledger rows for client payment history (stored entries + legacy invoices). */
export function buildPaymentHistoryForClient(invoice: {
  paymentHistory?: InvoicePaymentEntry[];
  amountPaid?: number;
  totalAmount?: number;
  status?: string;
  paidAt?: Date | string;
  spareParts?: number;
  taxRate?: number;
  serviceCharges?: number;
  technicianCharges?: number;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
}): InvoicePaymentEntry[] {
  const stored = (invoice.paymentHistory ?? [])
    .map((entry) => ({
      amount: Number(entry.amount) || 0,
      type:
        entry.type === 'extra_parts' ||
        entry.type === 'base_service' ||
        entry.type === 'full'
          ? entry.type
          : ('full' as InvoicePaymentType),
      paidAt: entry.paidAt,
      razorpayOrderId: entry.razorpayOrderId,
      razorpayPaymentId: entry.razorpayPaymentId,
    }))
    .filter((entry) => entry.amount > 0);
  if (stored.length > 0) {
    return [...stored].sort(
      (a, b) =>
        new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
    );
  }

  let amountPaid = invoice.amountPaid ?? 0;
  if (invoice.status === 'paid' && amountPaid === 0) {
    amountPaid = invoice.totalAmount ?? 0;
  }
  if (amountPaid <= 0) return [];

  const baseTotal = getBaseServiceTotal(invoice);
  const sparePreTax = invoice.spareParts ?? 0;
  const taxRate = invoice.taxRate ?? 0.18;
  const spareWithTax =
    sparePreTax > 0
      ? sparePreTax + Math.round(sparePreTax * taxRate)
      : 0;
  const paidAt = invoice.paidAt ?? new Date();
  const legacyRef = {
    razorpayPaymentId: invoice.razorpayPaymentId,
    razorpayOrderId: invoice.razorpayOrderId,
  };

  if (spareWithTax > 0 && amountPaid > baseTotal) {
    const entries: InvoicePaymentEntry[] = [
      {
        amount: baseTotal,
        type: 'base_service',
        paidAt,
        ...legacyRef,
      },
      {
        amount: Math.min(amountPaid - baseTotal, spareWithTax),
        type: 'extra_parts',
        paidAt,
        ...legacyRef,
      },
    ];
    return entries.filter((e) => e.amount > 0);
  }

  if (sparePreTax > 0) {
    return [
      {
        amount: amountPaid,
        type: 'full',
        paidAt,
        ...legacyRef,
      },
    ];
  }

  return [
    {
      amount: amountPaid,
      type: 'base_service',
      paidAt,
      ...legacyRef,
    },
  ];
}

export function derivePaymentStatus(invoice: InvoiceLike): PaymentStatus {
  if (!invoice || typeof invoice === 'string') return 'unpaid';
  if (getInvoiceBalanceDue(invoice) > 0) return 'unpaid';
  return invoice.status === 'paid' ? 'paid' : 'unpaid';
}

export function invoiceBreakdownForAdmin(invoice: InvoiceLike) {
  if (!invoice || typeof invoice === 'string') return null;

  let amountPaid = invoice.amountPaid ?? 0;
  if (invoice.status === 'paid' && amountPaid === 0) {
    amountPaid = invoice.totalAmount ?? 0;
  }
  const settled = amountPaid >= (invoice.totalAmount ?? 0) && invoice.status === 'paid';
  const balanceDue = getInvoiceBalanceDue({ ...invoice, amountPaid });

  return {
    _id: String(invoice._id),
    invoiceNumber: invoice.invoiceNumber,
    status: balanceDue > 0 ? 'pending' : invoice.status,
    serviceCharges: invoice.serviceCharges ?? 0,
    technicianCharges: invoice.technicianCharges ?? 0,
    spareParts: invoice.spareParts ?? 0,
    taxRate: invoice.taxRate ?? 0.18,
    taxAmount: invoice.taxAmount ?? 0,
    totalAmount: invoice.totalAmount ?? 0,
    amountPaid,
    balanceDue,
    amountReceived: settled ? invoice.totalAmount ?? 0 : invoice.amountPaid ?? 0,
    paidAt: invoice.paidAt,
    razorpayPaymentId: invoice.razorpayPaymentId,
  };
}

export function serializeBookingForRole(booking: any, role: string) {
  const obj = booking?.toObject
    ? booking.toObject({ virtuals: true })
    : { ...booking };
  const inv = obj.invoiceId;

  obj.paymentStatus = derivePaymentStatus(inv);

  if (role === 'admin' || role === 'client') {
    obj.invoice = invoiceBreakdownForAdmin(inv);
  } else if (role === 'technician' || role === 'master_technician') {
    delete obj.invoiceId;
  }

  return obj;
}

/** Strip client contact and full venue address for open-pool job previews. */
export function redactBookingForPoolView(booking: Record<string, unknown>): Record<string, unknown> {
  const obj = { ...booking };
  const client = obj.clientId;
  if (client && typeof client === 'object') {
    const c = { ...(client as Record<string, unknown>) };
    delete c.phone;
    delete c.email;
    delete c.fcmToken;
    obj.clientId = c;
  }
  const venue = obj.venueId;
  if (venue && typeof venue === 'object') {
    const v = venue as Record<string, unknown>;
    obj.venueId = {
      name: v.name,
      area: v.area,
      city: v.city,
    };
  }
  delete obj.invoiceId;
  delete obj.invoice;
  return obj;
}

export function serializeBookingsForRole(bookings: any[], role: string) {
  return bookings.map((b) => serializeBookingForRole(b, role));
}

/** Recalculate pending invoice when technician adds chargeable spare parts. */
export async function syncInvoiceSparePartsFromBooking(
  bookingId: mongoose.Types.ObjectId | string,
  spareParts: SparePartLine[]
): Promise<void> {
  if (!spareParts?.length) return;

  const booking = await Booking.findById(bookingId).select('invoiceId');
  if (!booking?.invoiceId) return;

  const invoice = await Invoice.findById(booking.invoiceId);
  if (!invoice) return;

  const sparePartsTotal = sumSparePartsLineItems(spareParts);
  const subtotal =
    (invoice.serviceCharges ?? 0) +
    (invoice.technicianCharges ?? 0) +
    sparePartsTotal;
  const taxRate = invoice.taxRate ?? 0.18;
  const taxAmount = Math.round(subtotal * taxRate);
  const newTotal = subtotal + taxAmount;

  const baseServiceTotal = getBaseServiceTotal(invoice);
  const { hasExtraOrFull } = summarizeRecordedPayments(invoice);

  // Once paidAt/status is set the client has settled at least the base service.
  // If an extra-parts / full payment was recorded, the whole invoice is settled;
  // otherwise only the base service is settled (coupon-safe: base counts as fully
  // satisfied). Never carry the extra-parts-inclusive previous total forward —
  // doing so ratchets amountPaid up on every sync and eventually marks the
  // invoice fully paid without the client ever paying for the extra parts.
  if (invoice.status === 'paid' || invoice.paidAt) {
    invoice.amountPaid = hasExtraOrFull ? newTotal : baseServiceTotal;
  }

  invoice.spareParts = sparePartsTotal;
  invoice.taxAmount = taxAmount;
  invoice.totalAmount = newTotal;

  if (getInvoiceBalanceDue(invoice) > 0) {
    invoice.status = 'pending';
    invoice.razorpayOrderId = undefined;
  }

  await invoice.save();
}

/** Remove technician-quoted spare parts from a booking's invoice (revert to base only). */
export async function resetInvoiceSparePartsForBooking(
  bookingId: mongoose.Types.ObjectId | string
): Promise<void> {
  const booking = await Booking.findById(bookingId).select('invoiceId');
  if (!booking?.invoiceId) return;

  const invoice = await Invoice.findById(booking.invoiceId);
  if (!invoice) return;
  if ((invoice.spareParts ?? 0) === 0) return; // nothing to clear

  const subtotal =
    (invoice.serviceCharges ?? 0) + (invoice.technicianCharges ?? 0);
  const taxRate = invoice.taxRate ?? 0.18;
  const taxAmount = Math.round(subtotal * taxRate);
  const baseTotal = subtotal + taxAmount;

  const baseServiceTotal = getBaseServiceTotal(invoice);
  const { hasExtraOrFull } = summarizeRecordedPayments(invoice);

  invoice.spareParts = 0;
  invoice.taxAmount = taxAmount;
  invoice.totalAmount = baseTotal;

  // Re-anchor the settled amount now that extra parts are gone.
  if (invoice.status === 'paid' || invoice.paidAt) {
    invoice.amountPaid = hasExtraOrFull ? baseTotal : baseServiceTotal;
  }

  if (getInvoiceBalanceDue(invoice) > 0) {
    invoice.status = 'pending';
    invoice.razorpayOrderId = undefined;
  } else if (invoice.paidAt) {
    invoice.status = 'paid';
  }

  await invoice.save();
}

/** Keep invoice totals in sync when the booking has technician-quoted spare parts. */
export async function ensureInvoiceReflectsBookingSpareParts(
  bookingId: mongoose.Types.ObjectId | string,
  spareParts?: SparePartLine[]
): Promise<boolean> {
  if (!spareParts?.length) return false;

  const quoted = sumSparePartsLineItems(spareParts);
  if (quoted <= 0) return false;

  const booking = await Booking.findById(bookingId).select('invoiceId');
  if (!booking?.invoiceId) return false;

  const invoice = await Invoice.findById(booking.invoiceId);
  if (!invoice) return false;

  const invoiceSpare = invoice.spareParts ?? 0;
  const balance = getInvoiceBalanceDue(invoice);
  const amountPaid = invoice.amountPaid ?? 0;
  const baseServiceTotal = getBaseServiceTotal(invoice);
  const { hasAny, hasExtraOrFull } = summarizeRecordedPayments(invoice);
  // Heal invoices whose amountPaid was previously ratcheted above the base
  // service total by the older sync bug, which made extra-parts invoices
  // incorrectly appear fully paid after a plain refetch. Only when a real base
  // (and no extra/full) payment was recorded, so genuine full payments and
  // coupon base payments are never reduced.
  const overstatedPaid =
    hasAny && !hasExtraOrFull && amountPaid > baseServiceTotal;
  const shouldSync =
    quoted > invoiceSpare ||
    (quoted > 0 &&
      invoiceSpare === 0 &&
      amountPaid > 0 &&
      balance <= 0) ||
    overstatedPaid;

  if (!shouldSync) return false;

  await syncInvoiceSparePartsFromBooking(bookingId, spareParts);
  return true;
}
