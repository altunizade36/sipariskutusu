import { Linking, View, Text, ScrollView, Pressable, Image, Dimensions, Share, TextInput, ActivityIndicator, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { colors, fonts } from '../../src/constants/theme';
import { useListings } from '../../src/context/ListingsContext';
import { useAuth } from '../../src/context/AuthContext';
import { fetchListing, incrementListingShareCount, subscribeToListingChanges } from '../../src/services/listingService';
import { addListingComment, deleteMyListingComment, fetchListingComments, hideListingCommentAsAdmin, subscribeToListingComments, type ListingComment } from '../../src/services/listingCommentService';
import { isSupabaseConfigured } from '../../src/services/supabase';
import { mapListingToProduct } from '../../src/utils/listingMapper';
import { useFavorites } from '../../src/hooks/useFavorites';
import { subscribeToListingFavoriteState } from '../../src/services/favoriteService';
import type { Product } from '../../src/data/mockData';
import { getOrderedMediaUris, isVideoUri, resolveMediaCover } from '../../src/utils/media';
import { fetchMyProfile } from '../../src/services/profileService';
import { submitReport, type ReportTargetType } from '../../src/services/reportService';
import { getOrCreateConversationForListing } from '../../src/services/chatLinkageService';
import { buildConversationMessagesRoute, buildMessagesInboxRoute, buildSellerMessagesRoute } from '../../src/utils/messageRouting';
import { InfoBanner } from '../../src/components/InfoBanner';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function parseEngagementCount(value: string | number | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value ?? '0').trim().replace(',', '.').toUpperCase();
  if (!normalized || normalized === 'YENI' || normalized === 'YENİ') {
    return 0;
  }

  if (normalized.endsWith('B')) {
    return Math.round(Number(normalized.slice(0, -1)) * 1000) || 0;
  }

  return Number(normalized.replace(/[^0-9.]/g, '')) || 0;
}

