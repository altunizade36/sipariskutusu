import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
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

const SECTION_CONFIGS = [
  { key: 'rising',    title: 'Yükselen Satıcılar',       icon: 'trending-up',           gradient: ['#F59E0B', '#EF4444'] as const, valueKey: 'score',    label: 'keşif' },
  { key: 'live',      title: 'Canlı & Aktif Mağazalar',  icon: 'radio',                 gradient: ['#10B981', '#059669'] as const, valueKey: 'activity', label: 'canlılık' },
  { key: 'liked',     title: 'En Çok Beğeni Alanlar',    icon: 'heart',                 gradient: ['#EC4899', '#EF4444'] as const, valueKey: 'likes',   label: 'beğeni' },
  { key: 'commented', title: 'En Çok Yorum Alanlar',     icon: 'chatbubble-ellipses',   gradient: ['#8B5CF6', '#6366F1'] as const, valueKey: 'comments',label: 'yorum' },
  { key: 'sales',     title: 'En Çok Satış Yapanlar',    icon: 'bag-check',             gradient: ['#1E5FC6', '#3B82F6'] as const, valueKey: 'sales',   label: 'satış' },
  { key: 'messaged',  title: 'En Çok Mesaj Alanlar',     icon: 'mail',                  gradient: ['#06B6D4', '#0EA5E9'] as const, valueKey: 'messages',label: 'mesaj' },
] as const;

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

