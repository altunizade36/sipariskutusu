import { Animated, Dimensions, Image, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { colors, fonts } from '../../src/constants/theme';
import { discoverSellers } from '../../src/data/storeData';
import { t } from '../../src/i18n';
import { fetchDiscoverStores, type DiscoverStore } from '../../src/services/storeService';
import { fetchFollowedStoreIds } from '../../src/services/storeFollowService';
import { isSupabaseConfigured } from '../../src/services/supabase';
import { captureError } from '../../src/services/monitoring';
import { FavoriteButton } from '../../src/components/FavoriteButton';
import { ProfileButton } from '../../src/components/ProfileButton';
import { ScrollToTopButton } from '../../src/components/ScrollToTopButton';
import { useListings } from '../../src/context/ListingsContext';
import { useAuth } from '../../src/context/AuthContext';
import { useAndroidTabBackToHome } from '../../src/hooks/useAndroidTabBackToHome';
import { getAlgorithmicExploreSelection, logSellerClick } from '../../src/services/explorePopularityService';
import {
  fetchExploreFeaturedStories,
  fetchSellerPeriodLeaderboard,
  type LeaderboardPeriod,
} from '../../src/services/exploreStoryService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_CARD_WIDTH = (SCREEN_WIDTH - 32 - 8) / 2;
const DEFAULT_SELLER_AVATAR = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&q=80';

type FilterId = 'all' | 'featured' | 'new' | 'topRated' | 'live';

type PopularSellerItem = {
  id: string;
  seller: string;
  sellerKey: string;
  storeName: string;
  image: string;
  badge: string;
  metricLabel: string;
};

const filterChips: { id: FilterId; label: string; icon: string }[] = [
  { id: 'all',       label: t.explore.filterAll,      icon: 'grid-outline' },
  { id: 'featured',  label: t.explore.filterFeatured, icon: 'flame-outline' },
  { id: 'topRated',  label: t.explore.filterTopRated, icon: 'star-outline' },
  { id: 'new',       label: t.explore.filterNew,      icon: 'sparkles-outline' },
  { id: 'live',      label: t.explore.filterLive,     icon: 'radio-outline' },
];

function buildPalette(dark: boolean) {
  return {
    bg:            dark ? '#0A0F1E' : '#F2F3F7',
    card:          dark ? '#111827' : '#FFFFFF',
    cardAlt:       dark ? '#1A2235' : '#F8FAFC',
    border:        dark ? '#1E293B' : '#E5E7EB',
    borderFaint:   dark ? '#1E293B60' : '#33333315',
    textPrimary:   dark ? '#E5E7EB' : '#0D2347',
    textSecondary: dark ? '#94A3B8' : '#6B7280',
    textMuted:     dark ? '#4B5563' : '#9CA3AF',
    chip:          dark ? '#1E293B' : '#F7F7F7',
    chipBorder:    dark ? '#334155' : '#E5E7EB',
    searchBg:      dark ? '#1E293B' : '#F7F7F7',
    primaryTint:   dark ? '#172554' : '#EFF6FF',
    primaryBorder: dark ? '#1E40AF' : '#BFDBFE',
    badge:         dark ? '#1E293B' : '#EFF6FF',
    badgeText:     dark ? '#93C5FD' : colors.primary,
    followedBg:    dark ? '#172554' : '#EFF6FF',
  };
}

function PulsingDot({ color = '#fff' }: { color?: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.7, duration: 650, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(scale, { toValue: 1,   duration: 650, useNativeDriver: Platform.OS !== 'web' }),
      ])
    ).start();
  }, [scale]);
  return <Animated.View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color, transform: [{ scale }] }} />;
}

