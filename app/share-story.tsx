import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fonts } from '../src/constants/theme';
import { MARKETPLACE_CATEGORIES } from '../src/constants/marketplaceCategories';
import { useListings } from '../src/context/ListingsContext';
import { useAuth } from '../src/context/AuthContext';
import { pickImageFromLibrary } from '../src/utils/imagePicker';

export default function ShareStoryScreen() {
  const router = useRouter();
  const { quick } = useLocalSearchParams<{ quick?: string }>();
  const { user } = useAuth();
  const { hasStore, sellerStore, shareHomeStory, publishedListings, storeProducts } = useListings();
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [priceTag, setPriceTag] = useState('');
  const [storyImage, setStoryImage] = useState('');
  const [imageError, setImageError] = useState('');
  const [isVideoPost, setIsVideoPost] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(MARKETPLACE_CATEGORIES[0].id);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const selectableProducts = useMemo(() => {
    const merged = [...publishedListings, ...storeProducts];
    const seen = new Set<string>();
    return merged.filter((item) => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
  }, [publishedListings, storeProducts]);

  const selectedProduct = useMemo(
    () => selectableProducts.find((item) => item.id === selectedProductId) ?? null,
    [selectableProducts, selectedProductId],
  );

  useEffect(() => {
    if (!selectedProduct) {
      return;
    }

    if (!title.trim()) {
      setTitle(selectedProduct.title);
    }
    if (!priceTag.trim()) {
      setPriceTag(`${selectedProduct.price} TL`);
    }
    if (!storyImage.trim()) {
      setStoryImage(selectedProduct.image);
    }
  }, [priceTag, selectedProduct, storyImage, title]);

  const canShare = title.trim().length > 0 || caption.trim().length > 0 || storyImage.trim().length > 0;

  function handleShare() {
    if (!hasStore || !canShare) {
      return;
    }

    shareHomeStory({
      title: title.trim() || selectedProduct?.title || 'Yeni hikaye',
      caption: caption.trim(),
      priceTag: priceTag.trim() || undefined,
      imageUri: storyImage.trim() || undefined,
      productId: selectedProductId || undefined,
      categoryId: selectedCategory,
      isVideo: isVideoPost,
    });

    router.push('/(tabs)/store');
  }

  async function handlePickStoryImage() {
    try {
      const uri = await pickImageFromLibrary();

      if (!uri) {
        return;
      }

      setStoryImage(uri);
      setImageError('');
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'Görsel seçilirken bir hata oluştu.');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
      <View className="bg-white px-4 py-3 border-b border-[#33333315] flex-row items-center justify-between">
        <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-full bg-[#F7F7F7] items-center justify-center">
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 20, color: colors.textPrimary }}>
          Hikaye Paylaş
        </Text>
        <Pressable
          onPress={handleShare}
          disabled={!canShare || !hasStore || !user}
          className="h-10 px-3 rounded-full items-center justify-center"
          style={{ backgroundColor: canShare && hasStore && user ? colors.primary : '#B9C9E6' }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>Yayınla</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!user ? (
          <View className="mx-4 mt-4 bg-white rounded-[28px] p-5 border border-[#33333315]">
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 23, color: colors.textPrimary }}>
              Hikaye paylaşmak için giriş yap
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }} className="mt-2 leading-5">
              Uygulamayı misafir olarak gezebilirsin. Hikaye paylaşma için hesapla oturum açman gerekir.
            </Text>
            <Pressable onPress={() => router.push('/auth')} style={{ backgroundColor: colors.primary }} className="h-12 rounded-xl items-center justify-center mt-5">
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>
                Giriş Yap / Kayıt Ol
              </Text>
            </Pressable>
          </View>
        ) : null}

        {user && !hasStore ? (
          <View className="mx-4 mt-4 bg-white rounded-[28px] p-5 border border-[#33333315]">
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 23, color: colors.textPrimary }}>
              Önce mağazanı aç
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }} className="mt-2 leading-5">
              Satıcılar yalnızca mağaza açabilir ve hikaye paylaşabilir. Hikaye yayınlamak için önce satıcı merkezinden mağaza kurulumunu tamamla.
            </Text>

            <View className="mt-5 bg-[#F8FAFC] rounded-2xl p-4 border border-[#33333315] gap-3">
              {['Mağaza adı ve kullanıcı adı oluştur', 'Şehir ve kategori seç', 'Kurulumdan sonra hemen hikaye paylaş'].map((item) => (
                <View key={item} className="flex-row items-center">
                  <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }} className="ml-2">
                    {item}
                  </Text>
                </View>
              ))}
            </View>

            <Pressable onPress={() => router.push('/store-setup')} style={{ backgroundColor: colors.primary }} className="h-12 rounded-xl items-center justify-center mt-5">
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>
                Satıcı Merkezine Git
              </Text>
            </Pressable>
          </View>
        ) : null}

        {user && hasStore ? (
          <View className="mx-4 mt-4 mb-5">
            <View className="bg-white rounded-[28px] border border-[#33333315] p-4">
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: colors.textPrimary }}>
                {quick ? 'Hızlı Hikaye' : 'Hikaye Tasarla'}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }} className="mt-1">
                Görsel seç, istersen başlık/fiyat ekle ve tek dokunuşla yayınla.
              </Text>

              <Pressable
                onPress={handlePickStoryImage}
                className="mt-4 rounded-[24px] overflow-hidden border border-[#33333318] bg-[#EAF1FF]"
                style={{ aspectRatio: 9 / 16 }}
              >
                {storyImage ? (
                  <Image source={{ uri: storyImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <View className="w-full h-full items-center justify-center">
                    <View className="w-14 h-14 rounded-2xl bg-white items-center justify-center border border-[#BFDBFE]">
                      <Ionicons name="images-outline" size={24} color={colors.primary} />
                    </View>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }} className="mt-3">
                      Hikaye için görsel seç
                    </Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary }} className="mt-1">
                      Instagram tarzı tam ekran hikaye
                    </Text>
                  </View>
                )}

                <View className="absolute left-3 right-3 top-3 flex-row items-center justify-between">
                  <View className="bg-[#00000066] px-3 py-1 rounded-full">
                    <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: '#fff' }}>
                      {sellerStore?.name ?? 'Mağaza'} • Az önce
                    </Text>
                  </View>
                  {storyImage ? (
                    <Pressable onPress={() => setStoryImage('')} className="bg-[#00000066] w-8 h-8 rounded-full items-center justify-center">
                      <Ionicons name="close" size={15} color="#fff" />
                    </Pressable>
                  ) : null}
                </View>

                <View className="absolute left-3 right-3 bottom-3">
                  {priceTag.trim() ? (
                    <View className="self-start bg-[#111827E6] px-3 py-1 rounded-full mb-2">
                      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>
                        {priceTag.trim()}
                      </Text>
                    </View>
                  ) : null}
                  {title.trim() ? (
                    <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: '#fff' }}>
                      {title.trim()}
                    </Text>
                  ) : null}
                  {caption.trim() ? (
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: '#F3F4F6' }} className="mt-1">
                      {caption.trim()}
                    </Text>
                  ) : null}
                </View>
              </Pressable>

              {imageError ? (
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.danger }} className="mt-2">
                  {imageError}
                </Text>
              ) : null}
            </View>

            <View className="bg-white rounded-[24px] border border-[#33333315] p-4 mt-3">
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>
                Hikayeye Ürün Bağla
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                Ürüne Git ve Mesaj At butonları için bir ürün seç.
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 12, paddingBottom: 2 }}>
                <Pressable
                  onPress={() => setSelectedProductId(null)}
                  className="rounded-2xl border p-2"
                  style={{
                    width: 118,
                    borderColor: selectedProductId === null ? colors.primary : colors.borderLight,
                    backgroundColor: selectedProductId === null ? '#EFF6FF' : '#fff',
                  }}
                >
                  <View className="w-full h-20 rounded-xl items-center justify-center" style={{ backgroundColor: '#F8FAFC' }}>
                    <Ionicons name="link-outline" size={20} color={colors.textMuted} />
                  </View>
                  <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textPrimary, marginTop: 6 }}>
                    Serbest Hikaye
                  </Text>
                </Pressable>
                {selectableProducts.slice(0, 12).map((product) => {
                  const selected = selectedProductId === product.id;
                  return (
                    <Pressable
                      key={product.id}
                      onPress={() => setSelectedProductId(product.id)}
                      className="rounded-2xl border p-2"
                      style={{
                        width: 118,
                        borderColor: selected ? colors.primary : colors.borderLight,
                        backgroundColor: selected ? '#EFF6FF' : '#fff',
                      }}
                    >
                      <Image source={{ uri: product.image }} className="w-full h-20 rounded-xl" resizeMode="cover" />
                      <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textPrimary, marginTop: 6 }}>
                        {product.title}
                      </Text>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.primary, marginTop: 2 }}>
                        {product.price} TL
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View className="bg-white rounded-[24px] border border-[#33333315] p-4 mt-3">
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>
                Hikaye üstü metinler
              </Text>
              <Pressable
                onPress={() => setIsVideoPost((current) => !current)}
                className="mt-3 rounded-xl border px-3 py-3 flex-row items-center justify-between"
                style={{ borderColor: isVideoPost ? '#93C5FD' : colors.borderLight, backgroundColor: isVideoPost ? '#EFF6FF' : '#F9FAFB' }}
              >
                <View>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }}>
                    Video ürün (Reels)
                  </Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                    Açıksa mağazadaki oynat sekmesinde 3’lü gridde görünür
                  </Text>
                </View>
                <View
                  className="w-11 h-6 rounded-full px-1"
                  style={{ backgroundColor: isVideoPost ? colors.primary : '#D1D5DB', justifyContent: 'center' }}
                >
                  <View
                    className="w-4 h-4 rounded-full bg-white"
                    style={{ alignSelf: isVideoPost ? 'flex-end' : 'flex-start' }}
                  />
                </View>
              </Pressable>
              <View className="gap-3 mt-3">
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  showSoftInputOnFocus
                  placeholder="Başlık (örn. Yeni sezon yayında)"
                  placeholderTextColor={colors.textMuted}
                  style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary }}
                  className="bg-[#F7F7F7] rounded-xl px-4 h-11 border border-[#33333315]"
                />
                <TextInput
                  value={priceTag}
                  onChangeText={setPriceTag}
                  showSoftInputOnFocus
                  placeholder="Fiyat etiketi (örn. 899 TL)"
                  placeholderTextColor={colors.textMuted}
                  style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary }}
                  className="bg-[#F7F7F7] rounded-xl px-4 h-11 border border-[#33333315]"
                />
                <TextInput
                  value={caption}
                  onChangeText={setCaption}
                  showSoftInputOnFocus
                  autoCorrect
                  autoCapitalize="sentences"
                  placeholder="Ürün notu"
                  placeholderTextColor={colors.textMuted}
                  style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary }}
                  className="bg-[#F7F7F7] rounded-xl px-4 h-11 border border-[#33333315]"
                />
              </View>

              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }} className="mt-4 mb-2">
                Kategori
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {MARKETPLACE_CATEGORIES.slice(0, 6).map((category) => {
                  const isSelected = selectedCategory === category.id;

                  return (
                    <Pressable
                      key={category.id}
                      onPress={() => setSelectedCategory(category.id)}
                      style={{
                        backgroundColor: isSelected ? '#E8F1FF' : '#F7F7F7',
                        borderColor: isSelected ? colors.primary : colors.borderLight,
                      }}
                      className="rounded-full px-4 py-2 border"
                    >
                      <Text
                        style={{
                          fontFamily: isSelected ? fonts.bold : fonts.medium,
                          fontSize: 12,
                          color: isSelected ? colors.primary : colors.textPrimary,
                        }}
                      >
                        {category.icon} {category.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <Pressable
              onPress={handleShare}
              style={{ backgroundColor: canShare ? colors.primary : '#AFC7ED' }}
              className="h-12 rounded-xl items-center justify-center mt-3"
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>
                {canShare ? 'Hikayeyi Yayınla' : 'Önce görsel veya metin ekle'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}