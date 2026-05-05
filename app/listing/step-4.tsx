import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getCategoryAttributes } from '../../src/catalog';
import { WizardScaffold } from '../../src/components/listing/WizardScaffold';
import { colors, fonts } from '../../src/constants/theme';
import { useListingWizard } from '../../src/context/ListingWizardContext';

export default function ListingStep4Screen() {
  const router = useRouter();
  const { draft, setDraftField, setAttributeValue } = useListingWizard();
  const [error, setError] = useState('');

  const fields = useMemo(() => {
    return getCategoryAttributes(draft.leafId)
      .filter((field) => !['price', 'seller', 'stock_status', 'shipping_type', 'condition'].includes(field.attribute.code))
      .slice(0, 5);
  }, [draft.leafId]);

  const missingRequired = fields.find((field) => (field.mapping.isRequired || field.attribute.isRequired) && !draft.attributeValues[field.attribute.code]?.trim());
  const canProceed = Boolean(draft.condition.trim()) && !missingRequired;

  function handleNext() {
    if (!draft.condition.trim()) {
      setError('Ürünün durumunu seç.');
      return;
    }

    if (missingRequired) {
      setError(`${missingRequired.attribute.name} alanını doldur.`);
      return;
    }

    setError('');
    router.push('/listing/step-5');
  }

  return (
    <WizardScaffold
      step={4}
      title="Ürün bilgileri"
      subtitle="Durum ve temel özellikleri gir."
      onBack={() => router.back()}
      onNext={handleNext}
      disabledNext={!canProceed}
    >
      <View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }} className="mb-2">Durum</Text>
        <View className="flex-row flex-wrap gap-2">
          {['Yeni', 'Yeni gibi', 'İyi', 'Orta'].map((item) => {
            const selected = draft.condition === item;
            return (
              <Pressable
                key={item}
                  onPress={() => {
                    setDraftField('condition', item);
                    if (error) setError('');
                  }}
                style={{ backgroundColor: selected ? '#E8F1FF' : '#F7F7F7', borderColor: selected ? colors.primary : '#E2E8F0' }}
                className="rounded-full px-4 py-2 border"
              >
                <Text style={{ fontFamily: selected ? fonts.bold : fonts.medium, fontSize: 12, color: selected ? colors.primary : colors.textPrimary }}>{item}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {fields.map((field) => (
        <View key={field.attribute.id}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }} className="mb-2">
            {field.attribute.name}{field.mapping.isRequired || field.attribute.isRequired ? ' *' : ''}
          </Text>
          {field.options.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {field.options.slice(0, 10).map((option) => {
                const selected = draft.attributeValues[field.attribute.code] === option.label;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      setAttributeValue(field.attribute.code, option.label);
                      if (error) setError('');
                    }}
                    style={{ backgroundColor: selected ? '#E8F1FF' : '#F7F7F7', borderColor: selected ? colors.primary : '#E2E8F0' }}
                    className="rounded-full px-4 py-2 border"
                  >
                    <Text style={{ fontFamily: selected ? fonts.bold : fonts.medium, fontSize: 12, color: selected ? colors.primary : colors.textPrimary }}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <TextInput
              value={draft.attributeValues[field.attribute.code] ?? ''}
              onChangeText={(value) => {
                setAttributeValue(field.attribute.code, value);
                if (error) setError('');
              }}
              placeholder={`${field.attribute.name} gir`}
              placeholderTextColor={colors.textMuted}
              style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary }}
              className="bg-[#F7F7F7] rounded-xl px-4 h-12 border border-[#33333315]"
            />
          )}
        </View>
      ))}

      {error ? <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.danger }}>{error}</Text> : null}
    </WizardScaffold>
  );
}
