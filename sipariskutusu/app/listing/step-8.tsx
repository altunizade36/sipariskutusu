import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { WizardScaffold } from '../../src/components/listing/WizardScaffold';
import { colors, fonts } from '../../src/constants/theme';
import { useListingWizard } from '../../src/context/ListingWizardContext';

export default function ListingStep8Screen() {
  const router = useRouter();
  const { draft, setDraftField } = useListingWizard();
  const [error, setError] = useState('');
  const parsedPrice = Number(draft.price.replace(',', '.'));
  const parsedStock = Number(draft.stock);
  const hasValidPrice = !draft.price.trim() || (Number.isFinite(parsedPrice) && parsedPrice > 0);
  const canProceed = hasValidPrice && Number.isFinite(parsedStock) && parsedStock >= 1;

  function handleNext() {
    const parsed = Number(draft.price.replace(',', '.'));
    if (draft.price.trim() && (!Number.isFinite(parsed) || parsed <= 0)) {
      setError('Fiyat girildiğinde geçerli bir tutar olmalı.');
      return;
    }

    const stock = Number(draft.stock);
    if (!Number.isFinite(stock) || stock < 1) {
      setError('Stok adedi en az 1 olmalı.');
      return;
    }

    setError('');
    router.push('/listing/step-9');
  }

  return (
    <WizardScaffold
      step={8}
      title="Fiyat"
      subtitle="Fiyat opsiyonel. Boş bırakılırsa ilanda Fiyat Sor görünür."
      onBack={() => router.back()}
      onNext={handleNext}
      disabledNext={!canProceed}
    >
      <View className="flex-row items-center bg-[#F7F7F7] rounded-2xl px-4 h-16 border border-[#33333315]">
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: colors.textSecondary }} className="mr-2">₺</Text>
        <TextInput
          value={draft.price}
          onChangeText={(value) => setDraftField('price', value.replace(/[^0-9.,]/g, ''))}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          style={{ fontFamily: fonts.headingBold, fontSize: 26, color: colors.textPrimary, flex: 1 }}
        />
      </View>

      <View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }} className="mb-2">Stok adedi</Text>
        <TextInput
          value={draft.stock}
          onChangeText={(value) => setDraftField('stock', value.replace(/[^0-9]/g, ''))}
          placeholder="1"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary }}
          className="bg-[#F7F7F7] rounded-xl px-4 h-12 border border-[#33333315]"
        />
      </View>

      <Pressable
        onPress={() => setDraftField('price', '')}
        className="h-10 rounded-xl items-center justify-center border border-[#BFDBFE] bg-[#EFF6FF]"
      >
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }}>Fiyatı Boş Bırak (Fiyat Sor)</Text>
      </Pressable>

      <Pressable
        onPress={() => setDraftField('bargaining', !draft.bargaining)}
        style={{ backgroundColor: draft.bargaining ? '#E8F1FF' : '#F7F7F7', borderColor: draft.bargaining ? colors.primary : '#E2E8F0' }}
        className="rounded-xl px-4 py-3 border"
      >
        <Text style={{ fontFamily: draft.bargaining ? fonts.bold : fonts.medium, fontSize: 12, color: draft.bargaining ? colors.primary : colors.textPrimary }}>
          {draft.bargaining ? 'Pazarlık var' : 'Pazarlık yok'}
        </Text>
      </Pressable>

      {Number.isFinite(parsedPrice) && parsedPrice > 0 ? (
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: '#15803D' }}>
          Görünen fiyat: ₺{parsedPrice.toLocaleString('tr-TR')}
        </Text>
      ) : draft.price.trim().length === 0 ? (
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary }}>
          İlan kartında Fiyat Sor etiketi gösterilecek.
        </Text>
      ) : null}

      {error ? <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.danger }}>{error}</Text> : null}
    </WizardScaffold>
  );
}
