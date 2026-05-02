import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { colors, fonts } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import BoxMascot from '../src/components/BoxMascot';
import {
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationRoute,
  subscribeToMyNotifications,
  type InAppNotificationRecord,
} from '../src/services/inAppNotificationService';

function formatNotificationTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<InAppNotificationRecord[]>([]);

  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (!user) {
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');
    try {
      const data = await fetchMyNotifications(200, false);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bildirimler yüklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    let active = true;

    if (!user) {
      router.replace('/auth');
      return;
    }

    loadNotifications(false).catch(() => undefined);

    const unsubscribe = subscribeToMyNotifications(user.id, () => {
      if (!active) {
        return;
      }

      loadNotifications(true).catch(() => undefined);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [loadNotifications, router, user]);

  const handleOpenNotification = useCallback(async (item: InAppNotificationRecord) => {
    if (!item.isRead) {
      try {
        await markNotificationRead(item.id);
        setItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)));
      } catch {
        // Reading state failure should not block routing.
      }
    }

    const route = resolveNotificationRoute(item);
    if (route) {
      router.push(route as never);
    }
  }, [router]);

  const handleMarkAllRead = useCallback(async () => {
    if (unreadCount === 0) {
      Alert.alert('Bilgi', 'Okunmamis bildirimin bulunmuyor.');
      return;
    }

    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((entry) => ({ ...entry, isRead: true })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bildirimler güncellenemedi.');
    }
  }, [unreadCount]);

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
      <View className="bg-white px-3 py-2 border-b border-[#33333315] flex-row items-center">
        <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.textPrimary }} className="flex-1 ml-2">
          Bildirimler
        </Text>
        {unreadCount > 0 ? (
          <View style={{ backgroundColor: colors.primary, borderRadius: 12, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginRight: 8 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>{Math.min(unreadCount, 99)}</Text>
          </View>
        ) : null}
        <Pressable
          onPress={handleMarkAllRead}
          className="px-2 py-1 rounded-md"
          style={{ opacity: unreadCount === 0 ? 0.45 : 1 }}
        >
          <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.primary }}>
            Tümünü Oku
          </Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 12, gap: 10 }}>
        {loading ? (
          <View className="items-center justify-center mt-10">
            <BoxMascot variant="loading" size={90} animated />
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>
              Bildirimler yükleniyor...
            </Text>
          </View>
        ) : items.length === 0 ? (
          <View className="rounded-2xl border border-dashed border-[#D1D5DB] bg-white px-4 py-10 items-center">
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Ionicons name="notifications-off-outline" size={26} color={colors.primary} />
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>
              Bildirim Yok
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>
              Henüz bir bildirim almadın.
            </Text>
          </View>
        ) : (
          items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => handleOpenNotification(item)}
              className="rounded-xl border border-[#33333315] bg-white p-3 active:opacity-75"
              style={!item.isRead ? { borderLeftWidth: 3, borderLeftColor: colors.primary } : undefined}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1 pr-2">
                  <Ionicons
                    name={item.isRead ? 'notifications-outline' : 'notifications'}
                    size={16}
                    color={item.isRead ? colors.textMuted : colors.primary}
                  />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, marginLeft: 8 }} numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>
                <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textMuted }}>
                  {formatNotificationTime(item.createdAt)}
                </Text>
              </View>
              {item.body ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 6, lineHeight: 18 }}>
                  {item.body}
                </Text>
              ) : null}
            </Pressable>
          ))
        )}

        {refreshing ? (
          <View className="items-center py-2">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        <Pressable
          onPress={() => loadNotifications(true)}
          className="rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 items-center"
        >
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>
            Yenile
          </Text>
        </Pressable>

        {error ? (
          <View className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2.5">
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: '#991B1B' }}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
