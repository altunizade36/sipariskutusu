import { ActivityIndicator, Alert, View, Text, Pressable } from 'react-native';
import CachedImage from './CachedImage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useEffect, useMemo, useState } from 'react';
import { colors, fonts } from '../constants/theme';
import type { Product } from '../data/mockData';
import { getOrderedMediaUris, hasVideoMedia, resolveMediaCover } from '../utils/media';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../hooks/useFavorites';
import { isSupabaseConfigured } from '../services/supabase';

type Props = {
  product: Product;
  width?: number | string;
};

type BadgeStyle = { bg: string; text: string; icon: string; label: string };

const BADGE_MAP: Record<string, BadgeStyle> = {
  Flash: { bg: '#FEF3C7', text: '#92400E', icon: '⚡', label: 'Flash İndirim' },
  'Yeni İlan': { bg: '#DBEAFE', text: '#1E40AF', icon: '🆕', label: 'Yeni İlan' },
  'Mağazada Yeni': { bg: '#EFF6FF', text: '#1D4ED8', icon: '🏪', label: 'Mağazada Yeni' },
  Hikayede: { bg: '#EEF2FF', text: '#4338CA', icon: '📸', label: 'Hikayede' },
  'Çok Satan': { bg: '#ECFDF5', text: '#065F46', icon: '🔥', label: 'Çok Satan' },
  Popüler: { bg: '#FFF7ED', text: '#C2410C', icon: '🔥', label: 'Popüler' },
  'Popüler İlan': { bg: '#FFF7ED', text: '#C2410C', icon: '🔥', label: 'Popüler İlan' },
  'En Çok İncelenen': { bg: '#F0FDF4', text: '#166534', icon: '👁', label: 'Çok İncelenen' },
  Vitrinde: { bg: '#DBEAFE', text: '#1E40AF', icon: '✨', label: 'Vitrinde' },
  Trend: { bg: '#FAE8FF', text: '#86198F', icon: '📈', label: 'Trend' },
  Yeni: { bg: '#DBEAFE', text: '#1D4ED8', icon: '🆕', label: 'Yeni' },
};

