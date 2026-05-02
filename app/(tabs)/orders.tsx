import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import {
  fetchMyOrders,
  fetchMySalesOrders,
  updateOrderStatus,
  type Order,
  type OrderStatus,
} from '../../src/services/orderService';
import { buildSellerMessagesRoute, buildMessagesInboxRoute } from '../../src/utils/messageRouting';

const TAB_OPTIONS = [
  { key: 'buying', label: 'Aldiklarim' },
  { key: 'selling', label: 'Sattiklarim' },
] as const;

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Bekliyor',
  confirmed: 'Onaylandi',
  preparing: 'Surec Devam',
  shipped: 'Guncellendi',
  delivered: 'Sonuclandi',
  completed: 'Tamamlandi',
  cancelled: 'Iptal',
  refunded: 'Iade',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
}

function formatDate(value: string) {
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

function getSellerNextStatus(status: OrderStatus): OrderStatus | null {
  if (status === 'pending') return 'confirmed';
  if (status === 'confirmed') return 'preparing';
  if (status === 'preparing') return 'shipped';
  if (status === 'shipped') return 'delivered';
  if (status === 'delivered') return 'completed';
  return null;
}

export default function OrdersScreen() {
  const router = useRouter();
  const { isDarkMode } = useAuth();
  const [activeTab, setActiveTab] = useState<(typeof TAB_OPTIONS)[number]['key']>('buying');
  const [buyingOrders, setBuyingOrders] = useState<Order[]>([]);
  const [sellingOrders, setSellingOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [dateFilter, setDateFilter] = useState<'all' | '7' | '30'>('all');
  const [quickUpdatingOrderId, setQuickUpdatingOrderId] = useState<string | null>(null);

  const palette = useMemo(() => ({
    screenBg: isDarkMode ? '#0F172A' : '#F7F7F7',
    surfaceBg: isDarkMode ? '#111827' : '#FFFFFF',
    softBg: isDarkMode ? '#1F2937' : '#E2E8F0',
    activeBg: isDarkMode ? '#1E3A8A' : '#DBEAFE',
    inputBg: isDarkMode ? '#0F172A' : '#F8FAFC',
    border: isDarkMode ? '#334155' : '#E2E8F0',
    cardBorder: isDarkMode ? '#334155' : '#33333315',
    textPrimary: isDarkMode ? '#E5E7EB' : colors.textPrimary,
    textSecondary: isDarkMode ? '#94A3B8' : colors.textSecondary,
    statusPillBg: isDarkMode ? '#1F2937' : '#F1F5F9',
  }), [isDarkMode]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [mine, sales] = await Promise.all([fetchMyOrders(), fetchMySalesOrders()]);
      setBuyingOrders(mine);
      setSellingOrders(sales);
    } catch (err) {
      setBuyingOrders([]);
      setSellingOrders([]);
      setError(err instanceof Error ? err.message : 'Siparisler yuklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const visibleOrders = useMemo(() => {
    const base = activeTab === 'buying' ? buyingOrders : sellingOrders;
    const searchText = searchQuery.trim().toLowerCase();

    return base.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) {
        return false;
      }

      if (dateFilter !== 'all') {
        const limitDays = Number(dateFilter);
        const threshold = Date.now() - limitDays * 24 * 60 * 60 * 1000;
        if (new Date(order.created_at).getTime() < threshold) {
          return false;
        }
      }

      if (!searchText) {
        return true;
      }

      const haystack = [
        order.id,
        order.shipping_name,
        order.shipping_city,
        ...(order.order_items ?? []).map((item) => item.title),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(searchText);
    });
  }, [activeTab, buyingOrders, dateFilter, searchQuery, sellingOrders, statusFilter]);

  function openOrderConversation(order: Order) {
    if (activeTab === 'buying' && order.seller_id) {
      const firstItemTitle = order.order_items?.[0]?.title ?? 'Siparis';
      const firstItemId = order.order_items?.[0]?.listing_id;
      router.push(buildSellerMessagesRoute({
        sellerId: order.seller_id,
        productId: firstItemId,
        productTitle: firstItemTitle,
        initialMessage: `#${order.id.slice(0, 8)} siparisim hakkinda guncelleme alabilir miyim?`,
      }));
      return;
    }

    router.push(buildMessagesInboxRoute());
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      await loadOrders();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleQuickSellerUpdate(order: Order) {
    const nextStatus = getSellerNextStatus(order.status);
    if (!nextStatus) {
      return;
    }

    setQuickUpdatingOrderId(order.id);
    setError('');

    try {
      await updateOrderStatus(order.id, nextStatus);
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Siparis durumu guncellenemedi.');
    } finally {
      setQuickUpdatingOrderId(null);
    }
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.screenBg }} edges={['top']}>
      <View className="px-4 pt-2 pb-3 border-b" style={{ backgroundColor: palette.surfaceBg, borderBottomColor: palette.cardBorder }}>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 20, color: palette.textPrimary }}>Gorusme Gecmisi</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary, marginTop: 3 }}>
          Satin aldigin ve sattigin siparisleri buradan yonetebilirsin.
        </Text>
        <View className="flex-row mt-3" style={{ gap: 8 }}>
          {TAB_OPTIONS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                className="px-4 py-2 rounded-xl"
                style={{ backgroundColor: active ? palette.activeBg : palette.softBg }}
                accessibilityRole="button"
                accessibilityLabel={`${tab.label} siparis sekmesini ac`}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: active ? '#BFDBFE' : palette.textSecondary }}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Ilan no, urun veya kisi ara"
          placeholderTextColor={colors.textMuted}
          style={{
            marginTop: 10,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 9,
            fontFamily: fonts.regular,
            fontSize: 12,
            color: palette.textPrimary,
            backgroundColor: palette.inputBg,
          }}
          accessibilityLabel="Siparis arama alani"
        />

        <View className="flex-row flex-wrap mt-2" style={{ gap: 8 }}>
          <Pressable
            onPress={() => setDateFilter('all')}
            className="px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: dateFilter === 'all' ? palette.activeBg : palette.softBg }}
            accessibilityRole="button"
            accessibilityLabel="Tum tarihler filtresi"
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: dateFilter === 'all' ? '#BFDBFE' : palette.textSecondary }}>Tum Tarihler</Text>
          </Pressable>
          <Pressable
            onPress={() => setDateFilter('7')}
            className="px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: dateFilter === '7' ? palette.activeBg : palette.softBg }}
            accessibilityRole="button"
            accessibilityLabel="Son yedi gun filtresi"
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: dateFilter === '7' ? '#BFDBFE' : palette.textSecondary }}>Son 7 Gun</Text>
          </Pressable>
          <Pressable
            onPress={() => setDateFilter('30')}
            className="px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: dateFilter === '30' ? palette.activeBg : palette.softBg }}
            accessibilityRole="button"
            accessibilityLabel="Son otuz gun filtresi"
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: dateFilter === '30' ? '#BFDBFE' : palette.textSecondary }}>Son 30 Gun</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2" contentContainerStyle={{ gap: 8 }}>
          <Pressable
            onPress={() => setStatusFilter('all')}
            className="px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: statusFilter === 'all' ? palette.activeBg : palette.softBg }}
            accessibilityRole="button"
            accessibilityLabel="Tum durumlar filtresi"
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: statusFilter === 'all' ? '#BFDBFE' : palette.textSecondary }}>Tum Durumlar</Text>
          </Pressable>
          {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((status) => (
            <Pressable
              key={status}
              onPress={() => setStatusFilter(status)}
              className="px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: statusFilter === status ? palette.activeBg : palette.softBg }}
              accessibilityRole="button"
              accessibilityLabel={`${STATUS_LABELS[status]} durum filtresi`}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: statusFilter === status ? '#BFDBFE' : palette.textSecondary }}>
                {STATUS_LABELS[status]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 12, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: palette.textSecondary }}>Siparisler yukleniyor...</Text>
        ) : visibleOrders.length === 0 ? (
          <View className="rounded-2xl border border-dashed px-4 py-10 items-center" style={{ borderColor: palette.border, backgroundColor: palette.surfaceBg }}>
            <Ionicons name="bag-handle-outline" size={28} color={colors.primary} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: palette.textPrimary, marginTop: 8 }}>
              {activeTab === 'buying' ? 'Henuz satin alim yok' : 'Henuz satis siparisi yok'}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary, marginTop: 4, textAlign: 'center' }}>
              {activeTab === 'buying'
                ? 'Verdigin siparisler burada gorunecek.'
                : 'Magazana gelen siparisler burada listelenecek.'}
            </Text>
          </View>
        ) : (
          visibleOrders.map((order) => {
            return (
              <View key={order.id} className="rounded-xl border p-3" style={{ borderColor: palette.cardBorder, backgroundColor: palette.surfaceBg }}>
                <View className="flex-row items-center justify-between">
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: palette.textPrimary }}>#{order.id.slice(0, 8)}</Text>
                  <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: palette.statusPillBg }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: palette.textSecondary }}>{STATUS_LABELS[order.status]}</Text>
                  </View>
                </View>

                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary, marginTop: 6 }}>
                  {formatDate(order.created_at)} • {formatCurrency(order.total)}
                </Text>

                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: palette.textPrimary, marginTop: 6 }}>
                  {activeTab === 'buying' ? 'Satici ile gorusme' : 'Alici ile gorusme'}
                </Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary, marginTop: 2 }} numberOfLines={2}>
                  {order.shipping_addr || 'Konum ve teslimat detayi mesajlasmada netlestirilir.'}
                </Text>

                {(order.order_items ?? []).length > 0 ? (
                  <View className="mt-3 rounded-lg px-2 py-2" style={{ backgroundColor: palette.inputBg }}>
                    {(order.order_items ?? []).slice(0, 3).map((item, index) => (
                      <Text key={`${order.id}-${item.listing_id}-${index}`} style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textSecondary, marginBottom: 2 }}>
                        {item.quantity}x {item.title}
                      </Text>
                    ))}
                    {(order.order_items ?? []).length > 3 ? (
                      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: palette.textSecondary }}>
                        + {(order.order_items ?? []).length - 3} kalem daha
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                <View className="flex-row mt-3" style={{ gap: 8 }}>
                  <Pressable
                    onPress={() => router.push(`/order/${order.id}` as any)}
                    className="px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: palette.statusPillBg }}
                    accessibilityRole="button"
                    accessibilityLabel="Siparis detayina git"
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: palette.textSecondary }}>
                      Detay
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => openOrderConversation(order)}
                    className="px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF' }}
                    accessibilityRole="button"
                    accessibilityLabel={activeTab === 'buying' ? 'Satici ile mesajlasma ac' : 'Alici ile mesajlasma ac'}
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary }}>
                      {activeTab === 'buying' ? 'Satici ile Konus' : 'Alici ile Konus'}
                    </Text>
                  </Pressable>

                  {activeTab === 'selling' && getSellerNextStatus(order.status) ? (
                    <Pressable
                      onPress={() => handleQuickSellerUpdate(order)}
                      className="px-3 py-1.5 rounded-lg"
                      style={{ backgroundColor: quickUpdatingOrderId === order.id ? '#BFDBFE' : colors.primary }}
                      accessibilityRole="button"
                      accessibilityLabel="Siparis durumunu bir sonraki asamaya guncelle"
                    >
                      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>
                        {quickUpdatingOrderId === order.id ? 'Guncelleniyor...' : 'Durum Ilerle'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })
        )}

        {error ? (
          <View className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2.5">
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: '#991B1B' }}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
