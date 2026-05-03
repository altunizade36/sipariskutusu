import { useEffect, useMemo, useState } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import { useListings } from '../src/context/ListingsContext';
import { CategoryPicker } from '../src/components/CategoryPicker';
import { MARKETPLACE_CATEGORIES, OTHER_SUBCATEGORY_ID } from '../src/constants/marketplaceCategories';
import { TR_CITIES } from '../src/constants/tr-cities';
import { pickImageFromLibrary } from '../src/utils/imagePicker';
import { submitListingToSupabase } from '../src/services/listingService';
import { isSupabaseConfigured } from '../src/services/supabase';
import { useUploadProgress } from '../src/hooks/useUploadProgress';
import { UploadProgressOverlay } from '../src/components/UploadProgressOverlay';
import { trackEvent } from '../src/services/monitoring';
import { TELEMETRY_EVENTS } from '../src/constants/telemetryEvents';
import { createInAppNotification } from '../src/services/inAppNotificationService';

type Condition = 'Yeni' | 'Az kullanılmış' | 'İkinci el' | 'Hasarlı';
type Delivery = 'Kargo' | 'Elden' | 'Görüşülür';

const CONDITIONS: Condition[] = ['Yeni', 'Az kullanılmış', 'İkinci el', 'Hasarlı'];
const DELIVERY_OPTIONS: Delivery[] = ['Kargo', 'Elden', 'Görüşülür'];
const MAX_PHOTOS = 5;

const CITY_LIST = Object.keys(TR_CITIES).sort((a, b) => a.localeCompare(b, 'tr-TR'));
const CREATE_LISTING_DRAFT_KEY = 'create-listing-draft-v2';
const CREATE_LISTING_DRAFT_VERSION = 1;

type CreateListingDraft = {
  version: number;
  photos: string[];
  coverIndex: number;
  title: string;
  description: string;
  condition: Condition;
  categoryId: string;
  subCategoryId: string;
  customSubCategory: string;
  sizeVariants: string;
  colorVariants: string;
  price: string;
  bargaining: boolean;
  delivery: Delivery[];
  freeShipping: boolean;
  city: string;
  district: string;
  neighborhood: string;
};

function normalizeDraft(raw: unknown): CreateListingDraft | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const input = raw as Partial<CreateListingDraft> & { version?: number; delivery?: unknown; photos?: unknown };
  const photos = Array.isArray(input.photos)
    ? input.photos.filter((uri): uri is string => typeof uri === 'string').slice(0, MAX_PHOTOS)
    : [];

  const deliveryFromDraft = Array.isArray(input.delivery)
    ? input.delivery.filter((item): item is Delivery => DELIVERY_OPTIONS.includes(item as Delivery))
    : [];

  const safeCoverIndex = typeof input.coverIndex === 'number' && Number.isFinite(input.coverIndex)
    ? Math.min(Math.max(input.coverIndex, 0), Math.max(photos.length - 1, 0))
    : 0;

  return {
    version: typeof input.version === 'number' ? input.version : 0,
    photos,
    coverIndex: safeCoverIndex,
    title: typeof input.title === 'string' ? input.title : '',
    description: typeof input.description === 'string' ? input.description : '',
    condition: input.condition && CONDITIONS.includes(input.condition) ? input.condition : 'Yeni',
    categoryId: typeof input.categoryId === 'string' && input.categoryId.trim()
      ? input.categoryId
      : (MARKETPLACE_CATEGORIES[0]?.id ?? 'women'),
    subCategoryId: typeof input.subCategoryId === 'string' && input.subCategoryId.trim() ? input.subCategoryId : 'all',
    customSubCategory: typeof input.customSubCategory === 'string' ? input.customSubCategory : '',
    sizeVariants: typeof input.sizeVariants === 'string' ? input.sizeVariants : '',
    colorVariants: typeof input.colorVariants === 'string' ? input.colorVariants : '',
    price: typeof input.price === 'string' ? input.price : '',
    bargaining: Boolean(input.bargaining),
    delivery: deliveryFromDraft.length > 0 ? deliveryFromDraft : ['Kargo'],
    freeShipping: Boolean(input.freeShipping),
    city: typeof input.city === 'string' ? input.city : '',
    district: typeof input.district === 'string' ? input.district : '',
    neighborhood: typeof input.neighborhood === 'string' ? input.neighborhood : '',
  };
}

function buildPalette(dark: boolean) {
  return {
    bg: dark ? '#0F172A' : '#F4F6FB',
    card: dark ? '#1E293B' : '#FFFFFF',
    cardAlt: dark ? '#0F172A' : '#F8FAFC',
    border: dark ? '#334155' : '#E2E8F0',
    borderFaint: dark ? '#1E293B' : '#F1F5F9',
    textPrimary: dark ? '#F1F5F9' : colors.textPrimary,
    textSecondary: dark ? '#94A3B8' : colors.textSecondary,
    textMuted: dark ? '#64748B' : colors.textMuted,
    inputBg: dark ? '#0F172A' : '#F8FAFC',
    primaryTint: dark ? '#1E3A5F' : '#EFF6FF',
    primaryBorder: dark ? '#2563EB44' : '#DBEAFE',
    successTint: dark ? '#064E3B' : '#ECFDF5',
    successBorder: dark ? '#065F46' : '#A7F3D0',
    successText: dark ? '#34D399' : '#047857',
    warnTint: dark ? '#78350F20' : '#FFFBEB',
    dangerTint: dark ? '#7F1D1D20' : '#FFF1F2',
    heartTint: dark ? '#4C1D2D' : '#FFF1F2',
    heartColor: dark ? '#F43F5E' : '#FDA4AF',
    chatTint: dark ? '#0C2440' : '#F0F9FF',
    chatColor: dark ? '#38BDF8' : '#7DD3FC',
    shareTint: dark ? '#052E16' : '#F0FDF4',
    shareColor: dark ? '#4ADE80' : '#86EFAC',
    headerGrad: dark
      ? (['#1E293B', '#0F172A'] as const)
      : (['#FFFFFF', '#F4F6FB'] as const),
  };
}

