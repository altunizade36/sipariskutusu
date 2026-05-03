import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  ToastAndroid,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import {
  classifyStock,
  computeInventoryStats,
  fetchMyInventory,
  updateListingStock,
  type InventoryItem,
  type InventoryStats,
  type StockUpdateInput,
} from '../src/services/inventoryService';
import { InventoryStatsCard } from '../src/components/inventory/InventoryStatsCard';
import { InventoryProductCard } from '../src/components/inventory/InventoryProductCard';
import { UpdateStockModal } from '../src/components/inventory/UpdateStockModal';
import { captureError } from '../src/services/monitoring';

type Filter = 'all' | 'in_stock' | 'low_stock' | 'sold_out';

const FILTER_OPTIONS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'Tümü' },
  { key: 'in_stock', label: 'Stokta Var' },
  { key: 'low_stock', label: 'Az Kaldı' },
  { key: 'sold_out', label: 'Tükendi' },
];

function showToast(message: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert(message);
  }
}

export default function InventoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [activeItem, setActiveItem] = useState<InventoryItem | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!user?.id) {
        setItems([]);
        setIsLoading(false);
        return;
      }
      if (mode === 'initial') setIsLoading(true);
      else setIsRefreshing(true);
      try {
        const data = await fetchMyInventory(user.id);
        setItems(data);
        setErrorMessage(null);
      } catch (err) {
        captureError(err instanceof Error ? err : new Error(String(err)), { scope: 'inventory.load' });
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Envanter yüklenirken bir sorun oluştu. İnternet bağlantını kontrol et.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user?.id]
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  const stats: InventoryStats = useMemo(() => computeInventoryStats(items), [items]);

  const filteredItems = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase('tr-TR');
    return items.filter((item) => {
      if (query && !item.title.toLocaleLowerCase('tr-TR').includes(query)) return false;
      if (filter === 'all') return true;
      const status = classifyStock(item);
      if (filter === 'in_stock') return status === 'in_stock';
      return status === filter;
    });
  }, [items, searchText, filter]);

  const handleSaveStock = useCallback(
    async (input: StockUpdateInput) => {
      if (!user?.id || !activeItem) return;
      try {
        const updated = await updateListingStock(user.id, activeItem.id, input);
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        setActiveItem(null);
        showToast('Stok güncellendi.');
      } catch (err) {
        captureError(err instanceof Error ? err : new Error(String(err)), { scope: 'inventory.update' });
        throw err;
      }
    },
    [user?.id, activeItem]
  );

  const filterCounts: Record<Filter, number> = useMemo(
    () => ({
      all: items.length,
      in_stock: stats.inStock,
      low_stock: stats.lowStock,
      sold_out: stats.soldOut,
    }),
    [items.length, stats.inStock, stats.untracked, stats.lowStock, stats.soldOut]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 0.5,
          borderBottomColor: '#E5E7EB',
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Geri"
        >
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.textPrimary }}>Stok Yönetimi</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
            Ürünlerinin kalan adetlerini takip et, düşük stok uyarılarını gör.
          </Text>
        </View>
      </View>

      {/* Stats */}
      <InventoryStatsCard stats={stats} />

      {/* Quick alerts */}
      {stats.lowStock + stats.soldOut > 0 ? (
        <View style={{ paddingHorizontal: 12, paddingTop: 4 }}>
          <View
            style={{
              backgroundColor: '#FFF7ED',
              borderColor: '#FED7AA',
              borderWidth: 1,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Ionicons name="alert-circle" size={18} color="#C2410C" />
            <View style={{ flex: 1 }}>
              {stats.lowStock > 0 ? (
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: '#9A3412' }}>
                  {stats.lowStock} ürünün stoğu azaldı
                </Text>
              ) : null}
              {stats.soldOut > 0 ? (
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: '#B91C1C', marginTop: stats.lowStock > 0 ? 2 : 0 }}>
                  {stats.soldOut} ürün tükendi
                </Text>
              ) : null}
              {stats.updatedToday > 0 ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                  Bugün güncellenen stoklar: {stats.updatedToday}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}

      {/* Search */}
      <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            height: 42,
            borderRadius: 12,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E5E7EB',
            paddingHorizontal: 12,
          }}
        >
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Ürün adıyla ara"
            placeholderTextColor={colors.textMuted}
            style={{ flex: 1, marginLeft: 8, fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary }}
            accessibilityLabel="Stok ara"
          />
          {searchText ? (
            <Pressable onPress={() => setSearchText('')} style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
      >
        {FILTER_OPTIONS.map((opt) => {
          const active = filter === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setFilter(opt.key)}
              style={{
                paddingHorizontal: 12,
                height: 32,
                borderRadius: 16,
                backgroundColor: active ? colors.primary : '#FFFFFF',
                borderWidth: 1,
                borderColor: active ? colors.primary : '#E5E7EB',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 6,
              }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: active ? '#FFF' : colors.textPrimary }}>
                {opt.label}
              </Text>
              <View
                style={{
                  minWidth: 22,
                  paddingHorizontal: 5,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: active ? '#FFFFFF22' : '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: active ? '#FFF' : colors.textSecondary }}>
                  {filterCounts[opt.key]}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* List */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 10, fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted }}>
            Envanter yükleniyor...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 30 }}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => load('refresh')} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <InventoryProductCard
              item={item}
              onPressEdit={() => setActiveItem(item)}
              onPressGoTo={() => router.push(`/product/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 }}>
              <Ionicons name="cube-outline" size={36} color={colors.textMuted} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, marginTop: 10, textAlign: 'center' }}>
                {errorMessage ? 'Envanter yüklenemedi' : items.length === 0 ? 'Henüz ürünün yok' : 'Sonuç bulunamadı'}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: 'center' }}>
                {errorMessage
                  ? errorMessage
                  : items.length === 0
                  ? 'İlan ver / ürün ekle ekranından ilk ürününü oluşturabilirsin.'
                  : 'Farklı bir arama veya filtre dene.'}
              </Text>
              {items.length === 0 && !errorMessage ? (
                <Pressable
                  onPress={() => router.push('/create-listing')}
                  style={{
                    marginTop: 14,
                    paddingHorizontal: 16,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#FFF' }}>İlk Ürünü Ekle</Text>
                </Pressable>
              ) : null}
            </View>
          }
        />
      )}

      <UpdateStockModal
        visible={Boolean(activeItem)}
        item={activeItem}
        onClose={() => setActiveItem(null)}
        onSave={handleSaveStock}
      />
    </SafeAreaView>
  );
}
