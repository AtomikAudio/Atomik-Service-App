import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { PressableScale } from '../../components/common/PressableScale';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';
import { COLORS } from '../../constants/colors';
import { useDispatch } from 'react-redux';
import { setOnboarded } from '../../store/authSlice';

const { width, height } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    icon: 'radio-outline',
    title: 'Elite Audio\nService Network',
    desc: 'Connect with certified audio engineers for precision maintenance of your sound infrastructure.',
    accent: '#8e302f',
  },
  {
    id: '2',
    icon: 'calendar-outline',
    title: 'Schedule\nWith Precision',
    desc: 'Book general service, inspections, or emergency visits at your venue with real-time technician assignment.',
    accent: '#8e302f',
  },
  {
    id: '3',
    icon: 'analytics-outline',
    title: 'Track Every\nService Detail',
    desc: 'Live status updates, technician tracking, invoice management — complete visibility from booking to completion.',
    accent: '#8e302f',
  },
];

interface Props {
  navigation: any;
}

export const OnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useDispatch();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const ringPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ringPulse, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [ringPulse]);

  const ringScale = ringPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.14],
  });
  const ringOpacity = ringPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.5],
  });

  const goNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      handleDone();
    }
  };

  const handleDone = () => {
    dispatch(setOnboarded(true));
  };

  const renderSlide = ({
    item,
    index,
  }: {
    item: (typeof slides)[0];
    index: number;
  }) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    const iconScale = scrollX.interpolate({
      inputRange,
      outputRange: [0.88, 1, 0.88],
      extrapolate: 'clamp',
    });
    const contentOpacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.4, 1, 0.4],
      extrapolate: 'clamp',
    });

    return (
    <View style={styles.slide}>
      {/* Background grid */}
      <View style={styles.gridBg}>
        {Array.from({ length: 20 }).map((_, i) => (
          <View key={i} style={styles.gridLine} />
        ))}
      </View>

      {/* Icon container */}
      <View style={styles.iconCircle}>
        <Animated.View
          style={[
            styles.ring,
            styles.ring2,
            { opacity: ringOpacity, transform: [{ scale: ringScale }] },
          ]}
        />
        <Animated.View
          style={[
            styles.ring,
            styles.ring1,
            {
              opacity: ringPulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.35, 0.65],
              }),
              transform: [
                {
                  scale: ringPulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.08],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View style={[styles.iconInner, { transform: [{ scale: iconScale }] }]}>
          <Ionicons name={item.icon as any} size={56} color={COLORS.white} />
        </Animated.View>
      </View>

      <Animated.View style={[styles.slideContent, { opacity: contentOpacity }]}>
        <View style={styles.redAccent} />
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideDesc}>{item.desc}</Text>
      </Animated.View>
    </View>
  );
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
      />

      {/* Bottom Controls */}
      <View style={styles.controls}>
        {/* Dots */}
        <View style={styles.dots}>
          {slides.map((_, i) => {
            const dotWidth = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [6, 20, 6],
              extrapolate: 'clamp',
            });
            const dotColor = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [COLORS.grayDark, COLORS.red, COLORS.grayDark],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[styles.dot, { width: dotWidth, backgroundColor: dotColor }]}
              />
            );
          })}
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity
            onPress={handleDone}
            style={styles.skipBtn}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>

          <PressableScale onPress={goNext} style={styles.nextBtn} scaleTo={0.92}>
            <Ionicons
              name={currentIndex === slides.length - 1 ? 'checkmark' : 'arrow-forward'}
              size={22}
              color={COLORS.white}
            />
          </PressableScale>
        </View>

        {currentIndex === slides.length - 1 && (
          <Button
            label="GET STARTED"
            onPress={handleDone}
            style={{ marginTop: 16 }}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  gridBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.55,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  gridLine: {
    width: 1,
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginHorizontal: 18,
  },
  iconCircle: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 52,
    position: 'relative',
  },
  iconInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(142, 48, 47, 0.2)',
  },
  ring1: {
    width: 130,
    height: 130,
  },
  ring2: {
    width: 160,
    height: 160,
    borderColor: 'rgba(142, 48, 47, 0.08)',
  },
  slideContent: {
    alignItems: 'flex-start',
    width: '100%',
  },
  redAccent: {
    width: 32,
    height: 3,
    backgroundColor: COLORS.red,
    borderRadius: 2,
    marginBottom: 16,
  },
  slideTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 30,
    color: COLORS.white,
    lineHeight: 38,
    marginBottom: 16,
  },
  slideDesc: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 22,
  },
  controls: {
    paddingHorizontal: 32,
    paddingBottom: 48,
    paddingTop: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.grayDark,
  },
  dotActive: {
    backgroundColor: COLORS.red,
    width: 20,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipBtn: {
    padding: 8,
  },
  skipText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 13,
    color: COLORS.gray,
  },
  nextBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
