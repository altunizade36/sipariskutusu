import { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { WizardScaffold } from '../../src/components/listing/WizardScaffold';
import { colors, fonts } from '../../src/constants/theme';
import { useListingWizard } from '../../src/context/ListingWizardContext';

export default function ListingStep6Screen() {
  const router = useRouter();
  const { draft, setDraftField } = useListingWizard();
  const [error, setError] = useState('');

  function handleNext() {
    if (draft.title.trim().length < 6) {
      setError('Başlık en az 6 karakter olmalı.');
      return;
    }

    setError('');
    router.push('/listing/step-7');
  }

  return (
    <WizardScaffold
      step={6}
      title="Başlık"
      subtitle="İlanın için net ve açıklayıcı bir başlık yaz."
      onBack={() => router.back()}
      onNext={handleNext}
      disabledNext={draft.title.trim().length < 6}
    >
      <TextInput
        value={draft.title}
        onChangeText={(value) => setDraftField('title', value)}
        showSoftInputOnFocus
        autoCorrect
        autoCapitalize="sentences"
        placeholder="Örn. Temiz iPhone 13 128 GB"
        placeholderTextColor={colors.textMuted}
        style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary }}
        className="bg-[#F7F7F7] rounded-xl px-4 h-14 border border-[#33333315]"
        maxLength={80}
      />
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted }}>{draft.title.length}/80</Text>
      {error ? <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.danger }}>{error}</Text> : null}
    </WizardScaffold>
  );
}
