import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookingFlowHeader } from '../../../components/booking/BookingFlowHeader';
import {
  EXTRA_PARTS_CHARGE_NOTE,
  GENERAL_SERVICE_INCLUSIONS,
  GENERAL_SERVICE_ITEMS,
  GENERAL_SERVICE_PACKAGE,
  GENERAL_SERVICE_PRICE,
  GENERAL_VISIT_INCLUSIONS,
  GENERAL_VISIT_ITEM,
  GENERAL_VISIT_PRICE,
} from '../../../constants/audioServices';
import { useBookingDraft } from '../../../context/BookingDraftContext';
import { COLORS } from '../../../constants/colors';

type ServiceKind = 'general-service' | 'general-visit';

interface Props {
  navigation: any;
  route?: { params?: { kind?: ServiceKind } };
}

const FOOTER_TOP_PAD = 20;
const CONTINUE_BTN_HEIGHT = 52;

export const ServiceSubcategoriesScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const { addCategory, removeCategory } = useBookingDraft();
  const kind: ServiceKind =
    route?.params?.kind === 'general-visit' ? 'general-visit' : 'general-service';
  const isVisit = kind === 'general-visit';

  const title = isVisit ? 'General Visit' : 'General Service';
  const hint = isVisit
    ? 'Your General Visit covers the following.'
    : 'Your General Service package covers the following.';
  const inclusions = isVisit
    ? GENERAL_VISIT_INCLUSIONS
    : GENERAL_SERVICE_INCLUSIONS;
  const subtotal = isVisit ? GENERAL_VISIT_PRICE : GENERAL_SERVICE_PRICE;

  const footerBottomPad = Math.max(insets.bottom, 16);
  const footerHeight = FOOTER_TOP_PAD + CONTINUE_BTN_HEIGHT + footerBottomPad;
  // Extra gap so the charge note sits fully above the sticky CONTINUE bar.
  const scrollBottomPad = footerHeight + 28;

  const continueFlow = () => {
    GENERAL_SERVICE_ITEMS.forEach((s) => removeCategory(s.id));
    removeCategory(GENERAL_SERVICE_PACKAGE.id);
    removeCategory(GENERAL_VISIT_ITEM.id);
    addCategory(isVisit ? GENERAL_VISIT_ITEM.id : GENERAL_SERVICE_PACKAGE.id);
    navigation.navigate('PlaceOrder');
  };

  return (
    <View style={styles.container}>
      <BookingFlowHeader title={title} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPad }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>WHAT'S INCLUDED</Text>
        <Text style={styles.hint}>{hint}</Text>

        {inclusions.map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons
                name={item.icon as keyof typeof Ionicons.glyphMap}
                size={22}
                color={COLORS.red}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{item.label}</Text>
              <Text style={styles.rowDesc}>{item.description}</Text>
            </View>
          </View>
        ))}

        <View style={styles.subtotalRow}>
          <Text style={styles.subtotalLabel}>Subtotal</Text>
          <Text style={styles.subtotalValue}>{subtotal} + GST</Text>
        </View>

        <View style={styles.chargeNote}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={COLORS.gray}
            style={styles.chargeNoteIcon}
          />
          <Text style={styles.chargeNoteText}>{EXTRA_PARTS_CHARGE_NOTE}</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: footerBottomPad }]}>
        <TouchableOpacity style={styles.continueBtn} onPress={continueFlow}>
          <Text style={styles.continueText}>CONTINUE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 20, paddingTop: 20 },
  sectionLabel: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    color: COLORS.grayDark,
    letterSpacing: 2,
    marginBottom: 6,
  },
  hint: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 24,
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 14,
    gap: 14,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: COLORS.redMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  rowText: { flex: 1 },
  rowTitle: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.white,
    lineHeight: 22,
  },
  rowDesc: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 6,
    lineHeight: 20,
  },
  subtotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.borderActive,
    backgroundColor: 'rgba(142, 48, 47, 0.06)',
  },
  subtotalLabel: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  subtotalValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: COLORS.red,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: FOOTER_TOP_PAD,
    paddingHorizontal: 20,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  continueBtn: {
    height: CONTINUE_BTN_HEIGHT,
    backgroundColor: COLORS.red,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 13,
    color: COLORS.white,
    letterSpacing: 2,
  },
  chargeNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 16,
    padding: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chargeNoteIcon: {
    marginTop: 1,
  },
  chargeNoteText: {
    flex: 1,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 20,
  },
});
