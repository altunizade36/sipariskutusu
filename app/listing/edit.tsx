import { Image, Pressable, ScrollView, Text, TextInput, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { colors, fonts } from '../../src/constants/theme';
import { useListings } from '../../src/context/ListingsContext';
import type { Product } from '../../src/data/mockData';
import { pickImageFromLibrary, pickMediaFromLibrary } from '../../src/utils/imagePicker';

type MediaItem = {
  id: string;
  uri: string;
  kind: 'image' | 'video';
};

const MAX_LISTING_MEDIA_COUNT = 8;

const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm']);

function isVideoUri(uri: string): boolean {
  const cleanUri = uri.split('?')[0].toLowerCase();
  const ext = cleanUri.split('.').pop() ?? '';
  return VIDEO_EXTENSIONS.has(ext);
}

function toMediaItems(product?: Product | null): MediaItem[] {
  if (!product) {
    return [];
  }

  const raw = product.mediaUris && product.mediaUris.length > 0
    ? product.mediaUris
    : [product.image, ...(product.videoUri ? [product.videoUri] : [])].filter(Boolean);

  const seen = new Set<string>();
  return raw
    .filter((uri) => {
      if (!uri || seen.has(uri)) {
        return false;
      }

      seen.add(uri);
      return true;
    })
    .slice(0, MAX_LISTING_MEDIA_COUNT)
    .map((uri, index) => ({
      id: `${index}-${uri}`,
      uri,
      kind: isVideoUri(uri) ? 'video' : 'image',
    }));
}

function extractHashtagsFromText(value: string): string {
  const matches = value.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  const seen = new Set<string>();
  return matches
    .map((item) => item.trim().toLocaleLowerCase('tr-TR'))
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    })
    .slice(0, 10)
    .join(' ');
}

