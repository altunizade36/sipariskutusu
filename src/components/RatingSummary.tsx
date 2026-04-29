import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../constants/theme';

interface RatingSummaryProps {
  rating: number; // 0-5
  reviewCount: number;
  compact?: boolean;
}

export function RatingSummary({ rating, reviewCount, compact = false }: RatingSummaryProps) {
  const stars = Array.from({ length: 5 }, (_, i) => i < Math.floor(rating));
  const hasHalfStar = rating % 1 !== 0;

  if (compact) {
    return (
      <View className="flex-row items-center gap-1">
        {stars.map((_, i) => (
          <Ionicons
            key={`star-${i}`}
            name={i < Math.floor(rating) ? 'star' : i === Math.floor(rating) && hasHalfStar ? 'star-half' : 'star-outline'}
            size={14}
            color="#F59E0B"
          />
        ))}
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }} className="ml-1">
          {rating.toFixed(1)}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary }}>
          ({reviewCount})
        </Text>
      </View>
    );
  }

  return (
    <View className="bg-white rounded-xl p-4 border border-[#33333315]">
      <View className="flex-row items-start justify-between mb-4">
        <View>
          <View className="flex-row items-center gap-2 mb-2">
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 24, color: colors.textPrimary }}>
              {rating.toFixed(1)}
            </Text>
            <View className="flex-row gap-0.5">
              {stars.map((filled, i) => (
                <Ionicons
                  key={`star-${i}`}
                  name={i < Math.floor(rating) ? 'star' : i === Math.floor(rating) && hasHalfStar ? 'star-half' : 'star-outline'}
                  size={16}
                  color="#F59E0B"
                />
              ))}
            </View>
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>
            {reviewCount} değerlendirme
          </Text>
        </View>
      </View>

      {/* Rating breakdown */}
      <View style={{ gap: 8 }}>
        {[5, 4, 3, 2, 1].map((stars_count) => (
          <View key={`rating-${stars_count}`} className="flex-row items-center gap-2">
            <View className="flex-row gap-0.5 w-16">
              {Array.from({ length: stars_count }).map((_, i) => (
                <Ionicons key={`bar-${i}`} name="star" size={10} color="#F59E0B" />
              ))}
              {Array.from({ length: 5 - stars_count }).map((_, i) => (
                <Ionicons key={`bar-empty-${i}`} name="star-outline" size={10} color="#D1D5DB" />
              ))}
            </View>
            {/* Simple visual bar */}
            <View className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <View
                className="h-full bg-yellow-400 rounded-full"
                style={{ width: `${Math.random() * 40 + 20}%` }}
              />
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, width: 30, textAlign: 'right' }}>
              {Math.floor(Math.random() * 30)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
