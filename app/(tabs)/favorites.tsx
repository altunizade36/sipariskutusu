import { View, Text, ScrollView, Pressable, Dimensions, RefreshControl, Share, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../../src/constants/theme';
import { ProductCard } from '../../src/components/ProductCard';
import SkeletonCard from '../../src/components/SkeletonCard';
import { EmptyState } from '../../src/components/EmptyState';
import { ProfileButton } from '../../src/components/ProfileButton';
import BoxMascot from '../../src/components/BoxMascot';
import { useFavorites } from '../../src/hooks/useFavorites';
import { useAuth } from '../../src/context/AuthContext';
import { useAndroidTabBackToHome } from '../../src/hooks/useAndroidTabBackToHome';
import { getSupabaseClient } from '../../src/services/supabase';
import { fetchMyFollowedStores, type FollowedStoreInfo } from '../../src/services/storeFollowService';

const CATEGORY_LABELS: Record<string, string> = {
  women: 'Kadin',
  men: 'Erkek',
  'mother-child': 'Anne & Cocuk',
  home: 'Ev & Yasam',
  supermarket: 'Market',
  cosmetics: 'Kozmetik',
  'shoes-bags': 'Ayakkabi & Canta',
  electronics: 'Elektronik',
  watches: 'Saat & Aksesuar',
  sports: 'Spor & Outdoor',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 32 - 12) / 2;

export default function FavoritesScreen() {
  const router = useRouter();
  useAndroidTabBackToHome();
  const { user } = useAuth();
  const { favorites, loading: favLoading, refresh: refreshFavs } = useFavorites();
  const [tab, setTab] = useState<'products' | 'collections' | 'brands'>('products');
  const [sortBy, setSortBy] = useState<'default' | 'priceAsc' | 'priceDesc' | 'topRated'>('default');
  const [onlyDiscount, setOnlyDiscount] = useState(false);
  const [onlyFreeShipping, setOnlyFreeShipping] = useState(false);
  const [columns, setColumns] = useState<1 | 2>(2);
  const [selectedCollectionCategory, setSelectedCollectionCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [followedStores, setFollowedStores] = useState<FollowedStoreInfo[]>([]);
  const [followedStoresLoading, setFollowedStoresLoading] = useState(false);
  const cardWidth = columns === 2 ? CARD_WIDTH : SCREEN_WIDTH - 32;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshFavs();
      if (user) {
        fetchMyFollowedStores().then(setFollowedStores).catch(() => undefined);
      }
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user) { setFollowedStores([]); return; }
    setFollowedStoresLoading(true);
    fetchMyFollowedStores()
      .then(setFollowedStores)
      .catch(() => setFollowedStores([]))
      .finally(() => setFollowedStoresLoading(false));
  }, [user?.id]);

  const visibleFavorites = useMemo(() => {
    let source = [...favorites];

    if (selectedCollectionCategory) {
      source = source.filter((item) => item.category === selectedCollectionCategory);
    }

    if (onlyDiscount) {
      source = source.filter((item) => Boolean(item.discount && item.discount > 0));
    }

    if (onlyFreeShipping) {
      source = source.filter((item) => Boolean(item.freeShipping));
    }

    if (sortBy === 'priceAsc') {
      source.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'priceDesc') {
      source.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'topRated') {
      source.sort((a, b) => b.rating - a.rating);
    }

    return source;
  }, [favorites, onlyDiscount, onlyFreeShipping, selectedCollectionCategory, sortBy]);

  const collections = useMemo(() => {
    const groups = new Map<string, typeof favorites>();
    for (const item of favorites) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }

    return Array.from(groups.entries())
      .map(([category, items]) => {
        const totalPrice = items.reduce((sum, item) => sum + item.price, 0);
        return {
          id: category,
          title: CATEGORY_LABELS[category] ?? category,
          count: items.length,
          cover: items[0]?.image,
          totalPrice,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [favorites]);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="px-4 py-3 border-b border-[#33333315]">
        <View className="flex-row items-center justify-between">
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: colors.textPrimary }}>
Favorilerim
          </Text>
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => Share.share({ message: 'Favorilerimi siparişkutusu uygulamasında keşfet!' })}>
              <Ionicons name="share-outline" size={22} color={colors.textPrimary} />
            </Pressable>
            <ProfileButton />
          </View>
        </View>
        <View className="flex-row gap-2 mt-3">
          {[
            { key: 'products', label: `Ürünler (${favorites.length})` },
            { key: 'collections', label: 'Koleksiyonlar' },
            { key: 'brands', label: `Mağazalar (${followedStores.length})` },
          ].map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key as typeof tab)}
                style={{
                  backgroundColor: active ? colors.primary : '#F7F7F7',
                }}
                className="px-4 h-9 rounded-full items-center justify-center"
              >
                <Text
                  style={{
                    fontFamily: fonts.medium,
                    fontSize: 12,
                    color: active ? '#fff' : colors.textPrimary,
                  }}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {tab === 'products' ? (
        <ScrollView 
          className="flex-1" 
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* Filter bar */}
          <View className="px-4 pt-3 pb-1">
            {/* Sort pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
              {selectedCollectionCategory ? (
                <Pressable
                  onPress={() => setSelectedCollectionCategory(null)}
                  style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' }}
                  className="h-8 px-3 rounded-full flex-row items-center gap-1"
                >
                  <Ionicons name="albums-outline" size={13} color={colors.primary} />
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>
                    {CATEGORY_LABELS[selectedCollectionCategory] ?? selectedCollectionCategory}
                  </Text>
                  <Ionicons name="close" size={13} color={colors.primary} />
                </Pressable>
              ) : null}
              {([
                { id: 'default', label: 'Varsayılan' },
                { id: 'priceAsc', label: 'Fiyat ↑' },
                { id: 'priceDesc', label: 'Fiyat ↓' },
                { id: 'topRated', label: 'En İyi Puan' },
              ] as const).map((opt) => {
                const active = sortBy === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setSortBy(opt.id)}
                    style={{ backgroundColor: active ? colors.primary : '#F7F7F7', borderWidth: 1, borderColor: active ? colors.primary : colors.borderLight }}
                    className="h-8 px-3 rounded-full items-center justify-center"
                  >
                    <Text style={{ fontFamily: active ? fonts.bold : fonts.medium, fontSize: 12, color: active ? '#fff' : colors.textPrimary }}>{opt.label}</Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setOnlyDiscount((v) => !v)}
                style={{ backgroundColor: onlyDiscount ? '#FEF3C7' : '#F7F7F7', borderWidth: 1, borderColor: onlyDiscount ? '#F59E0B' : colors.borderLight }}
                className="h-8 px-3 rounded-full flex-row items-center gap-1"
              >
                <Ionicons name="pricetag-outline" size={13} color={onlyDiscount ? '#F59E0B' : colors.textPrimary} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: onlyDiscount ? '#F59E0B' : colors.textPrimary }}>İndirimde</Text>
              </Pressable>
              <Pressable
                onPress={() => setOnlyFreeShipping((v) => !v)}
                style={{ backgroundColor: onlyFreeShipping ? '#EFF6FF' : '#F7F7F7', borderWidth: 1, borderColor: onlyFreeShipping ? '#60A5FA' : colors.borderLight }}
                className="h-8 px-3 rounded-full flex-row items-center gap-1"
              >
                <Ionicons name="car-outline" size={13} color={onlyFreeShipping ? '#2563EB' : colors.textPrimary} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: onlyFreeShipping ? '#2563EB' : colors.textPrimary }}>Ücretsiz Kargo</Text>
              </Pressable>
              <Pressable
                onPress={() => setColumns((c) => (c === 2 ? 1 : 2))}
                style={{ backgroundColor: '#F7F7F7', borderWidth: 1, borderColor: colors.borderLight }}
                className="h-8 w-8 rounded-full items-center justify-center"
              >
                <Ionicons name={columns === 2 ? 'grid-outline' : 'list-outline'} size={14} color={colors.textPrimary} />
              </Pressable>
            </ScrollView>
          </View>

          {visibleFavorites.length === 0 ? (
            <View style={{ borderColor: '#CBD5E1', borderStyle: 'dashed', borderWidth: 1.5, borderRadius: 20, backgroundColor: '#F8FAFC', paddingVertical: 40, marginHorizontal: 16, marginTop: 16, alignItems: 'center', justifyContent: 'center' }}>
                {!user ? (
                  <>
                    <BoxMascot variant="welcome" size={90} animated />
                    <Text style={{ fontFamily: fonts.headingBold, fontSize: 15, color: colors.textPrimary, marginTop: 12 }}>
                      Giriş yapman gerekiyor
                    </Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 18, paddingHorizontal: 24 }}>
                      Favori ürünlerini kaydetmek için giriş yap.
                    </Text>
                    <Pressable
                      onPress={() => router.push('/auth')}
                      style={{ marginTop: 16, height: 40, paddingHorizontal: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>Giriş Yap</Text>
                    </Pressable>
                  </>
                ) : favLoading ? (
                  <BoxMascot variant="order" size={80} animated />
                ) : (
                  <>
                    <BoxMascot variant="welcome" size={90} animated />
                    <Text style={{ fontFamily: fonts.headingBold, fontSize: 15, color: colors.textPrimary, marginTop: 12 }}>
                      Henüz favori ürün yok
                    </Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 18, paddingHorizontal: 24 }}>
                      Beğendiğin ürünleri favorilere ekle ve kolayca bulabilirsin.
                    </Text>
                    <Pressable
                      onPress={() => router.push('/')}
                      style={{ marginTop: 16, height: 40, paddingHorizontal: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>Ürünleri Keşfet</Text>
                    </Pressable>
                  </>
                )}
            </View>
          ) : (
            <View className="flex-row flex-wrap px-4 pt-3" style={{ gap: 12 }}>
              {favLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <View key={`skeleton-${i}`} style={{ width: cardWidth }}>
                      <SkeletonCard width={cardWidth} />
                    </View>
                  ))
                : visibleFavorites.map((p) => (
                    <View key={p.id} style={{ width: cardWidth }}>
                      <ProductCard product={p} />
                    </View>
                  ))}
            </View>
          )}
          <View className="h-8" />
        </ScrollView>
      ) : tab === 'brands' ? (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {followedStoresLoading ? (
            <View className="px-4 pt-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <View key={i} style={{ height: 72, backgroundColor: '#F1F5F9', borderRadius: 16, marginBottom: 10 }} />
              ))}
            </View>
          ) : followedStores.length === 0 ? (
            <View className="items-center justify-center px-8 pt-16">
              <View className="w-16 h-16 rounded-full bg-[#F7F7F7] items-center justify-center mb-3">
                <Ionicons name="storefront-outline" size={28} color={colors.primary} />
              </View>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 15, color: colors.textPrimary }}>Takip edilen mağaza yok</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 6, textAlign: 'center' }}>
                Satıcıların mağazasına girip takip ettiğinde burada görünür.
              </Text>
              <Pressable
                onPress={() => router.push('/(tabs)/explore')}
                style={{ backgroundColor: colors.primary }}
                className="mt-4 px-5 py-2.5 rounded-full"
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>Satıcıları Keşfet</Text>
              </Pressable>
            </View>
          ) : (
            <View className="px-4 pt-3">
              {followedStores.map((store) => (
                <Pressable
                  key={store.id}
                  onPress={() => router.push(`/store?sellerId=${store.id}` as any)}
                  className="flex-row items-center bg-white rounded-2xl p-3 mb-2 active:opacity-80"
                  style={{ borderWidth: 1, borderColor: '#33333315' }}
                >
                  {store.avatar_url ? (
                    <Image source={{ uri: store.avatar_url }} style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }} />
                  ) : (
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: colors.primary }}>{(store.name[0] ?? 'M').toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{store.name}</Text>
                      {store.is_verified && <Ionicons name="checkmark-circle" size={14} color={colors.primary} />}
                    </View>
                    {store.username ? (
                      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary }}>@{store.username}</Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 2 }}>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary }}>
                        {store.follower_count.toLocaleString('tr-TR')} takipçi
                      </Text>
                      {store.listing_count > 0 && (
                        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary }}>
                          {store.listing_count} ürün
                        </Text>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          )}
          <View className="h-8" />
        </ScrollView>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {collections.length === 0 ? (
            <View className="items-center justify-center px-8 pt-16">
              <View className="w-20 h-20 rounded-full bg-[#F7F7F7] items-center justify-center mb-4">
                <Ionicons name="albums-outline" size={36} color={colors.primary} />
              </View>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: colors.textPrimary }} className="mb-1">
                Koleksiyon icin favori gerekli
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>
                Favorilerine urun ekledikce kategorine gore otomatik koleksiyonlar burada olusur.
              </Text>
              <Pressable
                onPress={() => router.push('/(tabs)/explore')}
                style={{ backgroundColor: colors.primary }}
                className="mt-5 h-11 px-6 rounded-xl items-center justify-center"
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>Kesfete Don</Text>
              </Pressable>
            </View>
          ) : (
            <View className="px-4 pt-4">
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
                Kategoriye gore otomatik olusan koleksiyonlarin
              </Text>
              {collections.map((collection) => (
                <Pressable
                  key={collection.id}
                  onPress={() => {
                    setSelectedCollectionCategory(collection.id);
                    setTab('products');
                  }}
                  className="mb-3 rounded-2xl overflow-hidden"
                  style={{ borderWidth: 1, borderColor: '#33333315' }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff' }}>
                    {collection.cover ? (
                      <Image source={{ uri: collection.cover }} style={{ width: 56, height: 56, borderRadius: 12, marginRight: 12 }} />
                    ) : (
                      <View style={{ width: 56, height: 56, borderRadius: 12, marginRight: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF' }}>
                        <Ionicons name="albums-outline" size={22} color={colors.primary} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>
                        {collection.title}
                      </Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 3 }}>
                        {collection.count} urun • Toplam deger: ₺{collection.totalPrice.toFixed(0)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                </Pressable>
              ))}
            </View>
          )}
          <View className="h-8" />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
