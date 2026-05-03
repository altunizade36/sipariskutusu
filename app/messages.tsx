import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  BackHandler,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter, useSegments } from 'expo-router';
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
  subscribeToUserConversations,
  subscribeToUserMessages,
  subscribeToProfilePresence,
  subscribeToReactions,
  subscribeToTyping,
  toggleReaction,
  uploadMessageImage,
  updateMessageBody,
  updateOfferStatus,
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

function parseOrderDraftMessage(rawText: string) {
  if (!rawText.startsWith('Sipariş Taslağı #')) {
    return null;
  }

  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const draftId = (lines[0] || '').replace('Sipariş Taslağı #', '').trim() || 'Taslak';
  const getLineValue = (prefix: string) => {
    const line = lines.find((entry) => entry.startsWith(`${prefix}:`));
    return line ? line.slice(prefix.length + 1).trim() : undefined;
  };

  const parseAmount = (value?: string) => {
    if (!value) return undefined;
    const normalized = value.replace('₺', '').replace('TL', '').replace(/\s+/g, '').replace(',', '.');
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : undefined;
  };

  return {
    draftId,
    productTitle: getLineValue('Ürün'),
    quantity: Number(getLineValue('Adet')) || undefined,
    subtotal: parseAmount(getLineValue('Ara Toplam')),
    shippingFee: parseAmount(getLineValue('Kargo')),
    total: parseAmount(getLineValue('Tahmini Toplam')),
    paymentMethod: getLineValue('Ödeme Tercihi'),
    city: getLineValue('Şehir'),
    district: getLineValue('İlçe'),
    note: getLineValue('Not'),
  };
}

function parseOrderConfirmMessage(rawText: string) {
  if (!rawText.startsWith('SIPARIS_ONAY:')) {
    return null;
  }

  const parts = rawText.split(':');
  const draftId = (parts[1] || '').trim();
  const total = Number(parts[2] || '0');
  return {
    draftId: draftId || undefined,
    total: Number.isFinite(total) && total > 0 ? total : undefined,
  };
}

function parseOrderStatusMessage(rawText: string) {
  if (!rawText.startsWith('SIPARIS_DURUM:')) {
    return null;
  }

  const parts = rawText.split(':');
  const draftId = (parts[1] || '').trim();
  const status = (parts[2] || '').trim() as OrderStatusData['status'];
  const allowed: OrderStatusData['status'][] = ['draft', 'confirmed', 'payment_pending', 'preparing', 'shipped'];
  if (!allowed.includes(status)) {
    return null;
  }

  return {
    draftId: draftId || undefined,
    status,
  };
}

// ─── Tipler ──────────────────────────────────────────────────
 
type MessageKind = 'text' | 'image' | 'offer' | 'order' | 'order_confirm' | 'order_status';

interface OrderDraftData {
  draftId: string;
  productTitle?: string;
  quantity?: number;
  subtotal?: number;
  shippingFee?: number;
  total?: number;
  paymentMethod?: string;
  city?: string;
  district?: string;
  note?: string;
}

interface OrderConfirmData {
  draftId?: string;
  total?: number;
}

interface OrderStatusData {
  draftId?: string;
  status: 'draft' | 'confirmed' | 'payment_pending' | 'preparing' | 'shipped' | 'delivered';
}
 
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
  updatedAt?: string;
      status?: 'sending' | 'sent' | 'failed';
      msgKind?: MessageKind;
      imageUri?: string;
      offerData?: OfferData;
      orderData?: OrderDraftData;
      orderConfirmData?: OrderConfirmData;
      orderStatusData?: OrderStatusData;
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
    updatedAt?: string;
    msgKind?: MessageKind;
    imageUri?: string;
    offerData?: OfferData;
    orderData?: OrderDraftData;
    orderConfirmData?: OrderConfirmData;
    orderStatusData?: OrderStatusData;
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

