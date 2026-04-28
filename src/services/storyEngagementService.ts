import { getSupabaseClient } from './supabase';

type EngagementSummary = {
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};

type StoryCommentRow = {
  story_id: string;
  body: string;
  created_at: string;
};

async function getUserId() {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Giriş yapmanız gerekiyor.');
  }

  return user.id;
}

export async function fetchStoryEngagement(storyIds: string[]): Promise<Record<string, EngagementSummary>> {
  if (storyIds.length === 0) {
    return {};
  }

  const supabase = getSupabaseClient();
  const userId = await getUserId();

  const [likesResponse, commentsResponse] = await Promise.all([
    supabase
      .from('story_likes')
      .select('story_id,user_id')
      .in('story_id', storyIds),
    supabase
      .from('story_comments')
      .select('id,story_id')
      .in('story_id', storyIds),
  ]);

  if (likesResponse.error) {
    throw likesResponse.error;
  }

  if (commentsResponse.error) {
    throw commentsResponse.error;
  }

  const summary = storyIds.reduce<Record<string, EngagementSummary>>((acc, storyId) => {
    acc[storyId] = { likeCount: 0, commentCount: 0, likedByMe: false };
    return acc;
  }, {});

  (likesResponse.data ?? []).forEach((row) => {
    const target = summary[row.story_id];
    if (!target) {
      return;
    }

    target.likeCount += 1;
    if (row.user_id === userId) {
      target.likedByMe = true;
    }
  });

  (commentsResponse.data ?? []).forEach((row) => {
    const target = summary[row.story_id];
    if (!target) {
      return;
    }

    target.commentCount += 1;
  });

  return summary;
}

export async function setStoryLike(storyId: string, shouldLike: boolean): Promise<void> {
  const supabase = getSupabaseClient();
  const userId = await getUserId();

  if (shouldLike) {
    const { data: existing, error: existingError } = await supabase
      .from('story_likes')
      .select('id')
      .eq('story_id', storyId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      return;
    }

    const { error } = await supabase
      .from('story_likes')
      .insert({ story_id: storyId, user_id: userId });

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase
    .from('story_likes')
    .delete()
    .eq('story_id', storyId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

export async function addStoryCommentRemote(storyId: string, body: string): Promise<void> {
  const supabase = getSupabaseClient();
  const userId = await getUserId();

  const { error } = await supabase
    .from('story_comments')
    .insert({ story_id: storyId, user_id: userId, body });

  if (error) {
    throw error;
  }
}

export async function fetchStoryComments(storyIds: string[]): Promise<Record<string, string[]>> {
  if (storyIds.length === 0) {
    return {};
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('story_comments')
    .select('story_id,body,created_at')
    .in('story_id', storyIds)
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) {
    throw error;
  }

  const grouped: Record<string, string[]> = {};
  (data as StoryCommentRow[] | null ?? []).forEach((row) => {
    grouped[row.story_id] = [...(grouped[row.story_id] ?? []), row.body];
  });

  return grouped;
}
