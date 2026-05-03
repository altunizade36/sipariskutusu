import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts } from '../../src/constants/theme';
import { ProductCard } from '../../src/components/ProductCard';
import { FavoriteButton } from '../../src/components/FavoriteButton';
import { ProfileButton } from '../../src/components/ProfileButton';
import { StoryTray } from '../../src/components/StoryTray';
import { useListings } from '../../src/context/ListingsContext';
import { useAndroidTabBackToHome } from '../../src/hooks/useAndroidTabBackToHome';
import { useAuth } from '../../src/context/AuthContext';
import { fetchUnreadNotificationCount, subscribeToMyNotifications } from '../../src/services/inAppNotificationService';
import { getTopDailyPerformers } from '../../src/services/leaderboardService';
import { getRecentlyViewed, clearRecentlyViewed, type RecentlyViewedItem } from '../../src/hooks/useRecentlyViewed';
import BoxMascot from '../../src/components/BoxMascot';
import { t } from '../../src/i18n';
import { isSmallDevice, calcCardWidth } from '../../src/utils/responsive';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 10;
const CARD_WIDTH = calcCardWidth(2, GRID_GAP, 28);
const LOAD_MORE_SCROLL_THROTTLE_MS = 350;

type ProductTabId = 'all' | 'new' | 'flash' | 'discount' | 'freeShipping';
type ProductSortId = 'newest' | 'priceAsc' | 'priceDesc' | 'topRated';

function buildPalette(dark: boolean) {
  return {
    bg:            dark ? '#0A0F1E' : '#F2F3F7',
    card:          dark ? '#111827' : '#FFFFFF',
    cardAlt:       dark ? '#1A2235' : '#F8FAFC',
    border:        dark ? '#1E293B' : '#E5E7EB',
    borderFaint:   dark ? '#1E293B60' : '#33333312',
    textPrimary:   dark ? '#E5E7EB' : '#0D2347',
    textSecondary: dark ? '#94A3B8' : '#6B7280',
    textMuted:     dark ? '#4B5563' : '#9CA3AF',
    chip:          dark ? '#1E293B' : '#F7F7F7',
    chipBorder:    dark ? '#334155' : '#E5E7EB',
    searchBg:      dark ? '#1E293B' : '#F7F7F7',
    searchBorder:  dark ? '#334155' : '#33333315',
    primaryTint:   dark ? '#172554' : '#EFF6FF',
    primaryBorder: dark ? '#1E40AF' : '#BFDBFE',
    badge:         dark ? '#1E293B' : '#EFF6FF',
    badgeText:     dark ? '#93C5FD' : colors.primary,
  };
}

const heroBanners = [
  {
    id: 'campaign-flash',
    title: 'Flash Fırsatlar',
    subtitle: 'Saatlik kampanyalarla öne çıkan ürünleri kaçırma',
    cta: 'Fırsatları Aç',
    emoji: '⚡',
    gradient: ['#1E40AF', '#3B82F6', '#60A5FA'] as const,
  },
  {
    id: 'campaign-explore',
    title: 'Satıcıları Keşfet',
    subtitle: 'Takip et, vitrinleri izle, yeni ürünleri ilk sen yakala',
    cta: 'Keşfe Git',
    emoji: '🛍️',
    gradient: ['#0F766E', '#14B8A6', '#2DD4BF'] as const,
  },
  {
    id: 'campaign-sell',
    title: 'Satışa Başla',
    subtitle: 'Ücretsiz mağaza aç, milyonlara sat — hemen başla',
    cta: 'Mağaza Kur',
    emoji: '🏪',
    gradient: ['#7C3AED', '#8B5CF6', '#A78BFA'] as const,
  },
] as const;

