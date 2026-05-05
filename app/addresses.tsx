import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../src/constants/theme';
import {
  deleteAddress,
  fetchMyAddresses,
  setDefaultAddress,
  upsertAddress,
  type AddressRow,
} from '../src/services/addressService';

type AddressFormState = {
  id?: string;
  title: string;
  full_name: string;
  phone: string;
  address_line: string;
  district: string;
  city: string;
  postal_code: string;
  is_default: boolean;
};

const initialFormState: AddressFormState = {
  title: '',
  full_name: '',
  phone: '',
  address_line: '',
  district: '',
  city: '',
  postal_code: '',
  is_default: false,
};

function mapAddressToForm(address: AddressRow): AddressFormState {
  return {
    id: address.id,
    title: address.title,
    full_name: address.full_name,
    phone: address.phone,
    address_line: address.address_line,
    district: address.district ?? '',
    city: address.city,
    postal_code: address.postal_code ?? '',
    is_default: address.is_default,
  };
}

export default function AddressesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<AddressFormState>(initialFormState);

  const canSave = useMemo(() => {
    return Boolean(
      form.title.trim() &&
      form.full_name.trim() &&
      form.phone.trim() &&
      form.address_line.trim() &&
      form.city.trim(),
    );
  }, [form.address_line, form.city, form.full_name, form.phone, form.title]);

  const loadAddresses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchMyAddresses();
      setAddresses(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Adresler yuklenemedi.';
      setError(message);
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  function openCreateModal() {
    setForm(initialFormState);
    setModalVisible(true);
  }

  function openEditModal(address: AddressRow) {
    setForm(mapAddressToForm(address));
    setModalVisible(true);
  }

  async function handleSave() {
    if (!canSave || saving) {
      if (!canSave) {
        Alert.alert('Eksik alan', 'Lutfen baslik, ad soyad, telefon, adres ve sehir alanlarini doldur.');
      }
      return;
    }

    setSaving(true);
    try {
      await upsertAddress({
        id: form.id,
        title: form.title.trim(),
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        address_line: form.address_line.trim(),
        district: form.district.trim() || undefined,
        city: form.city.trim(),
        postal_code: form.postal_code.trim() || undefined,
        is_default: form.is_default,
      });
      setModalVisible(false);
      await loadAddresses();
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Adres kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(addressId: string) {
    Alert.alert('Adresi sil', 'Bu adres kaydi kaldirilacak. Devam edilsin mi?', [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAddress(addressId);
            await loadAddresses();
          } catch (err) {
            Alert.alert('Hata', err instanceof Error ? err.message : 'Adres silinemedi.');
          }
        },
      },
    ]);
  }

  async function handleSetDefault(addressId: string) {
    try {
      await setDefaultAddress(addressId);
      await loadAddresses();
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Varsayilan adres guncellenemedi.');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
      <View className="bg-white px-3 py-2 border-b border-[#33333315] flex-row items-center">
        <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.textPrimary }} className="flex-1 ml-2">
          Adreslerim
        </Text>
        <Pressable onPress={openCreateModal} className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#EFF6FF' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }}>Yeni</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 12, gap: 10 }}>
        {loading ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>Adresler yukleniyor...</Text>
        ) : addresses.length === 0 ? (
          <View className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-4 py-10 items-center">
            <Ionicons name="location-outline" size={28} color={colors.primary} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, marginTop: 8 }}>Kayitli adres yok</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>
              Siparis adimlarinda hizli secim icin simdi bir adres ekleyebilirsin.
            </Text>
            <Pressable onPress={openCreateModal} className="mt-4 px-4 py-2 rounded-lg" style={{ backgroundColor: colors.primary }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>Ilk Adresi Ekle</Text>
            </Pressable>
          </View>
        ) : (
          addresses.map((address) => (
            <View key={address.id} className="rounded-xl border border-[#33333315] bg-white p-3">
              <View className="flex-row items-center justify-between">
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>
                  {address.title}
                </Text>
                {address.is_default ? (
                  <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: '#DBEAFE' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.primary }}>Varsayilan</Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textPrimary, marginTop: 6 }}>
                {address.full_name} • {address.phone}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 18 }}>
                {address.address_line}
                {address.district ? `, ${address.district}` : ''}
                {`, ${address.city}`}
                {address.postal_code ? ` ${address.postal_code}` : ''}
              </Text>
              <View className="flex-row mt-3" style={{ gap: 8 }}>
                {!address.is_default ? (
                  <Pressable onPress={() => handleSetDefault(address.id)} className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#EFF6FF' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary }}>Varsayilan Yap</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => openEditModal(address)} className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#F1F5F9' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.textPrimary }}>Duzenle</Text>
                </Pressable>
                <Pressable onPress={() => handleDelete(address.id)} className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#FEF2F2' }}>
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
          <View className="bg-white rounded-t-3xl p-4" style={{ maxHeight: '86%' }}>
            <View className="flex-row items-center justify-between mb-3">
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: colors.textPrimary }}>
                {form.id ? 'Adresi Duzenle' : 'Yeni Adres'}
              </Text>
              <Pressable onPress={() => setModalVisible(false)} className="w-8 h-8 rounded-full items-center justify-center bg-[#F1F5F9]">
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              {[
                { key: 'title', label: 'Adres Basligi', placeholder: 'Ev, Is, Depo...' },
                { key: 'full_name', label: 'Ad Soyad', placeholder: 'Tam adin' },
                { key: 'phone', label: 'Telefon', placeholder: '05xx xxx xx xx' },
                { key: 'address_line', label: 'Acik Adres', placeholder: 'Mahalle, sokak, bina no' },
                { key: 'district', label: 'Ilce', placeholder: 'Ilce' },
                { key: 'city', label: 'Sehir', placeholder: 'Sehir' },
                { key: 'postal_code', label: 'Posta Kodu', placeholder: '34000' },
              ].map((field) => (
                <View key={field.key} className="mb-3">
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>{field.label}</Text>
                  <TextInput
                    value={String(form[field.key as keyof AddressFormState] ?? '')}
                    onChangeText={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        [field.key]: value,
                      }))
                    }
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.textMuted}
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
                    multiline={field.key === 'address_line'}
                    numberOfLines={field.key === 'address_line' ? 3 : 1}
                  />
                </View>
              ))}

              <Pressable
                onPress={() => setForm((prev) => ({ ...prev, is_default: !prev.is_default }))}
                className="mb-3 rounded-xl border px-3 py-3"
                style={{ borderColor: form.is_default ? '#93C5FD' : '#E2E8F0', backgroundColor: form.is_default ? '#EFF6FF' : '#FFF' }}
              >
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: form.is_default ? colors.primary : colors.textPrimary }}>
                  {form.is_default ? 'Bu adres varsayilan olacak' : 'Varsayilan adres olarak isaretle'}
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
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>
                  {saving ? 'Kaydediliyor...' : form.id ? 'Guncelle' : 'Kaydet'}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
