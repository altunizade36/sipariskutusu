import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../constants/theme';
import type { InventoryStats } from '../../services/inventoryService';

type Props = {
  stats: InventoryStats;
};

export function InventoryStatsCard({ stats }: Props) {
  const items: Array<{ label: string; value: number; color: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { label: 'Toplam',  value: stats.total,    color: colors.primary, icon: 'cube-outline' },
    { label: 'Stokta',  value: stats.inStock,  color: '#15803D',      icon: 'checkmark-circle-outline' },
    { label: 'Az Kalan', value: stats.lowStock, color: '#C2410C',      icon: 'alert-circle-outline' },
    { label: 'Tükenen', value: stats.soldOut,  color: '#B91C1C',      icon: 'close-circle-outline' },
  ];

  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 }}>
      {items.map((item) => (
        <View
          key={item.label}
          style={{
            flex: 1,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E5E7EB',
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 8,
            alignItems: 'center',
          }}
        >
          <Ionicons name={item.icon} size={16} color={item.color} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: item.color, marginTop: 4 }}>
            {item.value}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textMuted, marginTop: 1 }}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
