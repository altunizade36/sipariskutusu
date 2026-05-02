import { getSupabaseClient } from './supabase';

const supabase = new Proxy({} as ReturnType<typeof getSupabaseClient>, {
  get(_target, property) {
    return getSupabaseClient()[property as keyof ReturnType<typeof getSupabaseClient>];
  },
});

export interface Message {
  id: string;
  conversationId?: string;
  senderId?: string;
  senderName?: string;
  content?: string;
  conversation_id?: string;
  sender_id?: string;
  receiver_id?: string | null;
  body?: string;
  text?: string;
  mediaUrl?: string;
  image_url?: string | null;
  attachment_url?: string | null;
  message_type?: 'text' | 'image' | 'offer' | 'system';
  offer_amount?: number | null;
  offer_status?: 'pending' | 'accepted' | 'rejected' | 'countered' | null;
  createdAt?: string;
  created_at: string;
  updated_at?: string;
  isRead?: boolean;
  is_read?: boolean;
  status?: string;
  reactions?: Record<string, number>;
}

export interface Conversation {
  id: string;
  participantIds?: string[];
  productId?: string;
  productTitle?: string;
  createdAt?: string;
  updatedAt?: string;
  listing_id?: string | null;
  buyer_id: string;
  seller_id: string;
  store_id?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  buyer_unread?: number;
  seller_unread?: number;
  created_at: string;
  updated_at?: string;
  buyer?: { id: string; full_name?: string | null; avatar_url?: string | null } | null;
  seller?: { id: string; full_name?: string | null; avatar_url?: string | null } | null;
  listing?: {
    id: string;
    title: string;
    price: number;
    status?: string;
    listing_images?: Array<{ url: string; sort_order?: number; is_cover?: boolean }>;
  } | null;
}

export type MessageReaction = {
  id?: string;
  message_id: string;
  user_id?: string;
  emoji: string;
  created_at?: string;
};

export type ProfilePresence = {
  id?: string;
  is_online: boolean;
  last_seen_at?: string | null;
};

export type TypingState = {
  conversation_id: string;
  user_id: string;
  is_typing: boolean;
  updated_at?: string;
};

class MessageService {
  async getUserChats(userId: string) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(
          `
          conversation_id,
          sender_id,
          sender:profiles(id, full_name),
          content,
          created_at,
          is_read,
          product_id,
          product:listings(id, title)
        `
        )
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const chatsMap = new Map();

      data?.forEach((msg: any) => {
        const chatId = [userId, msg.sender_id].sort().join('_');
        
        if (!chatsMap.has(chatId)) {
          chatsMap.set(chatId, {
            id: chatId,
            participantId: msg.sender_id === userId ? msg.recipient_id : msg.sender_id,
            participantName: msg.sender?.full_name || 'Unknown',
            lastMessage: msg.content,
            lastMessageTime: msg.created_at,
            unreadCount: msg.is_read ? 0 : 1,
            productTitle: msg.product?.title,
            productId: msg.product_id,
            isOnline: Math.random() > 0.3,
          });
        }
      });

