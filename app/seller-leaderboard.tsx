import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
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
  { id: 'all', label: 'Tüm Zamanlar' },
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

function MedalBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 14 }}>🥇</Text>
    </View>
  );
  if (rank === 2) return (
    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 14 }}>🥈</Text>
    </View>
  );
  if (rank === 3) return (
    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 14 }}>🥉</Text>
    </View>
  );
  return (
    <View style={{ width: 28, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }}>#{rank}</Text>
    </View>
  );
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
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}>
          <MedalBadge rank={index + 1} />
          <Image
            source={{ uri: item.sellerAvatar || fallbackImages[index % fallbackImages.length] }}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F5F9', marginLeft: 6 }}
            resizeMode="cover"
          />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }}>
              {item.storeName || item.sellerName}
            </Text>
            <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary, marginTop: 1 }}>
              {followed ? 'Takip ediyorsun' : 'Takip ederek yarışını izle'}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }}>
            {Math.round(value).toLocaleString('tr-TR')}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 9, color: colors.textMuted }}>{valueLabel}</Text>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              toggleSellerFollow(item.sellerId);
            }}
            style={{ borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, marginTop: 3, backgroundColor: followed ? '#F1F5F9' : '#EFF6FF' }}
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
    if (items.length === 0) return null;
    return (
      <View style={{ backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#33333315', padding: 14, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 8, backgroundColor: '#EFF6FF' }}>
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

  const periodLabel = periods.find((p) => p.id === activePeriod)?.label ?? 'Haftalık';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F7' }} edges={['top']}>
      <View style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#33333315' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={() => router.back()}
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F7F7' }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={{ alignItems: 'center', flex: 1, paddingHorizontal: 12 }}>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.textPrimary }}>
              Satıcı Liderlik Kupası
            </Text>
            <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
              Satıcıların canlı yarışlarını takip et
            </Text>
          </View>
          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFBEB' }}>
            <Ionicons name="trophy" size={21} color="#D97706" />
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ marginHorizontal: 16, marginTop: 16, borderRadius: 24, padding: 20, backgroundColor: '#0F172A' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger }} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.danger }}>CANLI YARIŞ</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: '#94A3B8' }}>· {periodLabel}</Text>
          </View>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: '#fff' }}>
            Kupanın zirvesi her dönem yeniden yazılır
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: '#CBD5E1', marginTop: 6 }}>
            Beğeni, yorum, satış ve canlılık metriklerinde öne çıkan satıcıları takip et.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <View style={{ borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>{displayEntries.length} satıcı</Text>
            </View>
            <View style={{ borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>
                {Object.values(followedSellers).filter(Boolean).length} takipte
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginTop: 14 }}
        >
          {periods.map((period) => {
            const selected = activePeriod === period.id;
            return (
              <Pressable
                key={period.id}
                onPress={() => setActivePeriod(period.id)}
                style={{
                  height: 38,
                  paddingHorizontal: 16,
                  borderRadius: 19,
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
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

        <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#33333315', padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>Kupanın İlk 5 Satıcısı</Text>
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: colors.textMuted }}>puan</Text>
            )}
          </View>
          {displayEntries.slice(0, 5).map((item, index) => renderSellerRow(item, index, item.score, 'puan'))}
        </View>

        <View style={{ marginHorizontal: 16 }}>
          {renderCompetitionSection('Haftanın Yükselen Satıcıları', 'trending-up-outline', competitionLists.rising, (item) => item.score, 'keşif puanı')}
          {renderCompetitionSection('Canlı & Aktif Mağazalar', 'radio-outline', competitionLists.live, (item) => item.views + item.activity, 'canlılık')}
          {renderCompetitionSection('En Çok Beğeni Alanlar', 'heart-outline', competitionLists.liked, (item) => item.likes, 'beğeni')}
          {renderCompetitionSection('En Çok Yorum Alanlar', 'chatbubble-ellipses-outline', competitionLists.commented, (item) => item.comments, 'yorum')}
          {renderCompetitionSection('En Çok Satış Yapanlar', 'bag-check-outline', competitionLists.sales, (item) => item.sales, 'satış')}
          {renderCompetitionSection('En Çok Mesaj Alanlar', 'mail-outline', competitionLists.messaged, (item) => item.messages, 'mesaj')}
          {renderCompetitionSection('En Çok Takip Edilenler', 'people-outline', [...displayEntries].sort((a, b) => b.follows - a.follows).slice(0, 8), (item) => item.follows, 'takipçi')}
          {renderCompetitionSection('En Yüksek Puanlılar', 'star-outline', [...displayEntries].sort((a, b) => b.rating - a.rating).slice(0, 8), (item) => item.rating, 'yıldız')}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
