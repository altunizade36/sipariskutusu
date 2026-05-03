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
  { id: 'light', label: 'Açık Tema', description: 'Aydınlık arayüz rengi kullanılır.' },
  { id: 'dark', label: 'Koyu Tema', description: 'Düşük ışıkta daha rahat görünüm sağlar.' },
];

const languageOptions: LanguageOption[] = [
  { id: 'tr', label: 'Türkçe', description: 'Varsayılan uygulama dili' },
  { id: 'en', label: 'English', description: 'UI labels and helper texts in English' },
];

const regionOptions: RegionOption[] = [
  { id: 'TR', label: 'Türkiye', currency: 'TRY' },
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

  const palette = {
    screenBg: isDarkMode ? '#0F172A' : '#F7F7F7',
    headerBg: isDarkMode ? '#111827' : '#FFFFFF',
    cardBg: isDarkMode ? '#111827' : '#FFFFFF',
    border: isDarkMode ? '#334155' : '#E5E7EB',
    borderLight: isDarkMode ? '#1E293B' : '#33333315',
    textPrimary: isDarkMode ? '#E5E7EB' : colors.textPrimary,
    textSecondary: isDarkMode ? '#94A3B8' : colors.textSecondary,
    backBtn: isDarkMode ? '#1E293B' : '#F7F7F7',
    activeItemBg: isDarkMode ? '#1E3A8A' : '#EFF6FF',
    activeItemBorder: isDarkMode ? '#1E40AF' : '#93C5FD',
    inactiveItemBg: isDarkMode ? '#1F2937' : '#FFFFFF',
    iconBack: isDarkMode ? '#E5E7EB' : colors.textPrimary,
  };

  async function handleThemeChange(next: 'light' | 'dark') {
    if (saving || selectedTheme === next) return;
    setSaving(true);
    try {
      await setDarkMode(next === 'dark');
      const ok = await updateMultiple({ theme: next });
      if (!ok) Alert.alert('Hata', 'Tema tercihi kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLanguageChange(next: 'tr' | 'en') {
    if (saving || preferences.language === next) return;
    setSaving(true);
    try {
      const ok = await updateMultiple({ language: next });
      if (!ok) {
        Alert.alert('Hata', 'Dil tercihi kaydedilemedi.');
        return;
      }
      LocalizationService.setLanguage(next);
      Alert.alert('Bilgi', next === 'tr' ? 'Dil Türkçe olarak güncellendi.' : 'Language updated to English.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRegionChange(region: RegionOption) {
    if (saving || selectedRegion === region.id) return;
    setSaving(true);
    try {
      const ok = await updateMultiple({ currency: region.currency });
      if (!ok) Alert.alert('Hata', 'Bölge tercihi kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.screenBg }} edges={['top']}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.borderLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: palette.headerBg }}>
        <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.backBtn, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={20} color={palette.iconBack} />
        </Pressable>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: palette.textPrimary }}>Tercihler</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ backgroundColor: palette.cardBg, borderRadius: 16, borderWidth: 1, borderColor: palette.borderLight, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: palette.textSecondary, marginBottom: 10 }}>Görünüm</Text>
          {themeOptions.map((option) => {
            const active = selectedTheme === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => handleThemeChange(option.id)}
                disabled={saving || isLoading}
                style={{
                  borderWidth: 1,
                  borderColor: active ? palette.activeItemBorder : palette.border,
                  backgroundColor: active ? palette.activeItemBg : palette.inactiveItemBg,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  marginBottom: 8,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: active ? colors.primary : palette.textPrimary }}>
                      {option.label}
                    </Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textSecondary, marginTop: 3 }}>
                      {option.description}
                    </Text>
                  </View>
                  <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={active ? colors.primary : '#9CA3AF'} />
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={{ backgroundColor: palette.cardBg, borderRadius: 16, borderWidth: 1, borderColor: palette.borderLight, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: palette.textSecondary, marginBottom: 10 }}>Dil</Text>
          {languageOptions.map((option) => {
            const active = preferences.language === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => handleLanguageChange(option.id)}
                disabled={saving || isLoading}
                style={{
                  borderWidth: 1,
                  borderColor: active ? palette.activeItemBorder : palette.border,
                  backgroundColor: active ? palette.activeItemBg : palette.inactiveItemBg,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  marginBottom: 8,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: active ? colors.primary : palette.textPrimary }}>
                      {option.label}
                    </Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textSecondary, marginTop: 3 }}>
                      {option.description}
                    </Text>
                  </View>
                  <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={active ? colors.primary : '#9CA3AF'} />
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={{ backgroundColor: palette.cardBg, borderRadius: 16, borderWidth: 1, borderColor: palette.borderLight, padding: 16 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: palette.textSecondary, marginBottom: 10 }}>Bölge ve Para Birimi</Text>
          {regionOptions.map((option) => {
            const active = selectedRegion === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => handleRegionChange(option)}
                disabled={saving || isLoading}
                style={{
                  borderWidth: 1,
                  borderColor: active ? palette.activeItemBorder : palette.border,
                  backgroundColor: active ? palette.activeItemBg : palette.inactiveItemBg,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  marginBottom: 8,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: active ? colors.primary : palette.textPrimary }}>
                    {option.label}
                  </Text>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: active ? colors.primary : palette.textSecondary }}>
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
