import React, { useEffect, useRef } from 'react';
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Animated,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { PressableScale } from './PressableScale';
import { DURATION, EASE_OUT } from '../../utils/motion';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  /** Outline button: animates red border → green fill (e.g. phone verified) */
  verified?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  verified = false,
  style,
  textStyle,
  fullWidth = true,
}) => {
  const fillAnim = useRef(new Animated.Value(verified ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: verified ? 1 : 0,
      duration: DURATION.normal,
      easing: EASE_OUT,
      useNativeDriver: false,
    }).start();
  }, [verified, fillAnim]);

  const isLocked = disabled || loading;
  const showVerifiedOutline = variant === 'outline' && verified;
  const getContainerStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.primary;
      case 'secondary':
        return styles.secondary;
      case 'outline':
        return styles.outline;
      case 'ghost':
        return styles.ghost;
      default:
        return styles.primary;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.primaryText;
      case 'secondary':
        return styles.secondaryText;
      case 'outline':
        return styles.outlineText;
      case 'ghost':
        return styles.ghostText;
      default:
        return styles.primaryText;
    }
  };

  const labelColor = fillAnim.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [COLORS.red, COLORS.white, COLORS.white],
  });

  const content = loading ? (
    <ActivityIndicator
      color={
        showVerifiedOutline || variant === 'primary'
          ? COLORS.white
          : COLORS.red
      }
      size="small"
    />
  ) : showVerifiedOutline ? (
    <View style={styles.verifiedRow}>
      <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
      <Animated.Text style={[styles.baseText, styles.verifiedText, textStyle, { color: labelColor }]}>
        {label}
      </Animated.Text>
    </View>
  ) : (
    <Text style={[styles.baseText, getTextStyle(), textStyle]}>{label}</Text>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={isLocked || verified}
      scaleTo={0.97}
      style={[
        styles.base,
        getContainerStyle(),
        showVerifiedOutline && styles.outlineVerified,
        fullWidth && styles.fullWidth,
        isLocked && !verified && styles.disabled,
        style,
      ]}
    >
      {showVerifiedOutline ? (
        <>
          <Animated.View
            style={[
              styles.fillLayer,
              {
                opacity: fillAnim,
                backgroundColor: COLORS.statusConfirmed,
              },
            ]}
          />
          {content}
        </>
      ) : (
        content
      )}
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  fullWidth: {
    width: '100%',
  },
  primary: {
    backgroundColor: COLORS.red,
  },
  secondary: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.red,
    overflow: 'hidden',
  },
  outlineVerified: {
    borderColor: COLORS.statusConfirmed,
  },
  fillLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 9,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 1,
  },
  verifiedText: {
    color: COLORS.white,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.45,
  },
  baseText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    letterSpacing: 1.5,
  },
  primaryText: {
    color: COLORS.white,
  },
  secondaryText: {
    color: COLORS.white,
  },
  outlineText: {
    color: COLORS.red,
  },
  ghostText: {
    color: COLORS.gray,
  },
});
