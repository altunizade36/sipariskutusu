import { Linking, View, Text, ScrollView, Pressable, Image, Dimensions, Share, TextInput, ActivityIndicator, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ProductImagePlaceholder } from '../../src/components/ProductImagePlaceholder';
import { useRecentlyViewed } from '../../src/hooks/useRecentlyViewed';
import { captureError, trackEvent } from '../../src/services/monitoring';
import { TELEMETRY_EVENTS } from '../../src/constants/telemetryEvents';
import { fetchStoreFollowState, followStore, unfollowStore } from '../../src/services/storeFollowService';
import { dispatchFollowNotification } from '../../src/services/notificationDispatchService';
import { MARKETPLACE_CATEGORIES } from '../../src/constants/marketplaceCategories';

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

function CommentSkeletonList() {
  return (
    <View className="mt-3" style={{ gap: 10 }}>
      {[0, 1, 2].map((item) => (
        <View key={`comment-skeleton-${item}`} className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-3">
          <View className="h-3 w-24 rounded bg-[#E5E7EB]" />
          <View className="mt-2 h-3 w-full rounded bg-[#E5E7EB]" />
          <View className="mt-1.5 h-3 w-4/5 rounded bg-[#E5E7EB]" />
        </View>
      ))}
    </View>
  );
}