function formatEngagementCount(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}B`;
  }

  return value.toLocaleString('tr-TR');
}

const REPORT_REASON_OPTIONS: Record<ReportTargetType, string[]> = {
  listing: ['Sahte ilan', 'Yasaklı ürün', 'Yanıltıcı açıklama', 'Spam içerik', 'Diğer'],
  user: ['Dolandırıcılık şüphesi', 'Taciz / tehdit', 'Sahte profil', 'Spam davranışı', 'Diğer'],
  comment: ['Hakaret / küfür', 'Nefret söylemi', 'Spam yorum', 'Yanıltıcı içerik', 'Diğer'],
};

const REPORT_TARGET_LABEL: Record<ReportTargetType, string> = {
  listing: 'İlan',
  user: 'Kullanıcı',
  comment: 'Yorum',
};

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { allProducts } = useListings();
  const { checkFavorited, toggle: toggleFav } = useFavorites();
  const localProduct = allProducts.find((p) => p.id === id) ?? allProducts[0];
  const [product, setProduct] = useState<Product>(
    localProduct,
  );
  const sizeOptions = product.availableSizes?.length ? product.availableSizes : ['XS', 'S', 'M', 'L', 'XL'];
  const [selectedSize, setSelectedSize] = useState(sizeOptions[0] ?? 'M');
  const [selectedColor, setSelectedColor] = useState(product.availableColors?.[0] ?? '');
  const [favorited, setFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(parseEngagementCount(localProduct?.favoriteCount));
  const [selectedMediaUri, setSelectedMediaUri] = useState(resolveMediaCover(localProduct ?? {}));
  const [comments, setComments] = useState<ListingComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentInfo, setCommentInfo] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCommentBlocked, setIsCommentBlocked] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportTargetType, setReportTargetType] = useState<ReportTargetType>('listing');
  const [reportTargetId, setReportTargetId] = useState('');
  const [reportReason, setReportReason] = useState(REPORT_REASON_OPTIONS.listing[0] ?? 'Diğer');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportMessage, setReportMessage] = useState('');
  const contactWhatsapp = product.whatsapp || '';
  const mediaUris = getOrderedMediaUris(product);
  const selectedMediaIsVideo = isVideoUri(selectedMediaUri);

  const flattenActiveCommentCount = useCallback((items: ListingComment[]): number => {
    return items.reduce((total, item) => total + (item.status === 'active' ? 1 : 0) + flattenActiveCommentCount(item.replies), 0);
  }, []);

  const commentCount = flattenActiveCommentCount(comments);

  const refreshListing = useCallback(async () => {
    if (!id || !isSupabaseConfigured) {
      return;
    }

    try {
      const listing = await fetchListing(id);
      const mapped = mapListingToProduct(listing);
      setProduct(mapped);
      setFavoriteCount(parseEngagementCount(mapped.favoriteCount));
    } catch {
      // Yerel ürün fallback'i ekranda kalır.
    }
  }, [id]);

  const loadComments = useCallback(async () => {
    if (!id || !isSupabaseConfigured) {
      setComments([]);
      return;
    }

    setCommentsLoading(true);
    setCommentsError('');
    try {
      const nextComments = await fetchListingComments(id);
      setComments(nextComments);
    } catch (error) {
      setCommentsError(error instanceof Error ? error.message : 'Yorumlar yüklenemedi.');
    } finally {
      setCommentsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (localProduct) {
      setProduct(localProduct);
    }
  }, [localProduct]);

  useEffect(() => {
    setSelectedSize(sizeOptions[0] ?? 'M');
    setSelectedColor(product.availableColors?.[0] ?? '');
  }, [id, product.availableColors?.join('|'), product.availableSizes?.join('|')]);

  useEffect(() => {
    const nextMedia = getOrderedMediaUris(product);
    setSelectedMediaUri(nextMedia[0] ?? resolveMediaCover(product));
  }, [id, product.image, product.videoUri, product.mediaUris?.join('|')]);

    useEffect(() => {
      refreshListing();
    }, [refreshListing]);

    useEffect(() => {
      if (!id || !user) return;
      checkFavorited(id).then(setFavorited);
    }, [id, user?.id, checkFavorited]);

    useEffect(() => {
      loadComments();
    }, [loadComments]);

    useEffect(() => {
      if (!id || !isSupabaseConfigured) return;
      return subscribeToListingChanges(id, refreshListing);
    }, [id, refreshListing]);

    useEffect(() => {
      if (!id || !isSupabaseConfigured) return;
      return subscribeToListingComments(id, loadComments);
    }, [id, loadComments]);

    useEffect(() => {
      if (!id || !user || !isSupabaseConfigured) return;

      const refreshFavoriteState = () => {
        checkFavorited(id).then(setFavorited).catch(() => undefined);
        refreshListing();
      };

      return subscribeToListingFavoriteState(user.id, id, refreshFavoriteState);
    }, [checkFavorited, id, refreshListing, user?.id]);

    useEffect(() => {
      if (!user) {
        setIsAdmin(false);
        setIsCommentBlocked(false);
        return;
      }

      fetchMyProfile()
        .then((profile) => {
          setIsAdmin(profile?.role === 'admin');
          setIsCommentBlocked(Boolean(profile?.is_comment_blocked));
        })
        .catch(() => {
          setIsAdmin(false);
          setIsCommentBlocked(false);
        });
    }, [user?.id]);

    const handleToggleFavorite = useCallback(async () => {
      if (!user) { router.push('/auth'); return; }
      const next = await toggleFav(product.id);
      setFavorited(next);
      setFavoriteCount((current) => Math.max(next ? current + 1 : current - 1, 0));
      refreshListing();
    }, [refreshListing, router, user, product.id, toggleFav]);

  function openWhatsApp() {
    if (!contactWhatsapp) {
      return;
    }

    const text = encodeURIComponent(`${product.title} ürünü hakkında bilgi alabilir miyim?`);
    Linking.openURL(`https://wa.me/${contactWhatsapp}?text=${text}`);
  }

  async function shareProduct() {
    const result = await Share.share({
      message: `${product.brand} - ${product.title} | ₺${product.price.toFixed(2)}`,
    });

    if (result.action === Share.sharedAction && product.id) {
      incrementListingShareCount(product.id).catch(() => undefined);
    }
  }

  async function handleSendMessage() {
    if (!user) {
      router.push('/auth');
      return;
    }

    if (!product.sellerId) {
      router.push(buildMessagesInboxRoute());
      return;
    }

    if (isSupabaseConfigured && !user.id.startsWith('demo-')) {
      try {
        const conversation = await getOrCreateConversationForListing(user.id, product.sellerId, product.id);
        router.push(buildConversationMessagesRoute(conversation.id));
        return;
      } catch (error) {
        Alert.alert('Mesaj başlatılamadı', error instanceof Error ? error.message : 'Lütfen tekrar dene.');
        return;
      }
    }

    router.push(buildSellerMessagesRoute({
      sellerId: product.sellerId,
      productId: product.id,
      productTitle: product.title,
      whatsapp: contactWhatsapp,
    }));
  }

  function openProductStore() {
    const sellerName = product.brand?.trim();
    const sellerKey = product.sellerId?.trim();

    if (!sellerName) {
      router.push('/store');
      return;
    }

    const encodedName = encodeURIComponent(sellerName);
    const storeKeyQuery = sellerKey ? `&storeKey=${encodeURIComponent(sellerKey)}` : '';
    const sellerIdQuery = sellerKey ? `&sellerId=${encodeURIComponent(sellerKey)}` : '';
    router.push(`/(tabs)/store?name=${encodedName}${storeKeyQuery}${sellerIdQuery}`);
  }

  function formatCommentStatus(comment: ListingComment): string {
    if (comment.status === 'deleted') {
      return 'Bu yorum silindi.';
    }

    if (comment.status === 'hidden') {
      return 'Bu yorum yönetici tarafından gizlendi.';
    }

    return comment.comment;
  }

  function openReportModal(targetType: ReportTargetType, targetId: string) {
    if (!user) {
      router.push('/auth');
      return;
    }

    const reasons = REPORT_REASON_OPTIONS[targetType];
    setReportTargetType(targetType);
    setReportTargetId(targetId);
    setReportReason(reasons[0] ?? 'Diğer');
    setReportDescription('');
    setReportMessage('');
    setReportModalVisible(true);
  }

  async function handleSubmitReport() {
    if (!reportTargetId || reportSubmitting) {
      return;
    }

    setReportSubmitting(true);
    setReportMessage('');
    try {
      await submitReport({
        targetType: reportTargetType,
        targetId: reportTargetId,
        reason: reportReason,
        description: reportDescription || null,
      });
      setReportModalVisible(false);
      Alert.alert('Teşekkürler', 'Şikayetiniz moderasyon ekibine iletildi.');
    } catch (error) {
      setReportMessage(error instanceof Error ? error.message : 'Şikayet gönderilemedi.');
    } finally {
      setReportSubmitting(false);
    }
  }

  async function handleSubmitComment(parentId?: string | null) {
    if (!user) {
      router.push('/auth');
      return;
    }

    if (isCommentBlocked) {
      setCommentsError('Yorum yapma yetkiniz geçici olarak kapatılmış.');
      return;
    }

    const draft = parentId ? (replyDrafts[parentId] ?? '') : commentBody;
    setCommentSubmitting(true);
    setCommentsError('');
    setCommentInfo('');
    try {
      await addListingComment(product.id, draft, parentId ?? null);
      if (parentId) {
        setReplyDrafts((current) => ({ ...current, [parentId]: '' }));
        setReplyingTo(null);
      } else {
        setCommentBody('');
      }
      setCommentInfo('Yorum gönderildi.');
      await loadComments();
    } catch (error) {
      setCommentsError(error instanceof Error ? error.message : 'Yorum gönderilemedi.');
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    setCommentsError('');
    try {
      await deleteMyListingComment(commentId);
      setCommentInfo('Yorum silindi.');
      await loadComments();
    } catch (error) {
      setCommentsError(error instanceof Error ? error.message : 'Yorum silinemedi.');
    }
  }

  async function handleHideComment(commentId: string) {
    setCommentsError('');
    try {
      await hideListingCommentAsAdmin(commentId);
      setCommentInfo('Yorum gizlendi.');
      await loadComments();
    } catch (error) {
      setCommentsError(error instanceof Error ? error.message : 'Yorum gizlenemedi.');
    }
  }

  function renderCommentItem(comment: ListingComment, depth = 0): React.JSX.Element {
    const canReply = comment.status === 'active';
    const canDelete = comment.isMine && comment.status === 'active';
    const canHide = isAdmin && comment.status === 'active';
    const canReport = user && comment.status === 'active';
    const replyDraft = replyDrafts[comment.id] ?? '';

    return (
      <View key={comment.id} style={{ marginLeft: depth * 16 }} className="mt-3 rounded-xl border border-[#33333315] bg-white p-3">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }}>{comment.authorName}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
              {new Date(comment.createdAt).toLocaleString('tr-TR')}
            </Text>
          </View>
          <View className="flex-row" style={{ gap: 10 }}>
            {canReply ? (
              <Pressable onPress={() => setReplyingTo((current) => current === comment.id ? null : comment.id)}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>Yanıtla</Text>
              </Pressable>
            ) : null}
            {canDelete ? (
              <Pressable onPress={() => handleDeleteComment(comment.id)}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.danger }}>Sil</Text>
              </Pressable>
            ) : null}
            {canHide ? (
              <Pressable onPress={() => handleHideComment(comment.id)}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.accent }}>Gizle</Text>
              </Pressable>
            ) : null}
            {canReport ? (
              <Pressable onPress={() => openReportModal('comment', comment.id)}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.danger }}>Şikayet Et</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: comment.status === 'active' ? colors.textSecondary : colors.textMuted, marginTop: 8, lineHeight: 19 }}>
          {formatCommentStatus(comment)}
        </Text>

        {replyingTo === comment.id ? (
          <View className="mt-3 rounded-xl bg-[#F8FAFC] p-3">
            <TextInput
              value={replyDraft}
              onChangeText={(value) => setReplyDrafts((current) => ({ ...current, [comment.id]: value }))}
              placeholder="Yanıtını yaz..."
              placeholderTextColor={colors.textMuted}
              multiline
              style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary, minHeight: 52 }}
            />
            <View className="mt-3 flex-row justify-end" style={{ gap: 8 }}>
              <Pressable onPress={() => setReplyingTo(null)} className="rounded-xl border border-[#D1D5DB] px-3 py-2">
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>Vazgeç</Text>
              </Pressable>
              <Pressable onPress={() => handleSubmitComment(comment.id)} className="rounded-xl bg-[#111827] px-3 py-2">
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>Yanıtı Gönder</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {comment.replies.length > 0 ? comment.replies.map((reply) => renderCommentItem(reply, depth + 1)) : null}
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Floating header */}
      <View className="absolute top-12 left-0 right-0 z-10 flex-row items-center justify-between px-3">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 bg-white/95 rounded-full items-center justify-center shadow-sm"
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <View className="flex-row gap-2">
          <Pressable onPress={shareProduct} className="w-10 h-10 bg-white/95 rounded-full items-center justify-center shadow-sm">
            <Ionicons name="share-outline" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Image */}
        <View className="bg-[#E5E7EB] relative" style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.2, justifyContent: 'center', alignItems: 'center' }}>
          {selectedMediaUri ? (
            <Image
              source={{ uri: selectedMediaUri }}
              style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.2 }}
              resizeMode="cover"
            />
          ) : (
            <Text
              style={{
                fontFamily: fonts.headingBold,
                fontSize: 56,
                color: '#D1D5DB',
                transform: [{ rotate: '-45deg' }],
                textAlign: 'center',
              }}
            >
              {product.brand}
            </Text>
          )}
          {selectedMediaIsVideo ? (
            <View className="absolute inset-0 items-center justify-center bg-black/20">
              <Ionicons name="play-circle" size={56} color="#fff" />
            </View>
          ) : null}
          {product.discount ? (
            <View
              style={{ backgroundColor: colors.danger }}
              className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md"
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>
                -{product.discount}%
              </Text>
            </View>
          ) : null}
          {mediaUris.length > 1 ? (
            <View className="absolute top-3 right-3 rounded-full bg-black/65 px-2.5 py-1 flex-row items-center">
              <Ionicons name="images-outline" size={12} color="#fff" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff', marginLeft: 4 }}>
                {mediaUris.length}
              </Text>
            </View>
          ) : null}
        </View>

        {mediaUris.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}
          >
            {mediaUris.map((uri) => {
              const active = selectedMediaUri === uri;
              const isVideo = isVideoUri(uri);

              return (
                <Pressable
                  key={uri}
                  onPress={() => setSelectedMediaUri(uri)}
                  style={{
                    width: 72,
                    height: 88,
                    borderRadius: 12,
                    overflow: 'hidden',
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? colors.primary : '#D1D5DB',
                    backgroundColor: '#F3F4F6',
                  }}
                >
                  <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  {isVideo ? (
                    <View className="absolute inset-0 items-center justify-center bg-black/25">
                      <Ionicons name="play-circle" size={20} color="#fff" />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <InfoBanner
          icon="information-circle"
          title="Bu bir P2P Pazaryeri"
          description="Doğrudan satıcıyla iletişim kurarak ürünü satın alabilirsiniz. İletişim bölümünden mesaj gönderin veya WhatsApp ile bağlantı kurun."
          dismissible
          variant="info"
        />

        <View className="px-4 pt-3 pb-4">
          {/* Brand & title */}
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Pressable onPress={openProductStore}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>
                  {product.brand} ›
                </Text>
              </Pressable>
              <Text
                style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, marginTop: 4 }}
              >
                {product.title}
              </Text>
              <View className="mt-2 flex-row" style={{ gap: 12 }}>
                <Pressable onPress={() => openReportModal('listing', product.id)}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.danger }}>
                    İlanı Şikayet Et
                  </Text>
                </Pressable>
                {product.sellerId ? (
                  <Pressable onPress={() => openReportModal('user', product.sellerId ?? '')}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.danger }}>
                      Satıcıyı Şikayet Et
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
            <Pressable
              onPress={handleToggleFavorite}
              className="w-10 h-10 rounded-full items-center justify-center border border-[#33333322]"
            >
              <Ionicons
                name={favorited ? 'heart' : 'heart-outline'}
                size={20}
                color={favorited ? colors.primary : colors.textPrimary}
              />
            </Pressable>
          </View>

          {/* Live engagement */}
          <View className="flex-row items-center mt-3">
            <View className="flex-row items-center bg-[#F7F7F7] rounded-lg px-2 py-1">
              <Ionicons name="chatbubble-outline" size={13} color={colors.primary} />
              <Text
                style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}
                className="ml-1"
              >
                {formatEngagementCount(commentCount)}
              </Text>
            </View>
            <Text
              style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}
              className="ml-2"
            >
