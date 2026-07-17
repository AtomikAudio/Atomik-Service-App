import React, { useState } from 'react';
import {
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { AtomikLogo } from '../../components/common/AtomikLogo';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { FadeIn } from '../../components/common/FadeIn';
import { PhoneOtpVerification } from '../../components/auth/PhoneOtpVerification';
import { COLORS } from '../../constants/colors';
import { Screen } from '../../components/common/Screen';
import { useLayoutInsets } from '../../hooks/useLayoutInsets';
import { keyboardBehavior } from '../../utils/layout';
import { authService } from '../../services/auth';
import { useDispatch } from 'react-redux';
import { setAuth } from '../../store/authSlice';

interface Props {
  navigation: any;
}

export const SignupScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useDispatch();
  const { topBarStyle, scrollBottomPadding } = useLayoutInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const phoneDigits = phone.replace(/\D/g, '');
  const hasValidPhone = phoneDigits.length >= 10;

  const validatePhone = () => {
    if (!phone.trim()) return 'Phone number is required';
    if (phoneDigits.length < 10) return 'Enter a valid 10-digit phone number';
    return '';
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Full name is required';
    if (email.trim() && !/\S+@\S+\.\S+/.test(email)) e.email = 'Invalid email';
    const phoneErr = validatePhone();
    if (phoneErr) e.phone = phoneErr;
    if (!phoneVerified) e.otp = 'Verify your phone number with OTP first';
    else if (!otp.trim() || otp.trim().length !== 6) e.otp = 'Enter the 6-digit code';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Minimum 8 characters';
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const canCreateAccount = hasValidPhone && phoneVerified;

  const handleSignup = async () => {
    if (!canCreateAccount) return;
    if (!validate()) return;
    setLoading(true);
    try {
      const data = await authService.register({
        name,
        email: email.trim() || undefined,
        phone,
        password,
        otp,
      });
      dispatch(
        setAuth({
          user: data.user,
          token: data.token,
          isOnboarded: data.isOnboarded,
        })
      );
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={keyboardBehavior}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: topBarStyle.paddingTop,
              paddingBottom: scrollBottomPadding,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeIn index={0} style={styles.header}>
            <AtomikLogo size="lg" />
          </FadeIn>

          <FadeIn index={1} style={styles.form}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.desc}>
              Verify your mobile number to join ATOMIK. Email is optional.
            </Text>

            <Input
              label="Full Name"
              placeholder="Your full name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              icon="person-outline"
              error={errors.name}
            />

            <Input
              label="Email Address (optional)"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              icon="mail-outline"
              error={errors.email}
            />

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
                purpose="signup"
                phoneError={errors.phone}
                otpError={errors.otp}
                onClearOtpError={() => setErrors((prev) => ({ ...prev, otp: '' }))}
                onVerifiedChange={setPhoneVerified}
                onOtpChange={setOtp}
              />
            ) : (
              <Text style={styles.hint}>Enter your 10-digit mobile number to receive OTP.</Text>
            )}

            <Input
              label="Password"
              placeholder="Create a strong password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              icon="lock-closed-outline"
              error={errors.password}
            />

            <Input
              label="Confirm Password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              icon="shield-checkmark-outline"
              error={errors.confirmPassword}
            />

            <Button
              label="CREATE ACCOUNT"
              onPress={handleSignup}
              loading={loading}
              disabled={!canCreateAccount || loading}
              style={{ marginTop: 8 }}
            />
          </FadeIn>

          <FadeIn index={2} style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.footerLink}>Log In</Text>
            </TouchableOpacity>
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 26,
    color: COLORS.white,
    marginBottom: 6,
  },
  desc: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
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
  form: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
  },
  footerLink: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: COLORS.red,
  },
});
