import { ActivityIndicator, View, Text, ScrollView, Pressable, TextInput, Image, RefreshControl, Alert, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts } from '../src/constants/theme';
import { MARKETPLACE_CATEGORIES } from '../src/constants/marketplaceCategories';
import SkeletonCard from '../src/components/SkeletonCard';
import { useListings } from '../src/context/ListingsContext';
import { useProducts } from '../src/hooks/useProducts';
import { useSearchHistory } from '../src/hooks/useSearchHistory';
import { isSupabaseConfigured } from '../src/services/supabase';
import { unifiedSearch, StoreSearchResult, isInstagramQuery, SearchSortOption, StoreSortOption } from '../src/services/advancedSearchService';

export default function SearchScreen() {
  const router = useRouter();
  const { allProducts } = useListings();
  const searchHistory = useSearchHistory();
  const mainScrollRef = useRef<ScrollView | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [visualSearchActive, setVisualSearchActive] = useState(false);
  const [visualSearchUri, setVisualSearchUri] = useState<string | null>(null);
  const [visualSearchLoading, setVisualSearchLoading] = useState(false);

  // Advanced search state
  const [sortOption, setSortOption] = useState<SearchSortOption>('newest');
  const [storeSort, setStoreSort] = useState<StoreSortOption>('relevance');
  const [filterVisible, setFilterVisible] = useState(false);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [cityFilter, setCityFilter] = useState<string>('');
  const [storeResults, setStoreResults] = useState<StoreSearchResult[]>([]);
  const [storeLoading, setStoreLoading] = useState(false);
  const [hasMoreStores, setHasMoreStores] = useState(false);
  const [storePage, setStorePage] = useState(1);
  const [hasMoreProducts, setHasMoreProducts] = useState(false);
  const [productPage, setProductPage] = useState(1);

  // Load search history on mount
  useEffect(() => {
    searchHistory.get().then(setRecentSearches).catch(() => setRecentSearches([]));
  }, []);

  // Debounce: query değiştikten 400ms sonra debouncedQuery'yi güncelle
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const trimmed = query.trim();
      setDebouncedQuery(trimmed);
      // Save to search history when user searches
      if (trimmed.length >= 2) {
        searchHistory.add(trimmed).then(() => {
          searchHistory.get().then(setRecentSearches).catch(() => {});
        });
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchHistory]);

  // Sunucu tarafi arama (Supabase varsa)
  const { products: serverResults, loading: serverLoading, refresh: serverRefresh } = useProducts({
    filters: {
      query: debouncedQuery || undefined,
      category_id: selectedCategory ?? undefined,
    },
    enabled: isSupabaseConfigured && debouncedQuery.length >= 2,
  });

  // Store search via unified search
  const runStoreSearch = useCallback(async (q: string, page: number) => {
    if (!isSupabaseConfigured || q.length < 2) {
      setStoreResults([]);
      setHasMoreStores(false);
      return;
    }
    setStoreLoading(true);
    try {
      const result = await unifiedSearch({
        query: q,
        categoryId: selectedCategory ?? undefined,
        city: cityFilter || undefined,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        sort: sortOption,
        storeSort,
        page,
        pageSize: 20,
      });
      if (page === 1) {
        setStoreResults(result.stores);
        setHasMoreProducts(result.hasMoreProducts);
      } else {
        setStoreResults((prev) => [...prev, ...result.stores]);
      }
      setHasMoreStores(result.hasMoreStores);
    } catch (e) {
      console.error('[search] store search error', e);
    } finally {
      setStoreLoading(false);
    }
  }, [selectedCategory, cityFilter, minPrice, maxPrice, sortOption, storeSort]);

  useEffect(() => {
    setStorePage(1);
    setStoreResults([]);
    if (debouncedQuery.length >= 2) {
      runStoreSearch(debouncedQuery, 1);
    } else {
      setStoreResults([]);
      setHasMoreStores(false);
    }
  }, [debouncedQuery, runStoreSearch]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await serverRefresh();
      if (debouncedQuery.length >= 2) await runStoreSearch(debouncedQuery, 1);
    } finally {
      setRefreshing(false);
    }
  };

  // Supabase yoksa client-side fallback
  const clientResults = useMemo(() => {
    const value = query.trim().toLocaleLowerCase('tr-TR');
    if (!value) return [];
    const valueWords = value.split(/\s+/).filter(Boolean);
    let results = allProducts
      .map((item) => {
        const haystack = [
          item.title,
          item.brand,
          item.description ?? '',
          item.category,
          item.badge ?? '',
          item.condition ?? '',
          item.location ?? '',
          item.district ?? '',
          ...(item.attributes?.map((attribute) => `${attribute.label} ${attribute.value}`) ?? []),
        ]
          .join(' ')
          .toLocaleLowerCase('tr-TR');
        let score = 0;

        if (item.title.toLocaleLowerCase('tr-TR').startsWith(value)) score += 5;
        if (item.brand.toLocaleLowerCase('tr-TR').startsWith(value)) score += 4;
        if (haystack.includes(value)) score += 3;

        score += valueWords.reduce((sum, word) => (haystack.includes(word) ? sum + 1 : sum), 0);

        return { item, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item);

    if (selectedCategory) results = results.filter((item) => item.category === selectedCategory);

    return results.slice(0, 20);
  }, [allProducts, query, selectedCategory]);

  const visualSearchResults = useMemo(() => {
    let source = [...allProducts];

    if (selectedCategory) {
      source = source.filter((item) => item.category === selectedCategory);
    }

    return source
      .sort((a, b) => {
        const scoreA = a.rating * 5 + (a.reviewCount ?? 0) + (a.discount ?? 0) + (a.freeShipping ? 8 : 0);
        const scoreB = b.rating * 5 + (b.reviewCount ?? 0) + (b.discount ?? 0) + (b.freeShipping ? 8 : 0);
        return scoreB - scoreA;
      })
      .slice(0, 20);
  }, [allProducts, selectedCategory]);

  const mergedTextSearchResults = useMemo(() => {
    const fromServer = isSupabaseConfigured && debouncedQuery.length >= 2 ? serverResults : [];
    const dedupedMap = new Map<string, (typeof allProducts)[number]>();

    fromServer.forEach((item) => dedupedMap.set(item.id, item));
    clientResults.forEach((item) => {
      if (!dedupedMap.has(item.id)) dedupedMap.set(item.id, item);
    });

    const merged = Array.from(dedupedMap.values());
    const tokens = query
      .trim()
      .toLocaleLowerCase('tr-TR')
      .split(/\s+/)
      .filter(Boolean);

    if (tokens.length === 0) {
      return merged.slice(0, 20);
    }

    const strict = merged.filter((item) => {
      const searchable = [item.title, item.brand, item.description ?? '', item.category]
        .join(' ')
        .toLocaleLowerCase('tr-TR');
      return tokens.every((token) => searchable.includes(token));
    });

    return (strict.length > 0 ? strict : merged).slice(0, 20);
  }, [allProducts, clientResults, serverResults, debouncedQuery.length, query]);

  const searchResults =
    query.trim().length > 0
      ? mergedTextSearchResults
      : visualSearchActive
        ? visualSearchResults
        : [];

  const searchLoading =
    visualSearchLoading || (query.trim().length > 0 && isSupabaseConfigured && debouncedQuery.length >= 2 && serverLoading);

  const autoSuggestTerms = useMemo(() => {
    const termSet = new Set<string>();

    allProducts.forEach((item) => {
      termSet.add(item.brand);
      termSet.add(item.title);

      const descriptionWords = (item.description ?? '')
        .split(/[^\p{L}\p{N}]+/u)
        .map((word) => word.trim())
        .filter((word) => word.length >= 3)
        .slice(0, 8);

      descriptionWords.forEach((word) => termSet.add(word));
    });

    MARKETPLACE_CATEGORIES.forEach((category) => termSet.add(category.name));

    return Array.from(termSet);
  }, [allProducts]);

  const querySuggestions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('tr-TR');
    if (!normalized) return [];

    return autoSuggestTerms
      .map((term) => ({
        term,
        score: term.toLocaleLowerCase('tr-TR').startsWith(normalized) ? 2 : 1,
      }))
      .filter(({ term }) => term.toLocaleLowerCase('tr-TR').includes(normalized))
      .sort((a, b) => b.score - a.score || a.term.length - b.term.length)
      .map(({ term }) => term)
      .filter((term, index, arr) => arr.findIndex((entry) => entry.toLocaleLowerCase('tr-TR') === term.toLocaleLowerCase('tr-TR')) === index)
      .slice(0, 8);
  }, [autoSuggestTerms, query]);

  const trendingSearches = useMemo(
    () => allProducts.map((item) => item.title).slice(0, 8),
    [allProducts],
  );

  const popularBrands = useMemo(
    () => Array.from(new Set(allProducts.map((item) => item.brand))).slice(0, 8),
    [allProducts],
  );

  function applySearch(term: string) {
    const clean = term.trim();

    if (!clean) {
      return;
    }

    setQuery(clean);
    setSelectedCategory(null);
    setVisualSearchActive(false);
    setRecentSearches((current) => [clean, ...current.filter((item) => item !== clean)].slice(0, 8));

    requestAnimationFrame(() => {
      mainScrollRef.current?.scrollTo({ y: 0, animated: false });
    });
  }

  async function launchVisualSearch(source: 'camera' | 'gallery') {
    try {
      setVisualSearchLoading(true);

      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('İzin Gerekli', 'Kamera ile arama için kamera izni vermen gerekiyor.');
          return;
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.8,
        });

        if (result.canceled || !result.assets?.length) return;

        setVisualSearchUri(result.assets[0].uri);
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('İzin Gerekli', 'Görselden arama için galeri izni vermen gerekiyor.');
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.8,
        });

        if (result.canceled || !result.assets?.length) return;

        setVisualSearchUri(result.assets[0].uri);
      }

      setQuery('');
      setDebouncedQuery('');
      setVisualSearchActive(true);
    } finally {
      setVisualSearchLoading(false);
    }
  }

  function openVisualSearch() {
    if (Platform.OS === 'web') {
      launchVisualSearch('gallery');
      return;
    }

      Alert.alert('Görsel Arama', 'Nereden görsel seçmek istersin?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Kamera', onPress: () => launchVisualSearch('camera') },
      { text: 'Galeri', onPress: () => launchVisualSearch('gallery') },
    ]);
  }

  const isSearching = query.trim().length > 0 || visualSearchActive;

  const SORT_OPTIONS: { label: string; value: SearchSortOption }[] = [
    { label: 'En Yeni', value: 'newest' },
    { label: 'Ucuzdan Pahalıya', value: 'price_asc' },
    { label: 'Pahalıdan Ucuza', value: 'price_desc' },
    { label: 'Çok Beğenilen', value: 'most_liked' },
    { label: 'Çok Yorumlanan', value: 'most_commented' },
  ];

  useEffect(() => {
    if (!isSearching) return;

    requestAnimationFrame(() => {
      mainScrollRef.current?.scrollTo({ y: 0, animated: false });
    });
  }, [isSearching, query, selectedCategory, visualSearchActive]);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Filter Modal */}
      <Modal visible={filterVisible} animationType="slide" transparent onRequestClose={() => setFilterVisible(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setFilterVisible(false)} />
        <View className="bg-white rounded-t-3xl px-5 pt-5 pb-8" style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <View className="flex-row items-center justify-between mb-4">
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: colors.textPrimary }}>Filtrele ve Sırala</Text>
            <Pressable onPress={() => setFilterVisible(false)}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Sort options */}
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>Sıralama</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
            {SORT_OPTIONS.map((opt) => {
              const active = sortOption === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setSortOption(opt.value)}
                  style={{ backgroundColor: active ? colors.primary : '#F1F5F9', borderColor: active ? colors.primary : '#E2E8F0' }}
                  className="px-4 h-8 rounded-full border items-center justify-center"
                >
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: active ? '#fff' : colors.textPrimary }}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Price range */}
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>Fiyat Aralığı (₺)</Text>
          <View className="flex-row gap-3 mb-4">
            <TextInput
              value={minPrice}
              onChangeText={setMinPrice}
              keyboardType="numeric"
              placeholder="Min"
              placeholderTextColor={colors.textMuted}
              style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, flex: 1, height: 40, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12 }}
            />
            <TextInput
              value={maxPrice}
              onChangeText={setMaxPrice}
              keyboardType="numeric"
              placeholder="Maks"
              placeholderTextColor={colors.textMuted}
              style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, flex: 1, height: 40, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12 }}
            />
          </View>

          {/* City */}
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>Şehir</Text>
          <TextInput
            value={cityFilter}
            onChangeText={setCityFilter}
            placeholder="İstanbul, Ankara..."
            placeholderTextColor={colors.textMuted}
            style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, height: 40, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, marginBottom: 20 }}
          />

          <Pressable
            onPress={() => setFilterVisible(false)}
            style={{ backgroundColor: colors.primary }}
            className="h-12 rounded-2xl items-center justify-center"
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>Uygula</Text>
          </Pressable>
        </View>
      </Modal>

      <View className="flex-row items-center px-3 py-2 border-b border-[#33333315]">
        <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <View className="flex-1 flex-row items-center bg-[#F7F7F7] rounded-xl px-3 h-10 border border-[#33333315]">
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={(value) => {
              if (visualSearchActive) {
                setVisualSearchActive(false);
                setVisualSearchUri(null);
              }

              setQuery(value);
            }}
            onSubmitEditing={() => applySearch(query)}
            returnKeyType="search"
            autoFocus
            showSoftInputOnFocus
            autoCorrect
            autoCapitalize="none"
            placeholder="Ürün, marka veya kategori ara"
            placeholderTextColor={colors.textMuted}
            style={{
              fontFamily: fonts.regular,
              fontSize: 14,
              lineHeight: 18,
              color: colors.textPrimary,
              paddingVertical: 0,
              textAlignVertical: 'center',
              includeFontPadding: false,
            }}
            className="flex-1 ml-2"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : (
            <Pressable
              onPress={openVisualSearch}
              disabled={visualSearchLoading}
              style={{ opacity: visualSearchLoading ? 0.5 : 1 }}
              className="w-8 h-8 items-center justify-center"
            >
              {visualSearchLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name={visualSearchActive ? 'camera' : 'camera-outline'} size={20} color={colors.primary} />
              )}
            </Pressable>
          )}
        </View>
        {/* Filter button */}
        <Pressable
          onPress={() => setFilterVisible(true)}
          className="w-10 h-10 items-center justify-center rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] ml-2"
        >
          <Ionicons name="options-outline" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>

      {query.trim().length > 0 && querySuggestions.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}
        >
          {querySuggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              onPress={() => applySearch(suggestion)}
              className="px-3 h-8 rounded-full border border-[#33333322] bg-[#F8FAFC] flex-row items-center"
            >
              <Ionicons name="sparkles-outline" size={13} color={colors.primary} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textPrimary, marginLeft: 6 }}>
                {suggestion}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <ScrollView
        ref={mainScrollRef}
        className="flex-1 px-4 py-4" 
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >

        {/* ── Arama sonuçları (query aktifken tüm listeyi kapatır) ── */}
        {isSearching ? (
          <View className="mb-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 14, color: colors.textPrimary }}>
                {visualSearchActive ? 'Görsel Arama Sonuçları' : 'Arama Sonuçları'}
              </Text>
                {searchLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>
                    {searchResults.length} sonuç
                  </Text>
                )}
            </View>

            {visualSearchActive && visualSearchUri ? (
              <View className="mb-3 p-2 rounded-xl border border-[#33333315] bg-[#F8FAFC] flex-row items-center">
                <Image source={{ uri: visualSearchUri }} className="w-12 h-12 rounded-lg" resizeMode="cover" />
                <View className="flex-1 ml-3">
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }}>
                    Görsel arama açık
                  </Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                    Uygun ürünler puan, yorum ve kategoriye göre sıralandı.
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setVisualSearchActive(false);
                    setVisualSearchUri(null);
                  }}
                  className="px-2 py-1"
                >
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ) : null}

            {/* Category Filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, marginBottom: 12 }}
            >
              <Pressable
                onPress={() => setSelectedCategory(null)}
                style={{
                  backgroundColor: selectedCategory === null ? colors.primary : '#F8FAFC',
                  borderColor: selectedCategory === null ? colors.primary : colors.borderLight,
                }}
                className="px-4 h-8 rounded-full border items-center justify-center"
              >
                <Text
                  style={{
                    fontFamily: fonts.medium,
                    fontSize: 11,
                    color: selectedCategory === null ? '#fff' : colors.textPrimary,
                  }}
                >
                  Tümü
                </Text>
              </Pressable>
              {MARKETPLACE_CATEGORIES.slice(0, 6).map((cat) => {
                const selected = selectedCategory === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => setSelectedCategory(selected ? null : cat.id)}
                    style={{
                      backgroundColor: selected ? '#DBEAFE' : '#F8FAFC',
                      borderColor: selected ? '#BFDBFE' : colors.borderLight,
                    }}
                    className="px-3 h-8 rounded-full border items-center justify-center"
                  >
                    <Text
                      style={{
                        fontFamily: selected ? fonts.bold : fonts.medium,
                        fontSize: 11,
                        color: selected ? colors.primary : colors.textSecondary,
                      }}
                    >
                      {cat.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {searchResults.length > 0 ? (
              <View style={{ gap: 8 }}>
                {searchLoading && searchResults.length === 0
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <View key={`skeleton-${i}`} className="bg-white border rounded-2xl px-3 py-3 flex-row items-center" style={{ borderColor: colors.borderLight }}>
                        <View className="w-12 h-12 rounded-xl bg-slate-200 mr-3" />
                        <View className="flex-1">
                          <View className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
                          <View className="h-3 bg-slate-200 rounded w-2/3" />
                        </View>
                      </View>
                    ))
                  : searchResults.map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => router.push(`/product/${item.id}`)}
                        style={{ borderColor: colors.borderLight }}
                        className="bg-white border rounded-2xl px-3 py-3 flex-row items-center active:opacity-80"
                      >
                        <View
                          style={{ backgroundColor: '#F1F5F9' }}
                          className="w-12 h-12 rounded-xl overflow-hidden mr-3"
                        >
                          {item.image ? (
                            <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                          ) : null}
                        </View>
                        <View className="flex-1 pr-2">
                          <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>
                            {item.brand}
                          </Text>
                          <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textPrimary, marginTop: 1 }}>
                            {item.title}
                          </Text>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                        {item.price > 0 ? `₺${item.price.toFixed(2)}` : 'Fiyat Sor'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <View
                style={{ backgroundColor: '#F8FAFC', borderColor: colors.borderLight }}
                className="border border-dashed rounded-2xl p-6 items-center"
              >
                <View style={{ backgroundColor: '#FEF08A' }} className="w-16 h-16 rounded-full items-center justify-center mb-3">
                  <Ionicons name="search-outline" size={28} color="#CA8A04" />
                </View>
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 15, color: colors.textPrimary }}>
                  Sonuç bulunamadı
                </Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
                  {visualSearchActive
                    ? 'Görsel için uygun ürün bulunamadı. Farklı bir görsel dene veya kategori seçimini temizle.'
                    : `"${query}" ${selectedCategory ? 'bu kategoride' : ''} için eşleşen ürün yok.${selectedCategory ? '\nFarklı kategori seç.' : '\nFarklı bir kelime dene.'}`}
                </Text>
              </View>
            )}

            {/* ── Mağaza Sonuçları ── */}
            {!visualSearchActive && (storeResults.length > 0 || storeLoading) ? (
              <View className="mt-5 mb-3">
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center">
                    <Ionicons name="storefront-outline" size={16} color={colors.primary} />
                    <Text style={{ fontFamily: fonts.headingBold, fontSize: 14, color: colors.textPrimary, marginLeft: 6 }}>
                      Mağazalar
                    </Text>
                    {isInstagramQuery(query) ? (
                      <View className="ml-2 px-2 h-5 rounded-full bg-[#FBCFE8] items-center justify-center">
                        <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#BE185D' }}>@instagram</Text>
                      </View>
                    ) : null}
                  </View>
                  {storeLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
                </View>

                {storeResults.map((store) => (
                  <Pressable
                    key={store.store_id}
                    onPress={() => router.push(`/store/${store.store_id}` as any)}
                    style={{ borderColor: colors.borderLight }}
                    className="bg-white border rounded-2xl px-3 py-3 flex-row items-center mb-2 active:opacity-80"
                  >
                    {store.avatar_url ? (
                      <Image source={{ uri: store.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }} />
                    ) : (
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Ionicons name="storefront" size={22} color={colors.textMuted} />
                      </View>
                    )}
                    <View className="flex-1 pr-2">
                      <View className="flex-row items-center">
                        <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>
                          {store.store_name ?? 'Mağaza'}
                        </Text>
                        {store.verified_seller ? (
                          <Ionicons name="checkmark-circle" size={14} color={colors.primary} style={{ marginLeft: 4 }} />
                        ) : null}
                      </View>
                      {store.instagram_username ? (
                        <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: '#7C3AED', marginTop: 1 }}>
                          @{store.instagram_username}
                        </Text>
                      ) : null}
                      <View className="flex-row items-center mt-1" style={{ gap: 8 }}>
                        {store.city ? (
                          <View className="flex-row items-center">
                            <Ionicons name="location-outline" size={11} color={colors.textMuted} />
                            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginLeft: 2 }}>{store.city}</Text>
                          </View>
                        ) : null}
                        {store.rating > 0 ? (
                          <View className="flex-row items-center">
                            <Ionicons name="star" size={11} color="#F59E0B" />
                            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary, marginLeft: 2 }}>{store.rating.toFixed(1)}</Text>
                          </View>
                        ) : null}
                        <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary }}>{store.product_count} ürün</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                ))}

                {hasMoreStores ? (
                  <Pressable
                    onPress={() => {
                      const next = storePage + 1;
                      setStorePage(next);
                      runStoreSearch(debouncedQuery, next);
                    }}
                    className="h-10 rounded-xl border border-[#E2E8F0] items-center justify-center mt-1"
                  >
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.primary }}>Daha fazla mağaza</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

          </View>
        ) : (
          <>
            {/* Son Aramalar */}
            {recentSearches.length > 0 ? (
              <View className="mb-5">
                <View className="flex-row items-center justify-between mb-3">
                  <Text style={{ fontFamily: fonts.headingBold, fontSize: 14, color: colors.textPrimary }}>
                    Son Aramalar
                  </Text>
                  <Pressable onPress={() => setRecentSearches([])}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>
                      Tümünü Temizle
                    </Text>
                  </Pressable>
                </View>
                {recentSearches.map((s) => (
                  <Pressable key={s} onPress={() => applySearch(s)} className="flex-row items-center py-2.5">
                    <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                    <Text
                      style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary }}
                      className="flex-1 ml-3"
                    >
                      {s}
                    </Text>
                    <Ionicons name="arrow-up" size={16} color={colors.textMuted} style={{ transform: [{ rotate: '45deg' }] }} />
                  </Pressable>
                ))}
              </View>
            ) : null}

            {/* Öne Çıkanlar */}
            <View className="mb-5">
              <View className="flex-row items-center mb-3">
                <Ionicons name="trending-up" size={16} color={colors.primary} />
                <Text
                  style={{ fontFamily: fonts.headingBold, fontSize: 14, color: colors.textPrimary }}
                  className="ml-1.5"
                >
                  Öne Çıkanlar
                </Text>
              </View>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {trendingSearches.map((t, i) => (
                  <Pressable
                    key={t}
                    onPress={() => applySearch(t)}
                    className="flex-row items-center bg-[#F7F7F7] px-3 h-9 rounded-full border border-[#33333315]"
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary }}>{i + 1}</Text>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textPrimary }} className="ml-2">
                      {t}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Popüler Markalar */}
            <View className="mb-5">
              <Text
                style={{ fontFamily: fonts.headingBold, fontSize: 14, color: colors.textPrimary }}
                className="mb-3"
              >
                Popüler Markalar
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {popularBrands.map((b) => (
                  <Pressable
                    key={b}
                    onPress={() => applySearch(b)}
                    className="bg-white border border-[#33333322] px-4 h-10 rounded-xl items-center justify-center"
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }}>{b}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
