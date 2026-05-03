import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';

const NOTIF_PREFS_KEY = '@sipariskutusu/notification_prefs';

interface NotificationPrefs {
  messages: boolean;
  favorites: boolean;
  likes: boolean;
  comments: boolean;
  follows: boolean;
  listingApproval: boolean;
  instagramSync: boolean;
  adminAnnouncements: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  messages: true,
  favorites: true,
  likes: true,
  comments: true,
  follows: true,
  listingApproval: true,
  instagramSync: true,
  adminAnnouncements: true,
};

type NotifKey = keyof NotificationPrefs;

const NOTIF_ROWS: {
  key: NotifKey;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  description: string;
  color: string;
}[] = [
  { key: 'messages',          icon: 'chatbubble-ellipses-outline', label: 'Mesaj Bildirimleri',                  description: 'Satıcı veya alıcıdan yeni mesaj geldiğinde',      color: '#6366F1' },
  { key: 'favorites',         icon: 'heart-outline',               label: 'Favori Bildirimleri',                 description: 'İlanın favoriye eklendiğinde',                    color: '#EF4444' },
  { key: 'likes',             icon: 'thumbs-up-outline',           label: 'Beğeni Bildirimleri',                 description: 'İlanın beğenildiğinde',                          color: '#F59E0B' },
  { key: 'comments',          icon: 'chatbubbles-outline',         label: 'Yorum Bildirimleri',                  description: 'İlanına yorum yapıldığında',                      color: '#8B5CF6' },
  { key: 'follows',           icon: 'person-add-outline',          label: 'Takip Bildirimleri',                  description: 'Mağazan takip edildiğinde',                       color: '#10B981' },
  { key: 'listingApproval',   icon: 'checkmark-circle-outline',    label: 'Ürün Onay / Red Bildirimleri',        description: 'İlan onaylandı veya reddedildi',                  color: '#3B82F6' },
  { key: 'instagramSync',     icon: 'logo-instagram',              label: 'Instagram Senkronizasyon',            description: 'Instagram içerik senkronizasyon durumu',          color: '#E1306C' },
  { key: 'adminAnnouncements',icon: 'megaphone-outline',           label: 'Admin Duyuruları',                    description: 'Platform güncelleme ve önemli duyurular',         color: '#64748B' },
];

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { isDarkMode } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<NotifKey | null>(null);

  const pal = {
    bg: isDarkMode ? '#0F172A' : '#F7F7F7',
    card: isDarkMode ? '#111827' : '#FFFFFF',
    border: isDarkMode ? '#334155' : '#E5E7EB',
    headerBg: isDarkMode ? '#111827' : '#FFFFFF',
    textPrimary: isDarkMode ? '#E5E7EB' : '#0F172A',
    textSecondary: isDarkMode ? '#94A3B8' : '#6B7280',
    sectionLabel: isDarkMode ? '#64748B' : '#9CA3AF',
    iconBg: isDarkMode ? '#1E293B' : '#F1F5F9',
  };

  useEffect(() => {
    AsyncStorage.getItem(NOTIF_PREFS_KEY)
      .then((stored) => {
        if (stored) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = useCallback(async (key: NotifKey, value: boolean) => {
    setSaving(key);
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    try {
      await AsyncStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(updated));
    } catch {
      setPrefs(prefs);
    } finally {
      setSaving(null);
    }
  }, [prefs]);

  const allOn = Object.values(prefs).every(Boolean);

  const toggleAll = useCallback(async () => {
    const next = !allOn;
    const updated = Object.fromEntries(Object.keys(DEFAULT_PREFS).map((k) => [k, next])) as unknown as NotificationPrefs;
    setPrefs(updated);
    try {
      await AsyncStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(updated));
    } catch {
      setPrefs(prefs);
    }
  }, [allOn, prefs]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: pal.bg }} edges={['top']}>
      {/* Header */}
      <View style={{ backgroundColor: pal.headerBg, borderBottomColor: pal.border, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
        <Pressable onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: pal.iconBg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={20} color={pal.textPrimary} />
        </Pressable>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: pal.textPrimary, flex: 1 }}>Bildirim Ayarları</Text>
        {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Info banner */}
        <View style={{ margin: 16, padding: 14, backgroundColor: isDarkMode ? '#1E3A5F' : '#EFF6FF', borderRadius: 14, borderWidth: 1, borderColor: isDarkMode ? colors.primary + '40' : '#BFDBFE', flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} style={{ marginTop: 1 }} />
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: isDarkMode ? '#93C5FD' : colors.primary, flex: 1, lineHeight: 18 }}>
            Bildirim tercihleriniz cihazınızda saklanır. Push bildirimler için cihaz ayarlarından izin vermeyi unutmayın.
          </Text>
        </View>

        {/* Tümünü aç/kapat */}
        <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
          <View style={{ backgroundColor: pal.card, borderRadius: 16, borderWidth: 1, borderColor: pal.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="notifications-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: pal.textPrimary }}>Tüm Bildirimler</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.textSecondary, marginTop: 2 }}>Hepsini aç veya kapat</Text>
            </View>
            <Switch
              value={allOn}
              onValueChange={toggleAll}
              trackColor={{ false: isDarkMode ? '#334155' : '#D1D5DB', true: colors.primary + '80' }}
              thumbColor={allOn ? colors.primary : isDarkMode ? '#64748B' : '#9CA3AF'}
            />
          </View>
        </View>

        {/* Bildirim satırları */}
        <View style={{ marginHorizontal: 16 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: pal.sectionLabel, marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Bildirim Türleri</Text>
          <View style={{ backgroundColor: pal.card, borderRadius: 16, borderWidth: 1, borderColor: pal.border, overflow: 'hidden' }}>
            {NOTIF_ROWS.map((row, idx) => {
              const isLast = idx === NOTIF_ROWS.length - 1;
              const val = prefs[row.key];
              const isSaving = saving === row.key;
              return (
                <View key={row.key} style={{ borderBottomWidth: isLast ? 0 : 1, borderBottomColor: pal.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: row.color + '18', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={row.icon} size={17} color={row.color} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: pal.textPrimary }}>{row.label}</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: pal.textSecondary, marginTop: 2 }}>{row.description}</Text>
                    </View>
                    {isSaving
                      ? <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 4 }} />
                      : (
                        <Switch
                          value={val}
                          onValueChange={(v) => toggle(row.key, v)}
                          trackColor={{ false: isDarkMode ? '#334155' : '#D1D5DB', true: row.color + '80' }}
                          thumbColor={val ? row.color : isDarkMode ? '#64748B' : '#9CA3AF'}
                        />
                      )
                    }
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
