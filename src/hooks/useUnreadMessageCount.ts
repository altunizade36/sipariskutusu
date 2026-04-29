import { useMemo } from 'react';
import { useListings } from '../context/ListingsContext';
import { useAuth } from '../context/AuthContext';

/**
 * Hook to get total unread message count
 * Used for tab badge and notification indicators
 */
export function useUnreadMessageCount(): number {
  const { user } = useAuth();
  const { conversations } = useListings();

  const totalUnread = useMemo(() => {
    if (!user || !conversations || !Array.isArray(conversations)) {
      return 0;
    }

    return conversations.reduce((sum, conv) => {
      return sum + (conv.unreadCount || 0);
    }, 0);
  }, [conversations, user]);

  return totalUnread;
}
