import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fonts } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import {
  fetchOrderById,
  updateOrderStatus,
  type Order,
  type OrderStatus,
} from '../../src/services/orderService';

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Bekliyor',
  confirmed: 'Onaylandi',
  preparing: 'Hazirlaniyor',
  shipped: 'Kargoda',
  delivered: 'Teslim Edildi',
  completed: 'Tamamlandi',
  cancelled: 'Iptal',
  refunded: 'Iade',
};

const SELLER_NEXT_ACTIONS: Partial<Record<OrderStatus, Array<{ label: string; next: OrderStatus }>>> = {
  pending: [{ label: 'Onayla', next: 'confirmed' }],
  confirmed: [{ label: 'Hazirlaniyor', next: 'preparing' }],
  preparing: [{ label: 'Kargoya Ver', next: 'shipped' }],
  shipped: [{ label: 'Teslim Edildi', next: 'delivered' }],
  delivered: [{ label: 'Tamamla', next: 'completed' }],
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
}

function formatDate(value: string | undefined) {
  if (!value) {
    return '-';
  }

  try {
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  const orderId = typeof params.id === 'string' ? params.id : '';

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const isSeller = Boolean(user?.id && order?.seller_id === user.id);
  const canManage = isSeller && Boolean(order);

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setError('Siparis bulunamadi.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const fetched = await fetchOrderById(orderId);
      if (!fetched) {
        setError('Siparis bulunamadi.');
        setOrder(null);
      } else {
        setOrder(fetched);
        setTrackingNumber(fetched.tracking_number ?? '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Siparis detayi yuklenemedi.');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const availableActions = useMemo(() => {
    if (!order || !canManage) {
      return [];
    }

    return SELLER_NEXT_ACTIONS[order.status] ?? [];
  }, [canManage, order]);

  async function handleStatusUpdate(nextStatus: OrderStatus) {
    if (!order) {
      return;
    }

    try {
      setUpdating(true);
      await updateOrderStatus(order.id, nextStatus, trackingNumber.trim() || undefined);
      await loadOrder();
      Alert.alert('Basarili', 'Siparis durumu guncellendi.');
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Siparis guncellenemedi.');
    } finally {
      setUpdating(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
      <View className="bg-white px-3 py-2 border-b border-[#33333315] flex-row items-center">
        <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center" accessibilityRole="button" accessibilityLabel="Geri don">
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.textPrimary }} className="flex-1 ml-2">
          Siparis Detayi
        </Text>
        <Pressable
          onPress={() => loadOrder()}
          className="px-2 py-1 rounded-md"
          accessibilityRole="button"
          accessibilityLabel="Siparisi yenile"
        >
          <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.primary }}>Yenile</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 12, gap: 10 }}>
        {loading ? (
          <View className="items-center py-10">
            <ActivityIndicator color={colors.primary} />
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>
              Siparis yukleniyor...
            </Text>
          </View>
        ) : null}

        {!loading && order ? (
          <>
            <View className="rounded-xl border border-[#33333315] bg-white p-3">
              <View className="flex-row items-center justify-between">
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>#{order.id.slice(0, 8)}</Text>
                <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary }}>{STATUS_LABELS[order.status]}</Text>
                </View>
              </View>

              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>
                Olusturma: {formatDate(order.created_at)}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                Toplam: {formatCurrency(order.total)}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                Teslim: {order.shipping_name || '-'} • {order.shipping_city || '-'}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                Adres: {order.shipping_addr || '-'}
              </Text>
            </View>

            <View className="rounded-xl border border-[#33333315] bg-white p-3">
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 8 }}>Siparis Kalemleri</Text>
              {(order.order_items ?? []).map((item, index) => (
                <View key={`${order.id}-${item.listing_id}-${index}`} className="py-2" style={{ borderBottomWidth: index === (order.order_items?.length ?? 1) - 1 ? 0 : 1, borderBottomColor: '#EEF2F7' }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textPrimary }}>
                    {item.quantity}x {item.title}
                  </Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                    Birim: {formatCurrency(item.price)}
                    {item.variant ? ` • Varyant: ${item.variant}` : ''}
                  </Text>
                </View>
              ))}
            </View>

            {canManage ? (
              <View className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-3">
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>Satici Siparis Yonetimi</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                  Durum guncellemeleri aliciya bildirim olarak gider.
                </Text>

                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textPrimary, marginTop: 10 }}>Takip Numarasi</Text>
                <TextInput
                  value={trackingNumber}
                  onChangeText={setTrackingNumber}
                  placeholder="Orn: TRK123456789"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    marginTop: 6,
                    borderWidth: 1,
                    borderColor: '#BFDBFE',
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    backgroundColor: '#FFFFFF',
                    color: colors.textPrimary,
                    fontFamily: fonts.regular,
                    fontSize: 12,
                  }}
                />

                <View className="flex-row flex-wrap mt-3" style={{ gap: 8 }}>
                  {availableActions.map((action) => (
                    <Pressable
                      key={action.next}
                      onPress={() => handleStatusUpdate(action.next)}
                      disabled={updating}
                      className="px-3 py-2 rounded-lg"
                      style={{ backgroundColor: updating ? '#BFDBFE' : colors.primary }}
                      accessibilityRole="button"
                      accessibilityLabel={`Durumu ${action.label} olarak guncelle`}
                    >
                      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>{action.label}</Text>
                    </Pressable>
                  ))}

                  {availableActions.length === 0 ? (
                    <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary }}>
                      Bu siparis icin ek durum aksiyonu yok.
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {!loading && error ? (
          <View className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2.5">
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: '#991B1B' }}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
