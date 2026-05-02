import React, { useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BoxMascot from '../src/components/BoxMascot';
import { colors, fonts } from '../src/constants/theme';

const LAUNCHED_KEY = '@sipkutu_launched';

export async function markLaunched() {
  await AsyncStorage.setItem(LAUNCHED_KEY, '1');
}

export async function hasLaunchedBefore(): Promise<boolean> {
  const val = await AsyncStorage.getItem(LAUNCHED_KEY);
  return val === '1';
}

const slides = [
  {
    key: 'welcome',
    variant: 'welcome' as const,
    title: "Sipariş Kutusu'na hoş geldin",
    description: 'Instagram satıcıları ve alıcıları tek bir güvenli pazaryerinde buluşuyor.',
  },
  {
    key: 'order',
    variant: 'order' as const,
    title: 'Hızlıca ürün keşfet',
    description: 'İlanları incele, satıcıyla konuş ve sipariş sürecini tek yerden yönet.',
  },
  {
    key: 'success',
    variant: 'success' as const,
    title: 'Güvenle alışverişe başla',
    description: 'BO yanında: daha düzenli, daha şeffaf ve daha kolay bir alışveriş deneyimi.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);

  // Content transition
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  // Mascot spring on slide change
  const mascotScale = useRef(new Animated.Value(1)).current;
  // Per-dot width animation (useNativeDriver:false — layout prop)
  const dotWidths = useRef(
    slides.map((_, i) => new Animated.Value(i === 0 ? 24 : 8)),
  ).current;

  const isCompact = height < 760;
  const mascotSize = isCompact ? 110 : 140;

  async function finish() {
    await AsyncStorage.setItem(LAUNCHED_KEY, '1');
    router.replace('/(tabs)');
  }

  function animateDots(next: number) {
    Animated.parallel(
      dotWidths.map((anim, i) =>
        Animated.timing(anim, {
          toValue: i === next ? 24 : 8,
          duration: 260,
          useNativeDriver: false,
        }),
      ),
    ).start();
  }

  function goTo(next: number) {
    currentIndexRef.current = next;
    // Fade + slide out
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -22, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setCurrentIndex(next);
      animateDots(next);
      slideAnim.setValue(30);
      mascotScale.setValue(0.62);
      // Fade + slide in + mascot spring bounce
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 230, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 230, useNativeDriver: true }),
        Animated.spring(mascotScale, {
          toValue: 1,
          friction: 5,
          tension: 130,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }

  function handleNext() {
    if (currentIndex >= slides.length - 1) {
      void finish();
    } else {
      goTo(currentIndex + 1);
    }
  }

  // Swipe left/right to navigate
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.4,
      onPanResponderRelease: (_, gs) => {
        const idx = currentIndexRef.current;
        if (gs.dx < -50 && idx < slides.length - 1) {
          goTo(idx + 1);
        } else if (gs.dx > 50 && idx > 0) {
          goTo(idx - 1);
        }
      },
    }),
  ).current;

  const slide = slides[currentIndex];
  const isLast = currentIndex === slides.length - 1;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container} {...panResponder.panHandlers}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>Sipariş Kutusu</Text>
          <Text style={styles.tagline}>BO ile alışveriş artık daha kolay</Text>
        </View>

        {/* Slide content */}
        <Animated.View
          style={[
            styles.slideContent,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Animated.View style={[styles.mascotArea, { transform: [{ scale: mascotScale }] }]}>
            <BoxMascot variant={slide.variant} size={mascotSize} animated />
          </Animated.View>

          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.subtitle}>{slide.description}</Text>
        </Animated.View>

        {/* Dots */}
        <View style={styles.dotsRow}>
          {slides.map((s, i) => (
            <Pressable
              key={s.key}
              style={styles.dotPressable}
              onPress={() => { if (i !== currentIndex) goTo(i); }}
            >
              <Animated.View
                style={[
                  styles.dot,
                  {
                    width: dotWidths[i],
                    backgroundColor: i === currentIndex ? colors.primary : '#CBD5E1',
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.buttonArea}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.primaryBtnPressed,
            ]}
            onPress={handleNext}
          >
            <Text style={styles.primaryBtnText}>
              {isLast ? 'Başlayalım' : 'İleri'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.55 }]}
            onPress={() => void finish()}
          >
            <Text style={styles.skipBtnText}>Geç</Text>
          </Pressable>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    paddingTop: 16,
    paddingBottom: 8,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
  },
  brand: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0D1B2A',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 3,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  slideContent: {
    flexGrow: 1,
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  mascotArea: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 23,
    fontWeight: '800',
    color: '#0D1B2A',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: '#516070',
    textAlign: 'center',
    maxWidth: 320,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    gap: 4,
  },
  dotPressable: {
    padding: 10,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttonArea: {
    paddingHorizontal: 28,
    paddingBottom: 16,
    gap: 8,
    width: '100%',
  },
  primaryBtn: {
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  primaryBtnPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.975 }],
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  skipBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: '#64748B',
  },
});
