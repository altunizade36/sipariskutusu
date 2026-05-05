import { View, Text, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../constants/theme';
import { classifyStock, type InventoryItem } from '../../services/inventoryService';
import { StockStatusBadge } from './StockStatusBadge';

type Props = {
  item: InventoryItem;
  onPressEdit: () => void;
  onPressGoTo: () => void;
};

const PLACEHOLDER = 'https://placehold.co/120x120/E5E7EB/64748B?text=Urun';

function formatPrice(value: number) {
  return `${value.toLocaleString('tr-TR')} ₺`;
}

export function InventoryProductCard({ item, onPressEdit, onPressGoTo }: Props) {
  const status = classifyStock(item);
  const isSoldOut = status === 'sold_out';

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
        opacity: isSoldOut ? 0.86 : 1,
      }}
    >
      <View style={{ flexDirection: 'row' }}>
        <View style={{ position: 'relative' }}>
          <Image
            source={{ uri: item.cover_url || PLACEHOLDER }}
            style={{ width: 76, height: 76, borderRadius: 10, backgroundColor: '#F1F5F9' }}
          />
          {isSoldOut ? (
            <View
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 10,
                backgroundColor: 'rgba(0,0,0,0.45)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#FFF', textAlign: 'center' }}>
                Tükendi
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>
            {item.title}
          </Text>
          {item.category_label ? (
            <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
              {item.category_label}
            </Text>
          ) : null}
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary, marginTop: 4 }}>
            {formatPrice(item.price)}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <StockStatusBadge status={status} remaining={item.stock} showRemaining />
            {item.stock_tracking_enabled ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="cube-outline" size={12} color={colors.textSecondary} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary }}>
                  {item.stock} adet · uyarı: {item.low_stock_threshold}
                </Text>
              </View>
            ) : (
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted }}>
                Stok takibi kapalı
              </Text>
            )}
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Pressable
          onPress={onPressEdit}
          style={{
            flex: 1,
            height: 38,
            borderRadius: 10,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 6,
          }}
          accessibilityRole="button"
          accessibilityLabel="Stok guncelle"
        >
          <Ionicons name="create-outline" size={15} color="#FFF" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#FFF' }}>Stok Güncelle</Text>
        </Pressable>
        <Pressable
          onPress={onPressGoTo}
          style={{
            flex: 1,
            height: 38,
            borderRadius: 10,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#CBD5E1',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 6,
          }}
          accessibilityRole="button"
          accessibilityLabel="Urune git"
        >
          <Ionicons name="open-outline" size={15} color={colors.textPrimary} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }}>Ürüne Git</Text>
        </Pressable>
      </View>
    </View>
  );
}
