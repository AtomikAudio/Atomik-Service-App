import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/colors';
import { Screen } from '../../components/common/Screen';
import { useLayoutInsets } from '../../hooks/useLayoutInsets';
import { PressableScale } from '../../components/common/PressableScale';
import { EASE_OUT } from '../../utils/motion';

const { width, height } = Dimensions.get('window');

/** Native asset is 960×480 (@3x) — keep display width ≤ 320pt for sharp rendering */
const LOGO_W = Math.min(width * 0.78, 300);
const LOGO_H = LOGO_W / 2;

interface Props {
  navigation: any;
}

export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  const { bottom: bottomInset } = useLayoutInsets();
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.94)).current;
  const logoY = useRef(new Animated.Value(12)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const buttonsY = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(220),
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 7,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.spring(logoY, {
          toValue: 0,
          friction: 8,
          tension: 55,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 450,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.spring(buttonsY, {
          toValue: 0,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
        Animated.timing(buttonsOpacity, {
          toValue: 1,
          duration: 420,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  return (
    <Screen edges={['top', 'left', 'right']} style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <LinearGradient
        colors={['#000000', '#050404', '#0a0808', COLORS.background]}
        locations={[0, 0.4, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.hero}>
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ translateY: logoY }, { scale: logoScale }],
            alignItems: 'center',
          }}
        >
          <Image
            source={require('../../../assets/atomik-logo-hero.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="ATOMIK"
          />
          <Animated.View style={[styles.taglineWrap, { opacity: taglineOpacity }]}>
            <Text style={styles.tagline}>AUDIO ENGINEERING AND DESIGN</Text>
            <Text style={[styles.tagline, styles.taglineBottom]}>
              SERVICE INFRASTRUCTURE
            </Text>
          </Animated.View>
        </Animated.View>
      </View>

      <Animated.View
        style={[
          styles.buttons,
          {
            opacity: buttonsOpacity,
            transform: [{ translateY: buttonsY }],
            bottom: Math.max(bottomInset, 16) + 24,
          },
        ]}
      >
        <PressableScale
          style={styles.loginBtn}
          onPress={() => navigation.navigate('Login')}
          scaleTo={0.97}
        >
          <Text style={styles.loginBtnText}>SIGN IN</Text>
        </PressableScale>
        <PressableScale
          style={styles.signupBtn}
          onPress={() => navigation.navigate('Signup')}
          scaleTo={0.97}
        >
          <Text style={styles.signupBtnText}>CREATE ACCOUNT</Text>
        </PressableScale>
      </Animated.View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: height * 0.2,
    paddingHorizontal: 24,
  },
  logo: {
    width: LOGO_W,
    height: LOGO_H,
    backgroundColor: 'transparent',
  },
  taglineWrap: {
    alignItems: 'center',
    marginTop: 20,
  },
  tagline: {
    fontFamily: 'Montserrat_300Light',
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 3.5,
    textAlign: 'center',
    lineHeight: 15,
  },
  taglineBottom: {
    marginTop: 18,
  },
  buttons: {
    position: 'absolute',
    left: 28,
    right: 28,
    gap: 10,
  },
  loginBtn: {
    height: 56,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: '#000000',
    letterSpacing: 3,
  },
  signupBtn: {
    height: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signupBtnText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: COLORS.white,
    letterSpacing: 3,
  },
  techBtn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  techBtnText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 11,
    color: COLORS.gray,
    letterSpacing: 2,
  },
});