canlı yorum
            </Text>
            <View className="flex-1" />
            <View className="flex-row items-center">
              <Ionicons name="heart" size={13} color={colors.accent} />
              <Text
                style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}
                className="ml-1"
              >
{formatEngagementCount(favoriteCount)} beğeni
              </Text>
            </View>
          </View>

          {/* Price */}
          <View className="mt-4">
            {product.originalPrice && product.price > 0 ? (
              <View className="flex-row items-center">
                <Text
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 13,
                    color: colors.textMuted,
                    textDecorationLine: 'line-through',
                  }}
                >
                  ₺{product.originalPrice.toFixed(2)}
                </Text>
                <View
                  style={{ backgroundColor: '#00A86222' }}
                  className="ml-2 px-2 py-0.5 rounded flex-row items-center"
                >
                  <Ionicons name="arrow-down" size={11} color={colors.success} />
            <Text
              style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.success }}
              className="ml-0.5"
            >
%{product.discount} indirilli
            </Text>
                </View>
              </View>
            ) : null}
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 26, color: colors.primary, marginTop: 2 }}>
              {product.price > 0 ? `₺${product.price.toFixed(2)}` : 'Fiyat Sor'}
            </Text>
            <Text
              style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}
              className="mt-1"
            >
Ödeme ve kargo detayları için satıcıyla iletişime geçin.
            </Text>
            <View className="mt-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2.5">
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.primary, lineHeight: 17 }}>
                Bu platform yalnızca alıcı ve satıcıyı buluşturur.
                {'\n'}Ödeme ve teslimat taraflar arasında gerçekleşir.
              </Text>
            </View>
            <View className="flex-row items-center mt-3">
              <View
                style={{ backgroundColor: '#EFF6FF' }}
                className="px-2.5 py-1 rounded-full"
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary }}>
                  Durum satıcı beyanına göredir
                </Text>
              </View>
              {product.condition ? (
                <View className="ml-2 px-2.5 py-1 rounded-full bg-[#EFF6FF]">
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary }}>
                    {product.condition}
                  </Text>
                </View>
              ) : null}
            </View>
            {product.location ? (
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }} className="mt-3">
                {product.location}{product.district ? ` / ${product.district}` : ''}
              </Text>
            ) : null}
          </View>

          {/* Sizes */}
          <View className="mt-5">
            <View className="flex-row items-center justify-between mb-2">
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 14, color: colors.textPrimary }}>
Beden Seç
              </Text>
              <Pressable onPress={() => router.push('/size-table')}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>
                  Tablo
                </Text>
              </Pressable>
            </View>
            <View className="flex-row" style={{ gap: 8 }}>
              {sizeOptions.map((s) => {
                const active = selectedSize === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => setSelectedSize(s)}
                    style={{
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primary + '11' : '#fff',
                      minWidth: 48,
                    }}
                    className="h-11 px-3 rounded-xl border items-center justify-center"
                  >
                    <Text
                      style={{
                        fontFamily: active ? fonts.bold : fonts.medium,
                        fontSize: 13,
                        color: active ? colors.primary : colors.textPrimary,
                      }}
                    >
                      {s}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {product.availableColors?.length ? (
            <View className="mt-5">
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 14, color: colors.textPrimary }} className="mb-2">
                Renk Seç
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {product.availableColors.map((color) => {
                  const active = selectedColor === color;
                  return (
                    <Pressable
                      key={color}
                      onPress={() => setSelectedColor(color)}
                      style={{
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primary + '11' : '#fff',
                      }}
                      className="h-11 px-4 rounded-xl border items-center justify-center"
                    >
                      <Text
                        style={{
                          fontFamily: active ? fonts.bold : fonts.medium,
                          fontSize: 13,
                          color: active ? colors.primary : colors.textPrimary,
                        }}
                      >
                        {color}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Seller */}
          <View className="mt-5 p-3 rounded-xl border border-[#33333315]">
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-lg bg-[#F7F7F7] items-center justify-center">
                <Ionicons name="storefront" size={18} color={colors.primary} />
              </View>
              <View className="flex-1 ml-3">
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>
{product.brand} Mağaza
                </Text>
                <View className="flex-row items-center mt-0.5">
                  <Ionicons name="star" size={11} color={colors.primary} />
                  <Text
                    style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary }}
                    className="ml-1"
                  >
4.8 puan
                  </Text>
                </View>
              </View>
              <Pressable onPress={openProductStore}>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            <View className="flex-row gap-2 mt-3">
              <Pressable
                onPress={handleSendMessage}
                style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
                className="flex-1 h-10 rounded-xl border items-center justify-center flex-row"
              >
                <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.primary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }} className="ml-1.5">
                  Satıcıya Mesaj Gönder
                </Text>
              </Pressable>
              {contactWhatsapp ? (
                <Pressable
                  onPress={openWhatsApp}
                  style={{ backgroundColor: '#ECFDF5', borderColor: '#BBF7D0' }}
                  className="flex-1 h-10 rounded-xl border items-center justify-center flex-row"
                >
                  <Ionicons name="logo-whatsapp" size={16} color="#166534" />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#166534' }} className="ml-1.5">
                    WhatsApp
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Description */}
          <View className="mt-5">
            <Text
              style={{ fontFamily: fonts.headingBold, fontSize: 14, color: colors.textPrimary }}
              className="mb-2"
            >
Ürün Açıklaması
            </Text>
            <Text
              style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 20 }}
            >
              {product.description || `Yüksek kaliteli malzeme ile üretime sunulmuş ${product.title.toLowerCase()}. Günlük kullanım için uygun, rahat ve özenli bir ürün.`}
            </Text>
            {product.attributes?.length ? (
              <View className="mt-4 gap-2">
                {product.attributes.map((item) => (
                  <View key={`${item.label}-${item.value}`} className="flex-row items-center justify-between rounded-xl bg-[#F8FAFC] px-3 py-2">
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>
                      {item.label}
                    </Text>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }}>
                      {item.value}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 10 }}>
              {contactWhatsapp
                ? 'Bu ilanda uygulama içi mesaj ve isteğe bağlı WhatsApp iletişimi aktif.'
                : 'Bu ilanda uygulama içi mesajlaşma aktif.'}
            </Text>
          </View>

          <View className="mt-6">
            <View className="flex-row items-center justify-between">
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 15, color: colors.textPrimary }}>
                Yorumlar
              </Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>
                {commentCount} aktif yorum
              </Text>
            </View>

            <View className="mt-3 rounded-2xl border border-[#33333315] bg-[#F8FAFC] p-3">
              {!user ? (
                <Pressable onPress={() => router.push('/auth')} className="rounded-xl bg-[#111827] px-4 py-3 items-center justify-center">
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>Yorum yapmak için giriş yap</Text>
                </Pressable>
              ) : isCommentBlocked ? (
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.danger }}>
                  Yorum yapma yetkiniz geçici olarak kapatılmış.
                </Text>
              ) : (
                <>
                  <TextInput
                    value={commentBody}
                    onChangeText={setCommentBody}
                    placeholder="İlan hakkında yorumunu yaz..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary, minHeight: 68 }}
                  />
                  <View className="mt-3 flex-row items-center justify-between">
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted }}>
                      Küfür ve yasaklı ifadeler otomatik engellenir.
                    </Text>
                    <Pressable onPress={() => handleSubmitComment(null)} className="rounded-xl bg-[#111827] px-4 py-2.5">
                      {commentSubmitting ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>Gönder</Text>
                      )}
                    </Pressable>
                  </View>
                </>
              )}

              {commentInfo ? (
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.success, marginTop: 10 }}>
                  {commentInfo}
                </Text>
              ) : null}
              {commentsError ? (
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.danger, marginTop: 10 }}>
                  {commentsError}
                </Text>
              ) : null}
            </View>

            {commentsLoading ? (
              <View className="mt-4 items-center justify-center">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : comments.length > 0 ? (
              <View className="mt-1">
                {comments.map((comment) => renderCommentItem(comment))}
              </View>
            ) : (
              <View className="mt-4 rounded-xl border border-dashed border-[#D1D5DB] px-4 py-5 items-center">
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>
                  Henüz yorum yok. İlk yorumu sen yaz.
                </Text>
              </View>
            )}
          </View>

          <View className="h-24" />
        </View>
      </ScrollView>

      <Modal
        visible={reportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View className="flex-1 bg-black/40 items-center justify-center px-4">
          <View className="w-full rounded-2xl bg-white p-4">
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: colors.textPrimary }}>
              {REPORT_TARGET_LABEL[reportTargetType]} Şikayet Et
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
              Uygun nedeni seç ve gerekirse kısa bir açıklama ekle.
            </Text>

            <View className="mt-3 flex-row flex-wrap" style={{ gap: 8 }}>
              {REPORT_REASON_OPTIONS[reportTargetType].map((reason) => {
                const active = reason === reportReason;
                return (
                  <Pressable
                    key={reason}
                    onPress={() => setReportReason(reason)}
                    style={{
                      borderColor: active ? colors.danger : '#D1D5DB',
                      backgroundColor: active ? '#FEE2E2' : '#fff',
                    }}
                    className="rounded-full border px-3 py-1.5"
                  >
                    <Text
                      style={{
                        fontFamily: active ? fonts.bold : fonts.medium,
                        fontSize: 11,
                        color: active ? '#991B1B' : colors.textSecondary,
                      }}
                    >
                      {reason}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={reportDescription}
              onChangeText={setReportDescription}
              placeholder="Açıklama (isteğe bağlı, max 1000 karakter)"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={1000}
              style={{
                marginTop: 12,
                minHeight: 84,
                borderWidth: 1,
                borderColor: '#D1D5DB',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontFamily: fonts.regular,
                fontSize: 13,
                color: colors.textPrimary,
              }}
            />

            {reportMessage ? (
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.danger, marginTop: 10 }}>
                {reportMessage}
              </Text>
            ) : null}

            <View className="mt-4 flex-row justify-end" style={{ gap: 8 }}>
              <Pressable onPress={() => setReportModalVisible(false)} className="rounded-xl border border-[#D1D5DB] px-4 py-2.5">
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>Vazgeç</Text>
              </Pressable>
              <Pressable onPress={handleSubmitReport} className="rounded-xl bg-[#991B1B] px-4 py-2.5">
                {reportSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>Şikayeti Gönder</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sticky action bar */}
      <View
        style={{ borderTopColor: colors.borderLight }}
        className="absolute bottom-0 left-0 right-0 bg-white border-t px-4 py-3 flex-row gap-2"
      >
        <Pressable
          onPress={handleSendMessage}
          style={{ backgroundColor: colors.primary }}
          className="flex-1 h-12 rounded-xl items-center justify-center active:opacity-90"
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>
            Satıcıya Mesaj Gönder
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