const CATEGORY_CHIPS = [
  { emoji: '👗', label: 'Kadın',    cat: 'women',       color: '#FDF2F8', text: '#9D174D', border: '#FBCFE8' },
  { emoji: '👔', label: 'Erkek',    cat: 'men',         color: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' },
  { emoji: '📱', label: 'Elektronik', cat: 'electronics', color: '#F0FDF4', text: '#065F46', border: '#A7F3D0' },
  { emoji: '👟', label: 'Ayakkabı', cat: 'shoes-bags',  color: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  { emoji: '💄', label: 'Kozmetik', cat: 'cosmetics',   color: '#FFF1F2', text: '#9F1239', border: '#FECDD3' },
  { emoji: '🏠', label: 'Ev & Yaşam', cat: 'home',     color: '#F0FDFA', text: '#115E59', border: '#99F6E4' },
  { emoji: '⚽', label: 'Spor',     cat: 'sports',      color: '#FFF7ED', text: '#9A3412', border: '#FED7AA' },
  { emoji: '🍼', label: 'Anne & Çocuk', cat: 'mother-child', color: '#F5F3FF', text: '#5B21B6', border: '#DDD6FE' },
] as const;

const trendingSearches = [
  'Nike sneaker', 'iPhone kılıf', 'Vintage ceket', 'Kozmetik seti',
  'Keten pantolon', 'Spor çanta', 'Kadın elbise', 'Gaming kulaklık',
];

const discountTiers = [
  { id: 'd1', label: '%10+', gradientStart: '#EFF6FF', gradientEnd: '#DBEAFE', textColor: '#1D4ED8', border: '#BFDBFE' },
  { id: 'd2', label: '%20+', gradientStart: '#ECFDF5', gradientEnd: '#D1FAE5', textColor: '#047857', border: '#A7F3D0' },
  { id: 'd3', label: '%30+', gradientStart: '#FEF2F2', gradientEnd: '#FEE2E2', textColor: '#B91C1C', border: '#FECACA' },
] as const;

const productTabs: { id: ProductTabId; label: string }[] = [
  { id: 'all',         label: t.home.tabAll },
  { id: 'new',         label: t.home.tabNew },
  { id: 'flash',       label: t.home.tabFlash },
  { id: 'discount',    label: t.home.tabDiscount },
  { id: 'freeShipping',label: t.home.tabFreeShipping },
];

const productSortOptions: { id: ProductSortId; label: string }[] = [
  { id: 'newest',   label: t.home.sortNewest },
  { id: 'topRated', label: t.home.sortTopRated },
  { id: 'priceAsc', label: t.home.sortPriceAsc },
  { id: 'priceDesc',label: t.home.sortPriceDesc },
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6)  return 'Gece yarısı alışveriş 🌙';
  if (h < 12) return 'Günaydın ☀️';
  if (h < 18) return 'İyi günler 👋';
  return 'İyi akşamlar 🌆';
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, isDarkMode, isConfigured } = useAuth();
  const pal = buildPalette(isDarkMode);
  useAndroidTabBackToHome(true);

  const scrollRef = useRef<ScrollView>(null);
  const productSectionOffsetRef = useRef(0);
  const lastLoadMoreAttemptRef = useRef(0);
  const heroBannerScrollRef = useRef<ScrollView>(null);

  const [activeBanner, setActiveBanner] = useState(0);
  const [activeProductTab, setActiveProductTab] = useState<ProductTabId>('all');
  const [activeProductSort, setActiveProductSort] = useState<ProductSortId>('newest');
  const [refreshing, setRefreshing] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [storyRotationSeed, setStoryRotationSeed] = useState(0);
  const [flashCountdown, setFlashCountdown] = useState('');
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [topDailyPerformers, setTopDailyPerformers] = useState<any[]>([]);
  const [recentlyViewedItems, setRecentlyViewedItems] = useState<RecentlyViewedItem[]>([]);

  const {
    homeProducts, reloadProducts, reloadHomeStories, loadMoreProducts,
    homeHasMore, homeLoadingMore, homeStories, cartItemCount,
  } = useListings();

  const isSeller = (user?.user_metadata as { account_role?: string } | undefined)?.account_role === 'seller';
  const displayName = user?.user_metadata?.full_name?.split(' ')[0]
    ?? user?.email?.split('@')[0]
    ?? null;

  // ─── Notifications ────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    if (!user || !isConfigured) { setUnreadNotificationCount(0); return () => { active = false; }; }
    const refreshUnread = () => {
      fetchUnreadNotificationCount()
        .then((c) => { if (active) setUnreadNotificationCount(c); })
        .catch(() => { if (active) setUnreadNotificationCount(0); });
    };
    refreshUnread();
    const unsubscribe = subscribeToMyNotifications(user.id, refreshUnread);
    return () => { active = false; unsubscribe(); };
  }, [isConfigured, user?.id]);

  // ─── Top performers ───────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    getTopDailyPerformers(5)
      .then((p) => { if (active) setTopDailyPerformers(p); })
      .catch(() => { if (active) setTopDailyPerformers([]); });
    return () => { active = false; };
  }, []);

  // ─── Flash countdown ──────────────────────────────────────────────────────────
  useEffect(() => {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    let remaining = Math.floor((nextHour.getTime() - now.getTime()) / 1000);
    const fmt = (s: number) => {
      const h = Math.floor(s / 3600).toString().padStart(2, '0');
      const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
      const sec = (s % 60).toString().padStart(2, '0');
      return `${h}:${m}:${sec}`;
    };
    setFlashCountdown(fmt(remaining));
    const timer = setInterval(() => { remaining -= 1; if (remaining <= 0) remaining = 3600; setFlashCountdown(fmt(remaining)); }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ─── Recently viewed ──────────────────────────────────────────────────────────
  const loadRecentlyViewed = useCallback(() => {
    let cancelled = false;
    getRecentlyViewed()
      .then((items) => { if (!cancelled) setRecentlyViewedItems(items.slice(0, 8)); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  useFocusEffect(loadRecentlyViewed);

  // ─── Auto banner ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveBanner((prev) => {
        const next = (prev + 1) % heroBanners.length;
        heroBannerScrollRef.current?.scrollTo({ x: next * (SCREEN_WIDTH - 24), animated: true });
        return next;
      });
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // ─── Story rotation ───────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => { setStoryRotationSeed((c) => c + 1); reloadHomeStories().catch(() => undefined); }, 90_000);
    return () => clearInterval(timer);
  }, [reloadHomeStories]);

  // ─── Scroll handler ───────────────────────────────────────────────────────────
  const handleFeedScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    setShowScrollToTop(contentOffset.y > 500);
    if (!homeHasMore || homeLoadingMore) return;
    const now = Date.now();
    if (now - lastLoadMoreAttemptRef.current < LOAD_MORE_SCROLL_THROTTLE_MS) return;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 280) {
      lastLoadMoreAttemptRef.current = now;
      loadMoreProducts().catch(() => undefined);
    }
  }, [homeHasMore, homeLoadingMore, loadMoreProducts]);

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  const scrollToProducts = () => scrollRef.current?.scrollTo({ y: Math.max(productSectionOffsetRef.current - 12, 0), animated: true });
  const focusProductTab = (tab: ProductTabId) => { setActiveProductTab(tab); scrollToProducts(); };

  const onRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([reloadProducts(), reloadHomeStories()]); setStoryRotationSeed((c) => c + 1); }
    finally { setRefreshing(false); }
  };

  // ─── Filtered products ────────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    const source = [...homeProducts];
    const tabFiltered = source.filter((item) => {
      if (activeProductTab === 'new') return item.badge?.includes('Yeni') || item.badge === 'Hikayede';
      if (activeProductTab === 'flash') return item.badge === 'Flash';
      if (activeProductTab === 'discount') return Boolean(item.discount && item.discount >= 10);
      if (activeProductTab === 'freeShipping') return Boolean(item.freeShipping);
      return true;
    });
    if (activeProductSort === 'priceAsc') return tabFiltered.sort((a, b) => a.price - b.price);
    if (activeProductSort === 'priceDesc') return tabFiltered.sort((a, b) => b.price - a.price);
    if (activeProductSort === 'topRated') return tabFiltered.sort((a, b) => b.rating !== a.rating ? b.rating - a.rating : b.reviewCount - a.reviewCount);
    return tabFiltered;
  }, [activeProductSort, activeProductTab, homeProducts]);

  const activeProductTabLabel = productTabs.find((tab) => tab.id === activeProductTab)?.label ?? 'Tümü';
  const tabProductCounts = useMemo<Record<ProductTabId, number>>(() => ({
    all:         homeProducts.length,
    new:         homeProducts.filter((p) => p.badge?.includes('Yeni') || p.badge === 'Hikayede').length,
    flash:       homeProducts.filter((p) => p.badge === 'Flash').length,
    discount:    homeProducts.filter((p) => Boolean(p.discount && p.discount >= 10)).length,
    freeShipping:homeProducts.filter((p) => Boolean(p.freeShipping)).length,
  }), [homeProducts]);

  type StoryCircle = (typeof homeStories)[number] & { sellerStoryCount?: number };
  const groupedStoryCircles = useMemo<StoryCircle[]>(() => {
    const addStory = homeStories.find((item) => item.isAdd);
    const sellerGroups = new Map<string, typeof homeStories>();
    homeStories
      .filter((item) => !item.isAdd && !item.id.startsWith('explore-') && !item.id.startsWith('fallback-story-'))
      .forEach((item) => {
        const sellerKey = (item.sellerKey || item.seller || item.id).trim();
        sellerGroups.set(sellerKey, [...(sellerGroups.get(sellerKey) ?? []), item]);
      });
    const sellerPreviews: StoryCircle[] = Array.from(sellerGroups.entries()).map(([sellerKey, sellerStories]) => {
      const sorted = [...sellerStories].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
      return { ...sorted[0], sellerKey, sellerStoryCount: sorted.length };
    });
    const offset = sellerPreviews.length > 0 ? storyRotationSeed % sellerPreviews.length : 0;
    const rotated = offset > 0 ? [...sellerPreviews.slice(offset), ...sellerPreviews.slice(0, offset)] : sellerPreviews;
    return addStory ? [addStory, ...rotated] : rotated;
  }, [homeStories, storyRotationSeed]);
  const visibleHomeStoryCount = groupedStoryCircles.filter((item) => !item.isAdd).length;

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: pal.bg }} edges={['top']}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={{ backgroundColor: pal.card, paddingHorizontal: 16, paddingBottom: 12, paddingTop: 10, borderBottomWidth: 1, borderBottomColor: pal.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <BoxMascot variant="welcome" size={38} animated />
            <View>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 19, lineHeight: 23, letterSpacing: -0.3 }}>
                <Text style={{ color: pal.textPrimary }}>Sipariş </Text>
                <Text style={{ color: colors.primary }}>Kutusu</Text>
              </Text>
              {displayName ? (
                <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: colors.primary, marginTop: 1 }}>
                  {getGreeting()}, {displayName}!
                </Text>
              ) : (
                <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: pal.textMuted, letterSpacing: 0.2, marginTop: 1 }}>
                  {t.home.subtitle}
                </Text>
              )}
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable onPress={() => router.push('/notifications')} style={{ position: 'relative' }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: pal.primaryTint, borderWidth: 1, borderColor: pal.primaryBorder, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="notifications-outline" size={19} color={colors.primary} />
              </View>
              {unreadNotificationCount > 0 && (
                <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: pal.card }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 8, color: '#fff' }}>{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</Text>
                </View>
              )}
            </Pressable>
            <FavoriteButton />
            <ProfileButton />
          </View>
        </View>

        {/* Search bar */}
        <Pressable
          onPress={() => router.push('/search')}
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: pal.searchBg, borderRadius: 14, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: pal.searchBorder }}
        >
          <Ionicons name="search" size={18} color={pal.textMuted} />
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: pal.textMuted, flex: 1, marginLeft: 8 }}>{t.home.searchPlaceholder}</Text>
          <View style={{ width: 1, height: 18, backgroundColor: pal.border, marginHorizontal: 8 }} />
          <Ionicons name="camera-outline" size={20} color={colors.primary} />
        </Pressable>

        {/* Quick nav */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Pressable
            onPress={() => router.push('/(tabs)/categories')}
            style={{ flex: 1, height: 34, borderRadius: 10, borderWidth: 1, borderColor: colors.primary, backgroundColor: pal.primaryTint, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}
          >
            <Ionicons name="grid-outline" size={14} color={colors.primary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>Kategoriler</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/explore')}
            style={{ flex: 1, height: 34, borderRadius: 10, borderWidth: 1, borderColor: pal.border, backgroundColor: pal.cardAlt, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}
          >
            <Ionicons name="compass-outline" size={14} color={pal.textSecondary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: pal.textPrimary }}>Satıcı Keşfet</Text>
          </Pressable>
          {cartItemCount > 0 && (
            <Pressable
              onPress={() => router.push('/(tabs)/cart')}
              style={{ height: 34, borderRadius: 10, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, gap: 5 }}
            >
              <Ionicons name="cart-outline" size={14} color="#DC2626" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#DC2626' }}>{cartItemCount}</Text>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        onScroll={handleFeedScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >

        {/* ── Trending Searches ──────────────────────────────────────────────── */}
        <View style={{ backgroundColor: pal.card, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: pal.border }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 4 }}>
              <Ionicons name="trending-up" size={13} color="#EF4444" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#EF4444', textTransform: 'uppercase', letterSpacing: 0.5 }}>Trend</Text>
            </View>
            {trendingSearches.map((q) => (
              <Pressable
                key={q}
                onPress={() => router.push('/search')}
                style={{ height: 28, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: pal.chipBorder, backgroundColor: pal.chip, justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: pal.textSecondary }}>{q}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* ── Hero Banners ──────────────────────────────────────────────────── */}
        <View style={{ backgroundColor: pal.card, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: pal.border }}>
          <ScrollView
            ref={heroBannerScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setActiveBanner(Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 24)))}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
          >
            {heroBanners.map((banner) => (
              <Pressable
                key={banner.id}
                onPress={() => {
                  if (banner.id === 'campaign-flash') { focusProductTab('flash'); return; }
                  if (banner.id === 'campaign-explore') { router.push('/(tabs)/explore'); return; }
                  if (banner.id === 'campaign-sell') { router.push('/store-setup'); return; }
                  focusProductTab('discount');
                }}
                style={{ width: SCREEN_WIDTH - 24, height: 148, borderRadius: 18, overflow: 'hidden' }}
              >
                <LinearGradient
                  colors={banner.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 18 }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.headingBold, fontSize: 23, color: '#fff', letterSpacing: -0.5 }}>{banner.title}</Text>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 5, lineHeight: 17 }}>{banner.subtitle}</Text>
                    <View style={{ marginTop: 14, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>{banner.cta} →</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 64, marginLeft: 12 }}>{banner.emoji}</Text>
                </LinearGradient>
              </Pressable>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 }}>
            {heroBanners.map((_, i) => (
              <View
                key={i}
                style={{ height: 4, borderRadius: 2, backgroundColor: i === activeBanner ? colors.primary : pal.chipBorder, width: i === activeBanner ? 20 : 6 }}
              />
            ))}
          </View>
        </View>

        {/* ── Story Bar ─────────────────────────────────────────────────────── */}
        <View style={{ backgroundColor: pal.card, paddingTop: 14, paddingBottom: 16, marginTop: 6, borderBottomWidth: 1, borderBottomColor: pal.border }}>
          <View style={{ paddingHorizontal: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 15, color: pal.textPrimary }}>{t.home.stories}</Text>
              <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 11, color: pal.textSecondary, marginTop: 2 }}>{t.home.storiesSub}</Text>
            </View>
            <Pressable onPress={() => router.push('/share-story')} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>{t.home.addStory}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </Pressable>
          </View>
          <StoryTray stories={groupedStoryCircles} showAddButton={true} onAddPress={() => router.push('/share-story')} layout="full" variant="commerce" />
          {visibleHomeStoryCount === 0 ? (
            <Pressable
              onPress={() => router.push('/share-story')}
              style={{ marginHorizontal: 16, marginTop: 10, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: pal.primaryTint, borderColor: pal.primaryBorder }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="bag-add-outline" size={17} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: pal.textPrimary }}>{t.home.addFirstStory}</Text>
                <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 11, color: pal.textSecondary, marginTop: 2 }}>{t.home.addFirstStorySub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </Pressable>
          ) : (
            <View style={{ marginHorizontal: 16, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: pal.cardAlt }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 }}>
                <Ionicons name="refresh-outline" size={13} color={pal.textSecondary} />
                <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 11, color: pal.textSecondary }}>{t.home.storiesUpdated}</Text>
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary }}>{visibleHomeStoryCount} {t.home.active}</Text>
            </View>
          )}
        </View>

        {/* ── Recently Viewed ───────────────────────────────────────────────── */}
        {recentlyViewedItems.length > 0 && (
          <View style={{ backgroundColor: pal.card, marginTop: 6, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: pal.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="time-outline" size={15} color={pal.textSecondary} />
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 15, color: pal.textPrimary }}>{t.home.recentlyViewed}</Text>
              </View>
              <Pressable onPress={() => { clearRecentlyViewed(); setRecentlyViewedItems([]); }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: pal.textSecondary }}>{t.common.clear}</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 2 }}>
              {recentlyViewedItems.map((item) => (
                <Pressable key={item.id} onPress={() => router.push(`/product/${item.id}` as never)} style={{ width: 100 }}>
                  <View style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: pal.borderFaint, position: 'relative' }}>
                    <Image source={{ uri: item.imageUri }} style={{ width: 100, height: 100 }} resizeMode="cover" />
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 6, paddingVertical: 4, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>₺{item.price.toFixed(0)}</Text>
                    </View>
                  </View>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: pal.textSecondary, marginTop: 4 }} numberOfLines={1}>{item.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Seller CTA (non-sellers only) ─────────────────────────────────── */}
        {user && !isSeller && (
          <Pressable
            onPress={() => router.push('/store-setup')}
            style={{ marginHorizontal: 14, marginTop: 6, borderRadius: 16, overflow: 'hidden' }}
          >
            <LinearGradient
              colors={['#7C3AED', '#4F46E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16, gap: 14 }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 24 }}>🏪</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 15, color: '#fff' }}>Satıcı Ol, Kazanmaya Başla</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 3 }}>Ücretsiz mağaza aç • Anında yayınla • Kolay yönet</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" />
            </LinearGradient>
          </Pressable>
        )}

        {/* ── Discount Tiers ────────────────────────────────────────────────── */}
        <View style={{ backgroundColor: pal.card, marginTop: 6, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: pal.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Ionicons name="pricetag-outline" size={15} color={colors.primary} />
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 15, color: pal.textPrimary }}>{t.home.discountShopping}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {discountTiers.map((d) => (
              <Pressable
                key={d.id}
                onPress={() => focusProductTab('discount')}
                style={{ flex: 1, height: 60, borderRadius: 14, borderWidth: 1, borderColor: isDarkMode ? pal.border : d.border, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: isDarkMode ? pal.cardAlt : d.gradientStart }}
              >
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 20, color: isDarkMode ? '#93C5FD' : d.textColor }}>{d.label}</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 9, color: isDarkMode ? pal.textSecondary : d.textColor, opacity: 0.85 }}>{t.home.discount}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Top Performers ────────────────────────────────────────────────── */}
        {topDailyPerformers.length > 0 && (
          <View style={{ backgroundColor: pal.card, marginTop: 6, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: pal.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="star" size={15} color="#F59E0B" />
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 15, color: pal.textPrimary }}>{t.home.topPerformers}</Text>
              </View>
              <Pressable onPress={() => router.push('/seller-leaderboard')}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>Tümü →</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 12 }}>
              {topDailyPerformers.map((performer, idx) => {
                const rankColors = ['#F59E0B', '#9CA3AF', '#CD7F32', colors.primary, colors.primary];
                const rankColor = rankColors[idx] ?? colors.primary;
                const trendIcon = performer.rank_trend === 'up' ? 'arrow-up' : performer.rank_trend === 'down' ? 'arrow-down' : 'remove';
                const trendColor = performer.rank_trend === 'up' ? '#10B981' : performer.rank_trend === 'down' ? '#EF4444' : pal.textMuted;
                return (
                  <Pressable
                    key={performer.seller_id}
                    onPress={() => router.push(`/store?sellerId=${performer.seller_id}` as any)}
                    style={{ alignItems: 'center', width: 70 }}
                  >
                    <View style={{ position: 'relative' }}>
                      {performer.avatar_url ? (
                        <Image source={{ uri: performer.avatar_url }} style={{ width: 54, height: 54, borderRadius: 27, borderWidth: 2.5, borderColor: rankColor }} />
                      ) : (
                        <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: pal.cardAlt, borderWidth: 2.5, borderColor: rankColor, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="person" size={22} color={pal.textMuted} />
                        </View>
                      )}
                      <View style={{ position: 'absolute', bottom: -5, left: '50%', transform: [{ translateX: -10 }], backgroundColor: rankColor, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1.5, borderColor: pal.card }}>
                        <Text style={{ fontFamily: fonts.headingBold, fontSize: 9, color: '#fff' }}>#{performer.rank}</Text>
                      </View>
                    </View>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 10, color: pal.textPrimary, marginTop: 10, textAlign: 'center' }}>
                      {performer.store_name || performer.full_name}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <Ionicons name={trendIcon as any} size={10} color={trendColor} />
                      <Text style={{ fontFamily: fonts.medium, fontSize: 9, color: pal.textSecondary }}>{performer.daily_score ?? performer.score}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Flash Sale Banner ─────────────────────────────────────────────── */}
        <Pressable
          onPress={() => focusProductTab('flash')}
          style={{ marginHorizontal: 14, marginVertical: 8, borderRadius: 16, overflow: 'hidden' }}
        >
          <LinearGradient
            colors={['#1E40AF', '#2563EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="flash" size={20} color="#FDE68A" />
              </View>
              <View>
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 15, color: '#fff' }}>{t.home.flashSale}</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                  {flashCountdown ? `Bitiş: ${flashCountdown}` : 'Fırsatları kaçırma!'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ backgroundColor: '#FDE68A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#1E40AF' }}>{flashCountdown}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
            </View>
          </LinearGradient>
        </Pressable>

        {/* ── Products ─────────────────────────────────────────────────────── */}
        <View
          style={{ backgroundColor: pal.card, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6 }}
          onLayout={(event) => { productSectionOffsetRef.current = event.nativeEvent.layout.y; }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: pal.textPrimary }}>{t.home.products}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.textSecondary, marginTop: 3 }}>
                {t.home.productsShown(filteredProducts.length, activeProductTabLabel)}
              </Text>
            </View>
            <View style={{ backgroundColor: pal.badge, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: pal.badgeText }}>
                {homeProducts.length > 0 ? t.home.productsLoaded(homeProducts.length) : t.home.liveStream}
              </Text>
            </View>
          </View>
        </View>

        {/* Filters */}
        <View style={{ backgroundColor: pal.card, paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: pal.border }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: pal.textSecondary, marginBottom: 8, marginTop: 4 }}>{t.home.filterBy}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
            {productTabs.map((tab) => {
              const selected = activeProductTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveProductTab(tab.id)}
                  style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: selected ? colors.primary : pal.chip, borderColor: selected ? colors.primary : pal.chipBorder }}
                >
                  {selected && <Ionicons name="checkmark" size={13} color="#fff" />}
                  <Text style={{ fontFamily: selected ? fonts.bold : fonts.medium, fontSize: 11, color: selected ? '#fff' : pal.textPrimary }}>{tab.label}</Text>
                  {tabProductCounts[tab.id] > 0 && (
                    <View style={{ backgroundColor: selected ? 'rgba(255,255,255,0.25)' : colors.primary + '18', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: selected ? '#fff' : colors.primary }}>{tabProductCounts[tab.id]}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: pal.textSecondary, marginTop: 10, marginBottom: 8 }}>{t.home.sortBy}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {productSortOptions.map((sort) => {
              const selected = activeProductSort === sort.id;
              return (
                <Pressable
                  key={sort.id}
                  onPress={() => setActiveProductSort(sort.id)}
                  style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: selected ? pal.primaryTint : pal.chip, borderColor: selected ? pal.primaryBorder : pal.chipBorder }}
                >
                  {selected && <Ionicons name="checkmark" size={13} color={colors.primary} />}
                  <Text style={{ fontFamily: selected ? fonts.bold : fonts.medium, fontSize: 11, color: selected ? colors.primary : pal.textSecondary }}>{sort.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Products grid */}
        <View style={{ backgroundColor: pal.bg, paddingHorizontal: 14, paddingBottom: 16, paddingTop: 8 }}>
          {filteredProducts.length === 0 ? (
            <View style={{ borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: pal.chipBorder, backgroundColor: pal.cardAlt, paddingHorizontal: 20, paddingVertical: 48, marginTop: 4, alignItems: 'center' }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: pal.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <Ionicons name="search-outline" size={28} color={colors.primary} />
              </View>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 15, color: pal.textPrimary }}>{t.home.noProducts}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
                {t.home.noProductsSub(activeProductTabLabel, activeProductSort)}
              </Text>
              <Pressable
                onPress={() => { setActiveProductTab('all'); setActiveProductSort('newest'); }}
                style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20, backgroundColor: colors.primary }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>{t.common.resetFilters}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, marginTop: 4 }}>
              {filteredProducts.map((p, i) => (
                <View key={`${p.id}-${i}`} style={{ width: CARD_WIDTH }}>
                  <ProductCard product={p} />
                </View>
              ))}
            </View>
          )}

          {homeLoadingMore && (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 16 }}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: pal.textSecondary, marginTop: 6 }}>{t.home.loadingMore}</Text>
            </View>
          )}

          {!homeHasMore && filteredProducts.length > 0 && (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 16 }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: pal.textMuted }}>{t.home.allLoaded}</Text>
            </View>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Scroll-to-top FAB ─────────────────────────────────────────────── */}
      {showScrollToTop && (
        <Pressable
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
          style={{
            position: 'absolute', bottom: 24, right: 20,
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: colors.primary,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.25, shadowRadius: 6, elevation: 6,
          }}
        >
          <Ionicons name="arrow-up" size={22} color="#fff" />
        </Pressable>
      )}
    </SafeAreaView>
  );
}
