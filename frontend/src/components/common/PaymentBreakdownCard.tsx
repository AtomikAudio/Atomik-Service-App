import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Badge } from './Badge';
import { Button } from './Button';
import { BookingInvoice } from '../../services/bookings';
import { formatINR, paymentBadgeVariant, paymentLabel } from '../../utils/payment';
import {
  getClientSparePartsPayAmount,
  getInvoiceBalanceDue,
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

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
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

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Payment</Text>
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
          <Row label="Extra parts due" value={formatINR(extraDue)} />
          <Text style={styles.paidNote}>
            Base invoice paid ({formatINR(invoice.amountPaid ?? 0)}).
          </Text>
        </>
      ) : (
        <>
          <Row label="Service charges" value={formatINR(invoice.serviceCharges)} />
          <Row label="Technician charges" value={formatINR(invoice.technicianCharges)} />
          {sparePreTax > 0 ? (
            <Row label="Spare parts" value={formatINR(sparePreTax)} />
          ) : null}
          <Row label={gstLabel} value={formatINR(invoice.taxAmount)} />
          <View style={styles.divider} />
          <Row label="Total" value={formatINR(invoice.totalAmount)} />
          {!paid && balanceDue > 0 && balanceDue < invoice.totalAmount ? (
            <>
              <Row label="Already paid" value={formatINR(invoice.amountPaid ?? 0)} />
              <Row label="Balance due" value={formatINR(balanceDue)} />
            </>
          ) : null}
        </>
      )}
      {paid ? (
        <>
          <View style={styles.paidBox}>
            <Text style={styles.paidLabel}>Amount received</Text>
            <Text style={styles.paidAmount}>{formatINR(invoice.amountPaid)}</Text>
          </View>
          {invoice.paidAt ? (
            <Text style={styles.meta}>
              Paid on {new Date(invoice.paidAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
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
  },
  label: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
  },
  value: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: COLORS.white,
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
  paidLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: COLORS.ashGray,
    marginBottom: 4,
  },
  paidAmount: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: COLORS.ashGray,
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
  paidNote: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: COLORS.grayDark,
    marginTop: 8,
    fontStyle: 'italic',
  },
  payBtn: {
    marginTop: 14,
  },
});
