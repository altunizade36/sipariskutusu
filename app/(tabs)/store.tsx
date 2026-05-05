import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  Share,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, fonts } from '../../src/constants/theme';
import {
  discoverSellers,
  storeData,
} from '../../src/data/storeData';
import { fetchStoreBySellerIdOrKey } from '../../src/services/storeService';
import { FavoriteButton } from '../../src/components/FavoriteButton';
import { ProfileButton } from '../../src/components/ProfileButton';
import { RatingSummary } from '../../src/components/RatingSummary';
import { QuickStats } from '../../src/components/QuickStats';
import { useListings } from '../../src/context/ListingsContext';
import { useAuth } from '../../src/context/AuthContext';
import { useAndroidTabBackToHome } from '../../src/hooks/useAndroidTabBackToHome';
import { hasVideoMedia, resolveMediaCover } from '../../src/utils/media';
import { buildMessagesInboxRoute, buildSellerMessagesRoute } from '../../src/utils/messageRouting';
import { toggleFavorite, isFavorited } from '../../src/services/favoriteService';
import { addListingComment, fetchListingComments } from '../../src/services/listingCommentService';
import BoxMascot from '../../src/components/BoxMascot';
import { trackEvent } from '../../src/services/monitoring';
import { TELEMETRY_EVENTS } from '../../src/constants/telemetryEvents';

const { width } = Dimensions.get('window');
const GRID_ITEM = (width - 4) / 3;

type Tab = 'products' | 'stories' | 'about';

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function typeLabel(type: string) {
  if (type === 'campaign') return '📢 Kampanya';
  if (type === 'collection') return '🗂️ Koleksiyon';
  return '🛍️ Ürün';
}

