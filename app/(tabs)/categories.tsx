import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Animated,
  View,
  Text,
  FlatList,
  ListRenderItem,
  Pressable,
  TextInput,
  Image,
  Dimensions,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../../src/constants/theme';
import {
  ALL_SUBCATEGORY_ID,
  MARKETPLACE_CATEGORIES,
  OTHER_SUBCATEGORY_ID,
} from '../../src/constants/marketplaceCategories';
import { ProfileButton } from '../../src/components/ProfileButton';
import { useAndroidTabBackToHome } from '../../src/hooks/useAndroidTabBackToHome';
import { fetchListings, type Listing, type SearchFilters } from '../../src/services/listingService';
import { useFavorites } from '../../src/hooks/useFavorites';
import { useAuth } from '../../src/context/AuthContext';
import { useListings } from '../../src/context/ListingsContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LEFT_WIDTH = 88;
const RIGHT_WIDTH = SCREEN_WIDTH - LEFT_WIDTH;
const CARD_H_PAD = 10;
const CARD_GAP = 8;
const CARD_WIDTH = (RIGHT_WIDTH - CARD_H_PAD * 2 - CARD_GAP) / 2;
const PAGE_SIZE = 20;

type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'most_liked';
type ConditionOption = 'all' | 'new' | 'used';

interface LocalFilters {
  sort: SortOption;
  condition: ConditionOption;
  minPrice: string;
  maxPrice: string;
  city: string;
  district: string;
}

const DEFAULT_FILTERS: LocalFilters = {
  sort: 'newest',
  condition: 'all',
  minPrice: '',
  maxPrice: '',
  city: '',
  district: '',
};

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: 'En yeni', value: 'newest' },
  { label: 'En ucuz', value: 'price_asc' },
  { label: 'En pahalı', value: 'price_desc' },
  { label: 'En çok beğenilen', value: 'most_liked' },
];

const CITIES = [
  'İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya',
  'Adana', 'Konya', 'Gaziantep', 'Kayseri', 'Mersin',
];

