import React, { useState } from 'react';
import {
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import { AtomikLogo } from '../../components/common/AtomikLogo';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { FadeIn } from '../../components/common/FadeIn';
import { PhoneOtpVerification } from '../../components/auth/PhoneOtpVerification';
import { Screen } from '../../components/common/Screen';
import { useLayoutInsets } from '../../hooks/useLayoutInsets';
import { keyboardBehavior } from '../../utils/layout';
import { authService, OtpPurpose } from '../../services/auth';
import { setAuth } from '../../store/authSlice';
import { COLORS } from '../../constants/colors';

interface Props {
  navigation: any;
  route: {
    params: {
      mode: 'login' | 'signup';
      role: 'client' | 'technician';
    };
  };
}

export const PhoneAuthScreen: React.FC<Props> = ({ navigation, route }) => {
  const { mode, role } = route.params;
  const isTechnician = role === 'technician';
  const isSignup = mode === 'signup';
  const dispatch = useDispatch();
  const { topBarStyle, scrollBottomPadding } = useLayoutInsets();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const otpPurpose: OtpPurpose = isSignup
    ? isTechnician
      ? 'technician_signup'
      : 'signup'
    : isTechnician
      ? 'technician_login'
      : 'login';

  const validatePhone = () => {
    const digits = phone.replace(/\D/g, '');
    if (!phone.trim()) return 'Phone number is required';
    if (digits.length < 10) return 'Enter a valid 10-digit phone number';
    return '';
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (isSignup && !name.trim()) e.name = 'Full name is required';
    if (isSignup && email.trim() && !/\S+@\S+\.\S+/.test(email)) {
      e.email = 'Invalid email';
    }
    const phoneErr = validatePhone();
    if (phoneErr) e.phone = phoneErr;
    if (!phoneVerified) e.otp = 'Verify your phone number with OTP first';
    else if (!otp.trim() || otp.trim().length !== 6) e.otp = 'Enter the 6-digit code';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!phoneVerified) return;
    if (!validate()) return;
    setLoading(true);
    try {
      let data;
      if (isSignup && isTechnician) {
        data = await authService.registerTechnician({
          name: name.trim(),
          phone,
          otp,
          email: email.trim() || undefined,
        });
      } else if (!isSignup) {
        data = await authService.loginWithPhone(phone, otp, role);
      } else {
        Alert.alert('Use Create Account', 'Client sign-up uses email and password on the main screen.');
        return;
      }
      dispatch(
        setAuth({
          user: data.user,
          token: data.token,
          isOnboarded: data.isOnboarded,
        })
      );
    } catch (err: any) {
      Alert.alert(
        isSignup ? 'Registration Failed' : 'Sign In Failed',
        err.message || 'Please try again'
      );
    } finally {
      setLoading(false);
    }
  };

  const title = isSignup
    ? isTechnician
      ? 'Technician Sign Up'
      : 'Sign Up'
    : isTechnician
      ? 'Technician Sign In'
      : 'Sign In with Phone';

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={keyboardBehavior}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: topBarStyle.paddingTop, paddingBottom: scrollBottomPadding },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={20} color={COLORS.gray} />
            <Text style={styles.backText}>BACK</Text>
          </TouchableOpacity>

          <FadeIn index={0} style={styles.header}>
            <AtomikLogo size="lg" />
          </FadeIn>

          <FadeIn index={1} style={styles.form}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.desc}>
              {isTechnician
                ? 'Phone OTP only — email optional, no password'
                : 'We will send a one-time code to your mobile number'}
            </Text>

            {isSignup ? (
              <Input
                label="Full Name"
                placeholder="Your full name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                icon="person-outline"
                error={errors.name}
              />
            ) : null}

            {isSignup && isTechnician ? (
              <Input
                label="Email (optional)"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                icon="mail-outline"
                error={errors.email}
              />
            ) : null}

            <Input
              label="Phone Number"
              placeholder="+91 98765 43210"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              icon="call-outline"
              error={errors.phone}
              editable={!phoneVerified}
            />

            <PhoneOtpVerification
              phone={phone}
              purpose={otpPurpose}
              phoneError={errors.phone}
              otpError={errors.otp}
              onClearOtpError={() => setErrors((prev) => ({ ...prev, otp: '' }))}
              onVerifiedChange={setPhoneVerified}
              onOtpChange={setOtp}
            />

            <Button
              label={isSignup ? 'CREATE TECHNICIAN ACCOUNT' : 'SIGN IN'}
              onPress={handleSubmit}
              loading={loading}
              disabled={!phoneVerified || loading}
              style={{ marginTop: 8 }}
            />

            {isTechnician && !isSignup ? (
              <TouchableOpacity
                style={styles.footerLink}
                onPress={() =>
                  navigation.replace('PhoneAuth', { mode: 'signup', role: 'technician' })
                }
              >
                <Text style={styles.footerLinkText}>New technician? Register here</Text>
              </TouchableOpacity>
            ) : null}
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 28 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  backText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    color: COLORS.gray,
    letterSpacing: 2,
  },
  header: { alignItems: 'center', marginBottom: 32 },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 24,
    color: COLORS.white,
    marginBottom: 6,
  },
  desc: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 28,
    lineHeight: 18,
  },
  form: { flex: 1 },
  footerLink: { marginTop: 20, alignItems: 'center' },
  footerLinkText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: COLORS.red,
  },
});
