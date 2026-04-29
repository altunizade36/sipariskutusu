import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../constants/theme';

export interface FilterOption {
  id: string;
  label: string;
  icon?: string;
  count?: number;
  isActive?: boolean;
}

interface QuickFilterProps {
  options: FilterOption[];
  onFilterChange: (filterId: string) => void;
  scrollHorizontal?: boolean;
}

export function QuickFilter({ options, onFilterChange, scrollHorizontal = true }: QuickFilterProps) {
  const filterButtons = (
    <View className="flex-row" style={{ gap: 8 }}>
      {options.map((option) => (
        <Pressable
          key={option.id}
          onPress={() => onFilterChange(option.id)}
          className={`px-3 py-2 rounded-full flex-row items-center ${
            option.isActive
              ? 'bg-[#111827]'
              : 'bg-[#F3F4F6] border border-[#D1D5DB]'
          }`}
          style={{ gap: 6 }}
        >
          {option.icon && (
            <Ionicons
              name={option.icon as any}
              size={14}
              color={option.isActive ? '#fff' : colors.textSecondary}
            />
          )}
          <Text
            style={{
              fontFamily: fonts.medium,
              fontSize: 12,
              color: option.isActive ? '#fff' : colors.textSecondary,
            }}
          >
            {option.label}
          </Text>
          {option.count !== undefined && (
            <View
              className={`ml-1 px-1.5 py-0.5 rounded-full ${
                option.isActive ? 'bg-white/20' : 'bg-[#E5E7EB]'
              }`}
            >
              <Text
                style={{
                  fontFamily: fonts.bold,
                  fontSize: 10,
                  color: option.isActive ? '#fff' : colors.textMuted,
                }}
              >
                {option.count}
              </Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );

  if (scrollHorizontal) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
      >
        {filterButtons}
      </ScrollView>
    );
  }

  return (
    <View className="px-4 py-3" style={{ gap: 8 }}>
      {filterButtons}
    </View>
  );
}