type DmCandidate = {
  id: string;
  name: string;
  avatar?: string;
  profileId?: string;
  fallbackSellerKey?: string;
  unreadCount?: number;
  lastMessageAt?: string;
  lastMessage?: string;
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

function formatOrderAmount(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return `₺${value.toFixed(2)}`;
}

const ORDER_TIMELINE: Array<{ key: OrderStatusData['status']; label: string }> = [
  { key: 'draft', label: 'Taslak' },
  { key: 'confirmed', label: 'Anlasildi' },
  { key: 'payment_pending', label: 'Detaylar' },
  { key: 'preparing', label: 'Surec' },
  { key: 'shipped', label: 'Guncel' },
];

function timelineIndex(status: OrderStatusData['status']) {
  return ORDER_TIMELINE.findIndex((item) => item.key === status);
}

function OrderTimeline({ current }: { current: OrderStatusData['status'] }) {
  const currentIdx = timelineIndex(current);
  return (
    <View style={{ flexDirection: 'row', marginTop: 9, gap: 6 }}>
      {ORDER_TIMELINE.map((step, idx) => {
        const active = idx <= currentIdx;
        return (
          <View
            key={step.key}
            style={{
              flex: 1,
              minHeight: 22,
              borderRadius: 999,
              paddingHorizontal: 6,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? '#D1FAE5' : '#F1F5F9',
              borderWidth: 1,
              borderColor: active ? '#6EE7B7' : '#E2E8F0',
            }}
          >
            <Text style={{ fontFamily: active ? fonts.bold : fonts.medium, fontSize: 10, color: active ? '#166534' : colors.textMuted }} numberOfLines={1}>{step.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function OrderDraftBubble({
  draft,
  isMine,
  onEditDraft,
}: {
  draft: OrderDraftData;
  isMine: boolean;
  onEditDraft: () => void;
}) {
  return (
    <View style={{ backgroundColor: '#ECFEFF', borderWidth: 1, borderColor: '#A5F3FC', borderRadius: 14, padding: 12, maxWidth: '86%' }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#0E7490', marginBottom: 6 }}>🧾 Sipariş Taslağı #{draft.draftId}</Text>
      {draft.productTitle ? (
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={2}>{draft.productTitle}</Text>
      ) : null}
      <View style={{ marginTop: 8, gap: 3 }}>
        {draft.quantity ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>Adet: {draft.quantity}</Text> : null}
        {draft.paymentMethod ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>Ödeme: {draft.paymentMethod}</Text> : null}
        {(draft.city || draft.district) ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>Teslimat: {[draft.city, draft.district].filter(Boolean).join(' / ')}</Text> : null}
        {draft.total ? <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: '#0E7490', marginTop: 2 }}>Tahmini Toplam: {formatOrderAmount(draft.total)}</Text> : null}
      </View>
      <OrderTimeline current="draft" />
      {draft.note ? (
        <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#67E8F9' }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: '#155E75' }} numberOfLines={3}>Not: {draft.note}</Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        {isMine ? (
          <Pressable
            onPress={onEditDraft}
            style={{ flex: 1, backgroundColor: '#fff', borderRadius: 8, height: 34, borderWidth: 0.5, borderColor: '#67E8F9', alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#0E7490' }}>Teklifi Güncelle</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function OrderConfirmBubble({
  data,
}: {
  data: OrderConfirmData;
}) {
  return (
    <View style={{ backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#86EFAC', borderRadius: 14, padding: 12, maxWidth: '82%' }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#166534', marginBottom: 5 }}>✅ Sipariş Onayı</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>
        {data.draftId ? `Taslak #${data.draftId} onaylandı.` : 'Sipariş taslağı onaylandı.'}
      </Text>
      {data.total ? (
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: '#166534', marginTop: 6 }}>
          Toplam: {formatOrderAmount(data.total)}
        </Text>
      ) : null}
      <OrderTimeline current="confirmed" />
      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: '#166534', marginTop: 6 }}>
        Detaylar sohbet uzerinden karsilikli olarak netlestirilir.
      </Text>
    </View>
  );
}

function OrderStatusBubble({
  data,
}: {
  data: OrderStatusData;
}) {
  const currentLabel = ORDER_TIMELINE.find((item) => item.key === data.status)?.label || 'Durum';
  const isDelivered = data.status === 'delivered';

  return (
    <View style={{ backgroundColor: isDelivered ? '#F0FDF4' : '#F0F9FF', borderWidth: 1, borderColor: isDelivered ? '#86EFAC' : '#BAE6FD', borderRadius: 14, padding: 12, maxWidth: '82%' }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: isDelivered ? '#166534' : '#0369A1', marginBottom: 5 }}>
        {isDelivered ? '🎉 Surec Sonuclandi' : '📦 Gorusme Durumu'}
      </Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>
        {data.draftId ? `Taslak #${data.draftId}` : 'Sipariş'} • {currentLabel}
      </Text>
      <OrderTimeline current={data.status} />
      {isDelivered ? (
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: '#166534', marginTop: 6 }}>
          Taraflar sureci goruserek tamamlamistir.
        </Text>
      ) : null}
    </View>
  );
}
 
// ─── Tepki Seçici ────────────────────────────────────────────
 
const EMOJI_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];
const QUICK_REPLIES = [
  'Merhaba, ürün hâlâ mevcut 👋',
  'Son fiyat budur.',
  'Hangi şehir/ilçedesiniz?',
  'Instagram hesabımdan da bakabilirsiniz.',
  'Detaylı ölçü/fotoğraf atabilirim.',
  'Teslimat/kargo için mesajlaşabiliriz.',
];
const REMOTE_CONVERSATIONS_CACHE_PREFIX = 'messages:remote:conversations:v1';
const REMOTE_THREAD_CACHE_PREFIX = 'messages:remote:thread:v1';
const RECENT_DM_CACHE_PREFIX = 'messages:recent-dm:v1';
 
function MessageActionSheet({
  visible,
  messageText,
  onSelectReaction,
  onReply,
  onEdit,
  canEdit,
  onCopy,
  onReport,
  onDismiss,
}: {
  visible: boolean;
  messageText: string;
  onSelectReaction: (emoji: string) => void;
  onReply: () => void;
  onEdit: () => void;
  canEdit: boolean;
  onCopy: () => void;
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

          <Pressable onPress={() => { onCopy(); onDismiss(); }} className="h-10 flex-row items-center">
            <Ionicons name="copy-outline" size={18} color={colors.textPrimary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary, marginLeft: 10 }}>Kopyala / Paylaş</Text>
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
  const segments = useSegments();
  const { user, isDarkMode } = useAuth();
  const params = useLocalSearchParams<{ conversation?: string; sellerId?: string; productId?: string; productTitle?: string; whatsapp?: string; initialMessage?: string }>();
  const { allProducts, conversations: fallbackConversations, typingConversationId, openConversation, openOrCreateConversation, sendMessage: sendFallbackMessage } = useListings();
 
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
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showNewDmModal, setShowNewDmModal] = useState(false);
  const [newDmQuery, setNewDmQuery] = useState('');

  const palette = useMemo(() => ({
    screenBg: isDarkMode ? '#0F172A' : '#FAFAFA',
    headerBg: isDarkMode ? '#111827' : '#FFFFFF',
    headerChipBg: isDarkMode ? '#1F2937' : '#F7F7F7',
    threadBg: isDarkMode ? '#1E293B' : '#EDF2FB',
    composerBg: isDarkMode ? '#111827' : '#FFFFFF',
    inputBg: isDarkMode ? '#1F2937' : '#F4F6FB',
    border: isDarkMode ? '#334155' : '#33333315',
    textPrimary: isDarkMode ? '#E5E7EB' : colors.textPrimary,
    textSecondary: isDarkMode ? '#94A3B8' : colors.textSecondary,
    textMuted: isDarkMode ? '#94A3B8' : colors.textMuted,
  }), [isDarkMode]);
  const [startingDmCandidateId, setStartingDmCandidateId] = useState<string | null>(null);
  const [recentDmIds, setRecentDmIds] = useState<string[]>([]);
  const [candidatePresence, setCandidatePresence] = useState<Record<string, boolean>>({});
  const [inboxPresence, setInboxPresence] = useState<Record<string, boolean>>({});
  const [showScrollFab, setShowScrollFab] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [activeMessageAction, setActiveMessageAction] = useState<{ id: string; text: string; mine: boolean } | null>(null);
  const [replyTarget, setReplyTarget] = useState<{ id: string; text: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{ id: string; text: string } | null>(null);
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
  const recentDmCacheKey = user?.id ? `${RECENT_DM_CACHE_PREFIX}:${user.id}` : null;
  const isTabMessagesRoute = (segments as string[]).includes('(tabs)');

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
    if (!isRemoteMode || !user?.id) {
      return;
    }

    const unsubscribeConversations = subscribeToUserConversations(user.id, (conversation) => {
      setRemoteConversations((current) => {
        const idx = current.findIndex((item) => item.id === conversation.id);

        if (idx < 0) {
          return [conversation, ...current];
        }

        const merged = {
          ...current[idx],
          ...conversation,
        };

        const next = current.filter((item) => item.id !== conversation.id);
        return [merged, ...next];
      });
    });

    const unsubscribeMessages = subscribeToUserMessages(user.id, (message) => {
      const conversationId = message.conversation_id;
      if (!conversationId) {
        return;
      }

      setRemoteMessages((current) => {
        const prev = current[conversationId] ?? [];
        if (prev.some((entry) => entry.id === message.id)) {
          return current;
        }

        return {
          ...current,
          [conversationId]: [...prev, message],
        };
      });

      updateConversationPreview(conversationId, message.body ?? '', message.created_at, message.sender_id);
    });

    return () => {
      unsubscribeConversations();
      unsubscribeMessages();
    };
  }, [isRemoteMode, user?.id]);

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
 
  // Tab'a geri dönüldüğünde (başka tab'dan) route param yoksa seçili konuşmayı sıfırla
  useFocusEffect(
    useCallback(() => {
      if (!routeConversationId && !routeSellerId) {
        setSelectedConversationId(null);
        handledRouteIntentRef.current = null;
      }
    }, [routeConversationId, routeSellerId]),
  );

  // Android fiziksel geri tuşu: açık konuşma varsa inbox'a dön
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedConversationId) {
        setSelectedConversationId(null);
        return true; // olayı yakala, daha fazla işlem yapma
      }
      return false; // normal geri davranışına bırak
    });
    return () => subscription.remove();
  }, [selectedConversationId]);

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
      if (!isTabMessagesRoute) {
        router.replace(buildConversationMessagesRoute(existing.id));
      }
      return;
    }

    handledRouteIntentRef.current = intentKey;
    getOrCreateConversation(routeSellerId, routeProductId || undefined).then((created) => {
      setRemoteConversations((c) => { if (c.some((i) => i.id === created.id)) return c; return [created, ...c]; });
      openConversationThread(created.id);
      if (!isTabMessagesRoute) {
        router.replace(buildConversationMessagesRoute(created.id));
      }
    }).catch((e) => captureError(e, { scope: 'messages_get_or_create_conversation' }));
  }, [routeProductId, routeSellerId, remoteConversations, isRemoteMode, router, fallbackConversations, isTabMessagesRoute]);
 
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

  function patchRemoteMessage(
    conversationId: string,
    messageId: string,
    patch: Partial<Message>,
  ) {
    setRemoteMessages((current) => {
      const list = current[conversationId] ?? [];
      const nextList = list.map((msg) => (msg.id === messageId ? { ...msg, ...patch } : msg));
      return { ...current, [conversationId]: nextList };
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
          updatedAt: msg.updated_at,
          msgKind: (msg.image_url || msg.attachment_url || msg.message_type === 'image')
            ? 'image'
            : ((msg.message_type === 'offer' || (msg.body || '').startsWith('TEKLIF:'))
              ? 'offer'
              : ((msg.body || '').startsWith('Sipariş Taslağı #')
                ? 'order'
                : ((msg.body || '').startsWith('SIPARIS_ONAY:')
                  ? 'order_confirm'
                  : ((msg.body || '').startsWith('SIPARIS_DURUM:') ? 'order_status' : 'text')))),
          imageUri: msg.image_url || msg.attachment_url || undefined,
          offerData: (() => {
            if (!(msg.message_type === 'offer' || (msg.body || '').startsWith('TEKLIF:'))) {
              return undefined;
            }
            const parts = (msg.body || '').split(':');
            const bodyAmount = Number(parts[1] ?? '0');
            const bodyOriginalPrice = Number(parts[2] ?? '0');
            const amount = typeof msg.offer_amount === 'number' && Number.isFinite(msg.offer_amount)
              ? msg.offer_amount
              : (Number.isFinite(bodyAmount) ? bodyAmount : 0);
            return {
              amount,
              originalPrice: Number.isFinite(bodyOriginalPrice) && bodyOriginalPrice > 0 ? bodyOriginalPrice : undefined,
              status: (msg.offer_status as OfferData['status']) || 'pending',
            };
          })(),
          orderData: parseOrderDraftMessage((msg.text || msg.body || '').trim()) || undefined,
          orderConfirmData: parseOrderConfirmMessage((msg.text || msg.body || '').trim()) || undefined,
          orderStatusData: parseOrderStatusMessage((msg.text || msg.body || '').trim()) || undefined,
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
      const listingTitle = item.listing?.title ?? '';
      return (
        item.title.toLocaleLowerCase('tr-TR').includes(query) ||
        lastText.toLocaleLowerCase('tr-TR').includes(query) ||
        listingTitle.toLocaleLowerCase('tr-TR').includes(query)
      );
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

  const dmCandidates = useMemo(() => {
    const map = new Map<string, DmCandidate>();

    if (isRemoteMode) {
      remoteConversations.forEach((item) => {
        const counterpartyId = user?.id === item.buyer_id ? item.seller_id : item.buyer_id;
        if (!counterpartyId || counterpartyId === user?.id || map.has(counterpartyId)) {
          return;
        }

        const profile = user?.id === item.buyer_id ? item.seller : item.buyer;
        const displayName = profile?.full_name?.trim() || 'Kullanıcı';
        map.set(counterpartyId, {
          id: counterpartyId,
          name: displayName,
          avatar: profile?.avatar_url || storeData.avatar,
          profileId: counterpartyId,
          unreadCount: user?.id === item.buyer_id ? item.buyer_unread : item.seller_unread,
          lastMessageAt: item.last_message_at || item.created_at,
          lastMessage: item.last_message || undefined,
        });
      });

      allProducts.forEach((product) => {
        const sellerId = product.sellerId?.trim();
        if (!sellerId || sellerId === user?.id || map.has(sellerId)) {
          return;
        }

        map.set(sellerId, {
          id: sellerId,
          name: product.brand?.trim() || 'Satıcı',
          avatar: storeData.avatar,
          profileId: sellerId,
          unreadCount: 0,
        });
      });
    } else {
      fallbackConversations.forEach((item) => {
        if (map.has(item.id)) {
          return;
        }

        map.set(item.id, {
          id: item.id,
          name: item.title,
          avatar: item.avatar || storeData.avatar,
          fallbackSellerKey: item.id,
          unreadCount: item.unreadCount,
          lastMessageAt: item.lastMessageAt,
        });
      });
    }

    return Array.from(map.values()).sort((a, b) => {
      const unreadDiff = (b.unreadCount ?? 0) - (a.unreadCount ?? 0);
      if (unreadDiff !== 0) {
        return unreadDiff;
      }

      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      if (aTime !== bTime) {
        return bTime - aTime;
      }

      return a.name.localeCompare(b.name, 'tr');
    });
  }, [allProducts, fallbackConversations, isRemoteMode, remoteConversations, user?.id]);

  const filteredDmCandidates = useMemo(() => {
    const query = newDmQuery.trim().toLocaleLowerCase('tr-TR');
    if (!query) {
      return dmCandidates;
    }

    return dmCandidates.filter((item) => item.name.toLocaleLowerCase('tr-TR').includes(query));
  }, [dmCandidates, newDmQuery]);

  const recentDmCandidates = useMemo(() => {
    if (recentDmIds.length === 0) {
      return [] as typeof dmCandidates;
    }

    const byId = new Map(dmCandidates.map((item) => [item.id, item]));
    return recentDmIds
      .map((id) => byId.get(id))
      .filter((item): item is (typeof dmCandidates)[number] => Boolean(item));
  }, [dmCandidates, recentDmIds]);

  const suggestedDmCandidates = useMemo(() => {
    if (newDmQuery.trim()) {
      return filteredDmCandidates;
    }

    const recentIdSet = new Set(recentDmIds);
    return dmCandidates.filter((item) => !recentIdSet.has(item.id));
  }, [dmCandidates, filteredDmCandidates, newDmQuery, recentDmIds]);

  // Batch-fetch presence for top DM modal candidates when modal opens
  useEffect(() => {
    if (!showNewDmModal || !isRemoteMode) return;
    const targets = dmCandidates.slice(0, 15);
    targets.forEach((c) => {
      if (!c.profileId) return;
      fetchProfilePresence(c.profileId)
        .then((p) => {
          if (!p) return;
          setCandidatePresence((prev) => ({ ...prev, [c.id]: p.is_online }));
        })
        .catch(() => undefined);
    });
  }, [showNewDmModal]);

  // Batch-fetch presence for inbox conversation rows when conversations list loads
  useEffect(() => {
    if (!isRemoteMode || remoteConversations.length === 0) return;
    remoteConversations.slice(0, 20).forEach((conv) => {
      const profileId = user?.id === conv.buyer_id ? conv.seller_id : conv.buyer_id;
      if (!profileId) return;
      fetchProfilePresence(profileId)
        .then((p) => {
          if (!p) return;
          setInboxPresence((prev) => ({ ...prev, [conv.id]: p.is_online }));
        })
        .catch(() => undefined);
    });
  }, [remoteConversations.length, isRemoteMode]);

  useEffect(() => {
    if (!recentDmCacheKey) {
      setRecentDmIds([]);
      return;
    }

    AsyncStorage.getItem(recentDmCacheKey)
      .then((serialized) => {
        if (!serialized) {
          setRecentDmIds([]);
          return;
        }

        const parsed = JSON.parse(serialized) as string[];
        setRecentDmIds(Array.isArray(parsed) ? parsed.slice(0, 20) : []);
      })
      .catch(() => setRecentDmIds([]));
  }, [recentDmCacheKey]);

  function rememberRecentDm(candidateId: string) {
    setRecentDmIds((current) => {
      const next = [candidateId, ...current.filter((id) => id !== candidateId)].slice(0, 20);
      if (recentDmCacheKey) {
        AsyncStorage.setItem(recentDmCacheKey, JSON.stringify(next)).catch(() => undefined);
      }
      return next;
    });
  }

  async function handleStartConversation(candidate: DmCandidate) {
    if (startingDmCandidateId) {
      return;
    }

    setStartingDmCandidateId(candidate.id);
    try {
      if (isRemoteMode && candidate.profileId) {
        const thread = await getOrCreateConversation(candidate.profileId);
        setRemoteConversations((current) => {
          if (current.some((item) => item.id === thread.id)) {
            return current;
          }
          return [thread, ...current];
        });
        setSelectedConversationId(thread.id);
      } else {
        const conversationId = openOrCreateConversation(candidate.fallbackSellerKey ?? candidate.id, candidate.name, candidate.avatar);
        setSelectedConversationId(conversationId);
      }

      rememberRecentDm(candidate.id);
      setShowNewDmModal(false);
      setNewDmQuery('');
    } catch (error) {
      captureError(error as Error, { scope: 'messages_start_conversation' });
      Alert.alert('Hata', 'Konuşma başlatılamadı. Lütfen tekrar dene.');
    } finally {
      setStartingDmCandidateId(null);
    }
  }
 
  const currentDraft = conversation ? (drafts[conversation.id] ?? '').trim() : '';
  const totalUnread = useMemo(() => conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0), [conversations]);
 
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
    // Zaten mesaj varsa ilk mesajı tekrar gönderme
    if (conversation.messages.length > 0) { initialMessageSentRef.current = true; return; }
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
      const targetId = editTarget.id;
      setEditTarget(null);
      setReplyTarget(null);
      setCurrentDraft('');
      if (conversation) {
        patchRemoteMessage(conversation.id, targetId, {
          body: normalizedBody,
          text: normalizedBody,
          updated_at: new Date().toISOString(),
        });
      }
      if (isRemoteMode) {
        updateMessageBody(targetId, normalizedBody).catch((err) =>
          captureError(err instanceof Error ? err : new Error(String(err)), { scope: 'messages.editTarget' })
        );
      }
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
  function handleOfferAccept(msgId: string) {
    if (conversation) {
      patchRemoteMessage(conversation.id, msgId, {
        offer_status: 'accepted',
        updated_at: new Date().toISOString(),
      });
    }
    if (isRemoteMode) {
      updateOfferStatus(msgId, 'accepted').catch((err) =>
        captureError(err instanceof Error ? err : new Error(String(err)), { scope: 'messages.offerAccept' })
      );
    }
  }
  function handleOfferReject(msgId: string) {
    if (conversation) {
      patchRemoteMessage(conversation.id, msgId, {
        offer_status: 'rejected',
        updated_at: new Date().toISOString(),
      });
    }
    if (isRemoteMode) {
      updateOfferStatus(msgId, 'rejected').catch((err) =>
        captureError(err instanceof Error ? err : new Error(String(err)), { scope: 'messages.offerReject' })
      );
    }
  }
  function handleOfferCounter(msgId: string) {
    if (conversation) {
      patchRemoteMessage(conversation.id, msgId, {
        offer_status: 'countered',
        updated_at: new Date().toISOString(),
      });
    }
    if (isRemoteMode) {
      updateOfferStatus(msgId, 'countered').catch((err) =>
        captureError(err instanceof Error ? err : new Error(String(err)), { scope: 'messages.offerCounter' })
      );
    }
  }
 
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
    if (!conversation || !counterpartyProfileId) {
      Alert.alert('Mesaj Yardımı', 'Ne yapmak istersin?', [
        {
          text: 'Konuşmaları Yenile',
          onPress: () => {
            void handleRefreshConversations();
          },
        },
        {
          text: 'Yeni Mesaj Başlat',
          onPress: () => {
            setShowNewDmModal(true);
          },
        },
        {
          text: 'İptal',
          style: 'cancel',
        },
      ]);
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
    if (!contactWhatsapp) {
      Alert.alert('Bilgi', 'Bu konuşma için WhatsApp numarası bulunamadı.');
      return;
    }
    const normalized = contactWhatsapp.replace(/\D/g, '');
    const message = encodeURIComponent(relatedProductTitle ? `${relatedProductTitle} ürünü hakkında bilgi alabilir miyim?` : 'Merhaba, ürün hakkında bilgi alabilir miyim?');
    Linking.openURL(`https://wa.me/${normalized}?text=${message}`);
  }

  function openVideoMeeting() {
    if (!conversation) {
      Alert.alert('Bilgi', 'Once bir konusma secmelisin.');
      return;
    }

    const roomKey = `sipariskutusu-${conversation.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'room'}`;
    const meetingUrl = `https://meet.jit.si/${roomKey}`;

    Alert.alert(
      'Goruntulu gorusme',
      'Toplanti baglantisi acilacak. Karsi tarafla paylasarak gorusmeyi baslatabilirsin.',
      [
        {
          text: 'Linki Paylas',
          onPress: () => {
            Share.share({
              message: `Goruntulu gorusme baglantisi: ${meetingUrl}`,
            }).catch(() => undefined);
          },
        },
        {
          text: 'Toplantiyi Ac',
          onPress: () => {
            Linking.openURL(meetingUrl).catch(() => {
              Alert.alert('Hata', 'Toplanti baglantisi acilamadi.');
            });
          },
        },
        { text: 'Vazgec', style: 'cancel' },
      ],
    );
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

  function handleCopyMessage() {
    if (!activeMessageAction) return;
    Share.share({ message: activeMessageAction.text }).catch(() => undefined);
  }
 
  // ─── Parse mesaj ───────────────────────────────────────────
 
  function parseMsg(m: { id: string; sender: string; text: string; createdAt: string; updatedAt?: string; msgKind?: MessageKind; imageUri?: string; offerData?: OfferData; orderData?: OrderDraftData; orderConfirmData?: OrderConfirmData; orderStatusData?: OrderStatusData }): Extract<MsgItem, { kind: 'message' }> {
    if (m.msgKind === 'offer' || m.offerData || m.text.startsWith('TEKLIF:')) {
      const parsedOffer = m.offerData ?? (() => {
        const parts = m.text.split(':');
        return {
          amount: parseFloat(parts[1] ?? '0') || 0,
          originalPrice: parseFloat(parts[2] ?? '0') || undefined,
          status: 'pending' as OfferData['status'],
        };
      })();
      return { kind: 'message', id: m.id, sender: m.sender, text: m.text, createdAt: m.createdAt, updatedAt: m.updatedAt, status: 'sent', msgKind: 'offer', offerData: parsedOffer };
    }
    if (m.msgKind === 'order' || m.orderData || m.text.startsWith('Sipariş Taslağı #')) {
      const parsedOrder = m.orderData ?? parseOrderDraftMessage(m.text);
      return {
        kind: 'message',
        id: m.id,
        sender: m.sender,
        text: m.text,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        status: 'sent',
        msgKind: 'order',
        orderData: parsedOrder ?? undefined,
      };
    }
    if (m.msgKind === 'order_confirm' || m.orderConfirmData || m.text.startsWith('SIPARIS_ONAY:')) {
      const parsedConfirm = m.orderConfirmData ?? parseOrderConfirmMessage(m.text);
      return {
        kind: 'message',
        id: m.id,
        sender: m.sender,
        text: m.text,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        status: 'sent',
        msgKind: 'order_confirm',
        orderConfirmData: parsedConfirm ?? undefined,
      };
    }
    if (m.msgKind === 'order_status' || m.orderStatusData || m.text.startsWith('SIPARIS_DURUM:')) {
      const parsedStatus = m.orderStatusData ?? parseOrderStatusMessage(m.text);
      return {
        kind: 'message',
        id: m.id,
        sender: m.sender,
        text: m.text,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        status: 'sent',
        msgKind: 'order_status',
        orderStatusData: parsedStatus ?? undefined,
      };
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
        updatedAt: m.updatedAt,
        status: 'sent',
        msgKind: 'image',
        imageUri: parsed.imageUri,
        replyToText: parsedReply.replyToText,
      };
    }
    return { kind: 'message', id: m.id, sender: m.sender, text: parsedReply.body, createdAt: m.createdAt, updatedAt: m.updatedAt, status: 'sent', msgKind: 'text', reactions: localReactions[m.id], replyToText: parsedReply.replyToText };
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
  }, [conversation, pendingMsg, localReactions]);
 
  // ─── Render ────────────────────────────────────────────────
 
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.screenBg }} edges={['top']}>
 
      {/* Başlık */}
      <View className="px-4 pt-3 pb-3 border-b" style={{ backgroundColor: palette.headerBg, borderBottomColor: palette.border }}>
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => {
              if (conversation) {
                setSelectedConversationId(null);
                return;
              }
              router.back();
            }}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: palette.headerChipBg }}
            accessibilityRole="button"
            accessibilityLabel={conversation ? 'Konusma listesine don' : 'Mesajlardan geri don'}
          >
            <Ionicons name="arrow-back" size={20} color={palette.textPrimary} />
          </Pressable>
          {conversation ? (
            <View className="flex-1 px-3 flex-row items-center">
              <View style={{ position: 'relative' }}>
                <Image source={{ uri: conversation.avatar || storeData.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                <View
                  style={{
                    position: 'absolute',
                    bottom: 1,
                    right: 1,
                    width: 11,
                    height: 11,
                    borderRadius: 6,
                    backgroundColor: counterpartyPresence?.isOnline ? '#22C55E' : '#9CA3AF',
                    borderWidth: 2,
                    borderColor: '#fff',
                  }}
                />
              </View>
              <View className="ml-2.5 flex-1">
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: palette.textPrimary }} numberOfLines={1}>{conversation.title}</Text>
                {isRemoteMode ? (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: counterpartyPresence?.isOnline ? '#22C55E' : palette.textSecondary }}>
                    {counterpartyPresence?.isOnline ? 'Çevrimiçi' : formatLastSeenLabel(counterpartyPresence?.lastSeenAt)}
                  </Text>
                ) : (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary }}>Demo sohbet</Text>
                )}
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: palette.textPrimary }}>Mesajlar</Text>
              {totalUnread > 0 ? (
                <View style={{ backgroundColor: colors.primary, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
                </View>
              ) : null}
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Pressable
              onPress={openModerationActions}
              style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.headerChipBg }}
              accessibilityRole="button"
              accessibilityLabel={conversation ? 'Sohbet islemlerini ac' : 'Mesaj yardim menusu'}
            >
              <Ionicons name={conversation ? 'ellipsis-vertical' : 'help-circle-outline'} size={19} color={colors.primary} />
            </Pressable>
          </View>
        </View>
        {!conversation ? (
          <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: palette.headerChipBg, borderRadius: 16, paddingHorizontal: 14, height: 46, borderWidth: 1.5, borderColor: palette.border, gap: 10 }}>
            <Ionicons name="search-outline" size={18} color={colors.primary} />
            <TextInput value={searchText} onChangeText={setSearchText} placeholder="Konuşmalarda ara..." placeholderTextColor={palette.textMuted} style={{ fontFamily: fonts.regular, fontSize: 14, color: palette.textPrimary, flex: 1 }} accessibilityLabel="Konusmalarda ara" />
            {searchText.length > 0 ? (
              <Pressable onPress={() => setSearchText('')}>
                <Ionicons name="close-circle" size={18} color={palette.textMuted} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {!conversation ? (
          <View style={{ marginTop: 10, flexDirection: 'row', backgroundColor: palette.headerChipBg, borderRadius: 14, padding: 3, alignSelf: 'flex-start', gap: 2 }}>
            <Pressable
              onPress={() => setListFilter('all')}
              style={{ backgroundColor: listFilter === 'all' ? colors.primary : 'transparent', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5 }}
            >
              <Text style={{ fontFamily: listFilter === 'all' ? fonts.bold : fonts.medium, fontSize: 12, color: listFilter === 'all' ? '#fff' : palette.textMuted }}>
                Tümü
              </Text>
              {conversations.length > 0 ? (
                <View style={{ backgroundColor: listFilter === 'all' ? 'rgba(255,255,255,0.25)' : colors.primary + '22', minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: listFilter === 'all' ? '#fff' : colors.primary }}>{conversations.length}</Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              onPress={() => setListFilter('unread')}
              style={{ backgroundColor: listFilter === 'unread' ? colors.primary : 'transparent', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5 }}
            >
              <Text style={{ fontFamily: listFilter === 'unread' ? fonts.bold : fonts.medium, fontSize: 12, color: listFilter === 'unread' ? '#fff' : palette.textMuted }}>
                Okunmamış
              </Text>
              {conversations.filter((item) => item.unreadCount > 0).length > 0 ? (
                <View style={{ backgroundColor: listFilter === 'unread' ? 'rgba(255,255,255,0.25)' : '#EF444422', minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: listFilter === 'unread' ? '#fff' : '#EF4444' }}>{conversations.filter((item) => item.unreadCount > 0).length}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        ) : null}
      </View>
 
      {/* Konuşma listesi */}
      {!conversation ? (
        <View className="flex-1">
          <ScrollView
            className="flex-1"
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
                const isOnline = inboxPresence[item.id];
                const hasUnread = item.unreadCount > 0;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => openConversationThread(item.id)}
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? (isDarkMode ? '#1E293B' : '#F0F4FF') : (isDarkMode ? palette.screenBg : '#fff'),
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderBottomWidth: 1,
                      borderBottomColor: isDarkMode ? '#1E293B' : '#F3F4F6',
                    })}
                  >
                    {/* Unread stripe */}
                    {hasUnread ? (
                      <View style={{ position: 'absolute', left: 0, top: 16, bottom: 16, width: 3, borderRadius: 2, backgroundColor: colors.primary }} />
                    ) : null}

                    {/* Avatar */}
                    <View style={{ position: 'relative', marginRight: 13 }}>
                      <View style={{
                        width: 56, height: 56, borderRadius: 28,
                        borderWidth: hasUnread ? 2.5 : 1.5,
                        borderColor: hasUnread ? colors.primary : (isDarkMode ? '#334155' : '#E5E7EB'),
                        padding: 2,
                        backgroundColor: isDarkMode ? '#1F2937' : '#fff',
                      }}>
                        <Image source={{ uri: item.avatar || storeData.avatar }} style={{ width: '100%', height: '100%', borderRadius: 26 }} />
                      </View>
                      {isOnline ? (
                        <View style={{ position: 'absolute', bottom: 2, right: 2, width: 13, height: 13, borderRadius: 7, backgroundColor: '#22C55E', borderWidth: 2.5, borderColor: isDarkMode ? palette.screenBg : '#fff' }} />
                      ) : null}
                    </View>

                    {/* Content */}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontFamily: hasUnread ? fonts.bold : fonts.medium, fontSize: 15, color: isDarkMode ? palette.textPrimary : colors.textPrimary, flex: 1, marginRight: 8 }} numberOfLines={1}>{item.title}</Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: hasUnread ? colors.primary : palette.textMuted }}>{formatTime(item.lastMessageAt)}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <Text style={{ fontFamily: hasUnread ? fonts.medium : fonts.regular, fontSize: 13, color: hasUnread ? (isDarkMode ? palette.textPrimary : colors.textPrimary) : palette.textMuted, flex: 1 }} numberOfLines={1}>{lastMessage}</Text>
                        {hasUnread ? (
                          <View style={{ backgroundColor: colors.primary, minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
                          </View>
                        ) : (
                          <Ionicons name="checkmark-done-outline" size={15} color={palette.textMuted} />
                        )}
                      </View>

                      {/* Listing card */}
                      {listingImage || listingPrice ? (
                        <View style={{ marginTop: 8, backgroundColor: isDarkMode ? '#1E293B' : '#F0F5FF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#DBEAFE' }}>
                          {listingImage
                            ? <Image source={{ uri: listingImage }} style={{ width: 30, height: 30, borderRadius: 7 }} />
                            : <View style={{ width: 30, height: 30, borderRadius: 7, backgroundColor: isDarkMode ? '#334155' : '#E0EAFF', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="image-outline" size={14} color={colors.primary} /></View>
                          }
                          <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: palette.textSecondary, marginLeft: 8, flex: 1 }} numberOfLines={1}>{item.listing?.title || 'İlgili ürün'}</Text>
                          {listingPrice ? <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary, marginLeft: 8 }}>{listingPrice}</Text> : null}
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <NewMessageButton onPress={() => setShowNewDmModal(true)} />
        </View>
      ) : null}
 
      {/* Sohbet */}
      {conversation ? (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.threadBg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 6 : 0}>
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
            scrollEventThrottle={100}
            onScroll={(e) => {
              const y = e.nativeEvent.contentOffset.y;
              const contentH = e.nativeEvent.contentSize.height;
              const layoutH = e.nativeEvent.layoutMeasurement.height;
              setShowScrollFab(contentH - y - layoutH > 200);
            }}
            ListHeaderComponent={
              <View style={{ marginBottom: 12 }}>
                <View style={{ backgroundColor: '#FFFBEB', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="information-circle-outline" size={14} color="#92400E" style={{ marginRight: 6 }} />
                  <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: '#92400E', flex: 1 }}>Ödeme ve kargo sürecine müddahil olunmaz. Detayları satıcı ile görüşün.</Text>
                </View>
                {activeProductCard ? (
                  <View style={{ backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
                    {activeProductCard.image ? <Image source={{ uri: activeProductCard.image }} style={{ width: 60, height: 60, borderRadius: 12 }} /> : <View style={{ width: 60, height: 60, borderRadius: 12, backgroundColor: '#F0F4F8', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="image-outline" size={20} color={colors.textMuted} /></View>}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }} numberOfLines={1}>{activeProductCard.title}</Text>
                      {activeProductCard.priceLabel ? <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: colors.primary, marginTop: 2 }}>{activeProductCard.priceLabel}</Text> : null}
                      {activeProductCard.status === 'Aktif' ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E', marginRight: 5 }} />
                          <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary }}>Aktif</Text>
                        </View>
                      ) : (
                        <View style={{ marginTop: 4, backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start' }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#92400E' }}>Bu ilan artık yayında değil</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ gap: 6, alignItems: 'flex-end' }}>
                      {activeProductCard.id ? (
                        <Pressable onPress={() => router.push(`/product/${activeProductCard.id}`)} style={{ backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 12, height: 30, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary }}>İlana Git</Text>
                        </Pressable>
                      ) : null}
                      <Pressable onPress={() => setShowOfferModal(true)} style={{ backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 12, height: 30, alignItems: 'center', justifyContent: 'center' }}>
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
                  <View style={{ alignItems: 'center', marginVertical: 12 }}>
                    <View style={{ backgroundColor: 'rgba(0,0,0,0.07)', paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20 }}>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: '#666' }}>{item.label}</Text>
                    </View>
                  </View>
                );
              }
              const mine = item.sender === 'me';
              const statusIcon = mine && item.status === 'sending' ? '🕐' : mine && item.status === 'failed' ? '⚠' : mine ? '✓✓' : null;
              const statusColor = mine && item.status === 'failed' ? '#EF4444' : mine && item.status === 'sent' ? colors.primary : colors.textMuted;
                      const reactions = isRemoteMode ? (remoteReactions[item.id] ?? []) : (localReactions[item.id] ?? item.reactions ?? []);
                      const visibleText = item.text;
                      const isEdited = Boolean(item.updatedAt && item.updatedAt !== item.createdAt);
 
              return (
                <View className={`mb-3 ${mine ? 'items-end' : 'items-start'}`}>
                  {item.msgKind === 'offer' && item.offerData ? (
                    <OfferBubble offer={item.offerData} isMine={mine} onAccept={() => handleOfferAccept(item.id)} onReject={() => handleOfferReject(item.id)} onCounter={() => handleOfferCounter(item.id)} />
                  ) : item.msgKind === 'order' && item.orderData ? (
                    <OrderDraftBubble
                      draft={item.orderData}
                      isMine={mine}
                      onEditDraft={() => {
                        const orderText = item.text;
                        setCurrentDraft(orderText);
                        setEditTarget(null);
                        setReplyTarget(null);
                        composerInputRef.current?.focus();
                      }}
                    />
                  ) : item.msgKind === 'order_confirm' && item.orderConfirmData ? (
                    <OrderConfirmBubble data={item.orderConfirmData} />
                  ) : item.msgKind === 'order_status' && item.orderStatusData ? (
                    <OrderStatusBubble data={item.orderStatusData} />
                  ) : item.msgKind === 'image' && item.imageUri ? (
                    <Pressable onLongPress={() => openMessageActions(item)} delayLongPress={320}>
                      <Image source={{ uri: item.imageUri }} style={{ width: 200, height: 200, borderRadius: 14, opacity: item.status === 'sending' ? 0.6 : 1 }} />
                    </Pressable>
                  ) : (
                    <Pressable onLongPress={() => openMessageActions(item)} delayLongPress={320}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                        {!mine ? <Image source={{ uri: conversation.avatar || storeData.avatar }} style={{ width: 20, height: 20, borderRadius: 10, marginRight: 7, marginBottom: 2 }} /> : null}
                        <View style={{ backgroundColor: mine ? '#1E5FC6' : (isDarkMode ? '#2D3748' : '#ECECEC'), opacity: item.status === 'sending' ? 0.7 : 1, maxWidth: '82%', borderRadius: 20, borderTopLeftRadius: mine ? 20 : 5, borderTopRightRadius: mine ? 5 : 20, paddingHorizontal: 14, paddingVertical: 10 }}>
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
              onCopy={handleCopyMessage}
              onReport={openModerationActions}
              onDismiss={() => setActiveMessageAction(null)}
            />
          ) : null}

          {showScrollFab ? (
            <Pressable
              onPress={() => messagesListRef.current?.scrollToEnd({ animated: true })}
              style={{ position: 'absolute', bottom: 88, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, borderWidth: 0.5, borderColor: '#E5E7EB' }}
            >
              <Ionicons name="chevron-down" size={20} color={colors.primary} />
            </Pressable>
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
          <View style={{ backgroundColor: palette.composerBg, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 14, borderTopWidth: 0.5, borderTopColor: palette.border }}>
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

            {!currentDraft && !replyTarget && !editTarget ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6, gap: 8 }} style={{ marginBottom: 8 }}>
                {QUICK_REPLIES.map((qr) => (
                  <Pressable key={qr} onPress={() => handleQuickReply(qr)} style={{ backgroundColor: '#F0F4FF', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 0.5, borderColor: '#C7D7F9', marginRight: 6 }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>{qr}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <Pressable
                onPress={handlePickAndSendImage}
                style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.headerChipBg, marginBottom: 3 }}
                accessibilityRole="button"
                accessibilityLabel="Galeriden gorsel gonder"
              >
                <Ionicons name="image-outline" size={19} color={colors.primary} />
              </Pressable>
              <TextInput
                ref={composerInputRef}
                value={drafts[conversation.id] ?? ''}
                onChangeText={handleDraftChanged}
                onFocus={() => messagesListRef.current?.scrollToEnd({ animated: true })}
                placeholder="Mesaj yaz..."
                placeholderTextColor={palette.textMuted}
                multiline editable showSoftInputOnFocus autoCorrect autoCapitalize="sentences" blurOnSubmit={false}
                style={{ fontFamily: fonts.regular, fontSize: 14, color: palette.textPrimary, maxHeight: 96, minHeight: 44, flex: 1, backgroundColor: palette.inputBg, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 0.5, borderColor: palette.border }}
                accessibilityLabel="Mesaj yazma alani"
              />
              {currentDraft ? (
                <Pressable
                  onPress={handleSend}
                  disabled={!currentDraft || isSending}
                  style={{ backgroundColor: currentDraft && !isSending ? colors.primary : '#AFC7ED', width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: 1 }}
                  accessibilityRole="button"
                  accessibilityLabel="Mesaji gonder"
                >
                  <Ionicons name="send" size={18} color="#fff" />
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => setShowOfferModal(true)}
                  style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.headerChipBg, marginBottom: 3 }}
                  accessibilityRole="button"
                  accessibilityLabel="Fiyat teklifi ver"
                >
                  <Ionicons name="pricetag-outline" size={18} color={colors.primary} />
                </Pressable>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      ) : null}
 
      <Modal visible={showNewDmModal} transparent animationType="slide" onRequestClose={() => setShowNewDmModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} pointerEvents="box-none">
          <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Pressable style={{ flex: 1 }} onPress={() => setShowNewDmModal(false)} />
            <Pressable onPress={() => {}} style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '82%', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: colors.textPrimary }}>Yeni Mesaj</Text>
              <Pressable onPress={() => setShowNewDmModal(false)} className="w-9 h-9 rounded-full bg-[#F7F7F7] items-center justify-center">
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View className="mt-3 flex-row items-center bg-[#F7F7F7] rounded-xl px-3 h-11 border border-[#33333315]">
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                value={newDmQuery}
                onChangeText={setNewDmQuery}
                placeholder="Kişi veya satıcı ara"
                placeholderTextColor={colors.textMuted}
                style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary }}
                className="ml-2 flex-1"
                autoFocus
              />
              {newDmQuery.trim() ? (
                <Pressable onPress={() => setNewDmQuery('')} className="w-7 h-7 rounded-full bg-[#E5E7EB] items-center justify-center">
                  <Ionicons name="close" size={14} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </View>

            {!newDmQuery.trim() && recentDmCandidates.length > 0 ? (
              <View style={{ marginTop: 10 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>Hızlı Başlat</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
                  {recentDmCandidates.slice(0, 8).map((candidate) => (
                    <Pressable
                      key={`quick-${candidate.id}`}
                      onPress={() => { void handleStartConversation(candidate); }}
                      disabled={Boolean(startingDmCandidateId)}
                      style={{ alignItems: 'center', marginRight: 12, opacity: startingDmCandidateId ? 0.7 : 1 }}
                    >
                      <View style={{ position: 'relative' }}>
                        <Image source={{ uri: candidate.avatar || storeData.avatar }} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#F1F5F9' }} />
                        {/* Online dot */}
                        <View style={{ position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: candidatePresence[candidate.id] ? '#22C55E' : '#D1D5DB', borderWidth: 2, borderColor: '#fff' }} />
                        {(candidate.unreadCount ?? 0) > 0 ? (
                          <View style={{ position: 'absolute', right: -2, top: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff' }}>{Math.min(candidate.unreadCount ?? 0, 99)}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textPrimary, marginTop: 6, maxWidth: 64, textAlign: 'center' }} numberOfLines={1}>{candidate.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <ScrollView className="mt-3" contentContainerStyle={{ paddingBottom: 10 }} keyboardShouldPersistTaps="handled">
              {filteredDmCandidates.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 28 }}>
                  <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.textMuted} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, marginTop: 10 }}>Sohbet bulunamadı</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>
                    Ürünlerden bir satıcıya mesaj atarak yeni konuşma başlatabilirsin.
                  </Text>
                </View>
              ) : (
                <>
                  {!newDmQuery.trim() && recentDmCandidates.length > 0 ? (
                    <>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Son Görüştüklerin</Text>
                      {recentDmCandidates.slice(0, 6).map((candidate) => (
                        <Pressable
                          key={`recent-${candidate.id}`}
                          onPress={() => { void handleStartConversation(candidate); }}
                          disabled={Boolean(startingDmCandidateId)}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#EEF2F7', opacity: startingDmCandidateId ? 0.7 : 1 }}
                        >
                          <View style={{ position: 'relative' }}>
                            <View style={(candidate.unreadCount ?? 0) > 0 ? { borderWidth: 2.5, borderColor: colors.primary, borderRadius: 25, padding: 2 } : { borderWidth: 2.5, borderColor: 'transparent', borderRadius: 25, padding: 2 }}>
                              <Image source={{ uri: candidate.avatar || storeData.avatar }} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#F1F5F9' }} />
                            </View>
                            <View style={{ position: 'absolute', bottom: 2, right: 2, width: 11, height: 11, borderRadius: 6, backgroundColor: candidatePresence[candidate.id] ? '#22C55E' : '#D1D5DB', borderWidth: 2, borderColor: '#fff' }} />
                          </View>
                          <View style={{ marginLeft: 10, flex: 1 }}>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{candidate.name}</Text>
                            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>
                              {candidate.lastMessage ? truncateText(candidate.lastMessage, 38) : (candidatePresence[candidate.id] ? 'Çevrimiçi' : 'Son konuştuğun kişi')}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 4 }}>
                            {candidate.lastMessageAt ? <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted }}>{formatTime(candidate.lastMessageAt)}</Text> : null}
                            {startingDmCandidateId === candidate.id ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
                          </View>
                        </Pressable>
                      ))}
                    </>
                  ) : null}

                  {!newDmQuery.trim() ? <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, marginTop: 8, marginBottom: 4 }}>Önerilen Kişiler</Text> : null}
                  {suggestedDmCandidates.map((candidate) => (
                    <Pressable
                      key={candidate.id}
                      onPress={() => { void handleStartConversation(candidate); }}
                      disabled={Boolean(startingDmCandidateId)}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#EEF2F7', opacity: startingDmCandidateId ? 0.7 : 1 }}
                    >
                      <View style={{ position: 'relative' }}>
                        <View style={(candidate.unreadCount ?? 0) > 0 ? { borderWidth: 2.5, borderColor: colors.primary, borderRadius: 25, padding: 2 } : { borderWidth: 2.5, borderColor: 'transparent', borderRadius: 25, padding: 2 }}>
                          <Image source={{ uri: candidate.avatar || storeData.avatar }} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#F1F5F9' }} />
                        </View>
                        <View style={{ position: 'absolute', bottom: 2, right: 2, width: 11, height: 11, borderRadius: 6, backgroundColor: candidatePresence[candidate.id] ? '#22C55E' : '#D1D5DB', borderWidth: 2, borderColor: '#fff' }} />
                      </View>
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{candidate.name}</Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>
                          {candidate.lastMessage ? truncateText(candidate.lastMessage, 38) : (candidatePresence[candidate.id] ? 'Çevrimiçi' : 'Mesajlaşmaya başla')}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        {candidate.lastMessageAt ? <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted }}>{formatTime(candidate.lastMessageAt)}</Text> : null}
                        {startingDmCandidateId === candidate.id ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
                      </View>
                    </Pressable>
                  ))}
                </>
              )}
            </ScrollView>
          </Pressable>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <OfferModal visible={showOfferModal} originalPrice={activeProductCard?.price} onClose={() => setShowOfferModal(false)} onSend={handleSendOffer} />
    </SafeAreaView>
  );
}
 