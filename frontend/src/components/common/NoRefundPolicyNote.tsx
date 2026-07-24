import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS } from '../../constants/colors';

export const NO_REFUND_POLICY_TITLE = 'No refund policy';
export const NO_REFUND_POLICY_BODY =
  'All payments are final. Fees are non-refundable once paid.';

interface Props {
  style?: ViewStyle;
  /** Compact inline line for tight dialogs */
  compact?: boolean;
}

/** Aesthetic no-refund notice for payment / cancel confirmations. */
export const NoRefundPolicyNote: React.FC<Props> = ({
  style,
  compact = false,
}) => {
  if (compact) {
    return (
      <Text style={[styles.compact, style]}>
        {NO_REFUND_POLICY_TITLE} — {NO_REFUND_POLICY_BODY}
      </Text>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.title}>{NO_REFUND_POLICY_TITLE}</Text>
      <Text
        style={styles.body}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
      >
        {NO_REFUND_POLICY_BODY}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.ashGrayBorder,
    backgroundColor: COLORS.ashGrayBg,
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 10,
    color: COLORS.ashGray,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 4,
  },
  body: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 10,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 14,
  },
  compact: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: COLORS.ashGray,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
  },
});
