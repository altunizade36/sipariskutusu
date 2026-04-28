import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Image, ActivityIndicator, Modal, FlatList, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts } from '../src/constants/theme';
import { useListings } from '../src/context/ListingsContext';
import { useAuth } from '../src/context/AuthContext';

const PROFILE_ICONS = [
  { id: 'default', emoji: '👤', name: 'Varsayılan' },
  { id: 'woman', emoji: '👩', name: 'Kadın' },
  { id: 'man', emoji: '👨', name: 'Erkek' },
  { id: 'heart', emoji: '❤️', name: 'Kalp' },
  { id: 'star', emoji: '⭐', name: 'Yıldız' },
  { id: 'flower', emoji: '🌸', name: 'Çiçek' },
  { id: 'tree', emoji: '🌳', name: 'Ağaç' },
  { id: 'leaf', emoji: '🍃', name: 'Yaprak' },
  { id: 'butterfly', emoji: '🦋', name: 'Kelebek' },
  { id: 'bee', emoji: '🐝', name: 'Arı' },
  { id: 'bird', emoji: '🐦', name: 'Kuş' },
  { id: 'cat', emoji: '🐱', name: 'Kedi' },
  { id: 'dog', emoji: '🐶', name: 'Köpek' },
  { id: 'shopping', emoji: '🛍️', name: 'Alışveriş' },
  { id: 'gift', emoji: '🎁', name: 'Hediye' },
  { id: 'sparkle', emoji: '✨', name: 'Işıltı' },
];

