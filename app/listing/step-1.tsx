import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
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

export default function ListingStep1Screen() {
  const router = useRouter();
  const { draft, rootCategories, selectRoot } = useListingWizard();

  const featured = useMemo(() => {
    const priority = ['kadın', 'erkek', 'elektronik', 'ev', 'anne', 'kozmetik', 'otomotiv', 'spor'];
    const picked: typeof rootCategories = [];

    priority.forEach((keyword) => {
      const found = rootCategories.find((item) => normalizeForFilter(item.name).includes(normalizeForFilter(keyword)) && !picked.includes(item));
      if (found) picked.push(found);
    });

    rootCategories.forEach((item) => {
      if (picked.length < 8 && !picked.includes(item)) picked.push(item);
    });

    return picked.slice(0, 8);
  }, [rootCategories]);

  const selectedRoot = rootCategories.find((item) => item.id === draft.rootId);
  const visibleCategories = useMemo(() => {
    if (!selectedRoot || featured.some((item) => item.id === selectedRoot.id)) {
      return featured;
    }

    return [selectedRoot, ...featured].slice(0, 8);
  }, [featured, selectedRoot]);
  const isRootValid = Boolean(selectedRoot);

  return (
    <WizardScaffold
      step={1}
      title="Ne satıyorsun?"
      subtitle="Önce ana kategoriyi seç."
      onNext={() => router.push('/listing/step-2')}
      disabledNext={!isRootValid}
    >
      <View className="flex-row flex-wrap justify-between gap-y-2">
        {visibleCategories.map((category) => {
          const selected = draft.rootId === category.id;
          const subtitle = category.children.slice(0, 2).map((child) => child.name).join(', ') || 'Detayları sonraki adımda seçersin';
          return (
            <Pressable
              key={category.id}
              onPress={() => selectRoot(category.id)}
              style={{
                width: '48.5%',
                backgroundColor: selected ? '#E8F1FF' : '#F8FAFC',
                borderColor: selected ? colors.primary : '#E2E8F0',
              }}
              className="rounded-2xl px-3 py-3 border"
            >
              <Text style={{ fontFamily: selected ? fonts.bold : fonts.medium, fontSize: 13, color: selected ? colors.primary : colors.textPrimary }}>
                {category.name}
              </Text>
              <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted }} className="mt-1">
                {subtitle}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </WizardScaffold>
  );
}
