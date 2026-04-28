import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Alert,
  AppState,
  AppStateStatus,
  FlatList,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fonts } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import { useListings } from '../src/context/ListingsContext';
import { storeData } from '../src/data/storeData';
import {
  fetchConversations as fetchRemoteConversations,
  fetchMessages as fetchRemoteMessages,
  fetchProfilePresence,
  fetchReactions,
  getOrCreateConversation,
  markConversationRead,
  blockUser,
  reportUser,
  sendMessage as sendRemoteMessage,
  setMyPresence,
  setTypingStatus,
  subscribeToMessages,
  subscribeToProfilePresence,
  subscribeToReactions,
  subscribeToTyping,
  toggleReaction,
  uploadMessageImage,
  type Conversation,
  type Message,
} from '../src/services/messageService';
import { isSupabaseConfigured } from '../src/services/supabase';
import { captureError } from '../src/services/monitoring';
import { formatLastSeenLabel, mapReactionsByMessage, toggleEmoji } from '../src/utils/messaging';
import { buildConversationMessagesRoute } from '../src/utils/messageRouting';
import { NewMessageButton } from '../src/components/chat/NewMessageButton';
import { EmptyChatState } from '../src/components/chat/EmptyChatState';
import { TypingIndicator } from '../src/components/chat/TypingIndicator';
import { openImageAttachmentPicker } from '../src/components/chat/ImageAttachmentPicker';
 
// ─── Yardımcı fonksiyonlar ───────────────────────────────────
 
function formatTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}
 
function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Bugün';
  if (date.toDateString() === yesterday.toDateString()) return 'Dün';
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}
 
function formatPrice(value?: number) {
  if (typeof value !== 'number' || value <= 0) return 'Fiyat Sor';
  return `₺${value.toFixed(2)}`;
}
 
function mapListingStatus(status?: string) {
  if (status === 'sold') return 'Satıldı';
  if (status === 'archived') return 'Yayından kalktı';
  return 'Aktif';
}

