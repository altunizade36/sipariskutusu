import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = '@sipariskutusu/viewed_stories_v1';
const MAX_STORED = 500;

export function useViewedStories() {
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [isHydrated, setIsHydrated] = useState(false);
  const pendingMarks = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active) return;
        let stored: string[] = [];
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              stored = parsed.filter((value): value is string => typeof value === 'string');
            }
          } catch {
            /* ignore corrupt */
          }
        }
        // Merge any marks that happened before hydration completed
        const merged = new Set<string>([...stored, ...pendingMarks.current]);
        pendingMarks.current.clear();
        const arr = Array.from(merged).slice(-MAX_STORED);
        setViewedIds(new Set(arr));
        // Persist if we merged any pending marks
        if (arr.length !== stored.length) {
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(arr)).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const markViewed = useCallback((storyId: string) => {
    if (!storyId) return;
    if (!isHydrated) {
      // Buffer until hydration; in-memory update is still applied for immediate UI feedback
      pendingMarks.current.add(storyId);
      setViewedIds((prev) => (prev.has(storyId) ? prev : new Set([...prev, storyId])));
      return;
    }
    setViewedIds((prev) => {
      if (prev.has(storyId)) return prev;
      const next = new Set(prev);
      next.add(storyId);
      const arr = Array.from(next).slice(-MAX_STORED);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(arr)).catch(() => {});
      return new Set(arr);
    });
  }, [isHydrated]);

  const isViewed = useCallback((storyId: string) => viewedIds.has(storyId), [viewedIds]);

  return { isViewed, markViewed, viewedIds, isHydrated };
}
