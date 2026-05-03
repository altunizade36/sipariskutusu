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
import SkeletonCard from '../../src/components/SkeletonCard';
import { ScrollToTopButton } from '../../src/components/ScrollToTopButton';
import { useListings } from '../../src/context/ListingsContext';
import { useAuth } from '../../src/context/AuthContext';
import { useAndroidTabBackToHome } from '../../src/hooks/useAndroidTabBackToHome';
import { getAlgorithmicExploreSelection, logSellerClick, logSellerImpression } from '../../src/services/explorePopularityService';
import {
  fetchExploreFeaturedStories,
  fetchSellerPeriodLeaderboard,
  type LeaderboardPeriod,
} from '../../src/services/exploreStoryService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_CARD_WIDTH = (SCREEN_WIDTH - 32 - 8) / 2; // 16px padding each side + 8px gap
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
  { id: 'all', label: t.explore.filterAll, icon: 'grid-outline' },
  { id: 'featured', label: t.explore.filterFeatured, icon: 'flame-outline' },
  { id: 'topRated', label: t.explore.filterTopRated, icon: 'star-outline' },
  { id: 'new', label: t.explore.filterNew, icon: 'sparkles-outline' },
  { id: 'live', label: t.explore.filterLive, icon: 'radio-outline' },
];

// Skeleton loader component for seller cards
// Note: Product preview images are now loaded from real store listings via fetchDiscoverStores()
// which includes store data with actual product images from Supabase storage