export default function CreateListingScreen() {
  const router = useRouter();
  const { user, isDarkMode } = useAuth();
  const { addListing, hasStore, reloadProducts } = useListings();
  const uploadProgress = useUploadProgress();
  const insets = useSafeAreaInsets();
  const [storeCheckLoading, setStoreCheckLoading] = useState(true);

  const pal = useMemo(() => buildPalette(isDarkMode), [isDarkMode]);

  const [photos, setPhotos] = useState<string[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<Condition>('Yeni');
  const [categoryId, setCategoryId] = useState<string>(MARKETPLACE_CATEGORIES[0]?.id ?? 'women');
  const [subCategoryId, setSubCategoryId] = useState<string>('all');
  const [customSubCategory, setCustomSubCategory] = useState('');
  const [sizeVariants, setSizeVariants] = useState('');
  const [colorVariants, setColorVariants] = useState('');
  const [price, setPrice] = useState('');
  const [bargaining, setBargaining] = useState(false);
  const [delivery, setDelivery] = useState<Delivery[]>(['Kargo']);
  const [freeShipping, setFreeShipping] = useState(false);
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [cityModal, setCityModal] = useState(false);
  const [districtModal, setDistrictModal] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  const selectedCategory = useMemo(
    () => MARKETPLACE_CATEGORIES.find((c) => c.id === categoryId),
    [categoryId],
  );
  const selectedSubCategoryName = useMemo(() => {
    if (!selectedCategory) return '';
    const found = selectedCategory.subcategories.find((item) => item.id === subCategoryId);
    if (!found) return '';
    if (found.id === OTHER_SUBCATEGORY_ID && customSubCategory.trim()) {
      return customSubCategory.trim();
    }
    return found.name;
  }, [customSubCategory, selectedCategory, subCategoryId]);

  const sellerName = String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Misafir');
  const sellerAvatar = typeof user?.user_metadata?.avatar_url === 'string'
    ? user.user_metadata.avatar_url
    : typeof user?.user_metadata?.picture === 'string'
      ? user.user_metadata.picture
      : '';

  const priceNumber = Number(price.replace(',', '.'));
  const priceValid = Number.isFinite(priceNumber) && priceNumber > 0;
  const descriptionValid = description.trim().length >= 20;
  const districtList = useMemo(() => (city ? TR_CITIES[city] ?? [] : []), [city]);
  const locationLabel = useMemo(
    () => [city, district, neighborhood.trim()].filter(Boolean).join(' / '),
    [city, district, neighborhood],
  );
  const completionItems = useMemo(
    () => [
      { label: 'Fotoğraf', done: photos.length > 0 },
      { label: 'Başlık', done: Boolean(title.trim()) },
      { label: 'Açıklama', done: descriptionValid },
      { label: 'Kategori', done: Boolean(categoryId) },
      {
        label: 'Alt kategori',
        done: subCategoryId !== OTHER_SUBCATEGORY_ID || Boolean(customSubCategory.trim()),
      },
      { label: 'Fiyat', done: priceValid },
      { label: 'Teslimat', done: delivery.length > 0 },
      { label: 'Şehir', done: Boolean(city) },
      { label: 'İlçe', done: Boolean(district) },
    ],
    [
      photos.length, title, descriptionValid, categoryId,
      subCategoryId, customSubCategory, priceValid, delivery.length, city, district, neighborhood,
    ],
  );
  const completedCount = completionItems.filter((item) => item.done).length;
  const completionPercent = Math.round((completedCount / completionItems.length) * 100);

  const filteredCities = useMemo(() => {
    const query = citySearch.trim().toLocaleLowerCase('tr-TR');
    if (!query) return CITY_LIST;
    return CITY_LIST.filter((item) => item.toLocaleLowerCase('tr-TR').includes(query));
  }, [citySearch]);

  const filteredDistricts = useMemo(() => {
    const query = districtSearch.trim().toLocaleLowerCase('tr-TR');
    if (!query) return districtList;
    return districtList.filter((item) => item.toLocaleLowerCase('tr-TR').includes(query));
  }, [districtList, districtSearch]);

  const missing: string[] = [];
  if (photos.length === 0) missing.push('Fotoğraf');
  if (!title.trim()) missing.push('Başlık');
  if (!descriptionValid) missing.push('Açıklama (min. 20 karakter)');
  if (!categoryId) missing.push('Kategori');
  if (subCategoryId === OTHER_SUBCATEGORY_ID && !customSubCategory.trim()) {
    missing.push('Özel Alt Kategori');
  }
  if (!priceValid) missing.push('Fiyat');
  if (delivery.length === 0) missing.push('Teslimat');
  if (!city) missing.push('Şehir');
  if (!district) missing.push('İlçe');

  const canPublish = missing.length === 0 && !submitting;
  const coverUri = photos[coverIndex] ?? photos[0];

  const inputStyle = useMemo(() => ({
    backgroundColor: pal.inputBg,
    borderWidth: 1,
    borderColor: pal.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: pal.textPrimary,
  }), [pal]);

  const selectorStyle = useMemo(() => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: pal.inputBg,
    borderWidth: 1,
    borderColor: pal.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  }), [pal]);

  useEffect(() => {
    const timer = setTimeout(() => setStoreCheckLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const loadDraft = async () => {
      try {
        const serialized = await AsyncStorage.getItem(CREATE_LISTING_DRAFT_KEY);
        if (!serialized || !active) return;
        const parsed = normalizeDraft(JSON.parse(serialized));
        if (!parsed) return;
        setPhotos(parsed.photos);
        setCoverIndex(parsed.coverIndex);
        setTitle(parsed.title);
        setDescription(parsed.description);
        setCondition(parsed.condition);
        setCategoryId(parsed.categoryId);
        setSubCategoryId(parsed.subCategoryId);
        setCustomSubCategory(parsed.customSubCategory);
        setSizeVariants(parsed.sizeVariants);
        setColorVariants(parsed.colorVariants);
        setPrice(parsed.price);
        setBargaining(parsed.bargaining);
        setDelivery(parsed.delivery);
        setFreeShipping(parsed.freeShipping);
        setCity(parsed.city);
        setDistrict(parsed.district);
        setNeighborhood(parsed.neighborhood);
        if (parsed.version < CREATE_LISTING_DRAFT_VERSION) {
          const migratedDraft: CreateListingDraft = { ...parsed, version: CREATE_LISTING_DRAFT_VERSION };
          AsyncStorage.setItem(CREATE_LISTING_DRAFT_KEY, JSON.stringify(migratedDraft)).catch(() => undefined);
          trackEvent(TELEMETRY_EVENTS.CREATE_LISTING_DRAFT_MIGRATED, {
            source: 'create_listing_draft',
            from_version: parsed.version,
            to_version: CREATE_LISTING_DRAFT_VERSION,
          });
        }
        setDraftRestored(true);
      } catch {
        // Taslak okunamazsa sessizce boş form ile devam et.
      } finally {
        if (active) setDraftReady(true);
      }
    };
    void loadDraft();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const isDefaultFormState =
      photos.length === 0 && coverIndex === 0 && !title.trim() && !description.trim() &&
      condition === 'Yeni' && categoryId === (MARKETPLACE_CATEGORIES[0]?.id ?? 'women') &&
      subCategoryId === 'all' && !customSubCategory.trim() && !sizeVariants.trim() &&
      !colorVariants.trim() && !price.trim() && bargaining === false &&
      delivery.length === 1 && delivery[0] === 'Kargo' && freeShipping === false &&
      !city.trim() && !district.trim() && !neighborhood.trim();

    if (isDefaultFormState) {
      AsyncStorage.removeItem(CREATE_LISTING_DRAFT_KEY).catch(() => undefined);
      return;
    }

    const payload: CreateListingDraft = {
      version: CREATE_LISTING_DRAFT_VERSION,
      photos, coverIndex, title, description, condition, categoryId,
      subCategoryId, customSubCategory, sizeVariants, colorVariants,
      price, bargaining, delivery, freeShipping, city, district, neighborhood,
    };
    AsyncStorage.setItem(CREATE_LISTING_DRAFT_KEY, JSON.stringify(payload)).catch(() => undefined);
  }, [
    draftReady, photos, coverIndex, title, description, condition, categoryId,
    subCategoryId, customSubCategory, sizeVariants, colorVariants,
    price, bargaining, delivery, freeShipping, city, district, neighborhood,
  ]);

  const clearDraft = async () => {
    await AsyncStorage.removeItem(CREATE_LISTING_DRAFT_KEY).catch(() => undefined);
    setPhotos([]); setCoverIndex(0); setTitle(''); setDescription('');
    setCondition('Yeni'); setCategoryId(MARKETPLACE_CATEGORIES[0]?.id ?? 'women');
    setSubCategoryId('all'); setCustomSubCategory(''); setSizeVariants('');
    setColorVariants(''); setPrice(''); setBargaining(false);
    setDelivery(['Kargo']); setFreeShipping(false); setCity('');
    setDistrict(''); setNeighborhood(''); setCitySearch('');
    setDistrictSearch(''); setDraftRestored(false);
  };

  const handleAddPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit', `En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsin.`);
      return;
    }
    try {
      const uri = await pickImageFromLibrary();
      if (uri) setPhotos((prev) => [...prev, uri]);
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
    setDelivery((prev) => {
      const next = prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d];
      if (!next.includes('Kargo')) setFreeShipping(false);
      return next;
    });
  };

  const handlePublish = async () => {
    if (!user) {
      Alert.alert('Giriş gerekli', 'İlan yayınlamak için giriş yap.');
      router.push({ pathname: '/auth', params: { redirect: '/create-listing' } });
      return;
    }
    if (!canPublish) return;
    setSubmitting(true);
    uploadProgress.startUpload(photos.length);
    try {
      const baseDescription = description.trim();
      const variantLines: string[] = [];
      if (sizeVariants.trim()) variantLines.push(`Beden: ${sizeVariants.trim()}`);
      if (colorVariants.trim()) variantLines.push(`Renk: ${colorVariants.trim()}`);
      const descriptionWithVariants = [baseDescription, variantLines.length > 0 ? `Varyantlar\n${variantLines.join('\n')}` : '']
        .filter(Boolean).join('\n\n');
      const descriptionWithFreeShippingTag = freeShipping
        ? `${descriptionWithVariants}${descriptionWithVariants ? '\n\n' : ''}#ucretsizkargo`
        : descriptionWithVariants;

      if (isSupabaseConfigured) {
        const created = await submitListingToSupabase({
          title: title.trim(),
          description: descriptionWithFreeShippingTag,
          price: priceNumber,
          categoryId: selectedCategory?.id ?? '',
          subCategoryId: subCategoryId === 'all' ? undefined : subCategoryId,
          customSubCategory: subCategoryId === OTHER_SUBCATEGORY_ID ? customSubCategory.trim() : undefined,
          condition,
          delivery,
          city,
          district,
          neighborhood: neighborhood.trim(),
          imageUris: photos,
          coverIndex,
          negotiable: bargaining,
          stock: 1,
          sourceType: 'manual',
        });
        uploadProgress.completeUpload();
        await AsyncStorage.removeItem(CREATE_LISTING_DRAFT_KEY).catch(() => undefined);
        createInAppNotification(
          user.id, 'listing_approved', 'İlanınız yayına alındı 🎉',
          `"${title.trim()}" başlıklı ilanınız başarıyla yayına alındı.`,
          { listingId: created.id },
        ).catch(() => undefined);
        reloadProducts();
        Alert.alert('Yayınlandı! 🎉', 'İlanın yayına alındı. Mağazan ve akıştaki yerini almaya başlıyor.', [
          { text: 'İlanı Gör', onPress: () => router.replace(`/product/${created.id}`) },
        ]);
      } else {
        const orderedMedia = coverIndex > 0
          ? [photos[coverIndex], ...photos.filter((_, i) => i !== coverIndex)]
          : photos;
        const created = addListing({
          title: title.trim(), description: descriptionWithVariants, price: priceNumber,
          categoryId: selectedCategory?.id ?? '', condition, location: city, district, delivery,
          freeShipping, imageUri: orderedMedia[0], mediaUris: orderedMedia, stock: 1,
          attributes: [
            ...(bargaining ? [{ label: 'Pazarlık', value: 'Var' }] : []),
            ...(freeShipping ? [{ label: 'Ücretsiz Kargo', value: 'Var' }] : []),
            ...(sizeVariants.trim() ? [{ label: 'Beden', value: sizeVariants.trim() }] : []),
            ...(colorVariants.trim() ? [{ label: 'Renk', value: colorVariants.trim() }] : []),
            ...(neighborhood.trim() ? [{ label: 'Mahalle', value: neighborhood.trim() }] : []),
          ],
        });
        uploadProgress.completeUpload();
        await AsyncStorage.removeItem(CREATE_LISTING_DRAFT_KEY).catch(() => undefined);
        Alert.alert('Yayınlandı', 'İlanın yayınlandı.', [
          { text: 'Tamam', onPress: () => router.replace(`/product/${created.id}`) },
        ]);
      }
    } catch (err: any) {
      uploadProgress.failUpload(err?.message ?? 'İlan yayınlanamadı.');
      Alert.alert('Hata', err?.message ?? 'İlan yayınlanamadı.');
    } finally {
      setSubmitting(false);
      uploadProgress.resetProgress();
    }
  };

  // --- Giriş yapılmamışsa ---
  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: pal.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }} edges={['top', 'bottom']}>
        <View style={{ width: 96, height: 96, borderRadius: 24, backgroundColor: pal.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Ionicons name="person-circle-outline" size={56} color={colors.primary} />
        </View>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: pal.textPrimary, textAlign: 'center' }}>
          Giriş Yapmalısın
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: pal.textMuted, marginTop: 10, textAlign: 'center', lineHeight: 22 }}>
          İlan yayınlamak için önce hesabına giriş yapmalısın.
        </Text>
        <Pressable
          onPress={() => router.push({ pathname: '/auth', params: { redirect: '/create-listing' } })}
          style={{ marginTop: 28, height: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, width: '100%' }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>Giriş Yap</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/(tabs)')} style={{ marginTop: 12, height: 44, borderRadius: 14, borderWidth: 1, borderColor: pal.border, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: pal.textSecondary }}>Geri Dön</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // --- Mağaza yüklenirken ---
  if (storeCheckLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: pal.bg, alignItems: 'center', justifyContent: 'center' }} edges={['top', 'bottom']}>
        <View style={{ alignItems: 'center', gap: 14 }}>
          <View style={{ width: 72, height: 72, borderRadius: 18, backgroundColor: pal.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="storefront-outline" size={36} color={colors.primary} />
          </View>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: pal.textMuted }}>Mağaza bilgisi kontrol ediliyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // --- Mağazası yoksa kapı göster ---
  if (!hasStore) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: pal.bg }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 52, borderBottomWidth: 1, borderBottomColor: pal.border, backgroundColor: pal.card }}>
          <Pressable onPress={() => router.replace('/(tabs)')} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 }}>
            <Ionicons name="close" size={26} color={pal.textPrimary} />
          </Pressable>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: pal.textPrimary, marginLeft: 4 }}>İlan Ver</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ width: 96, height: 96, borderRadius: 24, backgroundColor: pal.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Ionicons name="storefront-outline" size={48} color={colors.primary} />
          </View>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: pal.textPrimary, textAlign: 'center' }}>
            Önce mağazanı oluştur
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: pal.textMuted, textAlign: 'center', marginTop: 12, lineHeight: 22 }}>
            İlan yayınlamak için önce bir satıcı mağazası oluşturman gerekiyor.
          </Text>
          <View style={{ marginTop: 16, backgroundColor: pal.successTint, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: pal.successBorder, width: '100%' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: pal.successText, marginBottom: 8 }}>Mağaza açınca şunları yapabilirsin:</Text>
            {['Manuel ilan yayınla', 'Instagram içeriklerini ürüne çevir', 'Mağaza profili oluştur', 'Sipariş ve mesajları yönet'].map((item) => (
              <View key={item} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <Ionicons name="checkmark-circle" size={14} color={pal.successText} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: pal.successText }}>{item}</Text>
              </View>
            ))}
          </View>
          <Pressable
            onPress={() => router.push('/store-setup')}
            style={{ marginTop: 24, height: 54, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', width: '100%', flexDirection: 'row', gap: 8 }}
          >
            <Ionicons name="storefront" size={20} color="#fff" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>Mağaza Oluştur</Text>
          </Pressable>
          <Pressable onPress={() => router.replace('/(tabs)')} style={{ marginTop: 12, height: 44, borderRadius: 14, borderWidth: 1, borderColor: pal.border, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: pal.textSecondary }}>Şimdi Değil</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <UploadProgressOverlay
        visible={uploadProgress.isUploading}
        progress={uploadProgress.progress}
        message={uploadProgress.message}
        error={uploadProgress.error}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: pal.bg }} edges={['top']}>

        {/* HEADER */}
        <LinearGradient
          colors={pal.headerGrad}
          style={{ borderBottomWidth: 1, borderBottomColor: pal.border }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 52 }}>
            <Pressable onPress={() => router.replace('/(tabs)')} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 }}>
              <Ionicons name="close" size={26} color={pal.textPrimary} />
            </Pressable>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: pal.textPrimary }}>
              İlan Ver
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Taslak Durumu */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons
                name={draftRestored ? 'checkmark-circle' : 'save-outline'}
                size={13}
                color={draftRestored ? '#10B981' : pal.textMuted}
              />
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: draftRestored ? '#10B981' : pal.textMuted }}>
                {draftRestored ? 'Taslak geri yüklendi' : 'Otomatik kaydediliyor'}
              </Text>
            </View>
            <Pressable
              onPress={() => void clearDraft()}
              style={{ height: 26, paddingHorizontal: 10, borderRadius: 999, backgroundColor: pal.cardAlt, borderWidth: 1, borderColor: pal.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: pal.textSecondary }}>Temizle</Text>
            </Pressable>
          </View>
        </LinearGradient>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ paddingBottom: 160 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* 1. FOTOĞRAFLAR */}
            <Section title="Fotoğraflar" hint={`${photos.length}/${MAX_PHOTOS}`} pal={pal}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
                  {photos.map((uri, idx) => {
                    const isCover = idx === coverIndex;
                    return (
                      <View key={uri + idx} style={{ position: 'relative' }}>
                        <Pressable onPress={() => setCoverIndex(idx)}>
                          <Image source={{ uri }} style={{ width: 96, height: 96, borderRadius: 12 }} />
                          {isCover ? (
                            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 12, borderWidth: 2.5, borderColor: colors.primary }} />
                          ) : null}
                          <View style={{
                            position: 'absolute', left: 5, bottom: 5,
                            backgroundColor: isCover ? colors.primary : 'rgba(0,0,0,0.55)',
                            paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
                          }}>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: '#fff', letterSpacing: 0.3 }}>
                              {isCover ? 'KAPAK' : 'Kapak Yap'}
                            </Text>
                          </View>
                          <View style={{ position: 'absolute', top: 4, left: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: isCover ? colors.primary : 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: '#fff' }}>{idx + 1}</Text>
                          </View>
                        </Pressable>
                        <Pressable
                          onPress={() => handleRemovePhoto(idx)}
                          style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Ionicons name="close" size={13} color="#fff" />
                        </Pressable>
                      </View>
                    );
                  })}
                  {photos.length < MAX_PHOTOS ? (
                    <Pressable
                      onPress={handleAddPhoto}
                      style={{ width: 96, height: 96, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: pal.primaryTint }}
                    >
                      <Ionicons name="camera" size={24} color={colors.primary} />
                      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary, marginTop: 5 }}>Ekle</Text>
                    </Pressable>
                  ) : null}
                </View>
              </ScrollView>
              {photos.length === 0 ? (
                <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: pal.warnTint, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: isDarkMode ? '#78350F40' : '#FDE68A' }}>
                  <Ionicons name="information-circle-outline" size={16} color={isDarkMode ? '#FBBF24' : '#D97706'} />
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: isDarkMode ? '#FBBF24' : '#92400E', flex: 1, lineHeight: 16 }}>
                    En az 1 fotoğraf gerekli. İlk eklediğin fotoğraf otomatik kapak olur. İstediğinde değiştirebilirsin.
                  </Text>
                </View>
              ) : (
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: pal.textMuted, marginTop: 8 }}>
                  Kapak fotoğrafını seçmek için üstüne dokun.
                </Text>
              )}
            </Section>

            {/* 2. ÜRÜN BİLGİSİ */}
            <Section title="Ürün Bilgisi" pal={pal}>
              <Field label="Başlık" required pal={pal}>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Örn. Az kullanılmış iPhone 13"
                  placeholderTextColor={pal.textMuted}
                  maxLength={80}
                  style={inputStyle}
                />
                <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: pal.textMuted, marginTop: 4, textAlign: 'right' }}>
                  {title.length}/80
                </Text>
              </Field>
              <Field label="Açıklama" pal={pal}>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Ürünün durumu, detayları, özellikleri..."
                  placeholderTextColor={pal.textMuted}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  style={[inputStyle, { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }]}
                />
                <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: descriptionValid ? '#10B981' : pal.textMuted, marginTop: 4, textAlign: 'right' }}>
                  {description.trim().length}/500{description.trim().length < 20 && description.trim().length > 0 ? ` (en az 20)` : ''}
                </Text>
              </Field>
              <Field label="Durum" required pal={pal}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {CONDITIONS.map((c) => {
                    const active = condition === c;
                    return (
                      <Pressable
                        key={c}
                        onPress={() => setCondition(c)}
                        style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.primary : pal.border, backgroundColor: active ? pal.primaryTint : pal.inputBg }}
                      >
                        <Text style={{ fontFamily: active ? fonts.bold : fonts.medium, fontSize: 12, color: active ? colors.primary : pal.textPrimary }}>
                          {c}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>
            </Section>

            {/* 3. KATEGORİ */}
            <Section title="Kategori" pal={pal}>
              <CategoryPicker
                selectedCategoryId={categoryId}
                selectedSubCategoryId={subCategoryId}
                customSubCategory={customSubCategory}
                onChangeCategory={(nextCategoryId) => {
                  setCategoryId(nextCategoryId);
                  setSubCategoryId('all');
                  setCustomSubCategory('');
                }}
                onChangeSubCategory={(nextSubCategoryId) => {
                  setSubCategoryId(nextSubCategoryId);
                  if (nextSubCategoryId !== OTHER_SUBCATEGORY_ID) setCustomSubCategory('');
                }}
                onChangeCustomSubCategory={setCustomSubCategory}
              />
            </Section>

            {/* 4. VARYANTLAR */}
            <Section title="Varyantlar" hint="Opsiyonel" pal={pal}>
              <Field label="Beden Seçenekleri" pal={pal}>
                <TextInput
                  value={sizeVariants}
                  onChangeText={setSizeVariants}
                  placeholder="Örn: S, M, L, XL"
                  placeholderTextColor={pal.textMuted}
                  style={inputStyle}
                />
              </Field>
              <Field label="Renk Seçenekleri" pal={pal}>
                <TextInput
                  value={colorVariants}
                  onChangeText={setColorVariants}
                  placeholder="Örn: Siyah, Beyaz, Kırmızı"
                  placeholderTextColor={pal.textMuted}
                  style={inputStyle}
                />
              </Field>
            </Section>

            {/* 5. FİYAT */}
            <Section title="Fiyat" pal={pal}>
              <Field label="Fiyat (₺)" required pal={pal}>
                <View style={{ position: 'relative' }}>
                  <View style={{ position: 'absolute', left: 12, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: priceValid ? colors.primary : pal.textMuted }}>₺</Text>
                  </View>
                  <TextInput
                    value={price}
                    onChangeText={setPrice}
                    placeholder="0,00"
                    placeholderTextColor={pal.textMuted}
                    keyboardType="numeric"
                    style={[inputStyle, { paddingLeft: 28 }]}
                  />
                </View>
                {priceValid ? (
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#10B981', marginTop: 4 }}>
                    {`₺${priceNumber.toLocaleString('tr-TR')} olarak ayarlandı`}
                  </Text>
                ) : null}
              </Field>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: pal.textPrimary }}>Pazarlık yapılabilir</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: pal.textMuted, marginTop: 2 }}>
                    Alıcılar fiyat üzerinde konuşabilir
                  </Text>
                </View>
                <Switch
                  value={bargaining}
                  onValueChange={setBargaining}
                  trackColor={{ false: pal.border, true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>
            </Section>

            {/* 6. TESLİMAT */}
            <Section title="Teslimat" pal={pal}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {DELIVERY_OPTIONS.map((d) => {
                  const active = delivery.includes(d);
                  const iconName = d === 'Kargo' ? 'cube-outline' : d === 'Elden' ? 'walk-outline' : 'chatbubble-ellipses-outline';
                  return (
                    <Pressable
                      key={d}
                      onPress={() => toggleDelivery(d)}
                      style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.primary : pal.border, backgroundColor: active ? pal.primaryTint : pal.inputBg, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    >
                      <Ionicons name={iconName} size={14} color={active ? colors.primary : pal.textSecondary} />
                      <Text style={{ fontFamily: active ? fonts.bold : fonts.medium, fontSize: 12, color: active ? colors.primary : pal.textPrimary }}>
                        {d}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {delivery.includes('Kargo') ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, backgroundColor: pal.cardAlt, borderWidth: 1, borderColor: pal.border, marginBottom: 12 }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: pal.textPrimary }}>Ücretsiz Kargo etiketi</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: pal.textMuted, marginTop: 2 }}>
                      Sadece ilanda etiket olarak görünür.
                    </Text>
                  </View>
                  <Switch
                    value={freeShipping}
                    onValueChange={setFreeShipping}
                    trackColor={{ false: pal.border, true: colors.primary }}
                    thumbColor="#fff"
                  />
                </View>
              ) : null}

              <Field label="Şehir" required pal={pal}>
                <Pressable onPress={() => setCityModal(true)} style={selectorStyle}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: city ? pal.textPrimary : pal.textMuted }}>
                    {city || 'Şehir seç'}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={pal.textMuted} />
                </Pressable>
              </Field>

              <Field label="İlçe" required pal={pal}>
                <Pressable
                  onPress={() => {
                    if (!city) { Alert.alert('Önce şehir seç', 'İlçe listesini açmak için önce şehir seçmelisin.'); return; }
                    setDistrictModal(true);
                  }}
                  style={[selectorStyle, !city && { opacity: 0.55 }]}
                >
                  <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: district ? pal.textPrimary : pal.textMuted }}>
                    {district || (city ? 'İlçe seç' : 'Önce şehir seç')}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={pal.textMuted} />
                </Pressable>
              </Field>

              <Field label="Mahalle / Semt" pal={pal}>
                <TextInput
                  value={neighborhood}
                  onChangeText={setNeighborhood}
                  placeholder="Örn: Atatürk Mahallesi"
                  placeholderTextColor={pal.textMuted}
                  style={inputStyle}
                />
              </Field>
            </Section>

            {/* 7. SATICI */}
            <Section title="Satıcı" pal={pal}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: pal.cardAlt, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: pal.border }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: pal.primaryTint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {sellerAvatar ? (
                    <Image source={{ uri: sellerAvatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                  ) : (
                    <Ionicons name="person" size={22} color={colors.primary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: pal.textPrimary }}>{sellerName}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: pal.textMuted, marginTop: 2 }}>
                    Hesap bilgisi otomatik eklenir
                  </Text>
                </View>
                <Ionicons name="lock-closed" size={14} color={pal.textMuted} />
              </View>
            </Section>

            {/* 8. CANLI ÖNİZLEME */}
            <Section title="Canlı Önizleme" hint={`%${completionPercent} hazır`} pal={pal}>

              {/* Ana İlan Kartı */}
              <View style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: pal.card, borderWidth: 1, borderColor: pal.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDarkMode ? 0.3 : 0.06, shadowRadius: 8, elevation: 3 }}>
                <View style={{ width: '100%', aspectRatio: 4 / 3, backgroundColor: pal.cardAlt, position: 'relative' }}>
                  {coverUri ? (
                    <Image source={{ uri: coverUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <View style={{ width: 64, height: 64, borderRadius: 999, backgroundColor: pal.border, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="camera-outline" size={28} color={pal.textMuted} />
                      </View>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: pal.textMuted }}>Fotoğraf eklenmedi</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: pal.textMuted }}>Yukarıdan fotoğraf ekleyebilirsin</Text>
                    </View>
                  )}

                  {/* Durum rozeti */}
                  <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: canPublish ? '#059669' : '#475569', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: canPublish ? '#A7F3D0' : '#94A3B8' }} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff', letterSpacing: 0.5 }}>
                      {canPublish ? 'YAYINA HAZIR' : 'TASLAK'}
                    </Text>
                  </View>

                  {photos.length > 0 ? (
                    <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="images-outline" size={11} color="#fff" />
                      <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff' }}>{photos.length}</Text>
                    </View>
                  ) : null}

                  {photos.length > 1 ? (
                    <View style={{ position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
                      {photos.slice(0, 6).map((_, i) => (
                        <View key={i} style={{ width: i === coverIndex ? 18 : 6, height: 6, borderRadius: 999, backgroundColor: i === coverIndex ? '#fff' : 'rgba(255,255,255,0.45)' }} />
                      ))}
                    </View>
                  ) : null}
                </View>

                {photos.length > 1 ? (
                  <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: 10 }}>
                    {photos.slice(0, 5).map((uri, i) => (
                      <View key={i} style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', borderWidth: i === coverIndex ? 2 : 1, borderColor: i === coverIndex ? colors.primary : pal.border }}>
                        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={{ padding: 14, paddingTop: photos.length > 1 ? 10 : 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <View>
                      <Text style={{ fontFamily: fonts.headingBold, fontSize: 24, color: colors.primary, lineHeight: 28 }}>
                        {priceValid ? `₺${priceNumber.toLocaleString('tr-TR')}` : '₺—'}
                      </Text>
                      {freeShipping ? (
                        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: '#059669', marginTop: 1 }}>Ücretsiz kargo</Text>
                      ) : null}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '45%' }}>
                      {bargaining ? (
                        <View style={{ backgroundColor: pal.successTint, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: pal.successBorder }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: pal.successText }}>Pazarlık</Text>
                        </View>
                      ) : null}
                      <View style={{ backgroundColor: pal.cardAlt, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: pal.border }}>
                        <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: pal.textSecondary }}>{condition}</Text>
                      </View>
                    </View>
                  </View>

                  <Text numberOfLines={2} style={{ fontFamily: fonts.bold, fontSize: 15, color: pal.textPrimary, lineHeight: 22, marginBottom: 8 }}>
                    {title.trim() || 'İlan başlığın burada görünür'}
                  </Text>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                    <Ionicons name="location-outline" size={13} color={pal.textMuted} />
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.textMuted }}>
                      {locationLabel || 'Konum belirlenmedi'}
                    </Text>
                    {delivery.length > 0 ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ color: pal.border, fontSize: 14 }}>{'·'}</Text>
                        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: pal.textSecondary }}>
                          {delivery.join(' / ')}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {(selectedCategory || selectedSubCategoryName) ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {selectedCategory ? (
                        <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: pal.primaryBorder, backgroundColor: pal.primaryTint }}>
                          <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.primary }}>{selectedCategory.name}</Text>
                        </View>
                      ) : null}
                      {selectedSubCategoryName ? (
                        <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: pal.primaryBorder, backgroundColor: pal.primaryTint }}>
                          <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.primary }}>{selectedSubCategoryName}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingTop: 11, borderTopWidth: 1, borderTopColor: pal.borderFaint }}>
                    {sellerAvatar ? (
                      <Image source={{ uri: sellerAvatar }} style={{ width: 30, height: 30, borderRadius: 999, borderWidth: 1, borderColor: pal.border }} />
                    ) : (
                      <View style={{ width: 30, height: 30, borderRadius: 999, backgroundColor: pal.border, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="person-outline" size={15} color={pal.textMuted} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: pal.textPrimary }} numberOfLines={1}>{sellerName}</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: pal.textMuted }}>Satıcı</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 5 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: pal.heartTint, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="heart-outline" size={15} color={pal.heartColor} />
                      </View>
                      <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: pal.chatTint, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="chatbubble-outline" size={14} color={pal.chatColor} />
                      </View>
                      <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: pal.shareTint, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="share-social-outline" size={14} color={pal.shareColor} />
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              {/* Açıklama Önizlemesi */}
              <View style={{ marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: pal.border, backgroundColor: pal.card, overflow: 'hidden' }}>
                <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: pal.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: pal.cardAlt }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name="document-text-outline" size={12} color={pal.textSecondary} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: pal.textSecondary }}>Açıklama</Text>
                  </View>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: description.trim().length >= 20 ? '#059669' : description.trim().length > 0 ? '#D97706' : pal.textMuted }}>
                    {description.trim().length > 0
                      ? `${description.trim().length} karakter${description.trim().length < 20 ? ' (min. 20)' : ''}`
                      : 'Henüz eklenmedi'}
                  </Text>
                </View>
                <View style={{ padding: 12 }}>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: description.trim() ? pal.textPrimary : pal.textMuted, lineHeight: 20 }} numberOfLines={4}>
                    {description.trim() || 'Açıklama eklediğinde burada anlık görünecek…'}
                  </Text>
                </View>
              </View>

              {/* Adım Durumu */}
              <View style={{ marginTop: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: pal.textSecondary }}>Adım Durumu</Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: completionPercent === 100 ? '#059669' : colors.primary }}>
                    {completedCount}/{completionItems.length}
                  </Text>
                </View>
                <View style={{ gap: 6 }}>
                  {[0, 3, 6].map((startIdx) => (
                    <View key={startIdx} style={{ flexDirection: 'row', gap: 6 }}>
                      {completionItems.slice(startIdx, startIdx + 3).map((item) => (
                        <View
                          key={item.label}
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 7, borderRadius: 9, backgroundColor: item.done ? pal.successTint : pal.cardAlt, borderWidth: 1, borderColor: item.done ? pal.successBorder : pal.border, gap: 5 }}
                        >
                          <Ionicons name={item.done ? 'checkmark-circle' : 'ellipse-outline'} size={13} color={item.done ? pal.successText : pal.border} />
                          <Text style={{ fontFamily: item.done ? fonts.bold : fonts.regular, fontSize: 10, color: item.done ? pal.successText : pal.textMuted, flex: 1 }} numberOfLines={1}>
                            {item.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            </Section>

          </ScrollView>

          {/* ALT SABİT FOOTER */}
          <View
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: pal.card, borderTopWidth: 1, borderTopColor: pal.border, paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 14) }}
          >
            <View style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: pal.textSecondary }}>İlan Hazırlık Durumu</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: completionPercent === 100 ? '#059669' : colors.primary }}>
                  {completedCount}/{completionItems.length} {'\u00B7'} %{completionPercent}
                </Text>
              </View>
              <View style={{ height: 6, borderRadius: 999, backgroundColor: pal.border, overflow: 'hidden' }}>
                <View style={{ height: 6, width: `${completionPercent}%`, borderRadius: 999, backgroundColor: completionPercent === 100 ? '#059669' : colors.primary }} />
              </View>
              {missing.length > 0 ? (
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: pal.textMuted, marginTop: 5 }} numberOfLines={1}>
                  Eksik: {missing.join(', ')}
                </Text>
              ) : (
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#059669', marginTop: 5 }}>
                  Hazır. Tüm alanlar tamamlandı.
                </Text>
              )}
            </View>
            <Pressable
              onPress={() => {
                if (canPublish) { handlePublish(); return; }
                Alert.alert('Eksik alanlar', `İlan yayını için şu alanları tamamla: ${missing.join(', ')}`);
              }}
              style={{
                height: 54,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                backgroundColor: canPublish ? colors.primary : pal.border,
              }}
            >
              {canPublish ? (
                <LinearGradient colors={['#2563EB', '#1E5FC6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {submitting ? (
                  <Ionicons name="reload-outline" size={17} color="#fff" />
                ) : (
                  <Ionicons name={canPublish ? 'rocket-outline' : 'lock-closed-outline'} size={17} color={canPublish ? '#fff' : pal.textMuted} />
                )}
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: canPublish ? '#fff' : pal.textMuted }}>
                  {submitting ? 'Yayınlanıyor...' : canPublish ? 'İlanı Yayınla' : `Eksik Alan (${missing.length})`}
                </Text>
              </View>
            </Pressable>
          </View>
        </KeyboardAvoidingView>

        {/* ŞEHİR MODAL */}
        <PickerModal visible={cityModal} onClose={() => setCityModal(false)} title="Şehir" pal={pal}>
          <View style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: pal.border }}>
            <TextInput
              value={citySearch}
              onChangeText={setCitySearch}
              placeholder="Şehir ara..."
              placeholderTextColor={pal.textMuted}
              style={inputStyle}
            />
          </View>
          {filteredCities.map((c) => {
            const active = c === city;
            return (
              <Pressable
                key={c}
                onPress={() => { setCity(c); setDistrict(''); setNeighborhood(''); setDistrictSearch(''); setCityModal(false); }}
                style={{ paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: pal.borderFaint, backgroundColor: active ? pal.primaryTint : pal.card }}
              >
                <Text style={{ fontFamily: active ? fonts.bold : fonts.medium, fontSize: 14, color: active ? colors.primary : pal.textPrimary }}>{c}</Text>
                {active ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </PickerModal>

        {/* İLÇE MODAL */}
        <PickerModal visible={districtModal} onClose={() => setDistrictModal(false)} title="İlçe" pal={pal}>
          <View style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: pal.border }}>
            <TextInput
              value={districtSearch}
              onChangeText={setDistrictSearch}
              placeholder="İlçe ara..."
              placeholderTextColor={pal.textMuted}
              style={inputStyle}
            />
          </View>
          {filteredDistricts.map((item) => {
            const active = item === district;
            return (
              <Pressable
                key={item}
                onPress={() => { setDistrict(item); setDistrictModal(false); }}
                style={{ paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: pal.borderFaint, backgroundColor: active ? pal.primaryTint : pal.card }}
              >
                <Text style={{ fontFamily: active ? fonts.bold : fonts.medium, fontSize: 14, color: active ? colors.primary : pal.textPrimary }}>{item}</Text>
                {active ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
          {filteredDistricts.length === 0 ? (
            <View style={{ paddingHorizontal: 16, paddingVertical: 18 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: pal.textMuted }}>Sonuç bulunamadı.</Text>
            </View>
          ) : null}
        </PickerModal>

      </SafeAreaView>
    </>
  );
}

type PaletteType = ReturnType<typeof buildPalette>;

function Section({ title, hint, children, pal }: { title: string; hint?: string; children: ReactNode; pal: PaletteType }) {
  return (
    <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: pal.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: pal.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: pal.textPrimary }}>{title}</Text>
        {hint ? (
          <View style={{ backgroundColor: pal.cardAlt, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: pal.border }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: pal.textSecondary }}>{hint}</Text>
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Field({ label, required, children, pal }: { label: string; required?: boolean; children: ReactNode; pal: PaletteType }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 6 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: pal.textSecondary }}>{label}</Text>
        {required ? <Text style={{ color: colors.danger, fontSize: 12 }}>*</Text> : null}
      </View>
      {children}
    </View>
  );
}

function PickerModal({
  visible, onClose, title, children, pal,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  pal: PaletteType;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: pal.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '82%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: pal.border }}>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: pal.textPrimary }}>{title}</Text>
            <Pressable onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: pal.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={20} color={pal.textPrimary} />
            </Pressable>
          </View>
          <ScrollView>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}
