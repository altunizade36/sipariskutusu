import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { WizardScaffold } from '../../src/components/listing/WizardScaffold';
import { colors, fonts } from '../../src/constants/theme';
import { useListingWizard } from '../../src/context/ListingWizardContext';

export default function ListingStep7Screen() {
  const router = useRouter();
  const { draft, setDraftField } = useListingWizard();
  const [error, setError] = useState('');

  function handleNext() {
    if (draft.description.trim().length < 20) {
      setError('Açıklama en az 20 karakter olmalı.');
      return;
    }

    setError('');
    router.push('/listing/step-8');
  }

  return (
    <WizardScaffold
      step={7}
      title="Açıklama"
      subtitle="Ürünün durumunu ve önemli detayları yaz."
      onBack={() => router.back()}
      onNext={handleNext}
      disabledNext={draft.description.trim().length < 20}
    >
      <TextInput
        value={draft.description}
        onChangeText={(value) => setDraftField('description', value)}
        multiline
        textAlignVertical="top"
        showSoftInputOnFocus
        autoCorrect
        autoCapitalize="sentences"
        placeholder="Kullanım durumu, kusur bilgisi, aksesuarlar, garanti..."
        placeholderTextColor={colors.textMuted}
        style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary, paddingTop: 14 }}
        className="bg-[#F7F7F7] rounded-xl px-4 min-h-[140px] border border-[#33333315]"
      />

      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>Hashtag</Text>
      <TextInput
        value={draft.hashtags}
        onChangeText={(value) => setDraftField('hashtags', value)}
        showSoftInputOnFocus
        autoCorrect={false}
        autoCapitalize="none"
        placeholder="#elbise #vintage #kombin"
        placeholderTextColor={colors.textMuted}
        style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary }}
        className="bg-[#F7F7F7] rounded-xl px-4 h-12 border border-[#33333315]"
      />
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted }}>
        Hashtaglar arama bulunurluğunu artırır. Örnek: #elbise #vintage
      </Text>

      <View className="flex-row flex-wrap gap-2">
        {['#vintage', '#yenisezon', '#kombin', '#indirim'].map((tag) => (
          <Text
            key={tag}
            onPress={() => {
              if (draft.hashtags.includes(tag)) return;
              const next = [draft.hashtags.trim(), tag].filter(Boolean).join(' ');
              setDraftField('hashtags', next.trim());
            }}
            style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.primary }}
            className="rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1"
          >
            {tag}
          </Text>
        ))}
      </View>

      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted }}>{draft.description.length} karakter</Text>
      {error ? <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.danger }}>{error}</Text> : null}
    </WizardScaffold>
  );
}
