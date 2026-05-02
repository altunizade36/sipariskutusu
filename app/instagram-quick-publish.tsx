import { useState } from 'react';
import {
  View, Text, Pressable, ScrollView, Image, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, fonts } from '../src/constants/theme';
import { submitListingToSupabase } from '../src/services/listingService';
import { useAuth } from '../src/context/AuthContext';
import { type ParsedProductDraft } from '../src/services/instagramService';
import { MARKETPLACE_CATEGORIES } from '../src/constants/marketplaceCategories';

export default function InstagramQuickPublishScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    postId?: string;
    mediaUrl?: string;
    caption?: string;
    draft?: string;
  }>();

  const initialDraft: ParsedProductDraft = params.draft
    ? JSON.parse(params.draft)
    : { title: '', price: null, categoryId: null, categoryName: null, subCategoryId: null, subCategoryName: null, description: params.caption ?? '', sizes: '', colors: '', city: null, stockStatus: null, deliveryType: null, confidence: 0, missingFields: [] };

  const [draft, setDraft] = useState<ParsedProductDraft>(initialDraft);
  const [title, setTitle] = useState(initialDraft.title);
  const [price, setPrice] = useState(initialDraft.price ? String(initialDraft.price) : '');
  const [description, setDescription] = useState(initialDraft.description);
  const [sizes, setSizes] = useState(initialDraft.sizes);
  const [colors_, setColors] = useState(initialDraft.colors);
  const [city, setCity] = useState(initialDraft.city ?? '');
  const [publishing, setPublishing] = useState(false);

  const mediaUrl = params.mediaUrl ?? '';

  const missingNow: string[] = [];
  if (!title.trim() || title.trim().length < 3) missingNow.push('Ürün adı eksik');
  if (!price || isNaN(Number(price)) || Number(price) <= 0) missingNow.push('Fiyat eksik');
  if (!draft.categoryId) missingNow.push('Kategori seçilmeli');

  async function handlePublish() {
    if (missingNow.length > 0) {
      Alert.alert('Eksik Bilgi', missingNow.join('\n'));
      return;
    }
    setPublishing(true);
    try {
      const descFull = [
        description.trim(),
        sizes.trim() ? `Beden: ${sizes.trim()}` : '',
        colors_.trim() ? `Renk: ${colors_.trim()}` : '',
      ].filter(Boolean).join('\n');

      await submitListingToSupabase({
        title: title.trim(),
        description: descFull || description.trim(),
        price: Number(price),
        categoryId: draft.categoryId ?? '',
        subCategoryId: draft.subCategoryId ?? undefined,
        customSubCategory: undefined,
        condition: 'Yeni',
        delivery: [draft.deliveryType ?? 'Kargo'],
        city: city || 'İstanbul',
        district: '',
        neighborhood: '',
        imageUris: [mediaUrl],
        coverIndex: 0,
        negotiable: false,
        stock: 1,
        sourceType: 'instagram_import',
      });
      Alert.alert('Yayınlandı! 🎉', 'İlan başarıyla yayınlandı.', [
        { text: 'Tamam', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Hata', err?.message ?? 'İlan yayınlanamadı, lütfen tekrar dene.');
    } finally {
      setPublishing(false);
    }
  }

  function handleDetailedEdit() {
    router.push({
      pathname: '/create-listing',
      params: {
        prefillTitle: title,
        prefillPrice: price,
        prefillDescription: description,
        prefillCategoryId: draft.categoryId ?? '',
        prefillImages: mediaUrl,
      },
    } as never);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#33333315' }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 10 }}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.textPrimary }}>Hızlı Yayınla</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>Instagram'dan otomatik taslak</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: draft.confidence >= 70 ? '#DCFCE7' : '#FFF5F5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
          <Ionicons name="flash" size={12} color={draft.confidence >= 70 ? '#16A34A' : colors.danger} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: draft.confidence >= 70 ? '#16A34A' : colors.danger }}>%{draft.confidence}</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
          {/* Media Preview */}
          <View style={{ borderRadius: 18, overflow: 'hidden', height: 220 }}>
            <Image source={{ uri: mediaUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            <View style={{ position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="logo-instagram" size={13} color="#fff" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>Instagram İçeriği</Text>
            </View>
          </View>

          {/* Missing Fields Alert */}
          {missingNow.length > 0 && (
            <View style={{ backgroundColor: '#FFF5F5', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#FECACA' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Ionicons name="warning-outline" size={16} color={colors.danger} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.danger }}>Eksik Bilgiler</Text>
              </View>
              {missingNow.map((f) => (
                <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.danger }} />
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.danger }}>{f}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Auto-parsed info */}
          <View style={{ backgroundColor: '#EFF6FF', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary, flex: 1 }}>
              Caption'dan otomatik analiz edildi. Eksik alanları düzenle ve yayınla.
            </Text>
          </View>

          {/* Form Fields */}
          <Field
            label="Ürün Adı"
            required
            missing={!title.trim() || title.trim().length < 3}
          >
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Ürün adını girin"
              placeholderTextColor="#94A3B8"
              style={inputStyle}
            />
          </Field>

          <Field
            label="Fiyat (₺)"
            required
            missing={!price || isNaN(Number(price)) || Number(price) <= 0}
          >
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder="0"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              style={inputStyle}
            />
          </Field>

          <Field
            label="Kategori"
            required
            missing={!draft.categoryId}
          >
            {draft.categoryId ? (
              <View style={{ ...inputContainerStyle, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary }}>
                  {draft.categoryName} {draft.subCategoryName ? `› ${draft.subCategoryName}` : ''}
                </Text>
                <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {MARKETPLACE_CATEGORIES.slice(0, 6).map((cat) => (
                    <Pressable
                      key={cat.id}
                      onPress={() => setDraft((prev) => ({ ...prev, categoryId: cat.id, categoryName: cat.name }))}
                      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', flexDirection: 'row', alignItems: 'center', gap: 5 }}
                    >
                      <Text>{cat.icon}</Text>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textPrimary }}>{cat.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}
          </Field>

          <Field label="Açıklama">
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Ürün açıklaması"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              style={{ ...inputStyle, height: 80, textAlignVertical: 'top' }}
            />
          </Field>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Beden / Ölçü">
                <TextInput
                  value={sizes}
                  onChangeText={setSizes}
                  placeholder="S, M, L, XL..."
                  placeholderTextColor="#94A3B8"
                  style={inputStyle}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Renk">
                <TextInput
                  value={colors_}
                  onChangeText={setColors}
                  placeholder="Siyah, Beyaz..."
                  placeholderTextColor="#94A3B8"
                  style={inputStyle}
                />
              </Field>
            </View>
          </View>

          <Field label="Şehir">
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="İstanbul, Ankara..."
              placeholderTextColor="#94A3B8"
              style={inputStyle}
            />
          </Field>

          {/* Action Buttons */}
          <Pressable
            onPress={handlePublish}
            disabled={publishing || missingNow.length > 0}
            style={{
              backgroundColor: missingNow.length > 0 ? '#CBD5E1' : colors.primary,
              borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {publishing ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="rocket-outline" size={20} color="#fff" />}
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>
              {publishing ? 'Yayınlanıyor...' : 'Yayınla'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleDetailedEdit}
            style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#E2E8F0' }}
          >
            <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>Detaylı Düzenle</Text>
          </Pressable>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const inputStyle = {
  fontFamily: fonts.medium,
  fontSize: 14,
  color: colors.textPrimary,
  borderWidth: 1.5,
  borderColor: '#E2E8F0',
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 11,
  backgroundColor: '#F8FAFC',
  marginTop: 6,
};

const inputContainerStyle = {
  borderWidth: 1.5,
  borderColor: '#E2E8F0',
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 11,
  backgroundColor: '#F8FAFC',
  marginTop: 6,
};

function Field({ label, children, required, missing }: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  missing?: boolean;
}) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{label}</Text>
        {required && <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: missing ? colors.danger : '#16A34A' }}>*</Text>}
        {missing && (
          <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: colors.danger }}>EKSİK</Text>
          </View>
        )}
      </View>
      {children}
    </View>
  );
}
