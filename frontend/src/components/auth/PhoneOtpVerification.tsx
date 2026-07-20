import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { authService, OtpPurpose } from '../../services/auth';
import { COLORS } from '../../constants/colors';
import { formatRateLimitMessage } from '../../utils/rateLimitMessage';

interface Props {
  phone: string;
  purpose: OtpPurpose;
  onVerifiedChange?: (verified: boolean) => void;
  onOtpChange?: (otp: string) => void;
  phoneError?: string;
  otpError?: string;
  onClearOtpError?: () => void;
  /** Shown under the send button after phone is verified */
  verifiedHint?: string;
}

function isAccountExistsError(err: {
  message?: string;
  status?: number;
}): boolean {
  const lower = String(err?.message || '').toLowerCase();
  return (
    err?.status === 409 ||
    lower.includes('already registered') ||
    lower.includes('already exists')
  );
}

function friendlyOtpSendError(
  err: { message?: string; status?: number; retryAfter?: number },
  purpose: OtpPurpose
): string {
  const raw = String(err?.message || '').trim();
  const lower = raw.toLowerCase();

  if (isAccountExistsError(err)) {
    return 'Account already exists';
  }

  if (err?.status === 404 || lower.includes('no account found')) {
    return purpose === 'forgot_password'
      ? 'No account found for this phone number. Check the number or create an account.'
      : raw || 'No account found for this phone number.';
  }

  return formatRateLimitMessage(err, raw || 'Could not send verification code');
}

