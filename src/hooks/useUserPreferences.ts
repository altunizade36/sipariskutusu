import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useState, useEffect } from 'react';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: 'tr' | 'en';
  currency: 'TRY' | 'USD' | 'EUR';
  defaultSortBy: 'newest' | 'price_asc' | 'price_desc' | 'most_viewed';
  defaultFilterCategory?: string;
  autoPlayVideos: boolean;
  showImages: boolean;
  compressImages: boolean;
  wifiOnlyImages: boolean;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  privateProfile: boolean;
  blockedUserIds: string[];
  mutedSellerIds: string[];
  favoriteCategories: string[];
  savedSearches: string[];
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'auto',
  language: 'tr',
  currency: 'TRY',
  defaultSortBy: 'newest',
  autoPlayVideos: true,
  showImages: true,
  compressImages: false,
  wifiOnlyImages: false,
  soundEnabled: true,
  hapticEnabled: true,
  privateProfile: false,
  blockedUserIds: [],
  mutedSellerIds: [],
  favoriteCategories: [],
  savedSearches: [],
};

const STORAGE_KEY = '@sipariskutusu/user_prefs';

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPreferences(JSON.parse(stored));
      } else {
        setPreferences(DEFAULT_PREFERENCES);
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
      setPreferences(DEFAULT_PREFERENCES);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updatePreference = useCallback(
    async <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      try {
        const updated = { ...preferences, [key]: value };
        setPreferences(updated);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return true;
      } catch (error) {
        console.error('Failed to update preference:', error);
        return false;
      }
    },
    [preferences],
  );

  const updateMultiple = useCallback(
    async (updates: Partial<UserPreferences>) => {
      try {
        const updated = { ...preferences, ...updates };
        setPreferences(updated);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return true;
      } catch (error) {
        console.error('Failed to update preferences:', error);
        return false;
      }
    },
    [preferences],
  );

  const addBlockedUser = useCallback(
    async (userId: string) => {
      const updated = [...new Set([...preferences.blockedUserIds, userId])];
      return updatePreference('blockedUserIds', updated);
    },
    [preferences, updatePreference],
  );

  const removeBlockedUser = useCallback(
    async (userId: string) => {
      const updated = preferences.blockedUserIds.filter((id) => id !== userId);
      return updatePreference('blockedUserIds', updated);
    },
    [preferences, updatePreference],
  );

  const addMutedSeller = useCallback(
    async (sellerId: string) => {
      const updated = [...new Set([...preferences.mutedSellerIds, sellerId])];
      return updatePreference('mutedSellerIds', updated);
    },
    [preferences, updatePreference],
  );

  const removeMutedSeller = useCallback(
    async (sellerId: string) => {
      const updated = preferences.mutedSellerIds.filter((id) => id !== sellerId);
      return updatePreference('mutedSellerIds', updated);
    },
    [preferences, updatePreference],
  );

  const resetToDefaults = useCallback(async () => {
    try {
      setPreferences(DEFAULT_PREFERENCES);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PREFERENCES));
      return true;
    } catch (error) {
      console.error('Failed to reset preferences:', error);
      return false;
    }
  }, []);

  return {
    preferences,
    isLoading,
    updatePreference,
    updateMultiple,
    addBlockedUser,
    removeBlockedUser,
    addMutedSeller,
    removeMutedSeller,
    resetToDefaults,
  };
}
