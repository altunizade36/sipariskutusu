import { ActivityIndicator, View, Text, ScrollView, Pressable, TextInput, Image, RefreshControl, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts } from '../src/constants/theme';
import { MARKETPLACE_CATEGORIES } from '../src/constants/marketplaceCategories';
import { useListings } from '../src/context/ListingsContext';
import { useProducts } from '../src/hooks/useProducts';
import { isSupabaseConfigured } from '../src/services/supabase';

export default function SearchScreen() {
  const router = useRouter();
  const { allProducts } = useListings();
  const mainScrollRef = useRef<ScrollView | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState(['koşu ayakkabısı', 'iphone kılıfı', 'nevresim takımı', 'blender']);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [visualSearchActive, setVisualSearchActive] = useState(false);
  const [visualSearchUri, setVisualSearchUri] = useState<string | null>(null);
  const [visualSearchLoading, setVisualSearchLoading] = useState(false);

  // Debounce: query değiştikten 400ms sonra debouncedQuery'yi güncelle
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Sunucu tarafi arama (Supabase varsa)
  const { products: serverResults, loading: serverLoading, refresh: serverRefresh } = useProducts({
    filters: {
      query: debouncedQuery || undefined,
      category_id: selectedCategory ?? undefined,
    },
    enabled: isSupabaseConfigured && debouncedQuery.length >= 2,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await serverRefresh();
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

  useEffect(() => {
    if (!isSearching) return;

    requestAnimationFrame(() => {
      mainScrollRef.current?.scrollTo({ y: 0, animated: false });
    });
  }, [isSearching, query, selectedCategory, visualSearchActive]);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
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
                {searchResults.map((item) => (
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