function truncateText(value: string, maxLength = 70) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trim()}...`;
}

function parseReplyPayload(rawText: string) {
  const match = rawText.match(/^\[yanit:([^\]]+)\](.*)\n([\s\S]*)$/);
  if (!match) {
    return { replyToText: undefined, body: rawText.trim() };
  }

  const replyToText = match[2]?.trim() || undefined;
  const body = (match[3] || '').trim();
  return { replyToText, body: body || rawText.trim() };
}

// ─── Tipler ──────────────────────────────────────────────────
 
type MessageKind = 'text' | 'image' | 'offer';
 
interface OfferData {
  amount: number;
  originalPrice?: number;
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
  counterAmount?: number;
}
 
type MsgItem =
  | { kind: 'separator'; id: string; label: string }
  | {
      kind: 'message';
      id: string;
      sender: string;
      text: string;
      createdAt: string;
      status?: 'sending' | 'sent' | 'failed';
      msgKind?: MessageKind;
      imageUri?: string;
      offerData?: OfferData;
      reactions?: string[];
      replyToText?: string;
    };

type ConversationView= {
  id: string;
  title: string;
  avatar: string;
  unreadCount: number;
  lastMessageAt: string;
  lastMessage?: string;
  messages: Array<{
    id: string;
    sender: string;
    text: string;
    createdAt: string;
    msgKind?: MessageKind;
    imageUri?: string;
    offerData?: OfferData;
    reactions?: string[];
    replyToText?: string;
  }>;
  listing?: {
    id?: string;
    title?: string;
    image?: string;
    price?: number;
    status?: string;
  };
};
 
// ─── Teklif Modalı ───────────────────────────────────────────
 
function OfferModal({
  visible,
  originalPrice,
  onClose,
  onSend,
}: {
  visible: boolean;
  originalPrice?: number;
  onClose: () => void;
  onSend: (amount: number) => void;
}) {
  const [offerText, setOfferText] = useState('');
 
  function handleSend() {
    const amount = parseFloat(offerText.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Hata', 'Geçerli bir tutar girin.');
      return;
    }
    onSend(amount);
    setOfferText('');
    onClose();
  }
 
  const discountPct =
    originalPrice && offerText
      ? ((originalPrice - parseFloat(offerText.replace(',', '.') || '0')) / originalPrice) * 100
      : null;
 
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable onPress={() => {}}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>
                Fiyat Teklifi Gönder
              </Text>
              <Pressable onPress={onClose}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
 
            {originalPrice != null && (
              <View style={{ backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>Satıcının fiyatı</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.primary }}>₺{originalPrice.toFixed(2)}</Text>
              </View>
            )}
 
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginBottom: 6 }}>
              Teklifiniz (₺)
            </Text>
            <TextInput
              value={offerText}
              onChangeText={setOfferText}
              placeholder="Örn: 250"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={{
                fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary,
                backgroundColor: '#F7F7F7', borderRadius: 12,
                paddingHorizontal: 14, paddingVertical: 12,
                borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10,
              }}
            />
 
            {discountPct != null && !isNaN(discountPct) && discountPct > 0 && (
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: '#059669', marginBottom: 12 }}>
                Orijinal fiyattan %{discountPct.toFixed(0)} indirim teklif ediyorsunuz
              </Text>
            )}
 
            <Pressable
              onPress={handleSend}
              disabled={!offerText.trim()}
              style={{ backgroundColor: offerText.trim() ? colors.primary : '#AFC7ED', borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>Teklif Gönder</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
 
// ─── Teklif Balonı ───────────────────────────────────────────
 
function OfferBubble({
  offer, isMine, onAccept, onReject, onCounter,
}: {
  offer: OfferData; isMine: boolean;
  onAccept: () => void; onReject: () => void; onCounter: () => void;
}) {
  const statusColor = offer.status === 'accepted' ? '#166534' : offer.status === 'rejected' ? '#991B1B' : offer.status === 'countered' ? '#92400E' : colors.primary;
  const statusLabel = offer.status === 'accepted' ? '✓ Kabul Edildi' : offer.status === 'rejected' ? '✕ Reddedildi' : offer.status === 'countered' ? `↔ Karşı Teklif: ₺${offer.counterAmount?.toFixed(2)}` : '⏳ Beklemede';
 
  return (
    <View style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 14, padding: 12, maxWidth: '82%' }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary, marginBottom: 4 }}>💰 Fiyat Teklifi</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary }}>₺{offer.amount.toFixed(2)}</Text>
      {offer.originalPrice != null && (
        <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
          Orijinal: ₺{offer.originalPrice.toFixed(2)}
        </Text>
      )}
      <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#BFDBFE' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: statusColor }}>{statusLabel}</Text>
      </View>
      {!isMine && offer.status === 'pending' && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Pressable onPress={onAccept} style={{ flex: 1, backgroundColor: '#166534', borderRadius: 8, height: 34, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>Kabul Et</Text>
          </Pressable>
          <Pressable onPress={onCounter} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 8, height: 34, borderWidth: 0.5, borderColor: '#BFDBFE', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }}>Karşı</Text>
          </Pressable>
          <Pressable onPress={onReject} style={{ flex: 1, backgroundColor: '#FEE2E2', borderRadius: 8, height: 34, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#991B1B' }}>Reddet</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
 
// ─── Tepki Seçici ────────────────────────────────────────────
 
const EMOJI_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];
const REMOTE_CONVERSATIONS_CACHE_PREFIX = 'messages:remote:conversations:v1';
const REMOTE_THREAD_CACHE_PREFIX = 'messages:remote:thread:v1';
 
function MessageActionSheet({
  visible,
  messageText,
  onSelectReaction,
  onReply,
  onEdit,
  canEdit,
  onReport,
  onDismiss,
}: {
  visible: boolean;
  messageText: string;
  onSelectReaction: (emoji: string) => void;
  onReply: () => void;
  onEdit: () => void;
  canEdit: boolean;
  onReport: () => void;
  onDismiss: () => void;
}) {
  if (!visible) return null;
  return (
    <Pressable style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 999 }} onPress={onDismiss}>
      <View style={{ position: 'absolute', left: 12, right: 12, bottom: 82 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', borderWidth: 0.5, borderColor: '#E5E7EB', elevation: 4 }}>
          {EMOJI_REACTIONS.map((emoji) => (
            <Pressable key={emoji} onPress={() => { onSelectReaction(emoji); onDismiss(); }} style={{ paddingHorizontal: 6, paddingVertical: 4 }}>
              <Text style={{ fontSize: 22 }}>{emoji}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 12, marginTop: 8, borderWidth: 0.5, borderColor: '#E5E7EB', elevation: 4 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginBottom: 8 }} numberOfLines={2}>
            {truncateText(messageText || 'Mesaj')}
          </Text>

          <Pressable onPress={() => { onReply(); onDismiss(); }} className="h-10 flex-row items-center">
            <Ionicons name="return-up-back-outline" size={18} color={colors.textPrimary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary, marginLeft: 10 }}>Yanıtla</Text>
          </Pressable>

          {canEdit ? (
            <Pressable onPress={() => { onEdit(); onDismiss(); }} className="h-10 flex-row items-center">
              <Ionicons name="create-outline" size={18} color={colors.textPrimary} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary, marginLeft: 10 }}>Mesajı Düzenle</Text>
            </Pressable>
          ) : null}

          <Pressable onPress={() => { onReport(); onDismiss(); }} className="h-10 flex-row items-center">
            <Ionicons name="flag-outline" size={18} color="#B91C1C" />
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: '#B91C1C', marginLeft: 10 }}>Mesajı Şikayet Et</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
 
// ─── Ana Ekran ───────────────────────────────────────────────
 
export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ conversation?: string; sellerId?: string; productId?: string; productTitle?: string; whatsapp?: string; initialMessage?: string }>();
  const { allProducts, conversations: fallbackConversations, typingConversationId, openConversation, sendMessage: sendFallbackMessage, sellerStore } = useListings();
 
  const [searchText, setSearchText] = useState('');
  const [listFilter, setListFilter] = useState<'all' | 'unread'>('all');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [pendingMsg, setPendingMsg] = useState<{ id: string; text: string; status: 'sending' | 'failed'; msgKind?: MessageKind; imageUri?: string; offerData?: OfferData; replyToText?: string } | null>(null);
  const initialMessageSentRef = useRef(false);
  const messagesListRef = useRef<FlatList>(null);
  const composerInputRef = useRef<TextInput>(null);
 
  const [localReactions, setLocalReactions] = useState<Record<string, string[]>>({});
  const [remoteReactions, setRemoteReactions] = useState<Record<string, string[]>>({});
  const [localOfferStatuses, setLocalOfferStatuses] = useState<Record<string, OfferData['status']>>({});
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [activeMessageAction, setActiveMessageAction] = useState<{ id: string; text: string; mine: boolean } | null>(null);
  const [replyTarget, setReplyTarget] = useState<{ id: string; text: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{ id: string; text: string } | null>(null);
  const [editedMessageTexts, setEditedMessageTexts] = useState<Record<string, string>>({});
  const [counterpartyPresence, setCounterpartyPresence] = useState<{ isOnline: boolean; lastSeenAt?: string } | null>(null);
  const [remoteTypingUserId, setRemoteTypingUserId] = useState<string | null>(null);
  const typingOffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledRouteIntentRef = useRef<string | null>(null);
 
  const [remoteConversations, setRemoteConversations] = useState<Conversation[]>([]);
  const [remoteMessages, setRemoteMessages] = useState<Record<string, Message[]>>({});
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isRefreshingConversations, setIsRefreshingConversations] = useState(false);
  const [isRefreshingMessages, setIsRefreshingMessages] = useState(false);
 
  const isRemoteMode = isSupabaseConfigured && Boolean(user) && !user?.id.startsWith('demo-');
  const routeConversationId = params.conversation?.trim() || '';
  const routeSellerId = params.sellerId?.trim() || '';
  const routeProductId = params.productId?.trim() || '';
  const relatedProductTitle = params.productTitle ? decodeURIComponent(params.productTitle) : '';
  const initialMessageText = params.initialMessage ? decodeURIComponent(params.initialMessage) : '';
  const remoteConversationsCacheKey = user?.id ? `${REMOTE_CONVERSATIONS_CACHE_PREFIX}:${user.id}` : null;

  function findMatchingRemoteConversation() {
    if (!routeSellerId) {
      return null;
    }

    const exact = remoteConversations.find((item) => item.seller_id === routeSellerId && (routeProductId ? item.listing_id === routeProductId : !item.listing_id));
    if (exact) {
      return exact;
    }

    if (!routeProductId) {
      return null;
    }

    return remoteConversations.find((item) => item.seller_id === routeSellerId && item.listing_id === routeProductId) ?? null;
  }

  function buildRemoteThreadCacheKey(conversationId: string) {
    if (!user?.id) {
      return null;
    }

    return `${REMOTE_THREAD_CACHE_PREFIX}:${user.id}:${conversationId}`;
  }

  async function loadCachedConversations() {
    if (!remoteConversationsCacheKey) {
      return;
    }

    try {
      const serialized = await AsyncStorage.getItem(remoteConversationsCacheKey);
      if (!serialized) {
        return;
      }

      const cached = JSON.parse(serialized) as Conversation[];
      setRemoteConversations(cached);
    } catch {
      // Cache read hatası canlı akışı bloklamamalı.
    }
  }

  async function loadCachedThread(conversationId: string) {
    const cacheKey = buildRemoteThreadCacheKey(conversationId);
    if (!cacheKey) {
      return;
    }

    try {
      const serialized = await AsyncStorage.getItem(cacheKey);
      if (!serialized) {
        return;
      }

      const cached = JSON.parse(serialized) as { messages: Message[]; reactions: Record<string, string[]> };
      setRemoteMessages((current) => ({ ...current, [conversationId]: cached.messages }));
      setRemoteReactions(cached.reactions);
    } catch {
      // Cache read hatası canlı akışı bloklamamalı.
    }
  }

  async function refreshConversations() {
    if (!isRemoteMode) {
      return;
    }

    try {
      const items = await fetchRemoteConversations();
      setRemoteConversations(items);
      if (remoteConversationsCacheKey) {
        AsyncStorage.setItem(remoteConversationsCacheKey, JSON.stringify(items)).catch(() => {
          // Cache write hatası canlı akışı bloklamamalı.
        });
      }
    } catch (e) {
      await loadCachedConversations();
      throw e;
    }
  }

  async function refreshActiveConversation(conversationId: string) {
    if (!isRemoteMode) {
      return;
    }

    try {
      const [messages, reactions] = await Promise.all([
        fetchRemoteMessages(conversationId),
        fetchReactions(conversationId),
      ]);

      const mappedReactions = mapReactionsByMessage(reactions);
      setRemoteMessages((current) => ({ ...current, [conversationId]: messages }));
      setRemoteReactions(mappedReactions);

      const cacheKey = buildRemoteThreadCacheKey(conversationId);
      if (cacheKey) {
        AsyncStorage.setItem(cacheKey, JSON.stringify({ messages, reactions: mappedReactions })).catch(() => {
          // Cache write hatası canlı akışı bloklamamalı.
        });
      }
    } catch (e) {
      await loadCachedThread(conversationId);
      throw e;
    }
  }
 
  // ─── Efektler ──────────────────────────────────────────────
 
  useEffect(() => { initialMessageSentRef.current = false; }, [initialMessageText]);
 
  useEffect(() => {
    if (!isRemoteMode) return;
    let active = true;
    loadCachedConversations().catch(() => undefined);
    refreshConversations().catch((e) => captureError(e, { scope: 'messages_fetch_conversations' }));
    return () => { active = false; };
  }, [isRemoteMode]);

  useEffect(() => {
    if (!isRemoteMode || !remoteConversationsCacheKey) {
      return;
    }

    AsyncStorage.setItem(remoteConversationsCacheKey, JSON.stringify(remoteConversations)).catch(() => {
      // Cache write hatası canlı akışı bloklamamalı.
    });
  }, [isRemoteMode, remoteConversations, remoteConversationsCacheKey]);
 
  useEffect(() => {
    if (!isRemoteMode || !selectedConversationId) return;
    let active = true;
    loadCachedThread(selectedConversationId).catch(() => undefined);
    refreshActiveConversation(selectedConversationId).catch((e) => captureError(e, { scope: 'messages_fetch_messages' }));
    const unsubscribeMessages = subscribeToMessages(selectedConversationId, (msg) => {
      setRemoteMessages((c) => { const prev = c[selectedConversationId] ?? []; if (prev.some((m) => m.id === msg.id)) return c; return { ...c, [selectedConversationId]: [...prev, msg] }; });
      updateConversationPreview(selectedConversationId, msg.body, msg.created_at, msg.sender_id);
    });
    const unsubscribeReactions = subscribeToReactions(selectedConversationId, (reaction, type) => {
      setRemoteReactions((prev) => {
        if (type === 'INSERT') {
          const curr = prev[reaction.message_id] ?? [];
          if (curr.includes(reaction.emoji)) return prev;
          return { ...prev, [reaction.message_id]: [...curr, reaction.emoji] };
        }

        const curr = prev[reaction.message_id] ?? [];
        return {
          ...prev,
          [reaction.message_id]: curr.filter((item) => item !== reaction.emoji),
        };
      });
    });
    const unsubscribeTyping = subscribeToTyping(selectedConversationId, (typingState) => {
      if (!user?.id || typingState.user_id === user.id) {
        return;
      }

      setRemoteTypingUserId((current) => {
        if (!typingState.is_typing) {
          return current === typingState.user_id ? null : current;
        }
        return typingState.user_id;
      });
    });

    return () => {
      active = false;
      unsubscribeMessages();
      unsubscribeReactions();
      unsubscribeTyping();
    };
  }, [isRemoteMode, selectedConversationId]);

  useEffect(() => {
    return () => {
      if (typingOffTimerRef.current) {
        clearTimeout(typingOffTimerRef.current);
      }
    };
  }, []);
 
  useEffect(() => {
    if (!routeConversationId) {
      return;
    }

    const intentKey = `conversation:${routeConversationId}`;
    if (handledRouteIntentRef.current === intentKey) {
      return;
    }

    handledRouteIntentRef.current = intentKey;
    openConversationThread(routeConversationId);
  }, [isRemoteMode, routeConversationId]);
 
  useEffect(() => {
    if (!routeSellerId) return;

    const intentKey = `seller:${routeSellerId}:${routeProductId || 'store'}`;
    if (handledRouteIntentRef.current === intentKey) {
      return;
    }

    if (!isRemoteMode) {
      // Demo mod: tek mock konuşmayı aç
      const fallback = fallbackConversations[0];
      if (fallback) {
        handledRouteIntentRef.current = intentKey;
        openConversationThread(fallback.id);
      }
      return;
    }

    const existing = findMatchingRemoteConversation();
    if (existing) {
      handledRouteIntentRef.current = intentKey;
      openConversationThread(existing.id);
      router.replace(buildConversationMessagesRoute(existing.id));
      return;
    }

    handledRouteIntentRef.current = intentKey;
    getOrCreateConversation(routeSellerId, routeProductId || undefined).then((created) => {
      setRemoteConversations((c) => { if (c.some((i) => i.id === created.id)) return c; return [created, ...c]; });
      openConversationThread(created.id);
      router.replace(buildConversationMessagesRoute(created.id));
    }).catch((e) => captureError(e, { scope: 'messages_get_or_create_conversation' }));
  }, [routeProductId, routeSellerId, remoteConversations, isRemoteMode, router, fallbackConversations]);
 
  useEffect(() => {
    if (!relatedProductTitle || !selectedConversationId) return;
    setDrafts((d) => { if (d[selectedConversationId]?.trim()) return d; return { ...d, [selectedConversationId]: `${relatedProductTitle} ürünü hakkında bilgi alabilir miyim?` }; });
  }, [relatedProductTitle, selectedConversationId]);
 
  function updateConversationPreview(conversationId: string, messageBody: string, messageTime: string, senderId?: string) {
    setRemoteConversations((current) => {
      const index = current.findIndex((item) => item.id === conversationId);
      if (index < 0) {
        return current;
      }

      const target = current[index];
      let nextBuyerUnread = target.buyer_unread;
      let nextSellerUnread = target.seller_unread;
      if (senderId) {
        if (senderId === target.buyer_id) nextSellerUnread = (target.seller_unread ?? 0) + 1;
        else if (senderId === target.seller_id) nextBuyerUnread = (target.buyer_unread ?? 0) + 1;
      }

      const updated = {
        ...target,
        last_message: messageBody,
        last_message_at: messageTime,
        buyer_unread: nextBuyerUnread,
        seller_unread: nextSellerUnread,
      };

      const remaining = current.filter((item) => item.id !== conversationId);
      return [updated, ...remaining];
    });
  }

  function openConversationThread(conversationId: string) {
    setSelectedConversationId(conversationId);

    if (!isRemoteMode) {
      openConversation(conversationId);
      return;
    }

    setRemoteConversations((current) =>
      current.map((item) => {
        if (item.id !== conversationId || !user?.id) {
          return item;
        }

        if (item.buyer_id === user.id) {
          return { ...item, buyer_unread: 0 };
        }

        if (item.seller_id === user.id) {
          return { ...item, seller_unread: 0 };
        }

        return item;
      }),
    );

    markConversationRead(conversationId).catch((e) =>
      captureError(e, { scope: 'messages_mark_conversation_read' }),
    );
  }
 
  // ─── Konuşmalar ────────────────────────────────────────────
 
  const conversations = useMemo<ConversationView[]>(() => {
    if (!isRemoteMode) return fallbackConversations.map((item) => ({ ...item, listing: undefined }));
    return remoteConversations.map((item) => {
      const messages = remoteMessages[item.id] ?? [];
      const isBuyer = user?.id === item.buyer_id;
      const title = isBuyer ? (item.seller?.full_name || 'Satıcı') : (item.buyer?.full_name || 'Müşteri');
      const unreadCount = isBuyer ? item.buyer_unread : item.seller_unread;
      return {
        id: item.id, title,
        avatar: isBuyer ? (item.seller?.avatar_url || storeData.avatar) : (item.buyer?.avatar_url || storeData.avatar),
        unreadCount, lastMessageAt: item.last_message_at || item.created_at, lastMessage: item.last_message || undefined,
        messages: messages.map((msg) => ({
          id: msg.id,
          sender: msg.sender_id === user?.id ? 'me' : 'store',
          text: (msg.text || msg.body || '').trim(),
          createdAt: msg.created_at,
          msgKind: (msg.image_url || msg.attachment_url || msg.message_type === 'image') ? 'image' : 'text',
          imageUri: msg.image_url || msg.attachment_url || undefined,
        })),
        listing: item.listing ? { id: item.listing_id ?? undefined, title: item.listing.title, image: item.listing.listing_images?.[0]?.url, price: item.listing.price, status: item.listing.status } : undefined,
      };
    });
  }, [fallbackConversations, isRemoteMode, remoteConversations, remoteMessages, user?.id]);
 
  const filteredConversations = useMemo(() => {
    const base = listFilter === 'unread'
      ? conversations.filter((item) => item.unreadCount > 0)
      : conversations;

    const query = searchText.trim().toLocaleLowerCase('tr-TR');
    if (!query) return base;

    return base.filter((item) => {
      const lastText = item.messages[item.messages.length - 1]?.text ?? item.lastMessage ?? '';
      return item.title.toLocaleLowerCase('tr-TR').includes(query) || lastText.toLocaleLowerCase('tr-TR').includes(query);
    });
  }, [conversations, listFilter, searchText]);
 
  const conversation = useMemo(() => (selectedConversationId ? conversations.find((item) => item.id === selectedConversationId) ?? null : null), [conversations, selectedConversationId]);

  const selectedRemoteConversation = useMemo(() => {
    if (!isRemoteMode || !selectedConversationId) return null;
    return remoteConversations.find((item) => item.id === selectedConversationId) ?? null;
  }, [isRemoteMode, remoteConversations, selectedConversationId]);

  const counterpartyProfileId = useMemo(() => {
    if (!selectedRemoteConversation || !user?.id) return null;
    return selectedRemoteConversation.buyer_id === user.id
      ? selectedRemoteConversation.seller_id
      : selectedRemoteConversation.buyer_id;
  }, [selectedRemoteConversation, user?.id]);
 
  const activeListingFromParams = useMemo(() => { if (!routeProductId) return null; return allProducts.find((item) => item.id === routeProductId) ?? null; }, [allProducts, routeProductId]);
  const contactWhatsapp = useMemo(() => {
    return params.whatsapp || activeListingFromParams?.whatsapp || '';
  }, [activeListingFromParams?.whatsapp, params.whatsapp]);
 
  const activeProductCard = useMemo(() => {
    if (conversation?.listing) {
      return { id: conversation.listing.id, title: conversation.listing.title || relatedProductTitle || 'İlgili ilan', image: conversation.listing.image, priceLabel: formatPrice(conversation.listing.price), price: conversation.listing.price, status: mapListingStatus(conversation.listing.status) };
    }
    if (activeListingFromParams) {
      return { id: activeListingFromParams.id, title: activeListingFromParams.title, image: activeListingFromParams.image, priceLabel: formatPrice(activeListingFromParams.price), price: activeListingFromParams.price, status: 'Aktif' };
    }
    if (!relatedProductTitle) return null;
    return { id: routeProductId, title: relatedProductTitle, image: undefined, priceLabel: undefined, price: undefined, status: 'Aktif' };
  }, [activeListingFromParams, conversation?.listing, routeProductId, relatedProductTitle]);
 
  const currentDraft = conversation ? (drafts[conversation.id] ?? '').trim() : '';
 
  // ─── Presence ─────────────────────────────────────────────

  useEffect(() => {
    if (!isRemoteMode) return;

    let unmounted = false;
    let lastPushed: boolean | null = null;

    const pushPresence = (online: boolean) => {
      if (lastPushed === online || unmounted) return;
      lastPushed = online;
      setMyPresence(online).catch((e) => captureError(e, { scope: 'messages_set_presence' }));
    };

    pushPresence(AppState.currentState === 'active');

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      pushPresence(state === 'active');
    });

    return () => {
      unmounted = true;
      sub.remove();
      setMyPresence(false).catch((e) => captureError(e, { scope: 'messages_set_presence_cleanup' }));
    };
  }, [isRemoteMode]);

  useEffect(() => {
    if (!isRemoteMode || !counterpartyProfileId) {
      setCounterpartyPresence(null);
      return;
    }

    let active = true;

    fetchProfilePresence(counterpartyProfileId)
      .then((presence) => {
        if (!active || !presence) return;
        setCounterpartyPresence({ isOnline: presence.is_online, lastSeenAt: presence.last_seen_at });
      })
      .catch((e) => captureError(e, { scope: 'messages_fetch_presence' }));

    const unsubscribe = subscribeToProfilePresence(counterpartyProfileId, (presence) => {
      setCounterpartyPresence({ isOnline: presence.is_online, lastSeenAt: presence.last_seen_at });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [counterpartyProfileId, isRemoteMode]);
 
  // ─── İlk mesaj ─────────────────────────────────────────────
 
  useEffect(() => {
    if (!conversation || !initialMessageText || initialMessageSentRef.current || isSending) return;
    initialMessageSentRef.current = true;
    if (!isRemoteMode) { sendFallbackMessage(conversation.id, initialMessageText); return; }
    setIsSending(true);
    sendRemoteMessage(conversation.id, initialMessageText)
      .then((created) => { setRemoteMessages((c) => { const prev = c[conversation.id] ?? []; if (prev.some((m) => m.id === created.id)) return c; return { ...c, [conversation.id]: [...prev, created] }; }); })
      .catch((e) => captureError(e, { scope: 'messages_story_initial_send' }))
      .finally(() => setIsSending(false));
  }, [conversation, initialMessageText, isRemoteMode, isSending, sendFallbackMessage]);
 
  function setCurrentDraft(text: string) { if (!conversation) return; setDrafts((d) => ({ ...d, [conversation.id]: text })); }

  function handleDraftChanged(text: string) {
    setCurrentDraft(text);

    if (!isRemoteMode || !conversation) {
      return;
    }

    setTypingStatus(conversation.id, true).catch(() => undefined);

    if (typingOffTimerRef.current) {
      clearTimeout(typingOffTimerRef.current);
    }

    typingOffTimerRef.current = setTimeout(() => {
      setTypingStatus(conversation.id, false).catch(() => undefined);
    }, 1400);
  }
 
  // ─── Gönderme ──────────────────────────────────────────────
 
  async function sendText(body: string) {
    if (!conversation || !body || isSending) return;
    const normalizedBody = body.trim();

    if (editTarget) {
      setEditedMessageTexts((current) => ({ ...current, [editTarget.id]: normalizedBody }));
      setEditTarget(null);
      setReplyTarget(null);
      setCurrentDraft('');
      return;
    }

    const messageBody = replyTarget
      ? `[yanit:${replyTarget.id}]${truncateText(replyTarget.text, 120)}\n${normalizedBody}`
      : normalizedBody;

    if (!isRemoteMode) { sendFallbackMessage(conversation.id, body); return; }
    const optimisticId = `pending-${Date.now()}`;
    setPendingMsg({ id: optimisticId, text: normalizedBody, status: 'sending', msgKind: 'text', replyToText: replyTarget?.text });
    setIsSending(true);
    try {
      const created = await sendRemoteMessage(conversation.id, messageBody);
      setPendingMsg(null);
      setReplyTarget(null);
      setTypingStatus(conversation.id, false).catch(() => undefined);
      setRemoteMessages((c) => { const prev = c[conversation.id] ?? []; if (prev.some((m) => m.id === created.id)) return c; return { ...c, [conversation.id]: [...prev, created] }; });
      const parsed = parseReplyPayload(created.body);
      updateConversationPreview(conversation.id, parsed.body, created.created_at, created.sender_id);
    } catch (e) {
      captureError(e as Error, { scope: 'messages_send' });
      setPendingMsg((p) => (p ? { ...p, status: 'failed' } : null));
    } finally { setIsSending(false); }
  }
 
  async function handleSend() { if (!conversation || !currentDraft || isSending) return; const body = currentDraft; setCurrentDraft(''); await sendText(body); }
  async function handleQuickReply(qr: string) { await sendText(qr); }
 
  async function handleSendOffer(amount: number) {
    if (!conversation) return;
    await sendText(`TEKLIF:${amount}:${activeProductCard?.price ?? 0}`);
  }
 
  function handleOfferAccept(msgId: string) { setLocalOfferStatuses((s) => ({ ...s, [msgId]: 'accepted' })); }
  function handleOfferReject(msgId: string) { setLocalOfferStatuses((s) => ({ ...s, [msgId]: 'rejected' })); }
  function handleOfferCounter(msgId: string) { setLocalOfferStatuses((s) => ({ ...s, [msgId]: 'countered' })); }
 
  async function handlePickAndSendImage() {
    setShowAttachMenu(false);
    try {
      if (!conversation) return;

      await openImageAttachmentPicker({
        onPicked: async (uri) => {
          const optimisticId = `pending-img-${Date.now()}`;
          setPendingMsg({ id: optimisticId, text: '📷 Görsel', status: 'sending', msgKind: 'image', imageUri: uri });

          if (!isRemoteMode) {
            await sendText(`GORSEL:${uri}`);
            return;
          }

          const uploadedUrl = await uploadMessageImage(conversation.id, uri);
          const created = await sendRemoteMessage(conversation.id, '[Gorsel]', uploadedUrl);

          setPendingMsg(null);
          setRemoteMessages((current) => {
            const prev = current[conversation.id] ?? [];
            if (prev.some((m) => m.id === created.id)) return current;
            return { ...current, [conversation.id]: [...prev, created] };
          });
          updateConversationPreview(conversation.id, created.body || '[Gorsel]', created.created_at, created.sender_id);
        },
      });
    } catch (e) { captureError(e as Error, { scope: 'messages_pick_image' }); }
  }

  function openModerationActions() {
    if (!counterpartyProfileId) {
      return;
    }

    Alert.alert('Konuşma İşlemleri', 'Bu kullanıcıyla ilgili işlem seçin.', [
      {
        text: 'Kullanıcıyı Engelle',
        style: 'destructive',
        onPress: () => {
          blockUser(counterpartyProfileId, 'Mesajlaşma ekranından engellendi')
            .then(() => Alert.alert('Tamam', 'Kullanıcı engellendi.'))
            .catch((e) => Alert.alert('Hata', e instanceof Error ? e.message : 'İşlem başarısız.'));
        },
      },
      {
        text: 'Şikayet Et',
        onPress: () => {
          reportUser(counterpartyProfileId, 'Mesajlaşma davranışı uygunsuz')
            .then(() => Alert.alert('Tamam', 'Şikayet kaydı oluşturuldu.'))
            .catch((e) => Alert.alert('Hata', e instanceof Error ? e.message : 'İşlem başarısız.'));
        },
      },
      {
        text: 'İptal',
        style: 'cancel',
      },
    ]);
  }
 
  function handleAddReaction(msgId: string, emoji: string) {
    setActiveMessageAction(null);
    if (!isRemoteMode) {
      setLocalReactions((r) => toggleEmoji(r, msgId, emoji));
      return;
    }
    // Optimistik güncelleme
    setRemoteReactions((r) => toggleEmoji(r, msgId, emoji));
    // DB'ye kaydet — hata olursa geri al
    toggleReaction(msgId, emoji).catch((e) => {
      captureError(e, { scope: 'messages_toggle_reaction' });
      setRemoteReactions((r) => toggleEmoji(r, msgId, emoji));
    });
  }
 
  function openWhatsApp() {
    if (!contactWhatsapp) return;
    const normalized = contactWhatsapp.replace(/\D/g, '');
    const message = encodeURIComponent(relatedProductTitle ? `${relatedProductTitle} ürünü hakkında bilgi alabilir miyim?` : 'Merhaba, ürün hakkında bilgi alabilir miyim?');
    Linking.openURL(`https://wa.me/${normalized}?text=${message}`);
  }

  function openMessageActions(item: Extract<MsgItem, { kind: 'message' }>) {
    setActiveMessageAction({ id: item.id, text: item.text, mine: item.sender === 'me' });
  }

  function handleReplyToMessage() {
    if (!activeMessageAction) {
      return;
    }

    setReplyTarget(activeMessageAction);
    setEditTarget(null);
    setActiveMessageAction(null);
    composerInputRef.current?.focus();
  }

  function handleEditMessage() {
    if (!activeMessageAction || !activeMessageAction.mine) {
      return;
    }

    setEditTarget({ id: activeMessageAction.id, text: activeMessageAction.text });
    setReplyTarget(null);
    setCurrentDraft(activeMessageAction.text);
    setActiveMessageAction(null);
    composerInputRef.current?.focus();
  }

  async function handleRefreshConversations() {
    if (!isRemoteMode) {
      return;
    }

    setIsRefreshingConversations(true);
    try {
      await refreshConversations();
    } catch (e) {
      captureError(e as Error, { scope: 'messages_refresh_conversations' });
    } finally {
      setIsRefreshingConversations(false);
    }
  }

  async function handleRefreshMessages() {
    if (!isRemoteMode || !conversation) {
      return;
    }

    setIsRefreshingMessages(true);
    try {
      await refreshActiveConversation(conversation.id);
    } catch (e) {
      captureError(e as Error, { scope: 'messages_refresh_messages' });
    } finally {
      setIsRefreshingMessages(false);
    }
  }

  async function retryPendingMessage() {
    if (!pendingMsg || pendingMsg.status !== 'failed' || isSending) {
      return;
    }

    await sendText(pendingMsg.text);
  }
 
  // ─── Parse mesaj ───────────────────────────────────────────
 
  function parseMsg(m: { id: string; sender: string; text: string; createdAt: string }): Extract<MsgItem, { kind: 'message' }> {
    if (m.text.startsWith('TEKLIF:')) {
      const parts = m.text.split(':');
      const amount = parseFloat(parts[1] ?? '0');
      const originalPrice = parseFloat(parts[2] ?? '0') || undefined;
      const status = localOfferStatuses[m.id] ?? 'pending';
      return { kind: 'message', id: m.id, sender: m.sender, text: m.text, createdAt: m.createdAt, status: 'sent', msgKind: 'offer', offerData: { amount, originalPrice, status } };
    }
    if (m.text.startsWith('GORSEL:')) {
      return { kind: 'message', id: m.id, sender: m.sender, text: '📷 Görsel', createdAt: m.createdAt, status: 'sent', msgKind: 'image', imageUri: m.text.slice(7) };
    }

    const parsedReply = parseReplyPayload(m.text);
    const parsed = m as { msgKind?: MessageKind; imageUri?: string };
    if (parsed.msgKind === 'image' || parsed.imageUri) {
      return {
        kind: 'message',
        id: m.id,
        sender: m.sender,
        text: parsed.imageUri ? '📷 Görsel' : parsedReply.body,
        createdAt: m.createdAt,
        status: 'sent',
        msgKind: 'image',
        imageUri: parsed.imageUri,
        replyToText: parsedReply.replyToText,
      };
    }
    return { kind: 'message', id: m.id, sender: m.sender, text: parsedReply.body, createdAt: m.createdAt, status: 'sent', msgKind: 'text', reactions: localReactions[m.id], replyToText: parsedReply.replyToText };
  }
 
  const flatListData = useMemo((): MsgItem[] => {
    if (!conversation) return [];
    const msgs: Extract<MsgItem, { kind: 'message' }>[] = conversation.messages.map(parseMsg);
    if (pendingMsg) msgs.push({ kind: 'message', id: pendingMsg.id, sender: 'me', text: pendingMsg.text, createdAt: new Date().toISOString(), status: pendingMsg.status, msgKind: pendingMsg.msgKind ?? 'text', imageUri: pendingMsg.imageUri, offerData: pendingMsg.offerData, replyToText: pendingMsg.replyToText });
    const result: MsgItem[] = [];
    let lastLabel = '';
    for (const item of msgs) {
      const label = formatDateLabel(item.createdAt);
      if (label !== lastLabel) { result.push({ kind: 'separator', id: `sep-${label}-${item.id}`, label }); lastLabel = label; }
      result.push(item);
    }
    return result;
  }, [conversation, pendingMsg, localReactions, localOfferStatuses]);
 
  // ─── Render ────────────────────────────────────────────────
 
  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
 
      {/* Başlık */}
      <View className="bg-white px-4 pt-3 pb-3 border-b border-[#33333315]">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => { if (conversation) { if (routeConversationId) { router.back(); return; } setSelectedConversationId(null); return; } router.back(); }} className="w-10 h-10 rounded-full bg-[#F7F7F7] items-center justify-center">
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </Pressable>
          {conversation ? (
            <View className="flex-1 px-3 flex-row items-center">
              <View style={{ position: 'relative' }}>
                <Image source={{ uri: conversation.avatar || storeData.avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                <View
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: counterpartyPresence?.isOnline ? '#22C55E' : '#9CA3AF',
                    borderWidth: 1.5,
                    borderColor: '#fff',
                  }}
                />
              </View>
              <View className="ml-2.5 flex-1">
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{conversation.title}</Text>
                {isRemoteMode ? (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: counterpartyPresence?.isOnline ? '#22C55E' : colors.textSecondary }}>
                    {counterpartyPresence?.isOnline ? 'Çevrimiçi' : formatLastSeenLabel(counterpartyPresence?.lastSeenAt)}
                  </Text>
                ) : (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary }}>Demo sohbet</Text>
                )}
              </View>
            </View>
          ) : (
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 20, color: colors.textPrimary }}>Mesajlar</Text>
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {conversation ? (
              <>
                <Pressable onPress={openWhatsApp} className="w-10 h-10 rounded-full bg-[#F7F7F7] items-center justify-center">
                  <Ionicons name="call-outline" size={18} color={colors.textSecondary} />
                </Pressable>
                <Pressable onPress={() => Alert.alert('Yakında', 'Görüntülü görüşme yakında aktif olacak.')} className="w-10 h-10 rounded-full bg-[#F7F7F7] items-center justify-center">
                  <Ionicons name="videocam-outline" size={18} color={colors.textSecondary} />
                </Pressable>
                <Pressable onPress={openModerationActions} className="w-10 h-10 rounded-full bg-[#F7F7F7] items-center justify-center">
                  <Ionicons name="ellipsis-horizontal" size={19} color={colors.primary} />
                </Pressable>
              </>
            ) : (
              <Pressable onPress={openModerationActions} className="w-10 h-10 rounded-full bg-[#F7F7F7] items-center justify-center">
                <Ionicons name="help-circle-outline" size={19} color={colors.primary} />
              </Pressable>
            )}
          </View>
        </View>
        {!conversation ? (
          <View className="mt-3 flex-row items-center bg-[#F7F7F7] rounded-xl px-3 h-11 border border-[#33333315]">
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput value={searchText} onChangeText={setSearchText} placeholder="Konuşmalarda ara" placeholderTextColor={colors.textMuted} style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary }} className="ml-2 flex-1" />
          </View>
        ) : null}
        {!conversation ? (
          <View className="mt-3 flex-row items-center" style={{ gap: 8 }}>
            <Pressable
              onPress={() => setListFilter('all')}
              style={{ backgroundColor: listFilter === 'all' ? colors.primary : '#F7F7F7', borderColor: listFilter === 'all' ? colors.primary : '#E5E7EB' }}
              className="h-8 px-3 rounded-full border items-center justify-center"
            >
              <Text style={{ fontFamily: listFilter === 'all' ? fonts.bold : fonts.medium, fontSize: 11, color: listFilter === 'all' ? '#fff' : colors.textPrimary }}>
                Tümü ({conversations.length})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setListFilter('unread')}
              style={{ backgroundColor: listFilter === 'unread' ? colors.primary : '#F7F7F7', borderColor: listFilter === 'unread' ? colors.primary : '#E5E7EB' }}
              className="h-8 px-3 rounded-full border items-center justify-center"
            >
              <Text style={{ fontFamily: listFilter === 'unread' ? fonts.bold : fonts.medium, fontSize: 11, color: listFilter === 'unread' ? '#fff' : colors.textPrimary }}>
                Okunmamış ({conversations.filter((item) => item.unreadCount > 0).length})
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
 
      {/* Konuşma listesi */}
      {!conversation ? (
        <View className="flex-1">
          <ScrollView
            className="flex-1 px-3 pt-3"
            contentContainerStyle={{ paddingBottom: 96 }}
            showsVerticalScrollIndicator={false}
            refreshControl={isRemoteMode ? <RefreshControl refreshing={isRefreshingConversations} onRefresh={handleRefreshConversations} tintColor={colors.primary} /> : undefined}
          >
            {filteredConversations.length === 0 ? (
              <EmptyChatState
                title={conversations.length > 0 ? 'Sonuç bulunamadı' : 'Henüz mesajın yok'}
                description={conversations.length > 0 ? 'Arama kelimesini veya filtreyi değiştirip tekrar dene.' : 'Beğendiğin ürünlerde satıcıya mesaj göndererek konuşma başlatabilirsin.'}
                actionLabel="Alışverişe Başla"
                onAction={() => router.push('/')}
              />
            ) : (
              filteredConversations.map((item) => {
                const lastMessage = item.messages[item.messages.length - 1]?.text ?? item.lastMessage ?? 'Yeni mesaj';
                const listingImage = item.listing?.image;
                const listingPrice = formatPrice(item.listing?.price);
                return (
                  <Pressable key={item.id} onPress={() => openConversationThread(item.id)} className="rounded-2xl border border-[#33333315] bg-white px-3 py-3 mb-2">
                    <View className="flex-row items-center">
                      <View style={{ position: 'relative' }}>
                        <Image source={{ uri: item.avatar || storeData.avatar }} style={{ width: 46, height: 46, borderRadius: 23 }} />
                        {item.unreadCount > 0 ? <View style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 1.5, borderColor: '#fff' }} /> : null}
                      </View>
                      <View className="flex-1 ml-3 pr-2">
                        <View className="flex-row items-center justify-between">
                          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, maxWidth: '72%' }} numberOfLines={1}>{item.title}</Text>
                          <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textMuted }}>{formatTime(item.lastMessageAt)}</Text>
                        </View>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 4 }} numberOfLines={1}>{lastMessage}</Text>
                      </View>
                      <View className="items-end">
                        {item.unreadCount > 0 ? (
                          <View style={{ backgroundColor: colors.primary }} className="min-w-[20px] h-5 px-1 rounded-full items-center justify-center">
                            <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff' }}>{item.unreadCount}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    {listingImage || listingPrice ? (
                      <View className="mt-3 pt-3 border-t border-[#33333310] flex-row items-center justify-between">
                        <View className="flex-row items-center flex-1">
                          {listingImage ? <Image source={{ uri: listingImage }} style={{ width: 42, height: 42, borderRadius: 10 }} /> : <View className="w-[42px] h-[42px] rounded-[10px] bg-[#F3F4F6] items-center justify-center"><Ionicons name="image-outline" size={16} color={colors.textMuted} /></View>}
                          <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary, marginLeft: 8, flex: 1 }} numberOfLines={1}>{item.listing?.title || 'İlgili ürün'}</Text>
                        </View>
                        {listingPrice ? <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary }}>{listingPrice}</Text> : null}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <NewMessageButton onPress={() => router.push('/(tabs)/store')} />
        </View>
      ) : null}
 
      {/* Sohbet */}
      {conversation ? (
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 6 : 0}>
          <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1200&q=60' }} resizeMode="cover" style={{ flex: 1 }}>
          <View style={{ ...{ position: 'absolute', top: 70, right: -30, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.18)' } }} />
          <View style={{ ...{ position: 'absolute', bottom: 180, left: -45, width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(255,255,255,0.14)' } }} />
          <FlatList
            ref={messagesListRef}
            className="flex-1 px-4 pt-3"
            contentContainerStyle={{ paddingBottom: 16 }}
            data={flatListData}
            refreshControl={isRemoteMode ? <RefreshControl refreshing={isRefreshingMessages} onRefresh={handleRefreshMessages} tintColor={colors.primary} /> : undefined}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => messagesListRef.current?.scrollToEnd({ animated: false })}
            onLayout={() => messagesListRef.current?.scrollToEnd({ animated: false })}
            ListHeaderComponent={
              <View className="mb-3">
                <View className="bg-[#FEF9C3E6] border border-[#FDE68A] rounded-2xl px-3 py-2.5 mb-2">
                  <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: '#92400E' }}>Bu platform ödeme ve kargo sürecine dahil değildir. Ödeme, teslimat ve kargo detaylarını satıcı ile görüşerek netleştirin.</Text>
                </View>
                {activeProductCard ? (
                  <View className="bg-[#FFFFFFE8] border border-[#33333315] rounded-2xl px-3 py-3 flex-row items-center">
                    {activeProductCard.image ? <Image source={{ uri: activeProductCard.image }} style={{ width: 56, height: 56, borderRadius: 12 }} /> : <View className="w-14 h-14 rounded-xl bg-[#F3F4F6] items-center justify-center"><Ionicons name="image-outline" size={18} color={colors.textMuted} /></View>}
                    <View className="flex-1 ml-3">
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }} numberOfLines={1}>{activeProductCard.title}</Text>
                      {activeProductCard.priceLabel ? <Text style={{ fontFamily: fonts.headingBold, fontSize: 14, color: colors.primary, marginTop: 2 }}>{activeProductCard.priceLabel}</Text> : null}
                      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>Durum: {activeProductCard.status}</Text>
                    </View>
                    <View style={{ gap: 6 }}>
                      {activeProductCard.id ? (
                        <Pressable onPress={() => router.push(`/product/${activeProductCard.id}`)} style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }} className="h-8 rounded-full border px-3 items-center justify-center">
                          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary }}>İlana Git</Text>
                        </Pressable>
                      ) : null}
                      <Pressable onPress={() => setShowOfferModal(true)} style={{ backgroundColor: colors.primary }} className="h-8 rounded-full px-3 items-center justify-center">
                        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>💰 Teklif Ver</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            }
            ListFooterComponent={
              <TypingIndicator visible={(!isRemoteMode && typingConversationId === conversation.id) || (isRemoteMode && Boolean(remoteTypingUserId))} />
            }
            renderItem={({ item }) => {
              if (item.kind === 'separator') {
                return (
                  <View className="items-center my-2">
                    <View style={{ backgroundColor: '#E5E7EB' }} className="px-3 py-0.5 rounded-full">
                      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted }}>{item.label}</Text>
                    </View>
                  </View>
                );
              }
              const mine = item.sender === 'me';
              const statusIcon = mine && item.status === 'sending' ? '🕐' : mine && item.status === 'failed' ? '⚠' : mine ? '✓✓' : null;
              const statusColor = mine && item.status === 'failed' ? '#EF4444' : mine && item.status === 'sent' ? colors.primary : colors.textMuted;
                      const reactions = isRemoteMode ? (remoteReactions[item.id] ?? []) : (localReactions[item.id] ?? item.reactions ?? []);
                      const visibleText = editedMessageTexts[item.id] ?? item.text;
                      const isEdited = Boolean(editedMessageTexts[item.id]);
 
              return (
                <View className={`mb-3 ${mine ? 'items-end' : 'items-start'}`}>
                  {item.msgKind === 'offer' && item.offerData ? (
                    <OfferBubble offer={{ ...item.offerData, status: localOfferStatuses[item.id] ?? item.offerData.status }} isMine={mine} onAccept={() => handleOfferAccept(item.id)} onReject={() => handleOfferReject(item.id)} onCounter={() => handleOfferCounter(item.id)} />
                  ) : item.msgKind === 'image' && item.imageUri ? (
                    <Pressable onLongPress={() => openMessageActions(item)} delayLongPress={320}>
                      <Image source={{ uri: item.imageUri }} style={{ width: 200, height: 200, borderRadius: 14, opacity: item.status === 'sending' ? 0.6 : 1 }} />
                    </Pressable>
                  ) : (
                    <Pressable onLongPress={() => openMessageActions(item)} delayLongPress={320}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                        {!mine ? <Image source={{ uri: conversation.avatar || storeData.avatar }} style={{ width: 20, height: 20, borderRadius: 10, marginRight: 7, marginBottom: 2 }} /> : null}
                        <View style={{ backgroundColor: mine ? '#2E62E8' : '#FFFFFFE8', borderColor: mine ? '#2E62E8' : colors.borderLight, opacity: item.status === 'sending' ? 0.7 : 1, shadowColor: '#111827', shadowOpacity: mine ? 0.2 : 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }} className="max-w-[82%] rounded-[18px] px-4 py-2.5 border">
                        {item.replyToText ? (
                          <View style={{ borderLeftWidth: 2, borderLeftColor: mine ? '#BFDBFE' : colors.primary, paddingLeft: 8, marginBottom: 6, opacity: 0.9 }}>
                            <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: mine ? '#DBEAFE' : colors.textSecondary }} numberOfLines={2}>{truncateText(item.replyToText, 60)}</Text>
                          </View>
                        ) : null}
                        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: mine ? '#fff' : colors.textPrimary }}>{visibleText}</Text>
                        </View>
                      </View>
                    </Pressable>
                  )}
 
                  {reactions.length > 0 && (
                    <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
                      {reactions.map((emoji, i) => (
                        <View key={i} style={{ backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 13 }}>{emoji}</Text>
                        </View>
                      ))}
                    </View>
                  )}
 
                  <View className="flex-row items-center mt-1 gap-1">
                    <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textMuted }}>{formatTime(item.createdAt)}</Text>
                    {isEdited ? <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textMuted }}>Düzenlendi</Text> : null}
                    {statusIcon ? <Text style={{ fontSize: 10, color: statusColor }}>{statusIcon}</Text> : null}
                  </View>
                  {mine && item.status === 'failed' ? (
                    <Pressable onPress={retryPendingMessage} className="mt-1.5">
                      <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#DC2626' }}>Gönderilemedi • Tekrar Dene</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            }}
          />
 
          {activeMessageAction ? (
            <MessageActionSheet
              visible
              messageText={activeMessageAction.text}
              onSelectReaction={(emoji) => handleAddReaction(activeMessageAction.id, emoji)}
              onReply={handleReplyToMessage}
              onEdit={handleEditMessage}
              canEdit={activeMessageAction.mine}
              onReport={openModerationActions}
              onDismiss={() => setActiveMessageAction(null)}
            />
          ) : null}
 
          {showAttachMenu ? (
            <View style={{ position: 'absolute', bottom: 80, left: 16, backgroundColor: '#fff', borderRadius: 14, padding: 8, borderWidth: 0.5, borderColor: '#E5E7EB', gap: 4, elevation: 4 }}>
              <Pressable onPress={handlePickAndSendImage} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10 }}>
                <Ionicons name="image" size={20} color={colors.primary} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }}>Galeriden Görsel</Text>
              </Pressable>
              <Pressable onPress={() => { setShowAttachMenu(false); setShowOfferModal(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10 }}>
                <Ionicons name="pricetag" size={20} color="#D97706" />
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }}>Fiyat Teklifi</Text>
              </Pressable>
            </View>
          ) : null}
 
          {/* Composer */}
          <View className="bg-[#FFFFFFF2] px-3 pt-2 pb-3 border-t border-[#33333315]">
            {replyTarget ? (
              <View className="mb-2 rounded-xl bg-[#F7F7F7] border border-[#33333315] px-3 py-2 flex-row items-center justify-between">
                <View className="flex-1 pr-2">
                  <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.primary }}>Yanıtlanıyor</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary }} numberOfLines={1}>{truncateText(replyTarget.text, 80)}</Text>
                </View>
                <Pressable onPress={() => setReplyTarget(null)} className="w-7 h-7 items-center justify-center rounded-full bg-white border border-[#33333315]">
                  <Ionicons name="close" size={14} color={colors.textSecondary} />
                </Pressable>
              </View>
            ) : null}
            {editTarget ? (
              <View className="mb-2 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] px-3 py-2 flex-row items-center justify-between">
                <View className="flex-1 pr-2">
                  <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#92400E' }}>Mesaj Düzenleniyor</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: '#92400E' }} numberOfLines={1}>{truncateText(editTarget.text, 80)}</Text>
                </View>
                <Pressable onPress={() => { setEditTarget(null); setCurrentDraft(''); }} className="w-7 h-7 items-center justify-center rounded-full bg-white border border-[#FDE68A]">
                  <Ionicons name="close" size={14} color="#92400E" />
                </Pressable>
              </View>
            ) : null}
 
            <View className="flex-row items-center">
              <Pressable onPress={handlePickAndSendImage} className="w-10 h-10 rounded-full bg-[#F7F7F7] items-center justify-center mr-2">
                <Ionicons name="camera" size={18} color={colors.primary} />
              </Pressable>
              <TextInput
                ref={composerInputRef}
                value={drafts[conversation.id] ?? ''}
                onChangeText={handleDraftChanged}
                onFocus={() => messagesListRef.current?.scrollToEnd({ animated: true })}
                placeholder="Mesaj yaz..."
                placeholderTextColor={colors.textMuted}
                multiline editable showSoftInputOnFocus autoCorrect autoCapitalize="sentences" blurOnSubmit={false}
                style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary, maxHeight: 96, minHeight: 42 }}
                className="flex-1 bg-[#F7F7F7] rounded-2xl px-4 py-2.5 border border-[#33333315]"
              />
              {currentDraft ? (
                <Pressable onPress={handleSend} disabled={!currentDraft || isSending} style={{ backgroundColor: currentDraft && !isSending ? colors.primary : '#AFC7ED' }} className="w-11 h-11 rounded-full items-center justify-center ml-2">
                  <Ionicons name="send" size={18} color="#fff" />
                </Pressable>
              ) : (
                <View className="flex-row items-center ml-2" style={{ gap: 8 }}>
                  <Pressable className="w-8 h-8 rounded-full items-center justify-center bg-[#F7F7F7] border border-[#33333315]">
                    <Ionicons name="mic-outline" size={15} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable onPress={handlePickAndSendImage} className="w-8 h-8 rounded-full items-center justify-center bg-[#F7F7F7] border border-[#33333315]">
                    <Ionicons name="image-outline" size={15} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable onPress={() => setShowOfferModal(true)} className="w-8 h-8 rounded-full items-center justify-center bg-[#F7F7F7] border border-[#33333315]">
                    <Ionicons name="pricetag-outline" size={15} color={colors.textSecondary} />
                  </Pressable>
                </View>
              )}
            </View>
          </View>
          </ImageBackground>
        </KeyboardAvoidingView>
      ) : (
        <View className="flex-1" />
      )}
 
      <OfferModal visible={showOfferModal} originalPrice={activeProductCard?.price} onClose={() => setShowOfferModal(false)} onSend={handleSendOffer} />
    </SafeAreaView>
  );
}
 