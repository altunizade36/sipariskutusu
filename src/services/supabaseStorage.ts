import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

async function getFallbackItem(key: string) {
  return AsyncStorage.getItem(key);
}

async function setFallbackItem(key: string, value: string) {
  await AsyncStorage.setItem(key, value);
}

async function removeFallbackItem(key: string) {
  await AsyncStorage.removeItem(key);
}

/**
 * Supabase auth storage adapter.
 * Native'de SecureStore kullanır, hata/uyumsuzluk durumunda AsyncStorage'a düşer.
 */
export const supabaseAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return getFallbackItem(key);
    }

    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return getFallbackItem(key);
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      await setFallbackItem(key, value);
      return;
    }

    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      await setFallbackItem(key, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      await removeFallbackItem(key);
      return;
    }

    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      await removeFallbackItem(key);
    }
  },
};
