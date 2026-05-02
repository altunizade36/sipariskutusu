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

export default function CreateListingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { addListing, hasStore, reloadProducts } = useListings();
  const uploadProgress = useUploadProgress();
  const insets = useSafeAreaInsets();
  const [storeCheckLoading, setStoreCheckLoading] = useState(true);

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
    if (!selectedCategory) {
      return '';
    }

    const found = selectedCategory.subcategories.find((item) => item.id === subCategoryId);
    if (!found) {
      return '';
    }

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
      photos.length,
      title,
      descriptionValid,
      categoryId,
      subCategoryId,
      customSubCategory,
      priceValid,
      delivery.length,
      city,
      district,
      neighborhood,
    ],
  );
  const completedCount = completionItems.filter((item) => item.done).length;
  const completionPercent = Math.round((completedCount / completionItems.length) * 100);
  const filteredCities = useMemo(() => {
    const query = citySearch.trim().toLocaleLowerCase('tr-TR');
    if (!query) {
      return CITY_LIST;
    }

    return CITY_LIST.filter((item) => item.toLocaleLowerCase('tr-TR').includes(query));
  }, [citySearch]);
  const filteredDistricts = useMemo(() => {
    const query = districtSearch.trim().toLocaleLowerCase('tr-TR');
    if (!query) {
      return districtList;
    }

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

  // Store check loading — wait briefly for ListingsContext to hydrate hasStore
  useEffect(() => {
    const timer = setTimeout(() => setStoreCheckLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;

    const loadDraft = async () => {
      try {
        const serialized = await AsyncStorage.getItem(CREATE_LISTING_DRAFT_KEY);
        if (!serialized || !active) {
          return;
        }

        const parsed = normalizeDraft(JSON.parse(serialized));
        if (!parsed) {
          return;
        }

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
          const migratedDraft: CreateListingDraft = {
            ...parsed,
            version: CREATE_LISTING_DRAFT_VERSION,
          };
          AsyncStorage.setItem(CREATE_LISTING_DRAFT_KEY, JSON.stringify(migratedDraft)).catch(() => {
            // Migration write-back hatası akışı bloklamamalı.
          });
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
        if (active) {
          setDraftReady(true);
        }
      }
    };

    void loadDraft();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!draftReady) {
      return;
    }

    const isDefaultFormState =
      photos.length === 0 &&
      coverIndex === 0 &&
      !title.trim() &&
      !description.trim() &&
      condition === 'Yeni' &&
      categoryId === (MARKETPLACE_CATEGORIES[0]?.id ?? 'women') &&
      subCategoryId === 'all' &&
      !customSubCategory.trim() &&
      !sizeVariants.trim() &&
      !colorVariants.trim() &&
      !price.trim() &&
      bargaining === false &&
      delivery.length === 1 &&
      delivery[0] === 'Kargo' &&
      freeShipping === false &&
      !city.trim() &&
      !district.trim() &&
      !neighborhood.trim();

    if (isDefaultFormState) {
      AsyncStorage.removeItem(CREATE_LISTING_DRAFT_KEY).catch(() => {
        // Taslak silme hatası kullanıcı akışını kesmemeli.
      });
      return;
    }

    const payload: CreateListingDraft = {
      version: CREATE_LISTING_DRAFT_VERSION,
      photos,
      coverIndex,
      title,
      description,
      condition,
      categoryId,
      subCategoryId,
      customSubCategory,
      sizeVariants,
      colorVariants,
      price,
      bargaining,
      delivery,
      freeShipping,
      city,
      district,
      neighborhood,
    };

    AsyncStorage.setItem(CREATE_LISTING_DRAFT_KEY, JSON.stringify(payload)).catch(() => {
      // Taslak yazım hatası yayınlama akışını bloklamamalı.
    });
  }, [
    draftReady,
    photos,
    coverIndex,
    title,
    description,
    condition,
    categoryId,
    subCategoryId,
    customSubCategory,
    sizeVariants,
    colorVariants,
    price,
    bargaining,
    delivery,
    freeShipping,
    city,
    district,
    neighborhood,
  ]);

  const clearDraft = async () => {
    await AsyncStorage.removeItem(CREATE_LISTING_DRAFT_KEY).catch(() => undefined);
    setPhotos([]);
    setCoverIndex(0);
    setTitle('');
    setDescription('');
    setCondition('Yeni');
    setCategoryId(MARKETPLACE_CATEGORIES[0]?.id ?? 'women');
    setSubCategoryId('all');
    setCustomSubCategory('');
    setSizeVariants('');
    setColorVariants('');
    setPrice('');
    setBargaining(false);
    setDelivery(['Kargo']);
    setFreeShipping(false);
    setCity('');
    setDistrict('');
    setNeighborhood('');
    setCitySearch('');
    setDistrictSearch('');
    setDraftRestored(false);
  };

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
    setDelivery((prev) => {
      const next = prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d];
      if (!next.includes('Kargo')) {
        setFreeShipping(false);
      }
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
      if (sizeVariants.trim()) {
        variantLines.push(`Beden: ${sizeVariants.trim()}`);
      }
      if (colorVariants.trim()) {
        variantLines.push(`Renk: ${colorVariants.trim()}`);
      }

      const descriptionWithVariants = [baseDescription, variantLines.length > 0 ? `Varyantlar\n${variantLines.join('\n')}` : '']
        .filter(Boolean)
        .join('\n\n');

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
          customSubCategory:
            subCategoryId === OTHER_SUBCATEGORY_ID ? customSubCategory.trim() : undefined,
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

        // Satıcıya "İlanınız yayına alındı" bildirimi gönder
        createInAppNotification(
          user.id,
          'listing_approved',
          'İlanınız yayına alındı 🎉',
          `"${title.trim()}" başlıklı ilanınız başarıyla yayına alındı.`,
          { listingId: created.id },
        ).catch(() => undefined);

        // Ana sayfayı yenile
        reloadProducts();

        Alert.alert('Yayınlandı! 🎉', 'İlanın yayına alındı. Mağazan ve akıştaki yerini almaya başlıyor.', [
          { text: 'İlanı Gör', onPress: () => router.replace(`/product/${created.id}`) },
        ]);
      } else {
        // Fallback: use local context
        const orderedMedia = coverIndex > 0
          ? [photos[coverIndex], ...photos.filter((_, i) => i !== coverIndex)]
          : photos;

        const created = addListing({
          title: title.trim(),
          description: descriptionWithVariants,
          price: priceNumber,
          categoryId: selectedCategory?.id ?? '',
          condition,
          location: city,
          district,
          delivery,
          freeShipping,
          imageUri: orderedMedia[0],
          mediaUris: orderedMedia,
          stock: 1,
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
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-8" edges={['top', 'bottom']}>
        <Ionicons name="person-circle-outline" size={72} color={colors.textMuted} />
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 20, color: colors.textPrimary, marginTop: 16, textAlign: 'center' }}>
          Giriş Yapmalısın
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
          İlan yayınlamak için önce hesabına giriş yapmalısın.
        </Text>
        <Pressable
          onPress={() => router.push({ pathname: '/auth', params: { redirect: '/create-listing' } })}
          style={{ marginTop: 28, height: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>Giriş Yap</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // --- Mağaza yüklenirken ---
  if (storeCheckLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center" edges={['top', 'bottom']}>
        <View className="items-center gap-4">
          <Ionicons name="storefront-outline" size={56} color={colors.primary} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted }}>Mağaza bilgisi kontrol ediliyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // --- Mağazası yoksa kapı göster ---
  if (!hasStore) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
        <View className="flex-row items-center px-4 h-12 border-b border-[#33333315]">
          <Pressable onPress={() => router.replace('/(tabs)')} className="w-10 h-10 items-center justify-center -ml-2">
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </Pressable>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.textPrimary, marginLeft: 4 }}>İlan Ver</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <View style={{ width: 96, height: 96, borderRadius: 24, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Ionicons name="storefront-outline" size={48} color={colors.primary} />
          </View>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: colors.textPrimary, textAlign: 'center' }}>
            Önce mağazanı oluştur
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 12, lineHeight: 22 }}>
            İlan yayınlamak için önce bir satıcı mağazası oluşturman gerekiyor. Mağazanı kurduktan sonra dilediğin kadar ilan verebilirsin.
          </Text>
          <View style={{ marginTop: 12, backgroundColor: '#F0FDF4', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#D1FAE5', width: '100%' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#065F46', marginBottom: 6 }}>Mağaza açınca şunları yapabilirsin:</Text>
            {['Manuel ilan yayınla', 'Instagram içeriklerini ürüne çevir', 'Mağaza profili oluştur', 'Sipariş ve mesajları yönet'].map((item) => (
              <View key={item} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <Ionicons name="checkmark-circle" size={14} color="#059669" />
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: '#047857' }}>{item}</Text>
              </View>
            ))}
          </View>
          <Pressable
            onPress={() => router.push('/store-setup')}
            style={{ marginTop: 28, height: 54, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', width: '100%', flexDirection: 'row', gap: 8 }}
          >
            <Ionicons name="storefront" size={20} color="#fff" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>Mağaza Oluştur</Text>
          </Pressable>
          <Pressable onPress={() => router.replace('/(tabs)')} style={{ marginTop: 14, height: 44, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>Şimdi Değil</Text>
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
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 h-12 bg-white border-b border-[#33333315]">
        <Pressable onPress={() => router.replace('/(tabs)')} className="w-10 h-10 items-center justify-center -ml-2">
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.textPrimary }}>
          İlan Ver
        </Text>
        <View className="w-10" />
      </View>

      <View className="px-4 py-2 bg-white border-b border-[#33333310] flex-row items-center justify-between">
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: draftRestored ? '#047857' : colors.textMuted }}>
          {draftRestored ? 'Taslak geri yüklendi. Düzenlemeye devam edebilirsin.' : 'Düzenlemeler otomatik taslak olarak kaydedilir.'}
        </Text>
        <Pressable onPress={() => void clearDraft()} className="h-7 px-3 rounded-full bg-[#F7F7F7] border border-[#E2E8F0] items-center justify-center">
          <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.textSecondary }}>Taslağı Temizle</Text>
        </Pressable>
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
                if (nextSubCategoryId !== OTHER_SUBCATEGORY_ID) {
                  setCustomSubCategory('');
                }
              }}
              onChangeCustomSubCategory={setCustomSubCategory}
            />
          </Section>

          <Section title="Varyantlar" hint="Opsiyonel: or. S,M,L ve Siyah,Beyaz">
            <Field label="Beden Seçenekleri">
              <TextInput
                value={sizeVariants}
                onChangeText={setSizeVariants}
                placeholder="Orn: S, M, L, XL"
                placeholderTextColor={colors.textMuted}
                style={inputStyle}
              />
            </Field>
            <Field label="Renk Seçenekleri">
              <TextInput
                value={colorVariants}
                onChangeText={setColorVariants}
                placeholder="Orn: Siyah, Beyaz"
                placeholderTextColor={colors.textMuted}
                style={inputStyle}
              />
            </Field>
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

            {delivery.includes('Kargo') ? (
              <View className="flex-row items-center justify-between mt-3 p-3 rounded-xl" style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }}>
                <View className="pr-3 flex-1">
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>
                    Ücretsiz Kargo etiketi
                  </Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                    Sadece ilanda etiket olarak görünür. Takip/operasyon süreci platformda yürütülmez.
                  </Text>
                </View>
                <Switch
                  value={freeShipping}
                  onValueChange={setFreeShipping}
                  trackColor={{ false: '#E2E8F0', true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>
            ) : null}

            <Field label="Şehir" required>
              <Pressable onPress={() => setCityModal(true)} style={selectorStyle}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: city ? colors.textPrimary : colors.textMuted }}>
                  {city || 'Şehir seç'}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            </Field>

            <Field label="İlçe" required>
              <Pressable
                onPress={() => {
                  if (!city) {
                    Alert.alert('Önce şehir seç', 'İlçe listesini açmak için önce şehir seçmelisin.');
                    return;
                  }
                  setDistrictModal(true);
                }}
                style={[selectorStyle, !city && { opacity: 0.65 }]}
              >
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: district ? colors.textPrimary : colors.textMuted }}>
                  {district || (city ? 'İlçe seç' : 'Önce şehir seç')}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            </Field>

            <Field label="Mahalle / Semt">
              <TextInput
                value={neighborhood}
                onChangeText={setNeighborhood}
                placeholder="Örn: Atatürk Mahallesi"
                placeholderTextColor={colors.textMuted}
                style={inputStyle}
              />
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
          <Section title="Canlı Önizleme" hint={`%${completionPercent} tamamlandı`}>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#059669' }}>CANLI</Text>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: colors.textMuted }}>
                    {photos.length} fotoğraf
                  </Text>
                </View>
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
                    {locationLabel || 'Konum'} · {condition}
                  </Text>
                </View>
              </View>
            </View>

            <View className="mt-3 flex-row flex-wrap" style={{ gap: 8 }}>
              <View style={previewChipStyle}>
                <Text style={previewChipTextStyle}>{selectedCategory?.name || 'Kategori'}</Text>
              </View>
              {selectedSubCategoryName ? (
                <View style={previewChipStyle}>
                  <Text style={previewChipTextStyle}>{selectedSubCategoryName}</Text>
                </View>
              ) : null}
              {delivery.map((item) => (
                <View key={item} style={previewChipStyle}>
                  <Text style={previewChipTextStyle}>{item}</Text>
                </View>
              ))}
              {bargaining ? (
                <View style={[previewChipStyle, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <Text style={[previewChipTextStyle, { color: '#047857' }]}>Pazarlık Var</Text>
                </View>
              ) : null}
            </View>

            <View className="mt-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}>
                Açıklama Önizlemesi
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textPrimary }} numberOfLines={3}>
                {description.trim() || 'Açıklama eklediğinde burada anlık görünecek.'}
              </Text>
            </View>

            <View className="mt-3">
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary, marginBottom: 6 }}>
                Adım Durumu
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {completionItems.map((item) => (
                  <View
                    key={item.label}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: item.done ? '#A7F3D0' : '#E2E8F0',
                      backgroundColor: item.done ? '#ECFDF5' : '#fff',
                    }}
                  >
                    <Ionicons
                      name={item.done ? 'checkmark-circle' : 'ellipse-outline'}
                      size={12}
                      color={item.done ? '#059669' : colors.textMuted}
                    />
                    <Text
                      style={{
                        fontFamily: item.done ? fonts.bold : fonts.medium,
                        fontSize: 11,
                        color: item.done ? '#047857' : colors.textSecondary,
                        marginLeft: 6,
                      }}
                    >
                      {item.label}
                    </Text>
                  </View>
                ))}
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
            paddingBottom: Math.max(insets.bottom, 14),
          }}
        >
          <View style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary }}>
                İlan Hazırlık Durumu
              </Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary }}>
                {completedCount}/{completionItems.length} · %{completionPercent}
              </Text>
            </View>
            <View style={{ height: 6, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' }}>
              <View
                style={{
                  height: 6,
                  width: `${completionPercent}%`,
                  borderRadius: 999,
                  backgroundColor: completionPercent === 100 ? '#059669' : colors.primary,
                }}
              />
            </View>
            {missing.length > 0 ? (
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginTop: 6 }}>
                Eksik: {missing.join(', ')}
              </Text>
            ) : (
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#047857', marginTop: 6 }}>
                Hazır. Tüm alanlar tamamlandı.
              </Text>
            )}
          </View>
          <Pressable
            onPress={() => {
              if (canPublish) {
                handlePublish();
                return;
              }

              Alert.alert('Eksik alanlar', `Ilan yayini icin su alanlari tamamla: ${missing.join(', ')}`);
            }}
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

      {/* ŞEHİR MODAL */}
      <PickerModal
        visible={cityModal}
        onClose={() => setCityModal(false)}
        title="Şehir"
      >
        <View style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
          <TextInput
            value={citySearch}
            onChangeText={setCitySearch}
            placeholder="Şehir ara"
            placeholderTextColor={colors.textMuted}
            style={inputStyle}
          />
        </View>
        {filteredCities.map((c) => {
          const active = c === city;
          return (
            <Pressable
              key={c}
              onPress={() => {
                setCity(c);
                setDistrict('');
                setNeighborhood('');
                setDistrictSearch('');
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

      <PickerModal
        visible={districtModal}
        onClose={() => setDistrictModal(false)}
        title="İlçe"
      >
        <View style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
          <TextInput
            value={districtSearch}
            onChangeText={setDistrictSearch}
            placeholder="İlçe ara"
            placeholderTextColor={colors.textMuted}
            style={inputStyle}
          />
        </View>
        {filteredDistricts.map((item) => {
          const active = item === district;
          return (
            <Pressable
              key={item}
              onPress={() => {
                setDistrict(item);
                setDistrictModal(false);
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
                {item}
              </Text>
              {active ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
        {filteredDistricts.length === 0 ? (
          <View style={{ paddingHorizontal: 16, paddingVertical: 18 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted }}>
              Sonuc bulunamadi.
            </Text>
          </View>
        ) : null}
      </PickerModal>
    </SafeAreaView>
    </>
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

const previewChipStyle = {
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: '#DBEAFE',
  backgroundColor: '#EFF6FF',
} as const;

const previewChipTextStyle = {
  fontFamily: fonts.medium,
  fontSize: 11,
  color: colors.primary,
} as const;
