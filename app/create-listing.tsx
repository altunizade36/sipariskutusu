import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import { useListings } from '../src/context/ListingsContext';
import { getCategoryTree } from '../src/catalog';
import { TR_CITIES } from '../src/constants/tr-cities';
import { pickImageFromLibrary } from '../src/utils/imagePicker';
import { submitListingToSupabase } from '../src/services/listingService';
import { isSupabaseConfigured } from '../src/services/supabase';

type Condition = 'Yeni' | 'Az kullanılmış' | 'İkinci el' | 'Hasarlı';
type Delivery = 'Kargo' | 'Elden' | 'Görüşülür';

const CONDITIONS: Condition[] = ['Yeni', 'Az kullanılmış', 'İkinci el', 'Hasarlı'];
const DELIVERY_OPTIONS: Delivery[] = ['Kargo', 'Elden', 'Görüşülür'];
const MAX_PHOTOS = 5;

const ROOT_CATEGORIES = getCategoryTree();
const CITY_LIST = Object.keys(TR_CITIES).sort((a, b) => a.localeCompare(b, 'tr-TR'));

export default function CreateListingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { addListing } = useListings();

  const [photos, setPhotos] = useState<string[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<Condition>('Yeni');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [bargaining, setBargaining] = useState(false);
  const [delivery, setDelivery] = useState<Delivery[]>(['Kargo']);
  const [city, setCity] = useState('');
  const [cityModal, setCityModal] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedCategory = useMemo(
    () => ROOT_CATEGORIES.find((c) => c.id === categoryId),
    [categoryId],
  );
  const sellerName = String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Misafir');
  const sellerAvatar = typeof user?.user_metadata?.avatar_url === 'string'
    ? user.user_metadata.avatar_url
    : typeof user?.user_metadata?.picture === 'string'
      ? user.user_metadata.picture
      : '';

  const priceNumber = Number(price.replace(',', '.'));
  const priceValid = Number.isFinite(priceNumber) && priceNumber > 0;

  const missing: string[] = [];
  if (photos.length === 0) missing.push('Fotoğraf');
  if (!title.trim()) missing.push('Başlık');
  if (!categoryId) missing.push('Kategori');
  if (!priceValid) missing.push('Fiyat');
  if (delivery.length === 0) missing.push('Teslimat');
  if (!city) missing.push('Şehir');

  const canPublish = missing.length === 0 && !submitting;

  const coverUri = photos[coverIndex] ?? photos[0];

  const handleAddPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit', `En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsin.`);
      return;
    }
    try {
      const uri = await pickImageFromLibrary();
      if (uri) {
        setPhotos((prev) => [...prev, uri]);
      }
    } catch (err: any) {
      Alert.alert('Hata', err?.message ?? 'Fotoğraf eklenemedi.');
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (coverIndex >= next.length) setCoverIndex(0);
      else if (index === coverIndex) setCoverIndex(0);
      else if (index < coverIndex) setCoverIndex((c) => Math.max(0, c - 1));
      return next;
    });
  };

  const toggleDelivery = (d: Delivery) => {
    setDelivery((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const handlePublish = async () => {
    if (!user) {
      Alert.alert('Giriş gerekli', 'İlan yayınlamak için giriş yap.');
      router.push('/auth');
      return;
    }
    if (!canPublish) return;

    setSubmitting(true);
    try {
      if (isSupabaseConfigured) {
        const created = await submitListingToSupabase({
          title: title.trim(),
          description: description.trim(),
          price: priceNumber,
          categoryId: selectedCategory?.id ?? '',
          condition,
          delivery,
          city,
          district: '',
          imageUris: photos,
          coverIndex,
          negotiable: bargaining,
          stock: 1,
        });

        Alert.alert('Yayınlandı', 'İlanın Supabase\'e kaydedildi.', [
          { text: 'Tamam', onPress: () => router.replace(`/product/${created.id}`) },
        ]);
      } else {
        // Fallback: use local context
        const orderedMedia = coverIndex > 0
          ? [photos[coverIndex], ...photos.filter((_, i) => i !== coverIndex)]
          : photos;

        const created = addListing({
          title: title.trim(),
          description: description.trim(),
          price: priceNumber,
          categoryId: selectedCategory?.id ?? '',
          condition,
          location: city,
          district: '',
          delivery,
          imageUri: orderedMedia[0],
          mediaUris: orderedMedia,
          stock: 1,
          attributes: bargaining ? [{ label: 'Pazarlık', value: 'Var' }] : [],
        });

        Alert.alert('Yayınlandı', 'İlanın yayınlandı.', [
          { text: 'Tamam', onPress: () => router.replace(`/product/${created.id}`) },
        ]);
      }
    } catch (err: any) {
      Alert.alert('Hata', err?.message ?? 'İlan yayınlanamadı.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 h-12 bg-white border-b border-[#33333315]">
        <Pressable onPress={() => router.back()} className="w-10 h-10 items-center justify-center -ml-2">
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.textPrimary }}>
          İlan Ver
        </Text>
        <View className="w-10" />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 160 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 1. FOTOĞRAFLAR */}
          <Section title="Fotoğraflar" hint={`${photos.length}/${MAX_PHOTOS} · En az 1 gerekli`}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
              <View className="flex-row gap-2 px-1">
                {photos.map((uri, idx) => {
                  const isCover = idx === coverIndex;
                  return (
                    <View key={uri + idx} className="relative">
                      <Pressable onPress={() => setCoverIndex(idx)}>
                        <Image
                          source={{ uri }}
                          style={{ width: 96, height: 96, borderRadius: 12 }}
                        />
                        {isCover ? (
                          <View
                            style={{ position: 'absolute', inset: 0, borderRadius: 12, borderWidth: 2, borderColor: colors.primary }}
                          />
                        ) : null}
                        <View
                          style={{
                            position: 'absolute',
                            left: 4,
                            bottom: 4,
                            backgroundColor: isCover ? colors.primary : 'rgba(0,0,0,0.55)',
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff' }}>
                            {isCover ? 'KAPAK' : 'Kapak yap'}
                          </Text>
                        </View>
                      </Pressable>
                      <Pressable
                        onPress={() => handleRemovePhoto(idx)}
                        style={{
                          position: 'absolute',
                          top: -6,
                          right: -6,
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: colors.danger,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="close" size={14} color="#fff" />
                      </Pressable>
                    </View>
                  );
                })}
                {photos.length < MAX_PHOTOS ? (
                  <Pressable
                    onPress={handleAddPhoto}
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: colors.primary,
                      borderStyle: 'dashed',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#EFF6FF',
                    }}
                  >
                    <Ionicons name="camera" size={22} color={colors.primary} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary, marginTop: 4 }}>
                      Ekle
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </ScrollView>
            {photos.length === 0 ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 8 }}>
                Fotoğraf olmadan ilan yayınlanamaz.
              </Text>
            ) : null}
          </Section>

          {/* 2. ÜRÜN BİLGİSİ */}
          <Section title="Ürün Bilgisi">
            <Field label="Başlık" required>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Örn. Az kullanılmış iPhone 13"
                placeholderTextColor={colors.textMuted}
                maxLength={80}
                style={inputStyle}
              />
            </Field>
            <Field label="Açıklama">
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Ürünün durumu, detayları..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                maxLength={500}
                style={[inputStyle, { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }]}
              />
            </Field>
            <Field label="Durum" required>
              <View className="flex-row flex-wrap gap-2">
                {CONDITIONS.map((c) => {
                  const active = condition === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setCondition(c)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: active ? colors.primary : '#E2E8F0',
                        backgroundColor: active ? '#EFF6FF' : '#fff',
                      }}
                    >
                      <Text style={{ fontFamily: active ? fonts.bold : fonts.medium, fontSize: 12, color: active ? colors.primary : colors.textPrimary }}>
                        {c}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>
          </Section>

          {/* 3. KATEGORİ */}
          <Section title="Kategori">
            <Pressable
              onPress={() => setCategoryModal(true)}
              style={selectorStyle}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: selectedCategory ? colors.textPrimary : colors.textMuted }}>
                {selectedCategory?.name ?? 'Ana kategori seç'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </Section>

          {/* 4. FİYAT */}
          <Section title="Fiyat">
            <Field label="Fiyat (₺)" required>
              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                style={inputStyle}
              />
            </Field>
            <View className="flex-row items-center justify-between mt-2">
              <View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>
                  Pazarlık yapılabilir
                </Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                  Alıcılar fiyat üzerinde konuşabilir
                </Text>
              </View>
              <Switch
                value={bargaining}
                onValueChange={setBargaining}
                trackColor={{ false: '#E2E8F0', true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </Section>

          {/* 5. TESLİMAT */}
          <Section title="Teslimat">
            <View className="flex-row flex-wrap gap-2">
              {DELIVERY_OPTIONS.map((d) => {
                const active = delivery.includes(d);
                return (
                  <Pressable
                    key={d}
                    onPress={() => toggleDelivery(d)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : '#E2E8F0',
                      backgroundColor: active ? '#EFF6FF' : '#fff',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Ionicons
                      name={d === 'Kargo' ? 'cube-outline' : d === 'Elden' ? 'walk-outline' : 'chatbubble-ellipses-outline'}
                      size={14}
                      color={active ? colors.primary : colors.textSecondary}
                    />
                    <Text style={{ fontFamily: active ? fonts.bold : fonts.medium, fontSize: 12, color: active ? colors.primary : colors.textPrimary }}>
                      {d}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Field label="Şehir" required>
              <Pressable onPress={() => setCityModal(true)} style={selectorStyle}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: city ? colors.textPrimary : colors.textMuted }}>
                  {city || 'Şehir seç'}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            </Field>
          </Section>

          {/* 6. SATICI */}
          <Section title="Satıcı">
            <View className="flex-row items-center gap-3 bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0]">
              <View className="w-10 h-10 rounded-full bg-[#EFF6FF] items-center justify-center">
                {sellerAvatar ? (
                  <Image source={{ uri: sellerAvatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                ) : (
                  <Ionicons name="person" size={20} color={colors.primary} />
                )}
              </View>
              <View className="flex-1">
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>
                  {sellerName}
                </Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                  Hesap bilgisi otomatik eklenir
                </Text>
              </View>
              <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
            </View>
          </Section>

          {/* 7. ÖNİZLEME */}
          <Section title="Önizleme">
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: '#fff',
                borderRadius: 14,
                padding: 10,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 10,
                  backgroundColor: '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {coverUri ? (
                  <Image source={{ uri: coverUri }} style={{ width: 88, height: 88 }} />
                ) : (
                  <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                )}
              </View>
              <View className="flex-1 justify-between py-1">
                <Text
                  numberOfLines={2}
                  style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}
                >
                  {title.trim() || 'İlan başlığın burada görünür'}
                </Text>
                <View>
                  <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: colors.primary }}>
                    {priceValid ? `₺${priceNumber.toLocaleString('tr-TR')}` : '₺—'}
                  </Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                    {city || 'Şehir'} · {condition}
                  </Text>
                </View>
              </View>
            </View>
          </Section>
        </ScrollView>

        {/* ALT SABİT BUTON */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#fff',
            borderTopWidth: 1,
            borderTopColor: '#E2E8F0',
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: Platform.OS === 'ios' ? 28 : 14,
          }}
        >
          {missing.length > 0 ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginBottom: 8 }}>
              Eksik: {missing.join(', ')}
            </Text>
          ) : null}
          <Pressable
            onPress={handlePublish}
            disabled={!canPublish}
            style={{
              height: 52,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: canPublish ? colors.primary : '#CBD5E1',
            }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>
              {submitting ? 'Yayınlanıyor...' : 'İlanı Yayınla'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* KATEGORİ MODAL */}
      <PickerModal
        visible={categoryModal}
        onClose={() => setCategoryModal(false)}
        title="Ana Kategori"
      >
        {ROOT_CATEGORIES.map((c) => {
          const active = c.id === categoryId;
          return (
            <Pressable
              key={c.id}
              onPress={() => {
                setCategoryId(c.id);
                setCategoryModal(false);
              }}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottomWidth: 1,
                borderBottomColor: '#F1F5F9',
              }}
            >
              <Text style={{ fontFamily: active ? fonts.bold : fonts.medium, fontSize: 14, color: active ? colors.primary : colors.textPrimary }}>
                {c.name}
              </Text>
              {active ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </PickerModal>

      {/* ŞEHİR MODAL */}
      <PickerModal
        visible={cityModal}
        onClose={() => setCityModal(false)}
        title="Şehir"
      >
        {CITY_LIST.map((c) => {
          const active = c === city;
          return (
            <Pressable
              key={c}
              onPress={() => {
                setCity(c);
                setCityModal(false);
              }}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 13,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottomWidth: 1,
                borderBottomColor: '#F1F5F9',
              }}
            >
              <Text style={{ fontFamily: active ? fonts.bold : fonts.medium, fontSize: 14, color: active ? colors.primary : colors.textPrimary }}>
                {c}
              </Text>
              {active ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </PickerModal>
    </SafeAreaView>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View className="mx-4 mt-3 bg-white rounded-2xl p-4 border border-[#33333315]">
      <View className="flex-row items-center justify-between mb-3">
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{title}</Text>
        {hint ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted }}>{hint}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <View className="mb-3">
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>
        {label} {required ? <Text style={{ color: colors.danger }}>*</Text> : null}
      </Text>
      {children}
    </View>
  );
}

function PickerModal({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: '80%',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: '#F1F5F9',
            }}
          >
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: colors.textPrimary }}>{title}</Text>
            <Pressable onPress={onClose} className="w-9 h-9 items-center justify-center -mr-2">
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </Pressable>
          </View>
          <ScrollView>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const inputStyle = {
  backgroundColor: '#F8FAFC',
  borderWidth: 1,
  borderColor: '#E2E8F0',
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontFamily: fonts.regular,
  fontSize: 14,
  color: colors.textPrimary,
} as const;

const selectorStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: '#F8FAFC',
  borderWidth: 1,
  borderColor: '#E2E8F0',
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 12,
} as const;
