import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BookingFlowHeader } from '../../../components/booking/BookingFlowHeader';
import {
  EXTRA_PARTS_CHARGE_NOTE,
  SERVICE_GROUPS,
} from '../../../constants/audioServices';
import { useBookingDraft } from '../../../context/BookingDraftContext';
import { COLORS } from '../../../constants/colors';

interface Props {
  navigation: any;
  route?: { params?: { preselect?: string; reset?: boolean } };
}

export const ServiceCategoriesScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const { addCategory, resetDraft } = useBookingDraft();
  const preselect = route?.params?.preselect;

  useEffect(() => {
    if (route?.params?.reset) resetDraft();
    if (preselect === 'general-visit') {
      addCategory('general-visit');
      navigation.replace('PlaceOrder');
    } else if (preselect === 'general-service') {
      navigation.replace('ServiceSubcategories');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSelectGroup = (groupId: string, hasSubmenu: boolean) => {
    if (hasSubmenu) {
      navigation.navigate('ServiceSubcategories');
    } else {
      addCategory(groupId);
      navigation.navigate('PlaceOrder');
    }
  };

  return (
    <View style={styles.container}>
      <BookingFlowHeader
        title="Categories"
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.hint}>Select a service type for your booking.</Text>

        {SERVICE_GROUPS.map((group) => (
          <TouchableOpacity
            key={group.id}
            style={styles.card}
            onPress={() => onSelectGroup(group.id, group.hasSubmenu)}
            activeOpacity={0.88}
          >
            <View style={styles.iconWrap}>
              <Ionicons
                name={group.icon as keyof typeof Ionicons.glyphMap}
                size={28}
                color={COLORS.red}
              />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{group.label}</Text>
              <Text style={styles.cardDesc}>{group.description}</Text>
              {group.hasSubmenu && (
                <Text style={styles.cardMeta}>
                  Tuning · Amplifier Rack · Damage Check
                </Text>
              )}
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={COLORS.grayDark}
            />
          </TouchableOpacity>
        ))}

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, paddingBottom: 40, gap: 14 },
  hint: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    color: COLORS.gray,
    letterSpacing: 0.3,
    marginBottom: 8,
    lineHeight: 15,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    gap: 16,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: COLORS.redMuted,
    borderWidth: 1,
    borderColor: 'rgba(142, 48, 47, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: COLORS.white,
    marginBottom: 4,
  },
  cardDesc: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 17,
  },
  cardMeta: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    color: COLORS.grayDark,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  chargeNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 8,
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
    fontSize: 11,
    color: COLORS.gray,
    lineHeight: 17,
  },
});