function stripHashtagsFromText(value: string): string {
  return value
    .replace(/#[\p{L}\p{N}_]+/gu, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default function ListingEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { allProducts, updateListing } = useListings();
  
  const baseProduct = allProducts.find((p) => p.id === id);
  const [product, setProduct] = useState<Product | null>(baseProduct ?? null);
  const [title, setTitle] = useState(baseProduct?.title ?? '');
  const [description, setDescription] = useState(stripHashtagsFromText(baseProduct?.description ?? ''));
  const [hashtags, setHashtags] = useState(extractHashtagsFromText(baseProduct?.description ?? ''));
  const [price, setPrice] = useState(baseProduct && baseProduct.price > 0 ? baseProduct.price.toString() : '');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(toMediaItems(baseProduct));
  const [mediaDirty, setMediaDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const images = mediaItems.filter((item) => item.kind === 'image').map((item) => item.uri);
  const videoUri = mediaItems.find((item) => item.kind === 'video')?.uri ?? null;

  useEffect(() => {
    setProduct(baseProduct ?? null);
    setTitle(baseProduct?.title ?? '');
    setDescription(stripHashtagsFromText(baseProduct?.description ?? ''));
    setHashtags(extractHashtagsFromText(baseProduct?.description ?? ''));
    setPrice(baseProduct && baseProduct.price > 0 ? baseProduct.price.toString() : '');
    setMediaItems(toMediaItems(baseProduct));
    setMediaDirty(false);
    setError('');
  }, [baseProduct, id]);

  function showInfo(message: string) {
    setInfo(message);
    setTimeout(() => setInfo(''), 2000);
  }

  if (!product) {
    return (
      <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>
            İlan bulunamadı.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  async function handlePickImage() {
    if (mediaItems.length >= MAX_LISTING_MEDIA_COUNT) {
      setError(`En fazla ${MAX_LISTING_MEDIA_COUNT} medya ekleyebilirsin.`);
      return;
    }

    const uri = await pickImageFromLibrary();
    if (uri && !mediaItems.some((item) => item.uri === uri)) {
      setMediaDirty(true);
      setMediaItems((current) => [
        ...current,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          uri,
          kind: 'image',
        },
      ]);
    }
  }

  async function handlePickVideo() {
    if (mediaItems.length >= MAX_LISTING_MEDIA_COUNT) {
      setError(`En fazla ${MAX_LISTING_MEDIA_COUNT} medya ekleyebilirsin.`);
      return;
    }

    if (!mediaItems.some((item) => item.kind === 'image')) {
      setError('Kapak fotoğrafı zorunlu. Önce en az 1 fotoğraf eklemelisin.');
      return;
    }

    if (mediaItems.some((item) => item.kind === 'video')) {
      setError('Şimdilik tek video ekleyebilirsin.');
      return;
    }

    const uri = await pickMediaFromLibrary('videos');
    if (uri) {
      setMediaDirty(true);
      setMediaItems((current) => [
        ...current,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          uri,
          kind: 'video',
        },
      ]);
    }
  }

  function handleRemoveMedia(itemId: string) {
    setMediaDirty(true);
    setMediaItems((current) => current.filter((item) => item.id !== itemId));
  }

  async function handleSave() {
    if (!title.trim() || !description.trim()) {
      setError('Başlık ve açıklama zorunlu.');
      return;
    }

    const normalizedPrice = price.trim() ? Number(price) : 0;
    if (price.trim() && (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0)) {
      setError('Fiyat girildiğinde geçerli bir tutar olmalı.');
      return;
    }

    const mediaCount = mediaItems.length;
    if (mediaDirty && mediaCount === 0) {
      setError('En az bir medya yüklemelisin (fotoğraf veya video).');
      return;
    }

    if (mediaItems.length > 0 && mediaItems[0]?.kind !== 'image') {
      setError('Kapak fotoğrafı zorunlu. İlk medya bir fotoğraf olmalı.');
      return;
    }

    const cleanHashtags = extractHashtagsFromText(hashtags);
    const mergedDescription = [description.trim(), cleanHashtags].filter(Boolean).join('\n');

    setSaving(true);
    try {
      if (updateListing) {
        const orderedMedia = mediaItems.map((item) => item.uri);
        const mediaUpdates = mediaDirty
          ? {
              mediaUris: orderedMedia,
              videoUri,
            }
          : {};

        await updateListing(id, {
          title: title.trim(),
          description: mergedDescription,
          price: normalizedPrice,
          ...mediaUpdates,
        });
      }

      showInfo('İlan güncellendi.');
      setTimeout(() => router.back(), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İlan güncellenemedi.');
    } finally {
      setSaving(false);
    }
  }

  function renderMediaCard({ item, drag, isActive }: RenderItemParams<MediaItem>) {
    return (
      <View
        className="relative mr-2"
        style={{ opacity: isActive ? 0.8 : 1 }}
      >
        <Pressable
          onLongPress={drag}
          delayLongPress={120}
          className="rounded-lg overflow-hidden border border-[#33333320]"
        >
          <Image source={{ uri: item.uri }} style={{ width: 84, height: 84 }} />
          {item.kind === 'video' ? (
            <View className="absolute inset-0 items-center justify-center bg-black/35">
              <Ionicons name="play-circle" size={24} color="#fff" />
            </View>
          ) : null}
          <View className="absolute left-1 top-1 rounded-md bg-black/65 px-1.5 py-0.5">
            <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff' }}>
              {item.kind === 'video' ? 'Video' : 'Foto'}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => handleRemoveMedia(item.id)}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black/70 items-center justify-center"
        >
          <Ionicons name="close" size={12} color="#fff" />
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
      <View className="bg-white px-3 py-2 border-b border-[#33333315] flex-row items-center">
        <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.textPrimary }} className="flex-1 ml-2">
          İlanı Düzenle
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 12, gap: 10 }} keyboardShouldPersistTaps="handled">
        <View className="rounded-xl border border-[#33333315] bg-white p-4">
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>Fotoğraflar</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
            İlan medyalarını yönet ({mediaItems.length}/{MAX_LISTING_MEDIA_COUNT}) - İlk medya kapak olur, sıralamak için karta uzun basıp sürükle.
          </Text>

          {mediaItems.length > 0 ? (
            <View className="mt-3">
              <DraggableFlatList
                data={mediaItems}
                horizontal
                keyExtractor={(item) => item.id}
                onDragEnd={({ data }) => {
                  setMediaDirty(true);
                  setMediaItems(data);
                }}
                renderItem={renderMediaCard}
                contentContainerStyle={{ paddingRight: 6 }}
              />
            </View>
          ) : null}

          {mediaItems.length < MAX_LISTING_MEDIA_COUNT ? (
            <View className="mt-3" style={{ gap: 8 }}>
              <Pressable
                onPress={handlePickImage}
                className="h-12 rounded-xl items-center justify-center border border-dashed border-[#94A3B8] bg-[#F8FAFC]"
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>
                  Fotoğraf Ekle
                </Text>
              </Pressable>

              <Pressable
                onPress={handlePickVideo}
                className="h-12 rounded-xl items-center justify-center border border-dashed border-[#94A3B8] bg-[#F8FAFC]"
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>
                  Video Ekle
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View className="rounded-xl border border-[#33333315] bg-white p-3">
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>Başlık</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            showSoftInputOnFocus
            autoCorrect
            autoCapitalize="sentences"
            placeholder="Ürün başlığını gir..."
            placeholderTextColor={colors.textMuted}
            style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary }}
            className="mt-2 h-11 rounded-xl border border-[#33333315] bg-[#F7F7F7] px-3"
          />
        </View>

        <View className="rounded-xl border border-[#33333315] bg-white p-3">
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>Açıklama</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            showSoftInputOnFocus
            autoCorrect
            autoCapitalize="sentences"
            placeholder="Ürün açıklamasını gir..."
            placeholderTextColor={colors.textMuted}
            style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary }}
            className="mt-2 rounded-xl border border-[#33333315] bg-[#F7F7F7] px-3 py-3"
            multiline
            numberOfLines={4}
          />
        </View>

        <View className="rounded-xl border border-[#33333315] bg-white p-3">
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>Fiyat (₺)</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            showSoftInputOnFocus
            placeholder="Boş bırakılırsa Fiyat Sor"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary }}
            className="mt-2 h-11 rounded-xl border border-[#33333315] bg-[#F7F7F7] px-3"
          />
          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 6 }}>
            Fiyat boş ise ilanda "Fiyat Sor" gösterilir.
          </Text>
        </View>

        <View className="rounded-xl border border-[#33333315] bg-white p-3">
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>Hashtag</Text>
          <TextInput
            value={hashtags}
            onChangeText={setHashtags}
            showSoftInputOnFocus
            autoCorrect={false}
            autoCapitalize="none"
            placeholder="#elbise #vintage"
            placeholderTextColor={colors.textMuted}
            style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary }}
            className="mt-2 h-11 rounded-xl border border-[#33333315] bg-[#F7F7F7] px-3"
          />
        </View>

        {error ? (
          <View className="rounded-xl bg-[#FEE2E2] border border-[#FECACA] p-3">
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.danger }}>{error}</Text>
          </View>
        ) : null}

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
