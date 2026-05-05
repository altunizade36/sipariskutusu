import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import { useUserPreferences } from '../src/hooks/useUserPreferences';
import { fetchProfile, type Profile } from '../src/services/profileService';
import BoxMascot from '../src/components/BoxMascot';

function buildPalette(isDarkMode: boolean) {
  return {
    bg: isDarkMode ? '#0F172A' : '#F2F3F7',
    card: isDarkMode ? '#111827' : '#FFFFFF',
    border: isDarkMode ? '#1E293B' : '#E5E7EB',
    textPrimary: isDarkMode ? '#E5E7EB' : '#111827',
    textSecondary: isDarkMode ? '#94A3B8' : '#6B7280',
    textMuted: isDarkMode ? '#4B5563' : '#9CA3AF',
    header: isDarkMode ? '#111827' : '#FFFFFF',
  };
}

export default function BlockedUsersScreen() {
  const router = useRouter();
  const { isDarkMode } = useAuth();
  const { preferences, removeBlockedUser } = useUserPreferences();
  const pal = buildPalette(isDarkMode);

  const [profiles, setProfiles] = useState<Map<string, Profile | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const blockedIds = preferences.blockedUserIds ?? [];

  useEffect(() => {
    if (blockedIds.length === 0) { setLoading(false); return; }
    setLoading(true);
    Promise.all(
      blockedIds.map(async (id) => {
        try {
          const p = await fetchProfile(id);
          return [id, p] as const;
        } catch {
          return [id, null] as const;
        }
      }),
    ).then((results) => {
      setProfiles(new Map(results));
    }).finally(() => setLoading(false));
  }, [blockedIds.join(',')]);

  const handleUnblock = useCallback((userId: string, name: string) => {
    Alert.alert(
      'Engeli Kaldır',
      `${name} adlı kullanıcının engelini kaldırmak istiyor musun?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Engeli Kaldır',
          style: 'destructive',
          onPress: async () => {
            setUnblocking(userId);
            await removeBlockedUser(userId);
            setUnblocking(null);
          },
        },
      ],
    );
  }, [removeBlockedUser]);

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
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: pal.textPrimary }}>Engellenen Kullanıcılar</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.textSecondary, marginTop: 1 }}>
            {blockedIds.length > 0 ? `${blockedIds.length} kullanıcı engellendi` : 'Engellenen kimse yok'}
          </Text>
        </View>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#EF444420', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="person-remove-outline" size={18} color="#EF4444" />
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : blockedIds.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{ backgroundColor: '#EF444412', borderRadius: 60, width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <BoxMascot size={80} variant="welcome" />
          </View>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: pal.textPrimary, textAlign: 'center', marginBottom: 8 }}>
            Engellenen Kimse Yok
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: pal.textSecondary, textAlign: 'center', lineHeight: 21 }}>
            Bir kullanıcıyı engelledğinde, o kullanıcı burada görünür ve sana mesaj gönderemez.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14 }}>
          <View style={{ backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, flexDirection: 'row', gap: 10, marginBottom: 14, alignItems: 'flex-start' }}>
            <Ionicons name="information-circle-outline" size={18} color="#D97706" style={{ marginTop: 1 }} />
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: '#92400E', flex: 1, lineHeight: 18 }}>
              Engellediğin kullanıcılar sana mesaj gönderemez ve ilanlarını göremez. Engeli kaldırmak için sağ taraftaki "Kaldır" butonuna dokun.
            </Text>
          </View>

          <View style={{ backgroundColor: pal.card, borderRadius: 16, borderWidth: 1, borderColor: pal.border, overflow: 'hidden' }}>
            {blockedIds.map((userId, idx) => {
              const profile = profiles.get(userId);
              const displayName = profile?.full_name ?? profile?.username ?? `Kullanıcı #${userId.slice(0, 8)}`;
              const isLast = idx === blockedIds.length - 1;
              return (
                <View
                  key={userId}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: isLast ? 0 : 1, borderBottomColor: pal.border }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#EF444420', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: '#EF4444' }}>
                      {displayName[0]?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: pal.textPrimary }}>{displayName}</Text>
                    {profile?.username ? (
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.textSecondary, marginTop: 1 }}>@{profile.username}</Text>
                    ) : null}
                  </View>
                  {unblocking === userId ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Pressable
                      onPress={() => handleUnblock(userId, displayName)}
                      style={{ backgroundColor: '#EF444415', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: '#EF444430' }}
                    >
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#EF4444' }}>Kaldır</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
