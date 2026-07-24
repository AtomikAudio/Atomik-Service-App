import React from 'react';
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
import { NoRefundPolicyNote } from './NoRefundPolicyNote';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDestructive?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Show no-refund policy strip (e.g. cancel paid booking). */
  showNoRefundPolicy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ThemedConfirmModal: React.FC<Props> = ({
  visible,
  title,
  message,
  confirmLabel = 'CONFIRM',
  cancelLabel = 'KEEP',
  confirmDestructive = false,
  loading = false,
  icon = 'alert-circle-outline',
  showNoRefundPolicy = false,
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={loading ? undefined : onCancel}
    >
      <Pressable
        style={styles.overlay}
        onPress={loading ? undefined : onCancel}
      >
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={36} color={COLORS.red} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              confirmDestructive && styles.destructiveBtn,
              loading && styles.btnDisabled,
            ]}
            onPress={onConfirm}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.primaryText}>{confirmLabel}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={onCancel}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryText}>{cancelLabel}</Text>
          </TouchableOpacity>

          {showNoRefundPolicy ? (
            <NoRefundPolicyNote style={styles.policyNote} />
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

interface AlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttonLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onClose: () => void;
}

/** Single-button themed alert (success / info). */
export const ThemedAlertModal: React.FC<AlertProps> = ({
  visible,
  title,
  message,
  buttonLabel = 'OK',
  icon = 'checkmark-circle-outline',
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={36} color={COLORS.red} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryText}>{buttonLabel}</Text>
          </TouchableOpacity>
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
  message: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 20,
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
  destructiveBtn: {
    backgroundColor: COLORS.redDark,
  },
  btnDisabled: {
    opacity: 0.7,
  },
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
  policyNote: {
    marginTop: 16,
  },
});
