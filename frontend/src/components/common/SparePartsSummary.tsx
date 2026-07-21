import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';
import { formatINR } from '../../utils/payment';
import { SparePartLine, sumSparePartsTotal } from '../../utils/sparePartsCalc';

interface Props {
  parts?: SparePartLine[] | null;
  title?: string;
  compact?: boolean;
  showWithGst?: boolean;
  taxRate?: number;
}

export const SparePartsSummary: React.FC<Props> = ({
  parts,
  title = 'Extra parts (chargeable)',
  compact = false,
  showWithGst = false,
  taxRate = 0.18,
}) => {
  const total = sumSparePartsTotal(parts);
  if (!parts?.length || total <= 0) return null;
  const gstAmount = Math.round(total * taxRate);
  const totalWithGst = total + gstAmount;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact, !title && styles.wrapNoTitle]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {parts.map((p, i) => (
        <View key={`${p.name}-${i}`} style={styles.row}>
          <Text style={styles.name} numberOfLines={2}>
            {p.name}
            {(p.quantity ?? 1) > 1 ? ` × ${p.quantity}` : ''}
          </Text>
          <Text style={styles.cost}>
            {formatINR((p.quantity ?? 1) * (p.unitCost ?? 0))}
          </Text>
        </View>
      ))}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Extra parts total</Text>
        <Text style={styles.totalValue}>{formatINR(total)}</Text>
      </View>
      {showWithGst ? (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>
            Total with GST ({Math.round(taxRate * 100)}%)
          </Text>
          <Text style={styles.totalValue}>{formatINR(totalWithGst)}</Text>
        </View>
      ) : null}
      <Text style={styles.hint}>
        {showWithGst
          ? 'Pay this amount after your base service invoice is settled.'
          : 'Included in your invoice total when billed.'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  wrapCompact: {
    marginTop: 8,
    paddingTop: 8,
  },
  wrapNoTitle: {
    marginTop: 0,
    paddingTop: 0,
    borderTopWidth: 0,
  },
  title: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    color: COLORS.red,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 6,
  },
  name: {
    flex: 1,
    flexShrink: 1,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 17,
  },
  cost: {
    flexShrink: 0,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    color: COLORS.white,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  totalLabel: {
    flexShrink: 1,
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: COLORS.white,
  },
  totalValue: {
    flexShrink: 0,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: COLORS.red,
    textAlign: 'right',
  },
  hint: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 10,
    color: COLORS.grayDark,
    marginTop: 6,
    fontStyle: 'italic',
  },
});
