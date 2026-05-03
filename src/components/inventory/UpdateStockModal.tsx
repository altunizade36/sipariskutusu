import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../constants/theme';
import type { InventoryItem, StockUpdateInput } from '../../services/inventoryService';

type Props = {
  visible: boolean;
  item: InventoryItem | null;
  onClose: () => void;
  onSave: (input: StockUpdateInput) => Promise<void>;
};

export function UpdateStockModal({ visible, item, onClose, onSave }: Props) {
  const [stock, setStock] = useState('0');
  const [threshold, setThreshold] = useState('3');
  const [tracking, setTracking] = useState(false);
  const [visibleSwitch, setVisibleSwitch] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setStock(String(item.stock ?? 0));
      setThreshold(String(item.low_stock_threshold ?? 3));
      setTracking(Boolean(item.stock_tracking_enabled));
      setVisibleSwitch(item.is_visible !== false);
    }
  }, [item]);

  if (!item) return null;

  const initialDirty =
    String(item.stock) !== stock.trim() ||
    String(item.low_stock_threshold) !== threshold.trim() ||
    Boolean(item.stock_tracking_enabled) !== tracking ||
    (item.is_visible !== false) !== visibleSwitch;

  function handleClose() {
    if (initialDirty) {
      Alert.alert(
        'Kaydedilmemiş değişiklikler',
        'Yaptığın değişiklikler kaydedilmedi. Yine de kapatmak istiyor musun?',
        [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Kapat', style: 'destructive', onPress: onClose },
        ],
      );
    } else {
      onClose();
    }
  }

  async function handleSave() {
    if (!item) return;
    const stockNum = parseInt(stock.replace(/[^0-9]/g, ''), 10);
    const thresholdNum = parseInt(threshold.replace(/[^0-9]/g, ''), 10);

    const safeStock = Number.isFinite(stockNum) && stockNum >= 0 ? stockNum : 0;
    const safeThreshold = Number.isFinite(thresholdNum) && thresholdNum >= 0 ? thresholdNum : 3;

    setIsSaving(true);
    try {
      await onSave({
        stock: safeStock,
        low_stock_threshold: safeThreshold,
        stock_tracking_enabled: tracking,
        is_visible: visibleSwitch,
      });
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Stok güncellenirken bir sorun oluştu.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={{ flex: 1 }} onPress={handleClose} />
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              paddingHorizontal: 18,
              paddingTop: 16,
              paddingBottom: 22,
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB' }} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: colors.textPrimary }}>
                Stok Güncelle
              </Text>
              <Pressable
                onPress={handleClose}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}
                accessibilityRole="button"
                accessibilityLabel="Kapat"
              >
                <Ionicons name="close" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
              {item.title}
            </Text>

            <View style={{ marginTop: 16 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary, marginBottom: 6 }}>
                Mevcut stok adedi
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pressable
                  onPress={() => setStock((s) => String(Math.max(0, (parseInt(s, 10) || 0) - 1)))}
                  style={{ width: 40, height: 44, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}
                  accessibilityLabel="Azalt"
                >
                  <Ionicons name="remove" size={18} color={colors.textPrimary} />
                </Pressable>
                <TextInput
                  value={stock}
                  onChangeText={(v) => setStock(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: '#D1D5DB',
                    paddingHorizontal: 12,
                    textAlign: 'center',
                    fontFamily: fonts.bold,
                    fontSize: 16,
                    color: colors.textPrimary,
                  }}
                />
                <Pressable
                  onPress={() => setStock((s) => String((parseInt(s, 10) || 0) + 1))}
                  style={{ width: 40, height: 44, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}
                  accessibilityLabel="Arttır"
                >
                  <Ionicons name="add" size={18} color={colors.textPrimary} />
                </Pressable>
              </View>
            </View>

            <View style={{ marginTop: 14 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary, marginBottom: 6 }}>
                Az stok uyarı limiti
              </Text>
              <TextInput
                value={threshold}
                onChangeText={(v) => setThreshold(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="3"
                placeholderTextColor={colors.textMuted}
                style={{
                  height: 44,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#D1D5DB',
                  paddingHorizontal: 14,
                  fontFamily: fonts.medium,
                  fontSize: 14,
                  color: colors.textPrimary,
                }}
              />
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
                Stok bu sayıya düşerse "Az kaldı" uyarısı gösterilir.
              </Text>
            </View>

            <View
              style={{
                marginTop: 14,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>Stok takibi</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                  Kapalıysa ürün normal ilan gibi çalışır.
                </Text>
              </View>
              <Switch value={tracking} onValueChange={setTracking} />
            </View>

            <View
              style={{
                marginTop: 10,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>Satışta göster</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                  Kapalıysa ürün listede gizlenir.
                </Text>
              </View>
              <Switch value={visibleSwitch} onValueChange={setVisibleSwitch} />
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <Pressable
                onPress={handleClose}
                disabled={isSaving}
                style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>İptal</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                style={{
                  flex: 1.4,
                  height: 46,
                  borderRadius: 12,
                  backgroundColor: isSaving ? '#94B5E6' : colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                {isSaving ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="checkmark" size={16} color="#FFF" />}
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#FFF' }}>
                  {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
