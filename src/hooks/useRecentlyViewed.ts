import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENTLY_VIEWED_KEY = '@sipariskutusu/recently_viewed';
const MAX_ITEMS = 20;

export interface RecentlyViewedItem {
  id: string;
  title: string;
  imageUri: string;
  price: number;
  timestamp: number;
}

export async function addToRecentlyViewed(item: Omit<RecentlyViewedItem, 'timestamp'>) {
  try {
    const existing = await AsyncStorage.getItem(RECENTLY_VIEWED_KEY);
    const items: RecentlyViewedItem[] = existing ? JSON.parse(existing) : [];

    // Remove if already exists, then add to front
    const filtered = items.filter(i => i.id !== item.id);
    const updated = [
      { ...item, timestamp: Date.now() },
      ...filtered,
    ].slice(0, MAX_ITEMS);

    await AsyncStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to add to recently viewed:', err);
  }
}

export async function getRecentlyViewed(): Promise<RecentlyViewedItem[]> {
  try {
    const stored = await AsyncStorage.getItem(RECENTLY_VIEWED_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (err) {
    console.warn('Failed to get recently viewed:', err);
    return [];
  }
}

export async function clearRecentlyViewed() {
  try {
    await AsyncStorage.removeItem(RECENTLY_VIEWED_KEY);
  } catch (err) {
    console.warn('Failed to clear recently viewed:', err);
  }
}

export function useRecentlyViewed() {
  return {
    add: addToRecentlyViewed,
    get: getRecentlyViewed,
    clear: clearRecentlyViewed,
  };
}
