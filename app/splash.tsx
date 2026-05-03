import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { hasLaunchedBefore } from './onboarding';

const { width, height } = Dimensions.get('window');

const mascotSource = require('../assets/mascot/box-loading.png');

export default function SplashScreen() {
  const router = useRouter();
  const { isLoading, isDarkMode } = useAuth();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const mascotY = useRef(new Animated.Value(20)).current;
  const mascotScale = useRef(new Animated.Value(0.85)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(mascotY, {
        toValue: 0,
        tension: 60,
        friction: 8,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(mascotScale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: false,
          }),
          Animated.timing(dotAnim, {
            toValue: 0,
            duration: 600,
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
      }, 2200);

      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const bg = isDarkMode ? '#0A0F1E' : '#FFFFFF';
  const textColor = isDarkMode ? '#FFFFFF' : '#0A0F1E';
  const subtextColor = isDarkMode ? '#6B7280' : '#9CA3AF';
  const dotColor = '#3B82F6';

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Maskot + Logo grubu */}
      <Animated.View
        style={[
          styles.centerGroup,
          Platform.OS !== 'web'
            ? {
                opacity: fadeAnim,
                transform: [{ translateY: mascotY }, { scale: mascotScale }],
              }
            : { opacity: 1 },
        ]}
      >
        {/* Maskot görseli */}
        <View style={styles.mascotWrapper}>
          <Image
            source={mascotSource}
            style={styles.mascotImage}
            resizeMode="contain"
          />
        </View>

        {/* Logo metni */}
        <Text style={[styles.logoText, { color: textColor }]}>BO</Text>
        <Text style={[styles.subText, { color: subtextColor }]}>SİPARİŞ KUTUSU</Text>
      </Animated.View>

      {/* Alt yükleniyor göstergesi */}
      <View style={styles.loadingContainer}>
        <View style={styles.dotsRow}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: dotColor },
                {
                  opacity: dotAnim.interpolate({
                    inputRange: [0, 0.33 * i, 0.33 * (i + 1), 1],
                    outputRange: [0.25, 0.25, 1, 0.25],
                    extrapolate: 'clamp',
                  }),
                  transform: [
                    {
                      scale: dotAnim.interpolate({
                        inputRange: [0, 0.33 * i, 0.33 * (i + 1), 1],
                        outputRange: [0.85, 0.85, 1.3, 0.85],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.loadingText, { color: subtextColor }]}>Yükleniyor...</Text>
      </View>
    </View>
  );
}

const MASCOT_SIZE = Math.min(width * 0.55, 240);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerGroup: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotWrapper: {
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  mascotImage: {
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
  },
  logoText: {
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: -1.5,
    marginTop: 4,
  },
  subText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 3,
    marginTop: 6,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 14,
    letterSpacing: 0.5,
  },
});
