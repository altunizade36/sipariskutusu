export type ReactionRow = {
  message_id: string;
  emoji: string;
};

export function mapReactionsByMessage(items: ReactionRow[]): Record<string, string[]> {
  const mapped: Record<string, string[]> = {};

  for (const row of items) {
    mapped[row.message_id] = [...(mapped[row.message_id] ?? []), row.emoji];
  }

  return mapped;
}

export function toggleEmoji(
  reactions: Record<string, string[]>,
  messageId: string,
  emoji: string,
): Record<string, string[]> {
  const current = reactions[messageId] ?? [];

  if (current.includes(emoji)) {
    return {
      ...reactions,
      [messageId]: current.filter((item) => item !== emoji),
    };
  }

  return {
    ...reactions,
    [messageId]: [...current, emoji],
  };
}

export function formatLastSeenLabel(iso?: string): string {
  if (!iso) return 'Çevrimdışı';

  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return `Son görülme ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  return `Son görülme ${date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
}
