import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchUnreadNotificationCount, subscribeToMyNotifications } from '../services/inAppNotificationService';

export function useUnreadNotificationCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const n = await fetchUnreadNotificationCount();
      if (mountedRef.current) setCount(n);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (!user) {
      setCount(0);
      return;
    }

    void refresh();
    const unsub = subscribeToMyNotifications(user.id, () => {
      void refresh();
    });

    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, [user?.id, refresh]);

  return count;
}
