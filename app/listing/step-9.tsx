import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getDistrictNamesByProvinceName, getProvinceNames } from '../../src/address/trAddress';
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

export default function ListingStep9Screen() {
  const router = useRouter();
  const { draft, setDraftField, toggleDelivery } = useListingWizard();
  const [cityQuery, setCityQuery] = useState('');
  const [districtQuery, setDistrictQuery] = useState('');
  const [error, setError] = useState('');

  const provinces = useMemo(() => getProvinceNames(), []);
  const districts = getDistrictNamesByProvinceName(draft.city);

  const filteredCities = useMemo(() => {
    const query = normalizeForFilter(cityQuery);
    if (!query) return provinces;
    return provinces.filter((item) => normalizeForFilter(item).includes(query));
  }, [cityQuery, provinces]);

  const filteredDistricts = useMemo(() => {
    const query = normalizeForFilter(districtQuery);
    if (!query) return districts;
    return districts.filter((item) => normalizeForFilter(item).includes(query));
  }, [districtQuery, districts]);

  function selectCity(nextCity: string) {
    setDraftField('city', nextCity);
    setDraftField('district', getDistrictNamesByProvinceName(nextCity)[0] ?? 'Merkez');
    setDistrictQuery('');
    if (error) setError('');
  }

  function handleNext() {
    if (!draft.city.trim() || !draft.district.trim()) {
      setError('İl ve ilçe seçimi zorunlu.');
      return;
    }

    if (draft.delivery.length === 0) {
      setError('En az bir teslimat yöntemi seç.');
      return;
    }

    setError('');
    router.push('/listing/step-10');
  }

  return (
    <WizardScaffold
      step={9}
      title="Konum"
      subtitle="İl, ilçe ve teslimat seçeneklerini belirle."
      onBack={() => router.back()}
      onNext={handleNext}
      disabledNext={!draft.city.trim() || !draft.district.trim() || draft.delivery.length === 0}
    >
      <TextInput
        value={cityQuery}
        onChangeText={setCityQuery}
        placeholder="İl ara"
        placeholderTextColor={colors.textMuted}
        style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary }}
        className="bg-[#F7F7F7] rounded-xl px-4 h-11 border border-[#33333315]"
      />
      <View className="gap-2">
        {filteredCities.slice(0, 12).map((item) => {
          const selected = draft.city === item;
          return (
            <Pressable
              key={item}
              onPress={() => selectCity(item)}
              style={{ backgroundColor: selected ? '#E8F1FF' : '#F7F7F7', borderColor: selected ? colors.primary : '#E2E8F0' }}
              className="rounded-xl px-4 py-3 border"
            >
              <Text style={{ fontFamily: selected ? fonts.bold : fonts.medium, fontSize: 12, color: selected ? colors.primary : colors.textPrimary }}>{item}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        value={districtQuery}
        onChangeText={setDistrictQuery}
        placeholder="İlçe ara"
        placeholderTextColor={colors.textMuted}
        style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary }}
        className="bg-[#F7F7F7] rounded-xl px-4 h-11 border border-[#33333315]"
      />
      <View className="gap-2">
        {filteredDistricts.slice(0, 20).map((item) => {
          const selected = draft.district === item;
          return (
            <Pressable
              key={item}
              onPress={() => {
                setDraftField('district', item);
                if (error) setError('');
              }}
              style={{ backgroundColor: selected ? '#E8F1FF' : '#F7F7F7', borderColor: selected ? colors.primary : '#E2E8F0' }}
              className="rounded-xl px-4 py-3 border"
            >
              <Text style={{ fontFamily: selected ? fonts.bold : fonts.medium, fontSize: 12, color: selected ? colors.primary : colors.textPrimary }}>{item}</Text>
            </Pressable>
          );
        })}
      </View>

      <View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }} className="mb-2">Teslimat</Text>
        <View className="flex-row flex-wrap gap-2">
          {['Kargo', 'Kurye', 'Elden teslim'].map((item) => {
            const selected = draft.delivery.includes(item);
            return (
              <Pressable
                key={item}
                onPress={() => {
                  toggleDelivery(item);
                  if (error) setError('');
                }}
                style={{ backgroundColor: selected ? '#E8F1FF' : '#F7F7F7', borderColor: selected ? colors.primary : '#E2E8F0' }}
                className="rounded-full px-4 py-2 border"
              >
                <Text style={{ fontFamily: selected ? fonts.bold : fonts.medium, fontSize: 12, color: selected ? colors.primary : colors.textPrimary }}>
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {error ? <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.danger }}>{error}</Text> : null}
    </WizardScaffold>
  );
}
