import React, { useRef, useState, useEffect } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
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
import { fonts } from '../src/constants/theme';

export const LAUNCHED_KEY = '@sipkutu_launched';

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
  feature1: string;
  feature2: string;
  feature3: string;
  gradientTop: [string, string, string];
  accent: string;
  iconFeature: [string, string, string];
}[] = [
  {
    key: 'welcome',
    variant: 'welcome',
    title: "Sipariş Kutusu'na\nHoş Geldin 👋",
    description: 'Instagram satıcıları ve alıcıları tek bir güvenli pazaryerinde buluşuyor.',
    feature1: '✓  Onaylı satıcılar',
    feature2: '✓  Güvenli iletişim',
    feature3: '✓  Kolay sipariş takibi',
    gradientTop: ['#1A4FB5', '#2563EB', '#3B82F6'],
    accent: '#2563EB',
    iconFeature: ['shield-checkmark-outline', 'chatbubble-outline', 'cube-outline'],
  },
  {
    key: 'order',
    variant: 'order',
    title: 'Hızlıca Ürün\nKeşfet & Satın Al',
    description: 'Binlerce ürün arasından filtrele, satıcıyla konuş ve sipariş ver.',
    feature1: '✓  Akıllı arama & filtre',
    feature2: '✓  Anlık bildirimler',
    feature3: '✓  Favorilere kaydet',
    gradientTop: ['#1E3A8A', '#1D4ED8', '#4F46E5'],
    accent: '#1D4ED8',
    iconFeature: ['search-outline', 'notifications-outline', 'heart-outline'],
  },
  {
    key: 'success',
    variant: 'success',
    title: 'Güvenle\nAlışverişe Başla 🚀',
    description: 'BO seni bekliyor — daha düzenli, şeffaf ve kolay bir deneyim için.',
    feature1: '✓  %100 güvenli ödeme',
    feature2: '✓  Satıcı değerlendirme',
    feature3: '✓  7/24 destek',
    gradientTop: ['#0C4A6E', '#0284C7', '#0EA5E9'],
    accent: '#0284C7',
    iconFeature: ['lock-closed-outline', 'star-outline', 'headset-outline'],
  },
];

const { width: SCREEN_W } = Dimensions.get('window');

