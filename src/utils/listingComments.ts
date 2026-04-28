export type ListingCommentStatus = 'active' | 'hidden' | 'deleted';

export type ListingCommentRow = {
  id: string;
  listing_id: string;
  user_id: string;
  parent_id?: string | null;
  comment: string;
  status: ListingCommentStatus;
  created_at: string;
  profiles?: {
    full_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  } | null;
};

export type ListingComment = {
  id: string;
  listingId: string;
  userId: string;
  parentId: string | null;
  comment: string;
  status: ListingCommentStatus;
  createdAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
  isMine: boolean;
  replies: ListingComment[];
};

export function mapListingCommentRow(row: ListingCommentRow, currentUserId?: string | null): ListingComment {
  return {
    id: row.id,
    listingId: row.listing_id,
    userId: row.user_id,
    parentId: row.parent_id ?? null,
    comment: row.comment,
    status: row.status,
    createdAt: row.created_at,
    authorName: row.profiles?.full_name?.trim() || row.profiles?.username?.trim() || 'Kullanıcı',
    authorAvatarUrl: row.profiles?.avatar_url ?? null,
    isMine: currentUserId === row.user_id,
    replies: [],
  };
}

export function buildListingCommentThread(rows: ListingCommentRow[], currentUserId?: string | null): ListingComment[] {
  const mapped = rows.map((row) => mapListingCommentRow(row, currentUserId));
  const byId = new Map(mapped.map((comment) => [comment.id, comment]));
  const roots: ListingComment[] = [];

  for (const comment of mapped) {
    if (comment.parentId) {
      const parent = byId.get(comment.parentId);
      if (parent) {
        parent.replies.push(comment);
        continue;
      }
    }

    roots.push(comment);
  }

  const sortComments = (items: ListingComment[]) => {
    items.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
    items.forEach((item) => sortComments(item.replies));
  };

  sortComments(roots);
  return roots;
}