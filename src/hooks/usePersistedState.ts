import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PersistenceConfig {
  key: string;
  version?: number;
  ttl?: number; // milliseconds
  encrypt?: boolean;
  migrateData?: (data: any, fromVersion: number) => any;
}

export function usePersistedState<T>(
  initialState: T,
  config: PersistenceConfig,
): [T, (value: T | ((prev: T) => T)) => void, { loading: boolean; error: Error | null }] {
  const [state, setState] = useState<T>(initialState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mounted = useRef(true);

  const key = `persist:${config.key}:v${config.version || 1}`;

  // Load persisted state
  useEffect(() => {
    const load = async () => {
      try {
        const data = await AsyncStorage.getItem(key);

        if (!data) {
          if (mounted.current) {
            setLoading(false);
          }
          return;
        }

        const parsed = JSON.parse(data);

        // Check TTL
        if (config.ttl && Date.now() - parsed.timestamp > config.ttl) {
          await AsyncStorage.removeItem(key);
          if (mounted.current) {
            setLoading(false);
          }
          return;
        }

        // Run migration if provided
        let value = parsed.value;
        if (config.migrateData && parsed.version !== (config.version || 1)) {
          value = config.migrateData(value, parsed.version || 1);
        }

        if (mounted.current) {
          setState(value);
          setLoading(false);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (mounted.current) {
          setError(error);
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted.current = false;
    };
  }, [key, config]);

  // Save state when it changes
  const setSavedState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prevState) => {
        const newState = typeof value === 'function' ? (value as (prev: T) => T)(prevState) : value;

        // Persist
        AsyncStorage.setItem(
          key,
          JSON.stringify({
            value: newState,
            version: config.version || 1,
            timestamp: Date.now(),
          }),
        ).catch((err) => {
          console.error(`Failed to persist ${config.key}:`, err);
        });

        return newState;
      });
    },
    [key, config],
  );

  return [state, setSavedState, { loading, error }];
}

export function useLocalStorage<T>(
  key: string,
  initialValue?: T,
): [T | undefined, (value: T) => Promise<void>, () => Promise<void>] {
  const [storedValue, setStoredValue] = useState<T | undefined>(initialValue);

  // Read from storage
  useEffect(() => {
    const readValue = async () => {
      try {
        const item = await AsyncStorage.getItem(`local:${key}`);
        if (item) {
          setStoredValue(JSON.parse(item));
        } else if (initialValue !== undefined) {
          setStoredValue(initialValue);
        }
      } catch (error) {
        console.error(`Failed to read ${key}:`, error);
      }
    };

    readValue();
  }, [key, initialValue]);

  const setValue = useCallback(
    async (value: T) => {
      try {
        setStoredValue(value);
        await AsyncStorage.setItem(`local:${key}`, JSON.stringify(value));
      } catch (error) {
        console.error(`Failed to save ${key}:`, error);
      }
    },
    [key],
  );

  const removeValue = useCallback(async () => {
    try {
      setStoredValue(undefined);
      await AsyncStorage.removeItem(`local:${key}`);
    } catch (error) {
      console.error(`Failed to remove ${key}:`, error);
    }
  }, [key]);

  return [storedValue, setValue, removeValue];
}

export function useSyncedState<T>(
  initialState: T,
  key: string,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(initialState);
  const stateRef = useRef(state);

  // Update ref when state changes
  useEffect(() => {
    stateRef.current = state;
    // Sync to storage
    AsyncStorage.setItem(`synced:${key}`, JSON.stringify(state)).catch((err) => {
      console.error(`Failed to sync ${key}:`, err);
    });
  }, [state, key]);

  const setSyncedState = useCallback(
    (value: T | ((prev: T) => T)) => {
      const newState = typeof value === 'function' ? (value as any)(stateRef.current) : value;
      setState(newState);
    },
    [],
  );

  return [state, setSyncedState];
}
