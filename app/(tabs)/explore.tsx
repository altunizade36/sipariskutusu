import { Dimensions, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { colors, fonts } from '../../src/constants/theme';
import { discoverSellers } from '../../src/data/storeData';
import { fetchDiscoverStores, type DiscoverStore } from '../../src/services/storeService';
import { fetchFollowedStoreIds } from '../../src/services/storeFollowService';
import { isSupabaseConfigured } from '../../src/services/supabase';
import { captureError } from '../../src/services/monitoring';
import { FavoriteButton } from '../../src/components/FavoriteButton';
import { ProfileButton } from '../../src/components/ProfileButton';
import { useListings } from '../../src/context/ListingsContext';
import { useAuth } from '../../src/context/AuthContext';
import { useAndroidTabBackToHome } from '../../src/hooks/useAndroidTabBackToHome';
import { getAlgorithmicExploreSelection, logSellerClick, logSellerImpression } from '../../src/services/explorePopularityService';
import {
  fetchExploreFeaturedStories,
  fetchSellerPeriodLeaderboard,
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
  { id: 'all', label: 'Tümü', icon: 'grid-outline' },
  { id: 'featured', label: 'Öne Çıkanlar', icon: 'flame-outline' },
  { id: 'topRated', label: 'En Yüksek Puan', icon: 'star-outline' },
  { id: 'new', label: 'Yeni Mağazalar', icon: 'sparkles-outline' },
  { id: 'live', label: 'Canlı Yayın', icon: 'radio-outline' },
];

// product preview images per seller (3 thumbnails)
const sellerPreviewMap: Record<string, string[]> = {
  ds1: [
    'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=200&q=70',
    'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=200&q=70',
    'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=200&q=70',
  ],
  ds2: [
    'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=200&q=70',
    'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=200&q=70',
    'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=200&q=70',
  ],
  ds3: [
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=200&q=70',
    'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=200&q=70',
    'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=200&q=70',
  ],
  ds4: [
    'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=200&q=70',
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&q=70',
    'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=200&q=70',
  ],
  ds5: [
    'https://images.unsplash.com/photo-1522335789203-aaa0db1ebcd1?w=200&q=70',
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=200&q=70',
    'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=200&q=70',
  ],
};

export default function ExploreScreen() {
  const router = useRouter();
  useAndroidTabBackToHome();
  const { user } = useAuth();
  const { allProducts, followedSellers, toggleSellerFollow, setFollowedSellersMap } = useListings();

  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [backendSellers, setBackendSellers] = useState<DiscoverStore[]>([]);
  const [rankedSellers, setRankedSellers] = useState<DiscoverStore[]>([]);
  const [isRankingLoading, setIsRankingLoading] = useState(false);
  const [featuredStories, setFeaturedStories] = useState<any[]>([]);
  const [leaderboardEntries, setLeaderboardEntries] = useState<any[]>([]);
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
      return;
    }

    let active = true;

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
          }
        } catch (error) {
          console.error('Ranking failed:', error);
          if (active) {
            setRankedSellers(stores);
          }
        } finally {
          if (active) {
            setIsRankingLoading(false);
          }
        }
      })
      .catch((error) => {
        captureError(error, { scope: 'explore_fetch_stores' });
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
      setLeaderboardEntries([]);
      return;
    }

    let active = true;

    Promise.all([
      fetchExploreFeaturedStories(18),
      fetchSellerPeriodLeaderboard('weekly', 40),
    ])
      .then(([stories, leaderboard]) => {
        if (!active) {
          return;
        }
        setFeaturedStories(stories);
        setLeaderboardEntries(leaderboard);
      })
      .catch((error) => {
        captureError(error, { scope: 'explore_featured_data' });
        if (active) {
          setFeaturedStories([]);
          setLeaderboardEntries([]);
        }
      });

    return () => {
      active = false;
    };
  }, [canUseBackend]);

  const popularSellerItems = useMemo<PopularSellerItem[]>(() => {
    if (leaderboardEntries.length > 0) {
      return leaderboardEntries.slice(0, 12).map((seller, index) => ({
        id: `ranked-seller-profile-${seller.sellerId}`,
        seller: seller.storeName || seller.sellerName,
        sellerKey: seller.sellerId,
        storeName: seller.storeName || seller.sellerName,
        image: seller.sellerAvatar || sellerSource.find((item) => item.id === seller.sellerId)?.avatar || DEFAULT_SELLER_AVATAR,
        badge: index < 3 ? `#${index + 1}` : seller.sales > 0 ? 'Satış' : seller.rating >= 4.8 ? 'Yıldız' : seller.follows > 0 ? 'Takip' : 'Popüler',
        metricLabel: seller.sales > 0
          ? `${Math.round(seller.sales)} satış`
          : seller.follows > 0
            ? `${Math.round(seller.follows)} takipçi`
            : `${Math.round(seller.score)} puan`,
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
            badge: index < 3 ? `#${index + 1}` : item.isLive ? 'Canli' : 'Popüler',
            metricLabel: seller ? `${seller.rating.toFixed(1)} yıldız` : 'öne çıkıyor',
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
      badge: index < 3 ? `#${index + 1}` : seller.rating >= 4.8 ? 'Yıldız' : seller.featured ? 'Popüler' : 'Takip',
      metricLabel: seller.rating >= 4.8 ? `${seller.rating.toFixed(1)} yıldız` : `${seller.followers} takipçi`,
    }));
  }, [featuredStories, leaderboardEntries, sellerSource]);
  const exploreStorySourceLabel = featuredStories.length > 0
    ? 'Profil fotoğraflarıyla öne çıkan satıcılar'
    : leaderboardEntries.length > 0
      ? 'Satış, puan, takip ve etkileşime göre sıralanır'
      : canUseBackend
        ? 'Popüler satıcılar hazırlanıyor'
        : 'Profil fotoğraflarıyla öne çıkan satıcılar';

  function toggleFollow(id: string) {
    toggleSellerFollow(id);
  }

  const featuredSellers = sellerSource.filter((seller) => seller.featured);

  const filteredSellers = useMemo(() => {
    if (activeFilter === 'featured') return sellerSource.filter((s) => s.featured);
    if (activeFilter === 'topRated') return [...sellerSource].sort((a, b) => b.rating - a.rating);
    if (activeFilter === 'new') return sellerSource.filter((s) => !s.featured);
    if (activeFilter === 'live') return sellerSource.filter((_, i) => i % 2 === 0);
    return sellerSource;
  }, [activeFilter, sellerSource]);

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
              Keşfet
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>
              Satıcıları keşfet, takip et, vitrinlerini yakından izle.
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

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>

        {/* ── Popular sellers ───────────────── */}
        <View className="bg-white pt-3 pb-4 border-b border-[#33333315]">
          <View className="flex-row items-center justify-between px-4 mb-3">
            <View className="flex-1 pr-3">
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 14, color: colors.textPrimary }}>
                Popüler Satıcılar
              </Text>
              <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                {exploreStorySourceLabel}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                router.push('/seller-leaderboard' as never);
              }}
              className="flex-row items-center"
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>Tümünü gör</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 14, gap: 14, paddingBottom: 2 }}
          >
            {popularSellerItems.map((item) => (
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

        {/* ── Filter chips ──────────────────── */}
        <View className="bg-white pt-3 pb-3 border-b border-[#33333315]">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
          >
            {filterChips.map((chip) => {
              const active = activeFilter === chip.id;
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
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Hero banner ───────────────────── */}
        <View style={{ backgroundColor: '#0F172A' }} className="mx-4 mt-4 rounded-[24px] p-5">
          <View className="flex-row items-center gap-2 mb-2">
            <View style={{ backgroundColor: colors.danger }} className="w-2 h-2 rounded-full" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.danger }}>CANLI</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: '#94A3B8' }}>· 12 mağaza aktif</Text>
          </View>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: '#fff' }}>
            Haftanın Yükselen Satıcıları
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: '#CBD5E1' }} className="mt-1.5">
            Takip et, yeni drop ve kampanyaları akışına düşmeden önce yakala.
          </Text>
          <View className="flex-row gap-2 mt-4">
            <View className="bg-white/10 rounded-full px-3 py-1.5">
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>240+ yeni vitrin</Text>
            </View>
            <View className="bg-white/10 rounded-full px-3 py-1.5">
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>
                {Object.values(followedSellers).filter(Boolean).length} takip ediliyor
              </Text>
            </View>
          </View>
        </View>

        {/* ── Featured sellers (horizontal cards) ─── */}
        {(activeFilter === 'all' || activeFilter === 'featured') ? (
          <>
            <View className="px-4 mt-5 mb-3 flex-row items-center justify-between">
              <View>
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: colors.textPrimary }}>
                  Öne Çıkan Mağazalar
                </Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }} className="mt-0.5">
                  Vitrin gücü yüksek, hızlı teslimat yapan satıcılar.
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
                const previews = sellerPreviewMap[seller.id] ?? [];
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

                      {/* Product thumbnails */}
                      {previews.length > 0 ? (
                        <View className="flex-row gap-1.5 mt-3">
                          {previews.map((uri, i) => (
                            <Image
                              key={i}
                              source={{ uri }}
                              style={{ width: 70, height: 70, borderRadius: 10, backgroundColor: '#F1F5F9' }}
                              resizeMode="cover"
                            />
                          ))}
                        </View>
                      ) : null}

                      {/* Stats + follow */}
                      <View className="flex-row items-center justify-between mt-4">
                        <View>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>
                            {displayFollowers}
                          </Text>
                          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary }}>
                            Takipçi
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
              Mağaza Akışı
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }} className="mt-0.5">
              {filteredSellers.length} satıcı · yeni vitrin ve kampanyalar
            </Text>
          </View>
        </View>

        <View className="px-4 pb-8">
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {filteredSellers.map((seller) => {
              const followed = Boolean(followedSellers[seller.id]);
              const isLive = seller.id === 'ds4' || seller.id === 'ds2';
              const preview = sellerPreviewMap[seller.id]?.[0];
              const displayFollowers = formatFollowersCount(parseFollowersText(seller.followers) + (followed ? 1 : 0));

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
                        <View className="w-1.5 h-1.5 rounded-full bg-white" />
                        <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: '#fff' }}>CANLI</Text>
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

                    {/* Preview product image */}
                    {preview ? (
                      <Image
                        source={{ uri: preview }}
                        style={{ width: '100%', height: 70, borderRadius: 10, marginTop: 8, backgroundColor: '#F1F5F9' }}
                        resizeMode="cover"
                      />
                    ) : null}

                    {/* Weekly drop */}
                    <View style={{ backgroundColor: '#ECFDF5' }} className="rounded-full px-2 py-1 mt-2 self-start">
                      <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: colors.success }}>
                        {seller.weeklyDrop}
                      </Text>
                    </View>

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
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}