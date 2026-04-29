import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  danger: string;
  success: string;
  warning: string;
}

export const LIGHT_THEME: ThemeColors = {
  primary: '#0066FF',
  secondary: '#6B7280',
  background: '#FFFFFF',
  surface: '#F9FAFB',
  text: '#111827',
  textSecondary: '#6B7280',
  border: '#D1D5DB',
  danger: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
};

export const DARK_THEME: ThemeColors = {
  primary: '#4D9FFF',
  secondary: '#A0AEC0',
  background: '#1F2937',
  surface: '#111827',
  text: '#F9FAFB',
  textSecondary: '#D1D5DB',
  border: '#4B5563',
  danger: '#FF6B6B',
  success: '#51CF66',
  warning: '#FFD43B',
};

const THEME_KEY = '@sipariskutusu/theme';

export function useThemeManager() {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadThemeMode();
  }, []);

  const loadThemeMode = async () => {
    try {
      const stored = await AsyncStorage.getItem(THEME_KEY);
      if (stored) {
        setThemeMode(stored as ThemeMode);
      }
    } catch (error) {
      console.error('Failed to load theme mode:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setTheme = async (mode: ThemeMode) => {
    try {
      setThemeMode(mode);
      await AsyncStorage.setItem(THEME_KEY, mode);
    } catch (error) {
      console.error('Failed to set theme:', error);
    }
  };

  const getActiveColorScheme = (): 'light' | 'dark' => {
    if (themeMode === 'auto') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return themeMode;
  };

  const getThemeColors = (): ThemeColors => {
    return getActiveColorScheme() === 'dark' ? DARK_THEME : LIGHT_THEME;
  };

  const toggleTheme = async () => {
    if (themeMode === 'light') {
      await setTheme('dark');
    } else if (themeMode === 'dark') {
      await setTheme('auto');
    } else {
      await setTheme('light');
    }
  };

  return {
    themeMode,
    setTheme,
    toggleTheme,
    getActiveColorScheme,
    getThemeColors,
    colors: getThemeColors(),
    isDark: getActiveColorScheme() === 'dark',
    isLoading,
  };
}
