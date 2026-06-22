import React from 'react';
import { View, Image, StyleSheet, ImageStyle, ViewStyle } from 'react-native';

interface AtomikLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'hero' | 'xl';
  variant?: 'horizontal' | 'vertical';
  style?: ViewStyle;
}

const SIZES = {
  sm: { h: 26, hw: 3.8, vw: 0.92 },
  md: { h: 37, hw: 4, vw: 0.95 },
  lg: { h: 50, hw: 4.2, vw: 0.95 },
  hero: { h: 60, hw: 4.5, vw: 0.95 },
  xl: { h: 73, hw: 4.5, vw: 0.95 },
};

/** Transparent white mark — no baked-in background */
const HERO = require('../../../assets/atomik-logo-hero.png');
const HORIZONTAL = require('../../../assets/atomik-logo-transparent.png');
const VERTICAL = require('../../../assets/atomik-logo-transparent.png');

const AtomikLogoComponent: React.FC<AtomikLogoProps> = ({
  size = 'lg',
  variant = 'horizontal',
  style,
}) => {
  const s = SIZES[size];
  const imageStyle: ImageStyle = {
    height: s.h,
    width:
      variant === 'horizontal'
        ? Math.round(s.h * s.hw)
        : Math.round(s.h * s.vw),
    resizeMode: 'contain',
    backgroundColor: 'transparent',
  };

  const source =
    size === 'hero' || size === 'xl' || size === 'lg'
      ? HERO
      : variant === 'horizontal'
        ? HORIZONTAL
        : VERTICAL;

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      <Image
        source={source}
        style={imageStyle}
        accessibilityLabel="ATOMIK"
      />
    </View>
  );
};

export const AtomikLogo = AtomikLogoComponent;
export default AtomikLogo;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});