export default function StoreScreen() {
  const router = useRouter();
  useAndroidTabBackToHome();
  const routeParams = useLocalSearchParams<{ name?: string | string[]; sellerId?: string | string[]; storeKey?: string | string[] }>();
  const name = Array.isArray(routeParams.name) ? routeParams.name[0] : routeParams.name;
  const sellerId = Array.isArray(routeParams.sellerId) ? routeParams.sellerId[0] : routeParams.sellerId;
  const storeKey = Array.isArray(routeParams.storeKey) ? routeParams.storeKey[0] : routeParams.storeKey;
  const [activeTab, setActiveTab] = useState<Tab>('products');
  const [activeReelId, setActiveReelId] = useState<string | null>(null);
  const [reelLikeCounts, setReelLikeCounts] = useState<Record<string, number>>({});
  const [reelLikedMap, setReelLikedMap] = useState<Record<string, boolean>>({});
  const [reelCommentCounts, setReelCommentCounts] = useState<Record<string, number>>({});
  const [reelComments, setReelComments] = useState<Record<string, { author: string; text: string }[]>>({});
  const [reelCommentDraft, setReelCommentDraft] = useState('');
  const [reelLoading, setReelLoading] = useState(false);
  const [editingHighlightId, setEditingHighlightId] = useState<string | null>(null);
  const [highlightTitleDraft, setHighlightTitleDraft] = useState('');
  const [liveStoreData, setLiveStoreData] = useState<import('../../src/services/storeService').DiscoverStore | null>(null);
  const [isLoadingStore, setIsLoadingStore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user, isDarkMode } = useAuth();
  const {
    hasStore,
    sellerStore,
    canPublishAsSeller,
    sellerPublishReadiness,
    homeProducts,
    storeProducts,
    storePosts,
    storeHighlights,
    storeFollowersCount,
    storeFollowingCount,
    storeMessageCount,
    myStoryArchive,
    isFollowingStore,
    followedSellers,
    addStoryToHighlights,
    updateHighlightTitle,
    toggleFollowStore,
    toggleSellerFollow,
  } = useListings();

  const viewingOtherStore = Boolean((name ?? '').trim() || (storeKey ?? '').trim() || (sellerId ?? '').trim());
  const isOwnStoreView = !viewingOtherStore;
  const selectedDiscoverSeller = useMemo(
    () => discoverSellers.find((seller) => seller.id === storeKey || seller.name === name),
    [name, storeKey],
  );

  // Load real store data when viewing another store via sellerId or storeKey
  useEffect(() => {
    if (!viewingOtherStore) return;
    const lookupKey = (sellerId || storeKey || '').trim();
    if (!lookupKey) return;
    let cancelled = false;
    setIsLoadingStore(true);
    fetchStoreBySellerIdOrKey(lookupKey)
      .then((data) => { if (!cancelled && data) setLiveStoreData(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoadingStore(false); });
    return () => { cancelled = true; };
  }, [viewingOtherStore, sellerId, storeKey]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (viewingOtherStore) {
        const lookupKey = (sellerId || storeKey || '').trim();
        if (lookupKey) {
          const data = await fetchStoreBySellerIdOrKey(lookupKey).catch(() => null);
          if (data) setLiveStoreData(data);
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [viewingOtherStore, sellerId, storeKey]);

  useEffect(() => {
    if (!viewingOtherStore) return;
    const lookupKey = (sellerId || storeKey || '').trim();
    if (!lookupKey) return;
    trackEvent(TELEMETRY_EVENTS.STORE_VIEWED, {
      seller_id: lookupKey,
      store_name: typeof name === 'string' ? name : null,
      source: 'store_tab',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId, storeKey]);

  const otherStoreProducts = useMemo(
    () =>
      homeProducts.filter(
        (product) =>
          (sellerId && product.sellerId === sellerId) ||
          (selectedDiscoverSeller && (product.sellerId === selectedDiscoverSeller.id || product.brand === selectedDiscoverSeller.name)) ||
          product.brand === name,
      ),
    [homeProducts, name, selectedDiscoverSeller, sellerId],
  );

  const otherStorePosts = useMemo(
    () =>
      otherStoreProducts.slice(0, 10).map((product, index) => ({
        id: `post-${product.id}`,
        image: resolveMediaCover(product),
        title: product.title,
        date: new Date(Date.now() - index * 86400000).toISOString(),
        type: 'product' as const,
        likes: Math.max(20, (product.reviewCount ?? 0) * 7 + index * 9),
        comments: Math.max(3, Math.round((product.reviewCount ?? 10) * 0.18)),
        isVideo: hasVideoMedia(product),
        linkedProductId: product.id,
      })),
    [otherStoreProducts],
  );

  const otherStoreHighlights = useMemo(
    () =>
      otherStorePosts.slice(0, 6).map((post) => ({
        id: `highlight-${post.id}`,
        title: post.title,
        image: post.image,
        type: post.type,
        date: post.date,
        linkedPostId: post.id,
      })),
    [otherStorePosts],
  );

  // Prefer live Supabase data, fallback to static discover sellers, then defaults
  const resolvedOtherStore = liveStoreData ?? selectedDiscoverSeller ?? null;

  const currentStore = viewingOtherStore
    ? {
        ...storeData,
        id: resolvedOtherStore?.id || sellerId || (name ? `store-${name}` : storeData.id),
        name: resolvedOtherStore?.name || name || 'Mağaza',
        username: resolvedOtherStore?.username || `@${(name || 'magaza').replace(/\s+/g, '').toLowerCase()}`,
        avatar: resolvedOtherStore?.avatar || (otherStoreProducts[0] ? resolveMediaCover(otherStoreProducts[0]) : undefined) || storeData.avatar,
        coverImage: resolvedOtherStore?.coverImage || (otherStoreProducts[0] ? resolveMediaCover(otherStoreProducts[0]) : undefined) || storeData.coverImage,
        city: resolvedOtherStore?.city || storeData.city,
        followers: resolvedOtherStore?.followers || `${Math.max(1, otherStoreProducts.length * 3)}`,
        rating: resolvedOtherStore?.rating || 4.7,
        description: resolvedOtherStore?.headline || `${name || 'Bu mağaza'} vitrini ayrı ve bağımsız olarak yönetiliyor.`,
        productCount: otherStoreProducts.length,
      }
    : (sellerStore ?? storeData);

  const selectedSellerKey = (sellerId || selectedDiscoverSeller?.id || storeKey || '').trim();
  const handleShareStore = useCallback(async () => {
    try {
      const handle = (currentStore.username || '').replace(/^@/, '');
      const shareUrl = handle ? `https://sipariskutusu.app/store/${handle}` : 'https://sipariskutusu.app';
      await Share.share({
        message: `${currentStore.name} mağazasını Sipariş Kutusu'nda keşfet: ${shareUrl}`,
        url: shareUrl,
        title: currentStore.name,
      });
      trackEvent(TELEMETRY_EVENTS.STORE_CTA_CLICKED, {
        seller_id: selectedSellerKey || user?.id || null,
        store_name: currentStore.name,
        cta: 'share',
        source: 'store_header',
      });
    } catch {
      /* user cancelled */
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStore?.name, currentStore?.username, selectedSellerKey, user?.id]);
  const isFollowingCurrentStore = viewingOtherStore ? Boolean(selectedSellerKey && followedSellers[selectedSellerKey]) : isFollowingStore;
  const activeStoreProducts = viewingOtherStore ? otherStoreProducts : storeProducts;
  const activeStorePosts = viewingOtherStore ? otherStorePosts : storePosts;
  const activeStoreHighlights = viewingOtherStore ? otherStoreHighlights : storeHighlights;
  const activeFollowersCount = viewingOtherStore
    ? (Number.parseInt((currentStore.followers || '0').replace(/[^0-9]/g, ''), 10) || otherStoreProducts.length * 10) + (isFollowingCurrentStore ? 1 : 0)
    : storeFollowersCount;
  const ownFollowingCount = Object.values(followedSellers).filter(Boolean).length;
  const activeFollowingCount = viewingOtherStore ? Math.max(12, Math.round(activeFollowersCount * 0.08)) : Math.max(storeFollowingCount, ownFollowingCount);
  const palette = useMemo(() => ({
    screenBg: isDarkMode ? '#0F172A' : colors.background,
    surfaceBg: isDarkMode ? '#111827' : '#FFFFFF',
    softBg: isDarkMode ? '#1F2937' : '#EFF6FF',
    border: isDarkMode ? '#334155' : colors.borderLight,
    chipBg: isDarkMode ? '#1E293B' : '#F7F7F7',
    textPrimary: isDarkMode ? '#E5E7EB' : colors.textPrimary,
    textSecondary: isDarkMode ? '#94A3B8' : colors.textSecondary,
    textMuted: isDarkMode ? '#94A3B8' : colors.textMuted,
  }), [isDarkMode]);
  const storeAnalytics = useMemo(() => {
    const productViews = Math.max(activeStoreProducts.length * 145, activeFollowersCount * 3);
    const productClicks = Math.max(activeStoreProducts.length * 28, Math.round(productViews * 0.18));
    const contactClicks = Math.max(storeMessageCount, Math.round(activeFollowersCount * 0.02));
    const ctr = productViews > 0 ? (productClicks / productViews) * 100 : 0;

    return {
      productViews,
      productClicks,
      contactClicks,
      ctr,
    };
  }, [activeFollowersCount, activeStoreProducts.length, storeMessageCount]);
  const displayHighlights = useMemo(
    () => [...activeStoreHighlights].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [activeStoreHighlights],
  );
  const activeReels = useMemo(
    () => activeStorePosts.filter((post) => post.isVideo),
    [activeStorePosts],
  );
  const activeReel = useMemo(
    () => activeReels.find((post) => post.id === activeReelId) ?? null,
    [activeReels, activeReelId],
  );
  const activeReelProduct = useMemo(
    () => (activeReel?.linkedProductId ? activeStoreProducts.find((product) => product.id === activeReel.linkedProductId) : undefined),
    [activeReel, activeStoreProducts],
  );
  const activeReelLikeCount = activeReel ? reelLikeCounts[activeReel.id] ?? activeReel.likes : 0;
  const activeReelCommentCount = activeReel ? reelCommentCounts[activeReel.id] ?? activeReel.comments : 0;
  const activeReelComments = activeReel ? reelComments[activeReel.id] ?? [] : [];
  const isActiveReelLiked = activeReel ? Boolean(reelLikedMap[activeReel.id]) : false;

  // Load real Supabase data when a reel is opened
  const loadReelData = useCallback(async (reel: { id: string; linkedProductId?: string; likes: number; comments: number }) => {
    const productId = reel.linkedProductId;
    if (!productId) return;
    setReelLoading(true);
    try {
      const [liked, comments] = await Promise.all([
        isFavorited(productId).catch(() => false),
        fetchListingComments(productId).catch(() => []),
      ]);
      setReelLikedMap((prev) => ({ ...prev, [reel.id]: liked }));
      setReelComments((prev) => ({
        ...prev,
        [reel.id]: comments.map((c) => ({ author: c.authorName ?? 'kullanici', text: c.comment })),
      }));
      setReelCommentCounts((prev) => ({ ...prev, [reel.id]: comments.length }));
    } catch {
      // ignore
    } finally {
      setReelLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeReel) return;
    loadReelData(activeReel);
  }, [activeReel, loadReelData]);

  function openReel(postId: string) {
    const reel = activeReels.find((entry) => entry.id === postId);
    if (!reel) {
      setActiveTab('stories');
      return;
    }

    setActiveReelId(reel.id);
  }

  async function toggleReelLike() {
    if (!activeReel?.linkedProductId) return;
    const reelId = activeReel.id;
    const productId = activeReel.linkedProductId;
    const isLikedNow = Boolean(reelLikedMap[reelId]);
    // Optimistic update
    setReelLikedMap((current) => ({ ...current, [reelId]: !isLikedNow }));
    setReelLikeCounts((current) => ({
      ...current,
      [reelId]: (current[reelId] ?? activeReel.likes) + (isLikedNow ? -1 : 1),
    }));
    try {
      await toggleFavorite(productId);
    } catch {
      // Revert on failure
      setReelLikedMap((current) => ({ ...current, [reelId]: isLikedNow }));
      setReelLikeCounts((current) => ({
        ...current,
        [reelId]: (current[reelId] ?? activeReel.likes) + (isLikedNow ? 1 : -1),
      }));
    }
  }

  async function submitReelComment() {
    if (!activeReel?.linkedProductId) return;
    const trimmed = reelCommentDraft.trim();
    if (!trimmed) return;
    if (!user) return;
    const reelId = activeReel.id;
    const productId = activeReel.linkedProductId;
    const authorName = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'kullanici';
    setReelCommentDraft('');
    // Optimistic update
    setReelComments((current) => ({
      ...current,
      [reelId]: [...(current[reelId] ?? []), { author: authorName, text: trimmed }],
    }));
    setReelCommentCounts((current) => ({
      ...current,
      [reelId]: (current[reelId] ?? activeReel.comments) + 1,
    }));
    try {
      await addListingComment(productId, trimmed);
    } catch {
      // Revert on failure
      setReelComments((current) => ({
        ...current,
        [reelId]: (current[reelId] ?? []).slice(0, -1),
      }));
      setReelCommentCounts((current) => ({
        ...current,
        [reelId]: Math.max(0, (current[reelId] ?? activeReel.comments) - 1),
      }));
    }
  }

  if (!hasStore && !viewingOtherStore) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.screenBg }}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ fontSize: 18, fontFamily: fonts.bold, color: palette.textPrimary }}>
            Mağaza
          </Text>
        </View>
        {!user ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
            <Pressable
              onPress={() => router.push('/auth')}
              style={{
                height: 44,
                borderRadius: 12,
                backgroundColor: palette.softBg,
                borderWidth: 1,
                borderColor: palette.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="Giris yap veya kayit ol"
            >
              <Text style={{ fontSize: 12, fontFamily: fonts.bold, color: colors.primary }}>Giriş Yap / Kayıt Ol</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <View style={{ backgroundColor: palette.surfaceBg, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: palette.border }}>
            <Text style={{ fontSize: 22, fontFamily: fonts.headingBold, color: palette.textPrimary }}>
              Henüz mağazan yok
            </Text>
            <Text style={{ fontSize: 13, fontFamily: fonts.regular, color: palette.textSecondary, lineHeight: 20, marginTop: 8 }}>
              Satıcılar önce mağaza açar, ardından hikaye paylaşır. Bu ekran mağazan hazır olduğunda vitrinini ve hikayelerini gösterecek.
            </Text>
            <View style={{ marginTop: 18, gap: 10 }}>
              {['Mağaza profilini kur', 'İlk hikayeni paylaş', 'Hikayelerini öne çıkanlara ekle'].map((item) => (
                <View key={item} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
                  <Text style={{ fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary, marginLeft: 8 }}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
            <Pressable
              style={{ height: 46, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 20 }}
              onPress={() => router.push(user ? '/store-setup' : '/auth')}
              accessibilityRole="button"
              accessibilityLabel={user ? 'Magaza ac' : 'Giris yapip magaza ac'}
            >
              <Text style={{ fontSize: 14, fontFamily: fonts.bold, color: '#FFFFFF' }}>{user ? 'Mağaza Aç' : 'Giriş Yap ve Mağaza Aç'}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.screenBg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ fontSize: 18, fontFamily: fonts.bold, color: palette.textPrimary }}>
            Mağaza
          </Text>
          {user ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable onPress={() => router.push('/share-story')} accessibilityRole="button" accessibilityLabel="Hikaye paylas">
                <Ionicons name="add-circle-outline" size={24} color={palette.textPrimary} />
              </Pressable>
              <Pressable onPress={handleShareStore} accessibilityRole="button" accessibilityLabel="Magazayi paylas">
                <Ionicons name="share-outline" size={22} color={palette.textPrimary} />
              </Pressable>
              <FavoriteButton />
              <ProfileButton />
            </View>
          ) : (
            <Pressable
              onPress={() => router.push('/auth')}
              style={{
                height: 34,
                borderRadius: 10,
                paddingHorizontal: 12,
                backgroundColor: palette.softBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="Giris veya kayit"
            >
              <Text style={{ fontSize: 11, fontFamily: fonts.bold, color: colors.primary }}>Giriş / Kayıt</Text>
            </Pressable>
          )}
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          {currentStore.coverImage ? (
            <Image
              source={{ uri: currentStore.coverImage }}
              style={{ width: '100%', height: 160, borderRadius: 24 }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ width: '100%', height: 160, borderRadius: 24, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="image" size={50} color={colors.textSecondary} />
            </View>
          )}
        </View>

        {/* Profile Section */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            {/* Avatar */}
            <Pressable
              onPress={() => {
                if (isOwnStoreView) {
                  router.push('/share-story?quick=1');
                  return;
                }
                setActiveTab('stories');
              }}
              style={{
              width: 80, height: 80, borderRadius: 40,
              borderWidth: 3, borderColor: colors.primary,
              overflow: 'hidden', marginRight: 20,
              backgroundColor: currentStore.avatar && !currentStore.avatar.includes('emoji') ? '#fff' : '#F3E8FF',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              {currentStore.avatar && !currentStore.avatar.startsWith('http') && currentStore.avatar.length < 5 ? (
                <Text style={{ fontSize: 40 }}>{currentStore.avatar}</Text>
              ) : currentStore.avatar && currentStore.avatar.startsWith('http') ? (
                <Image
                  source={{ uri: currentStore.avatar }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name="person-circle" size={60} color={colors.primary} />
              )}
              {isOwnStoreView ? (
                <View style={{ position: 'absolute', right: 1, bottom: 1, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
                  <Ionicons name="add" size={13} color="#fff" />
                </View>
              ) : null}
            </Pressable>

            {/* Stats */}
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
              <Pressable onPress={() => setActiveTab('products')} style={{ alignItems: 'center' }} accessibilityRole="button" accessibilityLabel="Urunler sekmesini ac">
                <Text style={{ fontSize: 17, fontFamily: fonts.bold, color: palette.textPrimary }}>
                  {activeStoreProducts.length.toLocaleString('tr-TR')}
                </Text>
                <Text style={{ fontSize: 12, color: palette.textMuted, fontFamily: fonts.regular, marginTop: 2 }}>
                  Ürün
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!isOwnStoreView) {
                    Alert.alert('Bilgi', 'Takipci listesi sadece magaza sahibine acik.');
                    return;
                  }
                  router.push('/follow-list?tab=followers');
                }}
                style={{ alignItems: 'center', opacity: isOwnStoreView ? 1 : 0.75 }}
                accessibilityRole="button"
                accessibilityLabel="Takipci listesini ac"
              >
                <Text style={{ fontSize: 17, fontFamily: fonts.bold, color: palette.textPrimary }}>
                  {activeFollowersCount.toLocaleString('tr-TR')}
                </Text>
                <Text style={{ fontSize: 12, color: palette.textMuted, fontFamily: fonts.regular, marginTop: 2 }}>
                  Takipçi
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!isOwnStoreView) {
                    Alert.alert('Bilgi', 'Takip edilenler listesi sadece magaza sahibine acik.');
                    return;
                  }
                  router.push('/follow-list?tab=following');
                }}
                style={{ alignItems: 'center', opacity: isOwnStoreView ? 1 : 0.75 }}
                accessibilityRole="button"
                accessibilityLabel="Takip edilenler listesini ac"
              >
                <Text style={{ fontSize: 17, fontFamily: fonts.bold, color: palette.textPrimary }}>
                  {activeFollowingCount.toLocaleString('tr-TR')}
                </Text>
                <Text style={{ fontSize: 12, color: palette.textMuted, fontFamily: fonts.regular, marginTop: 2 }}>
                  Takip
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Name, username, bio */}
          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
              <Text style={{ fontSize: 15, fontFamily: fonts.bold, color: palette.textPrimary }}>
                {currentStore.name}
              </Text>
              {currentStore.verified && (
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ marginLeft: 5 }} />
              )}
            </View>
            <Text style={{ fontSize: 13, color: palette.textMuted, fontFamily: fonts.regular, marginBottom: 4 }}>
              {currentStore.username}
            </Text>
            <Text style={{ fontSize: 13, color: palette.textPrimary, fontFamily: fonts.regular, lineHeight: 19 }}>
              {currentStore.description}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
              <Ionicons name="location-outline" size={13} color={palette.textMuted} />
              <Text style={{ fontSize: 12, color: palette.textMuted, fontFamily: fonts.regular, marginLeft: 3 }}>
                {currentStore.city}
              </Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
            <Pressable style={{
              flex: 1, height: 36, borderRadius: 8,
              backgroundColor: viewingOtherStore ? (isFollowingCurrentStore ? palette.softBg : colors.primary) : colors.primary,
              alignItems: 'center', justifyContent: 'center',
            }} onPress={viewingOtherStore ? () => {
              trackEvent(TELEMETRY_EVENTS.STORE_CTA_CLICKED, {
                seller_id: selectedSellerKey || null,
                store_name: currentStore.name,
                cta: isFollowingCurrentStore ? 'unfollow' : 'follow',
                source: 'store_header',
              });
              if (selectedSellerKey) {
                toggleSellerFollow(selectedSellerKey);
              }
            } : () => {
              trackEvent(TELEMETRY_EVENTS.STORE_CTA_CLICKED, {
                seller_id: user?.id ?? null,
                store_name: currentStore.name,
                cta: 'edit_store',
                source: 'store_header',
              });
              router.push('/store-settings');
            }}
            accessibilityRole="button"
            accessibilityLabel={viewingOtherStore ? (isFollowingCurrentStore ? 'Magazayi takipten cik' : 'Magazayi takip et') : 'Magazayi duzenle'}>
              <Text style={{ fontSize: 14, fontFamily: fonts.bold, color: viewingOtherStore && isFollowingCurrentStore ? colors.primary : '#FFFFFF' }}>
                {viewingOtherStore ? (isFollowingCurrentStore ? 'Takiptesin' : 'Takip Et') : 'Düzenle'}
              </Text>
            </Pressable>
            <Pressable style={{
              flex: 1, height: 36, borderRadius: 8,
              borderWidth: 1.5, borderColor: palette.border,
              alignItems: 'center', justifyContent: 'center',
            }} onPress={() => {
              trackEvent(TELEMETRY_EVENTS.STORE_CTA_CLICKED, {
                seller_id: selectedSellerKey || user?.id || null,
                store_name: currentStore.name,
                cta: 'message',
                source: 'store_header',
              });
              if (viewingOtherStore) {
                router.push(selectedSellerKey ? buildSellerMessagesRoute({ sellerId: selectedSellerKey }) : buildMessagesInboxRoute());
                return;
              }
              router.push(buildMessagesInboxRoute());
            }}
            accessibilityRole="button"
            accessibilityLabel={viewingOtherStore ? 'Magazaya mesaj gonder' : 'Mesaj kutusunu ac'}>
              <Text style={{ fontSize: 14, fontFamily: fonts.bold, color: palette.textPrimary }}>
                {viewingOtherStore ? 'Mesaj' : `Mesajlar${storeMessageCount > 0 ? ` (${storeMessageCount})` : ''}`}
              </Text>
            </Pressable>
          </View>

          {isOwnStoreView && !canPublishAsSeller ? (
            <View style={{ borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginTop: 8 }}>
              <Text style={{ fontSize: 12, fontFamily: fonts.bold, color: '#B91C1C' }}>Yayın öncesi eksikler</Text>
              <View style={{ marginTop: 6, gap: 4 }}>
                {sellerPublishReadiness.missing.slice(0, 3).map((item) => (
                  <Text key={item} style={{ fontSize: 11, fontFamily: fonts.medium, color: '#B91C1C' }}>
                    • {item}
                  </Text>
                ))}
              </View>
              <Pressable
                onPress={() => router.push('/store-settings')}
                style={{ marginTop: 10, height: 34, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FCA5A5', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 12, fontFamily: fonts.bold, color: '#B91C1C' }}>Profili Tamamla</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Story Highlights */}
        <View style={{ paddingBottom: 16, paddingTop: 2 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 14 }}>
            {displayHighlights.length === 0 && isOwnStoreView ? (
              <Pressable
                onPress={() => router.push('/share-story?quick=1')}
                style={{ alignItems: 'center', width: 84 }}
              >
                <View
                  style={{
                    width: 62, height: 62, borderRadius: 31,
                    borderWidth: 2, borderColor: '#BFDBFE',
                    borderStyle: 'dashed',
                    backgroundColor: '#EFF6FF',
                    alignItems: 'center', justifyContent: 'center',
                    marginBottom: 5,
                  }}
                >
                  <Ionicons name="add" size={20} color={colors.primary} />
                </View>
                <Text numberOfLines={1} style={{ fontSize: 11, color: colors.textPrimary, fontFamily: fonts.medium, textAlign: 'center', width: 84 }}>
                  İlk hikayen
                </Text>
                <Text numberOfLines={1} style={{ fontSize: 10, color: colors.textMuted, fontFamily: fonts.regular, textAlign: 'center', width: 84 }}>
                  Şimdi paylaş
                </Text>
              </Pressable>
            ) : null}
            {displayHighlights.map((h) => (
              <Pressable
                key={h.id}
                style={{ alignItems: 'center', width: 84 }}
                onPress={() => {
                  const linkedPost = activeStorePosts.find((post) => post.id === h.linkedPostId) ?? activeStorePosts.find((post) => post.image === h.image);
                  if (linkedPost?.isVideo) {
                    openReel(linkedPost.id);
                    return;
                  }
                  setActiveTab('stories');
                }}
              >
                <View style={{
                  width: 62, height: 62, borderRadius: 31,
                  borderWidth: 2.5, borderColor: colors.primary,
                  padding: 2, marginBottom: 5,
                }}>
                  <Image
                    source={{ uri: h.image }}
                    style={{ width: '100%', height: '100%', borderRadius: 28 }}
                    resizeMode="cover"
                  />
                </View>
                {isOwnStoreView && editingHighlightId === h.id ? (
                  <TextInput
                    value={highlightTitleDraft}
                    onChangeText={setHighlightTitleDraft}
                    showSoftInputOnFocus
                    onBlur={() => {
                      updateHighlightTitle(h.id, highlightTitleDraft);
                      setEditingHighlightId(null);
                    }}
                    onSubmitEditing={() => {
                      updateHighlightTitle(h.id, highlightTitleDraft);
                      setEditingHighlightId(null);
                    }}
                    autoFocus
                    maxLength={24}
                    style={{ width: 84, height: 22, fontSize: 11, color: colors.textPrimary, fontFamily: fonts.regular, textAlign: 'center' }}
                  />
                ) : (
                  <Pressable
                    disabled={!isOwnStoreView}
                    onPress={() => {
                      if (!isOwnStoreView) {
                        return;
                      }

                      setEditingHighlightId(h.id);
                      setHighlightTitleDraft(h.title);
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 11, color: colors.textPrimary, fontFamily: fonts.regular, textAlign: 'center', width: 84 }}
                    >
                      {h.title}
                    </Text>
                  </Pressable>
                )}
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 10, color: colors.textMuted, fontFamily: fonts.regular, textAlign: 'center', width: 84, marginTop: 1 }}
                >
                  {formatDate(h.date)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {isOwnStoreView && myStoryArchive.length > 0 ? (
            <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
              <Text style={{ fontSize: 12, fontFamily: fonts.bold, color: colors.textPrimary }}>
                Hikaye Geçmişi — Sadece sen görürsün
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingTop: 8 }}>
                {myStoryArchive.slice(0, 12).map((item) => (
                  <Pressable
                    key={`archive-${item.id}`}
                    style={{ width: 84, alignItems: 'center' }}
                    onPress={() => router.push(`/story-viewer?storyId=${encodeURIComponent(item.id)}&sellerKey=me` as never)}
                  >
                    <Image source={{ uri: item.image }} style={{ width: 56, height: 56, borderRadius: 28, opacity: 0.9 }} resizeMode="cover" />
                    <Text numberOfLines={1} style={{ fontSize: 10, color: colors.textPrimary, fontFamily: fonts.regular, textAlign: 'center', marginTop: 4 }}>
                      {item.seller}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: palette.border }} />

        {/* Tabs */}
        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: palette.border }}>
          {([
            { key: 'products', icon: 'grid-outline', label: 'Ürünler' },
            { key: 'stories', icon: 'play-outline', label: 'Reels' },
            { key: 'about', icon: 'information-circle-outline', label: 'Hakkında' },
          ] as { key: Tab; icon: string; label: string }[]).map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setActiveTab(t.key)}
              style={{
                flex: 1, alignItems: 'center', justifyContent: 'center',
                paddingVertical: 12,
                borderBottomWidth: activeTab === t.key ? 2 : 0,
                borderBottomColor: colors.primary,
              }}
              accessibilityRole="button"
              accessibilityLabel={`${t.label} sekmesini ac`}
            >
              <Ionicons
                name={t.icon as any}
                size={22}
                color={activeTab === t.key ? colors.primary : colors.textMuted}
              />
            </Pressable>
          ))}
        </View>

        {/* Products Tab — 3-column grid */}
        {activeTab === 'products' && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingTop: 2 }}>
            {activeStoreProducts.length === 0 ? (
              <View style={{ flex: 1, paddingHorizontal: 24, paddingVertical: 48, alignItems: 'center', gap: 10 }}>
                <BoxMascot variant="order" size={100} animated={false} />
                <Text style={{ fontSize: 15, fontFamily: fonts.bold, color: colors.textPrimary, textAlign: 'center' }}>
                  {isOwnStoreView ? 'Henüz ürün yok' : 'Bu mağazada ürün bulunmuyor'}
                </Text>
                <Text style={{ fontSize: 13, fontFamily: fonts.regular, color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
                  {isOwnStoreView ? 'İlk ilanını yayınladığında burada görünecek.' : 'Satıcı yakında ürün ekleyecek.'}
                </Text>
                {isOwnStoreView ? (
                  <Pressable
                    onPress={() => router.push('/create-listing')}
                    style={{ marginTop: 6, height: 42, borderRadius: 10, paddingHorizontal: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 13, fontFamily: fonts.bold, color: '#FFFFFF' }}>+ İlan Ekle</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {activeStoreProducts.map((product) => (
              <Pressable
                key={product.id}
                style={{ width: GRID_ITEM, height: GRID_ITEM }}
                onPress={() => {
                  trackEvent(TELEMETRY_EVENTS.STORE_PRODUCT_CLICKED, {
                    seller_id: selectedSellerKey || user?.id || null,
                    store_name: currentStore.name,
                    product_id: product.id,
                    source: 'store_grid',
                  });
                  router.push(`/product/${product.id}`);
                }}
              >
                <Image
                  source={{ uri: resolveMediaCover(product) }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              </Pressable>
            ))}
          </View>
        )}

        {/* Reels Tab */}
        {activeTab === 'stories' && (
          <View style={{ paddingBottom: 18 }}>
            {activeReels.length === 0 ? (
              <View style={{ paddingHorizontal: 24, paddingTop: 36, paddingBottom: 12, alignItems: 'center', gap: 10 }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: palette.softBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="play-circle-outline" size={32} color={colors.primary} />
                </View>
                <Text style={{ fontSize: 14, color: palette.textPrimary, fontFamily: fonts.bold, textAlign: 'center' }}>
                  {isOwnStoreView ? 'Henüz reels yok' : 'Bu mağazada reels bulunmuyor'}
                </Text>
                <Text style={{ fontSize: 12, color: palette.textSecondary, fontFamily: fonts.regular, textAlign: 'center', lineHeight: 18 }}>
                  {isOwnStoreView ? 'Video ürün hikayen burada görünecek.' : 'Satıcı yakında video paylaşacak.'}
                </Text>
                {isOwnStoreView ? (
                  <Pressable
                    onPress={() => router.push('/share-story')}
                    style={{ marginTop: 4, height: 40, borderRadius: 10, paddingHorizontal: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 12, fontFamily: fonts.bold, color: '#FFFFFF' }}>+ Hikaye / Reel Paylaş</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingTop: 2 }}>
                {activeReels.map((post) => (
                  <Pressable key={post.id} style={{ width: GRID_ITEM, height: GRID_ITEM * 1.28 }} onPress={() => openReel(post.id)}>
                    <Image source={{ uri: post.image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#00000077', borderRadius: 999, padding: 4 }}>
                      <Ionicons name="play" size={13} color="#fff" />
                    </View>
                    <View style={{ position: 'absolute', left: 6, right: 6, bottom: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="heart" size={12} color="#fff" />
                        <Text style={{ fontSize: 10, color: '#fff', fontFamily: fonts.bold, marginLeft: 4 }}>
                          {(reelLikeCounts[post.id] ?? post.likes).toLocaleString('tr-TR')}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="chatbubble" size={11} color="#fff" />
                        <Text style={{ fontSize: 10, color: '#fff', fontFamily: fonts.bold, marginLeft: 4 }}>
                          {(reelCommentCounts[post.id] ?? post.comments).toLocaleString('tr-TR')}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}

            {isOwnStoreView ? (
              <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
                <Text style={{ fontSize: 11, color: colors.textMuted, fontFamily: fonts.regular, marginBottom: 8 }}>
                Reels dışındaki hikayelerini istersen öne çıkanlara ekleyebilirsin.
                </Text>
                {activeStorePosts.map((post) => (
                  <View key={`highlight-action-${post.id}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 12, color: colors.textPrimary, fontFamily: fonts.medium, flex: 1 }} numberOfLines={1}>
                      {post.title}
                    </Text>
                    <Pressable
                      onPress={() => addStoryToHighlights(post.id)}
                      disabled={storeHighlights.some((item) => item.linkedPostId === post.id)}
                      style={{
                        backgroundColor: storeHighlights.some((item) => item.linkedPostId === post.id) ? '#EFF6FF' : '#F7F7F7',
                        borderColor: storeHighlights.some((item) => item.linkedPostId === post.id) ? '#BFDBFE' : colors.borderLight,
                        borderWidth: 1,
                        borderRadius: 999,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontFamily: fonts.bold, color: storeHighlights.some((item) => item.linkedPostId === post.id) ? colors.primary : colors.textPrimary }}>
                        {storeHighlights.some((item) => item.linkedPostId === post.id) ? 'Ekli' : 'Öne Çıkanlara Ekle'}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}

        {/* About Tab */}
        {activeTab === 'about' && (
          <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 }}>
            {/* Rating Summary */}
            <View style={{ marginBottom: 16 }}>
              <RatingSummary
                rating={currentStore.rating}
                reviewCount={currentStore.reviewCount || 0}
              />
            </View>

            {/* Quick Stats */}
            <View style={{ marginBottom: 20 }}>
              <QuickStats
                stats={[
                  { label: 'Ürün', value: `${activeStoreProducts.length}`, icon: 'cube-outline' },
                  { label: 'Görüntülenme', value: storeAnalytics.productViews.toLocaleString('tr-TR'), icon: 'eye-outline' },
                  { label: 'Tıklama', value: storeAnalytics.productClicks.toLocaleString('tr-TR'), icon: 'cursor-outline' },
                ]}
              />
            </View>

            {/* Stok Yönetimi (yalnız mağaza sahibi görür) */}
            {isOwnStoreView ? (
              <Pressable
                onPress={() => router.push('/inventory')}
                style={{
                  marginBottom: 20,
                  borderWidth: 1,
                  borderColor: palette.border,
                  borderRadius: 14,
                  backgroundColor: palette.surfaceBg,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
                accessibilityRole="button"
                accessibilityLabel="Stok yonetimine git"
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: '#DBEAFE',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="cube" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontFamily: fonts.bold, color: palette.textPrimary }}>
                    Stok Yönetimi
                  </Text>
                  <Text style={{ fontSize: 11, fontFamily: fonts.regular, color: palette.textMuted, marginTop: 2 }}>
                    Ürün stoklarını takip et, az kalan ve tükenenleri yönet.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={palette.textMuted} />
              </Pressable>
            ) : null}

            <View style={{ marginBottom: 20, borderWidth: 1, borderColor: palette.border, borderRadius: 14, backgroundColor: palette.surfaceBg, padding: 12 }}>
              <Text style={{ fontSize: 12, fontFamily: fonts.bold, color: palette.textPrimary, marginBottom: 8 }}>
                Mağaza Analitikleri
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontSize: 11, fontFamily: fonts.regular, color: palette.textMuted }}>CTR</Text>
                  <Text style={{ fontSize: 14, fontFamily: fonts.bold, color: colors.primary }}>{storeAnalytics.ctr.toFixed(1)}%</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 11, fontFamily: fonts.regular, color: palette.textMuted }}>Mesaj / İletişim</Text>
                  <Text style={{ fontSize: 14, fontFamily: fonts.bold, color: palette.textPrimary }}>{storeAnalytics.contactClicks.toLocaleString('tr-TR')}</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 11, fontFamily: fonts.regular, color: palette.textMuted }}>Takipçi</Text>
                  <Text style={{ fontSize: 14, fontFamily: fonts.bold, color: palette.textPrimary }}>{activeFollowersCount.toLocaleString('tr-TR')}</Text>
                </View>
              </View>
            </View>

            {/* Instagram Integration Panel — visible to store owner */}
            {isOwnStoreView ? (
              <Pressable
                onPress={() => router.push('/instagram-connect' as never)}
                style={{ marginBottom: 20, borderWidth: 1.5, borderColor: '#E1306C33', borderRadius: 16, backgroundColor: '#FFF0F5', padding: 14 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#E1306C15', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                    <Ionicons name="logo-instagram" size={18} color="#E1306C" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: fonts.bold, color: colors.textPrimary }}>Instagram Entegrasyonu</Text>
                    <Text style={{ fontSize: 11, fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 1 }}>Gönderilerini ürüne otomatik dönüştür</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[
                    { label: 'İçe Aktar', icon: 'cloud-download-outline', desc: 'Gönderi & Reel' },
                    { label: 'Otomatik Taslak', icon: 'flash-outline', desc: 'Caption analizi' },
                    { label: 'Hızlı Yayın', icon: 'rocket-outline', desc: 'Tek tıkla yayınla' },
                  ].map((item) => (
                    <View key={item.label} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 8, alignItems: 'center' }}>
                      <Ionicons name={item.icon as any} size={16} color="#E1306C" />
                      <Text style={{ fontSize: 10, fontFamily: fonts.bold, color: colors.textPrimary, marginTop: 4, textAlign: 'center' }}>{item.label}</Text>
                      <Text style={{ fontSize: 9, fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 1, textAlign: 'center' }}>{item.desc}</Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            ) : null}

            {/* Description */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 13, fontFamily: fonts.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                Mağaza Hakkında
              </Text>
              <Text style={{ fontSize: 14, fontFamily: fonts.regular, color: colors.textPrimary, lineHeight: 22 }}>
                {currentStore.description}
                {'\n\n'}Bu mağaza {currentStore.city} merkezli faaliyet gösterir. Teslimat modeli: {currentStore.deliveryInfo || 'Satıcı ile mesajlaşarak netleştirilir.'}
                {'\n\n'}İletişim: {currentStore.email || 'Email belirtilmedi'} • {currentStore.phone || 'Telefon belirtilmedi'}
              </Text>
            </View>

            {/* Info rows */}
            {(isOwnStoreView
              ? [
                  { icon: 'location-outline', label: 'Şehir', value: currentStore.city },
                  { icon: 'mail-outline', label: 'E-posta', value: currentStore.email },
                  { icon: 'call-outline', label: 'Telefon', value: currentStore.phone },
                  { icon: 'car-outline', label: 'Teslimat', value: currentStore.deliveryInfo },
                  { icon: 'star-outline', label: 'Puan', value: `${currentStore.rating} / 5 (${currentStore.reviewCount.toLocaleString('tr-TR')} değerlendirme)` },
                  { icon: 'calendar-outline', label: 'Kuruluş', value: currentStore.established },
                ]
              : [
                  { icon: 'location-outline', label: 'Şehir', value: currentStore.city },
                  { icon: 'star-outline', label: 'Puan', value: `${currentStore.rating} / 5` },
                ]
            ).filter((row) => Boolean(row.value)).map((row, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row', alignItems: 'flex-start',
                  paddingVertical: 13,
                  borderBottomWidth: 1, borderBottomColor: colors.borderLight,
                }}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: `${colors.primary}15`,
                  alignItems: 'center', justifyContent: 'center',
                  marginRight: 12,
                }}>
                  <Ionicons name={row.icon as any} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: colors.textMuted, fontFamily: fonts.regular, marginBottom: 3 }}>
                    {row.label}
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.textPrimary, fontFamily: fonts.medium, lineHeight: 20 }}>
                    {row.value}
                  </Text>
                </View>
              </View>
            ))}

            {/* Legal & Policies */}
            <View style={{ marginTop: 28 }}>
              <Text style={{ fontSize: 13, fontFamily: fonts.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
                Yasal & Politikalar
              </Text>
              {([
                { doc: 'terms-of-use', label: 'Kullanım Şartları', icon: 'document-text-outline' },
                { doc: 'privacy-kvkk', label: 'Gizlilik & KVKK', icon: 'shield-checkmark-outline' },
                { doc: 'platform-liability', label: 'Sorumluluk Reddi', icon: 'alert-circle-outline' },
                { doc: 'prohibited-products', label: 'Yasaklı Ürünler', icon: 'ban-outline' },
              ] as { doc: string; label: string; icon: string }[]).map((item) => (
                <Pressable
                  key={item.doc}
                  onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: item.doc } })}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingVertical: 13,
                    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
                  }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Ionicons name={item.icon as any} size={18} color={colors.primary} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, fontFamily: fonts.medium, color: colors.primary }}>
                    {item.label}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <Modal visible={Boolean(activeReel)} animationType="slide" transparent={false} onRequestClose={() => setActiveReelId(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top']}>
          {activeReel ? (
            <View style={{ flex: 1 }}>
              <Image source={{ uri: activeReel.image }} style={{ width: '100%', height: '100%', position: 'absolute' }} resizeMode="cover" />
              <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 6 : 0}
              >
              <View style={{ flex: 1, backgroundColor: '#00000055', justifyContent: 'space-between', padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ fontSize: 15, fontFamily: fonts.bold, color: '#fff' }}>{currentStore.name}</Text>
                    <Text style={{ fontSize: 11, fontFamily: fonts.regular, color: '#E5E7EB', marginTop: 2 }}>{formatDate(activeReel.date)}</Text>
                  </View>
                  <Pressable onPress={() => setActiveReelId(null)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#00000066', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="close" size={18} color="#fff" />
                  </Pressable>
                </View>

                <View>
                  <Text style={{ fontSize: 20, fontFamily: fonts.headingBold, color: '#fff' }}>
                    {activeReel.title}
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: fonts.regular, color: '#F3F4F6', marginTop: 6 }}>
                    {typeLabel(activeReel.type)} • reels ürün
                  </Text>

                  {activeReelProduct ? (
                    <Pressable
                      onPress={() => {
                        setActiveReelId(null);
                        router.push(`/product/${activeReelProduct.id}`);
                      }}
                      style={{ marginTop: 10, backgroundColor: '#FFFFFFE8', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
                    >
                      <Text style={{ fontSize: 12, fontFamily: fonts.bold, color: colors.textPrimary }} numberOfLines={1}>
                        {activeReelProduct.title}
                      </Text>
                      <Text style={{ fontSize: 12, fontFamily: fonts.bold, color: colors.primary, marginTop: 2 }}>
                        ₺{activeReelProduct.price.toFixed(2)}
                      </Text>
                    </Pressable>
                  ) : null}

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 }}>
                    <Pressable onPress={toggleReelLike} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name={isActiveReelLiked ? 'heart' : 'heart-outline'} size={22} color={isActiveReelLiked ? '#F87171' : '#fff'} />
                      <Text style={{ fontSize: 13, color: '#fff', fontFamily: fonts.bold, marginLeft: 6 }}>
                        {activeReelLikeCount.toLocaleString('tr-TR')}
                      </Text>
                    </Pressable>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="chatbubble-outline" size={21} color="#fff" />
                      <Text style={{ fontSize: 13, color: '#fff', fontFamily: fonts.bold, marginLeft: 6 }}>
                        {activeReelCommentCount.toLocaleString('tr-TR')}
                      </Text>
                    </View>
                  </View>

                  <ScrollView style={{ maxHeight: 120, marginTop: 10 }} keyboardShouldPersistTaps="handled">
                    {activeReelComments.map((comment, index) => (
                      <Text key={`${activeReel.id}-comment-${index}`} style={{ fontSize: 12, color: '#fff', fontFamily: fonts.regular, marginBottom: 4 }}>
                        @{comment.author}: {comment.text}
                      </Text>
                    ))}
                  </ScrollView>

                  {user ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 }}>
                      <TextInput
                        value={reelCommentDraft}
                        onChangeText={setReelCommentDraft}
                        showSoftInputOnFocus
                        autoCorrect
                        autoCapitalize="sentences"
                        placeholder="Yorum ekle..."
                        placeholderTextColor="#9CA3AF"
                        style={{ flex: 1, height: 40, borderRadius: 12, backgroundColor: '#FFFFFFE8', paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 12, color: colors.textPrimary }}
                      />
                      <Pressable onPress={submitReelComment} style={{ height: 40, borderRadius: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}>
                        <Text style={{ fontSize: 12, color: '#fff', fontFamily: fonts.bold }}>Gönder</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable onPress={() => { setActiveReelId(null); router.push('/auth'); }} style={{ marginTop: 12, height: 40, borderRadius: 12, backgroundColor: '#FFFFFFE8', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 12, color: colors.textPrimary, fontFamily: fonts.bold }}>Yorum yapmak için giriş yap</Text>
                    </Pressable>
                  )}
                </View>
              </View>
              </KeyboardAvoidingView>
            </View>
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
