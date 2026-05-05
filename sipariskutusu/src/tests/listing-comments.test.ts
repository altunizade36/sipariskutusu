import { describe, expect, it } from 'vitest';
import { buildListingCommentThread } from '../utils/listingComments';

describe('listingCommentService', () => {
  it('builds a stable threaded tree from flat rows', () => {
    const thread = buildListingCommentThread([
      {
        id: 'parent-1',
        listing_id: 'listing-1',
        user_id: 'user-1',
        parent_id: null,
        comment: 'Ana yorum',
        status: 'active',
        created_at: '2026-04-27T10:00:00.000Z',
        profiles: { full_name: 'Birinci Kullanıcı', username: 'birinci', avatar_url: null },
      },
      {
        id: 'reply-1',
        listing_id: 'listing-1',
        user_id: 'user-2',
        parent_id: 'parent-1',
        comment: 'Yanıt',
        status: 'active',
        created_at: '2026-04-27T10:05:00.000Z',
        profiles: { full_name: 'İkinci Kullanıcı', username: 'ikinci', avatar_url: null },
      },
      {
        id: 'parent-2',
        listing_id: 'listing-1',
        user_id: 'user-3',
        parent_id: null,
        comment: 'İkinci ana yorum',
        status: 'hidden',
        created_at: '2026-04-27T10:06:00.000Z',
        profiles: { full_name: null, username: 'ucuncu', avatar_url: null },
      },
    ], 'user-1');

    expect(thread).toHaveLength(2);
    expect(thread[0]?.isMine).toBe(true);
    expect(thread[0]?.replies).toHaveLength(1);
    expect(thread[0]?.replies[0]?.authorName).toBe('İkinci Kullanıcı');
    expect(thread[1]?.authorName).toBe('ucuncu');
    expect(thread[1]?.status).toBe('hidden');
  });
});