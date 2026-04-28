import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { colors, fonts } from '../src/constants/theme';
import { discoverSellers } from '../src/data/storeData';
import { useAuth } from '../src/context/AuthContext';
import { useListings } from '../src/context/ListingsContext';
import { fetchDiscoverStores, type DiscoverStore } from '../src/services/storeService';
import { fetchFollowedStoreIds } from '../src/services/storeFollowService';
import { isSupabaseConfigured } from '../src/services/supabase';
import { captureError } from '../src/services/monitoring';
import {
  buildCompetitionLists,
  fetchSellerPeriodLeaderboard,
  type LeaderboardPeriod,
  type SellerPeriodLeaderboardEntry,
} from '../src/services/exploreStoryService';

const periods: { id: LeaderboardPeriod; label: string }[] = [
  { id: 'daily', label: 'Günlük' },
  { id: 'weekly', label: 'Haftalık' },
  { id: 'monthly', label: 'Aylık' },
  { id: 'yearly', label: 'Yıllık' },
];

const fallbackImages = [
  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=200&q=70',
  'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=200&q=70',
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=200&q=70',
  'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=200&q=70',
];

function parseFollowersText(value: string) {
  const normalized = value.replace(',', '.').trim().toUpperCase();
  if (normalized.endsWith('B')) {
    const raw = Number.parseFloat(normalized.slice(0, -1));
    if (!Number.isNaN(raw)) return Math.round(raw * 1000);
  }

  const asNumber = Number.parseInt(normalized.replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(asNumber) ? 0 : asNumber;
}

function metricFallback(seller: DiscoverStore, index: number): SellerPeriodLeaderboardEntry {
  const followers = parseFollowersText(seller.followers);
  return {
    sellerId: seller.id,
    sellerName: seller.name,
    sellerAvatar: seller.avatar,
    storeName: seller.name,
    rank: index + 1,
    score: Math.max(10, Math.round((seller.rating * 18) + followers / 120)),
    likes: Math.max(0, Math.round(followers / 18)),
    favorites: Math.max(0, Math.round(followers / 30)),
    comments: Math.max(0, Math.round(followers / 48)),
    messages: Math.max(0, Math.round(followers / 55)),
    sales: Math.max(0, Math.round(followers / 70)),
    views: Math.max(0, Math.round(followers / 6)),
    follows: followers,
    rating: seller.rating,
    activity: seller.featured ? 90 - index * 4 : 65 - index * 3,
  };
}

export default function SellerLeaderboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { followedSellers, toggleSellerFollow, setFollowedSellersMap } = useListings();
  const [activePeriod, setActivePeriod] = useState<LeaderboardPeriod>('weekly');
  const [backendSellers, setBackendSellers] = useState<DiscoverStore[]>([]);
  const [leaderboardEntries, setLeaderboardEntries] = useState<SellerPeriodLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const canUseBackend = isSupabaseConfigured && Boolean(user) && !user?.id.startsWith('demo-');

  useEffect(() => {
    if (!canUseBackend) {
      setBackendSellers([]);
      return;
    }

    let active = true;

    fetchDiscoverStores(32)
      .then(async (stores) => {
        if (!active) return;
        setBackendSellers(stores);

        const followedIds = await fetchFollowedStoreIds(stores.map((store) => store.id));
        if (!active) return;

        const nextMap = stores.reduce<Record<string, boolean>>((acc, store) => {
          acc[store.id] = followedIds.includes(store.id);
          return acc;
        }, {});
        setFollowedSellersMap((current) => ({ ...current, ...nextMap }));
      })
      .catch((error) => {
        captureError(error, { scope: 'seller_leaderboard_fetch_stores' });
      });

    return () => {
      active = false;
    };
  }, [canUseBackend, setFollowedSellersMap]);

  useEffect(() => {
    if (!canUseBackend) {
      setLeaderboardEntries([]);
      return;
    }

    let active = true;
    setLoading(true);

    fetchSellerPeriodLeaderboard(activePeriod, 50)
      .then((entries) => {
        if (active) setLeaderboardEntries(entries);
      })
      .catch((error) => {
        captureError(error, { scope: 'seller_leaderboard_fetch_entries', period: activePeriod });
        if (active) setLeaderboardEntries([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activePeriod, canUseBackend]);

  const sellerSource = useMemo(
    () => (backendSellers.length > 0 ? backendSellers : discoverSellers),
    [backendSellers],
  );

  const displayEntries = useMemo(
    () => leaderboardEntries.length > 0 ? leaderboardEntries : sellerSource.slice(0, 10).map(metricFallback),
    [leaderboardEntries, sellerSource],
  );

  const competitionLists = useMemo(
    () => buildCompetitionLists(displayEntries),
    [displayEntries],
  );

  function openSellerStore(item: SellerPeriodLeaderboardEntry) {
    const encodedName = encodeURIComponent(item.storeName || item.sellerName);
    router.push(`/(tabs)/store?name=${encodedName}&storeKey=${encodeURIComponent(item.sellerId)}&sellerId=${encodeURIComponent(item.sellerId)}` as never);
  }

  function renderSellerRow(item: SellerPeriodLeaderboardEntry, index: number, value: number, valueLabel: string) {
    const followed = Boolean(followedSellers[item.sellerId]);

    return (
      <Pressable
        key={`${item.sellerId}-${valueLabel}-${index}`}
        onPress={() => openSellerStore(item)}
        className="flex-row items-center justify-between py-3"
      >
        <View className="flex-row items-center flex-1 pr-2">
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary, width: 30 }}>#{index + 1}</Text>
          <Image
            source={{ uri: item.sellerAvatar || fallbackImages[index % fallbackImages.length] }}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F5F9' }}
            resizeMode="cover"
          />
          <View className="flex-1 ml-2">
            <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }}>
              {item.storeName || item.sellerName}
            </Text>
            <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary, marginTop: 1 }}>
              {followed ? 'Takip ediyorsun' : 'Takip ederek yarışını izle'}
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }}>
            {Math.round(value)}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 9, color: colors.textMuted }}>{valueLabel}</Text>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              toggleSellerFollow(item.sellerId);
            }}
            className="rounded-full px-2.5 py-1 mt-1"
            style={{ backgroundColor: followed ? '#F1F5F9' : '#EFF6FF' }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: followed ? colors.textSecondary : colors.primary }}>
              {followed ? 'Takipte' : 'Takip Et'}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    );
  }

  function renderCompetitionSection(
    title: string,
    icon: string,
    items: SellerPeriodLeaderboardEntry[],
    valueForItem: (item: SellerPeriodLeaderboardEntry) => number,
    valueLabel: string,
  ) {
    return (
      <View className="bg-white rounded-2xl border border-[#33333315] p-3 mt-3">
        <View className="flex-row items-center justify-between mb-1">
          <View className="flex-row items-center flex-1 pr-2">
            <View className="w-8 h-8 rounded-full items-center justify-center mr-2" style={{ backgroundColor: '#EFF6FF' }}>
              <Ionicons name={icon as any} size={15} color={colors.primary} />
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>{title}</Text>
          </View>
          <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: colors.textMuted }}>{valueLabel}</Text>
        </View>
        {items.slice(0, 6).map((item, index) => renderSellerRow(item, index, valueForItem(item), valueLabel))}
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
      <View className="bg-white px-4 pt-3 pb-4 border-b border-[#33333315]">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: '#F7F7F7' }}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <View className="items-center flex-1 px-3">
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.textPrimary }}>
              Satıcı Liderlik Kupası
            </Text>
            <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
              Satıcıların canlı yarışlarını takip et
            </Text>
          </View>
          <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: '#FFFBEB' }}>
            <Ionicons name="trophy" size={21} color="#D97706" />
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="mx-4 mt-4 rounded-[24px] p-5" style={{ backgroundColor: '#0F172A' }}>
          <View className="flex-row items-center gap-2 mb-2">
            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.danger }} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.danger }}>CANLI YARIŞ</Text>
          </View>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: '#fff' }}>
            Kupanın zirvesi her dönem yeniden yazılır
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: '#CBD5E1', marginTop: 6 }}>
            Beğeni, yorum, satış ve canlılık metriklerinde öne çıkan satıcıları takip et.
          </Text>
          <View className="flex-row gap-2 mt-4">
            <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: '#ffffff1a' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>{displayEntries.length} satıcı</Text>
            </View>
            <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: '#ffffff1a' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>
                {Object.values(followedSellers).filter(Boolean).length} takipte
              </Text>
            </View>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginTop: 14 }}>
          {periods.map((period) => {
            const selected = activePeriod === period.id;
            return (
              <Pressable
                key={period.id}
                onPress={() => setActivePeriod(period.id)}
                className="h-10 px-4 rounded-full border items-center justify-center"
                style={{
                  backgroundColor: selected ? colors.primary : '#fff',
                  borderColor: selected ? colors.primary : colors.borderLight,
                }}
              >
                <Text style={{ fontFamily: selected ? fonts.bold : fonts.medium, fontSize: 12, color: selected ? '#fff' : colors.textPrimary }}>
                  {period.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="mx-4 mt-3 bg-white rounded-2xl border border-[#33333315] p-3">
          <View className="flex-row items-center justify-between mb-1">
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>Kupanın İlk 5 Satıcısı</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: colors.textMuted }}>{loading ? 'yükleniyor' : 'puan'}</Text>
          </View>
          {displayEntries.slice(0, 5).map((item, index) => renderSellerRow(item, index, item.score, 'puan'))}
        </View>

        <View className="mx-4">
          {renderCompetitionSection('Haftalık Canlı Satıcılar', 'radio-outline', competitionLists.live, (item) => item.views + item.activity, 'canlılık')}
          {renderCompetitionSection('En Çok Beğeni Alanlar', 'heart-outline', competitionLists.liked, (item) => item.likes, 'beğeni')}
          {renderCompetitionSection('En Çok Yorum Alanlar', 'chatbubble-ellipses-outline', competitionLists.commented, (item) => item.comments, 'yorum')}
          {renderCompetitionSection('En Çok Satış Yapanlar', 'bag-check-outline', competitionLists.sales, (item) => item.sales, 'satış')}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
