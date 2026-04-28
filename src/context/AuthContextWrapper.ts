import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth as useBaseAuth } from './AuthContext';

let darkModeState = false;

export async function initDarkMode() {
  try {
    const saved = await AsyncStorage.getItem('theme_preference');
    darkModeState = saved === 'dark';
  } catch (error) {
    console.error('Error loading theme:', error);
  }
}

export async function toggleDarkModeState() {
  darkModeState = !darkModeState;
  try {
    await AsyncStorage.setItem('theme_preference', darkModeState ? 'dark' : 'light');
  } catch (error) {
    console.error('Error saving theme:', error);
  }
}

export function getDarkModeState() {
  return darkModeState;
}

export function useAuthExtended() {
  const baseAuth = useBaseAuth();

  return {
    ...baseAuth,
    isDarkMode: darkModeState,
    toggleDarkMode: toggleDarkModeState,
    login: baseAuth.signInWithPassword,
    signup: baseAuth.signUpWithPassword,
  };
}
