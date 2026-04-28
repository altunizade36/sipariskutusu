import { useCallback } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

export function useAndroidTabBackToHome(isHomeTab = false) {
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;

      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (isHomeTab) return false;

        router.replace('/(tabs)');
        return true;
      });

      return () => subscription.remove();
    }, [isHomeTab, router]),
  );
}
