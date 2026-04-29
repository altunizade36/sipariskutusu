import { useEffect, useState, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export interface AppHealthMetrics {
  appOpenCount: number;
  totalSessionTime: number; // milliseconds
  averageSessionTime: number; // milliseconds
  lastOpenedAt?: number;
  isAppHealthy: boolean;
  errorCount: number;
}

export function useAppHealth() {
  const [metrics, setMetrics] = useState<AppHealthMetrics>({
    appOpenCount: 0,
    totalSessionTime: 0,
    averageSessionTime: 0,
    isAppHealthy: true,
    errorCount: 0,
  });

  const appState = useRef(AppState.currentState);
  const sessionStartTime = useRef(Date.now());

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = (state: AppStateStatus) => {
    if (state === 'active') {
      sessionStartTime.current = Date.now();
      setMetrics((prev) => ({
        ...prev,
        appOpenCount: prev.appOpenCount + 1,
        lastOpenedAt: Date.now(),
      }));
    } else if (state === 'background' || state === 'inactive') {
      const sessionTime = Date.now() - sessionStartTime.current;
      setMetrics((prev) => ({
        ...prev,
        totalSessionTime: prev.totalSessionTime + sessionTime,
        averageSessionTime:
          (prev.totalSessionTime + sessionTime) / (prev.appOpenCount || 1),
      }));
    }
    appState.current = state;
  };

  const recordError = () => {
    setMetrics((prev) => ({
      ...prev,
      errorCount: prev.errorCount + 1,
      isAppHealthy: prev.errorCount < 5,
    }));
  };

  const recordWarning = () => {
    setMetrics((prev) => ({
      ...prev,
      isAppHealthy: prev.errorCount < 3,
    }));
  };

  const resetMetrics = () => {
    setMetrics({
      appOpenCount: 0,
      totalSessionTime: 0,
      averageSessionTime: 0,
      isAppHealthy: true,
      errorCount: 0,
    });
  };

  return {
    metrics,
    recordError,
    recordWarning,
    resetMetrics,
  };
}
