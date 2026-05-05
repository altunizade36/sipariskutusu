import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../constants/theme';

interface QuickStat {
  label: string;
  value: string;
  icon: string;
  color?: string;
}

interface QuickStatsProps {
  stats: QuickStat[];
}

export function QuickStats({ stats }: QuickStatsProps) {
  return (
    <View className="bg-white rounded-xl p-4 border border-[#33333315]">
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} className="mb-3">
        Mağaza İstatistikleri
      </Text>
      <View className="flex-row flex-wrap" style={{ gap: 12 }}>
        {stats.map((stat, idx) => (
          <View key={`stat-${idx}`} className="flex-1 min-w-[100px] p-3 bg-gray-50 rounded-lg items-center">
            <Ionicons
              name={stat.icon as any}
              size={20}
              color={stat.color || colors.primary}
              style={{ marginBottom: 6 }}
            />
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, textAlign: 'center' }}>
              {stat.value}
            </Text>
            <Text
              style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, textAlign: 'center', marginTop: 2 }}
              numberOfLines={2}
            >
              {stat.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