function SkeletonBox({ w, h, radius = 8 }: { w: number | string; h: number; radius?: number }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [opacity]);
  return (
    <Animated.View style={{ width: w as number, height: h, borderRadius: radius, backgroundColor: '#CBD5E1', opacity }} />
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  useAndroidTabBackToHome();
  const { user, isDarkMode } = useAuth();
  const pal = buildPalette(isDarkMode);
  const { allProducts, followedSellers, toggleSellerFollow, setFollowedSellersMap } = useListings();
  const scrollViewRef = useRef<ScrollView>(null);

  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [backendSellers, setBackendSellers] = useState<DiscoverStore[]>([]);
  const [rankedSellers, setRankedSellers] = useState<DiscoverStore[]>([]);
  const [isRankingLoading, setIsRankingLoading] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [featuredStories, setFeaturedStories] = useState<any[]>([]);
  const [leaderboardEntries, setLeaderboardEntries] = useState<any[]>([]);
  const [popularPeriod, setPopularPeriod] = useState<LeaderboardPeriod>('weekly');
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [gridSort, setGridSort] = useState<'default' | 'rating' | 'followers' | 'az'>('default');

  const canUseBackend = isSupabaseConfigured && Boolean(user) && !user?.id.startsWith('demo-');
  const isSeller = (user?.user_metadata as { account_role?: string } | undefined)?.account_role === 'seller';

  function parseFollowersText(value: string) {
    const normalized = value.replace(',', '.').trim().toUpperCase();
    if (normalized.endsWith('B')) {
      const raw = Number.parseFloat(normalized.slice(0, -1));
      if (!Number.isNaN(raw)) return Math.round(raw * 1000);
    }
    const asNumber = Number.parseInt(normalized.replace(/[^0-9]/g, ''), 10);
    return Number.isNaN(asNumber) ? 0 : asNumber;
  }

  function formatFollowersCount(value: number) {
    return value >= 1000 ? `${(value / 1000).toFixed(1)}B` : `${value}`;
  }

  // ─── Load sellers ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canUseBackend) { setIsLoadingInitial(false); return; }
    let active = true;
    setIsLoadingInitial(true);
    fetchDiscoverStores(24)
      .then(async (stores) => {
        if (!active) return;
        setBackendSellers(stores);
        const followedStoreIds = await fetchFollowedStoreIds(stores.map((s) => s.id));
        if (!active) return;
        const nextMap = stores.reduce<Record<string, boolean>>((acc, store) => {
          acc[store.id] = followedStoreIds.includes(store.id);
          return acc;
        }, {});
        setFollowedSellersMap((current) => ({ ...current, ...nextMap }));
        setIsRankingLoading(true);
        try {
          const algorithmic = await getAlgorithmicExploreSelection(stores, nextMap, 24);
          if (active) { setRankedSellers(algorithmic); setIsLoadingInitial(false); }
        } catch {
          if (active) { setRankedSellers(stores); setIsLoadingInitial(false); }
        } finally {
          if (active) setIsRankingLoading(false);
        }
      })
      .catch((error) => {
        captureError(error, { scope: 'explore_fetch_stores' });
        if (active) setIsLoadingInitial(false);
      });
    return () => { active = false; };
  }, [canUseBackend, setFollowedSellersMap]);

  // ─── Load featured stories ─────────────────────────────────────────────────
  useEffect(() => {
    if (!canUseBackend) { setFeaturedStories([]); return; }
    let active = true;
    fetchExploreFeaturedStories(18)
      .then((stories) => { if (active) setFeaturedStories(stories); })
      .catch((error) => { captureError(error, { scope: 'explore_featured_stories' }); if (active) setFeaturedStories([]); });
    return () => { active = false; };
  }, [canUseBackend]);

  // ─── Load leaderboard ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!canUseBackend) { setLeaderboardEntries([]); return; }
    let active = true;
    setIsLeaderboardLoading(true);
    fetchSellerPeriodLeaderboard(popularPeriod, 40)
      .then((leaderboard) => { if (active) setLeaderboardEntries(leaderboard); })
      .catch((error) => { captureError(error, { scope: 'explore_leaderboard', period: popularPeriod }); if (active) setLeaderboardEntries([]); })
      .finally(() => { if (active) setIsLeaderboardLoading(false); });
    return () => { active = false; };
  }, [canUseBackend, popularPeriod]);

  const sellerSource = useMemo(
    () => (rankedSellers.length > 0 ? rankedSellers : backendSellers.length > 0 ? backendSellers : discoverSellers),
    [rankedSellers, backendSellers],
  );

  // ─── Popular sellers ──────────────────────────────────────────────────────
  const popularSellerItems = useMemo<PopularSellerItem[]>(() => {
    if (leaderboardEntries.length > 0) {
      return leaderboardEntries.slice(0, 12).map((seller, index) => ({
        id: `ranked-seller-profile-${seller.sellerId}`,
        seller: seller.storeName || seller.sellerName,
        sellerKey: seller.sellerId,
        storeName: seller.storeName || seller.sellerName,
        image: seller.sellerAvatar || sellerSource.find((item) => item.id === seller.sellerId)?.avatar || DEFAULT_SELLER_AVATAR,
        badge: index < 3 ? `#${index + 1}` : seller.sales > 0 ? t.explore.badgeSale : seller.rating >= 4.8 ? t.explore.badgeStar : seller.follows > 0 ? t.explore.badgeFollow : t.explore.badgePopular,
        metricLabel: seller.sales > 0 ? t.explore.metricSales(Math.round(seller.sales)) : seller.follows > 0 ? t.explore.metricFollowers(Math.round(seller.follows)) : t.explore.metricScore(Math.round(seller.score)),
      }));
    }
    if (featuredStories.length > 0) {
      const seenSellerIds = new Set<string>();
      return featuredStories
        .filter((item: any) => { if (!item.sellerId || seenSellerIds.has(item.sellerId)) return false; seenSellerIds.add(item.sellerId); return true; })
        .map((item: any, index: number) => {
          const seller = sellerSource.find((s) => s.id === item.sellerId);
          return { id: `popular-seller-${item.sellerId}`, seller: seller?.name || item.sellerName, sellerKey: item.sellerId, storeName: seller?.name || item.sellerName, image: seller?.avatar || item.sellerAvatar || DEFAULT_SELLER_AVATAR, badge: index < 3 ? `#${index + 1}` : item.isLive ? t.explore.live : t.explore.badgePopular, metricLabel: seller ? t.explore.metricRating(seller.rating) : t.explore.featuring };
        });
    }
    return [...sellerSource]
      .sort((a, b) => { if (Number(b.featured) !== Number(a.featured)) return Number(b.featured) - Number(a.featured); if (b.rating !== a.rating) return b.rating - a.rating; return parseFollowersText(b.followers) - parseFollowersText(a.followers); })
      .slice(0, 12)
      .map((seller, index) => ({ id: `popular-seller-${seller.id}`, seller: seller.name, sellerKey: seller.id, storeName: seller.name, image: seller.avatar, badge: index < 3 ? `#${index + 1}` : seller.rating >= 4.8 ? t.explore.badgeStar : seller.featured ? t.explore.badgePopular : t.explore.badgeFollow, metricLabel: seller.rating >= 4.8 ? t.explore.metricRating(seller.rating) : t.explore.metricFollowersText(seller.followers) }));
  }, [featuredStories, leaderboardEntries, sellerSource]);

  const exploreStorySourceLabel = featuredStories.length > 0 ? t.explore.sourceLabel : leaderboardEntries.length > 0 ? t.explore.sourceLabelRanked : canUseBackend ? t.explore.sourceLabelLoading : t.explore.sourceLabel;

  const featuredSellers = sellerSource.filter((seller) => seller.featured);

  const filterChipCounts = useMemo<Record<FilterId, number>>(() => ({
    all:      sellerSource.length,
    featured: sellerSource.filter((s) => s.featured).length,
    topRated: sellerSource.filter((s) => s.rating >= 4.7).length,
    new:      sellerSource.filter((s) => !s.featured).length,
    live:     sellerSource.filter((s) => s.tags.some((tag) => tag.toLowerCase().includes('canl'))).length,
  }), [sellerSource]);

  const filteredSellers = useMemo(() => {
    if (activeFilter === 'featured') return sellerSource.filter((s) => s.featured);
    if (activeFilter === 'topRated') return [...sellerSource].sort((a, b) => b.rating - a.rating);
    if (activeFilter === 'new') return sellerSource.filter((s) => !s.featured);
    if (activeFilter === 'live') return sellerSource.filter((s) => s.tags.some((tag) => tag.toLowerCase().includes('canl')));
    return sellerSource;
  }, [activeFilter, sellerSource]);

  const displayedSellers = useMemo(() => {
    if (gridSort === 'rating') return [...filteredSellers].sort((a, b) => b.rating - a.rating);
    if (gridSort === 'followers') return [...filteredSellers].sort((a, b) => parseFollowersText(b.followers) - parseFollowersText(a.followers));
    if (gridSort === 'az') return [...filteredSellers].sort((a, b) => a.name.localeCompare(b.name));
    return filteredSellers;
  }, [filteredSellers, gridSort]);

  function openSellerStore(params: { name: string; storeKey?: string; sellerId?: string }) {
    const encodedName = encodeURIComponent(params.name);
    const storeKeyQuery = params.storeKey ? `&storeKey=${encodeURIComponent(params.storeKey)}` : '';
    const sellerIdQuery = params.sellerId ? `&sellerId=${encodeURIComponent(params.sellerId)}` : '';
    if (user && params.sellerId) { logSellerClick(params.sellerId, user.id, 'explore_grid').catch(() => {}); }
    router.push(`/(tabs)/store?name=${encodedName}${storeKeyQuery}${sellerIdQuery}`);
  }

  function openPopularSeller(item: PopularSellerItem) {
    const seller = sellerSource.find((s) => s.id === item.sellerKey);
    openSellerStore({ name: seller?.name || item.storeName || item.seller, storeKey: item.sellerKey, sellerId: item.sellerKey });
  }

  async function handleRefresh() {
    if (!canUseBackend) return;
    setIsRefreshing(true);
    try {
      const stores = await fetchDiscoverStores(24);
      setBackendSellers(stores);
      const algorithmic = await getAlgorithmicExploreSelection(stores, {}, 24).catch(() => stores);
      setRankedSellers(algorithmic);
    } catch { /* silent */ } finally { setIsRefreshing(false); }
  }

  function toggleFollow(id: string) { toggleSellerFollow(id); }

  const followedIds = useMemo(() => Object.entries(followedSellers).filter(([, v]) => v).map(([id]) => id), [followedSellers]);
  const followedSellersData = useMemo(() => sellerSource.filter((s) => followedIds.includes(s.id)), [sellerSource, followedIds]);

  const badgeColors: Record<string, string> = { '#1': '#F59E0B', '#2': '#9CA3AF', '#3': '#CD7F32' };
  const sortLabel = gridSort === 'default' ? t.explore.sort : gridSort === 'rating' ? t.explore.sortRating : gridSort === 'followers' ? t.explore.sortFollowers : t.explore.sortAZ;

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: pal.bg }} edges={['top']}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={{ backgroundColor: pal.card, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: pal.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: pal.textPrimary, letterSpacing: -0.5 }}>
              {t.explore.title}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.textSecondary, marginTop: 2 }}>
              {t.explore.subtitle}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <FavoriteButton />
            <Pressable
              onPress={() => router.push('/seller-leaderboard' as never)}
              style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}
            >
              <Ionicons name="trophy-outline" size={18} color="#D97706" />
            </Pressable>
            <ProfileButton />
          </View>
        </View>

        <Pressable
          onPress={() => router.push('/search')}
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: pal.searchBg, borderRadius: 14, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: pal.chipBorder }}
        >
          <Ionicons name="search" size={18} color={pal.textMuted} />
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: pal.textMuted, flex: 1, marginLeft: 8 }}>
            Satıcı, mağaza veya uzmanlık ara
          </Text>
          <View style={{ width: 1, height: 18, backgroundColor: pal.border, marginHorizontal: 8 }} />
          <Ionicons name="options-outline" size={18} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        onScroll={({ nativeEvent }) => setShowScrollToTop(nativeEvent.contentOffset.y > 300)}
        scrollEventThrottle={16}
      >

        {/* ── Hero Banner ──────────────────────────────────────────────────── */}
        <Pressable onPress={() => router.push('/seller-leaderboard' as never)} style={{ marginHorizontal: 16, marginTop: 14, borderRadius: 22, overflow: 'hidden' }}>
          <LinearGradient
            colors={['#0F172A', '#1E3A5F', '#1E40AF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 20 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <PulsingDot color={colors.danger} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.danger }}>CANLI</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: '#94A3B8' }}>·  {t.explore.liveActive(filterChipCounts.live)}</Text>
            </View>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: '#fff', letterSpacing: -0.5 }}>
              {t.explore.risingThisWeek}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: '#CBD5E1', marginTop: 6, lineHeight: 19 }}>
              {t.explore.risingThisWeekSub}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, alignItems: 'center' }}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>{t.explore.showcases(sellerSource.length)}</Text>
              </View>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>
                  {t.explore.followCount(followedIds.length)}
                </Text>
              </View>
              <View style={{ flex: 1 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#93C5FD' }}>{t.explore.leaderboard}</Text>
                <Ionicons name="chevron-forward" size={13} color="#93C5FD" />
              </View>
            </View>
          </LinearGradient>
        </Pressable>

        {/* ── Popular Sellers ──────────────────────────────────────────────── */}
        <View style={{ backgroundColor: pal.card, marginTop: 10, paddingTop: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: pal.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="trophy" size={15} color="#F59E0B" />
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 15, color: pal.textPrimary }}>
                  {t.explore.popularSellers}
                </Text>
              </View>
              <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 11, color: pal.textSecondary, marginTop: 3 }}>
                {isLeaderboardLoading ? t.common.loading : exploreStorySourceLabel}
              </Text>
            </View>
            <Pressable onPress={() => router.push('/seller-leaderboard' as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>{t.explore.seeAll}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </Pressable>
          </View>

          {/* Period selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 6, paddingBottom: 10 }}>
            {([
              { id: 'daily' as LeaderboardPeriod,   label: t.explore.periodDaily },
              { id: 'weekly' as LeaderboardPeriod,  label: t.explore.periodWeekly },
              { id: 'monthly' as LeaderboardPeriod, label: t.explore.periodMonthly },
              { id: 'yearly' as LeaderboardPeriod,  label: t.explore.periodYearly },
              { id: 'all' as LeaderboardPeriod,     label: t.explore.periodAll },
            ]).map((p) => {
              const active = popularPeriod === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setPopularPeriod(p.id)}
                  style={{ height: 28, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.primary : pal.chip, borderColor: active ? colors.primary : pal.chipBorder }}
                >
                  <Text style={{ fontFamily: active ? fonts.bold : fonts.medium, fontSize: 11, color: active ? '#fff' : pal.textSecondary }}>{p.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Seller circles */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 14, paddingBottom: 4 }}>
            {isLoadingInitial
              ? Array.from({ length: 6 }).map((_, i) => (
                  <View key={`sk-${i}`} style={{ width: 88, alignItems: 'center', gap: 8 }}>
                    <SkeletonBox w={76} h={76} radius={38} />
                    <SkeletonBox w={64} h={10} />
                    <SkeletonBox w={48} h={8} />
                  </View>
                ))
              : popularSellerItems.map((item, idx) => {
                  const ringColor = idx === 0 ? '#F59E0B' : idx === 1 ? '#9CA3AF' : idx === 2 ? '#CD7F32' : colors.primary;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => openPopularSeller(item)}
                      style={{ alignItems: 'center', width: Math.min(104, Math.max(88, SCREEN_WIDTH / 4.2)) }}
                    >
                      <View style={{ position: 'relative' }}>
                        <View style={{ width: 80, height: 80, borderRadius: 40, padding: 3, borderWidth: 2.5, borderColor: ringColor, backgroundColor: pal.primaryTint, overflow: 'hidden' }}>
                          <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%', borderRadius: 36 }} resizeMode="cover" />
                        </View>
                        <View style={{ position: 'absolute', bottom: -4, alignSelf: 'center', left: '50%', transform: [{ translateX: -18 }], backgroundColor: badgeColors[item.badge] ?? colors.primary, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1.5, borderColor: pal.card, minWidth: 36, alignItems: 'center' }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: '#fff' }}>{item.badge}</Text>
                        </View>
                      </View>
                      <Text numberOfLines={2} style={{ fontFamily: fonts.medium, fontSize: 11, color: pal.textPrimary, textAlign: 'center', marginTop: 9, lineHeight: 14 }}>
                        {item.storeName || item.seller}
                      </Text>
                      <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 9, color: pal.textMuted, marginTop: 2 }}>
                        {item.metricLabel}
                      </Text>
                    </Pressable>
                  );
                })
            }
          </ScrollView>
        </View>

        {/* ── Editörün Seçimi ──────────────────────────────────────────────── */}
        {featuredStories.length > 0 && (
          <View style={{ backgroundColor: pal.card, paddingTop: 16, paddingBottom: 16, marginTop: 6, borderBottomWidth: 1, borderBottomColor: pal.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 14 }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <View style={{ backgroundColor: colors.primary, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 8, color: '#fff', letterSpacing: 0.9 }}>{t.explore.adminPick}</Text>
                  </View>
                  <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#22C55E' }} />
                  <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: '#22C55E' }}>Canlı</Text>
                </View>
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 15, color: pal.textPrimary }}>{t.explore.editorsPick}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: pal.textSecondary, marginTop: 3 }}>{t.explore.editorsPickSub}</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 4 }}>
              {featuredStories.slice(0, 12).map((story: any) => {
                const badgeColor = story.featuredType === 'trending' ? '#EF4444' : story.featuredType === 'weekly' ? '#F59E0B' : colors.primary;
                const badgeLabel = story.featuredType === 'trending' ? t.explore.badgeTrending : story.featuredType === 'weekly' ? t.explore.badgeWeekly : t.explore.badgePioneer;
                return (
                  <Pressable
                    key={story.id}
                    onPress={() => router.push(`/story-viewer?storyId=${encodeURIComponent(story.storyId)}&sellerKey=${encodeURIComponent(story.sellerId)}` as never)}
                    style={{ width: 116, height: 194, borderRadius: 18, overflow: 'hidden', borderWidth: 2.5, borderColor: colors.primary }}
                  >
                    <Image source={{ uri: story.imageUrl }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.94)']} locations={[0.3, 0.65, 1]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 96, justifyContent: 'flex-end', padding: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Image source={{ uri: story.sellerAvatar }} style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#fff' }} resizeMode="cover" />
                        <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff', flex: 1 }}>{story.sellerName}</Text>
                      </View>
                      {story.priceTag ? (
                        <View style={{ backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginTop: 5, alignSelf: 'flex-start' }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: '#fff' }}>{story.priceTag}</Text>
                        </View>
                      ) : story.productTitle ? (
                        <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{story.productTitle}</Text>
                      ) : null}
                    </LinearGradient>
                    <View style={{ position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ backgroundColor: badgeColor, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 7, color: '#fff', letterSpacing: 0.4 }}>{badgeLabel}</Text>
                      </View>
                      {story.isLive && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(239,68,68,0.88)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 }}>
                          <PulsingDot color="#fff" />
                          <Text style={{ fontFamily: fonts.bold, fontSize: 7, color: '#fff' }}>CANLI</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Satıcı Ol CTA (non-sellers only) ────────────────────────────── */}
        {user && !isSeller && (
          <Pressable
            onPress={() => router.push('/store-setup')}
            style={{ marginHorizontal: 16, marginTop: 10, borderRadius: 18, overflow: 'hidden' }}
          >
            <LinearGradient
              colors={['#7C3AED', '#4F46E5', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16, gap: 14 }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22 }}>🏪</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 14, color: '#fff' }}>Sen de Satış Yap!</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 3 }}>Ücretsiz mağaza aç · {sellerSource.length}+ aktif satıcıya katıl</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" />
            </LinearGradient>
          </Pressable>
        )}

        {/* ── Followed Sellers Strip ───────────────────────────────────────── */}
        {followedSellersData.length > 0 && (
          <View style={{ backgroundColor: pal.card, marginHorizontal: 16, marginTop: 10, borderRadius: 20, borderWidth: 1, borderColor: pal.border, padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="heart" size={14} color="#EF4444" />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: pal.textPrimary }}>{t.explore.following}</Text>
              </View>
              <View style={{ backgroundColor: pal.primaryTint, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: pal.badgeText }}>{t.explore.followingCount(followedSellersData.length)}</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
              {followedSellersData.map((seller) => (
                <Pressable
                  key={seller.id}
                  onPress={() => openSellerStore({ name: seller.name, storeKey: seller.id, sellerId: seller.id })}
                  style={{ alignItems: 'center', width: 62 }}
                >
                  <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2.5, borderColor: colors.primary, overflow: 'hidden' }}>
                    <Image source={{ uri: seller.avatar }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  </View>
                  <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 9, color: pal.textPrimary, marginTop: 5, textAlign: 'center', width: 62 }}>{seller.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Filter chips ─────────────────────────────────────────────────── */}
        <View style={{ backgroundColor: pal.card, paddingTop: 14, paddingBottom: 12, marginTop: 10, borderBottomWidth: 1, borderBottomColor: pal.border }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}>
            {filterChips.map((chip) => {
              const active = activeFilter === chip.id;
              const count = filterChipCounts[chip.id];
              return (
                <Pressable
                  key={chip.id}
                  onPress={() => setActiveFilter(chip.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 36, borderRadius: 18, borderWidth: 1, gap: 5, backgroundColor: active ? colors.primary : pal.chip, borderColor: active ? colors.primary : pal.chipBorder }}
                >
                  <Ionicons name={chip.icon as any} size={13} color={active ? '#fff' : pal.textSecondary} />
                  <Text style={{ fontFamily: active ? fonts.bold : fonts.medium, fontSize: 12, color: active ? '#fff' : pal.textPrimary }}>{chip.label}</Text>
                  {count > 0 && !active && (
                    <View style={{ backgroundColor: pal.border, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: pal.textSecondary }}>{count}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Featured Sellers (horizontal scroll cards) ───────────────────── */}
        {(activeFilter === 'all' || activeFilter === 'featured') && featuredSellers.length > 0 && (
          <View style={{ backgroundColor: pal.bg, paddingTop: 16, paddingBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="flame" size={15} color="#EF4444" />
                  <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: pal.textPrimary }}>{t.explore.featuredStores}</Text>
                </View>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.textSecondary, marginTop: 2 }}>{t.explore.featuredStoresSub}</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 8 }}>
              {featuredSellers.map((seller) => {
                const followed = Boolean(followedSellers[seller.id]);
                const displayFollowers = formatFollowersCount(parseFollowersText(seller.followers) + (followed ? 1 : 0));
                return (
                  <Pressable
                    key={seller.id}
                    onPress={() => openSellerStore({ name: seller.name, storeKey: seller.id, sellerId: seller.id })}
                    style={{ width: 284, backgroundColor: pal.card, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: pal.border }}
                  >
                    {/* Cover with gradient overlay */}
                    <View style={{ position: 'relative', height: 110 }}>
                      <Image source={{ uri: seller.coverImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 }} />
                      <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: pal.primaryTint, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: pal.badgeText }}>{seller.category}</Text>
                      </View>
                    </View>

                    <View style={{ padding: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Image source={{ uri: seller.avatar }} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.primary }} resizeMode="cover" />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: pal.textPrimary }}>{seller.name}</Text>
                          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: pal.textSecondary }}>
                            {seller.username} · {seller.city}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.textPrimary, marginTop: 10, lineHeight: 17 }}>{seller.headline}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                        <View>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: pal.textPrimary }}>{displayFollowers}</Text>
                          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: pal.textSecondary }}>{t.store.followers}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Ionicons name="star" size={13} color="#F59E0B" />
                          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: pal.textPrimary }}>{seller.rating}</Text>
                        </View>
                        <Pressable
                          onPress={(e) => { e.stopPropagation(); toggleFollow(seller.id); }}
                          style={{ backgroundColor: followed ? pal.cardAlt : colors.primary, borderColor: followed ? pal.border : colors.primary, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 }}
                        >
                          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: followed ? pal.textPrimary : '#fff' }}>
                            {followed ? 'Takip Ediliyor' : 'Takip Et'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Seller Grid ──────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="storefront-outline" size={15} color={pal.textSecondary} />
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: pal.textPrimary }}>{t.explore.storeFlow}</Text>
              </View>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.textSecondary, marginTop: 2 }}>{t.explore.storeFlowSub(displayedSellers.length)}</Text>
            </View>
            <Pressable
              onPress={() => setGridSort((prev) => prev === 'default' ? 'rating' : prev === 'rating' ? 'followers' : prev === 'followers' ? 'az' : 'default')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: gridSort !== 'default' ? pal.primaryTint : pal.cardAlt, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: gridSort !== 'default' ? pal.primaryBorder : pal.border }}
            >
              <Ionicons name="swap-vertical-outline" size={13} color={gridSort !== 'default' ? colors.primary : pal.textSecondary} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: gridSort !== 'default' ? colors.primary : pal.textSecondary }}>{sortLabel}</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          {isLoadingInitial ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonBox key={`grid-sk-${i}`} w={GRID_CARD_WIDTH} h={280} radius={20} />
              ))}
            </View>
          ) : filteredSellers.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 56 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: pal.cardAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Ionicons name="storefront-outline" size={32} color={pal.textMuted} />
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: pal.textPrimary }}>{t.explore.noStore}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: pal.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>{t.explore.noStoreSub}</Text>
              <Pressable onPress={() => setActiveFilter('all')} style={{ backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10, marginTop: 18 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{t.explore.showAll}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {displayedSellers.map((seller) => {
                const followed = Boolean(followedSellers[seller.id]);
                const isLive = seller.tags.some((tag) => tag.toLowerCase().includes('canl'));
                const displayFollowers = formatFollowersCount(parseFollowersText(seller.followers) + (followed ? 1 : 0));
                const sellerProducts = allProducts.filter((p) => p.sellerId === seller.id).slice(0, 3);
                return (
                  <Pressable
                    key={seller.id}
                    onPress={() => openSellerStore({ name: seller.name, storeKey: seller.id, sellerId: seller.id })}
                    style={{ width: GRID_CARD_WIDTH, backgroundColor: pal.card, borderRadius: 20, borderWidth: 1, borderColor: pal.border, overflow: 'hidden' }}
                  >
                    {/* Cover */}
                    <View style={{ position: 'relative', height: 90 }}>
                      <Image source={{ uri: seller.coverImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.45)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 48 }} />
                      {isLive && (
                        <View style={{ position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.danger, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 }}>
                          <PulsingDot color="#fff" />
                          <Text style={{ fontFamily: fonts.bold, fontSize: 8, color: '#fff' }}>CANLI</Text>
                        </View>
                      )}
                      <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: isDarkMode ? 'rgba(30,37,57,0.9)' : 'rgba(255,255,255,0.9)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 8, color: colors.primary }}>{seller.category}</Text>
                      </View>
                    </View>

                    <View style={{ padding: 12 }}>
                      {/* Avatar + name */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Image source={{ uri: seller.avatar }} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: colors.primary }} resizeMode="cover" />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 12, color: pal.textPrimary, flex: 1 }}>{seller.name}</Text>
                            {seller.rating >= 4.8 && <Ionicons name="checkmark-circle" size={12} color={colors.primary} />}
                          </View>
                          <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 10, color: pal.textSecondary }}>{seller.city}</Text>
                        </View>
                      </View>

                      {/* Headline */}
                      <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 11, color: pal.textPrimary, lineHeight: 16, marginTop: 8, minHeight: 32 }}>
                        {seller.headline}
                      </Text>

                      {/* Tags */}
                      {seller.tags && seller.tags.length > 0 && (
                        <View style={{ flexDirection: 'row', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                          {seller.tags.slice(0, 2).map((tag) => (
                            <View key={tag} style={{ backgroundColor: pal.cardAlt, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: pal.border }}>
                              <Text style={{ fontFamily: fonts.medium, fontSize: 9, color: pal.textSecondary }}>{tag}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Product thumbnails */}
                      <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
                        {sellerProducts.length > 0
                          ? sellerProducts.map((product) => (
                              <Image key={product.id} source={{ uri: product.image }} style={{ width: (GRID_CARD_WIDTH - 24 - 8) / 3, height: (GRID_CARD_WIDTH - 24 - 8) / 3, borderRadius: 8 }} resizeMode="cover" />
                            ))
                          : null}
                        {Array.from({ length: Math.max(0, 3 - sellerProducts.length) }).map((_, i) => (
                          <View key={`ph-${i}`} style={{ width: (GRID_CARD_WIDTH - 24 - 8) / 3, height: (GRID_CARD_WIDTH - 24 - 8) / 3, borderRadius: 8, backgroundColor: pal.cardAlt }} />
                        ))}
                      </View>

                      {/* Stats */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: pal.borderFaint }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="people-outline" size={12} color={pal.textMuted} />
                          <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: pal.textSecondary }}>{displayFollowers}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Ionicons name="star" size={11} color="#F59E0B" />
                          <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: pal.textSecondary }}>{seller.rating}</Text>
                        </View>
                      </View>

                      {/* Follow button */}
                      <Pressable
                        onPress={(e) => { e.stopPropagation(); toggleFollow(seller.id); }}
                        style={{ backgroundColor: followed ? pal.cardAlt : colors.primary, borderColor: followed ? pal.border : colors.primary, borderWidth: 1, marginTop: 8, borderRadius: 20, height: 34, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 }}
                      >
                        {followed && <Ionicons name="checkmark" size={13} color={pal.textSecondary} />}
                        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: followed ? pal.textPrimary : '#fff' }}>
                          {followed ? 'Takipte' : 'Takip Et'}
                        </Text>
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      <ScrollToTopButton
        visible={showScrollToTop}
        onPress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
      />
    </SafeAreaView>
  );
}
