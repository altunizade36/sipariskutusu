import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as baseColors } from '../constants/theme';

type ThemeMode = 'light' | 'system' | 'dark';

const lightColors = {
  ...baseColors,
  surface: baseColors.card,
  background: baseColors.background,
};

const darkColors = {
  ...baseColors,
  primary: '#60A5FA',
  secondary: '#93C5FD',
  accent: '#BFDBFE',
  background: '#0B1220',
  card: '#111827',
  surface: '#111827',
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  border: '#334155',
  borderDefault: '#475569',
  borderLight: '#1F2937',
};

interface ThemeContextType {
  mode: ThemeMode;
  activeTheme: 'light' | 'dark';
  colors: typeof lightColors;
  isDarkMode: boolean;
  isDark: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
  toggleDarkMode: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setThemeMode] = useState<ThemeMode>('system');
  const [isLoaded, setIsLoaded] = useState(false);
  const activeTheme = mode === 'system' ? (systemColorScheme === 'dark' ? 'dark' : 'light') : mode;
  const isDarkMode = activeTheme === 'dark';

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const saved = await AsyncStorage.getItem('theme_preference');
      if (saved === 'light' || saved === 'system' || saved === 'dark') {
        setThemeMode(saved);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const setMode = async (nextMode: ThemeMode) => {
    try {
      setThemeMode(nextMode);
      await AsyncStorage.setItem('theme_preference', nextMode);
    } catch (error) {
      console.error('Error toggling dark mode:', error);
    }
  };

  const toggleTheme = async () => {
    await setMode(isDarkMode ? 'light' : 'dark');
  };

  const toggleDarkMode = toggleTheme;

  if (!isLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider
      value={{
        mode,
        activeTheme,
        colors: isDarkMode ? darkColors : lightColors,
        isDarkMode,
        isDark: isDarkMode,
        setMode,
        toggleTheme,
        toggleDarkMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
