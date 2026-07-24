import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Badge } from './Badge';
import { Button } from './Button';
import { BookingInvoice } from '../../services/bookings';
import { formatINR, paymentBadgeVariant, paymentLabel } from '../../utils/payment';
import {
  getClientSparePartsPayAmount,
  getInvoiceBalanceDue,
  getInvoiceCashPaid,
  getInvoiceDiscountAmount,
  isExtraPartsOnlyPayment,
} from '../../utils/invoice';
import { sumSparePartsTotal } from '../../utils/sparePartsCalc';
import { COLORS } from '../../constants/colors';

interface Props {
  invoice: BookingInvoice;
  sparePartsLines?: { name: string; quantity: number; unitCost: number }[];
  onPayPress?: () => void;
  payLabel?: string;
}

const Row = ({
  label,
  value,
  emphasize,
  muted,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  muted?: boolean;
}) => (
  <View style={styles.row}>
    <Text style={[styles.label, muted && styles.mutedText]}>{label}</Text>
    <Text
      style={[
        styles.value,
        emphasize && styles.valueEmphasize,
        muted && styles.mutedText,
      ]}
    >
      {value}
    </Text>
  </View>
);

export const PaymentBreakdownCard: React.FC<Props> = ({
  invoice,
  sparePartsLines,
  onPayPress,
  payLabel,
}) => {
  const balanceDue = getInvoiceBalanceDue(invoice);
  const extraPartsOnly = isExtraPartsOnlyPayment(invoice, sparePartsLines);
  const extraDue = getClientSparePartsPayAmount(invoice, sparePartsLines);
  const sparePreTax =
    sumSparePartsTotal(sparePartsLines) || (invoice.spareParts ?? 0);
  const paid = balanceDue <= 0 && invoice.status === 'paid';
  const gstLabel = `GST (${Math.round((invoice.taxRate ?? 0.18) * 100)}%)`;
  const showPay = !!onPayPress && balanceDue > 0;
  const discount = getInvoiceDiscountAmount(invoice);
  const cashPaid = getInvoiceCashPaid(invoice);
  const hasDiscount = discount > 0;
  const discountLabel = invoice.couponCode
    ? `Discount applied (${invoice.couponCode}${
        invoice.discountPercent ? ` · ${invoice.discountPercent}%` : ''
      })`
    : invoice.discountPercent
      ? `Discount applied (${invoice.discountPercent}%)`
      : 'Discount applied';

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Bill</Text>
        <Badge
          label={paymentLabel(paid ? 'paid' : 'unpaid')}
          variant={paymentBadgeVariant(paid ? 'paid' : 'unpaid')}
        />
      </View>
      <Text style={styles.invoiceNo}>Invoice {invoice.invoiceNumber}</Text>

      {extraPartsOnly ? (
        <>
          <Row label="Extra parts (quoted)" value={formatINR(sparePreTax)} />
          <Row
            label="GST on extra parts"
            value={formatINR(Math.max(0, extraDue - sparePreTax))}
          />
          <View style={styles.divider} />
          <Row label="Extra parts due" value={formatINR(extraDue)} emphasize />
          {cashPaid > 0 ? (
            <>
              {hasDiscount ? (
                <Row label={discountLabel} value={`− ${formatINR(discount)}`} />
              ) : null}
              <Row
                label="Amount paid (base service)"
                value={formatINR(cashPaid)}
                emphasize
              />
            </>
          ) : null}
        </>
      ) : (
        <>
          <Row label="Service charges" value={formatINR(invoice.serviceCharges)} />
          {invoice.technicianCharges > 0 ? (
            <Row
              label="Technician charges"
              value={formatINR(invoice.technicianCharges)}
            />
          ) : null}
          {sparePreTax > 0 ? (
            <Row label="Extra parts" value={formatINR(sparePreTax)} />
          ) : null}
          <Row label={gstLabel} value={formatINR(invoice.taxAmount)} />
          <View style={styles.divider} />
          <Row label="Quoted total" value={formatINR(invoice.totalAmount)} />
          {hasDiscount ? (
            <Row label={discountLabel} value={`− ${formatINR(discount)}`} />
          ) : null}
          {!paid && balanceDue > 0 ? (
            <>
              {cashPaid > 0 ? (
                <Row label="Amount paid" value={formatINR(cashPaid)} emphasize />
              ) : null}
              <Row
                label="Amount to pay"
                value={formatINR(
                  hasDiscount && cashPaid <= 0
                    ? Math.max(0, invoice.totalAmount - discount)
                    : balanceDue
                )}
                emphasize
              />
            </>
          ) : null}
        </>
      )}

      {paid ? (
        <>
          <View style={styles.paidBox}>
            {hasDiscount ? (
              <View style={styles.paidRow}>
                <Text style={styles.paidLabel}>{discountLabel}</Text>
                <Text style={styles.paidDiscount}>− {formatINR(discount)}</Text>
              </View>
            ) : null}
            <Text style={styles.paidLabel}>Amount paid</Text>
            <Text style={styles.paidAmount}>{formatINR(cashPaid)}</Text>
            {hasDiscount && cashPaid !== invoice.totalAmount ? (
              <Text style={styles.paidHint}>
                Quoted {formatINR(invoice.totalAmount)} · cash received{' '}
                {formatINR(cashPaid)}
              </Text>
            ) : null}
          </View>
          {invoice.paidAt ? (
            <Text style={styles.meta}>
              Paid on{' '}
              {new Date(invoice.paidAt).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
              })}
            </Text>
          ) : null}
          {invoice.razorpayPaymentId ? (
            <Text style={styles.meta}>Ref: {invoice.razorpayPaymentId}</Text>
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.pendingNote}>
            {extraPartsOnly
              ? 'Pay only the extra parts balance below.'
              : hasDiscount
                ? 'Coupon applied — pay the discounted amount at checkout.'
                : 'Awaiting client payment'}
          </Text>
          {showPay ? (
            <Button
              label={
                payLabel ?? (extraPartsOnly ? 'PAY EXTRA PARTS' : 'PAY NOW')
              }
              onPress={onPayPress}
              style={styles.payBtn}
            />
          ) : null}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: COLORS.white,
  },
  invoiceNo: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    color: COLORS.grayDark,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },
  label: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    flex: 1,
  },
  value: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: COLORS.white,
  },
  valueEmphasize: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 13,
  },
  mutedText: {
    color: COLORS.ashGray,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 10,
  },
  paidBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.ashGrayBg,
    borderWidth: 1,
    borderColor: COLORS.ashGrayBorder,
  },
  paidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  paidLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: COLORS.ashGray,
    marginBottom: 4,
    flex: 1,
  },
  paidDiscount: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: COLORS.ashGray,
  },
  paidAmount: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 22,
    color: COLORS.ashGray,
  },
  paidHint: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 10,
    color: COLORS.ashGray,
    marginTop: 8,
  },
  meta: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 10,
    color: COLORS.grayDark,
    marginTop: 8,
  },
  pendingNote: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 8,
    fontStyle: 'italic',
  },
  payBtn: {
    marginTop: 14,
  },
});
