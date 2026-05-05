import { View, Text, ScrollView, Pressable, Dimensions, RefreshControl, Share, Image, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts } from '../../src/constants/theme';
import { ProductCard } from '../../src/components/ProductCard';
import SkeletonCard from '../../src/components/SkeletonCard';
import { ProfileButton } from '../../src/components/ProfileButton';
import BoxMascot from '../../src/components/BoxMascot';
import { useFavorites } from '../../src/hooks/useFavorites';
import { useAuth } from '../../src/context/AuthContext';
import { useAndroidTabBackToHome } from '../../src/hooks/useAndroidTabBackToHome';
import { fetchMyFollowedStores, type FollowedStoreInfo } from '../../src/services/storeFollowService';

const CATEGORY_LABELS: Record<string, string> = {
  women: 'Kadın',
  men: 'Erkek',
  'mother-child': 'Anne & Çocuk',
  home: 'Ev & Yaşam',
  supermarket: 'Market',
  cosmetics: 'Kozmetik',
  'shoes-bags': 'Ayakkabı & Çanta',
  electronics: 'Elektronik',
  watches: 'Saat & Aksesuar',
  sports: 'Spor & Outdoor',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 32 - 12) / 2;

export default function FavoritesScreen() {
  const router = useRouter();
  useAndroidTabBackToHome();
  const { user, isDarkMode } = useAuth();
  const { favorites, loading: favLoading, refresh: refreshFavs } = useFavorites();
  const [tab, setTab] = useState<'products' | 'collections' | 'brands'>('products');
  const [sortBy, setSortBy] = useState<'default' | 'priceAsc' | 'priceDesc' | 'topRated'>('default');
  const [onlyDiscount, setOnlyDiscount] = useState(false);
  const [onlyFreeShipping, setOnlyFreeShipping] = useState(false);
  const [columns, setColumns] = useState<1 | 2>(2);
  const [selectedCollectionCategory, setSelectedCollectionCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [followedStores, setFollowedStores] = useState<FollowedStoreInfo[]>([]);
  const [followedStoresLoading, setFollowedStoresLoading] = useState(false);
  const cardWidth = columns === 2 ? CARD_WIDTH : SCREEN_WIDTH - 32;

  const dark = isDarkMode;
  const bg = dark ? '#0F172A' : '#F8FAFF';
  const headerBg = dark ? '#111827' : '#fff';
  const cardBg = dark ? '#1E293B' : '#fff';
  const border = dark ? '#1E293B' : '#E8EDF5';
  const textPrimary = dark ? '#F1F5F9' : colors.textPrimary;
  const textSecondary = dark ? '#94A3B8' : colors.textSecondary;
  const textMuted = dark ? '#64748B' : colors.textMuted;
  const chipBg = dark ? '#1E293B' : '#F1F5F9';

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
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      source = source.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.brand?.toLowerCase().includes(q) ||
          item.category?.toLowerCase().includes(q),
      );
    }
    if (selectedCollectionCategory) {
      source = source.filter((item) => item.category === selectedCollectionCategory);
    }
    if (onlyDiscount) {
      source = source.filter((item) => Boolean(item.discount && item.discount > 0));
    }
    if (onlyFreeShipping) {
      source = source.filter((item) => Boolean(item.freeShipping));
    }
    if (sortBy === 'priceAsc') source.sort((a, b) => a.price - b.price);
    else if (sortBy === 'priceDesc') source.sort((a, b) => b.price - a.price);
    else if (sortBy === 'topRated') source.sort((a, b) => b.rating - a.rating);
    return source;
  }, [favorites, onlyDiscount, onlyFreeShipping, selectedCollectionCategory, sortBy, searchQuery]);

  const collections = useMemo(() => {
    const groups = new Map<string, typeof favorites>();
    for (const item of favorites) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    return Array.from(groups.entries())
      .map(([category, items]) => ({
        id: category,
        title: CATEGORY_LABELS[category] ?? category,
        count: items.length,
        covers: items.slice(0, 4).map((i) => i.image).filter(Boolean),
        totalPrice: items.reduce((sum, item) => sum + item.price, 0),
      }))
      .sort((a, b) => b.count - a.count);
  }, [favorites]);

  const TABS = [
    { key: 'products', label: 'Ürünler', count: favorites.length, icon: 'heart' },
    { key: 'collections', label: 'Koleksiyonlar', count: collections.length, icon: 'albums' },
    { key: 'brands', label: 'Mağazalar', count: followedStores.length, icon: 'storefront' },
  ] as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top']}>
      {/* Header */}
      <View style={{ backgroundColor: headerBg, borderBottomWidth: 1, borderBottomColor: border }}>
        {/* Title row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <LinearGradient
              colors={['#FF6B6B', '#E91E8C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="heart" size={18} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 20, color: textPrimary }}>Favorilerim</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: textMuted, marginTop: -1 }}>
                {favorites.length} ürün kaydedildi
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable
              onPress={() => Share.share({ message: 'Favorilerimi Sipariş Kutusu uygulamasında keşfet!' })}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: chipBg, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="share-social-outline" size={18} color={textPrimary} />
            </Pressable>
            <ProfileButton />
          </View>
        </View>

        {/* Search bar (products tab only) */}
        {tab === 'products' && (
          <View style={{ marginHorizontal: 16, marginTop: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: chipBg, borderRadius: 14, paddingHorizontal: 12, height: 42, borderWidth: 1.5, borderColor: border }}>
            <Ionicons name="search-outline" size={16} color={colors.primary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Favorilerde ara..."
              placeholderTextColor={textMuted}
              style={{ flex: 1, marginLeft: 8, fontSize: 13, fontFamily: fonts.regular, color: textPrimary }}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={textMuted} />
              </Pressable>
            )}
          </View>
        )}

        {/* Tab selector */}
        <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 }}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={{
                  flex: 1,
                  height: 38,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 5,
                  backgroundColor: active ? colors.primary : chipBg,
                  borderWidth: active ? 0 : 1,
                  borderColor: border,
                }}
              >
                <Ionicons name={`${t.icon}${active ? '' : '-outline'}` as any} size={13} color={active ? '#fff' : textMuted} />
                <Text style={{ fontFamily: active ? fonts.bold : fonts.medium, fontSize: 12, color: active ? '#fff' : textMuted }}>
                  {t.label}
                </Text>
                {t.count > 0 && (
                  <View style={{
                    backgroundColor: active ? 'rgba(255,255,255,0.25)' : colors.primary + '18',
                    minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
                  }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: active ? '#fff' : colors.primary }}>{t.count}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Products tab */}
      {tab === 'products' ? (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* Filter bar */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {selectedCollectionCategory ? (
                <Pressable
                  onPress={() => setSelectedCollectionCategory(null)}
                  style={{ backgroundColor: '#EFF6FF', borderWidth: 1.5, borderColor: '#BFDBFE', height: 32, paddingHorizontal: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 5 }}
                >
                  <Ionicons name="albums-outline" size={12} color={colors.primary} />
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>
                    {CATEGORY_LABELS[selectedCollectionCategory] ?? selectedCollectionCategory}
                  </Text>
                  <Ionicons name="close" size={12} color={colors.primary} />
                </Pressable>
              ) : null}
              {([
                { id: 'default', label: 'Varsayılan', icon: 'swap-vertical-outline' },
                { id: 'priceAsc', label: 'Fiyat ↑', icon: 'trending-up-outline' },
                { id: 'priceDesc', label: 'Fiyat ↓', icon: 'trending-down-outline' },
                { id: 'topRated', label: 'En İyi', icon: 'star-outline' },
              ] as const).map((opt) => {
                const active = sortBy === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setSortBy(opt.id)}
                    style={{
                      height: 32, paddingHorizontal: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 5,
                      backgroundColor: active ? colors.primary : chipBg,
                      borderWidth: 1.5, borderColor: active ? colors.primary : border,
                    }}
                  >
                    <Ionicons name={opt.icon} size={12} color={active ? '#fff' : textMuted} />
                    <Text style={{ fontFamily: active ? fonts.bold : fonts.medium, fontSize: 12, color: active ? '#fff' : textPrimary }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setOnlyDiscount((v) => !v)}
                style={{
                  height: 32, paddingHorizontal: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 5,
                  backgroundColor: onlyDiscount ? '#FEF3C7' : chipBg,
                  borderWidth: 1.5, borderColor: onlyDiscount ? '#F59E0B' : border,
                }}
              >
                <Ionicons name="pricetag-outline" size={12} color={onlyDiscount ? '#F59E0B' : textMuted} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: onlyDiscount ? '#F59E0B' : textPrimary }}>İndirimde</Text>
              </Pressable>
              <Pressable
                onPress={() => setOnlyFreeShipping((v) => !v)}
                style={{
                  height: 32, paddingHorizontal: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 5,
                  backgroundColor: onlyFreeShipping ? '#EFF6FF' : chipBg,
                  borderWidth: 1.5, borderColor: onlyFreeShipping ? '#60A5FA' : border,
                }}
              >
                <Ionicons name="car-outline" size={12} color={onlyFreeShipping ? '#2563EB' : textMuted} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: onlyFreeShipping ? '#2563EB' : textPrimary }}>Ücretsiz Kargo</Text>
              </Pressable>
              <Pressable
                onPress={() => setColumns((c) => (c === 2 ? 1 : 2))}
                style={{ height: 32, width: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: chipBg, borderWidth: 1.5, borderColor: border }}
              >
                <Ionicons name={columns === 2 ? 'grid-outline' : 'list-outline'} size={14} color={textMuted} />
              </Pressable>
            </ScrollView>
          </View>

          {visibleFavorites.length === 0 ? (
            <View style={{ margin: 16, borderRadius: 24, overflow: 'hidden' }}>
              <LinearGradient
                colors={dark ? ['#1E293B', '#0F172A'] : ['#FFF0F6', '#FFF8FF']}
                style={{ paddingVertical: 48, paddingHorizontal: 24, alignItems: 'center', borderRadius: 24, borderWidth: 1.5, borderColor: dark ? '#334155' : '#F9A8D4' }}
              >
                {!user ? (
                  <>
                    <BoxMascot variant="welcome" size={90} animated />
                    <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: textPrimary, marginTop: 16 }}>
                      Giriş yapman gerekiyor
                    </Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
                      Favori ürünlerini kaydetmek için giriş yap.
                    </Text>
                    <Pressable
                      onPress={() => router.push('/auth')}
                      style={{ marginTop: 20, height: 44, paddingHorizontal: 28, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>Giriş Yap</Text>
                    </Pressable>
                  </>
                ) : favLoading ? (
                  <BoxMascot variant="order" size={80} animated />
                ) : (
                  <>
                    <LinearGradient
                      colors={['#FF6B6B', '#E91E8C']}
                      style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}
                    >
                      <Ionicons name="heart-outline" size={32} color="#fff" />
                    </LinearGradient>
                    <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: textPrimary }}>
                      Henüz favori ürün yok
                    </Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
                      Beğendiğin ürünleri favorilere ekle,{'\n'}kolayca geri bul.
                    </Text>
                    <Pressable
                      onPress={() => router.push('/')}
                      style={{ marginTop: 20, height: 44, paddingHorizontal: 28, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>Ürünleri Keşfet</Text>
                    </Pressable>
                  </>
                )}
              </LinearGradient>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
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
          <View style={{ height: 32 }} />
        </ScrollView>

      ) : tab === 'brands' ? (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {followedStoresLoading ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <View key={i} style={{ height: 76, backgroundColor: chipBg, borderRadius: 18, marginBottom: 10 }} />
              ))}
            </View>
          ) : followedStores.length === 0 ? (
            <View style={{ margin: 16, borderRadius: 24, overflow: 'hidden' }}>
              <LinearGradient
                colors={dark ? ['#1E293B', '#0F172A'] : ['#EFF6FF', '#F0F9FF']}
                style={{ paddingVertical: 48, paddingHorizontal: 24, alignItems: 'center', borderRadius: 24, borderWidth: 1.5, borderColor: dark ? '#334155' : '#BFDBFE' }}
              >
                <LinearGradient
                  colors={[colors.primary, '#3B82F6']}
                  style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}
                >
                  <Ionicons name="storefront-outline" size={30} color="#fff" />
                </LinearGradient>
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: textPrimary }}>Takip edilen mağaza yok</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
                  Satıcıların mağazasına girip takip ettiğinde burada görünür.
                </Text>
                <Pressable
                  onPress={() => router.push('/(tabs)/explore')}
                  style={{ marginTop: 20, height: 44, paddingHorizontal: 28, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>Satıcıları Keşfet</Text>
                </Pressable>
              </LinearGradient>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: textMuted, marginBottom: 10 }}>
                {followedStores.length} mağaza takip ediyorsun
              </Text>
              {followedStores.map((store) => (
                <Pressable
                  key={store.id}
                  onPress={() => router.push(`/store?sellerId=${store.id}` as any)}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: pressed ? (dark ? '#1E293B' : '#F0F5FF') : cardBg,
                    borderRadius: 18, padding: 14, marginBottom: 10,
                    borderWidth: 1.5, borderColor: border,
                    shadowColor: '#000', shadowOpacity: dark ? 0 : 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1,
                  })}
                >
                  {store.avatar_url ? (
                    <Image source={{ uri: store.avatar_url }} style={{ width: 52, height: 52, borderRadius: 26, marginRight: 14 }} />
                  ) : (
                    <LinearGradient
                      colors={[colors.primary, '#3B82F6']}
                      style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}
                    >
                      <Text style={{ fontFamily: fonts.headingBold, fontSize: 20, color: '#fff' }}>{(store.name[0] ?? 'M').toUpperCase()}</Text>
                    </LinearGradient>
                  )}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: textPrimary }}>{store.name}</Text>
                      {store.is_verified && (
                        <View style={{ backgroundColor: '#EFF6FF', borderRadius: 8, padding: 2 }}>
                          <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                        </View>
                      )}
                    </View>
                    {store.username ? (
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: textMuted, marginTop: 1 }}>@{store.username}</Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 5 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="people-outline" size={12} color={textMuted} />
                        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: textSecondary }}>
                          {store.follower_count.toLocaleString('tr-TR')} takipçi
                        </Text>
                      </View>
                      {store.listing_count > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="bag-outline" size={12} color={textMuted} />
                          <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: textSecondary }}>
                            {store.listing_count} ürün
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={{ backgroundColor: colors.primary + '15', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                  </View>
                </Pressable>
              ))}
            </View>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>

      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {collections.length === 0 ? (
            <View style={{ margin: 16, borderRadius: 24, overflow: 'hidden' }}>
              <LinearGradient
                colors={dark ? ['#1E293B', '#0F172A'] : ['#F5F3FF', '#EFF6FF']}
                style={{ paddingVertical: 48, paddingHorizontal: 24, alignItems: 'center', borderRadius: 24, borderWidth: 1.5, borderColor: dark ? '#334155' : '#DDD6FE' }}
              >
                <LinearGradient
                  colors={['#8B5CF6', '#6366F1']}
                  style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}
                >
                  <Ionicons name="albums-outline" size={30} color="#fff" />
                </LinearGradient>
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: textPrimary }}>
                  Koleksiyon için favori gerekli
                </Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
                  Favorilerine ürün ekledikçe kategoriye göre{'\n'}otomatik koleksiyonlar burada oluşur.
                </Text>
                <Pressable
                  onPress={() => router.push('/(tabs)/explore')}
                  style={{ marginTop: 20, height: 44, paddingHorizontal: 28, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>Keşfete Dön</Text>
                </Pressable>
              </LinearGradient>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: textMuted, marginBottom: 12 }}>
                Kategoriye göre otomatik oluşan koleksiyonların
              </Text>
              {collections.map((collection) => (
                <Pressable
                  key={collection.id}
                  onPress={() => {
                    setSelectedCollectionCategory(collection.id);
                    setTab('products');
                  }}
                  style={({ pressed }) => ({
                    marginBottom: 12, borderRadius: 20, overflow: 'hidden',
                    backgroundColor: pressed ? (dark ? '#1E293B' : '#F0F5FF') : cardBg,
                    borderWidth: 1.5, borderColor: border,
                    shadowColor: '#000', shadowOpacity: dark ? 0 : 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
                    {/* Cover mosaic */}
                    <View style={{ width: 64, height: 64, borderRadius: 16, overflow: 'hidden', marginRight: 14, backgroundColor: chipBg }}>
                      {collection.covers.length >= 4 ? (
                        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap' }}>
                          {collection.covers.slice(0, 4).map((uri, i) => (
                            <Image key={i} source={{ uri }} style={{ width: 32, height: 32 }} resizeMode="cover" />
                          ))}
                        </View>
                      ) : collection.covers.length > 0 ? (
                        <Image source={{ uri: collection.covers[0] }} style={{ width: 64, height: 64 }} resizeMode="cover" />
                      ) : (
                        <LinearGradient
                          colors={['#8B5CF6', '#6366F1']}
                          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Ionicons name="albums-outline" size={24} color="#fff" />
                        </LinearGradient>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: textPrimary }}>
                        {collection.title}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 }}>
                        <View style={{ backgroundColor: colors.primary + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary }}>{collection.count} ürün</Text>
                        </View>
                        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: textMuted }}>
                          ₺{collection.totalPrice.toFixed(0)} toplam
                        </Text>
                      </View>
                    </View>
                    <View style={{ backgroundColor: colors.primary + '15', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
