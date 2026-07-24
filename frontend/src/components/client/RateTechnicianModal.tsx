import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

export function thankYouMessageForRating(rating: number): string {
  switch (rating) {
    case 1:
      return "We're sorry it fell short. Thank you for your honesty — we'll do better.";
    case 2:
      return 'Thank you for your rating. Your feedback helps us improve.';
    case 3:
      return 'Thank you for rating your service. We appreciate your feedback.';
    case 4:
      return 'Thank you! Glad your service went well.';
    case 5:
      return "Thank you! We're thrilled you had a great experience.";
    default:
      return 'Thank you for rating your service.';
  }
}

interface Props {
  visible: boolean;
  technicianName: string;
  loading?: boolean;
  onSubmit: (rating: number) => void | Promise<void>;
  onDismiss: () => void;
}

/**
 * Branded rate-technician dialog: 5 stars → thank-you message by rating.
 */
export const RateTechnicianModal: React.FC<Props> = ({
  visible,
  technicianName,
  loading = false,
  onSubmit,
  onDismiss,
}) => {
  const [rating, setRating] = useState(0);
  const [thanksRating, setThanksRating] = useState<number | null>(null);

  const title =
    thanksRating != null ? 'Thank you for rating' : 'Rate your service';

  const techLabel = technicianName?.trim() || 'your technician';
  const subtitle =
    thanksRating != null
      ? thankYouMessageForRating(thanksRating)
      : techLabel;

  const stars = useMemo(() => [1, 2, 3, 4, 5], []);

  const handleClose = () => {
    setRating(0);
    setThanksRating(null);
    onDismiss();
  };

  const handleSubmit = async () => {
    if (rating < 1 || loading) return;
    await onSubmit(rating);
    setThanksRating(rating);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={loading ? undefined : handleClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={loading || thanksRating != null ? undefined : handleClose}
      >
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <Ionicons
              name={
                thanksRating != null
                  ? 'checkmark-circle-outline'
                  : 'star-outline'
              }
              size={36}
              color={COLORS.red}
            />
          </View>

          <Text style={styles.title}>{title}</Text>
          {thanksRating == null ? (
            <Text style={styles.lead}>
              <Text style={styles.techName}>{subtitle}</Text>
            </Text>
          ) : (
            <Text style={styles.message}>{subtitle}</Text>
          )}


          {thanksRating == null ? (
            <>
              <View style={styles.starsRow}>
                {stars.map((n) => {
                  const filled = n <= rating;
                  return (
                    <TouchableOpacity
                      key={n}
                      onPress={() => setRating(n)}
                      disabled={loading}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
                    >
                      <Ionicons
                        name={filled ? 'star' : 'star-outline'}
                        size={36}
                        color={filled ? COLORS.red : COLORS.grayDark}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  (rating < 1 || loading) && styles.btnDisabled,
                ]}
                onPress={() => void handleSubmit()}
                disabled={rating < 1 || loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.primaryText}>SUBMIT RATING</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleClose}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryText}>MAYBE LATER</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleClose}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryText}>OKAY</Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.redMuted,
    borderWidth: 1,
    borderColor: COLORS.borderActive,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 10,
  },
  lead: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  techName: {
    fontFamily: 'Montserrat_700Bold',
    color: COLORS.white,
  },
  message: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 22,
  },
  primaryBtn: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 8,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  btnDisabled: { opacity: 0.45 },
  primaryText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: COLORS.white,
    letterSpacing: 1.5,
  },
  secondaryBtn: {
    alignSelf: 'stretch',
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: COLORS.grayLight,
    letterSpacing: 1.2,
  },
});
