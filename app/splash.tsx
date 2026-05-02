import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import BoxMascot from '../src/components/BoxMascot';
import { hasLaunchedBefore } from './onboarding';

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#0A0A0A',
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 72,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -2,
  },
  logoDark: {
    color: '#FFFFFF',
  },
  logoSubtext: {
    fontSize: 14,
    color: '#999999',
    marginTop: 12,
    fontWeight: '500',
    letterSpacing: 2,
  },
  logoSubtextDark: {
    color: '#666666',
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#666666',
    marginTop: 16,
    fontWeight: '500',
  },
  loadingTextDark: {
    color: '#999999',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    marginHorizontal: 4,
  },
});

export default function SplashScreen() {
  const router = useRouter();
  const { isLoading, isDarkMode } = useAuth();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const dotAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
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
        ])
      ),
    ]).start();
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
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <Animated.View style={[styles.logoContainer, { opacity: fadeAnim }]}>
        <BoxMascot variant="loading" size={150} animated />
        <Text style={[styles.logo, isDarkMode && styles.logoDark]}>BO</Text>
        <Text style={[styles.logoSubtext, isDarkMode && styles.logoSubtextDark]}>
          SİPARİŞ KUTUSU
        </Text>
      </Animated.View>

      <View style={styles.loadingContainer}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dotAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.3, 1, 0.3],
                }),
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dotAnim.interpolate({
                  inputRange: [0, 0.33, 0.66, 1],
                  outputRange: [0.3, 0.3, 1, 0.3],
                }),
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dotAnim.interpolate({
                  inputRange: [0, 0.66, 1],
                  outputRange: [0.3, 0.3, 1],
                }),
              },
            ]}
          />
        </View>
        <Text style={[styles.loadingText, isDarkMode && styles.loadingTextDark]}>
          Yükleniyor...
        </Text>
      </View>
    </View>
  );
}
