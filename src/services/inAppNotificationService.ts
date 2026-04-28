import { getSupabaseClient, isSupabaseConfigured } from './supabase';

export type InAppNotificationType =
  | 'order_placed'
  | 'order_shipped'
  | 'order_delivered'
  | 'new_message'
  | 'new_review'
  | 'price_drop'
  | 'favorite_sold'
  | 'listing_approved'
  | 'listing_rejected'
  | 'listing_comment'
  | 'favorite_listing_comment'
  | 'listing_favorited'
  | 'listing_shared'
  | 'seller_approved'
  | 'system';

export type InAppNotificationRecord = {
  id: string;
  userId: string;
  type: InAppNotificationType;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
};

type InAppNotificationRow = {
  id: string;
  user_id: string;
  type: InAppNotificationType;
  title: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
};

function mapRow(row: InAppNotificationRow): InAppNotificationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body ?? null,
    data: row.data ?? null,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
  };
}

function isMissingRpcError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? '';
  return error?.code === '42883' || message.includes('function') || message.includes('does not exist');
}

async function getCurrentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const supabase = getSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user?.id ?? null;
}

export function resolveNotificationRoute(notification: Pick<InAppNotificationRecord, 'type' | 'data'>): string | null {
  const data = notification.data ?? null;
  const listingId = typeof data?.listing_id === 'string' ? data.listing_id : null;

  if (listingId) {
    return `/product/${listingId}`;
  }

  if (notification.type === 'new_message') {
    return '/messages';
  }

  if (notification.type === 'system') {
    const reportId = typeof data?.report_id === 'string' ? data.report_id : null;
    if (reportId) {
      return '/my-reports';
    }
  }

  return null;
}

export async function fetchMyNotifications(limit = 100, onlyUnread = false): Promise<InAppNotificationRecord[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('fetch_my_notifications', {
    p_limit: Math.max(1, Math.min(limit, 500)),
    p_only_unread: onlyUnread,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      const userId = await getCurrentUserId();
      if (!userId) {
        return [];
      }

      let query = supabase
        .from('notifications')
        .select('id,user_id,type,title,body,data,is_read,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(Math.max(1, Math.min(limit, 500)));

      if (onlyUnread) {
        query = query.eq('is_read', false);
      }

      const { data: rows, error: queryError } = await query;
      if (queryError) {
        throw queryError;
      }

      return ((rows as InAppNotificationRow[] | null) ?? []).map(mapRow);
    }

    throw error;
  }

  return ((data as InAppNotificationRow[] | null) ?? []).map(mapRow);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      const userId = await getCurrentUserId();
      if (!userId) {
        return;
      }

      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (updateError) {
        throw updateError;
      }

      return;
    }

    throw error;
  }
}

export async function markAllNotificationsRead(): Promise<number> {
  if (!isSupabaseConfigured) {
    return 0;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('mark_all_notifications_read');

  if (error) {
    if (isMissingRpcError(error)) {
      const userId = await getCurrentUserId();
      if (!userId) {
        return 0;
      }

      const { count, error: countError } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (countError) {
        throw countError;
      }

      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (updateError) {
        throw updateError;
      }

      return Number(count ?? 0);
    }

    throw error;
  }

  return Number(data ?? 0);
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  if (!isSupabaseConfigured) {
    return 0;
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return 0;
  }

  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    throw error;
  }

  return Number(count ?? 0);
}

export function subscribeToMyNotifications(userId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured || !userId) {
    return () => undefined;
  }

  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`notifications-${userId}-${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        onChange();
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