export const PhoneOtpVerification: React.FC<Props> = ({
  phone,
  purpose,
  onVerifiedChange,
  onOtpChange,
  phoneError,
  otpError,
  onClearOtpError,
  verifiedHint = 'Phone verified — you can continue',
}) => {
  const navigation = useNavigation<any>();
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [localOtpError, setLocalOtpError] = useState('');
  const [accountExistsOpen, setAccountExistsOpen] = useState(false);
  const verifyLock = useRef(false);
  const sendLock = useRef(false);

  const digits = phone.replace(/\D/g, '');
  const phoneReady = digits.length >= 10;

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    setOtpSent(false);
    setOtp('');
    setPhoneVerified(false);
    setLocalOtpError('');
    setResendIn(0);
    setAccountExistsOpen(false);
    verifyLock.current = false;
    sendLock.current = false;
    onVerifiedChange?.(false);
    onOtpChange?.('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits, purpose]);

  const setVerified = useCallback(
    (value: boolean) => {
      setPhoneVerified(value);
      onVerifiedChange?.(value);
    },
    [onVerifiedChange]
  );

  const handleSendOtp = async () => {
    if (!phoneReady || phoneVerified || sendingOtp || resendIn > 0) return;
    if (sendLock.current) return;
    sendLock.current = true;

    setSendingOtp(true);
    setLocalOtpError('');
    onClearOtpError?.();
    setOtp('');
    onOtpChange?.('');

    try {
      const result = await authService.sendOtp(phone, purpose);
      setOtpSent(true);
      setResendIn(result.resendAfter || 30);
    } catch (err: any) {
      if (isAccountExistsError(err)) {
        setOtpSent(false);
        setResendIn(0);
        setLocalOtpError('');
        setAccountExistsOpen(true);
      } else if (typeof err.retryAfter === 'number' && err.retryAfter > 0) {
        setOtpSent(true);
        setResendIn(err.retryAfter);
        setLocalOtpError(friendlyOtpSendError(err, purpose));
      } else {
        setOtpSent(false);
        setResendIn(0);
        setLocalOtpError(friendlyOtpSendError(err, purpose));
      }
    } finally {
      setSendingOtp(false);
      sendLock.current = false;
    }
  };

  const handleVerify = useCallback(async () => {
    const code = otp.trim();
    if (!otpSent || phoneVerified) return;
    if (code.length !== 6) {
      setLocalOtpError('Enter the 6-digit code');
      return;
    }
    if (verifyLock.current) return;
    verifyLock.current = true;
    setVerifying(true);
    setLocalOtpError('');
    onClearOtpError?.();
    try {
      await authService.verifyOtp(phone, code, purpose);
      setVerified(true);
      onOtpChange?.(code);
    } catch (err: any) {
      setLocalOtpError(
        formatRateLimitMessage(err, 'Invalid verification code')
      );
      setVerified(false);
    } finally {
      setVerifying(false);
      verifyLock.current = false;
    }
  }, [
    otp,
    otpSent,
    onClearOtpError,
    phone,
    phoneVerified,
    purpose,
    setVerified,
    onOtpChange,
  ]);

  useEffect(() => {
    if (!otpSent || phoneVerified || otp.trim().length !== 6) return;
    const timer = setTimeout(() => {
      handleVerify();
    }, 400);
    return () => clearTimeout(timer);
  }, [otp, otpSent, phoneVerified, handleVerify]);

  const displayOtpError = otpError || localOtpError;

  const sendLabel = phoneVerified
    ? 'VERIFIED'
    : otpSent
      ? resendIn > 0
        ? `RESEND IN ${resendIn}s`
        : 'RESEND OTP'
      : 'SEND OTP';

  const goSignIn = () => {
    setAccountExistsOpen(false);
    navigation.navigate('Login');
  };

  const goForgotPassword = () => {
    setAccountExistsOpen(false);
    navigation.navigate('ForgotPassword');
  };

  return (
    <View style={styles.root}>
      <View style={styles.otpRow}>
        <Button
          label={sendLabel}
          onPress={handleSendOtp}
          loading={sendingOtp && !phoneVerified}
          verified={phoneVerified}
          disabled={
            !phoneReady || phoneVerified || sendingOtp || resendIn > 0
          }
          variant="outline"
          style={styles.otpBtn}
        />
        {displayOtpError && !otpSent ? (
          <Text style={styles.errorText}>{displayOtpError}</Text>
        ) : (
          <Text style={styles.otpHint}>
            {phoneVerified
              ? verifiedHint
              : otpSent
                ? 'Enter the 6-digit code from SMS, then tap Enter OTP'
                : phoneError
                  ? ''
                  : phoneReady
                    ? 'We will text you a 6-digit code'
                    : 'Enter your 10-digit mobile number to receive OTP'}
          </Text>
        )}
      </View>

      {otpSent && !phoneVerified ? (
        <>
          <Input
            label="Verification Code"
            placeholder="6-digit OTP"
            value={otp}
            onChangeText={(value) => {
              const next = value.replace(/\D/g, '').slice(0, 6);
              setOtp(next);
              onOtpChange?.(next);
              setLocalOtpError('');
              onClearOtpError?.();
            }}
            keyboardType="numeric"
            icon="keypad-outline"
            error={displayOtpError}
          />
          <Button
            label={verifying ? 'VERIFYING…' : 'ENTER OTP'}
            onPress={handleVerify}
            loading={verifying}
            disabled={verifying || otp.trim().length !== 6}
            style={styles.verifyBtn}
          />
        </>
      ) : null}

      <Modal
        visible={accountExistsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAccountExistsOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setAccountExistsOpen(false)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalIcon}>
              <Ionicons
                name="person-circle-outline"
                size={42}
                color={COLORS.red}
              />
            </View>
            <Text style={styles.modalTitle}>Account already exists</Text>
            <Text style={styles.modalBody}>
              This phone number is already registered. Sign in with your
              password, or reset it if you forgot.
            </Text>
            <TouchableOpacity style={styles.modalPrimary} onPress={goSignIn}>
              <Text style={styles.modalPrimaryText}>SIGN IN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSecondary}
              onPress={goForgotPassword}
            >
              <Text style={styles.modalSecondaryText}>FORGOT PASSWORD</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setAccountExistsOpen(false)}
              style={styles.modalDismiss}
            >
              <Text style={styles.modalDismissText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    marginTop: -4,
  },
  otpRow: {
    marginBottom: 12,
    gap: 8,
  },
  otpBtn: {
    alignSelf: 'stretch',
  },
  otpHint: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 16,
  },
  errorText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: COLORS.red,
    textAlign: 'center',
    lineHeight: 18,
  },
  verifyBtn: {
    marginTop: -4,
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  modalCard: {
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
  modalIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.redMuted,
    borderWidth: 1,
    borderColor: COLORS.borderActive,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 10,
  },
  modalBody: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },
  modalPrimary: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 8,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  modalPrimaryText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: COLORS.white,
    letterSpacing: 1.5,
  },
  modalSecondary: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderActive,
    backgroundColor: COLORS.redMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  modalSecondaryText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: COLORS.white,
    letterSpacing: 1.2,
  },
  modalDismiss: {
    paddingVertical: 10,
  },
  modalDismissText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 13,
    color: COLORS.gray,
  },
});