function SimilarListingsSkeletonRow() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
    >
      {[0, 1, 2, 3].map((item) => (
        <View
          key={`similar-skeleton-${item}`}
          style={{ width: 130 }}
          className="rounded-xl overflow-hidden border border-[#33333312] bg-white"
        >
          <View style={{ width: 130, height: 130, backgroundColor: '#E5E7EB' }} />
          <View className="px-2 py-2">
            <View className="h-3 w-full rounded bg-[#E5E7EB]" />
            <View className="mt-1.5 h-3 w-3/5 rounded bg-[#E5E7EB]" />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, isDarkMode } = useAuth();
  const { allProducts } = useListings();
  const { checkFavorited, toggle: toggleFav } = useFavorites();
  const recentlyViewed = useRecentlyViewed();
  const localProduct = allProducts.find((p) => p.id === id) ?? allProducts[0];

  // Similar listings: same category, different product
  const similarListings = useMemo(() => {
    return allProducts
      .filter((p) => p.id !== id && p.category === localProduct?.category && p.id !== undefined)
      .slice(0, 8);
  }, [allProducts, id, localProduct?.category]);
  const [product, setProduct] = useState<Product>(
    localProduct,
  );
  const [selectedSize, setSelectedSize] = useState(product.availableSizes?.[0] ?? '');
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
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [storeFollowed, setStoreFollowed] = useState(false);
  const [storeFollowerCount, setStoreFollowerCount] = useState(0);
  const [storeFollowLoading, setStoreFollowLoading] = useState(false);
  const contactWhatsapp = product.whatsapp || '';
  const mediaUris = getOrderedMediaUris(product);
  const selectedMediaIsVideo = isVideoUri(selectedMediaUri);
  const shouldShowSimilarSkeleton = allProducts.length === 0;
  const storeProductCount = useMemo(
    () => allProducts.filter((p) => p.sellerId === product.sellerId && p.id !== product.id).length,
    [allProducts, product.sellerId, product.id],
  );

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
    setSelectedSize(product.availableSizes?.[0] ?? '');
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
      recentlyViewed.add({
        id: product.id,
        title: product.title,
        imageUri: resolveMediaCover(product),
        price: product.price,
      });
      trackEvent(TELEMETRY_EVENTS.PRODUCT_VIEWED, {
        product_id: product.id,
        title: product.title ?? null,
        price: product.price ?? null,
        seller_id: (product as any).sellerId ?? null,
        category: product.category ?? null,
        source: 'product_detail',
      });
    }, [id, product.id, product.title, product.price, recentlyViewed]);

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

  useEffect(() => {
    if (!product.storeId || !user || !isSupabaseConfigured) return;
    fetchStoreFollowState(product.storeId)
      .then(({ isFollowing, followerCount }) => {
        setStoreFollowed(isFollowing);
        setStoreFollowerCount(followerCount);
      })
      .catch(() => undefined);
  }, [product.storeId, user?.id]);

  const handleToggleStoreFollow = useCallback(async () => {
    if (!user) { router.push('/auth'); return; }
    if (!product.storeId) return;
    if (storeFollowLoading) return;
    setStoreFollowLoading(true);
    try {
      if (storeFollowed) {
        await unfollowStore(product.storeId);
        setStoreFollowed(false);
        setStoreFollowerCount((c) => Math.max(c - 1, 0));
      } else {
        await followStore(product.storeId);
        setStoreFollowed(true);
        setStoreFollowerCount((c) => c + 1);
        dispatchFollowNotification(product.sellerId ?? '', product.brand || 'Mağaza').catch(() => undefined);
      }
    } catch {
      // silently fail
    } finally {
      setStoreFollowLoading(false);
    }
  }, [user, product.storeId, product.sellerId, product.brand, storeFollowed, storeFollowLoading, router]);

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

    if (user.id === product.sellerId) {
      Alert.alert('Bilgi', 'Kendi ilanınıza mesaj gönderemezsiniz.');
      return;
    }

    const autoMessage = `Merhaba, bu ürün hakkında bilgi almak istiyorum: ${product.title}`;

    if (isSupabaseConfigured && !user.id.startsWith('demo-')) {
      try {
        const conversation = await getOrCreateConversationForListing(user.id, product.sellerId, product.id);
        const isNew = !conversation.updated_at || conversation.created_at === conversation.updated_at;
        router.push(buildConversationMessagesRoute(conversation.id, isNew ? autoMessage : undefined));
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
      initialMessage: autoMessage,
    }));
  }

  function handleStartOrderDraft() {
    if (!product.sellerId) {
      Alert.alert('Satıcı bilgisi eksik', 'Gorusme baslatmak icin satıcı bilgisi bulunamadı.');
      return;
    }

    const query = `/cart?sellerId=${encodeURIComponent(product.sellerId)}&productId=${encodeURIComponent(product.id)}&title=${encodeURIComponent(product.title)}&price=${encodeURIComponent(String(product.price || 0))}&brand=${encodeURIComponent(product.brand || '')}&whatsapp=${encodeURIComponent(contactWhatsapp || '')}`;
    router.push(query as never);
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
      trackEvent(TELEMETRY_EVENTS.LISTING_COMMENT_SUBMITTED, {
        source: 'product_detail_comments',
        listing_id: product.id,
        parent_id: parentId ?? null,
        is_reply: Boolean(parentId),
        comment_length: draft.trim().length,
      });
      if (product.sellerId && product.sellerId !== user?.id) {
        import('../../src/services/notificationDispatchService')
          .then(({ dispatchFavoriteNotification }) => dispatchFavoriteNotification(product.id))
          .catch(() => undefined);
      }
      if (parentId) {
        setReplyDrafts((current) => ({ ...current, [parentId]: '' }));
        setReplyingTo(null);
      } else {
        setCommentBody('');
      }
      setCommentInfo('Yorum gönderildi.');
      await loadComments();
    } catch (error) {
      captureError(error, {
        scope: 'product_detail_comment_submit',
        source: 'product_detail_comments',
        listingId: product.id,
        hasParentId: Boolean(parentId),
      });
      setCommentsError(error instanceof Error ? error.message : 'Yorum gönderilemedi.');
    } finally {
      setCommentSubmitting(false);
    }
  }

  function handlePressSimilarListing(similarListingId: string, index: number) {
    trackEvent(TELEMETRY_EVENTS.SIMILAR_LISTING_CLICKED, {
      source: 'product_detail_similar_listings',
      source_listing_id: product.id,
      target_listing_id: similarListingId,
      position: index,
    });
    router.push(`/product/${similarListingId}` as never);
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

  const pal = {
    bg: isDarkMode ? '#0F172A' : '#FFFFFF',
    card: isDarkMode ? '#111827' : '#FFFFFF',
    border: isDarkMode ? '#334155' : '#E5E7EB',
    subBg: isDarkMode ? '#1E293B' : '#F8FAFC',
    textPrimary: isDarkMode ? '#E5E7EB' : colors.textPrimary,
    textSecondary: isDarkMode ? '#94A3B8' : colors.textSecondary,
    textMuted: isDarkMode ? '#64748B' : colors.textMuted,
    infoBg: isDarkMode ? '#1E3A8A22' : '#EFF6FF',
    infoBorder: isDarkMode ? '#1E40AF' : '#BFDBFE',
    infoText: isDarkMode ? '#93C5FD' : colors.primary,
    commentBg: isDarkMode ? '#1E293B' : '#F8FAFC',
    commentBorder: isDarkMode ? '#334155' : '#33333315',
    similarBg: isDarkMode ? '#111827' : '#FFFFFF',
    similarBorder: isDarkMode ? '#1E293B' : '#33333312',
    storeBg: isDarkMode ? '#111827' : '#FFFFFF',
    storeBorder: isDarkMode ? '#334155' : '#33333315',
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: pal.bg }} edges={['top']}>
      {/* Floating header */}
      <View style={{ position: 'absolute', top: 48, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }}>
        <Pressable
          onPress={() => router.back()}
          style={{ width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={handleToggleFavorite}
            style={{ width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name={favorited ? 'heart' : 'heart-outline'} size={20} color={favorited ? '#EF4444' : colors.textPrimary} />
          </Pressable>
          <Pressable
            onPress={shareProduct}
            style={{ width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="share-outline" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Image Carousel */}
        <View style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.1, backgroundColor: '#F1F5F9', overflow: 'hidden' }}>
          {mediaUris.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setCurrentImageIndex(idx);
              }}
              style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.1 }}
            >
              {mediaUris.map((uri, i) => (
                <View key={`${uri}-${i}`} style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.1 }}>
                  <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  {isVideoUri(uri) ? (
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                      <Ionicons name="play-circle" size={56} color="#fff" />
                    </View>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          ) : (
            <ProductImagePlaceholder size="full" style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.1 }} />
          )}

          {/* Dot indicators */}
          {mediaUris.length > 1 ? (
            <View style={{ position: 'absolute', bottom: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 }}>
              {mediaUris.map((_, i) => (
                <View
                  key={`dot-${i}`}
                  style={{
                    width: i === currentImageIndex ? 20 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i === currentImageIndex ? '#fff' : 'rgba(255,255,255,0.5)',
                  }}
                />
              ))}
            </View>
          ) : null}

          {/* Discount badge */}
          {product.discount ? (
            <View style={{ position: 'absolute', bottom: 14, left: 14, backgroundColor: colors.danger, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>-%{product.discount}</Text>
            </View>
          ) : null}

          {/* Image count */}
          {mediaUris.length > 1 ? (
            <View style={{ position: 'absolute', top: 14, right: 14, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>{currentImageIndex + 1}/{mediaUris.length}</Text>
            </View>
          ) : null}
        </View>

        {product.isDemo ? (
          <View style={{ marginHorizontal: 12, marginTop: 10, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <Ionicons name="information-circle" size={20} color="#D97706" style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#92400E', marginBottom: 3 }}>Bu bir örnek ilandır</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: '#78350F', lineHeight: 18 }}>
                Bu ilan yeni kullanıcılar için platformun nasıl çalıştığını göstermek amacıyla oluşturulmuştur. Gerçek bir satış söz konusu değildir. Kendi ilanınızı vermek için "İlan Ver" butonuna tıklayın.
              </Text>
            </View>
          </View>
        ) : (
          <InfoBanner
            icon="information-circle"
            title="Bu bir P2P Pazaryeri"
            description="Doğrudan satıcıyla iletişim kurarak ürünü satın alabilirsiniz. İletişim bölümünden mesaj gönderin veya WhatsApp ile bağlantı kurun."
            dismissible
            variant="info"
          />
        )}

        <View className="px-4 pt-3 pb-4">
          {/* Brand & title */}
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Pressable onPress={openProductStore}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>
                  {product.brand} ›
                </Text>
              </Pressable>
              <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: pal.textPrimary, marginTop: 4 }}>
                {product.title}
              </Text>
              <View style={{ marginTop: 8, flexDirection: 'row', gap: 12 }}>
                <Pressable onPress={() => openReportModal('listing', product.id)}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.danger }}>İlanı Şikayet Et</Text>
                </Pressable>
                {product.sellerId ? (
                  <Pressable onPress={() => openReportModal('user', product.sellerId ?? '')}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.danger }}>Satıcıyı Şikayet Et</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>

          {/* Live engagement */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: pal.subBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Ionicons name="chatbubble-outline" size={13} color={colors.primary} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: pal.textPrimary, marginLeft: 4 }}>
                {formatEngagementCount(commentCount)}
              </Text>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.textSecondary, marginLeft: 6 }}>
              canlı yorum
            </Text>
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="heart" size={13} color={colors.accent} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: pal.textSecondary, marginLeft: 4 }}>
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
Ödeme ve teslimat detayları için satıcıyla doğrudan iletişime geçin.
            </Text>
            {/* Güven bloğu */}
            <View style={{ marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: isDarkMode ? '#1E3A5F22' : '#EFF6FF', padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <Ionicons name="shield-checkmark-outline" size={15} color={colors.primary} style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary, lineHeight: 16 }}>
                    Bu platform alıcı ve satıcıyı buluşturur.
                  </Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: pal.textSecondary, lineHeight: 16, marginTop: 2 }}>
                    Ödeme ve teslimat taraflar arasında gerçekleşir. Platform dışı ödeme yaparken dikkatli olun.
                  </Text>
                </View>
              </View>
            </View>

            {/* Ürün bilgisi çipleri */}
            {(() => {
              const categoryLabel = MARKETPLACE_CATEGORIES.find((c) => c.id === product.category)?.name;
              const chips: { icon: string; label: string; color?: string; bg?: string }[] = [];
              if (product.condition) chips.push({ icon: 'pricetag-outline', label: product.condition });
              if (product.isNegotiable) chips.push({ icon: 'git-compare-outline', label: 'Pazarlık Var', color: '#059669', bg: '#ECFDF5' });
              if (typeof product.stock === 'number' && product.stock > 0) {
                chips.push({
                  icon: 'cube-outline',
                  label: product.stock > 10 ? 'Stokta Var' : `${product.stock} adet kaldı`,
                  color: product.stock <= 3 ? '#DC2626' : '#059669',
                  bg: product.stock <= 3 ? '#FEF2F2' : '#ECFDF5',
                });
              }
              if (product.delivery?.length) chips.push({ icon: 'car-outline', label: product.delivery.join(' / ') });
              if (categoryLabel) chips.push({ icon: 'grid-outline', label: categoryLabel });
              return chips.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  {chips.map((chip) => (
                    <View
                      key={chip.label}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 20,
                        backgroundColor: chip.bg ?? (isDarkMode ? '#1E3A5F' : '#EFF6FF'),
                        borderWidth: 1,
                        borderColor: chip.bg ? chip.bg : (isDarkMode ? colors.primary + '30' : '#BFDBFE'),
                      }}
                    >
                      <Ionicons name={chip.icon as any} size={11} color={chip.color ?? colors.primary} />
                      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: chip.color ?? colors.primary }}>
                        {chip.label}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null;
            })()}

            {/* Konum & Tarih */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12, flexWrap: 'wrap' }}>
              {product.location ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="location-outline" size={12} color={pal.textMuted} />
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: pal.textSecondary }}>
                    {product.location}{product.district ? ` / ${product.district}` : ''}
                  </Text>
                </View>
              ) : null}
              {product.createdAt ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="calendar-outline" size={12} color={pal.textMuted} />
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.textSecondary }}>
                    {new Date(product.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {product.availableSizes?.length ? (
            <View style={{ marginTop: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 14, color: pal.textPrimary }}>Beden Seç</Text>
                <Pressable onPress={() => router.push('/size-table')}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>Tablo</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {product.availableSizes.map((s) => {
                  const active = selectedSize === s;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => setSelectedSize(s)}
                      style={{
                        borderColor: active ? colors.primary : pal.border,
                        backgroundColor: active ? colors.primary + '18' : pal.card,
                        minWidth: 48,
                        height: 44,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontFamily: active ? fonts.bold : fonts.medium, fontSize: 13, color: active ? colors.primary : pal.textPrimary }}>
                        {s}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {product.availableColors?.length ? (
            <View style={{ marginTop: 20 }}>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 14, color: pal.textPrimary, marginBottom: 8 }}>Renk Seç</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {product.availableColors.map((color) => {
                  const active = selectedColor === color;
                  return (
                    <Pressable
                      key={color}
                      onPress={() => setSelectedColor(color)}
                      style={{
                        borderColor: active ? colors.primary : pal.border,
                        backgroundColor: active ? colors.primary + '18' : pal.card,
                        borderWidth: 1,
                        height: 44,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontFamily: active ? fonts.bold : fonts.medium, fontSize: 13, color: active ? colors.primary : pal.textPrimary }}>
                        {color}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Mağaza Kartı */}
          <View style={{ marginTop: 20, backgroundColor: pal.storeBg, borderRadius: 20, borderWidth: 1, borderColor: pal.storeBorder, padding: 16 }}>
            {/* Üst: avatar + isim + mağazaya git */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable onPress={openProductStore}>
                <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: isDarkMode ? '#1E3A5F' : '#EFF6FF', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.primary + '30' }}>
                  <Ionicons name="storefront" size={26} color={colors.primary} />
                </View>
              </Pressable>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Pressable onPress={openProductStore}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: pal.textPrimary }} numberOfLines={1}>
                    {product.brand || 'Satıcı'}
                  </Text>
                </Pressable>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 6, flexWrap: 'wrap' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Ionicons name="star" size={12} color="#F59E0B" />
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: pal.textSecondary }}>4.8</Text>
                  </View>
                  <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: pal.textMuted }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Ionicons name="people-outline" size={12} color={pal.textMuted} />
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.textSecondary }}>
                      {storeFollowerCount > 0 ? `${storeFollowerCount} takipçi` : 'Onaylı Satıcı'}
                    </Text>
                  </View>
                  {storeProductCount > 0 ? (
                    <>
                      <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: pal.textMuted }} />
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.textSecondary }}>
                        {storeProductCount} ürün
                      </Text>
                    </>
                  ) : null}
                </View>
              </View>
              <Pressable
                onPress={openProductStore}
                style={{ backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>Mağazaya Git</Text>
              </Pressable>
            </View>

            {/* Takip et butonu */}
            {product.storeId ? (
              <Pressable
                onPress={handleToggleStoreFollow}
                disabled={storeFollowLoading}
                style={{
                  marginTop: 12,
                  height: 40,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: storeFollowed ? colors.primary : pal.border,
                  backgroundColor: storeFollowed ? colors.primary + '12' : pal.card,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  opacity: storeFollowLoading ? 0.6 : 1,
                }}
              >
                <Ionicons
                  name={storeFollowed ? 'checkmark-circle' : 'add-circle-outline'}
                  size={17}
                  color={storeFollowed ? colors.primary : pal.textSecondary}
                />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: storeFollowed ? colors.primary : pal.textSecondary }}>
                  {storeFollowLoading ? 'İşleniyor...' : storeFollowed ? 'Takip Ediliyor' : 'Takip Et'}
                </Text>
              </Pressable>
            ) : null}

            <View style={{ height: 1, backgroundColor: pal.storeBorder, marginVertical: 14 }} />

            {product.isDemo ? (
              <View style={{ height: 48, backgroundColor: isDarkMode ? '#2D2506' : '#FEF9C3', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Ionicons name="lock-closed-outline" size={16} color="#D97706" />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#D97706' }}>Örnek ilan — iletişim kapalı</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={handleSendMessage}
                  style={{ flex: 1, height: 44, backgroundColor: isDarkMode ? '#1E3A5F' : '#EFF6FF', borderWidth: 1, borderColor: isDarkMode ? colors.primary + '50' : '#BFDBFE', borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <Ionicons name="chatbox-ellipses-outline" size={17} color={colors.primary} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>Mesaj Gönder</Text>
                </Pressable>
                {contactWhatsapp ? (
                  <Pressable
                    onPress={openWhatsApp}
                    style={{ flex: 1, height: 44, backgroundColor: isDarkMode ? '#14532D22' : '#ECFDF5', borderWidth: 1, borderColor: isDarkMode ? '#166534' : '#BBF7D0', borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <Ionicons name="logo-whatsapp" size={17} color="#16A34A" />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#16A34A' }}>WhatsApp</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>

          {/* Description */}
          <View style={{ marginTop: 20 }}>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 14, color: pal.textPrimary, marginBottom: 8 }}>
              Ürün Açıklaması
            </Text>
            {(() => {
              const fullDesc = product.description || `Yüksek kaliteli malzeme ile üretime sunulmuş ${product.title.toLowerCase()}. Günlük kullanım için uygun, rahat ve özenli bir ürün.`;
              const isLong = fullDesc.length > 200;
              return (
                <>
                  <Text
                    style={{ fontFamily: fonts.regular, fontSize: 13, color: pal.textSecondary, lineHeight: 20 }}
                    numberOfLines={descExpanded || !isLong ? undefined : 4}
                  >
                    {fullDesc}
                  </Text>
                  {isLong ? (
                    <Pressable onPress={() => setDescExpanded((v) => !v)} style={{ marginTop: 6 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }}>
                        {descExpanded ? 'Daha Az Göster ▲' : 'Devamını Oku ▼'}
                      </Text>
                    </Pressable>
                  ) : null}
                </>
              );
            })()}
            {product.attributes?.length ? (
              <View style={{ marginTop: 14, gap: 6 }}>
                {product.attributes.map((item) => (
                  <View key={`${item.label}-${item.value}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: pal.subBg, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: pal.textSecondary }}>{item.label}</Text>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: pal.textPrimary }}>{item.value}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: pal.textMuted, marginTop: 10 }}>
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
              {commentsError && !commentsError.toLowerCase().includes('session') && !commentsError.toLowerCase().includes('auth') ? (
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.danger, marginTop: 10 }}>
                  {commentsError}
                </Text>
              ) : null}
            </View>

            {commentsLoading ? (
              <CommentSkeletonList />
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

          {/* Benzer İlanlar - 2 sütunlu grid */}
          {similarListings.length > 0 || shouldShowSimilarSkeleton ? (
            <View style={{ marginTop: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 15, color: pal.textPrimary }}>
                  Benzer İlanlar
                </Text>
                {!shouldShowSimilarSkeleton ? (
                  <Pressable onPress={() => router.push('/(tabs)/categories')}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>Tümünü gör →</Text>
                  </Pressable>
                ) : null}
              </View>
              {shouldShowSimilarSkeleton ? (
                <SimilarListingsSkeletonRow />
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {similarListings.slice(0, 6).map((item, index) => {
                    const itemImageUri = resolveMediaCover(item);
                    const colWidth = (SCREEN_WIDTH - 32 - 10) / 2;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => handlePressSimilarListing(item.id, index)}
                        style={{ width: colWidth, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: pal.similarBorder, backgroundColor: pal.similarBg }}
                      >
                        {itemImageUri ? (
                          <Image source={{ uri: itemImageUri }} style={{ width: colWidth, height: colWidth * 0.9 }} resizeMode="cover" />
                        ) : (
                          <ProductImagePlaceholder size="card" style={{ width: colWidth, height: colWidth * 0.9 }} />
                        )}
                        <View style={{ padding: 8 }}>
                          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: pal.textPrimary, lineHeight: 17 }} numberOfLines={2}>
                            {item.title}
                          </Text>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary, marginTop: 3 }}>
                            ₺{item.price.toFixed(2)}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          ) : null}

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
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: pal.card, borderTopWidth: 1, borderTopColor: pal.border, paddingHorizontal: 16, paddingVertical: 10, paddingBottom: 18, flexDirection: 'row', gap: 10, alignItems: 'center' }}
      >
        <Pressable
          onPress={handleToggleFavorite}
          style={{ width: 48, height: 48, borderRadius: 14, borderWidth: 1, borderColor: favorited ? '#EF4444' : pal.border, backgroundColor: favorited ? '#FEE2E2' : pal.subBg, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name={favorited ? 'heart' : 'heart-outline'} size={22} color={favorited ? '#EF4444' : pal.textSecondary} />
        </Pressable>
        <Pressable
          onPress={handleSendMessage}
          style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
        >
          <Ionicons name="chatbox-ellipses-outline" size={19} color="#fff" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>
            Satıcıya Mesaj Gönder
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
