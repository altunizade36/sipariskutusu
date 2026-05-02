import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Network from 'expo-network';

/**
 * Returns true when the device has an active network connection.
 * Re-checks on app foreground and on a 10-second interval.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  async function check() {
    try {
      const state = await Network.getNetworkStateAsync();
      setIsOnline(state.isInternetReachable !== false && state.isConnected === true);
    } catch {
      // If we can't even call the API, assume online to avoid false negatives
    }
  }

  useEffect(() => {
    check();

    // Re-check when app comes to foreground
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') check();
    });

    // Poll every 10 s while component is mounted
    const interval = setInterval(check, 10_000);

    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, []);

  return { isOnline };
}