export default function CategoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useAndroidTabBackToHome();
  const { user } = useAuth();
  const { hasStore } = useListings();
  const { favorites, toggle: toggleFav } = useFavorites();

  // Set of listing IDs the user has favorited (from server)
  const favIds = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);
  // Optimistic overrides: listingId → true/false
  const [favOverrides, setFavOverrides] = useState<Map<string, boolean>>(() => new Map());

  const isFavd = useCallback(
    (id: string) => favOverrides.has(id) ? favOverrides.get(id)! : favIds.has(id),
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

  // ─── State ──────────────────────────────────────────────────────────────
  const [selectedCategoryId, setSelectedCategoryId] = useState(MARKETPLACE_CATEGORIES[0].id);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState(ALL_SUBCATEGORY_ID);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<LocalFilters>(DEFAULT_FILTERS);
  const [localFilters, setLocalFilters] = useState<LocalFilters>(DEFAULT_FILTERS);
  const [filterVisible, setFilterVisible] = useState(false);

  const [products, setProducts] = useState<Listing[]>([]);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hasError, setHasError] = useState(false);

  const fetchRef = useRef(0);
  const inputRef = useRef<TextInput>(null);
  const sheetTranslateY = useRef(new Animated.Value(520)).current;

  const selectedCat = MARKETPLACE_CATEGORIES.find((c) => c.id === selectedCategoryId);
  const subcategories = selectedCat?.subcategories ?? [];

  // ─── Data fetching ───────────────────────────────────────────────────────
  const loadProducts = useCallback(
    async (pageNum: number, reset: boolean) => {
      setIsLoading(true);
      setHasError(false);
      const callId = ++fetchRef.current;

      const trimmed = searchQuery.trim();
      const isStoreSearch = trimmed.startsWith('@');
      const keyword = isStoreSearch ? trimmed.slice(1).trim() : trimmed;

      const filters: SearchFilters = {
        categoryId: selectedCategoryId,
        page: pageNum,
        pageSize: PAGE_SIZE,
      };

      // sub_category_id column may not exist — all subcategory filtering is client-side

      if (appliedFilters.sort !== 'newest') filters.sort = appliedFilters.sort;
      if (appliedFilters.minPrice) filters.minPrice = parseFloat(appliedFilters.minPrice);
      if (appliedFilters.maxPrice) filters.maxPrice = parseFloat(appliedFilters.maxPrice);
      if (appliedFilters.city) filters.city = appliedFilters.city;
      if (appliedFilters.district) filters.district = appliedFilters.district;
      if (keyword && !isStoreSearch) filters.query = keyword;

      try {
        const data = await fetchListings(filters);
        if (callId !== fetchRef.current) return;

        let filtered = data;

        // Client-side sub-category refinement:
        // Match by sub_category_id (DB) OR by keywords (for older listings without sub_category_id)
        if (selectedSubCategoryId !== ALL_SUBCATEGORY_ID) {
          if (selectedSubCategoryId === OTHER_SUBCATEGORY_ID) {
            filtered = filtered.filter((item) => item.sub_category_id === OTHER_SUBCATEGORY_ID);
          } else {
            const sub = selectedCat?.subcategories.find((s) => s.id === selectedSubCategoryId);
            if (sub) {
              filtered = filtered.filter((item) => {
                if (item.sub_category_id === selectedSubCategoryId) return true;
                if (sub.keywords.length === 0) return true;
                const haystack = `${item.title ?? ''} ${item.description ?? ''}`.toLocaleLowerCase('tr-TR');
                return sub.keywords.some((kw) => haystack.includes(kw.toLocaleLowerCase('tr-TR')));
              });
            }
          }
        }

        // Condition filter (client-side)
        if (appliedFilters.condition !== 'all') {
          filtered = filtered.filter((item) =>
            appliedFilters.condition === 'new' ? item.condition === 'new' : item.condition !== 'new',
          );
        }

        // @mağaza araması — satıcı adında filtrele
        if (isStoreSearch && keyword) {
          const kw = keyword.toLocaleLowerCase('tr-TR');
          filtered = filtered.filter((item) => {
            const uname = (item.profiles?.username ?? '').toLocaleLowerCase('tr-TR');
            const fname = (item.profiles?.full_name ?? '').toLocaleLowerCase('tr-TR');
            return uname.includes(kw) || fname.includes(kw);
          });
        }

        setProducts((prev) => (reset ? filtered : [...prev, ...filtered]));
        setHasMore(data.length === PAGE_SIZE);
      } catch {
        if (callId !== fetchRef.current) return;
        setHasError(true);
        if (reset) setProducts([]);
      } finally {
        if (callId === fetchRef.current) {
          setIsLoading(false);
        }
      }
    },
    [selectedCategoryId, selectedSubCategoryId, searchQuery, appliedFilters, selectedCat],
  );

  // Trigger on category / subcategory / filters change
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    void loadProducts(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryId, selectedSubCategoryId, appliedFilters]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      setHasMore(true);
      void loadProducts(0, true);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const loadMore = () => {
    if (isLoading || !hasMore) return;
    const next = page + 1;
    setPage(next);
    void loadProducts(next, false);
  };

  // ─── Category select ─────────────────────────────────────────────────────
  function handleSelectCategory(id: string) {
    if (id === selectedCategoryId) return;
    setSelectedCategoryId(id);
    setSelectedSubCategoryId(ALL_SUBCATEGORY_ID);
    setSearchQuery('');
    setProducts([]);
  }

  // ─── Filter ──────────────────────────────────────────────────────────────
  const hasActiveFilters = JSON.stringify(appliedFilters) !== JSON.stringify(DEFAULT_FILTERS);

  function openFilter() {
    setLocalFilters(appliedFilters);
    sheetTranslateY.setValue(520);
    setFilterVisible(true);
  }

  const closeFilter = useCallback(() => {
    Animated.timing(sheetTranslateY, {
      toValue: 520,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setFilterVisible(false);
      }
    });
  }, [sheetTranslateY]);

  useEffect(() => {
    if (!filterVisible) {
      return;
    }

    Animated.spring(sheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  }, [filterVisible, sheetTranslateY]);

  function applyFilters() {
    setAppliedFilters(localFilters);
    closeFilter();
  }

  function clearFilters() {
    setLocalFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    closeFilter();
  }

  // ─── Renderers ───────────────────────────────────────────────────────────
  const renderCategoryItem = ({ item }: { item: (typeof MARKETPLACE_CATEGORIES)[0] }) => {
    const active = item.id === selectedCategoryId;
    return (
      <Pressable
        onPress={() => handleSelectCategory(item.id)}
        style={[styles.catItem, active && styles.catItemActive]}
      >
        <Text style={styles.catIcon}>{item.icon}</Text>
        <Text numberOfLines={2} style={[styles.catName, active && styles.catNameActive]}>
          {item.name}
        </Text>
      </Pressable>
    );
  };

  const renderProductCard: ListRenderItem<Listing> = ({ item }) => {
    const coverUrl =
      (item as Listing & { listing_images?: { url: string }[] }).listing_images?.[0]?.url ?? null;
    const sellerName = item.profiles?.full_name ?? item.profiles?.username ?? 'Mağaza';
    const isNew = item.condition === 'new';
    const cityText = item.city ?? '';

    return (
      <Pressable
        onPress={() => router.push(`/product/${item.id}`)}
        style={[styles.card, { width: CARD_WIDTH }]}
      >
        {/* Image */}
        <View style={styles.cardImage}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <View style={styles.cardImageFallback}>
              <Text style={{ fontSize: 26 }}>{selectedCat?.icon ?? '📦'}</Text>
            </View>
          )}
          {isNew && (
            <View style={styles.conditionBadge}>
              <Text style={styles.conditionBadgeText}>SIFIR</Text>
            </View>
          )}
          <Pressable
            style={styles.favBtn}
            onPress={(e) => handleToggleFav(e, item.id)}
            hitSlop={8}
          >
            <Ionicons
              name={isFavd(item.id) ? 'heart' : 'heart-outline'}
              size={14}
              color={isFavd(item.id) ? '#F87171' : colors.textMuted}
            />
          </Pressable>
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <Text numberOfLines={2} style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardPrice}>
            {item.price > 0 ? `₺${item.price.toLocaleString('tr-TR')}` : 'Fiyat Sor'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
            <Text numberOfLines={1} style={styles.cardSeller}>{sellerName}</Text>
          </View>
          {cityText ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 }}>
              <Ionicons name="location-outline" size={8} color={colors.textMuted} />
              <Text numberOfLines={1} style={styles.cardCity}>{cityText}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const ListHeader = (
    <View style={styles.catTitleRow}>
      <Text style={{ fontSize: 15 }}>{selectedCat?.icon}</Text>
      <Text style={styles.catTitleText}>{selectedCat?.name}</Text>
      {products.length > 0 && (
        <Text style={styles.catTitleCount}>· {products.length} ürün</Text>
      )}
    </View>
  );

  const ListFooter = isLoading ? (
    <View style={styles.loader}>
      <ActivityIndicator size="small" color={colors.primary} />
    </View>
  ) : null;

  const ListEmpty = !isLoading && !hasError ? (
    <View style={styles.emptyState}>
      <Text style={{ fontSize: 34, marginBottom: 4 }}>{selectedCat?.icon ?? '📦'}</Text>
      <Text style={styles.emptyText}>Bu kategoride henüz ürün yok</Text>
      <Text style={styles.emptySubText}>İlk ilanı sen yayınlayabilirsin!</Text>
      {(searchQuery.trim() || selectedSubCategoryId !== ALL_SUBCATEGORY_ID) ? (
        <Pressable
          onPress={() => { setSearchQuery(''); setSelectedSubCategoryId(ALL_SUBCATEGORY_ID); }}
          style={styles.emptyResetBtn}
        >
          <Text style={styles.emptyReset}>Filtreleri temizle</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => router.push(hasStore ? '/create-listing' : '/store-setup')}
          style={styles.emptyActionBtn}
        >
          <Ionicons name="add-circle-outline" size={16} color="#fff" />
          <Text style={styles.emptyActionText}>İlan Ver</Text>
        </Pressable>
      )}
    </View>
  ) : null;

  const ListError = hasError ? (
    <View style={styles.emptyState}>
      <Ionicons name="cloud-offline-outline" size={32} color={colors.textMuted} />
      <Text style={styles.emptyText}>Ürünler yüklenemedi</Text>
      <Text style={styles.emptySubText}>İnternet bağlantını kontrol et</Text>
      <Pressable
        onPress={() => { setPage(0); setHasMore(true); void loadProducts(0, true); }}
        style={styles.emptyActionBtn}
      >
        <Ionicons name="refresh-outline" size={16} color="#fff" />
        <Text style={styles.emptyActionText}>Yenile</Text>
      </Pressable>
    </View>
  ) : null;

  // ─── JSX ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Kategoriler</Text>
          <ProfileButton />
        </View>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={14} color={colors.textMuted} />
            <TextInput
              ref={inputRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={
                searchQuery.startsWith('@')
                  ? 'Mağaza adıyla ara...'
                  : `${selectedCat?.name ?? ''} içinde ara...`
              }
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              style={styles.searchInput}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={14} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={openFilter}
            style={[styles.filterBtn, hasActiveFilters && styles.filterBtnActive]}
          >
            <Ionicons
              name="options-outline"
              size={17}
              color={hasActiveFilters ? '#fff' : colors.textSecondary}
            />
          </Pressable>
        </View>
      </View>

      {/* Split layout */}
      <View style={styles.body}>
        {/* Left: categories */}
        <View style={styles.leftPanel}>
          <FlatList
            data={MARKETPLACE_CATEGORIES}
            keyExtractor={(item) => item.id}
            renderItem={renderCategoryItem}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* Right: chips + grid */}
        <View style={styles.rightPanel}>
          <View style={styles.chipsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScroll}
              keyboardShouldPersistTaps="handled"
            >
              {subcategories.map((sub) => {
                const active = sub.id === selectedSubCategoryId;
                return (
                  <Pressable
                    key={`${selectedCategoryId}-${sub.id}`}
                    onPress={() => setSelectedSubCategoryId(sub.id)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{sub.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <FlatList
            data={products}
            keyExtractor={(item) => item.id}
            renderItem={renderProductCard}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            ListHeaderComponent={ListHeader}
            ListFooterComponent={ListFooter}
            ListEmptyComponent={ListError ?? ListEmpty}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.gridContent}
          />
        </View>
      </View>

      {/* Filter bottom sheet */}
      <Modal
        visible={filterVisible}
        transparent
        animationType="none"
        onRequestClose={closeFilter}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalOverlay} onPress={closeFilter} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.sheetWrapper}
          >
            <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
              <View style={styles.sheetHandle} />
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[
                  styles.sheetContent,
                  { paddingBottom: insets.bottom + 98 },
                ]}
              >
              <Text style={styles.sheetTitle}>Filtrele</Text>

              {/* Sort */}
              <View>
                <Text style={styles.filterLabel}>Sıralama</Text>
                <View style={styles.pillRow}>
                  {SORT_OPTIONS.map((opt) => {
                    const active = localFilters.sort === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setLocalFilters((f) => ({ ...f, sort: opt.value }))}
                        style={[styles.pill, active && styles.pillActive]}
                      >
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Condition */}
              <View>
                <Text style={styles.filterLabel}>Ürün Durumu</Text>
                <View style={styles.pillRow}>
                  {(
                    [
                      { label: 'Tümü', value: 'all' },
                      { label: 'Sıfır', value: 'new' },
                      { label: 'İkinci El', value: 'used' },
                    ] as { label: string; value: ConditionOption }[]
                  ).map((opt) => {
                    const active = localFilters.condition === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setLocalFilters((f) => ({ ...f, condition: opt.value }))}
                        style={[styles.pill, active && styles.pillActive]}
                      >
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Price range */}
              <View>
                <Text style={styles.filterLabel}>Fiyat Aralığı</Text>
                <View style={styles.priceRow}>
                  <TextInput
                    value={localFilters.minPrice}
                    onChangeText={(v) => setLocalFilters((f) => ({ ...f, minPrice: v.replace(/[^0-9]/g, '') }))}
                    placeholder="Min ₺"
                    keyboardType="numeric"
                    style={styles.priceInput}
                    placeholderTextColor={colors.textMuted}
                  />
                  <Text style={styles.priceDash}>—</Text>
                  <TextInput
                    value={localFilters.maxPrice}
                    onChangeText={(v) => setLocalFilters((f) => ({ ...f, maxPrice: v.replace(/[^0-9]/g, '') }))}
                    placeholder="Max ₺"
                    keyboardType="numeric"
                    style={styles.priceInput}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {/* City */}
              <View>
                <Text style={styles.filterLabel}>Şehir</Text>
                <View style={[styles.pillRow, { marginBottom: 8 }]}>
                  {CITIES.map((city) => {
                    const active = localFilters.city === city;
                    return (
                      <Pressable
                        key={city}
                        onPress={() => setLocalFilters((f) => ({ ...f, city: f.city === city ? '' : city }))}
                        style={[styles.pill, active && styles.pillActive]}
                      >
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>{city}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  value={localFilters.city}
                  onChangeText={(v) => setLocalFilters((f) => ({ ...f, city: v }))}
                  placeholder="Veya şehir yaz..."
                  style={styles.textField}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* District */}
              <View>
                <Text style={styles.filterLabel}>İlçe</Text>
                <TextInput
                  value={localFilters.district}
                  onChangeText={(v) => setLocalFilters((f) => ({ ...f, district: v }))}
                  placeholder="İlçe yaz..."
                  style={styles.textField}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Buttons */}
              </ScrollView>

              <View
                style={[
                  styles.sheetFooter,
                  { paddingBottom: insets.bottom + 10 },
                ]}
              >
                <View style={styles.sheetBtns}>
                  <Pressable onPress={clearFilters} style={styles.btnClear}>
                    <Text style={styles.btnClearText}>Temizle</Text>
                  </Pressable>
                  <Pressable onPress={applyFilters} style={styles.btnApply}>
                    <Text style={styles.btnApplyText}>Sonuçları Göster</Text>
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  header: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: '#fff',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: { fontFamily: fonts.headingBold, fontSize: 20, color: colors.textPrimary },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FB',
    borderRadius: 18,
    paddingHorizontal: 11,
    height: 36,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textPrimary,
    paddingVertical: 0,
    marginLeft: 6,
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F7FB',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },

  body: { flex: 1, flexDirection: 'row' },

  leftPanel: {
    width: LEFT_WIDTH,
    backgroundColor: '#F5F7FB',
    borderRightWidth: 1,
    borderRightColor: '#E2EAF4',
  },
  catItem: {
    width: LEFT_WIDTH,
    paddingVertical: 13,
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  catItemActive: { backgroundColor: '#fff', borderLeftColor: colors.primary },
  catIcon: { fontSize: 22 },
  catName: {
    fontFamily: fonts.regular,
    fontSize: 9,
    lineHeight: 12,
    color: '#777',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  catNameActive: { fontFamily: fonts.bold, color: colors.primary },

  rightPanel: { flex: 1 },
  gridContent: { paddingBottom: 24 },
  columnWrapper: { gap: CARD_GAP, paddingHorizontal: CARD_H_PAD },

  chipsContainer: {
    backgroundColor: '#fff',
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EEF8',
    minHeight: 48,
    justifyContent: 'center',
  },
  chipsScroll: { paddingHorizontal: CARD_H_PAD, gap: 6 },
  chip: { backgroundColor: '#EEF2F8', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontFamily: fonts.regular, fontSize: 11, color: '#555' },
  chipTextActive: { fontFamily: fonts.bold, color: '#fff' },

  catTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: CARD_H_PAD,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 5,
  },
  catTitleText: { fontFamily: fonts.headingBold, fontSize: 13, color: colors.textPrimary },
  catTitleCount: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted },

  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8EEF8',
    overflow: 'hidden',
    marginBottom: CARD_GAP,
  },
  cardImage: { width: '100%', aspectRatio: 1, backgroundColor: '#F1F5F9' },
  cardImageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  conditionBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#10B981',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  conditionBadgeText: { fontFamily: fonts.bold, fontSize: 8, color: '#fff' },
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
  cardInfo: { padding: 7 },
  cardTitle: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textPrimary,
    lineHeight: 14,
    minHeight: 28,
  },
  cardPrice: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary, marginTop: 4 },
  cardSeller: { fontFamily: fonts.regular, fontSize: 9, color: colors.textMuted },
  cardCity: { fontFamily: fonts.regular, fontSize: 8, color: colors.textMuted },

  loader: { paddingVertical: 16, alignItems: 'center' },
  emptyState: {
    marginHorizontal: CARD_H_PAD,
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 32,
    gap: 6,
  },
  emptyText: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginTop: 6 },
  emptySubText: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted },
  emptyResetBtn: { marginTop: 10 },
  emptyReset: { fontFamily: fonts.regular, fontSize: 12, color: colors.primary },
  emptyActionBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  emptyActionText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },

  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheetWrapper: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    height: '82%',
    maxHeight: '92%',
    overflow: 'hidden',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetContent: { paddingHorizontal: 20, gap: 18, paddingTop: 2 },
  sheetTitle: { fontFamily: fonts.headingBold, fontSize: 16, color: colors.textPrimary },
  sheetFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    paddingBottom: 10,
  },

  filterLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, marginBottom: 8 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: '#fff',
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  pillTextActive: { color: '#fff' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textPrimary,
  },
  priceDash: { color: colors.textMuted, fontSize: 14 },
  textField: {
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textPrimary,
  },
  sheetBtns: { flexDirection: 'row', gap: 10 },
  btnClear: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
  },
  btnClearText: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary },
  btnApply: { flex: 2, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  btnApplyText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },
});