export default function OnboardingScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const mascotY = useRef(new Animated.Value(0)).current;
  const mascotScale = useRef(new Animated.Value(1)).current;
  const cardSlide = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const dotAnims = useRef(slides.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;

  const isCompact = height < 720;
  const mascotSize = isCompact ? 130 : 170;
  const topFraction = isCompact ? 0.48 : 0.52;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (currentIndex + 1) / slides.length,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [currentIndex]);

  async function finish() {
    await AsyncStorage.setItem(LAUNCHED_KEY, '1');
    router.replace('/(tabs)');
  }

  function animateDots(next: number) {
    Animated.parallel(
      dotAnims.map((anim, i) =>
        Animated.timing(anim, {
          toValue: i === next ? 1 : 0,
          duration: 280,
          useNativeDriver: false,
        }),
      ),
    ).start();
  }

  function goTo(next: number) {
    currentIndexRef.current = next;

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: false }),
      Animated.timing(cardSlide, { toValue: 30, duration: 160, useNativeDriver: false }),
      Animated.timing(mascotScale, { toValue: 0.78, duration: 160, useNativeDriver: false }),
    ]).start(() => {
      setCurrentIndex(next);
      animateDots(next);
      cardSlide.setValue(-24);
      mascotY.setValue(16);
      mascotScale.setValue(0.78);

      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: false }),
        Animated.timing(cardSlide, { toValue: 0, duration: 280, useNativeDriver: false }),
        Animated.spring(mascotY, { toValue: 0, friction: 6, tension: 120, useNativeDriver: false }),
        Animated.spring(mascotScale, { toValue: 1, friction: 6, tension: 120, useNativeDriver: false }),
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
        Math.abs(gs.dx) > 12 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderRelease: (_, gs) => {
        const idx = currentIndexRef.current;
        if (gs.dx < -50 && idx < slides.length - 1) goTo(idx + 1);
        else if (gs.dx > 50 && idx > 0) goTo(idx - 1);
      },
    }),
  ).current;

  const slide = slides[currentIndex];
  const isLast = currentIndex === slides.length - 1;
  const topHeight = height * topFraction;

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>

      {/* ── Gradient top section ────────────────────────────────────────────── */}
      <LinearGradient
        colors={slide.gradientTop}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={{ height: topHeight, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 24, position: 'relative', overflow: 'hidden' }}
      >
        {/* Dekoratif daireler */}
        <View style={{ position: 'absolute', top: -80, right: -80, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.06)' }} />
        <View style={{ position: 'absolute', bottom: -40, left: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.05)' }} />
        <View style={{ position: 'absolute', top: 30, left: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.07)' }} />

        {/* Slide number pill */}
        <View style={{ position: 'absolute', top: 20, right: 20 }}>
          <SafeAreaView edges={['top']}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff', letterSpacing: 0.5 }}>
                {currentIndex + 1} / {slides.length}
              </Text>
            </View>
          </SafeAreaView>
        </View>

        {/* Skip button */}
        <View style={{ position: 'absolute', top: 20, left: 20 }}>
          <SafeAreaView edges={['top']}>
            <Pressable onPress={() => void finish()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Geç</Text>
            </Pressable>
          </SafeAreaView>
        </View>

        {/* Mascot */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: mascotY }, { scale: mascotScale }],
          }}
        >
          <BoxMascot variant={slide.variant} size={mascotSize} animated />
        </Animated.View>
      </LinearGradient>

      {/* ── Bottom white card ──────────────────────────────────────────────── */}
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#fff' }}>
        <Animated.View
          style={{
            flex: 1,
            paddingHorizontal: 28,
            paddingTop: 28,
            paddingBottom: 16,
            opacity: fadeAnim,
            transform: [{ translateY: cardSlide }],
          }}
        >
          {/* Progress bar */}
          <View style={{ height: 3, backgroundColor: '#E2E8F0', borderRadius: 2, marginBottom: 24 }}>
            <Animated.View
              style={{
                height: 3,
                borderRadius: 2,
                backgroundColor: slide.accent,
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              }}
            />
          </View>

          {/* Title */}
          <Text style={{ fontFamily: fonts.headingBold, fontSize: isCompact ? 22 : 26, color: '#0D1B2A', lineHeight: isCompact ? 30 : 34, letterSpacing: -0.5, marginBottom: 10 }}>
            {slide.title}
          </Text>

          {/* Description */}
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: '#516070', lineHeight: 22, marginBottom: 20 }}>
            {slide.description}
          </Text>

          {/* Feature rows */}
          {[slide.feature1, slide.feature2, slide.feature3].map((feat, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: slide.accent + '18', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={slide.iconFeature[i] as any} size={14} color={slide.accent} />
              </View>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: '#334155', flex: 1 }}>{feat.replace('✓  ', '')}</Text>
            </View>
          ))}

          <View style={{ flex: 1 }} />

          {/* Dots */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
            {slides.map((_, i) => (
              <Animated.View
                key={i}
                style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: slide.accent,
                  width: dotAnims[i].interpolate({ inputRange: [0, 1], outputRange: [6, 24] }),
                  opacity: dotAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                }}
              />
            ))}
          </View>

          {/* Primary button */}
          <Pressable
            onPress={handleNext}
            style={({ pressed }) => ({ borderRadius: 16, overflow: 'hidden', opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.975 : 1 }] })}
          >
            <LinearGradient
              colors={[slide.accent, slide.gradientTop[2]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ height: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff', letterSpacing: 0.2 }}>
                {isLast ? 'Başlayalım' : 'İleri'}
              </Text>
              <Ionicons name={isLast ? 'rocket-outline' : 'arrow-forward'} size={18} color="#fff" />
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </SafeAreaView>

    </View>
  );
}
