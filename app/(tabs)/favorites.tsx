import { View, Text, ScrollView, Pressable, Dimensions, RefreshControl, ActivityIndicator, Share, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../../src/constants/theme';
import { ProductCard } from '../../src/components/ProductCard';
import SkeletonCard from '../../src/components/SkeletonCard';
import { ProfileButton } from '../../src/components/ProfileButton';
import { useFavorites } from '../../src/hooks/useFavorites';
import { useAuth } from '../../src/context/AuthContext';
import { useAndroidTabBackToHome } from '../../src/hooks/useAndroidTabBackToHome';
import { getSupabaseClient } from '../../src/services/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 32 - 12) / 2;

interface FollowedStore {
  id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  city: string | null;
  follower_count: number;
  is_verified: boolean;
  listing_count: number;
}

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
  const [refreshing, setRefreshing] = useState(false);
  const cardWidth = columns === 2 ? CARD_WIDTH : SCREEN_WIDTH - 32;

  const TAB_LABELS: Record<typeof tab, string> = {
    products: 'ürün',
    collections: 'koleksiyon',
    brands: 'marka',
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshFavs();
    } finally {
      setRefreshing(false);
    }
  };

  const visibleFavorites = useMemo(() => {
    let source = [...favorites];

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
  }, [favorites, onlyDiscount, onlyFreeShipping, sortBy]);

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
            { key: 'brands', label: 'Markalar' },
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
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-[#33333315]">
            <Pressable onPress={() => setSortBy((current) => (current === 'priceAsc' ? 'priceDesc' : 'priceAsc'))} className="flex-row items-center bg-[#F7F7F7] rounded-full px-3 h-8">
              <Ionicons name="swap-vertical" size={14} color={colors.textPrimary} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textPrimary }} className="ml-1">
                {sortBy === 'priceAsc' ? 'Artan' : sortBy === 'priceDesc' ? 'Azalan' : 'Sırala'}
              </Text>
            </Pressable>
            <Pressable onPress={() => setOnlyFreeShipping((current) => !current)} className="flex-row items-center bg-[#F7F7F7] rounded-full px-3 h-8">
              <Ionicons name="options" size={14} color={colors.textPrimary} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textPrimary }} className="ml-1">
                {onlyFreeShipping ? 'Kargo Açık' : 'Filtrele'}
              </Text>
            </Pressable>
            <Pressable onPress={() => setOnlyDiscount((current) => !current)} className="flex-row items-center bg-[#F7F7F7] rounded-full px-3 h-8">
              <Ionicons name="pricetag-outline" size={14} color={colors.textPrimary} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textPrimary }} className="ml-1">
İndirimde
              </Text>
            </Pressable>
            <Pressable onPress={() => setColumns((current) => (current === 2 ? 1 : 2))} className="flex-row items-center bg-[#F7F7F7] rounded-full px-3 h-8">
              <Ionicons name="grid-outline" size={14} color={colors.textPrimary} />
            </Pressable>
          </View>

          {visibleFavorites.length === 0 ? (
            <View className="rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-12 mx-4 mt-4 items-center justify-center">
              <View style={{ backgroundColor: '#FEF3C7' }} className="w-16 h-16 rounded-full items-center justify-center mb-3">
                <Ionicons name="heart-outline" size={28} color="#F59E0B" />
              </View>
                {!user ? (
                  <>
                    <Text style={{ fontFamily: fonts.headingBold, fontSize: 15, color: colors.textPrimary }}>
                      Giriş yapman gerekiyor
                    </Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
                      Favori ürünlerini kaydetmek için giriş yap.
                    </Text>
                    <Pressable
                      onPress={() => router.push('/auth')}
                      className="mt-4 px-4 py-2 rounded-full"
                      style={{ backgroundColor: colors.primary }}
                    >
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>Giriş Yap</Text>
                    </Pressable>
                  </>
                ) : favLoading ? (
                  <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
                ) : (
                  <>
                    <Text style={{ fontFamily: fonts.headingBold, fontSize: 15, color: colors.textPrimary }}>
                      Henüz favori ürün yok
                    </Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
                      Beğendiğin ürünleri favorilere ekle ve kolayca bulabilirsin.
                    </Text>
                    <Pressable
                      onPress={() => router.push('/')}
                      className="mt-4 px-4 py-2 rounded-full"
                      style={{ backgroundColor: colors.primary }}
                    >
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>Ürünleri Keşfet</Text>
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
      ) : (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-[#F7F7F7] items-center justify-center mb-4">
            <Ionicons
              name={tab === 'collections' ? 'albums-outline' : 'ribbon-outline'}
              size={36}
              color={colors.primary}
            />
          </View>
          <Text
            style={{ fontFamily: fonts.headingBold, fontSize: 16, color: colors.textPrimary }}
            className="mb-1"
          >
            Henüz favori {TAB_LABELS[tab]} yok
          </Text>
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 13,
              color: colors.textSecondary,
              textAlign: 'center',
            }}
          >
            Favori {TAB_LABELS[tab]} eklediğinde burada göreceksin
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/explore')}
            style={{ backgroundColor: colors.primary }}
            className="mt-5 h-11 px-6 rounded-xl items-center justify-center"
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>
Keşfet
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
