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
import { AtomikLogo } from '../../components/common/AtomikLogo';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { FadeIn } from '../../components/common/FadeIn';
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

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useDispatch();
  const { topBarStyle, scrollBottomPadding } = useLayoutInsets();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    identifier?: string;
    password?: string;
  }>({});

  const validate = () => {
    const newErrors: { identifier?: string; password?: string } = {};
    if (!identifier.trim()) {
      newErrors.identifier = 'Email or phone number is required';
    }
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Minimum 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const data = await authService.login(identifier, password);
      dispatch(
        setAuth({
          user: data.user,
          token: data.token,
          isOnboarded: data.isOnboarded,
        })
      );
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Invalid credentials');
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
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.navigate('Splash')}
          >
            <Ionicons name="arrow-back" size={20} color={COLORS.gray} />
            <Text style={styles.backText}>BACK</Text>
          </TouchableOpacity>

          <FadeIn index={0} style={styles.header}>
            <AtomikLogo size="lg" />
          </FadeIn>

          <FadeIn index={1} style={styles.form}>
            <Text style={styles.title}>Sign in</Text>
            <Text style={styles.desc}>
              Use your email or phone number. Your role is assigned automatically.
            </Text>

            <Input
              label="Email or Phone"
              placeholder="you@example.com or +91 98765 43210"
              value={identifier}
              onChangeText={setIdentifier}
              keyboardType="default"
              autoCapitalize="none"
              icon="person-outline"
              error={errors.identifier}
            />

            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              icon="lock-closed-outline"
              error={errors.password}
            />

            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.forgotBtn}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <Button
              label="SIGN IN"
              onPress={handleLogin}
              loading={loading}
              style={{ marginTop: 8 }}
            />
          </FadeIn>

          <FadeIn index={2} style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.footerLink}>Create Account</Text>
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
    lineHeight: 18,
  },
  form: {
    flex: 1,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    marginTop: -4,
  },
  forgotText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: COLORS.gray,
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
