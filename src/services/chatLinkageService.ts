/**
 * chatLinkageService.ts
 * Chat linkage and seller logic for listings.
 * Establishes listing_id relationship for "Send Message" flow.
 */

import { getSupabaseClient } from './supabase';
import type { Listing } from './listingService';

export interface ConversationWithListing {
  id: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string;
  product_id?: string;
  created_at: string;
  updated_at: string;
  buyer?: { id: string; full_name: string; avatar_url?: string };
  seller?: { id: string; full_name: string; avatar_url?: string };
  listing?: Listing;
}

/**
 * getOrCreateConversationForListing
 * Creates or retrieves a conversation for a specific listing.
 * Links buyer to seller through the listing_id.
 * 
 * Used by: "Send Message" button on product pages
 */
export async function getOrCreateConversationForListing(
  buyerId: string,
  sellerId: string,
  listingId: string
): Promise<ConversationWithListing> {
  const supabase = getSupabaseClient();

  // 1. Check if conversation exists
  const { data: existing, error: checkError } = await supabase
    .from('conversations')
    .select(
      `
      id, buyer_id, seller_id, listing_id, created_at, updated_at,
      buyer:profiles!buyer_id(id, full_name, avatar_url),
      seller:profiles!seller_id(id, full_name, avatar_url),
      listing:listings(id, title, price, status)
      `
    )
    .eq('buyer_id', buyerId)
    .eq('seller_id', sellerId)
    .eq('listing_id', listingId)
    .single();

  if (!checkError && existing) {
    return existing as unknown as ConversationWithListing;
  }

  // 2. Create new conversation
  const { data: created, error: createError } = await supabase
    .from('conversations')
    .insert({
      buyer_id: buyerId,
      seller_id: sellerId,
      listing_id: listingId,
    })
    .select(
      `
      id, buyer_id, seller_id, listing_id, created_at, updated_at,
      buyer:profiles!buyer_id(id, full_name, avatar_url),
      seller:profiles!seller_id(id, full_name, avatar_url),
      listing:listings(id, title, price, status)
      `
    )
    .single();

  if (createError || !created) {
    throw new Error(`Konuşma oluşturulamadı: ${createError?.message || 'Bilinmeyen hata'}`);
  }

  return created as unknown as ConversationWithListing;
}

/**
 * getConversationsForListing
 * Retrieves all conversations related to a specific listing.
 * Used by: Seller viewing inquiries for their listing
 */
export async function getConversationsForListing(listingId: string): Promise<ConversationWithListing[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('conversations')
    .select(
      `
      id, buyer_id, seller_id, listing_id, created_at, updated_at,
      buyer:profiles!buyer_id(id, full_name, avatar_url),
      seller:profiles!seller_id(id, full_name, avatar_url),
      listing:listings(id, title, price, status)
      `
    )
    .eq('listing_id', listingId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as unknown as ConversationWithListing[];
}

/**
 * getSellerListingsWithInquiries
 * Lists all seller's listings that have active conversations.
 * Used by: Seller's listing management dashboard
 */
export async function getSellerListingsWithInquiries(sellerId: string): Promise<
  Array<{
    listing: Listing;
    inquiryCount: number;
    unreadCount: number;
    lastMessageAt: string;
  }>
> {
  const supabase = getSupabaseClient();

  // Get all conversations for seller's listings
  const { data: listings, error: listingError } = await supabase
    .from('listings')
    .select(
      `
      id, title, price, status, created_at,
      conversations:conversations(id, buyer_id, seller_id, last_message_at, seller_unread)
      `
    )
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });

  if (listingError) {
    throw listingError;
  }

  return (listings || []).map((listing: any) => {
    const conversations = listing.conversations || [];
    return {
      listing: {
        id: listing.id,
        title: listing.title,
        price: listing.price,
        status: listing.status,
        seller_id: sellerId,
        created_at: listing.created_at,
      } as Listing,
      inquiryCount: conversations.length,
      unreadCount: conversations.filter((c: any) => c.seller_unread && c.seller_unread > 0).length,
      lastMessageAt: conversations.length > 0
        ? conversations[0].last_message_at
        : listing.created_at,
    };
  });
}

/**
 * getSellerStoreFromListing
 * Gets seller store profile from a listing.
 * Used by: Building "Send Message" button metadata
 */
export async function getSellerStoreFromListing(listingId: string): Promise<{
  sellerId: string;
  storeName: string;
  sellerName: string;
  avatar: string;
} | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('listings')
    .select(
      `
      seller_id,
      profiles!seller_id(id, full_name, avatar_url)
      `
    )
    .eq('id', listingId)
    .single();

  if (error || !data) {
    return null;
  }

  const profile = (data as any).profiles;
  return {
    sellerId: data.seller_id,
    storeName: profile?.full_name || 'Satıcı',
    sellerName: profile?.full_name || 'Satıcı',
    avatar: profile?.avatar_url || '',
  };
}

/**
 * markConversationAsRead
 * Marks all messages in a conversation as read for the current user.
 */
export async function markConversationAsRead(
  conversationId: string,
  userId: string
): Promise<void> {
  const supabase = getSupabaseClient();

  // Update conversation unread count based on user role
  const { data: conversation, error: fetchError } = await supabase
    .from('conversations')
    .select('buyer_id, seller_id')
    .eq('id', conversationId)
    .single();

  if (fetchError || !conversation) {
    throw fetchError;
  }

  const isBuyer = conversation.buyer_id === userId;
  const updateField = isBuyer ? 'buyer_unread' : 'seller_unread';

  const { error: updateError } = await supabase
    .from('conversations')
    .update({ [updateField]: 0 })
    .eq('id', conversationId);

  if (updateError) {
    throw updateError;
  }
}

/**
 * getConversationsForUser
 * Gets all conversations for a user (as buyer or seller).
 */
export async function getConversationsForUser(userId: string): Promise<ConversationWithListing[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('conversations')
    .select(
      `
      id, buyer_id, seller_id, listing_id, created_at, updated_at,
      buyer:profiles!buyer_id(id, full_name, avatar_url),
      seller:profiles!seller_id(id, full_name, avatar_url),
      listing:listings(id, title, price, status)
      `
    )
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as unknown as ConversationWithListing[];
}
