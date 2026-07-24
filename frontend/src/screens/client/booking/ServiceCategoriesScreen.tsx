import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { BookingFlowHeader } from '../../../components/booking/BookingFlowHeader';
import { ThemedConfirmModal } from '../../../components/common/ThemedConfirmModal';
import {
  EXTRA_PARTS_CHARGE_NOTE,
  SERVICE_GROUPS,
} from '../../../constants/audioServices';
import { useBookingDraft } from '../../../context/BookingDraftContext';
import { bookingService, Booking } from '../../../services/bookings';
import {
  formatServiceTypeLabel,
  getTechnicianFromBooking,
} from '../../../utils/bookingDisplay';
import { formatBookingSchedule } from '../../../utils/schedule';
import { COLORS } from '../../../constants/colors';

interface Props {
  navigation: any;
  route?: { params?: { preselect?: string; reset?: boolean } };
}

type PendingAction =
  | { kind: 'group'; groupId: string; hasSubmenu: boolean }
  | { kind: 'preselect'; value: 'general-visit' | 'general-service' };

function bookingSortKey(b: Booking): number {
  const d = new Date(b.scheduledDate).getTime();
  return Number.isFinite(d) ? d : Number.MAX_SAFE_INTEGER;
}

function isActiveUpcoming(b: Booking): boolean {
  return !['completed', 'cancelled'].includes(b.status);
}

export const ServiceCategoriesScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const { addCategory, resetDraft } = useBookingDraft();
  const preselect = route?.params?.preselect;
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [latestUpcoming, setLatestUpcoming] = useState<Booking | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null
  );

  const loadLatestUpcoming = useCallback(async (): Promise<Booking | null> => {
    try {
      const bookings = await bookingService.getMyBookings({ limit: 20 });
      const upcoming = bookings
        .filter(isActiveUpcoming)
        .sort((a, b) => bookingSortKey(a) - bookingSortKey(b));
      const next = upcoming[0] ?? null;
      setLatestUpcoming(next);
      return next;
    } catch {
      setLatestUpcoming(null);
      return null;
    }
  }, []);

  const proceedAction = useCallback(
    (action: PendingAction) => {
      if (action.kind === 'group') {
        if (action.hasSubmenu) {
          navigation.navigate('ServiceSubcategories', {
            kind: action.groupId,
          });
        } else {
          addCategory(action.groupId);
          navigation.navigate('PlaceOrder');
        }
        return;
      }
      navigation.navigate('ServiceSubcategories', { kind: action.value });
    },
    [addCategory, navigation]
  );

  const requestBook = useCallback(
    (action: PendingAction, existing: Booking | null) => {
      if (existing) {
        setPendingAction(action);
        return;
      }
      proceedAction(action);
    },
    [proceedAction]
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      if (route?.params?.reset) {
        resetDraft();
      }

      const incomingPreselect = route?.params?.preselect;
      // Consume one-shot params so remount/refocus does not auto-repeat.
      if (route?.params?.reset || incomingPreselect) {
        navigation.setParams?.({ reset: undefined, preselect: undefined });
      }

      void (async () => {
        const existing = await loadLatestUpcoming();
        if (cancelled) return;

        if (
          incomingPreselect === 'general-visit' ||
          incomingPreselect === 'general-service'
        ) {
          requestBook(
            { kind: 'preselect', value: incomingPreselect },
            existing
          );
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [
      loadLatestUpcoming,
      navigation,
      requestBook,
      resetDraft,
      route?.params?.preselect,
      route?.params?.reset,
    ])
  );

  const onSelectGroup = (groupId: string, hasSubmenu: boolean) => {
    requestBook({ kind: 'group', groupId, hasSubmenu }, latestUpcoming);
  };

  const tech = latestUpcoming
    ? getTechnicianFromBooking(latestUpcoming)
    : null;

  const confirmMessage = latestUpcoming
    ? `Are you sure you want to book another service? You have already booked a service for ${formatBookingSchedule(
        latestUpcoming.scheduledDate,
        latestUpcoming.scheduledTime
      )}.`
    : 'Are you sure you want to book another service?';

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
        <Text style={styles.sectionTitle}>Book a service</Text>

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
              {group.id === 'general-service' ? (
                <Text style={styles.cardMeta}>
                  Tuning · Amplifier Rack · Damage Check
                </Text>
              ) : null}
              {group.id === 'general-visit' ? (
                <Text style={styles.cardMeta}>
                  Assessment · Diagnostics · Recommendations
                </Text>
              ) : null}
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={COLORS.grayDark}
            />
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => setUpcomingOpen((o) => !o)}
          activeOpacity={0.85}
        >
          <Text style={styles.sectionTitleInline}>Upcoming service</Text>
          <Ionicons
            name={upcomingOpen ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={COLORS.gray}
          />
        </TouchableOpacity>

        {upcomingOpen ? (
          latestUpcoming ? (
            <TouchableOpacity
              style={styles.upcomingCard}
              onPress={() =>
                navigation.navigate('TrackService', { id: latestUpcoming._id })
              }
              activeOpacity={0.88}
            >
              <Text style={styles.upcomingType}>
                {formatServiceTypeLabel(latestUpcoming.serviceType)}
              </Text>
              <Text style={styles.upcomingMeta}>
                {latestUpcoming.venueId?.name ?? 'Venue'}
              </Text>
              <Text style={styles.upcomingMeta}>
                {formatBookingSchedule(
                  latestUpcoming.scheduledDate,
                  latestUpcoming.scheduledTime
                )}
              </Text>
              {tech ? (
                <Text style={styles.upcomingTech}>{tech.name}</Text>
              ) : (
                <Text style={styles.upcomingTechMuted}>Awaiting technician</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.upcomingEmpty}>
              <Text style={styles.upcomingEmptyText}>
                No upcoming services. Book one above.
              </Text>
            </View>
          )
        ) : null}

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

      <ThemedConfirmModal
        visible={!!pendingAction}
        title="Book another service?"
        message={confirmMessage}
        confirmLabel="YES, CONTINUE"
        cancelLabel="GO BACK"
        icon="calendar-outline"
        onConfirm={() => {
          const action = pendingAction;
          setPendingAction(null);
          if (action) proceedAction(action);
        }}
        onCancel={() => setPendingAction(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, paddingBottom: 40, gap: 16 },
  sectionTitle: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.white,
    marginBottom: 6,
    lineHeight: 22,
  },
  sectionTitleInline: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.white,
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
    lineHeight: 20,
  },
  cardMeta: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    color: COLORS.grayDark,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingVertical: 8,
  },
  upcomingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  upcomingType: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 15,
    color: COLORS.white,
  },
  upcomingMeta: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 6,
  },
  upcomingTech: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: COLORS.grayLight,
    marginTop: 10,
  },
  upcomingTechMuted: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.grayDark,
    marginTop: 10,
  },
  upcomingEmpty: {
    padding: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  upcomingEmptyText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
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
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 20,
  },
});
