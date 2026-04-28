import { getSupabaseClient } from './supabase';

export interface StoryRow {
  id: string;
  owner_id?: string | null;
  user_id: string;
  store_id?: string | null;
  listing_id?: string | null;
  image_url: string;
  caption?: string | null;
  view_count: number;
  expires_at: string;
  created_at: string;
  is_archived: boolean;
  profiles?: { full_name?: string | null; avatar_url?: string | null };
  listings?: { title?: string | null; price?: number | null } | null;
}

async function getUserId() {
  const supabase = getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Giriş yapmanız gerekiyor.');
  }
  return user.id;
}

async function uploadStoryImage(uri: string, userId: string) {
  const supabase = getSupabaseClient();
  const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;

  const response = await fetch(uri);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();

  const { error } = await supabase.storage
    .from('story-images')
    .upload(path, arrayBuffer, {
      upsert: true,
      contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from('story-images').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Fetch active (non-expired, non-archived) stories
 * Automatically filters by story expiration time
 */
export async function fetchActiveStories(): Promise<StoryRow[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('stories')
    .select('*, profiles!stories_user_id_fkey(full_name, avatar_url), listings(title, price)')
    .gt('expires_at', new Date().toISOString())
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(40);

  if (error) {
    throw error;
  }

  return (data ?? []) as StoryRow[];
}

export async function fetchStoryById(storyId: string): Promise<StoryRow | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('stories')
    .select('*, profiles!stories_user_id_fkey(full_name, avatar_url), listings(title, price)')
    .eq('id', storyId)
    .gt('expires_at', new Date().toISOString())
    .eq('is_archived', false)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as StoryRow | null;
}

/**
 * Fetch stories for a specific user (seller's stories)
 * Only returns non-expired stories
 */
export async function fetchUserStories(userId: string): Promise<StoryRow[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('stories')
    .select('*, profiles!stories_user_id_fkey(full_name, avatar_url)')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  return (data ?? []) as StoryRow[];
}

/**
 * Create a new story with automatic 24-hour expiration
 */
export async function createStory(input: {
  imageUri: string;
  caption?: string;
  storeId?: string;
  listingId?: string;
}) {
  const supabase = getSupabaseClient();
  const userId = await getUserId();
  const imageUrl = input.imageUri.startsWith('http')
    ? input.imageUri
    : await uploadStoryImage(input.imageUri, userId);

  const { data, error } = await supabase
    .from('stories')
    .insert({
      owner_id: userId,
      user_id: userId,
      store_id: input.storeId ?? null,
      listing_id: input.listingId ?? null,
      image_url: imageUrl,
      caption: input.caption ?? null,
      is_archived: false,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as StoryRow;
}

/**
 * Mark a story as viewed and increment view count
 * Handles duplicate views gracefully
 */
export async function markStorySeen(storyId: string) {
  const supabase = getSupabaseClient();
  const userId = await getUserId();

  // Check if user already viewed this story
  const { data: existing } = await supabase
    .from('story_views')
    .select('id')
    .eq('story_id', storyId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    return;
  }

  // Insert view record
  const { error: viewError } = await supabase
    .from('story_views')
    .insert({ story_id: storyId, user_id: userId });

  if (viewError) {
    console.error('Failed to insert story view:', viewError);
    return;
  }

  // Increment story view count
  const { error: countError } = await supabase.rpc(
    'increment_story_view_count',
    { p_story_id: storyId }
  );

  if (countError) {
    console.error('Failed to increment story view count:', countError);
  }
}

/**
 * Delete a story (only owner can delete)
 */
export async function deleteStory(storyId: string) {
  const supabase = getSupabaseClient();
  const userId = await getUserId();

  const { error } = await supabase
    .from('stories')
    .delete()
    .eq('id', storyId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

/**
 * Archive a story (soft delete)
 */
export async function archiveStory(storyId: string) {
  const supabase = getSupabaseClient();
  const userId = await getUserId();

  const { error } = await supabase
    .from('stories')
    .update({ is_archived: true })
    .eq('id', storyId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

/**
 * Update story metadata (caption/listing/image) for owner
 */
export async function updateStory(
  storyId: string,
  updates: { caption?: string | null; listingId?: string | null; imageUri?: string | null },
) {
  const supabase = getSupabaseClient();
  const userId = await getUserId();

  const payload: Record<string, unknown> = {};

  if (updates.caption !== undefined) {
    payload.caption = updates.caption;
  }
  if (updates.listingId !== undefined) {
    payload.listing_id = updates.listingId;
  }
  if (updates.imageUri !== undefined && updates.imageUri) {
    payload.image_url = updates.imageUri.startsWith('http')
      ? updates.imageUri
      : await uploadStoryImage(updates.imageUri, userId);
  }

  if (Object.keys(payload).length === 0) {
    return;
  }

  const { error } = await supabase
    .from('stories')
    .update(payload)
    .eq('id', storyId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

/**
 * Link a product to a story
 */
export async function linkProductToStory(storyId: string, listingId: string, actionType: string = 'view') {
  const supabase = getSupabaseClient();
  const userId = await getUserId();

  // Verify user owns the story
  const { data: story, error: storyError } = await supabase
    .from('stories')
    .select('owner_id, user_id')
    .eq('id', storyId)
    .single();

  const ownerId = story?.owner_id ?? story?.user_id;
  if (storyError || ownerId !== userId) {
    throw new Error('İzniniz yok bu hikayeyi düzenlemek için.');
  }

  const { data, error } = await supabase
    .from('story_products')
    .insert({
      story_id: storyId,
      listing_id: listingId,
      action_type: actionType,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Get products linked to a story
 */
export async function getStoryProducts(storyId: string) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('story_products')
    .select('*, listings(id, title, price)')
    .eq('story_id', storyId)
    .order('position', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

/**
 * Like a story
 */
export async function likeStory(storyId: string) {
  const supabase = getSupabaseClient();
  const userId = await getUserId();

  const { error } = await supabase.from('story_likes').insert({
    story_id: storyId,
    user_id: userId,
  });

  if (error && !error.message.includes('duplicate')) {
    throw error;
  }
}

/**
 * Unlike a story
 */
export async function unlikeStory(storyId: string) {
  const supabase = getSupabaseClient();
  const userId = await getUserId();

  const { error } = await supabase
    .from('story_likes')
    .delete()
    .eq('story_id', storyId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

/**
 * Add comment to story
 */
export async function commentOnStory(storyId: string, body: string) {
  const supabase = getSupabaseClient();
  const userId = await getUserId();

  if (!body.trim()) {
    throw new Error('Yorum boş olamaz.');
  }

  const { data, error } = await supabase
    .from('story_comments')
    .insert({
      story_id: storyId,
      user_id: userId,
      body: body.trim(),
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Get story comments
 */
export async function getStoryComments(storyId: string) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('story_comments')
    .select('*, profiles(id, full_name, avatar_url)')
    .eq('story_id', storyId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return data ?? [];
}

/**
 * Check if story is expired
 */
export function isStoryExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

/**
 * Get time remaining for story (in seconds)
 */
export function getStoryTimeRemaining(expiresAt: string): number {
  const remaining = new Date(expiresAt).getTime() - new Date().getTime();
  return Math.max(0, Math.floor(remaining / 1000));
}

/**
 * Format story expiration time for display
 */
export function formatStoryExpiration(expiresAt: string): string {
  const seconds = getStoryTimeRemaining(expiresAt);
  
  if (seconds === 0) {
    return 'Süresi doldu';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}s ${minutes}d kaldı`;
  }

  return `${minutes}d kaldı`;
}

/**
 * Archive expired stories (admin/cron function)
 * Should be called periodically via Supabase cron jobs
 */
export async function archiveExpiredStories() {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase.rpc('archive_expired_stories');

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to archive expired stories:', error);
    throw error;
  }
}
