import { View, Text, FlatList, Dimensions, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../constants/theme';
import { ProductCard } from './ProductCard';
import type { Product } from '../data/mockData';

interface PersonalizedFeedProps {
  products: Product[];
  isLoading?: boolean;
  onRefresh?: () => void;
  title?: string;
  emptyMessage?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_WIDTH = (SCREEN_WIDTH - 16 * 2 - 8) / 2;

export function PersonalizedFeed({
  products,
  isLoading = false,
  onRefresh,
  title = 'İçin Önerilen',
  emptyMessage = 'Şu anda öneri yok. Daha fazla ürüne göz atın!',
}: PersonalizedFeedProps) {
  const router = useRouter();
  if (isLoading && products.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 8 }}>
          Öneriler yükleniyor...
        </Text>
      </View>
    );
  }

  if (!products.length) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <Ionicons name="star-outline" size={48} color={colors.textMuted} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, marginTop: 12 }}>
          Öneriler Bulunamadı
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: 'center', paddingHorizontal: 20 }}>
          {emptyMessage}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      {title && (
        <View className="px-4 py-3 flex-row items-center gap-2">
          <Ionicons name="sparkles" size={18} color={colors.primary} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>
            {title}
          </Text>
        </View>
      )}

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        numColumns={2}
        scrollEnabled={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        columnWrapperStyle={{ gap: 8 }}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/product/${item.id}`)}>
            <View style={{ width: ITEM_WIDTH }}>
              <ProductCard product={item} />
            </View>
          </Pressable>
        )}
      />

      {isLoading && products.length > 0 && (
        <View className="py-4 items-center">
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
    </View>
  );
}
