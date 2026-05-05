import { View, Text, Pressable, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../constants/theme';

export interface Category {
  id: string;
  name: string;
  icon?: string;
  count?: number;
}

interface CategoryGridProps {
  categories: Category[];
  onCategoryPress: (categoryId: string) => void;
  numColumns?: number;
  scrollable?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function CategoryGrid({
  categories,
  onCategoryPress,
  numColumns = 3,
  scrollable = false,
}: CategoryGridProps) {
  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}
      >
        {categories.map((category) => (
          <Pressable
            key={category.id}
            onPress={() => onCategoryPress(category.id)}
            className="items-center"
            style={{ width: 80 }}
          >
            <View className="w-16 h-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl items-center justify-center mb-2 border border-[#E0E7FF]">
              {category.icon ? (
                <Ionicons name={category.icon as any} size={28} color={colors.primary} />
              ) : (
                <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: colors.primary }}>
                  {category.name.charAt(0)}
                </Text>
              )}
            </View>
            <Text
              style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textPrimary, textAlign: 'center' }}
              numberOfLines={2}
            >
              {category.name}
            </Text>
            {category.count !== undefined && (
              <Text style={{ fontFamily: fonts.regular, fontSize: 9, color: colors.textMuted, marginTop: 2 }}>
                {category.count}
              </Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  const itemWidth = (SCREEN_WIDTH - 16 * 2 - 12 * (numColumns - 1)) / numColumns;

  return (
    <View className="flex-wrap px-4" style={{ flexDirection: 'row', gap: 12 }}>
      {categories.map((category) => (
        <Pressable
          key={category.id}
          onPress={() => onCategoryPress(category.id)}
          className="items-center justify-center"
          style={{ width: itemWidth, aspectRatio: 1 }}
        >
          <View className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl items-center justify-center border border-[#E0E7FF]">
            <View style={{ gap: 4 }}>
              {category.icon ? (
                <View className="items-center">
                  <Ionicons name={category.icon as any} size={24} color={colors.primary} />
                </View>
              ) : (
                <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.primary, textAlign: 'center' }}>
                  {category.name.charAt(0)}
                </Text>
              )}
              <Text
                style={{ fontFamily: fonts.medium, fontSize: 10, color: colors.textPrimary, textAlign: 'center' }}
                numberOfLines={2}
              >
                {category.name}
              </Text>
              {category.count !== undefined && (
                <Text style={{ fontFamily: fonts.regular, fontSize: 8, color: colors.textMuted }}>
                  {category.count}
                </Text>
              )}
            </View>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
