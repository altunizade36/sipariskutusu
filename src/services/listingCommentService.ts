import { getSupabaseClient } from './supabase';
import { buildListingCommentThread, mapListingCommentRow, type ListingComment, type ListingCommentRow } from '../utils/listingComments';

export type { ListingComment, ListingCommentRow, ListingCommentStatus } from '../utils/listingComments';

async function getCurrentUserId(): Promise<string | null> {
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

async function fetchListingCommentRowById(commentId: string): Promise<ListingCommentRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('listing_comments')
    .select(`
      id,
      listing_id,
      user_id,
      parent_id,
      comment,
      status,
      created_at,
      profiles!listing_comments_user_id_fkey (full_name, username, avatar_url)
    `)
    .eq('id', commentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ListingCommentRow | null) ?? null;
}

export async function fetchListingComments(listingId: string): Promise<ListingComment[]> {
  if (!listingId?.trim()) {
    return [];
  }

  const supabase = getSupabaseClient();
  const currentUserId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('listing_comments')
    .select(`
      id,
      listing_id,
      user_id,
      parent_id,
      comment,
      status,
      created_at,
      profiles!listing_comments_user_id_fkey (full_name, username, avatar_url)
    `)
    .eq('listing_id', listingId)
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) {
    throw error;
  }

  return buildListingCommentThread((data as ListingCommentRow[] | null) ?? [], currentUserId);
}

export async function addListingComment(
  listingId: string,
  comment: string,
  parentId?: string | null,
): Promise<ListingComment> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('add_listing_comment', {
    p_listing_id: listingId,
    p_comment: comment,
    p_parent_id: parentId ?? null,
  });

  if (error) {
    throw error;
  }

  const commentId = String(data ?? '');
  if (!commentId) {
    throw new Error('Yorum kaydedilemedi.');
  }

  const currentUserId = await getCurrentUserId();
  const row = await fetchListingCommentRowById(commentId);
  if (!row) {
    throw new Error('Yeni yorum okunamadi.');
  }

  return mapListingCommentRow(row, currentUserId);
}

export async function deleteMyListingComment(commentId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('delete_my_listing_comment', {
    p_comment_id: commentId,
  });

  if (error) {
    throw error;
  }
}

export async function hideListingCommentAsAdmin(commentId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('hide_listing_comment_admin', {
    p_comment_id: commentId,
  });

  if (error) {
    throw error;
  }
}

export function subscribeToListingComments(listingId: string, onChange: () => void): () => void {
  if (!listingId?.trim()) {
    return () => undefined;
  }

  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`listing-comments-${listingId}-${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'listing_comments',
        filter: `listing_id=eq.${listingId}`,
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