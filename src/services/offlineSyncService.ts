import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export interface NetworkState {
  isConnected: boolean;
  type: 'wifi' | 'cellular' | 'none' | 'unknown';
  isExpensive: boolean;
  isInternetReachable: boolean;
}

export interface OfflineAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  retries: number;
  maxRetries: number;
}

export class OfflineQueueManager {
  private static queue: OfflineAction[] = [];
  private static maxQueueSize = 100;

  static enqueue(action: OfflineAction): void {
    if (this.queue.length >= this.maxQueueSize) {
      console.warn('Offline queue is full, removing oldest action');
      this.queue.shift();
    }

    this.queue.push(action);
  }

  static dequeue(): OfflineAction | undefined {
    return this.queue.shift();
  }

  static peek(): OfflineAction | undefined {
    return this.queue[0];
  }

  static getQueue(): OfflineAction[] {
    return [...this.queue];
  }

  static size(): number {
    return this.queue.length;
  }

  static clear(): void {
    this.queue = [];
  }

  static async processQueue(
    handler: (action: OfflineAction) => Promise<boolean>,
  ): Promise<{
    processed: number;
    failed: number;
    remaining: number;
  }> {
    let processed = 0;
    let failed = 0;

    while (this.queue.length > 0) {
      const action = this.peek();
      if (!action) break;

      try {
        const success = await handler(action);

        if (success) {
          this.dequeue();
          processed++;
        } else {
          action.retries++;

          if (action.retries >= action.maxRetries) {
            console.error(`Action ${action.id} failed after ${action.maxRetries} retries`);
            this.dequeue();
            failed++;
          } else {
            break; // Stop processing on first failure
          }
        }
      } catch (error) {
        console.error(`Error processing action ${action.id}:`, error);
        action.retries++;

        if (action.retries >= action.maxRetries) {
          this.dequeue();
          failed++;
        } else {
          break;
        }
      }
    }

    return {
      processed,
      failed,
      remaining: this.queue.length,
    };
  }
}

export function useNetworkState(): NetworkState & { isOnline: boolean } {
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: true,
    type: 'unknown',
    isExpensive: false,
    isInternetReachable: true,
  });

  useEffect(() => {
    // For web/expo, just track basic online status
    const handleOnline = () => {
      setNetworkState((prev) => ({
        ...prev,
        isConnected: true,
        isInternetReachable: true,
      }));
    };

    const handleOffline = () => {
      setNetworkState((prev) => ({
        ...prev,
        isConnected: false,
        isInternetReachable: false,
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial state
    setNetworkState((prev) => ({
      ...prev,
      isConnected: navigator.onLine,
      isInternetReachable: navigator.onLine,
    }));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    ...networkState,
    isOnline: networkState.isConnected && networkState.isInternetReachable,
  };
}

export function useAppState() {
  const [appState, setAppState] = useState<typeof AppState.currentState>('unknown');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = (state: typeof AppState.currentState) => {
    setAppState(state);
  };

  return {
    appState,
    isActive: appState === 'active',
    isBackground: appState === 'background',
    isInactive: appState === 'inactive',
  };
}

export class SyncCoordinator {
  private static syncInProgress = false;
  private static lastSyncTime = 0;
  private static syncInterval = 5 * 60 * 1000; // 5 minutes

  static async syncIfNeeded(
    shouldSync: () => boolean,
    syncFunction: () => Promise<boolean>,
  ): Promise<boolean> {
    if (this.syncInProgress) {
      console.warn('Sync already in progress');
      return false;
    }

    const timeSinceLastSync = Date.now() - this.lastSyncTime;
    if (timeSinceLastSync < this.syncInterval && !shouldSync()) {
      return false;
    }

    this.syncInProgress = true;

    try {
      const success = await syncFunction();
      if (success) {
        this.lastSyncTime = Date.now();
      }
      return success;
    } finally {
      this.syncInProgress = false;
    }
  }

  static isEnabled(): boolean {
    return !this.syncInProgress;
  }

  static getLastSyncTime(): number {
    return this.lastSyncTime;
  }

  static getTimeSinceLastSync(): number {
    return Date.now() - this.lastSyncTime;
  }

  static reset(): void {
    this.syncInProgress = false;
    this.lastSyncTime = 0;
  }
}
