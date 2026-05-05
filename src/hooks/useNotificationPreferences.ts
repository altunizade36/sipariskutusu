import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useState, useEffect } from 'react';

export interface NotificationPreferences {
  messages: boolean;
  newListings: boolean;
  followedSellerUpdates: boolean;
  promotions: boolean;
  orderUpdates: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  messages: true,
  newListings: true,
  followedSellerUpdates: true,
  promotions: false,
  orderUpdates: true,
};

const STORAGE_KEY = '@sipariskutusu/notification_prefs';

export function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
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
      console.error('Failed to load notification preferences:', error);
      setPreferences(DEFAULT_PREFERENCES);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updatePreference = useCallback(
    async (key: keyof NotificationPreferences, value: boolean) => {
      try {
        const updated = { ...preferences, [key]: value };
        setPreferences(updated);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return true;
      } catch (error) {
        console.error('Failed to update notification preference:', error);
        return false;
      }
    },
    [preferences],
  );

  const resetToDefaults = useCallback(async () => {
    try {
      setPreferences(DEFAULT_PREFERENCES);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PREFERENCES));
      return true;
    } catch (error) {
      console.error('Failed to reset notification preferences:', error);
      return false;
    }
  }, []);

  const disableAllNotifications = useCallback(async () => {
    const allDisabled: NotificationPreferences = {
      messages: false,
      newListings: false,
      followedSellerUpdates: false,
      promotions: false,
      orderUpdates: false,
    };
    try {
      setPreferences(allDisabled);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(allDisabled));
      return true;
    } catch (error) {
      console.error('Failed to disable all notifications:', error);
      return false;
    }
  }, []);

  return {
    preferences,
    isLoading,
    updatePreference,
    resetToDefaults,
    disableAllNotifications,
  };
}
