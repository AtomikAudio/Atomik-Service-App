import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from '../common/Button';
import { SparePartsSummary } from '../common/SparePartsSummary';
import { COLORS } from '../../constants/colors';
import { formatINR } from '../../utils/payment';
import {
  getClientSparePartsPayAmount,
  isExtraPartsOnlyPayment,
} from '../../utils/invoice';
import { BookingInvoice } from '../../services/bookings';
import { SparePartLine } from '../../utils/sparePartsCalc';

interface Props {
  parts?: SparePartLine[] | null;
  invoice?: BookingInvoice | null;
  onPay: () => void;
  loading?: boolean;
}

export const ExtraPartsPaymentCard: React.FC<Props> = ({
  parts,
  invoice,
  onPay,
  loading = false,
}) => {
  if (!parts?.length || !isExtraPartsOnlyPayment(invoice, parts)) return null;

  const balanceDue = getClientSparePartsPayAmount(invoice, parts);
  if (balanceDue <= 0) return null;

  return (
    <View style={styles.wrap}>
      <SparePartsSummary parts={parts} />
      <View style={styles.payBox}>
        <View>
          <Text style={styles.payLabel}>Extra parts due (incl. GST)</Text>
          <Text style={styles.payAmount}>{formatINR(balanceDue)}</Text>
          <Text style={styles.paySub}>
            Technician quote (parts + GST)
          </Text>
        </View>
        <Button
          label="PAY EXTRA PARTS"
          onPress={onPay}
          loading={loading}
          style={styles.payBtn}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(142, 48, 47, 0.25)',
  },
  payBox: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 14,
  },
  payLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 11,
    color: COLORS.gray,
    marginBottom: 4,
  },
  payAmount: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 22,
    color: COLORS.red,
  },
  paySub: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 10,
    color: COLORS.grayDark,
    marginTop: 6,
  },
  payBtn: {
    width: '100%',
  },
});
