import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';

const PERM_KEY = '@sipariskutusu/message_permission';
type MessagePermission = 'everyone' | 'following' | 'none';

function buildPalette(isDarkMode: boolean) {
  return {
    bg: isDarkMode ? '#0F172A' : '#F2F3F7',
    card: isDarkMode ? '#111827' : '#FFFFFF',
    border: isDarkMode ? '#1E293B' : '#E5E7EB',
    textPrimary: isDarkMode ? '#E5E7EB' : '#111827',
    textSecondary: isDarkMode ? '#94A3B8' : '#6B7280',
    textMuted: isDarkMode ? '#4B5563' : '#9CA3AF',
    header: isDarkMode ? '#111827' : '#FFFFFF',
    selectedBg: isDarkMode ? '#1E3A8A' : '#EFF6FF',
    selectedBorder: isDarkMode ? '#2563EB' : '#BFDBFE',
  };
}

const OPTIONS: Array<{ value: MessagePermission; label: string; description: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string }> = [
  {
    value: 'everyone',
    label: 'Herkes',
    description: 'Platformdaki tüm kullanıcılar sana mesaj gönderebilir.',
    icon: 'earth-outline',
    color: '#10B981',
  },
  {
    value: 'following',
    label: 'Sadece Takip Ettiklerim',
    description: 'Yalnızca takip ettiğin kullanıcılar sana mesaj gönderebilir.',
    icon: 'people-outline',
    color: '#3B82F6',
  },
  {
    value: 'none',
    label: 'Kimse',
    description: 'Hiç kimse sana yeni mesaj gönderemez. Mevcut konuşmalar etkilenmez.',
    icon: 'ban-outline',
    color: '#EF4444',
  },
];

export default function MessagePermissionsScreen() {
  const router = useRouter();
  const { isDarkMode } = useAuth();
  const pal = buildPalette(isDarkMode);
  const [selected, setSelected] = useState<MessagePermission>('everyone');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PERM_KEY).then((val) => {
      if (val === 'everyone' || val === 'following' || val === 'none') setSelected(val);
    });
  }, []);

  const handleSave = useCallback(async (value: MessagePermission) => {
    setSaving(true);
    setSelected(value);
    await AsyncStorage.setItem(PERM_KEY, value);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: pal.bg }} edges={['top']}>
      {/* Header */}
      <View style={{ backgroundColor: pal.header, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: pal.border }}>
        <Pressable
          onPress={() => router.back()}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: pal.bg, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: pal.border }}
        >
          <Ionicons name="arrow-back" size={20} color={pal.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: pal.textPrimary }}>Mesaj Alma İzinleri</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.textSecondary, marginTop: 1 }}>Kimlerin mesaj gönderebileceğini belirle</Text>
        </View>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: pal.textSecondary, marginBottom: 16, lineHeight: 20 }}>
          Bu ayar, hangi kullanıcıların sana yeni mesaj başlatabilceğini kontrol eder. Mevcut konuşmalarını etkilemez.
        </Text>

        <View style={{ gap: 10, marginBottom: 24 }}>
          {OPTIONS.map((opt) => {
            const isSelected = selected === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => handleSave(opt.value)}
                disabled={saving}
                style={{
                  backgroundColor: isSelected ? pal.selectedBg : pal.card,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: isSelected ? colors.primary : pal.border,
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: opt.color + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={opt.icon} size={22} color={opt.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: pal.textPrimary, marginBottom: 3 }}>{opt.label}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.textSecondary, lineHeight: 18 }}>{opt.description}</Text>
                </View>
                <View style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  borderWidth: 2,
                  borderColor: isSelected ? colors.primary : pal.border,
                  backgroundColor: isSelected ? colors.primary : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {isSelected ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        {saved ? (
          <View style={{ backgroundColor: '#D1FAE5', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#059669" />
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: '#065F46' }}>Ayarlar kaydedildi.</Text>
          </View>
        ) : null}

        <View style={{ backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderRadius: 12, padding: 14, marginTop: 8, gap: 10 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: pal.textPrimary }}>Bilgi</Text>
          {[
            'Mevcut konuşmalar bu ayardan etkilenmez.',
            'Engellediğin kullanıcılar zaten mesaj gönderemez.',
            'Müşteri hizmetleri mesajları her zaman iletilir.',
          ].map((info) => (
            <View key={info} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <Ionicons name="information-circle-outline" size={15} color={pal.textMuted} style={{ marginTop: 1 }} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.textSecondary, flex: 1, lineHeight: 18 }}>{info}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
