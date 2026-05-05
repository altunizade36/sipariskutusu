import { useEffect, useRef, useState } from 'react';

export interface FocusState {
  isFocused: boolean;
  lastFocusedAt: number;
  lastBlurredAt: number;
  focusCount: number;
}

export function useFocus(
  onFocus?: () => void,
  onBlur?: () => void,
): FocusState {
  const stateRef = useRef<FocusState>({
    isFocused: true,
    lastFocusedAt: Date.now(),
    lastBlurredAt: 0,
    focusCount: 0,
  });

  useEffect(() => {
    const handleFocus = () => {
      stateRef.current.isFocused = true;
      stateRef.current.lastFocusedAt = Date.now();
      stateRef.current.focusCount++;

      if (onFocus) {
        onFocus();
      }
    };

    const handleBlur = () => {
      stateRef.current.isFocused = false;
      stateRef.current.lastBlurredAt = Date.now();

      if (onBlur) {
        onBlur();
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [onFocus, onBlur]);

  return stateRef.current;
}

export function usePageVisibility() {
  const isVisibleRef = useRef(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const hidden = document.hidden;
      isVisibleRef.current = !hidden;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisibleRef.current;
}

export function useTabActive(
  onTabActive?: () => void,
  onTabInactive?: () => void,
) {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (onTabInactive) {
          onTabInactive();
        }
      } else {
        if (onTabActive) {
          onTabActive();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onTabActive, onTabInactive]);
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function useIdleTimer(
  idleTimeoutMs: number = 5 * 60 * 1000, // 5 minutes
  onIdle?: () => void,
  onActive?: () => void,
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isIdleRef = useRef(false);

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (isIdleRef.current && onActive) {
      onActive();
    }

    isIdleRef.current = false;

    timeoutRef.current = setTimeout(() => {
      isIdleRef.current = true;
      if (onIdle) {
        onIdle();
      }
    }, idleTimeoutMs) as any;
  };

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [idleTimeoutMs, onIdle, onActive]);

  return {
    isIdle: isIdleRef.current,
    resetIdleTimer: resetTimer,
  };
}

export function useBeforeUnload(callback?: () => void) {
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (callback) {
        callback();
      }

      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [callback]);
}
