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
import { useListings } from '../src/context/ListingsContext';
import { type ParsedProductDraft } from '../src/services/instagramService';
import { MARKETPLACE_CATEGORIES } from '../src/constants/marketplaceCategories';

function AutoBadge() {
  return (
    <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 6 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 8, color: colors.primary }}>TAHMİN EDİLDİ</Text>
    </View>
  );
}

export default function InstagramQuickPublishScreen() {
  const router = useRouter();
  const { user, isDarkMode } = useAuth();
  const { hasStore } = useListings();
  const params = useLocalSearchParams<{
    postId?: string;
    mediaUrl?: string;
    caption?: string;
    draft?: string;
  }>();

  const initialDraft: ParsedProductDraft = params.draft
    ? JSON.parse(params.draft)
    : {
        title: '', price: null, categoryId: null, categoryName: null,
        subCategoryId: null, subCategoryName: null, description: params.caption ?? '',
        sizes: '', colors: '', city: null, stockStatus: null, deliveryType: null,
        confidence: 0, missingFields: [], autoFields: [],
      };

  const [draft, setDraft] = useState<ParsedProductDraft>(initialDraft);
  const [title, setTitle] = useState(initialDraft.title);
  const [price, setPrice] = useState(initialDraft.price ? String(initialDraft.price) : '');
  const [description, setDescription] = useState(initialDraft.description);
  const [sizes, setSizes] = useState(initialDraft.sizes);
  const [colorsVal, setColorsVal] = useState(initialDraft.colors);
  const [city, setCity] = useState(initialDraft.city ?? '');
  const [publishing, setPublishing] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const mediaUrl = params.mediaUrl ?? '';
  const autoFields = initialDraft.autoFields ?? [];

  const pal = {
    bg: isDarkMode ? '#0F172A' : '#F8FAFC',
    card: isDarkMode ? '#111827' : '#FFFFFF',
    border: isDarkMode ? '#334155' : '#E2E8F0',
    inputBg: isDarkMode ? '#1E293B' : '#F8FAFC',
    textPrimary: isDarkMode ? '#E5E7EB' : '#1E293B',
    textSecondary: isDarkMode ? '#94A3B8' : '#64748B',
    labelColor: isDarkMode ? '#94A3B8' : '#64748B',
    headerBg: isDarkMode ? '#111827' : '#FFFFFF',
    headerBorder: isDarkMode ? '#1E293B' : '#33333315',
    warnBg: isDarkMode ? '#451A03' : '#FFFBEB',
    warnBorder: isDarkMode ? '#92400E' : '#FDE68A',
    warnText: isDarkMode ? '#FCD34D' : '#92400E',
    catBg: isDarkMode ? '#1E293B' : '#F8FAFC',
    catBorder: isDarkMode ? '#334155' : '#E2E8F0',
    catActiveBg: isDarkMode ? '#1E3A8A' : '#EFF6FF',
    catActiveBorder: colors.primary,
  };

  const missingNow: string[] = [];
  if (!title.trim() || title.trim().length < 3) missingNow.push('Ürün adı eksik');
  if (!price || isNaN(Number(price)) || Number(price) <= 0) missingNow.push('Fiyat eksik');
  if (!draft.categoryId) missingNow.push('Kategori seçilmeli');

  async function handlePublish() {
    if (!hasStore) {
      Alert.alert(
        'Mağaza Gerekli',
        'İlan yayınlamak için önce mağaza oluşturman gerekiyor.',
        [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Mağaza Kur', onPress: () => router.push('/store-setup' as never) },
        ]
      );
      return;
    }
    if (missingNow.length > 0) {
      Alert.alert('Eksik Bilgi', missingNow.join('\n'));
      return;
    }
    setPublishing(true);
    try {
      const descFull = [
        description.trim(),
        sizes.trim() ? `Beden: ${sizes.trim()}` : '',
        colorsVal.trim() ? `Renk: ${colorsVal.trim()}` : '',
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

  const categoriesToShow = showAllCategories
    ? MARKETPLACE_CATEGORIES
    : MARKETPLACE_CATEGORIES.slice(0, 8);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: pal.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: pal.headerBg, borderBottomWidth: 1, borderBottomColor: pal.headerBorder }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={22} color={pal.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: pal.textPrimary }}>Hızlı Yayınla</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.textSecondary }}>Instagram'dan otomatik taslak</Text>
        </View>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 4,
          backgroundColor: initialDraft.confidence >= 70 ? '#DCFCE7' : (isDarkMode ? '#450A0A' : '#FFF5F5'),
          paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
        }}>
          <Ionicons name="flash" size={12} color={initialDraft.confidence >= 70 ? '#16A34A' : colors.danger} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: initialDraft.confidence >= 70 ? '#16A34A' : colors.danger }}>
            %{initialDraft.confidence}
          </Text>
        </View>
      </View>

      {/* No store warning */}
      {!hasStore && (
        <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: pal.warnBg, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: pal.warnBorder }}>
          <Ionicons name="storefront-outline" size={18} color={pal.warnText} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: pal.warnText }}>Mağaza gerekli</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.warnText, marginTop: 3 }}>
              İlan yayınlamak için önce mağaza oluşturman gerekiyor.
            </Text>
            <Pressable onPress={() => router.push('/store-setup' as never)} style={{ marginTop: 8 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }}>Mağaza Kur →</Text>
            </Pressable>
          </View>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Media Preview */}
          <View style={{ borderRadius: 18, overflow: 'hidden', height: 220 }}>
            <Image source={{ uri: mediaUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            <View style={{ position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="logo-instagram" size={13} color="#fff" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>Instagram İçeriği</Text>
            </View>
            <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff' }}>%{initialDraft.confidence} hazır</Text>
            </View>
          </View>

          {/* Missing Fields Alert */}
          {missingNow.length > 0 && (
            <View style={{ backgroundColor: isDarkMode ? '#450A0A' : '#FFF5F5', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: isDarkMode ? '#991B1B' : '#FECACA' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
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

          {/* AI Parsed info */}
          <View style={{ backgroundColor: isDarkMode ? '#1E3A8A22' : '#EFF6FF', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary, flex: 1 }}>
              Caption'dan otomatik analiz edildi. "TAHMİN EDİLDİ" etiketli alanları kontrol et ve gerekirse düzenle.
            </Text>
          </View>

          {/* Form Fields */}
          <FieldRow
            label="Ürün Adı"
            required
            missing={!title.trim() || title.trim().length < 3}
            isAuto={autoFields.includes('title')}
            pal={pal}
          >
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Ürün adını girin"
              placeholderTextColor="#94A3B8"
              style={inputStyle(pal, !title.trim() || title.trim().length < 3)}
            />
          </FieldRow>

          <FieldRow
            label="Fiyat (₺)"
            required
            missing={!price || isNaN(Number(price)) || Number(price) <= 0}
            isAuto={autoFields.includes('price')}
            pal={pal}
          >
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder="0"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              style={inputStyle(pal, !price || isNaN(Number(price)) || Number(price) <= 0)}
            />
          </FieldRow>

          <FieldRow
            label="Kategori"
            required
            missing={!draft.categoryId}
            isAuto={autoFields.includes('category')}
            pal={pal}
          >
            {draft.categoryId ? (
              <View>
                <Pressable
                  onPress={() => setDraft((prev) => ({ ...prev, categoryId: null, categoryName: null, subCategoryId: null, subCategoryName: null }))}
                  style={{ ...inputContainerStyle(pal), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: pal.textPrimary }}>
                    {draft.categoryName} {draft.subCategoryName ? `› ${draft.subCategoryName}` : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: pal.textSecondary }}>Değiştir</Text>
                  </View>
                </Pressable>
              </View>
            ) : (
              <View style={{ marginTop: 8, gap: 8 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {categoriesToShow.map((cat) => (
                    <Pressable
                      key={cat.id}
                      onPress={() => setDraft((prev) => ({ ...prev, categoryId: cat.id, categoryName: cat.name }))}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
                        borderWidth: 1.5, borderColor: pal.catBorder, backgroundColor: pal.catBg,
                        flexDirection: 'row', alignItems: 'center', gap: 5,
                      }}
                    >
                      <Text>{cat.icon}</Text>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: pal.textPrimary }}>{cat.name}</Text>
                    </Pressable>
                  ))}
                </View>
                {!showAllCategories && MARKETPLACE_CATEGORIES.length > 8 && (
                  <Pressable onPress={() => setShowAllCategories(true)}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>+ Tüm kategorileri göster</Text>
                  </Pressable>
                )}
              </View>
            )}
          </FieldRow>

          <FieldRow label="Açıklama" pal={pal}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Ürün açıklaması"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              style={{ ...inputStyle(pal, false), height: 90, textAlignVertical: 'top', paddingTop: 10 }}
            />
          </FieldRow>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <FieldRow label="Beden / Ölçü" isAuto={autoFields.includes('sizes')} pal={pal}>
                <TextInput
                  value={sizes}
                  onChangeText={setSizes}
                  placeholder="S, M, L, XL..."
                  placeholderTextColor="#94A3B8"
                  style={inputStyle(pal, false)}
                />
              </FieldRow>
            </View>
            <View style={{ flex: 1 }}>
              <FieldRow label="Renk" isAuto={autoFields.includes('colors')} pal={pal}>
                <TextInput
                  value={colorsVal}
                  onChangeText={setColorsVal}
                  placeholder="Siyah, Beyaz..."
                  placeholderTextColor="#94A3B8"
                  style={inputStyle(pal, false)}
                />
              </FieldRow>
            </View>
          </View>

          <FieldRow label="Şehir" isAuto={autoFields.includes('city')} pal={pal}>
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="İstanbul, Ankara..."
              placeholderTextColor="#94A3B8"
              style={inputStyle(pal, false)}
            />
          </FieldRow>

          {/* Action Buttons */}
          <Pressable
            onPress={handlePublish}
            disabled={publishing || (!hasStore)}
            style={{
              backgroundColor: !hasStore ? '#94A3B8' : missingNow.length > 0 ? '#CBD5E1' : colors.primary,
              borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center',
              justifyContent: 'center', gap: 8,
            }}
          >
            {publishing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="rocket-outline" size={20} color="#fff" />
            )}
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>
              {publishing ? 'Yayınlanıyor...' : !hasStore ? 'Önce Mağaza Kur' : 'Yayınla'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleDetailedEdit}
            style={{
              backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
              borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center',
              justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: pal.border,
            }}
          >
            <Ionicons name="create-outline" size={18} color={pal.textSecondary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: pal.textSecondary }}>Detaylı Düzenle</Text>
          </Pressable>

          <View style={{ height: 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function inputStyle(pal: Record<string, string>, missing: boolean) {
  return {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: pal.textPrimary,
    borderWidth: 1.5,
    borderColor: missing ? colors.danger : pal.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: pal.inputBg,
    marginTop: 6,
  };
}

function inputContainerStyle(pal: Record<string, string>) {
  return {
    borderWidth: 1.5,
    borderColor: '#16A34A',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: pal.inputBg,
    marginTop: 6,
  };
}

function FieldRow({
  label, children, required, missing, isAuto, pal,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  missing?: boolean;
  isAuto?: boolean;
  pal: Record<string, string>;
}) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: pal.labelColor }}>{label}</Text>
        {required && (
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: missing ? colors.danger : '#16A34A' }}>*</Text>
        )}
        {missing && (
          <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 8, color: colors.danger }}>EKSİK</Text>
          </View>
        )}
        {isAuto && !missing && <AutoBadge />}
      </View>
      {children}
    </View>
  );
}