export default function StoreSettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { sellerStore, updateStoreProfile } = useListings();

  const [storeName, setStoreName] = useState(sellerStore?.name ?? '');
  const [bio, setBio] = useState(sellerStore?.description ?? '');
  const [location, setLocation] = useState(sellerStore?.city ?? '');
  const [whatsapp, setWhatsapp] = useState(sellerStore?.whatsapp ?? '');
  const [website, setWebsite] = useState(sellerStore?.website ?? '');
  const [instagramHandle, setInstagramHandle] = useState(sellerStore?.instagramHandle ?? '');
  const [profileImage, setProfileImage] = useState(sellerStore?.avatar ?? '');
  const [coverImage, setCoverImage] = useState(sellerStore?.coverImage ?? '');
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [expandedProfile, setExpandedProfile] = useState(false);
  const [expandedCover, setExpandedCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState('');

  useEffect(() => {
    setStoreName(sellerStore?.name ?? '');
    setBio(sellerStore?.description ?? '');
    setLocation(sellerStore?.city ?? '');
    setWhatsapp(sellerStore?.whatsapp ?? '');
    setWebsite(sellerStore?.website ?? '');
    setInstagramHandle(sellerStore?.instagramHandle ?? '');
    setProfileImage(sellerStore?.avatar ?? '');
    setCoverImage(sellerStore?.coverImage ?? '');
    setSelectedIcon(null);
  }, [sellerStore]);

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
        <View className="flex-1 px-5 items-center justify-center">
          <View className="w-16 h-16 rounded-full bg-[#DBEAFE] items-center justify-center">
            <Ionicons name="lock-closed-outline" size={30} color={colors.primary} />
          </View>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: colors.textPrimary, marginTop: 16 }}>
            Giriş Gerekli
          </Text>
          <Text
            style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 }}
          >
            Mağaza ayarlarını görüntülemek için önce giriş yapman gerekiyor.
          </Text>

          <View className="w-full mt-6 gap-2">
            <Pressable
              onPress={() => router.replace('/auth')}
              style={{ backgroundColor: colors.primary }}
              className="h-12 rounded-xl items-center justify-center"
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>
                Giriş Yap
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.back()}
              style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
              className="h-12 rounded-xl border items-center justify-center"
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>
                Geri Dön
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  function showInfo(message: string) {
    setInfo(message);
    setTimeout(() => setInfo(''), 2000);
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
        setSelectedIcon(null);
      }
    } catch (error) {
      showInfo('Resim seçilemiyor.');
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
      showInfo('Resim seçilemiyor.');
    }
  }

  async function handleSave() {
    if (!storeName.trim() || !bio.trim() || !location.trim()) {
      showInfo('Tüm alanları doldur.');
      return;
    }

    setSaving(true);
    try {
      const avatar = selectedIcon
        ? PROFILE_ICONS.find((i) => i.id === selectedIcon)?.emoji || '👤'
        : profileImage;

      if (updateStoreProfile) {
        await updateStoreProfile({
          name: storeName.trim(),
          description: bio.trim(),
          city: location.trim(),
          avatar: avatar,
          coverImage: coverImage,
          whatsapp: whatsapp.trim(),
          website: website.trim(),
          instagramHandle: instagramHandle.trim(),
        });
      }

      showInfo('Profil güncellendi.');
      setTimeout(() => router.back(), 1000);
    } catch (error) {
      showInfo(error instanceof Error ? error.message : 'Profil güncellenemedi.');
    } finally {
      setSaving(false);
    }
  }

  if (!sellerStore) {
    return (
      <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
        <View className="flex-1 px-5 items-center justify-center">
          <View className="w-16 h-16 rounded-full bg-[#DBEAFE] items-center justify-center">
            <Ionicons name="storefront-outline" size={30} color={colors.primary} />
          </View>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: colors.textPrimary, marginTop: 16 }}>
            Mağaza Bulunamadı
          </Text>
          <Text
            style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 }}
          >
            Mağaza ayarlarını kullanabilmek için önce mağaza kurulumunu tamamlaman gerekiyor.
          </Text>

          <View className="w-full mt-6 gap-2">
            <Pressable
              onPress={() => router.replace('/store-setup')}
              style={{ backgroundColor: colors.primary }}
              className="h-12 rounded-xl items-center justify-center"
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>
                Mağaza Kurulumuna Git
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.back()}
              style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
              className="h-12 rounded-xl border items-center justify-center"
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>
                Geri Dön
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const profileEmoji = selectedIcon
    ? PROFILE_ICONS.find((i) => i.id === selectedIcon)?.emoji
    : '👤';

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
      <View className="bg-white px-3 py-2 border-b border-[#33333315] flex-row items-center">
        <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.textPrimary }} className="flex-1 ml-2">
          Mağaza Düzenle
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 12, gap: 10 }} keyboardShouldPersistTaps="handled">
        {/* Arka Plan Resmi */}
        <Pressable
          onPress={() => setExpandedCover(!expandedCover)}
          className="rounded-xl overflow-hidden bg-white border border-[#33333315]"
        >
          {coverImage ? (
            <View className="relative">
              <Image source={{ uri: coverImage }} style={{ width: '100%', height: 180 }} className="bg-gray-200" />
              <View className="absolute inset-0 bg-black/20 items-center justify-center">
                <Ionicons name={expandedCover ? 'chevron-up' : 'chevron-down'} size={28} color="#fff" />
              </View>
            </View>
          ) : (
            <Pressable 
              onPress={() => setExpandedCover(!expandedCover)}
              style={{ width: '100%', height: 180, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' }}
            >
              <View className="items-center">
                <Ionicons name="image" size={40} color={colors.textSecondary} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                  {expandedCover ? 'Kapat' : 'Açmak için tıkla'}
                </Text>
              </View>
            </Pressable>
          )}

          {expandedCover ? (
            <View className="p-4 bg-white border-t border-[#33333315]">
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>Arka Plan Resmi</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                Mağaza kapak görselini seç
              </Text>
              <View style={{ gap: 8, marginTop: 12 }}>
                <Pressable
                  onPress={pickCoverImage}
                  style={{ backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: colors.primary, borderRadius: 8 }}
                  className="h-10 items-center justify-center flex-row"
                >
                  <Ionicons name="image" size={16} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>Galeri</Text>
                </Pressable>
                <Pressable
                  onPress={() => setCoverImage('')}
                  style={{ backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: colors.danger, borderRadius: 8 }}
                  className="h-10 items-center justify-center"
                >
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.danger }}>Sil</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </Pressable>

        <View className="rounded-xl bg-white border border-[#33333315] p-4 gap-3">
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>Satıcı Kimliği</Text>
          <View>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Mağaza Adı</Text>
            <TextInput
              value={storeName}
              onChangeText={setStoreName}
              placeholder="Mağaza adını gir"
              className="rounded-xl border border-[#33333320] bg-white px-3 py-3"
              style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary }}
            />
          </View>
          <View>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>WhatsApp</Text>
            <TextInput
              value={whatsapp}
              onChangeText={setWhatsapp}
              placeholder="9053..."
              keyboardType="phone-pad"
              className="rounded-xl border border-[#33333320] bg-white px-3 py-3"
              style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary }}
            />
          </View>
          <View>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Instagram</Text>
            <TextInput
              value={instagramHandle}
              onChangeText={setInstagramHandle}
              placeholder="instagramkullaniciadi"
              autoCapitalize="none"
              className="rounded-xl border border-[#33333320] bg-white px-3 py-3"
              style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary }}
            />
          </View>
          <View>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Website</Text>
            <TextInput
              value={website}
              onChangeText={setWebsite}
              placeholder="https://magazaniz.com"
              autoCapitalize="none"
              keyboardType="url"
              className="rounded-xl border border-[#33333320] bg-white px-3 py-3"
              style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary }}
            />
          </View>
        </View>

        {/* Profil Resmi + İkon */}
        <Pressable
          onPress={() => setExpandedProfile(!expandedProfile)}
          className="rounded-xl bg-white border border-[#33333315] p-4"
        >
          <View className="flex-row items-center">
            {profileImage && !selectedIcon ? (
              <Image source={{ uri: profileImage }} style={{ width: 80, height: 80, borderRadius: 40 }} />
            ) : (
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: '#F3E8FF',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 48 }}>{profileEmoji}</Text>
              </View>
            )}
            <View className="flex-1 ml-4">
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>Profil Resmi</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                Fotoğraf yükle veya ikon seç
              </Text>
            </View>
            <Ionicons name={expandedProfile ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
          </View>

          {expandedProfile ? (
            <View className="mt-4 gap-2 pt-4 border-t border-[#33333315]">
              <Pressable
                onPress={pickProfileImage}
                style={{ backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: colors.primary, borderRadius: 8 }}
                className="h-10 items-center justify-center flex-row"
              >
                <Ionicons name="image" size={16} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>Fotoğraf Yükle</Text>
              </Pressable>

              <Pressable
                onPress={() => setShowIconPicker(true)}
                style={{ backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D', borderRadius: 8 }}
                className="h-10 items-center justify-center flex-row"
              >
                <Text style={{ fontSize: 16, marginRight: 4 }}>��</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: '#92400E' }}>İkon Seç</Text>
              </Pressable>

              {(profileImage || selectedIcon) && (
                <Pressable
                  onPress={() => {
                    setProfileImage('');
                    setSelectedIcon(null);
                  }}
                  style={{ backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: colors.danger, borderRadius: 8 }}
                  className="h-10 items-center justify-center"
                >
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.danger }}>Sil</Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </Pressable>

        {/* İkon Picker Modal */}
        <Modal visible={showIconPicker} transparent animationType="slide">
          <SafeAreaView className="flex-1 bg-white">
            <View className="px-3 py-2 border-b border-[#33333315] flex-row items-center">
              <Pressable onPress={() => setShowIconPicker(false)} className="w-9 h-9 items-center justify-center">
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.textPrimary }} className="flex-1 ml-2">
                İkon Seç
              </Text>
            </View>

            <FlatList
              data={PROFILE_ICONS}
              numColumns={4}
              contentContainerStyle={{ padding: 12, gap: 12 }}
              columnWrapperStyle={{ gap: 12, justifyContent: 'space-between' }}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setSelectedIcon(item.id);
                    setProfileImage('');
                    setShowIconPicker(false);
                  }}
                  className="rounded-xl border-2 items-center justify-center"
                  style={{
                    width: (Dimensions.get('window').width - 48) / 4,
                    height: (Dimensions.get('window').width - 48) / 4,
                    borderColor: selectedIcon === item.id ? colors.primary : '#33333315',
                    backgroundColor: selectedIcon === item.id ? '#EFF6FF' : '#F7F7F7',
                  }}
                >
                  <Text style={{ fontSize: 32 }}>{item.emoji}</Text>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 9, color: colors.textSecondary, marginTop: 2, textAlign: 'center' }}>
                    {item.name}
                  </Text>
                </Pressable>
              )}
            />
          </SafeAreaView>
        </Modal>

        <View className="rounded-xl border border-[#33333315] bg-white p-3">
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>Mağaza Biyografisi</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            showSoftInputOnFocus
            autoCorrect
            autoCapitalize="sentences"
            placeholder="Mağaza hakkında bilgi yaz..."
            placeholderTextColor={colors.textMuted}
            style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary }}
            className="mt-2 rounded-xl border border-[#33333315] bg-[#F7F7F7] px-3 py-3"
            multiline
            numberOfLines={3}
          />
        </View>

        <View className="rounded-xl border border-[#33333315] bg-white p-3">
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>Konum</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            showSoftInputOnFocus
            autoCorrect
            autoCapitalize="words"
            placeholder="Şehir adını gir..."
            placeholderTextColor={colors.textMuted}
            style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary }}
            className="mt-2 h-11 rounded-xl border border-[#33333315] bg-[#F7F7F7] px-3"
          />
        </View>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={{ backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }}
          className="h-12 rounded-xl items-center justify-center mt-2"
        >
          {saving ? (
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>Kaydediliyor...</Text>
            </View>
          ) : (
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>Değişiklikleri Kaydet</Text>
          )}
        </Pressable>
      </ScrollView>

      {info ? (
        <View className="absolute bottom-6 left-4 right-4 rounded-xl bg-[#111827] px-4 py-3">
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: '#fff', textAlign: 'center' }}>{info}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
