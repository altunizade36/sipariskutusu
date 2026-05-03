import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts } from '../src/constants/theme';
import { CategoryPicker } from '../src/components/CategoryPicker';
import { MARKETPLACE_CATEGORIES, OTHER_SUBCATEGORY_ID } from '../src/constants/marketplaceCategories';
import { useListings } from '../src/context/ListingsContext';
import { useAuth } from '../src/context/AuthContext';

const ONBOARDING_STAGES = [
  { id: 'identity', title: 'Kimlik', subtitle: 'Mağaza adı, görseller ve kategori' },
  { id: 'contact', title: 'İletişim', subtitle: 'WhatsApp, Instagram ve website' },
  { id: 'compliance', title: 'Onay', subtitle: 'Sözleşmeler ve yayın kontrolü' },
] as const;

type OnboardingStage = (typeof ONBOARDING_STAGES)[number]['id'];

const STORE_TEMPLATES = [
  {
    id: 'premium',
    name: 'Premium Butik',
    description: 'Sofistike ve modern butik mağaza',
    icon: '✨',
    colors: { primary: '#8B5CF6', bg: '#F3E8FF' },
    avatar: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=300&q=80',
    coverImage: 'https://picsum.photos/1200/600?random=1',
    data: { city: 'Istanbul', categoryId: 'women', deliveryInfo: 'Aynı gün kurye gönderi' }
  },
  {
    id: 'urban',
    name: 'Urban Style',
    description: 'Sokak modası ve günlük alışveriş',
    icon: '🎨',
    colors: { primary: '#EF4444', bg: '#FEE2E2' },
    avatar: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300&q=80',
    coverImage: 'https://picsum.photos/1200/600?random=2',
    data: { city: 'Ankara', categoryId: 'women', deliveryInfo: '2-3 gün kurye gönderi' }
  },
  {
    id: 'minimal',
    name: 'Minimal Store',
    description: 'Sade ve minimalist koleksiyonlar',
    icon: '◻️',
    colors: { primary: '#1F2937', bg: '#F3F4F6' },
    avatar: 'https://images.unsplash.com/photo-1469622905104-7aa379ee6ba0?w=300&q=80',
    coverImage: 'https://picsum.photos/1200/600?random=3',
    data: { city: 'Izmir', categoryId: 'women', deliveryInfo: '1-2 gün teslimat' }
  },
  {
    id: 'vintage',
    name: 'Vintage Corner',
    description: 'Vintage ve el sanatı ürünleri',
    icon: '🎭',
    colors: { primary: '#B45309', bg: '#FEF3C7' },
    avatar: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=300&q=80',
    coverImage: 'https://picsum.photos/1200/600?random=4',
    data: { city: 'Bursa', categoryId: 'women', deliveryInfo: 'Ulaşım üstünde kargo' }
  },
];