      return Array.from(chatsMap.values());
    } catch (error) {
      console.error('Error fetching chats:', error);
      return [];
    }
  }

  async getConversationMessages(userId: string, participantId: string) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(
          `
          id,
          conversation_id,
          sender_id,
          sender:profiles(id, full_name),
          content,
          media_url,
          created_at,
          is_read,
          reactions
        `
        )
        .or(
          `and(sender_id.eq.${userId},recipient_id.eq.${participantId}),and(sender_id.eq.${participantId},recipient_id.eq.${userId})`
        )
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (
        data?.map((msg: any) => ({
          id: msg.id,
          conversationId: msg.conversation_id,
          senderId: msg.sender_id,
          senderName: msg.sender?.full_name || 'Unknown',
          content: msg.content,
          mediaUrl: msg.media_url,
          createdAt: msg.created_at,
          isRead: msg.is_read,
          reactions: msg.reactions || {},
        })) || []
      );
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  async sendMessage(
    userId: string,
    recipientId: string,
    content: string,
    productId?: string
  ) {
    try {
      const { error } = await supabase.from('messages').insert([
        {
          sender_id: userId,
          recipient_id: recipientId,
          content,
          product_id: productId,
          is_read: false,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async markAsRead(messageIds: string[]) {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .in('id', messageIds);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  async deleteMessage(messageId: string) {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  }

  async addReaction(messageId: string, emoji: string, userId: string) {
    try {
      const { data: currentMsg, error: fetchError } = await supabase
        .from('messages')
        .select('reactions')
        .eq('id', messageId)
        .single();

      if (fetchError) throw fetchError;

      const reactions = currentMsg?.reactions || {};
      reactions[emoji] = (reactions[emoji] || 0) + 1;

      const { error } = await supabase
        .from('messages')
        .update({ reactions })
        .eq('id', messageId);

      if (error) throw error;
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  }

  async blockUser(userId: string, blockedUserId: string) {
    try {
      const { error } = await supabase
        .from('user_blocks')
        .insert([
          {
            user_id: userId,
            blocked_user_id: blockedUserId,
            created_at: new Date().toISOString(),
          },
        ]);

      if (error) throw error;
    } catch (error) {
      console.error('Error blocking user:', error);
    }
  }

  async unblockUser(userId: string, blockedUserId: string) {
    try {
      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('user_id', userId)
        .eq('blocked_user_id', blockedUserId);

      if (error) throw error;
    } catch (error) {
      console.error('Error unblocking user:', error);
    }
  }

  async isUserBlocked(userId: string, checkedUserId: string) {
    try {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('id')
        .or(
          `and(user_id.eq.${userId},blocked_user_id.eq.${checkedUserId}),and(user_id.eq.${checkedUserId},blocked_user_id.eq.${userId})`
        )
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return !!data;
    } catch (error) {
      console.error('Error checking block status:', error);
      return false;
    }
  }
}

const conversationSelect = `
  id, listing_id, store_id, buyer_id, seller_id, last_message, last_message_at,
  buyer_unread, seller_unread, created_at, updated_at,
  buyer:profiles!conversations_buyer_id_fkey(id, full_name, avatar_url),
  seller:profiles!conversations_seller_id_fkey(id, full_name, avatar_url),
  listing:listings(id, title, price, status, listing_images(url, sort_order, is_cover))
`;

const messageSelect = `
  id, conversation_id, sender_id, receiver_id, body, attachment_url, image_url,
  message_type, offer_amount, offer_status, is_read, status, created_at, updated_at
`;

function currentUserId(): Promise<string> {
  return supabase.auth.getUser().then(({ data, error }) => {
    const userId = data.user?.id;
    if (error || !userId) {
      throw new Error('Mesajlaşmak için giriş yapmalısın.');
    }
    return userId;
  });
}

export async function fetchConversations(): Promise<Conversation[]> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('conversations')
    .select(conversationSelect)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as Conversation[];
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(messageSelect)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as Message[];
}

export async function getOrCreateConversation(sellerId: string, listingId?: string): Promise<Conversation> {
  const { data, error } = await supabase.rpc('get_or_create_conversation', {
    p_seller_id: sellerId,
    p_listing_id: listingId ?? null,
    p_store_id: null,
    p_type: listingId ? 'listing_conversation' : 'store_conversation',
  });

  if (error) {
    throw error;
  }

  const conversationId = (data as { id?: string } | null)?.id;
  if (!conversationId) {
    throw new Error('Konuşma oluşturulamadı.');
  }

  const { data: conversation, error: fetchError } = await supabase
    .from('conversations')
    .select(conversationSelect)
    .eq('id', conversationId)
    .single();

  if (fetchError || !conversation) {
    throw fetchError ?? new Error('Konuşma yüklenemedi.');
  }

  return conversation as unknown as Conversation;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_conversation_seen', { p_conversation_id: conversationId });
  if (error) {
    throw error;
  }
}

export async function sendMessage(conversationId: string, body: string, imageUrl?: string): Promise<Message> {
  const userId = await currentUserId();
  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .select('buyer_id, seller_id')
    .eq('id', conversationId)
    .single();

  if (conversationError || !conversation) {
    throw conversationError ?? new Error('Konuşma bulunamadı.');
  }

  const receiverId = conversation.buyer_id === userId ? conversation.seller_id : conversation.buyer_id;
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: userId,
      receiver_id: receiverId,
      body,
      attachment_url: imageUrl ?? null,
      image_url: imageUrl ?? null,
      message_type: imageUrl ? 'image' : 'text',
      is_read: false,
    })
    .select(messageSelect)
    .single();

  if (error || !data) {
    throw error ?? new Error('Mesaj gönderilemedi.');
  }

  return data as unknown as Message;
}

export async function fetchReactions(conversationId: string): Promise<MessageReaction[]> {
  const { data: messages, error: messageError } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId);

  if (messageError) {
    throw messageError;
  }

  const messageIds = (messages ?? []).map((item: { id: string }) => item.id);
  if (messageIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('message_reactions')
    .select('id, message_id, user_id, emoji, created_at')
    .in('message_id', messageIds);

  if (error) {
    throw error;
  }

  return (data ?? []) as MessageReaction[];
}

export async function toggleReaction(messageId: string, emoji: string): Promise<void> {
  const userId = await currentUserId();
  const { data: existing, error: fetchError } = await supabase
    .from('message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('emoji', emoji)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (existing?.id) {
    const { error } = await supabase.from('message_reactions').delete().eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('message_reactions').insert({ message_id: messageId, user_id: userId, emoji });
  if (error) throw error;
}

export async function setMyPresence(isOnline: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_my_presence', { p_is_online: isOnline });
  if (error) throw error;
}

export async function fetchProfilePresence(profileId: string): Promise<ProfilePresence | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, is_online, last_seen_at')
    .eq('id', profileId)
    .single();

  if (error) {
    throw error;
  }

  return data as ProfilePresence;
}

export async function setTypingStatus(conversationId: string, isTyping: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_conversation_typing', {
    p_conversation_id: conversationId,
    p_is_typing: isTyping,
  });
  if (error) throw error;
}

export function subscribeToMessages(conversationId: string, onMessage: (message: Message) => void): () => void {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
      onMessage(payload.new as Message);
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

export function subscribeToUserMessages(userId: string, onMessage: (message: Message) => void): () => void {
  const receiverChannel = supabase
    .channel(`messages:user:receiver:${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` }, (payload) => {
      onMessage(payload.new as Message);
    })
    .subscribe();

  const senderChannel = supabase
    .channel(`messages:user:sender:${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${userId}` }, (payload) => {
      onMessage(payload.new as Message);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(receiverChannel);
    supabase.removeChannel(senderChannel);
  };
}

export function subscribeToUserConversations(
  userId: string,
  onConversationChange: (conversation: Conversation, eventType: 'INSERT' | 'UPDATE') => void,
): () => void {
  const buyerChannel = supabase
    .channel(`conversations:user:buyer:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `buyer_id=eq.${userId}` }, (payload) => {
      if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') {
        return;
      }

      onConversationChange(payload.new as Conversation, payload.eventType);
    })
    .subscribe();

  const sellerChannel = supabase
    .channel(`conversations:user:seller:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `seller_id=eq.${userId}` }, (payload) => {
      if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') {
        return;
      }

      onConversationChange(payload.new as Conversation, payload.eventType);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(buyerChannel);
    supabase.removeChannel(sellerChannel);
  };
}

