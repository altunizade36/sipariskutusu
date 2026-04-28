import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { WizardScaffold } from '../../src/components/listing/WizardScaffold';
import { colors, fonts } from '../../src/constants/theme';
import { useListingWizard } from '../../src/context/ListingWizardContext';

function normalizeForFilter(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();
}

export default function ListingStep3Screen() {
  const router = useRouter();
  const { draft, leafOptions, selectLeaf } = useListingWizard();
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    const q = normalizeForFilter(query);
    if (!q) return leafOptions;
    return leafOptions.filter((item) => normalizeForFilter(item.name).includes(q));
  }, [leafOptions, query]);

  const isLeafValid = leafOptions.some((item) => item.id === draft.leafId);

  function handleNext() {
    if (!isLeafValid) {
      setError('Önce geçerli bir ürün tipi seç.');
      return;
    }

    setError('');
    router.push('/listing/step-4');
  }

  return (
    <WizardScaffold
      step={3}
      title="Ürün tipi"
      subtitle="En uygun ürün tipini seç."
      onBack={() => router.back()}
      onNext={handleNext}
      disabledNext={!isLeafValid}
    >
      {leafOptions.length > 8 ? (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Ürün tipi ara"
          placeholderTextColor={colors.textMuted}
          style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary }}
          className="bg-[#F7F7F7] rounded-xl px-4 h-11 border border-[#33333315]"
        />
      ) : null}

      <View className="gap-2">
        {filtered.map((item) => {
          const selected = draft.leafId === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => {
                selectLeaf(item.id);
                if (error) setError('');
              }}
              style={{ backgroundColor: selected ? '#E8F1FF' : '#F8FAFC', borderColor: selected ? colors.primary : '#E2E8F0' }}
              className="rounded-xl px-4 py-3 border"
            >
              <Text style={{ fontFamily: selected ? fonts.bold : fonts.medium, fontSize: 13, color: selected ? colors.primary : colors.textPrimary }}>
                {item.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {filtered.length === 0 ? (
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted }}>
          Aramaya uygun ürün tipi bulunamadı.
        </Text>
      ) : null}

      {error ? <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.danger }}>{error}</Text> : null}
    </WizardScaffold>
  );
}
