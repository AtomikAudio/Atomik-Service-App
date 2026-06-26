import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { AccountScreenLayout } from '../../components/common/AccountScreenLayout';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { PhoneOtpVerification } from '../../components/auth/PhoneOtpVerification';
import { COLORS } from '../../constants/colors';
import { authService } from '../../services/auth';

interface Props {
  navigation: any;
}

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const phoneDigits = phone.replace(/\D/g, '');
  const hasValidPhone = phoneDigits.length >= 10;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!phoneVerified) e.otp = 'Verify your phone number with OTP first';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Minimum 8 characters';
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleReset = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await authService.resetPasswordWithPhone(phone, otp, password);
      setDone(true);
    } catch (err: any) {
      Alert.alert('Reset Failed', err.message || 'Could not reset your password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AccountScreenLayout title="Reset Password" keyboard>
      {!done ? (
        <>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🔐</Text>
          </View>
          <Text style={styles.title}>Forgot Password?</Text>
          <Text style={styles.desc}>
            Enter your registered mobile number. We'll send you a 6-digit OTP to
            verify it's you, then you can set a new password.
          </Text>

          <Input
            label="Phone Number"
            placeholder="+91 94146 18209"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            icon="call-outline"
            error={errors.phone}
            editable={!phoneVerified}
          />

          {hasValidPhone ? (
            <PhoneOtpVerification
              phone={phone}
              purpose="forgot_password"
              otpError={errors.otp}
              onClearOtpError={() => setErrors((prev) => ({ ...prev, otp: '' }))}
              onVerifiedChange={setPhoneVerified}
              onOtpChange={setOtp}
            />
          ) : (
            <Text style={styles.hint}>
              Enter your 10-digit mobile number to receive OTP.
            </Text>
          )}

          {phoneVerified ? (
            <>
              <Input
                label="New Password"
                placeholder="Create a strong password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                icon="lock-closed-outline"
                error={errors.password}
              />

              <Input
                label="Confirm New Password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                icon="shield-checkmark-outline"
                error={errors.confirmPassword}
              />

              <Button
                label="RESET PASSWORD"
                onPress={handleReset}
                loading={loading}
                disabled={loading}
                style={{ marginTop: 8 }}
              />
            </>
          ) : null}

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
            <Text style={styles.backLinkText}>← Go back</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Text style={styles.successEmoji}>✅</Text>
          </View>
          <Text style={styles.successTitle}>Password Updated</Text>
          <Text style={styles.successDesc}>
            Your password has been reset successfully.{'\n'}
            You can now log in with your new password.
          </Text>
          <Button
            label="BACK TO LOGIN"
            onPress={() => navigation.goBack()}
            style={{ marginTop: 32 }}
          />
        </View>
      )}
    </AccountScreenLayout>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 24,
    color: COLORS.white,
    marginBottom: 12,
  },
  desc: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 22,
    marginBottom: 32,
  },
  hint: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 12,
    marginTop: -4,
  },
  successContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successEmoji: {
    fontSize: 36,
  },
  successTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 22,
    color: COLORS.white,
    marginBottom: 12,
    textAlign: 'center',
  },
  successDesc: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 22,
  },
  backLink: {
    marginTop: 32,
    alignSelf: 'center',
  },
  backLinkText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 13,
    color: COLORS.gray,
  },
});
