import React, { useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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

type SlideVariant = 'welcome' | 'order' | 'success';

const slides: {
  key: string;
  variant: SlideVariant;
  title: string;
  description: string;
  accent: string;
  accentLight: string;
  icon: string;
  gradient: [string, string, string];
}[] = [
  {
    key: 'welcome',
    variant: 'welcome',
    title: "Sipariş Kutusu'na\nHoş Geldin",
    description: 'Instagram satıcıları ve alıcıları tek bir güvenli pazaryerinde buluşuyor.',
    accent: '#3B82F6',
    accentLight: '#EEF4FF',
    icon: 'storefront-outline',
    gradient: ['#FFFFFF', '#F0F7FF', '#E8F3FF'],
  },
  {
    key: 'order',
    variant: 'order',
    title: 'Hızlıca Ürün\nKeşfet',
    description: 'İlanları incele, satıcıyla konuş ve sipariş sürecini tek yerden yönet.',
    accent: '#1E5FC6',
    accentLight: '#EBF2FF',
    icon: 'search-outline',
    gradient: ['#FFFFFF', '#EDF3FF', '#E4EEFF'],
  },
  {
    key: 'success',
    variant: 'success',
    title: 'Güvenle\nAlışverişe Başla',
    description: 'BO yanında: daha düzenli, daha şeffaf ve daha kolay bir alışveriş deneyimi.',
    accent: '#0EA5E9',
    accentLight: '#E0F5FF',
    icon: 'shield-checkmark-outline',
    gradient: ['#FFFFFF', '#E8F7FF', '#D9F2FF'],
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const mascotScale = useRef(new Animated.Value(1)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const dotWidths = useRef(
    slides.map((_, i) => new Animated.Value(i === 0 ? 28 : 8)),
  ).current;

  const isCompact = height < 760;
  const mascotSize = isCompact ? 115 : 148;

  async function finish() {
    await AsyncStorage.setItem(LAUNCHED_KEY, '1');
    router.replace('/(tabs)');
  }

  function animateDots(next: number) {
    Animated.parallel(
      dotWidths.map((anim, i) =>
        Animated.timing(anim, {
          toValue: i === next ? 28 : 8,
          duration: 280,
          useNativeDriver: false,
        }),
      ),
    ).start();
  }

  function goTo(next: number) {
    currentIndexRef.current = next;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(slideAnim, { toValue: -20, duration: 140, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(cardScale, { toValue: 0.96, duration: 140, useNativeDriver: Platform.OS !== 'web' }),
    ]).start(() => {
      setCurrentIndex(next);
      animateDots(next);
      slideAnim.setValue(28);
      mascotScale.setValue(0.60);
      cardScale.setValue(0.96);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 240, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(slideAnim, { toValue: 0, duration: 240, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(cardScale, { toValue: 1, duration: 240, useNativeDriver: Platform.OS !== 'web' }),
        Animated.spring(mascotScale, {
          toValue: 1,
          friction: 5,
          tension: 130,
          useNativeDriver: Platform.OS !== 'web',
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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.4,
      onPanResponderRelease: (_, gs) => {
        const idx = currentIndexRef.current;
        if (gs.dx < -50 && idx < slides.length - 1) goTo(idx + 1);
        else if (gs.dx > 50 && idx > 0) goTo(idx - 1);
      },
    }),
  ).current;

  const slide = slides[currentIndex];
  const isLast = currentIndex === slides.length - 1;

  return (
    <LinearGradient colors={slide.gradient} style={styles.gradient}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.container} {...panResponder.panHandlers}>

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.brandPill, { backgroundColor: slide.accentLight }]}>
              <Text style={[styles.brandPillText, { color: slide.accent }]}>Sipariş Kutusu</Text>
            </View>
            <Text style={styles.tagline}>BO ile alışveriş artık daha kolay</Text>
          </View>

          {/* Slide content */}
          <Animated.View
            style={[
              styles.slideContent,
              Platform.OS !== 'web'
                ? { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: cardScale }] }
                : {},
            ]}
          >
            {/* Mascot card */}
            <View style={[styles.mascotCard, { backgroundColor: slide.accentLight }]}>
              <Animated.View style={{ transform: [{ scale: mascotScale }] }}>
                <BoxMascot variant={slide.variant} size={mascotSize} animated />
              </Animated.View>
            </View>

            {/* Icon badge */}
            <View style={[styles.iconBadge, { backgroundColor: slide.accent }]}>
              <Ionicons name={slide.icon as any} size={15} color="#fff" />
            </View>

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
                      backgroundColor: i === currentIndex ? slide.accent : '#CBD5E1',
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
                styles.primaryBtnWrapper,
                pressed && { opacity: 0.88, transform: [{ scale: 0.975 }] },
              ]}
              onPress={handleNext}
            >
              <LinearGradient
                colors={[slide.accent, colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>
                  {isLast ? 'Başlayalım 🚀' : 'İleri'}
                </Text>
                {!isLast && (
                  <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
                )}
              </LinearGradient>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.5 }]}
              onPress={() => void finish()}
            >
              <Text style={styles.skipBtnText}>Geç</Text>
            </Pressable>
          </View>

        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    paddingTop: 12,
    paddingBottom: 8,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 24,
  },
  brandPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 99,
    marginBottom: 8,
  },
  brandPillText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
  tagline: {
    fontSize: 12,
    color: '#94A3B8',
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
  },
  slideContent: {
    flexGrow: 1,
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  mascotCard: {
    width: 220,
    height: 220,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: '#3B82F6',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  title: {
    fontSize: 26,
    fontFamily: fonts.headingBold,
    color: '#0D1B2A',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: '#516070',
    textAlign: 'center',
    maxWidth: 300,
    fontFamily: fonts.regular,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    gap: 6,
  },
  dotPressable: {
    padding: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttonArea: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    gap: 6,
    width: '100%',
  },
  primaryBtnWrapper: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  primaryBtn: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: fonts.bold,
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
    color: '#94A3B8',
  },
});
