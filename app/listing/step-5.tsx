import { Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { WizardScaffold } from '../../src/components/listing/WizardScaffold';
import { colors, fonts } from '../../src/constants/theme';
import { useListingWizard } from '../../src/context/ListingWizardContext';
import { pickMediaFromLibrary } from '../../src/utils/imagePicker';

const MAX_LISTING_MEDIA_COUNT = 8;

export default function ListingStep5Screen() {
  const router = useRouter();
  const { draft, addPhoto, removePhoto, setDraftField, applyQuickListingPreset } = useListingWizard();
  const [error, setError] = useState('');

  async function handlePickPhoto() {
    if (draft.photos.length >= MAX_LISTING_MEDIA_COUNT) {
      setError(`En fazla ${MAX_LISTING_MEDIA_COUNT} görsel ekleyebilirsin.`);
      return;
    }

    const uri = await pickMediaFromLibrary('images');
    if (!uri) return;
    addPhoto(uri);
    if (error) setError('');
  }

  async function handlePickVideo() {
    if (draft.photos.length === 0) {
      setError('Kapak fotoğrafı zorunlu. Önce en az 1 fotoğraf eklemelisin.');
      return;
    }

    if (draft.videoUri.trim()) {
      setError('Şu anda ilan başına yalnızca 1 video destekleniyor.');
      return;
    }

    const uri = await pickMediaFromLibrary('videos');
    if (!uri) return;

    setDraftField('videoUri', uri);
    if (error) setError('');
  }

  function handleQuickFlow() {
    if (draft.photos.length === 0) {
      setError('Hızlı ilan için en az 1 fotoğraf eklemelisin.');
      return;
    }

    applyQuickListingPreset();
    setError('');
    router.push('/listing/step-10');
  }

  function handleNext() {
    if (draft.photos.length === 0) {
      setError('Kapak fotoğrafı zorunlu. Devam etmek için en az 1 fotoğraf eklemelisin.');
      return;
    }

    if (error) setError('');
    router.push('/listing/step-6');
  }

  return (
    <WizardScaffold
      step={5}
      title="Medya (Fotoğraf + Video)"
      subtitle={`En fazla ${MAX_LISTING_MEDIA_COUNT} görsel, her görsel en çok 2-3 MB olacak şekilde otomatik sıkıştırılır. İlk görsel kapak olur.`}
      onBack={() => router.back()}
      onNext={handleNext}
    >
      <View className="flex-row" style={{ gap: 10 }}>
        <Pressable
          onPress={handlePickPhoto}
          disabled={draft.photos.length >= MAX_LISTING_MEDIA_COUNT}
          style={{ opacity: draft.photos.length >= MAX_LISTING_MEDIA_COUNT ? 0.6 : 1 }}
          className="h-12 flex-1 rounded-xl items-center justify-center border border-dashed border-[#94A3B8] bg-[#F8FAFC]"
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }}>
            Fotoğraf ({draft.photos.length}/{MAX_LISTING_MEDIA_COUNT})
          </Text>
        </Pressable>

        <Pressable
          onPress={handlePickVideo}
          disabled={Boolean(draft.videoUri.trim())}
          style={{ opacity: draft.videoUri.trim() ? 0.6 : 1 }}
          className="h-12 flex-1 rounded-xl items-center justify-center border border-dashed border-[#94A3B8] bg-[#F8FAFC]"
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }}>
            {draft.videoUri.trim() ? 'Video eklendi' : 'Video Ekle'}
          </Text>
        </Pressable>
      </View>

      {draft.photos.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {draft.photos.map((uri) => (
            <View key={uri} className="relative">
              <Image source={{ uri }} className="w-24 h-24 rounded-xl" resizeMode="cover" />
              <Pressable
                onPress={() => removePhoto(uri)}
                className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-black/70 items-center justify-center"
              >
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted }}>
          Kapak fotoğrafı zorunludur. Önce en az 1 fotoğraf ekle, istersen ardından 1 video da ekleyebilirsin.
        </Text>
      )}

      {draft.videoUri.trim() ? (
        <View className="rounded-xl border border-[#33333315] bg-[#F8FAFC] p-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Ionicons name="videocam" size={18} color={colors.primary} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textPrimary }}>Video eklendi</Text>
            </View>
            <Pressable onPress={() => setDraftField('videoUri', '')}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          </View>
        </View>
      ) : null}

      <Pressable
        onPress={handleQuickFlow}
        className="h-11 rounded-xl items-center justify-center border border-[#BFDBFE] bg-[#EFF6FF]"
      >
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }}>Hızlı İlan Akışı (3-5 sn)</Text>
      </Pressable>

      {error ? <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.danger }}>{error}</Text> : null}
    </WizardScaffold>
  );
}

