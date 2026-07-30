import { Booking, BookingInvoice } from '../services/bookings';
import { COMPANY_INFO } from '../constants/companyInfo';
import { KARMA_ELECTRIC_LOGO_DATA_URI } from '../constants/logoBase64';
import { amountInWordsINR } from './numberToWords';
import { formatServiceTypeLabel, getBookedServiceSummary } from './bookingDisplay';
import {
  getInvoiceCashPaid,
  getInvoiceDiscountAmount,
  getInvoiceBalanceDue,
} from './invoice';
import { sumSparePartsTotal } from './sparePartsCalc';

const money = (n: number) =>
  (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatInvoiceDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const day = String(d.getDate()).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${months[d.getMonth()]}-${year}`;
}

interface InvoiceLineItem {
  description: string;
  qty: string;
  rate: number;
  amount: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Builds the tax-invoice HTML (Karma Electric template) for a booking/invoice pair. */
export function generateInvoiceHtml(booking: Booking, invoice: BookingInvoice): string {
  const taxRate = invoice.taxRate ?? 0.18;
  const cgstRate = Math.round((taxRate / 2) * 100);
  const sgstRate = Math.round((taxRate / 2) * 100);
  const cgstAmount = Math.round((invoice.taxAmount ?? 0) / 2);
  const sgstAmount = (invoice.taxAmount ?? 0) - cgstAmount;

  const sparePreTax =
    sumSparePartsTotal(booking.spareParts) || (invoice.spareParts ?? 0);

  const items: InvoiceLineItem[] = [
    {
      description: formatServiceTypeLabel(booking.serviceType),
      qty: '1.00 Pac',
      rate: invoice.serviceCharges,
      amount: invoice.serviceCharges,
    },
  ];
  if (invoice.technicianCharges > 0) {
    items.push({
      description: 'Technician Charges',
      qty: '1.00 Pac',
      rate: invoice.technicianCharges,
      amount: invoice.technicianCharges,
    });
  }
  if (sparePreTax > 0) {
    items.push({
      description: 'Extra Parts / Spares',
      qty: '1.00 Pac',
      rate: sparePreTax,
      amount: sparePreTax,
    });
  }

  const taxableValue = items.reduce((sum, it) => sum + it.amount, 0);
  const discount = getInvoiceDiscountAmount(invoice);
  const cashPaid = getInvoiceCashPaid(invoice);
  const balanceDue = getInvoiceBalanceDue(invoice);
  const isPaid = invoice.status === 'paid' && balanceDue <= 0;
  const grandTotal = isPaid ? cashPaid : Math.max(0, invoice.totalAmount - discount);

  const bookedServices = getBookedServiceSummary(booking);
  const subLines = bookedServices
    .filter((s) => s !== formatServiceTypeLabel(booking.serviceType))
    .join(', ');

  const clientName = booking.clientId?.name ?? 'Customer';
  const clientPhone = booking.clientId?.phone ?? '';
  const venue = booking.venueId;
  const venueAddress = [venue?.address, venue?.area, venue?.city, venue?.state, venue?.pincode]
    .filter(Boolean)
    .join(', ');
  const stateName = venue?.state || COMPANY_INFO.stateName;

  const buyerBlock = `
    <b>${escapeHtml(clientName)}</b><br/>
    ${venueAddress ? `${escapeHtml(venueAddress)}<br/>` : ''}
    ${clientPhone ? `Phone : ${escapeHtml(clientPhone)}<br/>` : ''}
    State Name : ${escapeHtml(stateName)}`;

  const itemRows = items
    .map(
      (it, idx) => `
        <tr>
          <td class="c">${idx + 1}</td>
          <td>${escapeHtml(it.description)}${idx === 0 && subLines ? `<br/><i>${escapeHtml(subLines)}</i>` : ''}</td>
          <td class="c">${COMPANY_INFO.hsnSac}</td>
          <td class="c">${it.qty}</td>
          <td class="r">${money(it.rate)}</td>
          <td class="c">Pac</td>
          <td class="r">${money(it.amount)}</td>
        </tr>`
    )
    .join('');

  const discountRow =
    discount > 0
      ? `
        <tr>
          <td></td>
          <td colspan="4" class="r"><b>Less: Discount${invoice.couponCode ? ` (${escapeHtml(invoice.couponCode)})` : ''}</b></td>
          <td></td>
          <td class="r">− ${money(discount)}</td>
        </tr>`
      : '';

  const paymentInfoLine = isPaid
    ? `Paid${invoice.paidAt ? ` on ${new Date(invoice.paidAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}` : ''}${
        invoice.razorpayPaymentId ? ` · Ref: ${escapeHtml(invoice.razorpayPaymentId)}` : ''
      }`
    : `Status: ${escapeHtml(invoice.status.toUpperCase())}${balanceDue > 0 ? ` · Balance due: Rs. ${money(balanceDue)}` : ''}`;

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 9.5px; color: #000; margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 0.6px solid #000; padding: 4px 6px; vertical-align: top; }
  .noborder td { border: none; padding: 0; }
  h1 { text-align: center; font-size: 17px; margin: 0 0 8px; }
  .c { text-align: center; }
  .r { text-align: right; }
  .b { font-weight: bold; }
  .small { font-size: 8.5px; }
  .meta-table td { width: 25%; padding: 3px 6px; border: 0.6px solid #000; }
  .company-box { padding: 6px; }
  .company-row { display: flex; align-items: flex-start; gap: 6px; }
  .company-logo { width: 44px; height: 44px; flex-shrink: 0; margin-top: 1px; }
  .footer { text-align: center; margin-top: 8px; font-size: 8.5px; }
</style>
</head>
<body>
  <h1>Tax Invoice</h1>

  <table class="noborder">
    <tr>
      <td style="width:52%; border:0.6px solid #000; padding:0;">
        <div class="company-box company-row">
          <img class="company-logo" src="${KARMA_ELECTRIC_LOGO_DATA_URI}" />
          <div>
            <b>${escapeHtml(COMPANY_INFO.legalName)}</b><br/>
            ${COMPANY_INFO.addressLines.map(escapeHtml).join('<br/>')}<br/>
            GSTIN/UIN: ${COMPANY_INFO.gstin}<br/>
            State Name : ${COMPANY_INFO.stateName}, Code : ${COMPANY_INFO.stateCode}<br/>
            Contact : ${COMPANY_INFO.contact}<br/>
            E-Mail : ${COMPANY_INFO.email}
          </div>
        </div>
      </td>
      <td style="width:48%; border:0.6px solid #000; padding:0;">
        <table class="meta-table">
          <tr><td class="b" style="width:27%">Invoice No.</td><td style="width:23%">${escapeHtml(invoice.invoiceNumber)}</td><td class="b" style="width:27%">Dated</td><td style="width:23%">${formatInvoiceDate(invoice.paidAt || booking.scheduledDate)}</td></tr>
          <tr><td class="b">Delivery Note</td><td></td><td class="b">Mode/Terms of Payment</td><td></td></tr>
          <tr><td class="b">Reference No. &amp; Date.</td><td></td><td class="b">Other References</td><td></td></tr>
          <tr><td class="b">Buyer&apos;s Order No.</td><td>${escapeHtml(booking.bookingId)}</td><td class="b">Dated</td><td></td></tr>
          <tr><td class="b">Dispatch Doc No.</td><td></td><td class="b">Delivery Note Date</td><td></td></tr>
          <tr><td class="b">Dispatched through</td><td></td><td class="b">Destination</td><td></td></tr>
          <tr><td class="b">Terms of Delivery</td><td colspan="3"></td></tr>
        </table>
      </td>
    </tr>
  </table>

  <table class="noborder" style="margin-top:-1px;">
    <tr>
      <td style="width:52%; border:0.6px solid #000; padding:0;">
        <div class="company-box">
          <b>Consignee (Ship to)</b><br/>
          ${buyerBlock}
        </div>
      </td>
      <td style="width:48%; border:0.6px solid #000; padding:0;">
        <div class="company-box">Place of Supply : ${escapeHtml(stateName)}</div>
      </td>
    </tr>
    <tr>
      <td style="width:52%; border:0.6px solid #000; padding:0;">
        <div class="company-box">
          <b>Buyer (Bill to)</b><br/>
          ${buyerBlock}
        </div>
      </td>
      <td style="width:48%; border:0.6px solid #000;"></td>
    </tr>
  </table>

  <table style="margin-top:-1px;">
    <thead>
      <tr>
        <th style="width:5%">Sl No.</th>
        <th style="width:38%">Description of Goods</th>
        <th style="width:12%">HSN/SAC</th>
        <th style="width:13%">Quantity</th>
        <th style="width:12%">Rate</th>
        <th style="width:8%">per</th>
        <th style="width:15%">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr>
        <td></td>
        <td colspan="4" class="r">OUTPUT CGST@ ${cgstRate}%</td>
        <td class="c">${cgstRate}</td>
        <td class="r">${money(cgstAmount)}</td>
      </tr>
      <tr>
        <td></td>
        <td colspan="4" class="r">OUTPUT SGST @ ${sgstRate}%</td>
        <td class="c">${sgstRate}</td>
        <td class="r">${money(sgstAmount)}</td>
      </tr>
      ${discountRow}
      <tr style="height:34mm;">
        <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      </tr>
      <tr>
        <td></td>
        <td class="b">Total</td>
        <td></td>
        <td class="c">1.00 Pac</td>
        <td></td>
        <td></td>
        <td class="r b">&#8377; ${money(grandTotal)}</td>
      </tr>
    </tbody>
  </table>

  <table style="margin-top:-1px;">
    <tr>
      <td style="width:80%">
        Amount Chargeable (in words)<br/>
        <b>${amountInWordsINR(grandTotal)}</b>
      </td>
      <td style="width:20%" class="r">E. &amp; O.E</td>
    </tr>
  </table>

  <table style="margin-top:-1px;">
    <thead>
      <tr>
        <th rowspan="2">Taxable Value</th>
        <th colspan="2">CGST</th>
        <th colspan="2">SGST/UTGST</th>
        <th rowspan="2">Total Tax Amount</th>
      </tr>
      <tr><th>Rate</th><th>Amount</th><th>Rate</th><th>Amount</th></tr>
    </thead>
    <tbody>
      <tr>
        <td class="r">${money(taxableValue)}</td>
        <td class="c">${cgstRate}%</td><td class="r">${money(cgstAmount)}</td>
        <td class="c">${sgstRate}%</td><td class="r">${money(sgstAmount)}</td>
        <td class="r">${money(cgstAmount + sgstAmount)}</td>
      </tr>
      <tr>
        <td class="b">Total:</td>
        <td></td><td class="b">${money(cgstAmount)}</td>
        <td></td><td class="b">${money(sgstAmount)}</td>
        <td class="b">${money(cgstAmount + sgstAmount)}</td>
      </tr>
    </tbody>
  </table>
  <div class="small">Tax Amount (in words) : <b>${amountInWordsINR(cgstAmount + sgstAmount)}</b></div>
  <div class="small" style="margin-top:4px;">${paymentInfoLine}</div>

  <table class="noborder" style="margin-top:8px;">
    <tr>
      <td style="width:52%; border:0.6px solid #000;">
        <div class="company-box small">
          <b>Declaration</b><br/>
          We declare that this invoice shows the actual price of the goods/services
          described and that all particulars are true.
        </div>
      </td>
      <td style="width:48%; border:0.6px solid #000;">
        <div class="company-box small">
          <b>Company&apos;s Bank Details</b><br/>
          A/c Holder&apos;s Name : <b>${COMPANY_INFO.bank.accountHolder}</b><br/>
          Bank Name : <b>${COMPANY_INFO.bank.bankName}</b><br/>
          A/c No. : <b>${COMPANY_INFO.bank.accountNo}</b><br/>
          Branch &amp; IFS Code : <b>${COMPANY_INFO.bank.branchIfsc}</b>
        </div>
      </td>
    </tr>
    <tr>
      <td style="border:0.6px solid #000;"><div class="company-box small">Customer&apos;s Seal and Signature</div></td>
      <td style="border:0.6px solid #000;">
        <div class="company-box small r">
          for ${escapeHtml(COMPANY_INFO.legalName)}<br/><br/><br/>
          Authorised Signatory
        </div>
      </td>
    </tr>
  </table>

  <div class="footer">This is a Computer Generated Invoice</div>
</body>
</html>`;
}
