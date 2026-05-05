import { ReactNode, useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../constants/theme';
import { useListingWizard } from '../../context/ListingWizardContext';

type Props = {
  step: number;
  title: string;
  subtitle: string;
  children: ReactNode;
  onNext: () => void;
  onBack?: () => void;
  nextLabel?: string;
  disabledNext?: boolean;
};

const STAGES = ['Kategori', 'Detay', 'Fotoğraf', 'Açıklama', 'Fiyat', 'Konum', 'Önizleme'];

export function WizardScaffold({ step, title, subtitle, children, onNext, onBack, nextLabel = 'Devam Et', disabledNext }: Props) {
  const { setCurrentStep, saveDraft } = useListingWizard();
  const progress = ((step - 1) / 9) * 100;
  const stageIndex = step <= 3 ? 0 : step === 4 ? 1 : step === 5 ? 2 : step <= 7 ? 3 : step === 8 ? 4 : step === 9 ? 5 : 6;

  useEffect(() => {
    setCurrentStep(step);
  }, [setCurrentStep, step]);

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <View className="bg-white rounded-2xl p-4 border border-[#33333315]">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 20, color: colors.textPrimary }}>{title}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }} className="mt-1">{subtitle}</Text>
            </View>
            <View className="items-end gap-2">
              <View className="px-3 py-1 rounded-full bg-[#EFF6FF]">
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary }}>Adım {step}/10</Text>
              </View>
              <Pressable
                onPress={saveDraft}
                className="h-8 px-3 rounded-full items-center justify-center border border-[#CBD5E1] bg-white"
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.textPrimary }}>Taslağı Kaydet</Text>
              </Pressable>
            </View>
          </View>

          <View className="mt-3 h-1.5 bg-[#EFF6FF] rounded-full overflow-hidden">
            <View style={{ width: `${progress}%`, backgroundColor: colors.primary }} className="h-full rounded-full" />
          </View>

          <View className="flex-row flex-wrap gap-2 mt-3">
            {STAGES.map((item, index) => {
              const active = index === stageIndex;
              const completed = index < stageIndex;
              return (
                <View
                  key={item}
                  style={{
                    backgroundColor: active ? '#DBEAFE' : completed ? '#ECFDF5' : '#F3F4F6',
                    borderColor: active ? colors.primary : completed ? '#10B981' : '#E5E7EB',
                  }}
                  className="rounded-full px-3 py-1 border"
                >
                  <Text style={{ fontFamily: active ? fonts.bold : fonts.medium, fontSize: 10, color: active ? colors.primary : completed ? '#047857' : colors.textMuted }}>
                    {item}
                  </Text>
                </View>
              );
            })}
          </View>

          <View className="mt-5 gap-3">{children}</View>

          <View className="flex-row gap-3 mt-5">
            {onBack ? (
              <Pressable onPress={onBack} className="flex-1 h-12 rounded-xl items-center justify-center border border-[#33333315] bg-white active:opacity-90">
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>Geri</Text>
              </Pressable>
            ) : null}
            <Pressable
              disabled={disabledNext}
              onPress={onNext}
              style={{ backgroundColor: disabledNext ? '#94A3B8' : colors.primary }}
              className={`${onBack ? 'flex-1' : 'w-full'} h-12 rounded-xl items-center justify-center active:opacity-90`}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{nextLabel}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
