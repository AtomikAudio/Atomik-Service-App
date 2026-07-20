import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { BookingFlowHeader } from '../../../components/booking/BookingFlowHeader';
import { OrderActionRow } from '../../../components/booking/OrderActionRow';
import { useBookingDraft } from '../../../context/BookingDraftContext';
import { getServiceById } from '../../../constants/audioServices';
import { bookingService } from '../../../services/bookings';
import { COLORS } from '../../../constants/colors';
import { formatBookingDate, formatBookingTime } from '../../../utils/schedule';
import { useSlotHoldTimer } from '../../../hooks/useSlotHoldTimer';

interface Props {
  navigation: any;
}

export const PlaceOrderScreen: React.FC<Props> = ({ navigation }) => {
  const {
    draft,
    setDraft,
    removeCategory,
    canConfirm,
    primaryServiceType,
    requestLeaveBooking,
  } = useBookingDraft();
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(
    draft.slotHoldExpiresAt ?? null
  );

  // secondsLeft drives a re-render each second so holdActive re-evaluates.
  const secondsLeft = useSlotHoldTimer(holdExpiresAt);
  const holdActive =
    Boolean(holdExpiresAt) &&
    new Date(holdExpiresAt as string).getTime() > Date.now();

  const refreshHold = useCallback(async () => {
    // Prefer draft countdown so Payment → back still shows the timer even
    // after the server-side hold was consumed by place-order.
    if (draft.slotHoldExpiresAt) {
      const stillValid =
        new Date(draft.slotHoldExpiresAt).getTime() > Date.now();
      if (stillValid) {
        setHoldExpiresAt(draft.slotHoldExpiresAt);
        return;
      }
    }
    if (!draft.scheduledDate || !draft.scheduledTime) return;
    try {
      const hold = await bookingService.getMySlotHold();
      if (
        hold &&
        hold.scheduledDate === draft.scheduledDate.slice(0, 10) &&
        hold.displayTime === formatBookingTime(draft.scheduledTime)
      ) {
        setHoldExpiresAt(hold.expiresAt);
        setDraft((d) => ({ ...d, slotHoldExpiresAt: hold.expiresAt }));
      } else if (!draft.pendingBookingId) {
        setHoldExpiresAt(null);
      }
    } catch {
      setHoldExpiresAt(draft.slotHoldExpiresAt ?? null);
    }
  }, [
    draft.scheduledDate,
    draft.scheduledTime,
    draft.slotHoldExpiresAt,
    draft.pendingBookingId,
    setDraft,
  ]);

  useFocusEffect(
    useCallback(() => {
      refreshHold();
      const poll = setInterval(refreshHold, 15000);
      return () => clearInterval(poll);
    }, [refreshHold])
  );

  useEffect(() => {
    if (holdExpiresAt && new Date(holdExpiresAt).getTime() <= Date.now()) {
      setHoldExpiresAt(null);
    }
  }, [secondsLeft, holdExpiresAt]);

  const scheduleLabel =
    draft.scheduledDate && draft.scheduledTime
      ? `${formatBookingDate(draft.scheduledDate)} · ${formatBookingTime(draft.scheduledTime)} IST`
      : undefined;

  const isGeneralVisit =
    draft.categoryIds.length === 1 && draft.categoryIds[0] === 'general-visit';
  const isGeneralService =
    draft.categoryIds.length === 1 && draft.categoryIds[0] === 'general-service';
  const hideCategoryChips = isGeneralVisit || isGeneralService;
  const headerTitle = isGeneralVisit
    ? 'General Visit'
    : isGeneralService
      ? 'General Service'
      : 'Place order';

  const goToPayment = (bookingId: string, invoiceId: string) => {
    navigation.navigate('Payment', {
      serviceType: primaryServiceType(),
      bookingId,
      invoiceId,
      date: scheduleLabel,
      time: draft.scheduledTime,
      fromBookingFlow: true,
    });
  };

  const placeOrder = async () => {
    if (!canConfirm || !draft.venueId) return;

    // Already placed — return to checkout without creating a duplicate.
    if (draft.pendingBookingId && draft.pendingInvoiceId) {
      setModalVisible(false);
      goToPayment(draft.pendingBookingId, draft.pendingInvoiceId);
      return;
    }

    if (!holdActive) {
      Alert.alert(
        'Slot expired',
        'Your 5-minute reservation ended. Go back to Schedule and pick a slot again.',
        [{ text: 'OK', onPress: () => navigation.navigate('ScheduleBooking') }]
      );
      return;
    }
    setSubmitting(true);
    try {
      const notesParts = [
        draft.details,
        draft.categoryIds.length > 1
          ? `Services: ${draft.categoryIds.map((id) => getServiceById(id)?.label).join(', ')}`
          : null,
        draft.venueType ? `Venue type: ${draft.venueType}` : null,
        draft.indoorOutdoor ? `Environment: ${draft.indoorOutdoor}` : null,
      ].filter(Boolean);

      const { booking, invoice } = await bookingService.createBooking({
        serviceType: primaryServiceType(),
        venueId: draft.venueId,
        scheduledDate: draft.scheduledDate!,
        scheduledTime: formatBookingTime(draft.scheduledTime!),
        notes: notesParts.join('\n'),
      });

      setModalVisible(false);
      // Keep draft (details + timer) so Payment back restores Place Order.
      setDraft((d) => ({
        ...d,
        pendingBookingId: booking._id,
        pendingInvoiceId: invoice._id,
      }));
      goToPayment(booking._id, invoice._id);
    } catch (e: any) {
      Alert.alert('Order failed', e.message || 'Try again');
    } finally {
      setSubmitting(false);
    }
  };

  const askLeaveBooking = useCallback(() => {
    requestLeaveBooking(
      () => navigation.navigate('ServiceCategories', { reset: true }),
      { force: true }
    );
  }, [requestLeaveBooking, navigation]);

  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        askLeaveBooking();
        return true;
      };
      const sub = BackHandler.addEventListener(
        'hardwareBackPress',
        onHardwareBack
      );
      return () => sub.remove();
    }, [askLeaveBooking])
  );

  return (
    <View style={styles.container}>
      <BookingFlowHeader
        title={headerTitle}
        onBack={askLeaveBooking}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {holdActive ? (
          <View style={styles.holdBanner}>
            <Ionicons name="time-outline" size={18} color={COLORS.white} />
            <Text style={styles.holdBannerText}>
              Slot held — {Math.max(0, Math.ceil(secondsLeft / 60))} min left to
              confirm
            </Text>
          </View>
        ) : null}

        {!holdActive && draft.scheduledTime ? (
          <View style={styles.holdExpiredBanner}>
            <Text style={styles.holdExpiredText}>
              {draft.pendingBookingId
                ? 'Continue to payment to complete this booking, or update your schedule.'
                : 'Slot reservation expired — update your schedule before placing the order'}
            </Text>
            <TouchableOpacity
              onPress={() =>
                draft.pendingBookingId && draft.pendingInvoiceId
                  ? goToPayment(draft.pendingBookingId, draft.pendingInvoiceId)
                  : navigation.navigate('ScheduleBooking')
              }
            >
              <Text style={styles.holdExpiredLink}>
                {draft.pendingBookingId ? 'Go to Payment' : 'Go to Schedule'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!hideCategoryChips ? (
          <>
            <Text style={styles.sectionLabel}>CATEGORY</Text>
            <View style={styles.categoryRow}>
              {draft.categoryIds.map((id) => {
                const cat = getServiceById(id);
                if (!cat) return null;
                return (
                  <View key={id} style={styles.categoryChip}>
                    <Ionicons
                      name={cat.icon as keyof typeof Ionicons.glyphMap}
                      size={18}
                      color={COLORS.red}
                    />
                    <Text style={styles.chipText}>{cat.label}</Text>
                    <TouchableOpacity onPress={() => removeCategory(id)}>
                      <Ionicons name="close-circle" size={18} color={COLORS.gray} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {draft.addressLabel ? (
          <View style={styles.addressBlock}>
            <Text style={styles.sectionLabel}>VENUE</Text>
            <Text style={styles.addressText}>{draft.addressLabel}</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('SelectLocation')}
            >
              <Text style={styles.changeLink}>Change location</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <OrderActionRow
            icon="location-outline"
            label="Add address"
            onPress={() => navigation.navigate('SelectLocation')}
          />
        )}

        <OrderActionRow
          icon="calendar-outline"
          label="Schedule (IST)"
          value={scheduleLabel}
          onPress={() => navigation.navigate('ScheduleBooking')}
        />

        {draft.details ? (
          <View style={styles.filledBlock}>
            <Text style={styles.sectionLabel}>DETAILS</Text>
            <Text style={styles.detailsText}>{draft.details}</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('OrderDetails')}
            >
              <Text style={styles.changeLink}>Edit details</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <OrderActionRow
            icon="document-text-outline"
            label="Add details"
            onPress={() => navigation.navigate('OrderDetails')}
          />
        )}

        {draft.photos.length > 0 ? (
          <View style={styles.photoSection}>
            <View style={styles.sectionLabelRow}>
              <Text style={styles.sectionLabel}>REFERENCE PHOTOS</Text>
              <Text style={styles.optionalBadge}>Optional</Text>
            </View>
            <View style={styles.photoRow}>
              {draft.photos.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.thumb} />
              ))}
              <TouchableOpacity
                style={styles.addPhotoSlot}
                onPress={() => navigation.navigate('AddPhoto')}
              >
                <Ionicons name="add" size={24} color={COLORS.gray} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <OrderActionRow
            icon="images-outline"
            label="Add photos"
            optional
            onPress={() => navigation.navigate('AddPhoto')}
          />
        )}

        <Text style={styles.disclaimer}>
          Parts & labour beyond base scope are chargeable. GST applied at
          checkout.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.confirmBtn,
            (!canConfirm || (!holdActive && !draft.pendingBookingId)) &&
              styles.confirmDisabled,
          ]}
          disabled={!canConfirm || (!holdActive && !draft.pendingBookingId)}
          onPress={() => {
            if (draft.pendingBookingId && draft.pendingInvoiceId) {
              goToPayment(draft.pendingBookingId, draft.pendingInvoiceId);
              return;
            }
            setModalVisible(true);
          }}
        >
          <Text
            style={[
              styles.confirmText,
              !canConfirm && styles.confirmTextDisabled,
            ]}
          >
            {draft.pendingBookingId ? 'CONTINUE TO PAYMENT' : 'CONFIRM ORDER'}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons name="alert-circle" size={40} color="#e6b800" />
            </View>
            <Text style={styles.modalTitle}>Confirm order</Text>
            <Text style={styles.modalBody}>
              We’ll create your booking and open checkout. Complete payment to
              confirm — technicians are assigned only after payment succeeds.
            </Text>
            <TouchableOpacity
              style={styles.placeBtn}
              onPress={placeOrder}
              disabled={submitting}
            >
              <Text style={styles.placeBtnText}>
                {submitting ? 'PROCESSING…' : 'PLACE ORDER'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelModal}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, paddingBottom: 120 },
  holdBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.red,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  holdBannerText: {
    flex: 1,
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: COLORS.white,
  },
  holdExpiredBanner: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 4,
    padding: 12,
    marginBottom: 20,
  },
  holdExpiredText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: COLORS.red,
    marginBottom: 6,
  },
  holdExpiredLink: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: COLORS.red,
  },
  sectionLabel: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    color: COLORS.grayDark,
    letterSpacing: 2,
    marginBottom: 10,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  optionalBadge: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 8,
    color: COLORS.grayDark,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 3,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderActive,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: COLORS.white,
  },
  addressBlock: {
    marginBottom: 16,
    padding: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addressText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    color: COLORS.gray,
    lineHeight: 16,
  },
  changeLink: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: COLORS.red,
    marginTop: 8,
  },
  filledBlock: {
    marginBottom: 16,
    padding: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailsText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 20,
  },
  photoSection: { marginBottom: 16 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 4,
    backgroundColor: COLORS.surface,
  },
  addPhotoSlot: {
    width: 72,
    height: 72,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimer: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 8,
    color: COLORS.grayDark,
    marginTop: 8,
    lineHeight: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 32,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  confirmBtn: {
    height: 52,
    backgroundColor: COLORS.red,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDisabled: {
    backgroundColor: COLORS.surface,
  },
  confirmText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 13,
    color: COLORS.white,
    letterSpacing: 2,
  },
  confirmTextDisabled: {
    color: COLORS.grayDark,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    padding: 28,
    alignItems: 'center',
  },
  modalIcon: { marginBottom: 16 },
  modalTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: COLORS.white,
    marginBottom: 10,
  },
  modalBody: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  placeBtn: {
    width: '100%',
    height: 52,
    backgroundColor: COLORS.red,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  placeBtnText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 13,
    color: COLORS.white,
    letterSpacing: 2,
  },
  cancelModal: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 13,
    color: COLORS.gray,
    paddingVertical: 8,
  },
});
