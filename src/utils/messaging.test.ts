import { describe, expect, it } from 'vitest';
import { formatLastSeenLabel, mapReactionsByMessage, toggleEmoji } from './messaging';

describe('messaging utils', () => {
  it('groups reactions by message id', () => {
    const result = mapReactionsByMessage([
      { message_id: 'm1', emoji: '🔥' },
      { message_id: 'm1', emoji: '👍' },
      { message_id: 'm2', emoji: '❤️' },
    ]);

    expect(result).toEqual({
      m1: ['🔥', '👍'],
      m2: ['❤️'],
    });
  });

  it('toggles reaction in map', () => {
    const start = { m1: ['🔥'] };

    const added = toggleEmoji(start, 'm1', '👍');
    expect(added).toEqual({ m1: ['🔥', '👍'] });

    const removed = toggleEmoji(added, 'm1', '🔥');
    expect(removed).toEqual({ m1: ['👍'] });
  });

  it('formats last-seen label', () => {
    const now = new Date();
    const currentDay = new Date(now.getTime() - 60_000).toISOString();
    const prevDay = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

    const sameDayLabel = formatLastSeenLabel(currentDay);
    expect(sameDayLabel.startsWith('Son görülme')).toBe(true);

    const olderLabel = formatLastSeenLabel(prevDay);
    expect(olderLabel.startsWith('Son görülme')).toBe(true);

    expect(formatLastSeenLabel()).toBe('Çevrimdışı');
  });
});
