import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { COLORS } from '../../constants/colors';

const { width, height } = Dimensions.get('window');

interface WaveBackgroundProps {
  variant?: 'splash' | 'subtle' | 'grid';
}

export const WaveBackground: React.FC<WaveBackgroundProps> = ({
  variant = 'subtle',
}) => {
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim1 = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse1, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(pulse1, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    );
    const anim2 = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse2, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(pulse2, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: true,
        }),
      ])
    );
    anim1.start();
    setTimeout(() => anim2.start(), 1500);
    return () => {
      anim1.stop();
      anim2.stop();
    };
  }, []);

  if (variant === 'grid') {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Horizontal grid lines */}
        {Array.from({ length: 12 }).map((_, i) => (
          <View
            key={`h-${i}`}
            style={[
              styles.gridLine,
              {
                top: (height / 12) * i,
                width,
                height: 1,
              },
            ]}
          />
        ))}
        {/* Vertical grid lines */}
        {Array.from({ length: 8 }).map((_, i) => (
          <View
            key={`v-${i}`}
            style={[
              styles.gridLine,
              {
                left: (width / 8) * i,
                width: 1,
                height,
              },
            ]}
          />
        ))}
      </View>
    );
  }

  if (variant === 'splash') {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View
          style={[
            styles.glowOrb,
            {
              bottom: height * 0.2,
              alignSelf: 'center',
              opacity: pulse1.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.7],
              }),
              transform: [
                {
                  scale: pulse1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.3],
                  }),
                },
              ],
            },
          ]}
        />
        {/* Dot grid top */}
        <View style={styles.dotGrid}>
          {Array.from({ length: 120 }).map((_, i) => (
            <View key={i} style={styles.dot} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={[
          styles.subtleGlow,
          {
            opacity: pulse1.interpolate({
              inputRange: [0, 1],
              outputRange: [0.05, 0.12],
            }),
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  glowOrb: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(142, 48, 47, 0.08)',
  },
  dotGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    gap: 16,
  },
  dot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    margin: 8,
  },
  subtleGlow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 300,
    backgroundColor: COLORS.red,
    borderRadius: 999,
    transform: [{ scaleX: 3 }],
  },
});
