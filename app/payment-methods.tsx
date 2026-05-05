import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../src/constants/theme';
import {
  createPaymentMethod,
  deletePaymentMethod,
  fetchMyPaymentMethods,
  setDefaultPaymentMethod,
  type PaymentMethodRow,
} from '../src/services/paymentMethodService';

type PaymentType = PaymentMethodRow['type'];

const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  card: 'Kart',
  wallet: 'Dijital Cuzdan',
  bank_transfer: 'Banka Havalesi',
  cash_on_delivery: 'Kapida Odeme',
};

const PAYMENT_TYPES: PaymentType[] = ['card', 'wallet', 'bank_transfer', 'cash_on_delivery'];

type PaymentFormState = {
  provider: PaymentMethodRow['provider'];
  type: PaymentType;
  title: string;
  note: string;
  is_default: boolean;
};

const initialForm: PaymentFormState = {
  provider: 'stripe',
  type: 'card',
  title: '',
  note: '',
  is_default: false,
};

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const [methods, setMethods] = useState<PaymentMethodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<PaymentFormState>(initialForm);

  const canSave = useMemo(() => Boolean(form.title.trim()), [form.title]);

  const loadMethods = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchMyPaymentMethods();
      setMethods(rows);
    } catch (err) {
      setMethods([]);
      setError(err instanceof Error ? err.message : 'Odeme yontemleri yuklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMethods();
  }, [loadMethods]);

  function openCreateModal() {
    setForm(initialForm);
    setModalVisible(true);
  }

  async function handleSave() {
    if (saving) {
      return;
    }

    if (!canSave) {
      Alert.alert('Eksik bilgi', 'Lutfen tercih basligini gir.');
      return;
    }

    setSaving(true);
    try {
      await createPaymentMethod({
        provider: form.provider,
        type: form.type,
        brand: form.title.trim() || undefined,
        holder_name: form.note.trim() || undefined,
        is_default: form.is_default,
      });
      setModalVisible(false);
      await loadMethods();
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Odeme yontemi eklenemedi.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await setDefaultPaymentMethod(id);
      await loadMethods();
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Varsayilan odeme yontemi guncellenemedi.');
    }
  }

  function handleDelete(id: string) {
    Alert.alert('Odeme yontemini sil', 'Bu kayit kaldirilacak. Devam edilsin mi?', [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePaymentMethod(id);
            await loadMethods();
          } catch (err) {
            Alert.alert('Hata', err instanceof Error ? err.message : 'Kayit silinemedi.');
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
      <View className="bg-white px-3 py-2 border-b border-[#33333315] flex-row items-center">
        <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.textPrimary }} className="flex-1 ml-2">
          Odeme Tercihleri
        </Text>
        <Pressable onPress={openCreateModal} className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#EFF6FF' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }}>Yeni</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 12, gap: 10 }}>
        {loading ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>Odeme tercihleri yukleniyor...</Text>
        ) : methods.length === 0 ? (
          <View className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-4 py-10 items-center">
            <Ionicons name="card-outline" size={28} color={colors.primary} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, marginTop: 8 }}>Kayitli odeme tercihi yok</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>
              Platform odeme almaz. Sadece alici-satici arasinda konusurken kullanmak icin tercih kaydi ekleyebilirsin.
            </Text>
            <Pressable onPress={openCreateModal} className="mt-4 px-4 py-2 rounded-lg" style={{ backgroundColor: colors.primary }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>Ilk Tercihi Ekle</Text>
            </Pressable>
          </View>
        ) : (
          methods.map((method) => (
            <View key={method.id} className="rounded-xl border border-[#33333315] bg-white p-3">
              <View className="flex-row items-center justify-between">
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>
                  {PAYMENT_TYPE_LABELS[method.type]}
                </Text>
                {method.is_default ? (
                  <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: '#DBEAFE' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.primary }}>Varsayilan</Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textPrimary, marginTop: 6 }}>
                {method.brand || 'Genel Tercih'}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                {method.holder_name || `${PAYMENT_TYPE_LABELS[method.type]} olarak not edilmis.`}
              </Text>
              <View className="flex-row mt-3" style={{ gap: 8 }}>
                {!method.is_default ? (
                  <Pressable onPress={() => handleSetDefault(method.id)} className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#EFF6FF' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary }}>Varsayilan Yap</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => handleDelete(method.id)} className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#FEF2F2' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#B91C1C' }}>Sil</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        {error ? (
          <View className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2.5">
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: '#991B1B' }}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: '#00000066' }}>
          <View className="bg-white rounded-t-3xl p-4" style={{ maxHeight: '82%' }}>
            <View className="flex-row items-center justify-between mb-3">
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: colors.textPrimary }}>Yeni Odeme Tercihi</Text>
              <Pressable onPress={() => setModalVisible(false)} className="w-8 h-8 rounded-full items-center justify-center bg-[#F1F5F9]">
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <View className="mb-3">
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Yontem Turu</Text>
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {PAYMENT_TYPES.map((type) => {
                    const active = form.type === type;
                    return (
                      <Pressable
                        key={type}
                        onPress={() => setForm((prev) => ({ ...prev, type }))}
                        className="px-3 py-2 rounded-lg"
                        style={{ backgroundColor: active ? '#DBEAFE' : '#F1F5F9' }}
                      >
                        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: active ? colors.primary : colors.textSecondary }}>
                          {PAYMENT_TYPE_LABELS[type]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {[
                { key: 'title', label: 'Tercih Basligi', placeholder: 'Orn. Kapida Nakit veya Havale' },
                { key: 'note', label: 'Ek Not (Opsiyonel)', placeholder: 'Hesap sahibi, aciklama, uzlasma detayi...' },
              ].map((field) => (
                <View key={field.key} className="mb-3">
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>{field.label}</Text>
                  <TextInput
                    value={String(form[field.key as keyof PaymentFormState] ?? '')}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, [field.key]: value }))}
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.textMuted}
                    maxLength={field.key === 'title' ? 60 : 160}
                    style={{
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      fontFamily: fonts.regular,
                      fontSize: 13,
                      color: colors.textPrimary,
                      backgroundColor: '#F8FAFC',
                    }}
                  />
                </View>
              ))}

              <View className="mb-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2.5">
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.primary }}>
                  Guvenlik notu: Platform kart veya odeme tahsilati yapmaz. Buradaki kayitlar sadece alici-satici gorusmesini hizlandirmak icin kullanilir.
                </Text>
              </View>

              <Pressable
                onPress={() => setForm((prev) => ({ ...prev, is_default: !prev.is_default }))}
                className="mb-3 rounded-xl border px-3 py-3"
                style={{ borderColor: form.is_default ? '#93C5FD' : '#E2E8F0', backgroundColor: form.is_default ? '#EFF6FF' : '#FFF' }}
              >
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: form.is_default ? colors.primary : colors.textPrimary }}>
                  {form.is_default ? 'Bu yontem varsayilan olacak' : 'Varsayilan odeme yontemi yap'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSave}
                style={{
                  height: 46,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: canSave && !saving ? colors.primary : '#CBD5E1',
                }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{saving ? 'Ekleniyor...' : 'Kaydet'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