function PulsingDot({ color = '#fff' }: { color?: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.7, duration: 650, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(scale, { toValue: 1, duration: 650, useNativeDriver: Platform.OS !== 'web' }),
      ])
    ).start();
  }, [scale]);
  return (
    <Animated.View
      style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color, transform: [{ scale }] }}
    />
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  useAndroidTabBackToHome();
  const { user } = useAuth();
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
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}B`;
    }
    return `${value}`;
  }

  useEffect(() => {
    if (!canUseBackend) {
      setIsLoadingInitial(false);
      return;
    }

    let active = true;

    setIsLoadingInitial(true);
    fetchDiscoverStores(24)
      .then(async (stores) => {
        if (!active) {
          return;
        }

        setBackendSellers(stores);

        const followedStoreIds = await fetchFollowedStoreIds(stores.map((store) => store.id));
        if (!active) {
          return;
        }

        const nextMap = stores.reduce<Record<string, boolean>>((acc, store) => {
          acc[store.id] = followedStoreIds.includes(store.id);
          return acc;
        }, {});
        setFollowedSellersMap((current) => ({ ...current, ...nextMap }));

        // Apply algorithmic ranking
        setIsRankingLoading(true);
        try {
          const algorithmic = await getAlgorithmicExploreSelection(stores, nextMap, 24);
          if (active) {
            setRankedSellers(algorithmic);
            setIsLoadingInitial(false);
          }
        } catch (error) {
          console.error('Ranking failed:', error);
          if (active) {
            setRankedSellers(stores);
            setIsLoadingInitial(false);
          }
        } finally {
          if (active) {
            setIsRankingLoading(false);
          }
        }
      })
      .catch((error) => {
        captureError(error, { scope: 'explore_fetch_stores' });
        if (active) {
          setIsLoadingInitial(false);
        }
      });

    return () => {
      active = false;
    };
  }, [canUseBackend, setFollowedSellersMap]);

  const sellerSource = useMemo(
    () => (rankedSellers.length > 0 ? rankedSellers : backendSellers.length > 0 ? backendSellers : discoverSellers),
    [rankedSellers, backendSellers],
  );

  useEffect(() => {
    if (!canUseBackend) {
      setFeaturedStories([]);
      return;
    }

    let active = true;

    fetchExploreFeaturedStories(18)
      .then((stories) => {
        if (!active) return;
        setFeaturedStories(stories);
      })
      .catch((error) => {
        captureError(error, { scope: 'explore_featured_stories' });
        if (active) setFeaturedStories([]);
      });

    return () => {
      active = false;
    };
  }, [canUseBackend]);

  useEffect(() => {
    if (!canUseBackend) {
      setLeaderboardEntries([]);
      return;
    }

    let active = true;
    setIsLeaderboardLoading(true);

    fetchSellerPeriodLeaderboard(popularPeriod, 40)
      .then((leaderboard) => {
        if (!active) return;
        setLeaderboardEntries(leaderboard);
      })
      .catch((error) => {
        captureError(error, { scope: 'explore_leaderboard', period: popularPeriod });
        if (active) setLeaderboardEntries([]);
      })
      .finally(() => {
        if (active) setIsLeaderboardLoading(false);
      });

    return () => {
      active = false;
    };
  }, [canUseBackend, popularPeriod]);

  const popularSellerItems = useMemo<PopularSellerItem[]>(() => {
    if (leaderboardEntries.length > 0) {
      return leaderboardEntries.slice(0, 12).map((seller, index) => ({
        id: `ranked-seller-profile-${seller.sellerId}`,
        seller: seller.storeName || seller.sellerName,
        sellerKey: seller.sellerId,
        storeName: seller.storeName || seller.sellerName,
        image: seller.sellerAvatar || sellerSource.find((item) => item.id === seller.sellerId)?.avatar || DEFAULT_SELLER_AVATAR,
        badge: index < 3 ? `#${index + 1}` : seller.sales > 0 ? t.explore.badgeSale : seller.rating >= 4.8 ? t.explore.badgeStar : seller.follows > 0 ? t.explore.badgeFollow : t.explore.badgePopular,
        metricLabel: seller.sales > 0
          ? t.explore.metricSales(Math.round(seller.sales))
          : seller.follows > 0
            ? t.explore.metricFollowers(Math.round(seller.follows))
            : t.explore.metricScore(Math.round(seller.score)),
      }));
    }

    if (featuredStories.length > 0) {
      const seenSellerIds = new Set<string>();

      return featuredStories
        .filter((item: any) => {
          if (!item.sellerId || seenSellerIds.has(item.sellerId)) {
            return false;
          }

          seenSellerIds.add(item.sellerId);
          return true;
        })
        .map((item: any, index: number) => {
          const seller = sellerSource.find((sellerItem) => sellerItem.id === item.sellerId);

          return {
            id: `popular-seller-${item.sellerId}`,
            seller: seller?.name || item.sellerName,
            sellerKey: item.sellerId,
            storeName: seller?.name || item.sellerName,
            image: seller?.avatar || item.sellerAvatar || DEFAULT_SELLER_AVATAR,
            badge: index < 3 ? `#${index + 1}` : item.isLive ? t.explore.live : t.explore.badgePopular,
            metricLabel: seller ? t.explore.metricRating(seller.rating) : t.explore.featuring,
          };
        });
    }

    return [...sellerSource]
      .sort((a, b) => {
        if (Number(b.featured) !== Number(a.featured)) {
          return Number(b.featured) - Number(a.featured);
        }

        if (b.rating !== a.rating) {
          return b.rating - a.rating;
        }

        return parseFollowersText(b.followers) - parseFollowersText(a.followers);
      })
      .slice(0, 12)
      .map((seller, index) => ({
      id: `popular-seller-${seller.id}`,
      seller: seller.name,
      sellerKey: seller.id,
      storeName: seller.name,
      image: seller.avatar,
      badge: index < 3 ? `#${index + 1}` : seller.rating >= 4.8 ? t.explore.badgeStar : seller.featured ? t.explore.badgePopular : t.explore.badgeFollow,
      metricLabel: seller.rating >= 4.8 ? t.explore.metricRating(seller.rating) : t.explore.metricFollowersText(seller.followers),
    }));
  }, [featuredStories, leaderboardEntries, sellerSource]);
  const exploreStorySourceLabel = featuredStories.length > 0
    ? t.explore.sourceLabel
    : leaderboardEntries.length > 0
      ? t.explore.sourceLabelRanked
      : canUseBackend
        ? t.explore.sourceLabelLoading
        : t.explore.sourceLabel;

  function toggleFollow(id: string) {
    toggleSellerFollow(id);
  }

  async function handleRefresh() {
    if (!canUseBackend) return;
    setIsRefreshing(true);
    try {
      const stores = await fetchDiscoverStores(24);
      setBackendSellers(stores);
      const algorithmic = await getAlgorithmicExploreSelection(stores, {}, 24).catch(() => stores);
      setRankedSellers(algorithmic);
    } catch {
      // silently ignore
    } finally {
      setIsRefreshing(false);
    }
  }

  const featuredSellers = sellerSource.filter((seller) => seller.featured);

  const filteredSellers = useMemo(() => {
    if (activeFilter === 'featured') return sellerSource.filter((s) => s.featured);
    if (activeFilter === 'topRated') return [...sellerSource].sort((a, b) => b.rating - a.rating);
    if (activeFilter === 'new') return sellerSource.filter((s) => !s.featured);
    if (activeFilter === 'live') return sellerSource.filter((s) => s.tags.some((t) => t.toLowerCase().includes('canl')));
    return sellerSource;
  }, [activeFilter, sellerSource]);

  const filterChipCounts = useMemo<Record<FilterId, number>>(() => ({
    all: sellerSource.length,
    featured: sellerSource.filter((s) => s.featured).length,
    topRated: sellerSource.filter((s) => s.rating >= 4.7).length,
    new: sellerSource.filter((s) => !s.featured).length,
    live: sellerSource.filter((s) => s.tags.some((t) => t.toLowerCase().includes('canl'))).length,
  }), [sellerSource]);

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
    
    // Log analytics
    if (user && params.sellerId) {
      logSellerClick(params.sellerId, user.id, 'explore_grid').catch(() => {});
    }
    
    router.push(`/(tabs)/store?name=${encodedName}${storeKeyQuery}${sellerIdQuery}`);
  }

  function openPopularSeller(item: PopularSellerItem) {
    const seller = sellerSource.find((sourceItem) => sourceItem.id === item.sellerKey);
    openSellerStore({
      name: seller?.name || item.storeName || item.seller,
      storeKey: item.sellerKey,
      sellerId: item.sellerKey,
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
      {/* ── Header ─────────────────────────── */}
      <View className="bg-white px-4 pt-3 pb-4 border-b border-[#33333315]">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: colors.textPrimary }}>
              {t.explore.title}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>
              {t.explore.subtitle}
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <FavoriteButton />
            <Pressable
              onPress={() => router.push('/seller-leaderboard' as never)}
              className="w-9 h-9 rounded-full items-center justify-center border"
              style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}
            >
              <Ionicons name="trophy-outline" size={19} color="#D97706" />
            </Pressable>
            <ProfileButton />
          </View>
        </View>

        <Pressable
          onPress={() => router.push('/search')}
          className="flex-row items-center bg-[#F7F7F7] rounded-xl px-3 h-11 border border-[#33333315]"
        >
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted }} className="ml-2 flex-1">
            Satıcı, mağaza veya uzmanlık ara
          </Text>
          <Ionicons name="options-outline" size={18} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onScroll={({ nativeEvent }) => {
          setShowScrollToTop(nativeEvent.contentOffset.y > 300);
        }}
        scrollEventThrottle={16}
      >

        {/* ── Popular sellers ───────────────── */}
        <View className="bg-white pt-3 pb-4 border-b border-[#33333315]">
          <View className="flex-row items-center justify-between px-4 mb-2">
            <View className="flex-1 pr-3">
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 14, color: colors.textPrimary }}>
                {t.explore.popularSellers}
              </Text>
              <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                {isLeaderboardLoading ? t.common.loading : exploreStorySourceLabel}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                router.push('/seller-leaderboard' as never);
              }}
              className="flex-row items-center"
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>{t.explore.seeAll}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 14, gap: 6, paddingBottom: 8 }}
          >
            {([
              { id: 'daily' as LeaderboardPeriod, label: t.explore.periodDaily },
              { id: 'weekly' as LeaderboardPeriod, label: t.explore.periodWeekly },
              { id: 'monthly' as LeaderboardPeriod, label: t.explore.periodMonthly },
              { id: 'yearly' as LeaderboardPeriod, label: t.explore.periodYearly },
              { id: 'all' as LeaderboardPeriod, label: t.explore.periodAll },
            ]).map((p) => {
              const active = popularPeriod === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setPopularPeriod(p.id)}
                  style={{
                    height: 28,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active ? colors.primary : '#F7F7F7',
                    borderColor: active ? colors.primary : colors.borderLight,
                  }}
                >
                  <Text style={{ fontFamily: active ? fonts.bold : fonts.medium, fontSize: 11, color: active ? '#fff' : colors.textSecondary }}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 14, gap: 14, paddingBottom: 2 }}
          >
            {isLoadingInitial
              ? Array.from({ length: 6 }).map((_, i) => (
                  <View key={`skeleton-${i}`} style={{ width: Math.min(104, Math.max(94, SCREEN_WIDTH / 4.1)) }}>
                    <View className="w-20 h-20 rounded-full bg-slate-200 self-center mb-2" />
                    <View className="h-3 bg-slate-200 rounded w-full mb-2" />
                    <View className="h-2 bg-slate-200 rounded w-2/3 self-center" />
                  </View>
                ))
              : popularSellerItems.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => openPopularSeller(item)}
                    className="items-center"
                    style={{ width: Math.min(104, Math.max(94, SCREEN_WIDTH / 4.1)) }}
                  >
                    <View className="relative">
                      <View
                        className="rounded-full overflow-hidden"
                        style={{
                          width: 82,
                          height: 82,
                          padding: 3,
                          borderWidth: 2,
                          borderColor: colors.primary,
                          backgroundColor: '#EFF6FF',
                        }}
                      >
                        <Image source={{ uri: item.image }} className="w-full h-full rounded-full" resizeMode="cover" />
                      </View>
                      <View className="absolute -bottom-1 self-center px-2 py-[2px] rounded-full" style={{ backgroundColor: colors.primary }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 8, color: '#fff' }}>{item.badge}</Text>
                      </View>
                    </View>
                    <Text
                      numberOfLines={2}
                      style={{
                        fontFamily: fonts.medium,
                        fontSize: 11,
                        color: colors.textPrimary,
                        textAlign: 'center',
                        marginTop: 7,
                        lineHeight: 14,
                        maxWidth: Math.min(104, Math.max(94, SCREEN_WIDTH / 4.1)),
                      }}
                    >
                      {item.storeName || item.seller}
                    </Text>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 9, color: colors.textMuted, marginTop: 1 }}>
                      {item.metricLabel}
                    </Text>
                  </Pressable>
                ))}
          </ScrollView>
        </View>

        {/* ── Editörün Seçimi (admin-curated featured stories) ── */}
        {featuredStories.length > 0 && (
          <View style={{ backgroundColor: '#fff', paddingTop: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#33333315' }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <View style={{ backgroundColor: colors.primary, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 8, color: '#fff', letterSpacing: 0.9 }}>{t.explore.adminPick}</Text>
                  </View>
                  <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#22C55E' }} />
                  <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: '#22C55E' }}>Canlı</Text>
                </View>
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 15, color: colors.textPrimary }}>{t.explore.editorsPick}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                  {t.explore.editorsPickSub}
                </Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 4 }}
            >
              {featuredStories.slice(0, 12).map((story: any) => {
                const badgeColor =
                  story.featuredType === 'trending' ? '#EF4444'
                  : story.featuredType === 'weekly' ? '#F59E0B'
                  : colors.primary;
                const badgeLabel =
                  story.featuredType === 'trending' ? t.explore.badgeTrending
                  : story.featuredType === 'weekly' ? t.explore.badgeWeekly
                  : t.explore.badgePioneer;
                return (
                  <Pressable
                    key={story.id}
                    onPress={() => {
                      router.push(
                        `/story-viewer?storyId=${encodeURIComponent(story.storyId)}&sellerKey=${encodeURIComponent(story.sellerId)}` as never
                      );
                    }}
                    style={{
                      width: 118,
                      height: 196,
                      borderRadius: 18,
                      overflow: 'hidden',
                      borderWidth: 2.5,
                      borderColor: colors.primary,
                    }}
                  >
                    {/* Story image background */}
                    <Image
                      source={{ uri: story.imageUrl }}
                      style={{ position: 'absolute', width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                    {/* Bottom gradient overlay */}
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.94)']}
                      locations={[0.3, 0.65, 1]}
                      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 96, justifyContent: 'flex-end', padding: 10 }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Image
                          source={{ uri: story.sellerAvatar }}
                          style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#fff' }}
                          resizeMode="cover"
                        />
                        <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff', flex: 1 }}>
                          {story.sellerName}
                        </Text>
                      </View>
                      {story.priceTag ? (
                        <View style={{ backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginTop: 5, alignSelf: 'flex-start' }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: '#fff' }}>{story.priceTag}</Text>
                        </View>
                      ) : story.productTitle ? (
                        <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                          {story.productTitle}
                        </Text>
                      ) : null}
                    </LinearGradient>
                    {/* Top badges row */}
                    <View style={{ position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ backgroundColor: badgeColor, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 7, color: '#fff', letterSpacing: 0.4 }}>{badgeLabel}</Text>
                      </View>
                      {story.isLive && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(239,68,68,0.88)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 }}>
                          <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fff' }} />
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

        {/* ── Filter chips ──────────────────── */}
        <View className="bg-white pt-3 pb-3 border-b border-[#33333315]">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
          >
            {filterChips.map((chip) => {
              const active = activeFilter === chip.id;
              const count = filterChipCounts[chip.id];
              return (
                <Pressable
                  key={chip.id}
                  onPress={() => setActiveFilter(chip.id)}
                  style={{
                    backgroundColor: active ? colors.primary : '#F7F7F7',
                    borderColor: active ? colors.primary : colors.borderLight,
                  }}
                  className="flex-row items-center px-4 h-9 rounded-full border gap-1.5"
                >
                  <Ionicons
                    name={chip.icon as any}
                    size={13}
                    color={active ? '#fff' : colors.textSecondary}
                  />
                  <Text
                    style={{
                      fontFamily: active ? fonts.bold : fonts.medium,
                      fontSize: 12,
                      color: active ? '#fff' : colors.textPrimary,
                    }}
                  >
                    {chip.label}
                  </Text>
                  {count > 0 && !active ? (
                    <View style={{ backgroundColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: colors.textSecondary }}>{count}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Hero banner ───────────────────── */}
        <Pressable
          onPress={() => router.push('/seller-leaderboard' as never)}
          style={{ backgroundColor: '#0F172A' }}
          className="mx-4 mt-4 rounded-[24px] p-5 active:opacity-90"
        >
          <View className="flex-row items-center gap-2 mb-2">
            <PulsingDot color={colors.danger} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.danger }}>{t.explore.live}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: '#94A3B8' }}>· {t.explore.liveActive(filterChipCounts.live)}</Text>
          </View>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: '#fff' }}>
            {t.explore.risingThisWeek}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: '#CBD5E1' }} className="mt-1.5">
            {t.explore.risingThisWeekSub}
          </Text>
          <View className="flex-row gap-2 mt-4 items-center">
            <View className="bg-white/10 rounded-full px-3 py-1.5">
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>{t.explore.showcases(sellerSource.length)}</Text>
            </View>
            <View className="bg-white/10 rounded-full px-3 py-1.5">
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>
                {t.explore.followCount(Object.values(followedSellers).filter(Boolean).length)}
              </Text>
            </View>
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary }}>{t.explore.leaderboard}</Text>
              <Ionicons name="chevron-forward" size={13} color={colors.primary} />
            </View>
          </View>
        </Pressable>

        {/* ── Followed sellers strip ─────────── */}
        {(() => {
          const followedIds = Object.entries(followedSellers)
            .filter(([, v]) => v)
            .map(([id]) => id);
          const followedSellersData = sellerSource.filter((s) => followedIds.includes(s.id));
          if (followedSellersData.length === 0) return null;
          return (
            <View
              style={{ backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 20, borderWidth: 1, borderColor: '#33333315', padding: 12 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>{t.explore.following}</Text>
                <View style={{ backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.primary }}>{t.explore.followingCount(followedSellersData.length)}</Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                {followedSellersData.map((seller) => (
                  <Pressable
                    key={seller.id}
                    onPress={() => openSellerStore({ name: seller.name, storeKey: seller.id, sellerId: seller.id })}
                    style={{ alignItems: 'center', width: 60 }}
                  >
                    <View
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 23,
                        borderWidth: 2,
                        borderColor: colors.primary,
                        overflow: 'hidden',
                      }}
                    >
                      <Image source={{ uri: seller.avatar }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={{ fontFamily: fonts.medium, fontSize: 9, color: colors.textPrimary, marginTop: 5, textAlign: 'center', width: 60 }}
                    >
                      {seller.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          );
        })()}

        {/* ── Featured sellers (horizontal cards) ─── */}
        {(activeFilter === 'all' || activeFilter === 'featured') ? (
          <>
            <View className="px-4 mt-5 mb-3 flex-row items-center justify-between">
              <View>
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: colors.textPrimary }}>
                  {t.explore.featuredStores}
                </Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }} className="mt-0.5">
                  {t.explore.featuredStoresSub}
                </Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 4 }}
            >
              {featuredSellers.map((seller) => {
                const followed = Boolean(followedSellers[seller.id]);
                const displayFollowers = formatFollowersCount(parseFollowersText(seller.followers) + (followed ? 1 : 0));
                return (
                  <Pressable
                    key={seller.id}
                    onPress={() => openSellerStore({ name: seller.name, storeKey: seller.id, sellerId: seller.id })}
                    style={{ width: 280 }}
                    className="bg-white rounded-[24px] overflow-hidden border border-[#33333315]"
                  >
                    {/* Cover */}
                    <Image source={{ uri: seller.coverImage }} style={{ width: '100%', height: 110 }} resizeMode="cover" />

                    <View className="p-4">
                      {/* Avatar + name */}
                      <View className="flex-row items-center">
                        <Image source={{ uri: seller.avatar }} className="w-12 h-12 rounded-full" resizeMode="cover" />
                        <View className="flex-1 ml-3">
                          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>
                            {seller.name}
                          </Text>
                          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary }}>
                            {seller.username} · {seller.city}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: '#EFF6FF' }} className="px-2.5 py-1 rounded-full">
                          <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.primary }}>
                            {seller.category}
                          </Text>
                        </View>
                      </View>

                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textPrimary }} className="mt-2.5">
                        {seller.headline}
                      </Text>

                      {/* Stats + follow */}
                      <View className="flex-row items-center justify-between mt-4">
                        <View>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>
                            {displayFollowers}
                          </Text>
                          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary }}>
                            {t.store.followers}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-0.5">
                          <Ionicons name="star" size={13} color="#F59E0B" />
                          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>
                            {seller.rating}
                          </Text>
                        </View>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            toggleFollow(seller.id);
                          }}
                          style={{
                            backgroundColor: followed ? '#F1F5F9' : colors.primary,
                            borderColor: followed ? colors.borderLight : colors.primary,
                            borderWidth: 1,
                          }}
                          className="rounded-full px-4 py-2"
                        >
                          <Text
                            style={{
                              fontFamily: fonts.bold,
                              fontSize: 12,
                              color: followed ? colors.textPrimary : '#fff',
                            }}
                          >
                            {followed ? 'Takip Ediliyor' : 'Takip Et'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {/* ── Seller feed (2-col grid) ─────── */}
        <View className="px-4 mt-5 mb-3 flex-row items-center justify-between">
          <View>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: colors.textPrimary }}>
              {t.explore.storeFlow}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }} className="mt-0.5">
              {t.explore.storeFlowSub(displayedSellers.length)}
            </Text>
          </View>
          <Pressable
            onPress={() =>
              setGridSort((prev) => {
                if (prev === 'default') return 'rating';
                if (prev === 'rating') return 'followers';
                if (prev === 'followers') return 'az';
                return 'default';
              })
            }
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: gridSort !== 'default' ? '#EFF6FF' : '#F1F5F9',
              borderRadius: 12,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: gridSort !== 'default' ? colors.primary + '40' : 'transparent',
            }}
          >
            <Ionicons
              name="swap-vertical-outline"
              size={13}
              color={gridSort !== 'default' ? colors.primary : colors.textSecondary}
            />
            <Text
              style={{
                fontFamily: fonts.medium,
                fontSize: 11,
                color: gridSort !== 'default' ? colors.primary : colors.textSecondary,
              }}
            >
              {gridSort === 'default'
                ? t.explore.sort
                : gridSort === 'rating'
                ? t.explore.sortRating
                : gridSort === 'followers'
                ? t.explore.sortFollowers
                : t.explore.sortAZ}
            </Text>
          </Pressable>
        </View>

        <View className="px-4 pb-8">
          {isLoadingInitial ? (
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={`grid-skeleton-${i}`} style={{ width: GRID_CARD_WIDTH, height: 280, backgroundColor: '#E5E7EB', borderRadius: 20 }} />
              ))}
            </View>
          ) : filteredSellers.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Ionicons name="storefront-outline" size={48} color="#D1D5DB" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginTop: 14 }}>{t.explore.noStore}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 6, textAlign: 'center' }}>
                {t.explore.noStoreSub}
              </Text>
              <Pressable
                onPress={() => setActiveFilter('all')}
                style={{ backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10, marginTop: 18 }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{t.explore.showAll}</Text>
              </Pressable>
            </View>
          ) : (
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {displayedSellers.map((seller) => {
              const followed = Boolean(followedSellers[seller.id]);
              const isLive = seller.tags.some((t) => t.toLowerCase().includes('canl'));
              const displayFollowers = formatFollowersCount(parseFollowersText(seller.followers) + (followed ? 1 : 0));
              const sellerProducts = allProducts.filter((p) => p.sellerId === seller.id).slice(0, 3);

              return (
                <Pressable
                  key={seller.id}
                  onPress={() => openSellerStore({ name: seller.name, storeKey: seller.id, sellerId: seller.id })}
                  style={{ width: GRID_CARD_WIDTH }}
                  className="bg-white rounded-[20px] border border-[#33333315] overflow-hidden active:opacity-95"
                >
                  {/* Cover */}
                  <View className="relative">
                    <Image
                      source={{ uri: seller.coverImage }}
                      style={{ width: '100%', height: 90 }}
                      resizeMode="cover"
                    />
                    {isLive ? (
                      <View
                        style={{ backgroundColor: colors.danger }}
                        className="absolute top-2 left-2 flex-row items-center px-2 py-[3px] rounded-full gap-1"
                      >
                        <PulsingDot color="#fff" />
                        <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: '#fff' }}>{t.explore.live}</Text>
                      </View>
                    ) : null}
                    {/* Category pill */}
                    <View
                      style={{ backgroundColor: '#EFF6FF' }}
                      className="absolute top-2 right-2 px-2 py-[3px] rounded-full"
                    >
                      <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: colors.primary }}>
                        {seller.category}
                      </Text>
                    </View>
                  </View>

                  <View className="p-3">
                    {/* Avatar + name */}
                    <View className="flex-row items-center gap-2">
                      <Image
                        source={{ uri: seller.avatar }}
                        style={{ width: 36, height: 36, borderRadius: 18 }}
                        resizeMode="cover"
                      />
                      <View className="flex-1">
                        <View className="flex-row items-center gap-1">
                          <Text
                            numberOfLines={1}
                            style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary, flex: 1 }}
                          >
                            {seller.name}
                          </Text>
                          {seller.rating >= 4.8 ? (
                            <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
                          ) : null}
                        </View>
                        <Text
                          numberOfLines={1}
                          style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary }}
                        >
                          {seller.city}
                        </Text>
                      </View>
                    </View>

                    {/* Headline */}
                    <Text
                      numberOfLines={2}
                      style={{
                        fontFamily: fonts.regular,
                        fontSize: 11,
                        color: colors.textPrimary,
                        lineHeight: 16,
                        marginTop: 8,
                        minHeight: 32,
                      }}
                    >
                      {seller.headline}
                    </Text>

                    {/* Tags */}
                    {seller.tags && seller.tags.length > 0 ? (
                      <View style={{ flexDirection: 'row', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                        {seller.tags.slice(0, 2).map((tag) => (
                          <View key={tag} style={{ backgroundColor: '#F1F5F9', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ fontFamily: fonts.medium, fontSize: 9, color: colors.textSecondary }}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {/* Product preview thumbnails */}
                    {sellerProducts.length > 0 ? (
                      <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
                        {sellerProducts.map((product) => (
                          <Image
                            key={product.id}
                            source={{ uri: product.image }}
                            style={{ width: (GRID_CARD_WIDTH - 24 - 8) / 3, height: (GRID_CARD_WIDTH - 24 - 8) / 3, borderRadius: 8 }}
                            resizeMode="cover"
                          />
                        ))}
                        {sellerProducts.length < 3 ? Array.from({ length: 3 - sellerProducts.length }).map((_, i) => (
                          <View key={`ph-${i}`} style={{ width: (GRID_CARD_WIDTH - 24 - 8) / 3, height: (GRID_CARD_WIDTH - 24 - 8) / 3, borderRadius: 8, backgroundColor: '#F1F5F9' }} />
                        )) : null}
                      </View>
                    ) : (
                      <View style={{ backgroundColor: '#ECFDF5' }} className="rounded-full px-2 py-1 mt-2 self-start">
                        <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: colors.success }}>
                          {seller.weeklyDrop}
                        </Text>
                      </View>
                    )}

                    {/* Stats row */}
                    <View className="flex-row items-center justify-between mt-2.5 pt-2.5 border-t border-[#33333315]">
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="people-outline" size={12} color={colors.textMuted} />
                        <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: colors.textSecondary }}>
                          {displayFollowers}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-0.5">
                        <Ionicons name="star" size={11} color="#F59E0B" />
                        <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: colors.textSecondary }}>
                          {seller.rating}
                        </Text>
                      </View>
                    </View>

                    {/* Follow button */}
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        toggleFollow(seller.id);
                      }}
                      style={{
                        backgroundColor: followed ? '#F1F5F9' : colors.primary,
                        borderColor: followed ? colors.borderLight : colors.primary,
                        borderWidth: 1,
                        marginTop: 8,
                      }}
                      className="rounded-full h-8 items-center justify-center"
                    >
                      <Text
                        style={{
                          fontFamily: fonts.bold,
                          fontSize: 11,
                          color: followed ? colors.textPrimary : '#fff',
                        }}
                      >
                        {followed ? '✓ Takipte' : 'Takip Et'}
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            })}
          </View>
          )}
        </View>

      </ScrollView>
      <ScrollToTopButton
        visible={showScrollToTop}
        onPress={() => {
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        }}
      />
    </SafeAreaView>
  );
}