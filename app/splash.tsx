import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { hasLaunchedBefore } from './onboarding';

const { width, height } = Dimensions.get('window');

const mascotSource = require('../assets/mascot/box-loading.png');

export default function SplashScreen() {
  const router = useRouter();
  const { isLoading, isDarkMode } = useAuth();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const mascotY = useRef(new Animated.Value(28)).current;
  const mascotScale = useRef(new Animated.Value(0.82)).current;
  const textFade = useRef(new Animated.Value(0)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.7)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(mascotY, {
          toValue: 0,
          tension: 55,
          friction: 8,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(mascotScale, {
          toValue: 1,
          tension: 55,
          friction: 8,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(glowScale, {
          toValue: 1,
          duration: 800,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      Animated.timing(textFade, {
        toValue: 1,
        duration: 350,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: false,
          }),
          Animated.timing(dotAnim, {
            toValue: 0,
            duration: 700,
            useNativeDriver: false,
          }),
        ]),
      ).start();
    });
  }, []);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(async () => {
        const launched = await hasLaunchedBefore();
        if (!launched) {
          router.replace('/onboarding' as never);
        } else {
          router.replace('/(tabs)' as never);
        }
      }, 2400);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const isDark = isDarkMode;

  const bgGradient: [string, string, string] = isDark
    ? ['#060C1A', '#0D1B3E', '#091228']
    : ['#FFFFFF', '#EEF4FF', '#DBEAFE'];

  const glowColor = isDark ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.10)';
  const textColor = isDark ? '#F1F5F9' : '#0F172A';
  const subtextColor = isDark ? '#60A5FA' : '#3B82F6';
  const tagColor = isDark ? '#475569' : '#94A3B8';

  return (
    <LinearGradient colors={bgGradient} style={styles.container}>

      {/* Dekoratif arka plan daireler */}
      <View style={[styles.decorCircle1, { borderColor: isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.07)' }]} />
      <View style={[styles.decorCircle2, { borderColor: isDark ? 'rgba(59,130,246,0.05)' : 'rgba(59,130,246,0.05)' }]} />
      <View style={[styles.decorDot1, { backgroundColor: isDark ? 'rgba(96,165,250,0.15)' : 'rgba(59,130,246,0.1)' }]} />
      <View style={[styles.decorDot2, { backgroundColor: isDark ? 'rgba(147,197,253,0.1)' : 'rgba(59,130,246,0.07)' }]} />

      {/* Merkez içerik */}
      <View style={styles.centerGroup}>

        {/* Maskot glow halkası */}
        <Animated.View
          style={[
            styles.glowRing,
            { backgroundColor: glowColor },
            Platform.OS !== 'web'
              ? { opacity: glowOpacity, transform: [{ scale: glowScale }] }
              : { opacity: 1 },
          ]}
        />

        {/* Maskot — DOKUNULMADI */}
        <Animated.View
          style={[
            styles.mascotWrapper,
            Platform.OS !== 'web'
              ? {
                  opacity: fadeAnim,
                  transform: [{ translateY: mascotY }, { scale: mascotScale }],
                }
              : { opacity: 1 },
          ]}
        >
          <Image
            source={mascotSource}
            style={styles.mascotImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Marka metni */}
        <Animated.View
          style={[
            styles.brandBlock,
            Platform.OS !== 'web' ? { opacity: textFade } : { opacity: 1 },
          ]}
        >
          <Text style={[styles.logoText, { color: textColor }]}>BO</Text>
          <View style={[styles.divider, { backgroundColor: subtextColor }]} />
          <Text style={[styles.subText, { color: subtextColor }]}>SİPARİŞ KUTUSU</Text>
          <Text style={[styles.tagText, { color: tagColor }]}>Güvenli Alışveriş Pazaryeri</Text>
        </Animated.View>

      </View>

      {/* Alt alan: loading */}
      <View style={styles.loadingContainer}>
        <View style={styles.dotsRow}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: subtextColor,
                  opacity: dotAnim.interpolate({
                    inputRange: [0, 0.33 * i, 0.33 * (i + 1), 1],
                    outputRange: [0.25, 0.25, 1, 0.25],
                    extrapolate: 'clamp',
                  }),
                  transform: [
                    {
                      scale: dotAnim.interpolate({
                        inputRange: [0, 0.33 * i, 0.33 * (i + 1), 1],
                        outputRange: [0.8, 0.8, 1.4, 0.8],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.loadingText, { color: tagColor }]}>Yükleniyor...</Text>
      </View>

    </LinearGradient>
  );
}

const MASCOT_SIZE = Math.min(width * 0.52, 220);
const GLOW_SIZE = MASCOT_SIZE * 1.45;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decorCircle1: {
    position: 'absolute',
    width: width * 1.6,
    height: width * 1.6,
    borderRadius: width * 0.8,
    borderWidth: 1,
    top: -width * 0.6,
    alignSelf: 'center',
  },
  decorCircle2: {
    position: 'absolute',
    width: width * 2.2,
    height: width * 2.2,
    borderRadius: width * 1.1,
    borderWidth: 1,
    top: -width * 1.0,
    alignSelf: 'center',
  },
  decorDot1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    bottom: height * 0.18,
    right: -30,
  },
  decorDot2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    top: height * 0.12,
    left: -20,
  },
  centerGroup: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
  },
  mascotWrapper: {
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotImage: {
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
  },
  brandBlock: {
    alignItems: 'center',
    marginTop: 18,
  },
  logoText: {
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 58,
  },
  divider: {
    width: 32,
    height: 2.5,
    borderRadius: 99,
    marginTop: 8,
    marginBottom: 8,
  },
  subText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3.5,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.4,
    marginTop: 6,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 56,
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  loadingText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 12,
    letterSpacing: 0.6,
  },
});
