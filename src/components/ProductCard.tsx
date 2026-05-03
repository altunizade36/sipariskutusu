import { ActivityIndicator, Alert, View, Text, Pressable } from 'react-native';
import CachedImage from './CachedImage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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

type BadgeStyle = { bg: string; text: string; border: string; icon: string; label: string };

const BADGE_MAP: Record<string, BadgeStyle> = {
  Flash:             { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A', icon: '⚡', label: 'Flash İndirim' },
  'Yeni İlan':       { bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE', icon: '🆕', label: 'Yeni İlan' },
  'Mağazada Yeni':   { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', icon: '🏪', label: 'Mağazada Yeni' },
  Hikayede:          { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE', icon: '📸', label: 'Hikayede' },
  'Çok Satan':       { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', icon: '🔥', label: 'Çok Satan' },
  Popüler:           { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA', icon: '🔥', label: 'Popüler' },
  'Popüler İlan':    { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA', icon: '🔥', label: 'Popüler İlan' },
  'En Çok İncelenen':{ bg: '#F0FDF4', text: '#166534', border: '#BBF7D0', icon: '👁', label: 'Çok İncelenen' },
  Vitrinde:          { bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE', icon: '✨', label: 'Vitrinde' },
  Trend:             { bg: '#FAE8FF', text: '#86198F', border: '#E9D5FF', icon: '📈', label: 'Trend' },
  Yeni:              { bg: '#DBEAFE', text: '#1D4ED8', border: '#BFDBFE', icon: '🆕', label: 'Yeni' },
};

function getBadge(badge?: string): BadgeStyle | null {
  if (!badge) return null;
  return BADGE_MAP[badge] ?? { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA', icon: '🏷', label: badge };
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
  if (!normalized || normalized === 'YENI' || normalized === 'YENİ') return 0;
  if (normalized.endsWith('B')) {
    return Math.round(Number(normalized.slice(0, -1)) * 1000) || 0;
  }
  return Number(normalized.replace(/[^0-9.]/g, '')) || 0;
}

const CONDITION_COLORS: Record<string, { bg: string; text: string }> = {
  'Yeni':           { bg: '#DCFCE7', text: '#15803D' },
  'Az kullanılmış': { bg: '#DBEAFE', text: '#1D4ED8' },
  'İkinci el':      { bg: '#FEF3C7', text: '#92400E' },
  'Hasarlı':        { bg: '#FEE2E2', text: '#B91C1C' },
};

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

  const conditionColor = product.condition ? (CONDITION_COLORS[product.condition] ?? null) : null;
  const locationText = [product.location, product.district].filter(Boolean).join(' · ');

  useEffect(() => {
    setLiveFavoriteCount(initialFavoriteCount);
  }, [initialFavoriteCount]);

  useEffect(() => {
    let alive = true;
    if (!isSupabaseConfigured || !user || !canUseLiveListing) {
      setFavorited(false);
      return () => { alive = false; };
    }
    checkFavorited(product.id).then((next) => { if (alive) setFavorited(next); });
    return () => { alive = false; };
  }, [canUseLiveListing, checkFavorited, product.id, user?.id]);

  const handleFavoritePress = async () => {
    if (!user) { router.push('/auth'); return; }
    if (!isSupabaseConfigured || !canUseLiveListing) {
      Alert.alert('Favoriler aktif değil', 'Bu işlem canlı ilanlarda giriş yapmış kullanıcılarla çalışır.');
      return;
    }
    const wasF = favorited;
    const wasFCount = liveFavoriteCount;
    setFavorited(!favorited);
    setLiveFavoriteCount((c) => Math.max(!wasF ? c + 1 : c - 1, 0));
    setFavoriteLoading(true);
    try {
      const next = await toggle(product.id);
      if (next !== !wasF) {
        setFavorited(next);
        setLiveFavoriteCount((c) => Math.max(next ? c + 1 : c - 1, 0));
      }
    } catch (error) {
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
  const borderColor = isDarkMode ? '#263249' : '#F1F5F9';

  return (
    <Pressable
      onPress={() => router.push(`/product/${product.id}`)}
      style={{
        width: typeof width === 'number' ? width : '100%',
        backgroundColor: cardBg,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor,
        shadowColor: isDarkMode ? '#000' : '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDarkMode ? 0.3 : 0.07,
        shadowRadius: 8,
        elevation: 3,
      }}
      className="active:opacity-90"
    >
      {/* ── IMAGE ─────────────────────────────────────────────── */}
      <View style={{ aspectRatio: 3 / 4, backgroundColor: imgPlaceholderBg, position: 'relative', overflow: 'hidden' }}>
        <CachedImage
          uri={resolveMediaCover(product)}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
        />

        {/* Bottom gradient for readability */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.28)']}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 56 }}
        />

        {/* Video indicator */}
        {hasVideo ? (
          <View style={{ position: 'absolute', bottom: 8, left: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="play" size={12} color="#fff" />
          </View>
        ) : null}

        {/* Media count */}
        {mediaCount > 1 ? (
          <View style={{ position: 'absolute', bottom: 8, right: discountPct < 10 ? 42 : 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="images-outline" size={9} color="#fff" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: '#fff' }}>{mediaCount}</Text>
          </View>
        ) : null}

        {/* Badge (top-left) */}
        {badge ? (
          <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: badge.bg, borderColor: badge.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '80%' }}>
            <Text style={{ fontSize: 8 }}>{badge.icon}</Text>
            <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 8.5, color: badge.text, letterSpacing: 0.2 }}>{badge.label}</Text>
          </View>
        ) : null}

        {/* Discount pill (top-right) */}
        {discountPct >= 10 ? (
          <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#EF4444', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 2, shadowColor: '#EF4444', shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}>
            <Ionicons name="flash" size={9} color="#fff" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff' }}>-{discountPct}%</Text>
          </View>
        ) : null}

        {/* Favorite button */}
        <Pressable
          onPress={(e) => { e.stopPropagation(); handleFavoritePress(); }}
          disabled={favoriteLoading}
          style={{ position: 'absolute', bottom: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: favorited ? colors.danger : 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 }}
        >
          {favoriteLoading ? (
            <ActivityIndicator size="small" color={colors.danger} />
          ) : (
            <Ionicons
              name={favorited ? 'heart' : 'heart-outline'}
              size={15}
              color={favorited ? '#fff' : colors.danger}
            />
          )}
        </Pressable>

        {/* Free shipping badge */}
        {product.freeShipping ? (
          <View style={{ position: 'absolute', top: badge ? 32 : 8, right: 8, backgroundColor: 'rgba(255,255,255,0.93)', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="rocket" size={9} color={colors.success} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 8, color: colors.success }}>Ücretsiz</Text>
          </View>
        ) : null}

        {/* Demo overlay banner */}
        {product.isDemo ? (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(245,158,11,0.92)', paddingVertical: 4, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
            <Ionicons name="information-circle" size={10} color="#fff" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: '#fff', letterSpacing: 0.4 }}>ÖRNEK İLAN</Text>
          </View>
        ) : null}
      </View>

      {/* ── INFO ──────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 10, paddingTop: 9, paddingBottom: 10 }}>

        {/* Seller name */}
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.primary, letterSpacing: 0.3, marginBottom: 3 }}
        >
          {product.brand}
        </Text>

        {/* Title */}
        <Text
          numberOfLines={2}
          style={{ fontFamily: fonts.medium, fontSize: 12.5, color: titleColor, lineHeight: 18, minHeight: 36 }}
        >
          {product.title}
        </Text>

        {/* Condition + Location row */}
        {(conditionColor || locationText) ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
            {conditionColor ? (
              <View style={{ backgroundColor: conditionColor.bg, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: conditionColor.text }}>{product.condition}</Text>
              </View>
            ) : null}
            {locationText ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 }}>
                <Ionicons name="location-outline" size={10} color={mutedColor} />
                <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 10, color: mutedColor, flex: 1 }}>{locationText}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Price row */}
        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            {product.originalPrice && product.price > 0 ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 10.5, color: mutedColor, textDecorationLine: 'line-through', lineHeight: 14 }}>
                ₺{product.originalPrice.toLocaleString('tr-TR')}
              </Text>
            ) : null}
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: colors.primary, lineHeight: 20 }}>
              {product.price > 0 ? `₺${product.price.toLocaleString('tr-TR')}` : 'Fiyat Sor'}
            </Text>
          </View>

          {/* Engagement count */}
          {liveFavoriteCount > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 }}>
              <Ionicons name="heart" size={11} color={colors.danger} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: subtitleColor }}>
                {formatEngagementCount(liveFavoriteCount)}
              </Text>
            </View>
          ) : null}
        </View>

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
    && prev.product.condition === next.product.condition
  );
});
