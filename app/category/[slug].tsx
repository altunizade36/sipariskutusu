import { View, Text, ScrollView, Pressable, Dimensions, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, useCallback } from 'react';
import { colors, fonts } from '../../src/constants/theme';
import { buildMessagesInboxRoute } from '../../src/utils/messageRouting';
import { MARKETPLACE_CATEGORIES, getMarketplaceCategory } from '../../src/constants/marketplaceCategories';
import { ProductCard } from '../../src/components/ProductCard';
import { useProducts } from '../../src/hooks/useProducts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 32 - 10) / 2;

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<'sort' | 'price' | 'rating' | 'shipping' | null>(null);
  const [sortBy, setSortBy] = useState<'default' | 'priceAsc' | 'priceDesc' | 'rating'>('default');
  const [onlyFreeShipping, setOnlyFreeShipping] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const category = getMarketplaceCategory(slug ?? MARKETPLACE_CATEGORIES[0].id);

    const { products, loading, refresh } = useProducts();

    const onRefresh = useCallback(async () => {
      setRefreshing(true);
      try {
        await refresh();
      } finally {
        setRefreshing(false);
      }
    }, [refresh]);

  const visibleItems = useMemo(() => {
    const source = products
      .filter((item) => item.category === category.id)
      .filter((item) => (onlyFreeShipping ? Boolean(item.freeShipping) : true));

    if (sortBy === 'priceAsc') {
      return [...source].sort((a, b) => a.price - b.price);
    }

    if (sortBy === 'priceDesc') {
      return [...source].sort((a, b) => b.price - a.price);
    }

    if (sortBy === 'rating') {
      return [...source].sort((a, b) => b.rating - a.rating);
    }

    return source;
  }, [products, category.id, onlyFreeShipping, sortBy]);

  function handleFilterAction(action: 'sort' | 'price' | 'rating' | 'shipping') {
    setActiveFilter(action);

    if (action === 'shipping') {
      setOnlyFreeShipping((current) => !current);
      return;
    }

    if (action === 'sort') {
      setSortBy((current) => (current === 'priceAsc' ? 'priceDesc' : 'priceAsc'));
      return;
    }

    if (action === 'price') {
      setSortBy('priceAsc');
      return;
    }

    setSortBy('rating');
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
      <View className="bg-white px-3 py-2 border-b border-[#33333315]">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text
            style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.textPrimary }}
            className="flex-1 ml-2"
          >
            {category.name}
          </Text>
          <Pressable onPress={() => router.push('/search')} className="w-9 h-9 items-center justify-center">
            <Ionicons name="search" size={22} color={colors.textPrimary} />
          </Pressable>
          <Pressable onPress={() => router.push(buildMessagesInboxRoute())} className="w-9 h-9 items-center justify-center">
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      {/* Filter bar */}
      <View className="bg-white px-3 py-3 border-b border-[#33333312]">
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
          Filtrele & Sırala:
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {[
            { icon: 'swap-vertical' as const, label: 'Sırala', key: 'sort' as const },
            { icon: 'pricetag-outline' as const, label: 'Fiyata Göre', key: 'price' as const },
            { icon: 'star-outline' as const, label: 'Puana Göre', key: 'rating' as const },
            { icon: 'car-outline' as const, label: 'Ücretsiz Kargo', key: 'shipping' as const },
          ].map((f) => {
            const selected = f.key === 'shipping' ? onlyFreeShipping : activeFilter === f.key;
            return (
              <Pressable
                key={f.label}
                onPress={() => handleFilterAction(f.key)}
                style={{
                  backgroundColor: selected ? colors.primary : '#F8FAFC',
                  borderColor: selected ? colors.primary : colors.borderLight,
                }}
                className="h-9 px-4 rounded-full border items-center justify-center flex-row gap-1.5"
              >
                {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                <Text
                  style={{
                    fontFamily: selected ? fonts.bold : fonts.medium,
                    fontSize: 11,
                    color: selected ? '#fff' : colors.textPrimary,
                  }}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading && (
        <ActivityIndicator style={{ marginTop: 12 }} color={colors.primary} />
      )}

      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {visibleItems.length === 0 ? (
          <View className="rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-12 mx-4 mt-4 items-center justify-center">
            <View style={{ backgroundColor: '#DBEAFE' }} className="w-16 h-16 rounded-full items-center justify-center mb-3">
              <Ionicons name="search-outline" size={28} color={colors.primary} />
            </View>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 15, color: colors.textPrimary }}>
              Eşleşen ürün yok
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
              Seçili filtrelere uygun ürün bulunamadı.
            </Text>
            <Pressable 
              onPress={() => {
                setSortBy('default');
                setActiveFilter(null);
                setOnlyFreeShipping(false);
              }}
              className="mt-4 px-4 py-2 rounded-full" 
              style={{ backgroundColor: colors.primary }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>Filtreleri Sıfırla</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View className="bg-white px-3 py-2 flex-row items-center border-b border-[#33333315]">
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>
                {visibleItems.length} ürün
              </Text>
            </View>
            <View className="flex-row flex-wrap px-4 pt-3" style={{ gap: 10 }}>
              {visibleItems.map((p) => (
                <View key={p.id} style={{ width: CARD_WIDTH }} className="bg-white rounded-xl overflow-hidden border border-[#33333315]">
                  <ProductCard product={p} />
                </View>
              ))}
            </View>
          </>
        )}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
