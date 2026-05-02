import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import { useUserPreferences } from '../src/hooks/useUserPreferences';
import { LocalizationService } from '../src/utils/textProcessingUtils';

type ThemeOption = {
  id: 'light' | 'dark';
  label: string;
  description: string;
};

type LanguageOption = {
  id: 'tr' | 'en';
  label: string;
  description: string;
};

type RegionOption = {
  id: 'TR' | 'EU' | 'US';
  label: string;
  currency: 'TRY' | 'EUR' | 'USD';
};

const themeOptions: ThemeOption[] = [
  { id: 'light', label: 'Acik Tema', description: 'Aydinlik arayuz rengi kullanilir.' },
  { id: 'dark', label: 'Koyu Tema', description: 'Dusuk isikta daha rahat gorunum saglar.' },
];

const languageOptions: LanguageOption[] = [
  { id: 'tr', label: 'Turkce', description: 'Varsayilan uygulama dili' },
  { id: 'en', label: 'English', description: 'UI labels and helper texts in English' },
];

const regionOptions: RegionOption[] = [
  { id: 'TR', label: 'Turkiye', currency: 'TRY' },
  { id: 'EU', label: 'Avrupa', currency: 'EUR' },
  { id: 'US', label: 'Amerika', currency: 'USD' },
];

export default function PreferencesScreen() {
  const router = useRouter();
  const { isDarkMode, setDarkMode } = useAuth();
  const { preferences, isLoading, updateMultiple } = useUserPreferences();
  const [saving, setSaving] = useState(false);

  const selectedTheme = isDarkMode ? 'dark' : 'light';

  const selectedRegion = useMemo<'TR' | 'EU' | 'US'>(() => {
    if (preferences.currency === 'EUR') return 'EU';
    if (preferences.currency === 'USD') return 'US';
    return 'TR';
  }, [preferences.currency]);

  async function handleThemeChange(next: 'light' | 'dark') {
    if (saving || selectedTheme === next) {
      return;
    }

    setSaving(true);
    try {
      await setDarkMode(next === 'dark');
      const ok = await updateMultiple({ theme: next });
      if (!ok) {
        Alert.alert('Hata', 'Tema tercihi kaydedilemedi.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleLanguageChange(next: 'tr' | 'en') {
    if (saving || preferences.language === next) {
      return;
    }

    setSaving(true);
    try {
      const ok = await updateMultiple({ language: next });
      if (!ok) {
        Alert.alert('Hata', 'Dil tercihi kaydedilemedi.');
        return;
      }
      LocalizationService.setLanguage(next);
      Alert.alert('Bilgi', next === 'tr' ? 'Dil Turkce olarak guncellendi.' : 'Language updated to English.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRegionChange(region: RegionOption) {
    if (saving || selectedRegion === region.id) {
      return;
    }

    setSaving(true);
    try {
      const ok = await updateMultiple({ currency: region.currency });
      if (!ok) {
        Alert.alert('Hata', 'Bolge tercihi kaydedilemedi.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
      <View className="px-4 py-3 border-b border-[#33333315] flex-row items-center justify-between bg-white">
        <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-full bg-[#F7F7F7] items-center justify-center">
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: colors.textPrimary }}>Tercihler</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View className="bg-white rounded-2xl border border-[#33333315] p-4 mb-4">
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: 10 }}>Gorunum</Text>
          {themeOptions.map((option) => {
            const active = selectedTheme === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => handleThemeChange(option.id)}
                disabled={saving || isLoading}
                className="rounded-xl px-3 py-3 mb-2"
                style={{
                  borderWidth: 1,
                  borderColor: active ? '#93C5FD' : '#E5E7EB',
                  backgroundColor: active ? '#EFF6FF' : '#FFFFFF',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                <View className="flex-row items-center justify-between">
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: active ? colors.primary : colors.textPrimary }}>
                      {option.label}
                    </Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 3 }}>
                      {option.description}
                    </Text>
                  </View>
                  <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={active ? colors.primary : '#9CA3AF'} />
                </View>
              </Pressable>
            );
          })}
        </View>

        <View className="bg-white rounded-2xl border border-[#33333315] p-4 mb-4">
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: 10 }}>Dil</Text>
          {languageOptions.map((option) => {
            const active = preferences.language === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => handleLanguageChange(option.id)}
                disabled={saving || isLoading}
                className="rounded-xl px-3 py-3 mb-2"
                style={{
                  borderWidth: 1,
                  borderColor: active ? '#93C5FD' : '#E5E7EB',
                  backgroundColor: active ? '#EFF6FF' : '#FFFFFF',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                <View className="flex-row items-center justify-between">
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: active ? colors.primary : colors.textPrimary }}>
                      {option.label}
                    </Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 3 }}>
                      {option.description}
                    </Text>
                  </View>
                  <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={active ? colors.primary : '#9CA3AF'} />
                </View>
              </Pressable>
            );
          })}
        </View>

        <View className="bg-white rounded-2xl border border-[#33333315] p-4">
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: 10 }}>Bolge ve Para Birimi</Text>
          {regionOptions.map((option) => {
            const active = selectedRegion === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => handleRegionChange(option)}
                disabled={saving || isLoading}
                className="rounded-xl px-3 py-3 mb-2"
                style={{
                  borderWidth: 1,
                  borderColor: active ? '#93C5FD' : '#E5E7EB',
                  backgroundColor: active ? '#EFF6FF' : '#FFFFFF',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                <View className="flex-row items-center justify-between">
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: active ? colors.primary : colors.textPrimary }}>
                    {option.label}
                  </Text>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: active ? colors.primary : colors.textSecondary }}>
                    {option.currency}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