export default function StoreSetupScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { createStore } = useListings();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [isUsernameManuallyEdited, setIsUsernameManuallyEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [website, setWebsite] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [instagramError, setInstagramError] = useState('');
  const [deliveryInfo, setDeliveryInfo] = useState('Aynı gün kargo');
  const [categoryId, setCategoryId] = useState<string>(MARKETPLACE_CATEGORIES[0]?.id ?? 'women');
  const [subCategoryId, setSubCategoryId] = useState<string>('all');
  const [customSubCategory, setCustomSubCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [showTemplates, setShowTemplates] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [setupStage, setSetupStage] = useState<OnboardingStage>('identity');
  
  // Terms acceptance checkboxes
  const [acceptedTermsOfService, setAcceptedTermsOfService] = useState(false);
  const [acceptedPrivacyPolicy, setAcceptedPrivacyPolicy] = useState(false);
  const [acceptedKVKK, setAcceptedKVKK] = useState(false);
  const [acceptedPlatformLiability, setAcceptedPlatformLiability] = useState(false);

  useEffect(() => {
    if (user?.email && !email.trim()) {
      setEmail(user.email);
    }
  }, [email, user?.email]);

  // Instagram handle validasyonu
  function validateInstagramHandle(handle: string): string {
    if (!handle.trim()) return ''; // Opsiyonel alan
    
    const cleanHandle = handle.trim().replace(/^@+/, '');
    
    // Minimum 1 karakter
    if (cleanHandle.length < 1) {
      return 'Instagram handle en az 1 karakter olmalı';
    }
    
    // Maksimum 30 karakter (Instagram limit)
    if (cleanHandle.length > 30) {
      return 'Instagram handle en fazla 30 karakter olmalı';
    }
    
    // Sadece harf, sayı, underscore ve nokta
    if (!/^[a-zA-Z0-9_.]+$/.test(cleanHandle)) {
      return 'Instagram handle sadece harf, sayı, underscore ve nokta içerebilir';
    }
    
    // Nokta veya underscore ile başlayamaz
    if (/^[_.]/.test(cleanHandle)) {
      return 'Instagram handle nokta veya underscore ile başlayamaz';
    }
    
    // Nokta veya underscore ile bitmez
    if (/[_.]$/.test(cleanHandle)) {
      return 'Instagram handle nokta veya underscore ile bitmez';
    }
    
    return '';
  }

  function handleInstagramChange(text: string) {
    setInstagramHandle(text);
    const error = validateInstagramHandle(text);
    setInstagramError(error);
  }

  function showInfo(message: string) {
    setInfo(message);
    setTimeout(() => setInfo(''), 2000);
  }

  const identityComplete = Boolean(
    name.trim() &&
    username.trim() &&
    city.trim() &&
    description.trim() &&
    categoryId &&
    (subCategoryId !== OTHER_SUBCATEGORY_ID || customSubCategory.trim()),
  );
  const contactComplete = Boolean(email.trim() && phone.trim() && (whatsapp.trim() || instagramHandle.trim() || website.trim()));
  const complianceComplete = acceptedTermsOfService && acceptedPrivacyPolicy && acceptedKVKK && acceptedPlatformLiability;

  function goToNextStage() {
    if (setupStage === 'identity') {
      if (!identityComplete) {
        showInfo('Kimlik adımı için mağaza adı, açıklama, şehir, kategori ve gerekliyse özel alt kategori gerekli.');
        return;
      }
      setSetupStage('contact');
      return;
    }

    if (setupStage === 'contact') {
      const error = validateInstagramHandle(instagramHandle);
      if (error) {
        showInfo(error);
        return;
      }

      if (!contactComplete) {
        showInfo('İletişim adımında e-posta, telefon ve en az bir satış kanalı gerekli.');
        return;
      }

      setSetupStage('compliance');
    }
  }

  function goToPreviousStage() {
    if (setupStage === 'contact') {
      setSetupStage('identity');
      return;
    }

    if (setupStage === 'compliance') {
      setSetupStage('contact');
    }
  }

  async function pickProfileImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      showInfo('Profil resmi seçilemiyor. İzin vermeni kontrol et.');
    }
  }

  async function pickProfileImageFromCamera() {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      showInfo('Kamera seçilemiyor.');
    }
  }

  async function pickCoverImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setCoverImage(result.assets[0].uri);
      }
    } catch (error) {
      showInfo('Kapak resmi seçilemiyor. İzin vermeni kontrol et.');
    }
  }

  async function pickCoverImageFromCamera() {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setCoverImage(result.assets[0].uri);
      }
    } catch (error) {
      showInfo('Kamera seçilemiyor.');
    }
  }

  function slugifyUsername(value: string): string {
    return value
      .toLocaleLowerCase('tr-TR')
      .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
      .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
      .replace(/[^a-z0-9_.]+/g, '')
      .slice(0, 30);
  }

  function handleNameChange(value: string) {
    setName(value);
    // Otomatik kullanıcı adı önerisi — sadece kullanıcı manuel düzenlememişse
    if (!isUsernameManuallyEdited) {
      setUsername(slugifyUsername(value));
    }
  }

  function handleUsernameChange(value: string) {
    const cleaned = slugifyUsername(value);
    setUsername(cleaned);
    // Kullanıcı manuel düzenlediyse işaretle; tamamen temizlerse otomatik öneriye geri dön
    setIsUsernameManuallyEdited(cleaned.length > 0);
  }

  function applyTemplate(template: typeof STORE_TEMPLATES[0]) {
    setSelectedTemplate(template.id);
    setProfileImage(template.avatar);
    setCoverImage(template.coverImage);
    setCategoryId(template.data.categoryId);
    setSubCategoryId('all');
    setCustomSubCategory('');
    setCity(template.data.city);
    setDeliveryInfo(template.data.deliveryInfo);
    setShowTemplates(false);
    setSetupStage('identity');
    setName(template.name);
    setUsername(slugifyUsername(template.name));
    setIsUsernameManuallyEdited(false);
    setDescription(`${template.description} - Kaliteli ürünler ile hizmetinizdeyiz.`);
  }

  async function handleCreateStore() {
    if (!user) {
      showInfo('Mağaza açmak için giriş yapman gerekiyor.');
      router.push('/auth');
      return;
    }

    if (!name.trim() || !username.trim() || !city.trim() || !email.trim() || !phone.trim()) {
      showInfo('Lütfen zorunlu alanları doldur.');
      return;
    }

    // Terms acceptance validation
    if (!acceptedTermsOfService) {
      showInfo('Lütfen Satış Sözleşmesini kabul edin.');
      return;
    }
    if (!acceptedPrivacyPolicy) {
      showInfo('Lütfen Gizlilik Politikasını kabul edin.');
      return;
    }
    if (!acceptedKVKK) {
      showInfo('Lütfen KVKK Onayını kabul edin.');
      return;
    }
    if (!acceptedPlatformLiability) {
      showInfo('Lütfen Platform Sorumluluğunu kabul edin.');
      return;
    }

    // Instagram handle validasyonunu kontrol et
    const error = validateInstagramHandle(instagramHandle);
    if (error) {
      showInfo(error);
      return;
    }

    setSaving(true);
    try {
      await createStore({
        name: name.trim(),
        username: username.trim(),
        description: description.trim() || 'Mağazamıza hoş geldiniz.',
        city: city.trim(),
        email: email.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        website: website.trim(),
        defaultStock: 6,
        deliveryInfo: deliveryInfo.trim() || 'Aynı gün kargo',
        categoryId,
        avatar: profileImage || 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&q=80',
        coverImage: coverImage || 'https://images.unsplash.com/photo-1557804506-669714d2e9d8?w=1200&q=80',
        instagramHandle: instagramHandle.trim() || undefined,
        acceptedTermsOfService,
        acceptedPrivacyPolicy,
        acceptedKVKK,
        acceptedPlatformLiability,
      });

      showInfo('Mağaza kuruldu.');
      router.replace('/(tabs)/store');
    } catch (error) {
      showInfo(error instanceof Error ? error.message : 'Mağaza oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  }

  function renderStageHeader() {
    return (
      <View className="rounded-xl border border-[#33333315] bg-[#111827] p-4">
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>Satıcı / İçerik Üretici Onboarding</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: '#CBD5E1', marginTop: 4 }}>
          Mağaza kimliğini kur, satış kanallarını bağla ve son adımda yayın onaylarını tamamla.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          {ONBOARDING_STAGES.map((stage, index) => {
            const active = setupStage === stage.id;
            const completed =
              (stage.id === 'identity' && identityComplete) ||
              (stage.id === 'contact' && contactComplete) ||
              (stage.id === 'compliance' && complianceComplete);

            return (
              <Pressable
                key={stage.id}
                onPress={() => setSetupStage(stage.id)}
                style={{
                  flex: 1,
                  borderRadius: 14,
                  padding: 10,
                  backgroundColor: active ? '#FFFFFF' : 'rgba(255,255,255,0.08)',
                  borderWidth: 1,
                  borderColor: completed ? '#86EFAC' : 'rgba(255,255,255,0.16)',
                }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: active ? colors.textPrimary : '#E5E7EB' }}>
                  {index + 1}. {stage.title}
                </Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: active ? colors.textSecondary : '#CBD5E1', marginTop: 4, lineHeight: 14 }}>
                  {stage.subtitle}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  function renderIdentityStage() {
    return (
      <>
        <View className="rounded-xl border border-[#33333315] bg-white p-4">
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>Mağaza Görselleri</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
            İçerik üretici vitrinin için profil ve kapak görselini ekle.
          </Text>
        </View>

        <View className="rounded-xl border border-[#33333315] bg-white p-4">
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>Profil Resmi</Text>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={{ width: 80, height: 80, borderRadius: 40 }} />
            ) : (
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.borderLight, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="image" size={32} color={colors.textSecondary} />
              </View>
            )}
            <View style={{ flex: 1, gap: 8 }}>
              <Pressable onPress={pickProfileImage} style={{ backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: colors.primary, borderRadius: 8 }} className="h-10 items-center justify-center flex-row">
                <Ionicons name="image" size={16} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>Galeri</Text>
              </Pressable>
              <Pressable onPress={pickProfileImageFromCamera} style={{ backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: colors.primary, borderRadius: 8 }} className="h-10 items-center justify-center flex-row">
                <Ionicons name="camera" size={16} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>Kamera</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View className="rounded-xl border border-[#33333315] bg-white p-4">
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>Arka Plan Resmi</Text>
          {coverImage ? (
            <Image source={{ uri: coverImage }} style={{ width: '100%', height: 140, borderRadius: 8, marginBottom: 12 }} />
          ) : (
            <View style={{ width: '100%', height: 140, borderRadius: 8, backgroundColor: colors.borderLight, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="image" size={40} color={colors.textSecondary} />
            </View>
          )}
          <View style={{ gap: 8 }}>
            <Pressable onPress={pickCoverImage} style={{ backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: colors.primary, borderRadius: 8 }} className="h-10 items-center justify-center flex-row">
              <Ionicons name="image" size={16} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>Galeri</Text>
            </Pressable>
            <Pressable onPress={pickCoverImageFromCamera} style={{ backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: colors.primary, borderRadius: 8 }} className="h-10 items-center justify-center flex-row">
              <Ionicons name="camera" size={16} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>Kamera</Text>
            </Pressable>
          </View>
        </View>

        <View className="rounded-xl border border-[#33333315] bg-white p-4">
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>Mağaza Kimliği</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
            Mağazanı pazaryerinde nasıl konumlandıracağını belirle.
          </Text>
        </View>

        {[
          { label: 'Mağaza Adı *', value: name, setValue: handleNameChange, placeholder: 'Örn. ModaStore Türkiye', maxLength: 60, hint: 'Ad değiştikçe kullanıcı adı otomatik önerilir.' },
          { label: 'Kullanıcı Adı *', value: username, setValue: handleUsernameChange, placeholder: 'Örn. modastoretr', maxLength: 30, hint: 'Sadece harf, rakam, nokta ve alt çizgi.' },
          { label: 'Şehir *', value: city, setValue: setCity, placeholder: 'Örn. İstanbul', maxLength: 40 },
          { label: 'Açıklama *', value: description, setValue: setDescription, placeholder: 'Ne satıyorsun, hangi stile hitap ediyorsun?', maxLength: 200 },
        ].map((field) => (
          <View key={field.label} className="rounded-xl border border-[#33333315] bg-white p-3">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{field.label}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: (field.value?.length || 0) > field.maxLength * 0.9 ? '#EF4444' : colors.textMuted }}>
                {(field.value?.length || 0)}/{field.maxLength}
              </Text>
            </View>
            <TextInput
              value={field.value}
              onChangeText={field.setValue}
              showSoftInputOnFocus
              autoCorrect={field.label !== 'Kullanıcı Adı *'}
              autoCapitalize={field.label === 'Kullanıcı Adı *' ? 'none' : 'sentences'}
              placeholder={field.placeholder}
              placeholderTextColor={colors.textMuted}
              maxLength={field.maxLength}
              style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary }}
              className="mt-2 rounded-xl border border-[#33333315] bg-[#F7F7F7] px-3 py-3"
              multiline={field.label === 'Açıklama *'}
            />
            {field.hint ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textMuted, marginTop: 6 }}>
                {field.hint}
              </Text>
            ) : null}
          </View>
        ))}

        <View className="rounded-xl border border-[#33333315] bg-white p-3">
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>Kategori</Text>
          <View className="mt-2">
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
          </View>
        </View>

        <Pressable onPress={goToNextStage} style={{ backgroundColor: colors.primary }} className="h-12 rounded-xl items-center justify-center mt-1">
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>İletişim Adımına Geç</Text>
        </Pressable>
      </>
    );
  }

  function renderContactStage() {
    return (
      <>
        <View className="rounded-xl border border-[#33333315] bg-white p-4">
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>İletişim ve Dönüşüm Kanalları</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
            Satışın uygulama içi mesaj, WhatsApp ve dış bağlantı akışlarında tutarlı görünsün.
          </Text>
        </View>

        {[
          { label: 'E-posta *', value: email, setValue: setEmail, placeholder: 'Örn. magaza@email.com', keyboardType: 'email-address' as const },
          { label: 'Telefon *', value: phone, setValue: setPhone, placeholder: 'Örn. 05xx xxx xx xx', keyboardType: 'phone-pad' as const },
          { label: 'WhatsApp', value: whatsapp, setValue: setWhatsapp, placeholder: 'Örn. 05xx xxx xx xx', keyboardType: 'phone-pad' as const },
          { label: 'Website', value: website, setValue: setWebsite, placeholder: 'Örn. https://magazaniz.com', keyboardType: 'url' as const },
          { label: 'Teslimat Bilgisi', value: deliveryInfo, setValue: setDeliveryInfo, placeholder: 'Örn. Aynı gün kargo', keyboardType: 'default' as const },
        ].map((field) => (
          <View key={field.label} className="rounded-xl border border-[#33333315] bg-white p-3">
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{field.label}</Text>
            <TextInput
              value={field.value}
              onChangeText={field.setValue}
              showSoftInputOnFocus
              autoCorrect={false}
              autoCapitalize={field.label === 'E-posta *' || field.label === 'Website' ? 'none' : 'sentences'}
              keyboardType={field.keyboardType}
              placeholder={field.placeholder}
              placeholderTextColor={colors.textMuted}
              style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary }}
              className="mt-2 h-11 rounded-xl border border-[#33333315] bg-[#F7F7F7] px-3"
            />
          </View>
        ))}

        <View className="rounded-xl border border-[#33333315] bg-white p-3">
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>Instagram Handle</Text>
          <TextInput
            value={instagramHandle}
            onChangeText={handleInstagramChange}
            showSoftInputOnFocus
            autoCorrect={false}
            autoCapitalize="none"
            placeholder="Örn. satici.dukkani"
            placeholderTextColor={colors.textMuted}
            style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary }}
            className={`mt-2 h-11 rounded-xl border px-3 bg-[#F7F7F7] ${instagramError ? 'border-red-500' : 'border-[#33333315]'}`}
          />
          {instagramError ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: '#EF4444', marginTop: 6 }}>
              {instagramError}
            </Text>
          ) : null}
        </View>

        <View className="rounded-xl border border-[#33333315] bg-[#F0F9FF] p-4">
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>Satış Kanalı Önerisi</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
            {whatsapp.trim()
              ? 'WhatsApp hazır. Ürün detaylarında hızlı dış iletişim aktif olacak.'
              : instagramHandle.trim()
                ? 'Instagram bağlı. Satıcı profili içerik üretici kimliğiyle daha güçlü görünecek.'
                : website.trim()
                  ? 'Website bağlı. Trafiği doğrudan kendi satış kanalına yönlendirebilirsin.'
                  : 'En az bir iletişim kanalı ekle; dönüşüm akışı bunun üzerinden güçlenecek.'}
          </Text>
        </View>

        <View className="flex-row" style={{ gap: 10 }}>
          <Pressable onPress={goToPreviousStage} className="h-12 flex-1 rounded-xl items-center justify-center border border-[#CBD5E1] bg-white">
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>Geri</Text>
          </Pressable>
          <Pressable onPress={goToNextStage} style={{ backgroundColor: colors.primary }} className="h-12 flex-1 rounded-xl items-center justify-center">
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>Onay Adımına Geç</Text>
          </Pressable>
        </View>
      </>
    );
  }

  function renderComplianceStage() {
    return (
      <>
        <View className="rounded-xl border border-[#33333315] bg-[#F0F9FF] p-4">
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>Yayına Hazır Kontrol Listesi</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
            Kimlik ve iletişim adımların tamamlandıysa mağaza vitrini yayına alınmaya hazır. Son adımda yasal onayları tamamla.
          </Text>
          <View style={{ marginTop: 12, gap: 8 }}>
            {[
              { label: 'Kimlik adımı', complete: identityComplete },
              { label: 'İletişim adımı', complete: contactComplete },
              { label: 'Instagram handle doğrulaması', complete: !instagramError },
            ].map((item) => (
              <View key={item.label} className="flex-row items-center" style={{ gap: 8 }}>
                <Ionicons name={item.complete ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={item.complete ? '#16A34A' : colors.textSecondary} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textPrimary }}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="rounded-xl border border-[#33333315] bg-white p-4">
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, marginBottom: 12 }}>
            Şartlar ve Koşullar
          </Text>
          {[
            {
              value: acceptedTermsOfService,
              setValue: setAcceptedTermsOfService,
              label: 'Satış Sözleşmesini kabul ediyorum',
              linkLabel: 'Satış Sözleşmesi',
              doc: 'terms-of-use' as const,
            },
            {
              value: acceptedPrivacyPolicy,
              setValue: setAcceptedPrivacyPolicy,
              label: 'Gizlilik Politikasını kabul ediyorum',
              linkLabel: 'Gizlilik Politikası',
              doc: 'privacy-kvkk' as const,
            },
            {
              value: acceptedKVKK,
              setValue: setAcceptedKVKK,
              label: 'KVKK onayını kabul ediyorum',
              linkLabel: 'KVKK (Kişisel Verileri Koruma)',
              doc: 'privacy-kvkk' as const,
            },
            {
              value: acceptedPlatformLiability,
              setValue: setAcceptedPlatformLiability,
              label: 'Platform sorumluluk reddi beyanını kabul ediyorum',
              linkLabel: 'Sorumluluk Reddi Beyanı',
              doc: 'platform-liability' as const,
            },
          ].map((item, index) => (
            <View key={item.label} style={{ marginBottom: index < 3 ? 14 : 0 }}>
              <Pressable
                onPress={() => item.setValue(!item.value)}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
              >
                <View
                  style={{ marginTop: 2 }}
                  className={`w-6 h-6 rounded border-2 items-center justify-center ${item.value ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'}`}
                >
                  {item.value ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary }}>
                    {item.label}
                  </Text>
                  <Pressable
                    onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: item.doc } })}
                    style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 3 }}
                    hitSlop={8}
                  >
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>
                      {item.linkLabel}
                    </Text>
                    <Ionicons name="open-outline" size={12} color={colors.primary} />
                  </Pressable>
                </View>
              </Pressable>
            </View>
          ))}

          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 12 }}>
            Yukarıdaki tüm şartları kabul ederek, platform sorumluluklarını ve kendi satıcı yükümlülüklerini anladığını beyan edersin.
          </Text>
        </View>

        <Pressable
          onPress={handleCreateStore}
          disabled={saving}
          style={{ backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }}
          className="h-12 rounded-xl items-center justify-center mt-1"
        >
          {saving ? (
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>Oluşturuluyor...</Text>
            </View>
          ) : (
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>Mağaza Aç</Text>
          )}
        </Pressable>

        <Pressable onPress={goToPreviousStage} className="h-12 rounded-xl items-center justify-center border border-[#CBD5E1] bg-white mt-2">
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>İletişim Adımına Dön</Text>
        </Pressable>
      </>
    );
  }

  function renderOnboardingStage() {
    return (
      <>
        {renderStageHeader()}
        {setupStage === 'identity' ? renderIdentityStage() : null}
        {setupStage === 'contact' ? renderContactStage() : null}
        {setupStage === 'compliance' ? renderComplianceStage() : null}
      </>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
      <View className="bg-white px-3 py-2 border-b border-[#33333315] flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.textPrimary }} className="ml-2">
            Mağaza Kurulumu
          </Text>
        </View>
        {!showTemplates && (
          <Pressable onPress={() => setShowTemplates(true)} className="flex-row items-center px-2 py-1 rounded-lg bg-blue-50">
            <Ionicons name="refresh" size={14} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.primary }}>Seçimi Yenile</Text>
          </Pressable>
        )}
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 12, gap: 10 }} keyboardShouldPersistTaps="handled">
        {showTemplates ? (
          <>
            <View className="rounded-xl border border-[#33333315] bg-white p-4">
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>🎨 Mağaza Şablonlarını Seç</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                Bir şablon seç ve otomatik olarak kişiselleştirilsin veya sıfırdan başla.
              </Text>
            </View>

            {STORE_TEMPLATES.map((template) => (
              <Pressable key={template.id} onPress={() => applyTemplate(template)}>
                <View className="rounded-xl border border-[#33333315] bg-white overflow-hidden">
                  <Image
                    source={{ uri: template.coverImage }}
                    style={{ width: '100%', height: 180 }}
                    className="bg-gray-200"
                  />
                  <View className="p-4">
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>
                      {template.icon} {template.name}
                    </Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      {template.description}
                    </Text>
                    <View className="flex-row items-center mt-3 pt-3 border-t border-[#33333315]">
                      {template.avatar && (
                        <Image
                          source={{ uri: template.avatar }}
                          style={{ width: 32, height: 32, borderRadius: 16 }}
                          className="mr-2"
                        />
                      )}
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>
                        Bu Şablonu Kullan →
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}

            <Pressable onPress={() => setShowTemplates(false)} style={{ backgroundColor: colors.primary }} className="h-12 rounded-xl items-center justify-center mt-2">
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>Sıfırdan Başla</Text>
            </Pressable>
          </>
        ) : renderOnboardingStage()}
      </ScrollView>

      {info ? (
        <View className="absolute bottom-6 left-4 right-4 rounded-xl bg-[#111827] px-4 py-3">
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: '#fff', textAlign: 'center' }}>{info}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}