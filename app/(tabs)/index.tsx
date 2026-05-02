import { View, Text, ScrollView, Pressable, Image, Dimensions, RefreshControl, ActivityIndicator, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { colors, fonts } from '../../src/constants/theme';
import { ProductCard } from '../../src/components/ProductCard';
import { FavoriteButton } from '../../src/components/FavoriteButton';
import { ProfileButton } from '../../src/components/ProfileButton';
import { StoryTray } from '../../src/components/StoryTray';
import { DynamicStoryTray } from '../../src/components/DynamicStoryTray';
import { useListings } from '../../src/context/ListingsContext';
import { useAndroidTabBackToHome } from '../../src/hooks/useAndroidTabBackToHome';
import { useAuth } from '../../src/context/AuthContext';
import { fetchUnreadNotificationCount, subscribeToMyNotifications } from '../../src/services/inAppNotificationService';
import { getTopDailyPerformers, getRankBadge } from '../../src/services/leaderboardService';
import { getRecentlyViewed, clearRecentlyViewed, type RecentlyViewedItem } from '../../src/hooks/useRecentlyViewed';
import BoxMascot from '../../src/components/BoxMascot';
import { t } from '../../src/i18n';
import { isSmallDevice, calcCardWidth } from '../../src/utils/responsive';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = calcCardWidth(2, 0, 24);
const LOAD_MORE_SCROLL_THROTTLE_MS = 350;

type ProductTabId = 'all' | 'new' | 'flash' | 'discount' | 'freeShipping';
type ProductSortId = 'newest' | 'priceAsc' | 'priceDesc' | 'topRated';

const heroBanners = [
  {
    id: 'campaign-flash',
    title: 'Flash Fırsatlar',
    subtitle: 'Saatlik kampanyalarla öne çıkan ürünleri kaçırma',
    cta: 'Fırsatları Aç',
    emoji: '⚡',
    bgGradient: ['#1E40AF', '#3B82F6'],
  },
  {
    id: 'campaign-explore',
    title: 'Satıcıları Keşfet',
    subtitle: 'Takip et, vitrinleri izle, yeni ürünleri ilk sen yakala',
    cta: 'Keşfe Git',
    emoji: '🛍️',
    bgGradient: ['#0F766E', '#14B8A6'],
  },
] as const;

const discountTiers = [
  { id: 'd1', label: '%10+', color: '#EFF6FF', textColor: '#1D4ED8' },
  { id: 'd2', label: '%20+', color: '#ECFDF5', textColor: '#047857' },
  { id: 'd3', label: '%30+', color: '#FEF2F2', textColor: '#B91C1C' },
] as const;

const productTabs: { id: ProductTabId; label: string }[] = [
  { id: 'all', label: t.home.tabAll },
  { id: 'new', label: t.home.tabNew },
  { id: 'flash', label: t.home.tabFlash },
  { id: 'discount', label: t.home.tabDiscount },
  { id: 'freeShipping', label: t.home.tabFreeShipping },
];

const productSortOptions: { id: ProductSortId; label: string }[] = [
  { id: 'newest', label: t.home.sortNewest },
  { id: 'topRated', label: t.home.sortTopRated },
  { id: 'priceAsc', label: t.home.sortPriceAsc },
  { id: 'priceDesc', label: t.home.sortPriceDesc },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, isConfigured } = useAuth();
  useAndroidTabBackToHome(true);
  const scrollRef = useRef<ScrollView>(null);
  const productSectionOffsetRef = useRef(0);
  const lastLoadMoreAttemptRef = useRef(0);
  const [activeBanner, setActiveBanner] = useState(0);
  const [activeProductTab, setActiveProductTab] = useState<ProductTabId>('all');
  const [activeProductSort, setActiveProductSort] = useState<ProductSortId>('newest');
  const [refreshing, setRefreshing] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const heroBannerScrollRef = useRef<ScrollView>(null);
  const [storyRotationSeed, setStoryRotationSeed] = useState(0);
  const [flashCountdown, setFlashCountdown] = useState('');
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [topDailyPerformers, setTopDailyPerformers] = useState<any[]>([]);
  const [recentlyViewedItems, setRecentlyViewedItems] = useState<RecentlyViewedItem[]>([]);
  const { homeProducts, reloadProducts, reloadHomeStories, loadMoreProducts, homeHasMore, homeLoadingMore, homeStories, cartItemCount } = useListings();

  useEffect(() => {
    let active = true;

    if (!user || !isConfigured) {
      setUnreadNotificationCount(0);
      return () => {
        active = false;
      };
    }

    const refreshUnread = () => {
      fetchUnreadNotificationCount()
        .then((count) => {
          if (active) {
            setUnreadNotificationCount(count);
          }
        })
        .catch(() => {
          if (active) {
            setUnreadNotificationCount(0);
          }
        });
    };

    refreshUnread();
    const unsubscribe = subscribeToMyNotifications(user.id, refreshUnread);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [isConfigured, user?.id]);

  // Load top daily performers for featured section
  useEffect(() => {
    let active = true;

    getTopDailyPerformers(5)
      .then((performers) => {
        if (active) {
          setTopDailyPerformers(performers);
        }
      })
      .catch(() => {
        if (active) {
          setTopDailyPerformers([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    // Reset to next top-of-hour when session starts
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
    const timer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) remaining = 3600;
      setFlashCountdown(fmt(remaining));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadRecentlyViewed = useCallback(() => {
    let cancelled = false;
    getRecentlyViewed()
      .then((items) => {
        if (!cancelled) {
          setRecentlyViewedItems(items.slice(0, 8));
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  // Reload when screen becomes active so list stays fresh after returning from product detail.
  useFocusEffect(loadRecentlyViewed);

  const scrollToProducts = () => {
    scrollRef.current?.scrollTo({ y: Math.max(productSectionOffsetRef.current - 12, 0), animated: true });
  };

  const focusProductTab = (tab: ProductTabId) => {
    setActiveProductTab(tab);
    scrollToProducts();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([reloadProducts(), reloadHomeStories()]);
      setStoryRotationSeed((current) => current + 1);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const autoBannerTimer = setInterval(() => {
      setActiveBanner((prev) => {
        const next = (prev + 1) % heroBanners.length;
        heroBannerScrollRef.current?.scrollTo({ x: next * (SCREEN_WIDTH - 24), animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(autoBannerTimer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setStoryRotationSeed((current) => current + 1);
      reloadHomeStories().catch(() => undefined);
    }, 90 * 1000);

    return () => clearInterval(timer);
  }, [reloadHomeStories]);

  const handleFeedScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    setShowScrollToTop(contentOffset.y > 500);

    if (!homeHasMore || homeLoadingMore) {
      return;
    }

    const now = Date.now();
    if (now - lastLoadMoreAttemptRef.current < LOAD_MORE_SCROLL_THROTTLE_MS) {
      return;
    }

    const threshold = 280;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - threshold) {
      lastLoadMoreAttemptRef.current = now;
      loadMoreProducts().catch(() => undefined);
    }
  }, [homeHasMore, homeLoadingMore, loadMoreProducts]);

  const filteredProducts = useMemo(() => {
    const source = [...homeProducts];

    const tabFiltered = source.filter((item) => {
      if (activeProductTab === 'new') {
        return item.badge?.includes('Yeni') || item.badge === 'Hikayede';
      }

      if (activeProductTab === 'flash') {
        return item.badge === 'Flash';
      }

      if (activeProductTab === 'discount') {
        return Boolean(item.discount && item.discount >= 10);
      }

      if (activeProductTab === 'freeShipping') {
        return Boolean(item.freeShipping);
      }

      return true;
    });

    if (activeProductSort === 'priceAsc') {
      return tabFiltered.sort((a, b) => a.price - b.price);
    }

    if (activeProductSort === 'priceDesc') {
      return tabFiltered.sort((a, b) => b.price - a.price);
    }

    if (activeProductSort === 'topRated') {
      return tabFiltered.sort((a, b) => {
        if (b.rating !== a.rating) {
          return b.rating - a.rating;
        }

        return b.reviewCount - a.reviewCount;
      });
    }

    return tabFiltered;
  }, [activeProductSort, activeProductTab, homeProducts]);

  const activeProductTabLabel = productTabs.find((tab) => tab.id === activeProductTab)?.label ?? 'Tümü';
  const activeSortLabel = productSortOptions.find((sort) => sort.id === activeProductSort)?.label ?? 'En Yeni';

  const tabProductCounts = useMemo<Record<ProductTabId, number>>(() => ({
    all: homeProducts.length,
    new: homeProducts.filter((p) => p.badge?.includes('Yeni') || p.badge === 'Hikayede').length,
    flash: homeProducts.filter((p) => p.badge === 'Flash').length,
    discount: homeProducts.filter((p) => Boolean(p.discount && p.discount >= 10)).length,
    freeShipping: homeProducts.filter((p) => Boolean(p.freeShipping)).length,
  }), [homeProducts]);

  type StoryCircle = (typeof homeStories)[number] & { sellerStoryCount?: number };

  const groupedStoryCircles = useMemo<StoryCircle[]>(() => {
    const addStory = homeStories.find((item) => item.isAdd);
    const sellerGroups = new Map<string, typeof homeStories>();

    homeStories
      .filter((item) => !item.isAdd && !item.id.startsWith('explore-') && !item.id.startsWith('fallback-story-'))
      .forEach((item) => {
        const sellerKey = (item.sellerKey || item.seller || item.id).trim();
        const current = sellerGroups.get(sellerKey) ?? [];
        sellerGroups.set(sellerKey, [...current, item]);
      });

    const sellerPreviews: StoryCircle[] = Array.from(sellerGroups.entries()).map(([sellerKey, sellerStories]) => {
      const sorted = [...sellerStories].sort(
        (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
      );
      const latest = sorted[0];

      return {
        ...latest,
        sellerKey,
        sellerStoryCount: sorted.length,
      };
    });

    const offset = sellerPreviews.length > 0 ? storyRotationSeed % sellerPreviews.length : 0;
    const rotated = offset > 0
      ? [...sellerPreviews.slice(offset), ...sellerPreviews.slice(0, offset)]
      : sellerPreviews;

    return addStory ? [addStory, ...rotated] : rotated;
  }, [homeStories, storyRotationSeed]);
  const visibleHomeStoryCount = groupedStoryCircles.filter((item) => !item.isAdd).length;

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
      {/* Header */}
      <View className="bg-white px-4 pb-3 pt-2">
        <View className="flex-row items-center justify-between mb-3">
          {/* Logo */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <BoxMascot variant="welcome" size={38} animated />
            <View>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 19, lineHeight: 23, letterSpacing: -0.3 }}>
                <Text style={{ color: '#0D2347' }}>Sipariş </Text>
                <Text style={{ color: colors.primary }}>Kutusu</Text>
              </Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: '#94A3B8', letterSpacing: 0.2, marginTop: 1 }}>
                {t.home.subtitle}
              </Text>
            </View>
          </View>

          {/* Action icons */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={() => router.push('/notifications')} style={{ position: 'relative' }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F4FF', borderWidth: 1, borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="notifications-outline" size={20} color={colors.primary} />
              </View>
              {unreadNotificationCount > 0 ? (
                <View
                  style={{
                    position: 'absolute', top: -2, right: -2,
                    minWidth: 16, height: 16, borderRadius: 8,
                    backgroundColor: '#EF4444',
                    alignItems: 'center', justifyContent: 'center',
                    paddingHorizontal: 3,
                    borderWidth: 1.5, borderColor: '#fff',
                  }}
                >
                  <Text style={{ fontFamily: fonts.bold, fontSize: 8, color: '#fff' }}>
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <FavoriteButton />
            <ProfileButton />
          </View>
        </View>

        {/* Search bar */}
        <Pressable
          onPress={() => router.push('/search')}
          className="flex-row items-center bg-[#F7F7F7] rounded-xl px-3 h-11 border border-[#33333315]"
        >
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <Text
            style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted }}
            className="ml-2 flex-1"
          >
            {t.home.searchPlaceholder}
          </Text>
          <Ionicons name="camera-outline" size={20} color={colors.primary} />
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Pressable
            onPress={() => router.push('/(tabs)/categories')}
            style={{ flex: 1, height: 36, borderRadius: 12, borderWidth: 1, borderColor: colors.primary, backgroundColor: '#EFF6FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}
          >
            <Ionicons name="grid-outline" size={15} color={colors.primary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary, marginLeft: 5 }}>
              Kategoriler
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/explore')}
            style={{ flex: 1, height: 36, borderRadius: 12, borderWidth: 1, borderColor: colors.borderLight, backgroundColor: '#F8FAFC', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}
          >
            <Ionicons name="compass-outline" size={15} color={colors.textPrimary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textPrimary, marginLeft: 5 }}>
              Satıcı Keşfet
            </Text>
          </Pressable>
        </View>

      </View>

      <ScrollView 
        ref={scrollRef}
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        onScroll={handleFeedScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Category quick-jump */}
        <View className="bg-white pt-1">
          <View className="px-4 flex-row items-center justify-between mb-2">
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 14, color: colors.textPrimary }}>
              {t.home.categories}
            </Text>
            <Pressable onPress={() => router.push('/(tabs)/categories')}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>
                {t.home.seeAll}
              </Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 10, gap: 8 }}
          >
            {[
              { emoji: '👗', label: 'Kadın', cat: 'women' },
              { emoji: '📱', label: 'Elektronik', cat: 'electronics' },
              { emoji: '👟', label: 'Ayakkabı', cat: 'shoes-bags' },
              { emoji: '💄', label: 'Kozmetik', cat: 'cosmetics' },
              { emoji: '🏠', label: 'Ev & Yaşam', cat: 'home' },
              { emoji: '👔', label: 'Erkek', cat: 'men' },
              { emoji: '⚽', label: 'Spor', cat: 'sports' },
            ].map((chip) => (
              <Pressable
                key={chip.cat}
                onPress={() => router.push(`/category/${chip.cat}` as never)}
                style={{ backgroundColor: '#F7F7F7', borderColor: colors.borderLight }}
                className="px-4 h-9 rounded-lg border flex-row items-center justify-center"
              >
                <Text style={{ fontSize: 14 }}>{chip.emoji}</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textPrimary, marginLeft: 5 }}>
                  {chip.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Hero Banner */}
        <View className="bg-white pb-3">
          <ScrollView
            ref={heroBannerScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              setActiveBanner(Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 24)));
            }}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
          >
            {heroBanners.map((banner) => (
              <Pressable
                key={banner.id}
                onPress={() => {
                  if (banner.id === 'campaign-flash') {
                    focusProductTab('flash');
                    return;
                  }

                  if (banner.id === 'campaign-explore') {
                    router.push('/(tabs)/explore');
                    return;
                  }

                  focusProductTab('discount');
                }}
                style={{
                  width: SCREEN_WIDTH - 24,
                  backgroundColor: banner.bgGradient[0],
                }}
                className="h-36 rounded-2xl overflow-hidden flex-row items-center justify-between px-5"
              >
                <View className="flex-1">
                  <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: '#fff' }}>
                    {banner.title}
                  </Text>
                  <Text
                    style={{ fontFamily: fonts.medium, fontSize: 13, color: '#ffffffdd' }}
                    className="mt-1"
                  >
                    {banner.subtitle}
                  </Text>
                  <View className="bg-white rounded-full self-start px-4 py-1.5 mt-3">
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: banner.bgGradient[0] }}>
                      {banner.cta}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 72 }}>{banner.emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View className="flex-row justify-center gap-1.5 mt-2">
            {heroBanners.map((_, i) => (
              <View
                key={i}
                style={{
                  backgroundColor: i === activeBanner ? colors.primary : colors.borderLight,
                  width: i === activeBanner ? 16 : 6,
                }}
                className="h-1.5 rounded-full"
              />
            ))}
          </View>
        </View>

        {/* Story bar (Instagram-style) */}
        <View className="bg-white pt-3 pb-4 mt-1 border-b border-[#33333315]">
          <View className="px-4 mb-2 flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 15, color: colors.textPrimary }}>
                {t.home.stories}
              </Text>
              <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                {t.home.storiesSub}
              </Text>
            </View>
            <Pressable onPress={() => router.push('/share-story')} className="flex-row items-center">
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>{t.home.addStory}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </Pressable>
          </View>
          <StoryTray
            stories={groupedStoryCircles}
            showAddButton={true}
            onAddPress={() => router.push('/share-story')}
            layout="full"
            variant="commerce"
          />
          {visibleHomeStoryCount === 0 ? (
            <Pressable
              onPress={() => router.push('/share-story')}
              className="mx-4 mt-3 rounded-xl border px-3 py-3 flex-row items-center"
              style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
            >
              <View className="w-9 h-9 rounded-full items-center justify-center mr-3" style={{ backgroundColor: '#fff' }}>
                <Ionicons name="bag-add-outline" size={18} color={colors.primary} />
              </View>
              <View className="flex-1 pr-2">
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }}>
                  {t.home.addFirstStory}
                </Text>
                <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                  {t.home.addFirstStorySub}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </Pressable>
          ) : (
            <View className="mx-4 mt-3 flex-row items-center justify-between rounded-xl px-3 py-2" style={{ backgroundColor: '#F8FAFC' }}>
              <View className="flex-row items-center flex-1 pr-2">
                <Ionicons name="refresh-outline" size={14} color={colors.textSecondary} />
                <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginLeft: 6 }}>
                  {t.home.storiesUpdated}
                </Text>
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary }}>
                {visibleHomeStoryCount} {t.home.active}
              </Text>
            </View>
          )}
        </View>

        {/* Son Gördüklerin */}
        {recentlyViewedItems.length > 0 ? (
          <View className="bg-white mt-1 px-3 py-3 border-b border-[#33333315]">
            <View className="flex-row items-center justify-between mb-2.5">
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 15, color: colors.textPrimary }}>
                {t.home.recentlyViewed}
              </Text>
              <Pressable onPress={() => { clearRecentlyViewed(); setRecentlyViewedItems([]); }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary }}>
                  {t.common.clear}
                </Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingBottom: 2 }}
            >
              {recentlyViewedItems.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/product/${item.id}` as never)}
                  style={{ width: 100 }}
                  className="active:opacity-80"
                >
                  <View className="rounded-xl overflow-hidden border border-[#33333312]">
                    <Image
                      source={{ uri: item.imageUri }}
                      style={{ width: 100, height: 100 }}
                      resizeMode="cover"
                    />
                  </View>
                  <Text
                    style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary, marginTop: 4 }}
                    numberOfLines={1}
                  >
                    ₺{item.price.toFixed(2)}
                  </Text>
                  <Text
                    style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary }}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Discount tier chips */}
        <View className="bg-white mt-1 px-3 py-3 border-b border-[#33333315]">
          <Text
            style={{ fontFamily: fonts.headingBold, fontSize: 15, color: colors.textPrimary }}
            className="mb-2.5 ml-1"
          >
            {t.home.discountShopping}
          </Text>
          <View className="flex-row gap-2">
            {discountTiers.map((d) => (
              <Pressable
                key={d.id}
                onPress={() => focusProductTab('discount')}
                style={{ backgroundColor: d.color }}
                className="flex-1 h-14 rounded-xl items-center justify-center"
              >
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: d.textColor }}>
                  {d.label}
                </Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 9, color: d.textColor, opacity: 0.9 }}>
                  {t.home.discount}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Günün Yıldızları */}
        {topDailyPerformers.length > 0 && (
          <View className="bg-white mt-1 pt-3 pb-2">
            <View className="flex-row items-center justify-between px-3 mb-2">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="star" size={15} color="#F59E0B" />
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 14, color: colors.textPrimary }}>
                  {t.home.topPerformers}
                </Text>
              </View>
              <Pressable onPress={() => router.push('/seller-leaderboard')}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>Tümü →</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 10 }}>
              {topDailyPerformers.map((performer, idx) => {
                const rankColors = ['#F59E0B', '#9CA3AF', '#CD7F32', colors.primary, colors.primary];
                const rankColor = rankColors[idx] ?? colors.primary;
                const trendIcon = performer.rank_trend === 'up' ? 'arrow-up' : performer.rank_trend === 'down' ? 'arrow-down' : 'remove';
                const trendColor = performer.rank_trend === 'up' ? '#10B981' : performer.rank_trend === 'down' ? '#EF4444' : '#9CA3AF';
                return (
                  <Pressable
                    key={performer.seller_id}
                    onPress={() => router.push(`/store?sellerId=${performer.seller_id}` as any)}
                    style={{ alignItems: 'center', width: 72 }}
                  >
                    <View style={{ position: 'relative' }}>
                      {performer.avatar_url ? (
                        <Image source={{ uri: performer.avatar_url }} style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: rankColor }} />
                      ) : (
                        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#F1F5F9', borderWidth: 2, borderColor: rankColor, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="person" size={22} color="#9CA3AF" />
                        </View>
                      )}
                      <View style={{ position: 'absolute', bottom: -4, left: '50%', transform: [{ translateX: -9 }], backgroundColor: rankColor, borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1 }}>
                        <Text style={{ fontFamily: fonts.headingBold, fontSize: 10, color: '#fff' }}>#{performer.rank}</Text>
                      </View>
                    </View>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 10, color: colors.textPrimary, marginTop: 8, textAlign: 'center' }}>
                      {performer.store_name || performer.full_name}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <Ionicons name={trendIcon as any} size={10} color={trendColor} />
                      <Text style={{ fontFamily: fonts.medium, fontSize: 9, color: colors.textSecondary }}>{performer.daily_score ?? performer.score}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Flash Sale banner */}
        <View className="bg-white mt-1 mx-3 my-3 rounded-2xl overflow-hidden" style={{ backgroundColor: '#EFF6FF' }}>
          <View className="flex-row items-center justify-between px-4 py-3">
            <View>
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="flash" size={16} color={colors.primary} />
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: colors.primary }}>
                  {t.home.flashSale}
                </Text>
              </View>
              <Text
                style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary }}
                className="mt-0.5"
              >
                {flashCountdown ? `${t.home.flashSaleEnding} ${flashCountdown}` : t.home.flashSale}
              </Text>
            </View>
            <Pressable onPress={() => focusProductTab('flash')} className="flex-row items-center">
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>
                {t.home.seeAll}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        {/* Products Grid Title */}
        <View
          className="bg-white px-3 pt-4 pb-2"
          onLayout={(event) => {
            productSectionOffsetRef.current = event.nativeEvent.layout.y;
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="pr-3 flex-1">
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.textPrimary }}>
                {t.home.products}
              </Text>
              <Text
                style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}
                className="mt-1"
              >
                {t.home.productsShown(filteredProducts.length, activeProductTabLabel)}
              </Text>
            </View>
            <View style={{ backgroundColor: '#EFF6FF' }} className="px-3 py-1.5 rounded-full">
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary }}>
                {homeProducts.length > 0 ? t.home.productsLoaded(homeProducts.length) : t.home.liveStream}
              </Text>
            </View>
          </View>
        </View>

        {/* Products filters and sort */}
        <View className="bg-white px-3 py-3 border-b border-[#33333312]">
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
            {t.home.filterBy}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 2, gap: 8 }}
          >
            {productTabs.map((tab) => {
              const selected = activeProductTab === tab.id;

              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveProductTab(tab.id)}
                  style={{
                    backgroundColor: selected ? colors.primary : '#F8FAFC',
                    borderColor: selected ? colors.primary : colors.borderLight,
                  }}
                  className="h-9 px-4 rounded-full border items-center justify-center flex-row gap-1.5"
                >
                  {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                  <Text
                    style={{
                      fontFamily: selected ? fonts.bold : fonts.medium,
                      fontSize: 11,
                      color: selected ? '#fff' : colors.textPrimary,
                    }}
                  >
                    {tab.label}
                  </Text>
                  {tabProductCounts[tab.id] > 0 && (
                    <View style={{ backgroundColor: selected ? 'rgba(255,255,255,0.25)' : colors.primary + '18', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: selected ? '#fff' : colors.primary }}>
                        {tabProductCounts[tab.id]}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 10, marginBottom: 8 }}>
            {t.home.sortBy}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {productSortOptions.map((sort) => {
              const selected = activeProductSort === sort.id;

              return (
                <Pressable
                  key={sort.id}
                  onPress={() => setActiveProductSort(sort.id)}
                  style={{
                    backgroundColor: selected ? '#DBEAFE' : '#F8FAFC',
                    borderColor: selected ? '#BFDBFE' : colors.borderLight,
                  }}
                  className="h-9 px-4 rounded-full border items-center justify-center flex-row gap-1.5"
                >
                  {selected && <Ionicons name="checkmark" size={14} color={colors.primary} />}
                  <Text
                    style={{
                      fontFamily: selected ? fonts.bold : fonts.medium,
                      fontSize: 11,
                      color: selected ? colors.primary : colors.textSecondary,
                    }}
                  >
                    {sort.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Products grid */}
        <View className="bg-white px-3 pb-4">
          {filteredProducts.length === 0 ? (
            <View className="rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-12 mt-2 items-center justify-center">
              <View style={{ backgroundColor: '#EFF6FF' }} className="w-16 h-16 rounded-full items-center justify-center mb-3">
                <Ionicons name="search-outline" size={28} color={colors.primary} />
              </View>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 15, color: colors.textPrimary }}>
                {t.home.noProducts}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
                {t.home.noProductsSub(activeProductTabLabel, activeProductSort)}
              </Text>
              <Pressable 
                onPress={() => {
                  setActiveProductTab('all');
                  setActiveProductSort('newest');
                }}
                className="mt-4 px-4 py-2 rounded-full" 
                style={{ backgroundColor: colors.primary }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>{t.common.resetFilters}</Text>
              </Pressable>
            </View>
          ) : (
            <View className="flex-row flex-wrap rounded-[24px] overflow-hidden border border-[#33333315] mt-1">
              {filteredProducts.map((p, i) => {
                const totalRows = Math.ceil(filteredProducts.length / 2);
                const currentRow = Math.floor(i / 2);

                return (
                  <View
                    key={`${p.id}-${i}`}
                    style={{
                      width: CARD_WIDTH,
                      borderRightWidth: i % 2 === 0 ? 1 : 0,
                      borderBottomWidth: currentRow === totalRows - 1 ? 0 : 1,
                      borderColor: colors.borderLight,
                      backgroundColor: '#fff',
                    }}
                  >
                    <ProductCard product={p} />
                  </View>
                );
              })}
            </View>
          )}

          {homeLoadingMore ? (
            <View className="items-center justify-center py-4">
              <ActivityIndicator color={colors.primary} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 6 }}>
                {t.home.loadingMore}
              </Text>
            </View>
          ) : null}

          {!homeHasMore ? (
            <View className="items-center justify-center py-4">
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted }}>
                {t.home.allLoaded}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="h-6" />
      </ScrollView>

      {/* Scroll-to-top FAB */}
      {showScrollToTop && (
        <Pressable
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
          style={{
            position: 'absolute',
            bottom: 24,
            right: 20,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 5,
          }}
        >
          <Ionicons name="arrow-up" size={22} color="#fff" />
        </Pressable>
      )}
    </SafeAreaView>
  );
}