export function subscribeToReactions(
  conversationId: string,
  onReaction: (reaction: MessageReaction, type: 'INSERT' | 'DELETE') => void,
): () => void {
  let messageIds = new Set<string>();
  fetchMessages(conversationId).then((items) => { messageIds = new Set(items.map((item) => item.id)); }).catch(() => undefined);

  const channel = supabase
    .channel(`message-reactions:${conversationId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, (payload) => {
      const reaction = (payload.new ?? payload.old) as MessageReaction;
      if (messageIds.size > 0 && !messageIds.has(reaction.message_id)) return;
      onReaction(reaction, payload.eventType === 'DELETE' ? 'DELETE' : 'INSERT');
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

export function subscribeToTyping(conversationId: string, onTyping: (typing: TypingState) => void): () => void {
  const channel = supabase
    .channel(`typing:${conversationId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_typing', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
      onTyping(payload.new as TypingState);
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

export function subscribeToProfilePresence(profileId: string, onPresence: (presence: ProfilePresence) => void): () => void {
  const channel = supabase
    .channel(`presence:${profileId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profileId}` }, (payload) => {
      onPresence(payload.new as ProfilePresence);
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

export async function uploadMessageImage(conversationId: string, uri: string): Promise<string> {
  const userId = await currentUserId();
  const ext = uri.split('?')[0]?.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${conversationId}/${userId}/${Date.now()}.${ext}`;
  const response = await fetch(uri);
  const arrayBuffer = await (await response.blob()).arrayBuffer();
  const { error } = await supabase.storage.from('message-attachments').upload(path, arrayBuffer, {
    contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return supabase.storage.from('message-attachments').getPublicUrl(path).data.publicUrl;
}

export async function blockUser(blockedUserId: string, reason?: string): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase.from('user_blocks').insert({
    user_id: userId,
    blocked_user_id: blockedUserId,
    reason: reason ?? null,
  });
  if (error) throw error;
}

export async function reportUser(reportedUserId: string, reason: string): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    target_type: 'user',
    target_id: reportedUserId,
    reason,
  });
  if (error) throw error;
}

/** Edit the body of a message the current user sent. */
export async function updateMessageBody(messageId: string, newBody: string): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from('messages')
    .update({ body: newBody, updated_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('sender_id', userId);
  if (error) throw error;
}

/** Accept, reject, or counter an offer message. */
export async function updateOfferStatus(
  messageId: string,
  status: 'accepted' | 'rejected' | 'countered',
  counterAmount?: number
): Promise<void> {
  const payload: Record<string, unknown> = {
    offer_status: status,
    updated_at: new Date().toISOString(),
  };
  if (status === 'countered' && counterAmount != null) {
    payload.offer_amount = counterAmount;
  }
  const { error } = await supabase
    .from('messages')
    .update(payload)
    .eq('id', messageId);
  if (error) throw error;
}

export const messageService = new MessageService();