function getBadge(badge?: string): BadgeStyle | null {
  if (!badge) return null;
  return BADGE_MAP[badge] ?? { bg: '#FEE2E2', text: '#991B1B', icon: '🏷', label: badge };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatEngagementCount(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}B`;
  }

  return value.toLocaleString('tr-TR');
}

function parseCount(value: string | number | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value ?? '0').trim().replace(',', '.').toUpperCase();
  if (!normalized || normalized === 'YENI' || normalized === 'YENİ') {
    return 0;
  }

  if (normalized.endsWith('B')) {
    return Math.round(Number(normalized.slice(0, -1)) * 1000) || 0;
  }

  return Number(normalized.replace(/[^0-9.]/g, '')) || 0;
}

function ProductCardComponent({ product, width = '100%' }: Props) {
  const router = useRouter();
  const { user, isDarkMode } = useAuth();
  const { checkFavorited, toggle } = useFavorites();
  const [favorited, setFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  const badge = getBadge(product.badge);
  const discountPct = product.discount ?? 0;
  const mediaCount = getOrderedMediaUris(product).length;
  const hasVideo = hasVideoMedia(product);
  const canUseLiveListing = isUuid(product.id);
  const initialFavoriteCount = useMemo(() => parseCount(product.favoriteCount), [product.favoriteCount]);
  const [liveFavoriteCount, setLiveFavoriteCount] = useState(initialFavoriteCount);
  const [liveReviewCount, setLiveReviewCount] = useState(canUseLiveListing ? product.reviewCount : 0);

  useEffect(() => {
    setLiveFavoriteCount(initialFavoriteCount);
    setLiveReviewCount(canUseLiveListing ? product.reviewCount : 0);
  }, [canUseLiveListing, initialFavoriteCount, product.reviewCount]);

  useEffect(() => {
    let alive = true;

    if (!isSupabaseConfigured || !user || !canUseLiveListing) {
      setFavorited(false);
      return () => {
        alive = false;
      };
    }

    const refresh = () => {
      checkFavorited(product.id).then((next) => {
        if (alive) {
          setFavorited(next);
        }
      });
    };

    refresh();

    return () => {
      alive = false;
    };
  }, [canUseLiveListing, checkFavorited, product.id, user?.id]);

  const handleFavoritePress = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }

    if (!isSupabaseConfigured || !canUseLiveListing) {
      Alert.alert('Favoriler aktif değil', 'Bu işlem canlı ilanlarda giriş yapmış kullanıcılarla çalışır.');
      return;
    }

    // Optimistic update: toggle UI immediately
    const wasF = favorited;
    const wasFCount = liveFavoriteCount;
    setFavorited(!favorited);
    setLiveFavoriteCount((current) => Math.max(!wasF ? current + 1 : current - 1, 0));
    setFavoriteLoading(true);

    try {
      const next = await toggle(product.id);
      // Only update if different from optimistic (shouldn't happen if server agrees)
      if (next !== !wasF) {
        setFavorited(next);
        setLiveFavoriteCount((current) => Math.max(next ? current + 1 : current - 1, 0));
      }
    } catch (error) {
      // Revert on error
      setFavorited(wasF);
      setLiveFavoriteCount(wasFCount);
      Alert.alert('Favori güncellenemedi', error instanceof Error ? error.message : 'Lütfen tekrar dene.');
    } finally {
      setFavoriteLoading(false);
    }
  };

  const cardBg = isDarkMode ? '#1C2537' : '#FFFFFF';
  const imgPlaceholderBg = isDarkMode ? '#243048' : '#F1F5F9';
  const titleColor = isDarkMode ? '#E2E8F0' : colors.textPrimary;
  const subtitleColor = isDarkMode ? '#94A3B8' : colors.textSecondary;
  const mutedColor = isDarkMode ? '#64748B' : colors.textMuted;

  return (
    <Pressable
      onPress={() => router.push(`/product/${product.id}`)}
      style={{ width: typeof width === 'number' ? width : '100%', backgroundColor: cardBg }}
      className="active:opacity-90"
    >
      {/* Image */}
      <View style={{ aspectRatio: 3 / 4, backgroundColor: imgPlaceholderBg }} className="relative overflow-hidden">
        <CachedImage
          uri={resolveMediaCover(product)}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
        />

        {hasVideo ? (
          <View className="absolute bottom-2 left-2 w-7 h-7 rounded-full bg-black/65 items-center justify-center">
            <Ionicons name="play" size={13} color="#fff" />
          </View>
        ) : null}

        {mediaCount > 1 ? (
          <View className="absolute bottom-2 right-2 bg-black/65 rounded-full px-2 py-[3px] flex-row items-center gap-1">
            <Ionicons name="images-outline" size={10} color="#fff" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: '#fff' }}>
              {mediaCount}
            </Text>
          </View>
        ) : null}

        {/* Badge */}
        {badge ? (
          <View
            style={{
              backgroundColor: badge.bg,
              borderColor: badge.text + '33',
              borderWidth: 1,
              maxWidth: '88%',
              elevation: 1,
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 2,
              shadowOffset: { width: 0, height: 1 },
            }}
            className="absolute top-2 left-2 flex-row items-center px-2.5 py-1 rounded-full gap-1"
          >
            <Text style={{ fontSize: 8 }}>{badge.icon}</Text>
            <Text
              numberOfLines={1}
              style={{ fontFamily: fonts.bold, fontSize: 8.5, color: badge.text, letterSpacing: 0.3 }}
            >
              {badge.label}
            </Text>
          </View>
        ) : null}

        {/* Discount pill */}
        {discountPct >= 10 ? (
          <View
            style={{
              backgroundColor: '#EF4444',
              elevation: 2,
              shadowColor: '#EF4444',
              shadowOpacity: 0.35,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
            }}
            className="absolute top-2 right-2 flex-row items-center px-2 py-1 rounded-full gap-0.5"
          >
            <Ionicons name="flash" size={9} color="#fff" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff' }}>
              -{discountPct}%
            </Text>
          </View>
        ) : (
          /* Favorite button if no discount */
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              handleFavoritePress();
            }}
            disabled={favoriteLoading}
            className="absolute top-2 right-2 w-8 h-8 bg-white rounded-full items-center justify-center"
            style={{ elevation: 2 }}
          >
            {favoriteLoading ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Ionicons
                name={favorited ? 'heart' : 'heart-outline'}
                size={16}
                color={favorited ? colors.danger : colors.textSecondary}
              />
            )}
          </Pressable>
        )}

        {/* Favorite on bottom-left when discount pill is top-right */}
        {discountPct >= 10 ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              handleFavoritePress();
            }}
            disabled={favoriteLoading}
            className="absolute bottom-2 left-2 w-7 h-7 bg-white/90 rounded-full items-center justify-center"
          >
            {favoriteLoading ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Ionicons
                name={favorited ? 'heart' : 'heart-outline'}
                size={14}
                color={favorited ? colors.danger : colors.textSecondary}
              />
            )}
          </Pressable>
        ) : null}

        {/* Free shipping ribbon */}
        {product.freeShipping ? (
          <View
            className="absolute bg-white/90 rounded-full px-2 py-[3px] flex-row items-center gap-0.5"
            style={{ bottom: mediaCount > 1 ? 28 : 8, right: 8 }}
          >
            <Ionicons name="rocket" size={9} color={colors.success} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: colors.success }}>
              Ücretsiz Kargo
            </Text>
          </View>
        ) : null}
      </View>

      {/* Info */}
      <View className="px-2.5 pt-2 pb-3">
        {/* Brand */}
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary, letterSpacing: 0.2 }}
        >
          {product.brand}
        </Text>

        {/* Title */}
        <Text
          numberOfLines={2}
          style={{
            fontFamily: fonts.medium,
            fontSize: 12,
            color: titleColor,
            lineHeight: 17,
            marginTop: 2,
            minHeight: 34,
          }}
        >
          {product.title}
        </Text>

        {/* Live engagement */}
        <View className="flex-row items-center mt-1.5 gap-1">
          <Ionicons name="heart" size={11} color={colors.danger} />
          <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: subtitleColor }}>
            {formatEngagementCount(liveFavoriteCount)} beğeni
          </Text>
          <Ionicons name="chatbubble-outline" size={11} color={colors.primary} style={{ marginLeft: 6 }} />
          <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: subtitleColor }}>
            {formatEngagementCount(liveReviewCount)} yorum
          </Text>
        </View>

        {/* Price */}
        <View className="mt-1.5">
          {product.originalPrice && product.price > 0 ? (
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 11,
                color: mutedColor,
                textDecorationLine: 'line-through',
              }}
            >
              ₺{product.originalPrice.toLocaleString('tr-TR')}
            </Text>
          ) : null}
          <Text
            style={{ fontFamily: fonts.headingBold, fontSize: 15, color: colors.primary }}
          >
            {product.price > 0 ? `₺${product.price.toLocaleString('tr-TR')}` : 'Fiyat Sor'}
          </Text>
        </View>

        <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: subtitleColor, marginTop: 6, lineHeight: 14 }}>
          Bu platform yalnızca alıcı ve satıcıyı buluşturur.
          {'\n'}Ödeme ve teslimat taraflar arasında gerçekleşir.
        </Text>
      </View>
    </Pressable>
  );
}

export const ProductCard = memo(ProductCardComponent, (prev, next) => {
  return (
    prev.width === next.width
    && prev.product.id === next.product.id
    && prev.product.price === next.product.price
    && prev.product.originalPrice === next.product.originalPrice
    && prev.product.favoriteCount === next.product.favoriteCount
    && prev.product.reviewCount === next.product.reviewCount
    && prev.product.badge === next.product.badge
    && prev.product.image === next.product.image
    && prev.product.title === next.product.title
  );
});
