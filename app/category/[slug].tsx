import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fonts } from '../../src/constants/theme';
import { buildMessagesInboxRoute } from '../../src/utils/messageRouting';
import {
  ALL_SUBCATEGORY_ID,
  MARKETPLACE_CATEGORIES,
  getMarketplaceCategory,
} from '../../src/constants/marketplaceCategories';
import { fetchListings, type Listing, type SearchFilters } from '../../src/services/listingService';
import { useFavorites } from '../../src/hooks/useFavorites';
import { useAuth } from '../../src/context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 14;
const CARD_GAP = 8;
const CARD_WIDTH = (SCREEN_WIDTH - H_PAD * 2 - CARD_GAP) / 2;
const PAGE_SIZE = 20;

type SortBy = 'default' | 'priceAsc' | 'priceDesc' | 'rating';

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { favorites, toggle: toggleFav } = useFavorites();

  const favIds = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);
  const [favOverrides, setFavOverrides] = useState<Map<string, boolean>>(() => new Map());

  const isFavd = useCallback(
    (id: string) => (favOverrides.has(id) ? favOverrides.get(id)! : favIds.has(id)),
    [favOverrides, favIds],
  );

  const handleToggleFav = useCallback(
    async (e: { stopPropagation: () => void }, listingId: string) => {
      e.stopPropagation();
      if (!user) { router.push('/auth'); return; }
      const current = isFavd(listingId);
      setFavOverrides((prev) => new Map(prev).set(listingId, !current));
      const next = await toggleFav(listingId);
      setFavOverrides((prev) => new Map(prev).set(listingId, next));
    },
    [user, router, isFavd, toggleFav],
  );

  const category = getMarketplaceCategory(slug ?? MARKETPLACE_CATEGORIES[0].id);

  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState(ALL_SUBCATEGORY_ID);
  const [sortBy, setSortBy] = useState<SortBy>('default');
  const [onlyFreeShipping, setOnlyFreeShipping] = useState(false);

  const [listings, setListings] = useState<Listing[]>([]);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fetchRef = useRef(0);

  const loadListings = useCallback(
    async (pageNum: number, reset: boolean) => {
      setIsLoading(true);
      setHasError(false);
      const callId = ++fetchRef.current;

      const filters: SearchFilters = {
        categoryId: category.id,
        page: pageNum,
        pageSize: PAGE_SIZE,
      };

      if (sortBy === 'priceAsc') filters.sort = 'price_asc';
      else if (sortBy === 'priceDesc') filters.sort = 'price_desc';

      try {
        const data = await fetchListings(filters);
        if (callId !== fetchRef.current) return;

        let filtered = data;

        if (selectedSubCategoryId !== ALL_SUBCATEGORY_ID) {
          const sub = category.subcategories.find((s) => s.id === selectedSubCategoryId);
          if (sub) {
            filtered = filtered.filter((item) => {
              if ((item as any).sub_category_id === selectedSubCategoryId) return true;
              if (sub.keywords.length === 0) return true;
              const haystack = `${item.title ?? ''} ${item.description ?? ''}`.toLocaleLowerCase('tr-TR');
              return sub.keywords.some((kw) => haystack.includes(kw.toLocaleLowerCase('tr-TR')));
            });
          }
        }

        if (onlyFreeShipping) {
          filtered = filtered.filter((item) => {
            const desc = (item.description ?? '').toLocaleLowerCase('tr-TR');
            return (
              desc.includes('#ucretsizkargo') ||
              desc.includes('ucretsiz kargo') ||
              desc.includes('ücretsiz kargo')
            );
          });
        }

        setListings((prev) => (reset ? filtered : [...prev, ...filtered]));
        setHasMore(data.length === PAGE_SIZE);
      } catch {
        if (callId !== fetchRef.current) return;
        setHasError(true);
        if (reset) setListings([]);
      } finally {
        if (callId === fetchRef.current) setIsLoading(false);
      }
    },
    [category.id, category.subcategories, selectedSubCategoryId, onlyFreeShipping, sortBy],
  );

  useEffect(() => {
    setPage(0);
    setHasMore(true);
    void loadListings(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category.id, selectedSubCategoryId, onlyFreeShipping, sortBy]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadListings(0, true); } finally { setRefreshing(false); }
  }, [loadListings]);

  const loadMore = () => {
    if (isLoading || !hasMore) return;
    const next = page + 1;
    setPage(next);
    void loadListings(next, false);
  };

  const visibleListings = useMemo(() => {
    if (sortBy === 'rating') {
      return [...listings].sort((a, b) => (b.favorite_count ?? 0) - (a.favorite_count ?? 0));
    }
    if (sortBy === 'priceAsc') return [...listings].sort((a, b) => a.price - b.price);
    if (sortBy === 'priceDesc') return [...listings].sort((a, b) => b.price - a.price);
    return listings;
  }, [listings, sortBy]);

  function handleFilterAction(key: 'sort' | 'price' | 'rating' | 'shipping') {
    if (key === 'shipping') { setOnlyFreeShipping((c) => !c); return; }
    if (key === 'price') { setSortBy((c) => (c === 'priceAsc' ? 'priceDesc' : 'priceAsc')); return; }
    if (key === 'sort') { setSortBy((c) => (c === 'priceAsc' ? 'priceDesc' : 'priceAsc')); return; }
    setSortBy((c) => (c === 'rating' ? 'default' : 'rating'));
  }

  function isActiveFilter(key: string) {
    if (key === 'shipping') return onlyFreeShipping;
    if (key === 'price' || key === 'sort') return sortBy === 'priceAsc' || sortBy === 'priceDesc';
    if (key === 'rating') return sortBy === 'rating';
    return false;
  }

  const FILTER_OPTS: { icon: string; label: string; key: 'sort' | 'price' | 'rating' | 'shipping' }[] = [
    { icon: 'swap-vertical', label: 'Sırala', key: 'sort' },
    { icon: 'pricetag-outline', label: 'Fiyata Göre', key: 'price' },
    { icon: 'star-outline', label: 'Çok Beğenilen', key: 'rating' },
    { icon: 'car-outline', label: 'Ücretsiz Kargo', key: 'shipping' },
  ];

  const renderCard = ({ item }: { item: Listing }) => {
    const coverUrl = item.listing_images?.find((img) => img.is_cover)?.url
      ?? item.listing_images?.[0]?.url
      ?? null;
    const sellerName = item.profiles?.full_name ?? item.profiles?.username ?? 'Mağaza';
    const isNew = item.condition === 'new';
    const cityText = item.city ?? '';
    const favoured = isFavd(item.id);

    return (
      <Pressable
        onPress={() => router.push(`/product/${item.id}`)}
        style={styles.card}
      >
        {/* Image */}
        <View style={styles.cardImg}>
          {coverUrl ? (
            <Image
              source={{ uri: coverUrl }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.cardImgFallback}>
              <Text style={{ fontSize: 30 }}>{category.icon}</Text>
            </View>
          )}
          {isNew && (
            <View style={styles.condBadge}>
              <Text style={styles.condBadgeText}>SIFIR</Text>
            </View>
          )}
          <Pressable
            style={styles.favBtn}
            onPress={(e) => handleToggleFav(e, item.id)}
            hitSlop={8}
          >
            <Ionicons
              name={favoured ? 'heart' : 'heart-outline'}
              size={14}
              color={favoured ? '#F87171' : colors.textMuted}
            />
          </Pressable>
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <Text numberOfLines={2} style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardPrice}>
            {item.price > 0 ? `₺${item.price.toLocaleString('tr-TR')}` : 'Fiyat Sor'}
          </Text>
          <Text numberOfLines={1} style={styles.cardSeller}>{sellerName}</Text>
          {cityText ? (
            <View style={styles.cardCityRow}>
              <Ionicons name="location-outline" size={9} color={colors.textMuted} />
              <Text numberOfLines={1} style={styles.cardCity}>{cityText}</Text>
            </View>
          ) : null}
          <View style={styles.cardViewBtn}>
            <Text style={styles.cardViewBtnText}>Ürünü Gör →</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const ListEmpty = !isLoading && !hasError ? (
    <View style={styles.emptyState}>
      <Text style={{ fontSize: 38, marginBottom: 4 }}>{category.icon}</Text>
      <Text style={styles.emptyTitle}>Bu kategoride henüz ürün yok</Text>
      <Text style={styles.emptySubtitle}>İlk ilanı sen yayınlayabilirsin!</Text>
      {selectedSubCategoryId !== ALL_SUBCATEGORY_ID || onlyFreeShipping ? (
        <Pressable
          onPress={() => { setSelectedSubCategoryId(ALL_SUBCATEGORY_ID); setOnlyFreeShipping(false); }}
          style={styles.resetBtn}
        >
          <Text style={styles.resetBtnText}>Tüm ürünleri göster</Text>
        </Pressable>
      ) : null}
    </View>
  ) : null;

  const ListError = hasError ? (
    <View style={styles.emptyState}>
      <Ionicons name="cloud-offline-outline" size={38} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>Ürünler yüklenemedi</Text>
      <Text style={styles.emptySubtitle}>İnternet bağlantını kontrol et</Text>
      <Pressable
        onPress={() => { setPage(0); void loadListings(0, true); }}
        style={styles.retryBtn}
      >
        <Ionicons name="refresh-outline" size={15} color="#fff" />
        <Text style={styles.retryBtnText}>Yenile</Text>
      </Pressable>
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {category.icon} {category.name}
        </Text>
        <Pressable onPress={() => router.push('/search')} style={styles.iconBtn}>
          <Ionicons name="search" size={22} color={colors.textPrimary} />
        </Pressable>
        <Pressable onPress={() => router.push(buildMessagesInboxRoute())} style={styles.iconBtn}>
          <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>

      {/* Sub-category chips */}
      {category.subcategories.length > 0 && (
        <View style={styles.chipsWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            {category.subcategories.map((sub) => {
              const active = sub.id === selectedSubCategoryId;
              return (
                <Pressable
                  key={`${category.id}-${sub.id}`}
                  onPress={() => setSelectedSubCategoryId(sub.id)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {sub.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Filter bar */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {FILTER_OPTS.map((f) => {
            const active = isActiveFilter(f.key);
            return (
              <Pressable
                key={f.key}
                onPress={() => handleFilterAction(f.key)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                {active && <Ionicons name="checkmark" size={13} color="#fff" />}
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Product grid */}
      <FlatList
        data={visibleListings}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          visibleListings.length > 0 ? (
            <View style={styles.resultBar}>
              <Text style={styles.resultText}>{visibleListings.length} ürün bulundu</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          isLoading ? (
            <ActivityIndicator style={{ marginVertical: 18 }} color={colors.primary} />
          ) : null
        }
        ListEmptyComponent={ListError ?? ListEmpty}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F7F7' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 2,
  },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.headingBold,
    fontSize: 17,
    color: colors.textPrimary,
    marginHorizontal: 4,
  },

  chipsWrap: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EEF8',
    paddingVertical: 8,
  },
  chipsScroll: { paddingHorizontal: H_PAD, gap: 7 },
  chip: {
    backgroundColor: '#EEF2F8',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontFamily: fonts.regular, fontSize: 11, color: '#555' },
  chipTextActive: { fontFamily: fonts.bold, color: '#fff' },

  filterBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: H_PAD,
    paddingVertical: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 34,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textPrimary },
  filterChipTextActive: { color: '#fff' },

  columnWrapper: { gap: CARD_GAP, paddingHorizontal: H_PAD },
  gridContent: { paddingTop: 8, paddingBottom: 28 },

  resultBar: { paddingHorizontal: H_PAD, paddingVertical: 4 },
  resultText: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary },

  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8EEF8',
    overflow: 'hidden',
    marginBottom: CARD_GAP,
  },
  cardImg: { width: '100%', aspectRatio: 1, backgroundColor: '#F1F5F9' },
  cardImgFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  condBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#10B981',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  condBadgeText: { fontFamily: fonts.bold, fontSize: 8, color: '#fff' },
  favBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardInfo: { padding: 8 },
  cardTitle: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textPrimary,
    lineHeight: 14,
    minHeight: 28,
  },
  cardPrice: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary, marginTop: 4 },
  cardSeller: { fontFamily: fonts.regular, fontSize: 9, color: colors.textMuted, marginTop: 2 },
  cardCityRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 },
  cardCity: { fontFamily: fonts.regular, fontSize: 8, color: colors.textMuted },
  cardViewBtn: {
    marginTop: 7,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'center',
  },
  cardViewBtnText: { fontFamily: fonts.bold, fontSize: 10, color: colors.primary },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 52,
    marginHorizontal: 20,
    gap: 8,
  },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary },
  emptySubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  resetBtn: {
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  resetBtnText: { fontFamily: fonts.medium, fontSize: 13, color: colors.primary },
  retryBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  retryBtnText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },
});