function PodiumCard({ entry, rank, onPress }: { entry: SellerPeriodLeaderboardEntry; rank: 1 | 2 | 3; onPress: () => void }) {
  const isFirst = rank === 1;
  const configs = {
    1: { emoji: '🥇', gradient: ['#F59E0B', '#D97706'] as const, size: 60, height: 90, labelBg: '#FEF3C7', labelColor: '#92400E' },
    2: { emoji: '🥈', gradient: ['#94A3B8', '#64748B'] as const, size: 52, height: 70, labelBg: '#F1F5F9', labelColor: '#475569' },
    3: { emoji: '🥉', gradient: ['#F97316', '#EA580C'] as const, size: 52, height: 60, labelBg: '#FFF7ED', labelColor: '#9A3412' },
  };
  const cfg = configs[rank];
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', flex: rank === 1 ? 1.2 : 1 }}>
      <Text style={{ fontSize: 20, marginBottom: 4 }}>{cfg.emoji}</Text>
      <LinearGradient
        colors={cfg.gradient}
        style={{ width: cfg.size, height: cfg.size, borderRadius: cfg.size / 2, padding: 2, marginBottom: 6 }}
      >
        <Image
          source={{ uri: entry.sellerAvatar || fallbackImages[rank - 1] }}
          style={{ width: '100%', height: '100%', borderRadius: cfg.size / 2 - 2, borderWidth: 2, borderColor: '#fff' }}
        />
      </LinearGradient>
      <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: isFirst ? 13 : 11, color: '#fff', maxWidth: isFirst ? 90 : 70, textAlign: 'center' }}>
        {entry.storeName || entry.sellerName}
      </Text>
      <View style={{ backgroundColor: cfg.labelBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 4 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: cfg.labelColor }}>
          {Math.round(entry.score).toLocaleString('tr-TR')} puan
        </Text>
      </View>
      <View style={{ height: cfg.height, width: isFirst ? 72 : 56, borderRadius: 12, marginTop: 8, backgroundColor: rank === 1 ? 'rgba(245,158,11,0.25)' : rank === 2 ? 'rgba(148,163,184,0.2)' : 'rgba(249,115,22,0.2)', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 }}>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: rank === 1 ? 22 : 18, color: rank === 1 ? '#F59E0B' : rank === 2 ? '#94A3B8' : '#F97316' }}>
          #{rank}
        </Text>
      </View>
    </Pressable>
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
    if (!canUseBackend) { setBackendSellers([]); return; }
    let active = true;
    fetchDiscoverStores(32)
      .then(async (stores) => {
        if (!active) return;
        setBackendSellers(stores);
        const followedIds = await fetchFollowedStoreIds(stores.map((store) => store.id));
        if (!active) return;
        const nextMap = stores.reduce<Record<string, boolean>>((acc, store) => { acc[store.id] = followedIds.includes(store.id); return acc; }, {});
        setFollowedSellersMap((current) => ({ ...current, ...nextMap }));
      })
      .catch((error) => captureError(error, { scope: 'seller_leaderboard_fetch_stores' }));
    return () => { active = false; };
  }, [canUseBackend, setFollowedSellersMap]);

  useEffect(() => {
    if (!canUseBackend) { setLeaderboardEntries([]); return; }
    let active = true;
    setLoading(true);
    fetchSellerPeriodLeaderboard(activePeriod, 50)
      .then((entries) => { if (active) setLeaderboardEntries(entries); })
      .catch((error) => { captureError(error, { scope: 'seller_leaderboard_fetch_entries', period: activePeriod }); if (active) setLeaderboardEntries([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [activePeriod, canUseBackend]);

  const sellerSource = useMemo(() => (backendSellers.length > 0 ? backendSellers : discoverSellers), [backendSellers]);
  const displayEntries = useMemo(() => leaderboardEntries.length > 0 ? leaderboardEntries : sellerSource.slice(0, 10).map(metricFallback), [leaderboardEntries, sellerSource]);
  const competitionLists = useMemo(() => buildCompetitionLists(displayEntries), [displayEntries]);

  const top3 = displayEntries.slice(0, 3);
  const rest = displayEntries.slice(3, 10);

  function openSellerStore(item: SellerPeriodLeaderboardEntry) {
    const encodedName = encodeURIComponent(item.storeName || item.sellerName);
    router.push(`/(tabs)/store?name=${encodedName}&storeKey=${encodeURIComponent(item.sellerId)}&sellerId=${encodeURIComponent(item.sellerId)}` as never);
  }

  function renderSellerRow(item: SellerPeriodLeaderboardEntry, index: number, value: number, valueLabel: string, gradient: readonly [string, string]) {
    const followed = Boolean(followedSellers[item.sellerId]);
    const rank = index + 1;
    return (
      <Pressable
        key={`${item.sellerId}-${valueLabel}-${index}`}
        onPress={() => openSellerStore(item)}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center',
          paddingVertical: 10, paddingHorizontal: 12,
          backgroundColor: pressed ? '#F0F5FF' : '#fff',
          borderRadius: 14, marginBottom: 6,
          borderWidth: 1, borderColor: '#E8EDF5',
        })}
      >
        {/* Rank */}
        <View style={{ width: 28, alignItems: 'center', marginRight: 8 }}>
          {rank === 1 ? <Text style={{ fontSize: 16 }}>🥇</Text>
           : rank === 2 ? <Text style={{ fontSize: 16 }}>🥈</Text>
           : rank === 3 ? <Text style={{ fontSize: 16 }}>🥉</Text>
           : <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }}>#{rank}</Text>}
        </View>
        {/* Avatar */}
        <LinearGradient colors={gradient} style={{ width: 40, height: 40, borderRadius: 20, padding: 1.5, marginRight: 10 }}>
          <Image
            source={{ uri: item.sellerAvatar || fallbackImages[index % fallbackImages.length] }}
            style={{ width: '100%', height: '100%', borderRadius: 18, borderWidth: 2, borderColor: '#fff' }}
            resizeMode="cover"
          />
        </LinearGradient>
        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>
            {item.storeName || item.sellerName}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 10, color: followed ? colors.primary : colors.textMuted, marginTop: 1 }}>
            {followed ? '✓ Takip ediyorsun' : 'Takip ederek yarışı izle'}
          </Text>
        </View>
        {/* Value + Follow */}
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>
              {Math.round(value).toLocaleString('tr-TR')}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 9, color: colors.textMuted }}>{valueLabel}</Text>
          </View>
          <Pressable
            onPress={(e) => { e.stopPropagation(); toggleSellerFollow(item.sellerId); }}
            style={{
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
              backgroundColor: followed ? '#F1F5F9' : colors.primary + '15',
              borderWidth: 1, borderColor: followed ? '#E2E8F0' : colors.primary + '40',
            }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: followed ? colors.textSecondary : colors.primary }}>
              {followed ? 'Takipte' : 'Takip Et'}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    );
  }

  function renderSection(cfg: { key: string; title: string; icon: string; gradient: readonly [string, string]; valueKey: string; label: string }, items: SellerPeriodLeaderboardEntry[]) {
    if (items.length === 0) return null;
    return (
      <View key={cfg.key} style={{ marginBottom: 14 }}>
        {/* Section header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <LinearGradient
            colors={cfg.gradient}
            style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name={`${cfg.icon}-outline` as any} size={16} color="#fff" />
          </LinearGradient>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, flex: 1 }}>{cfg.title}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textMuted }}>{cfg.label}</Text>
        </View>
        {items.slice(0, 6).map((item, index) => {
          const value = cfg.valueKey === 'activity'
            ? item.views + item.activity
            : (item[cfg.valueKey as keyof SellerPeriodLeaderboardEntry] as number) ?? 0;
          return renderSellerRow(item, index, value, cfg.label, cfg.gradient);
        })}
      </View>
    );
  }

  const periodLabel = periods.find((p) => p.id === activePeriod)?.label ?? 'Haftalık';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F0F4FF' }} edges={['top']}>
      {/* Gradient Header */}
      <LinearGradient
        colors={['#1E5FC6', '#3B82F6', '#6366F1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingBottom: 0 }}
      >
        {/* Nav row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' }}
          >
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: '#fff' }}>
              Satıcı Liderlik Kupası
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>
              Satıcıların canlı yarışlarını takip et
            </Text>
          </View>
          <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' }}>
            <Text style={{ fontSize: 20 }}>🏆</Text>
          </View>
        </View>

        {/* Live badge row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF6B6B' }} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>CANLI YARIŞ</Text>
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>· {periodLabel} · {displayEntries.length} satıcı</Text>
          {loading && <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />}
        </View>

        {/* Podium (top 3) */}
        {top3.length >= 3 ? (
          <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8 }}>
              <PodiumCard entry={top3[1]!} rank={2} onPress={() => openSellerStore(top3[1]!)} />
              <PodiumCard entry={top3[0]!} rank={1} onPress={() => openSellerStore(top3[0]!)} />
              <PodiumCard entry={top3[2]!} rank={3} onPress={() => openSellerStore(top3[2]!)} />
            </View>
          </View>
        ) : null}
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Period selector */}
        <View style={{ backgroundColor: '#fff', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E8EDF5' }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            {periods.map((period) => {
              const selected = activePeriod === period.id;
              return (
                <Pressable
                  key={period.id}
                  onPress={() => setActivePeriod(period.id)}
                  style={{
                    height: 36, paddingHorizontal: 16, borderRadius: 18,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: selected ? colors.primary : '#F1F5F9',
                    borderWidth: selected ? 0 : 1, borderColor: '#E8EDF5',
                  }}
                >
                  <Text style={{ fontFamily: selected ? fonts.bold : fonts.medium, fontSize: 13, color: selected ? '#fff' : colors.textPrimary }}>
                    {period.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>

          {/* Rank 4-10 list */}
          {rest.length > 0 ? (
            <View style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <LinearGradient
                  colors={['#1E5FC6', '#6366F1']}
                  style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="trophy-outline" size={16} color="#fff" />
                </LinearGradient>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>Kupanın Tüm Sıralaması</Text>
              </View>
              {rest.map((item, index) => renderSellerRow(item, index + 3, item.score, 'puan', ['#1E5FC6', '#6366F1']))}
            </View>
          ) : null}

          {/* Competition sections */}
          {SECTION_CONFIGS.map((cfg) => {
            const listMap: Record<string, SellerPeriodLeaderboardEntry[]> = {
              rising: competitionLists.rising,
              live: competitionLists.live,
              liked: competitionLists.liked,
              commented: competitionLists.commented,
              sales: competitionLists.sales,
              messaged: competitionLists.messaged,
            };
            return renderSection(cfg, listMap[cfg.key] ?? []);
          })}

          {/* Most followed */}
          {renderSection(
            { key: 'follows' as any, title: 'En Çok Takip Edilenler', icon: 'people', gradient: ['#0EA5E9', '#6366F1'], valueKey: 'follows', label: 'takipçi' },
            [...displayEntries].sort((a, b) => b.follows - a.follows).slice(0, 8),
          )}

          {/* Top rated */}
          {renderSection(
            { key: 'rating' as any, title: 'En Yüksek Puanlılar', icon: 'star', gradient: ['#F59E0B', '#F97316'], valueKey: 'rating', label: 'yıldız' },
            [...displayEntries].sort((a, b) => b.rating - a.rating).slice(0, 8),
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
