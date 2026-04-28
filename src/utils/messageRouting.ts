import type { Href } from 'expo-router';

type SellerMessageRouteInput = {
  sellerId: string;
  productId?: string | null;
  productTitle?: string | null;
  whatsapp?: string | null;
  initialMessage?: string | null;
};

function appendParam(parts: string[], key: string, value?: string | null) {
  const clean = value?.trim();
  if (!clean) {
    return;
  }

  parts.push(`${key}=${encodeURIComponent(clean)}`);
}

export function buildMessagesInboxRoute(): Href {
  return '/messages';
}

export function buildConversationMessagesRoute(conversationId: string): Href {
  const clean = conversationId.trim();
  if (!clean) {
    return buildMessagesInboxRoute();
  }

  return `/messages?conversation=${encodeURIComponent(clean)}` as Href;
}

export function buildSellerMessagesRoute(input: SellerMessageRouteInput): Href {
  const sellerId = input.sellerId.trim();
  if (!sellerId) {
    return buildMessagesInboxRoute();
  }

  const queryParts = [`sellerId=${encodeURIComponent(sellerId)}`];
  appendParam(queryParts, 'productId', input.productId ?? undefined);
  appendParam(queryParts, 'productTitle', input.productTitle ?? undefined);
  appendParam(queryParts, 'whatsapp', input.whatsapp ?? undefined);
  appendParam(queryParts, 'initialMessage', input.initialMessage ?? undefined);

  return `/messages?${queryParts.join('&')}` as Href;
}
