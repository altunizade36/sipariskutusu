import { useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SEARCH_HISTORY_KEY = '@sipariskutusu/search_history';
const MAX_HISTORY = 10;

export async function addSearchHistory(query: string) {
  if (!query.trim()) return;

  try {
    const existing = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
    const history: string[] = existing ? JSON.parse(existing) : [];

    // Remove if already exists, then add to front
    const filtered = history.filter(h => h.toLowerCase() !== query.toLowerCase());
    const updated = [query, ...filtered].slice(0, MAX_HISTORY);

    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to add search history:', err);
  }
}

export async function getSearchHistory(): Promise<string[]> {
  try {
    const stored = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (err) {
    console.warn('Failed to get search history:', err);
    return [];
  }
}

export async function clearSearchHistory() {
  try {
    await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch (err) {
    console.warn('Failed to clear search history:', err);
  }
}

export async function removeSearchHistoryItem(query: string) {
  try {
    const existing = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
    if (!existing) return;

    const history: string[] = JSON.parse(existing);
    const updated = history.filter(h => h.toLowerCase() !== query.toLowerCase());

    if (updated.length === 0) {
      await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
    } else {
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    }
  } catch (err) {
    console.warn('Failed to remove search history item:', err);
  }
}

export function useSearchHistory() {
  return useMemo(
    () => ({
      add: addSearchHistory,
      get: getSearchHistory,
      clear: clearSearchHistory,
      remove: removeSearchHistoryItem,
    }),
    [],
  );
}
