import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { colors, fonts } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import BoxMascot from '../src/components/BoxMascot';
import {
  clearAllNotifications,
  deleteNotification,
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationRoute,
  subscribeToMyNotifications,
  type InAppNotificationRecord,
  type InAppNotificationType,
} from '../src/services/inAppNotificationService';

type FilterType = 'all' | 'unread';

const TYPE_META: Record<
  InAppNotificationType,
  { icon: string; color: string; bgColor: string }
> = {
  order_placed:              { icon: 'receipt-outline',           color: '#10B981', bgColor: '#D1FAE5' },
  order_shipped:             { icon: 'car-sport-outline',         color: '#3B82F6', bgColor: '#DBEAFE' },
  order_delivered:           { icon: 'checkmark-circle-outline',  color: '#10B981', bgColor: '#D1FAE5' },
  new_message:               { icon: 'chatbubble-ellipses-outline', color: '#6366F1', bgColor: '#EDE9FE' },
  new_review:                { icon: 'star-outline',              color: '#F59E0B', bgColor: '#FEF3C7' },
  price_drop:                { icon: 'trending-down-outline',     color: '#EF4444', bgColor: '#FEE2E2' },
  favorite_sold:             { icon: 'heart-dislike-outline',     color: '#9CA3AF', bgColor: '#F3F4F6' },
  listing_approved:          { icon: 'checkmark-circle-outline',  color: '#10B981', bgColor: '#D1FAE5' },
  listing_rejected:          { icon: 'close-circle-outline',      color: '#EF4444', bgColor: '#FEE2E2' },
  listing_comment:           { icon: 'chatbubbles-outline',       color: '#8B5CF6', bgColor: '#EDE9FE' },
  favorite_listing_comment:  { icon: 'chatbubbles-outline',       color: '#8B5CF6', bgColor: '#EDE9FE' },
  listing_favorited:         { icon: 'heart-outline',             color: '#EF4444', bgColor: '#FEE2E2' },
  listing_shared:            { icon: 'share-social-outline',      color: '#3B82F6', bgColor: '#DBEAFE' },
  seller_approved:           { icon: 'ribbon-outline',            color: '#10B981', bgColor: '#D1FAE5' },
  system:                    { icon: 'information-circle-outline', color: '#6B7280', bgColor: '#F3F4F6' },
};

function getTypeMeta(type: InAppNotificationType) {
  return TYPE_META[type] ?? TYPE_META.system;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return 'Az önce';
  if (mins < 60) return `${mins} dk önce`;
  if (hours < 24) return `${hours} sa önce`;
  if (days === 1) return 'Dün';
  if (days < 7) return `${days} gün önce`;
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

function NotificationCard({
  item,
  onPress,
  onDelete,
}: {
  item: InAppNotificationRecord;
  onPress: (item: InAppNotificationRecord) => void;
  onDelete: (id: string) => void;
}) {
  const meta = getTypeMeta(item.type);
  const [deleting, setDeleting] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [showDelete, setShowDelete] = useState(false);

  const handleLongPress = useCallback(() => {
    setShowDelete((prev) => !prev);
    Animated.spring(slideAnim, {
      toValue: showDelete ? 0 : -72,
      useNativeDriver: true,
      tension: 120,
      friction: 10,
    }).start();
  }, [showDelete, slideAnim]);

  const handleDelete = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete(item.id);
    } finally {
      setDeleting(false);
    }
  }, [deleting, item.id, onDelete]);

  return (
    <View style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, marginBottom: 8 }}>
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 72,
          backgroundColor: '#EF4444',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 16,
        }}
      >
        {deleting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Pressable onPress={handleDelete} style={{ alignItems: 'center', justifyContent: 'center', flex: 1, width: '100%' }}>
            <Ionicons name="trash-outline" size={20} color="#fff" />
          </Pressable>
        )}
      </View>

      <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
        <Pressable
          onPress={() => onPress(item)}
          onLongPress={handleLongPress}
          delayLongPress={350}
          style={{
            backgroundColor: item.isRead ? '#FFFFFF' : '#EFF6FF',
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: item.isRead ? '#E2E8F0' : '#BFDBFE',
            borderLeftWidth: item.isRead ? 1 : 3,
            borderLeftColor: item.isRead ? '#E2E8F0' : colors.primary,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: meta.bgColor,
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Ionicons name={meta.icon as never} size={18} color={meta.color} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text
                  style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, flex: 1, marginRight: 8 }}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {!item.isRead && (
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: colors.primary,
                      }}
                    />
                  )}
                  <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textMuted }}>
                    {formatRelativeTime(item.createdAt)}
                  </Text>
                </View>
              </View>
              {item.body ? (
                <Text
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 12,
                    color: colors.textSecondary,
                    marginTop: 4,
                    lineHeight: 18,
                  }}
                  numberOfLines={2}
                >
                  {item.body}
                </Text>
              ) : null}
              {resolveNotificationRoute(item) ? (
                <Text
                  style={{
                    fontFamily: fonts.medium,
                    fontSize: 11,
                    color: colors.primary,
                    marginTop: 6,
                  }}
                >
                  Detayları gör →
                </Text>
              ) : null}
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<InAppNotificationRecord[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');

  const unreadCount = useMemo(() => items.filter((i) => !i.isRead).length, [items]);

  const visibleItems = useMemo(() => {
    if (filter === 'unread') return items.filter((i) => !i.isRead);
    return items;
  }, [items, filter]);

  const loadNotifications = useCallback(
    async (isRefresh = false) => {
      if (!user) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
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
    },
    [user],
  );

  useEffect(() => {
    let active = true;
    if (!user) { router.replace('/auth'); return; }

    loadNotifications(false).catch(() => undefined);
    const unsub = subscribeToMyNotifications(user.id, () => {
      if (!active) return;
      loadNotifications(true).catch(() => undefined);
    });
    return () => { active = false; unsub(); };
  }, [loadNotifications, router, user]);

  const handleOpenNotification = useCallback(
    async (item: InAppNotificationRecord) => {
      if (!item.isRead) {
        try {
          await markNotificationRead(item.id);
          setItems((prev) =>
            prev.map((e) => (e.id === item.id ? { ...e, isRead: true } : e)),
          );
        } catch {
          // non-blocking
        }
      }
      const route = resolveNotificationRoute(item);
      if (route) router.push(route as never);
    },
    [router],
  );

  const handleMarkAllRead = useCallback(async () => {
    if (unreadCount === 0) return;
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((e) => ({ ...e, isRead: true })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Güncellenemedi.');
    }
  }, [unreadCount]);

  const handleDeleteItem = useCallback(async (id: string) => {
    try {
      await deleteNotification(id);
      setItems((prev) => prev.filter((e) => e.id !== id));
    } catch {
      Alert.alert('Hata', 'Bildirim silinemedi.');
    }
  }, []);

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Tümünü Temizle',
      'Tüm bildirimler kalıcı olarak silinecek. Emin misin?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Temizle',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllNotifications();
              setItems([]);
            } catch {
              Alert.alert('Hata', 'Bildirimler temizlenemedi.');
            }
          },
        },
      ],
    );
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F9FC' }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#E2E8F0',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: '#F1F5F9',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>

        <Text
          style={{ fontFamily: fonts.headingBold, fontSize: 18, color: colors.textPrimary, flex: 1 }}
        >
          Bildirimler
        </Text>

        {unreadCount > 0 && (
          <View
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              minWidth: 24,
              height: 24,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 8,
            }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>
              {Math.min(unreadCount, 99)}
            </Text>
          </View>
        )}

        {items.length > 0 && (
          <Pressable
            onPress={handleClearAll}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#FEE2E2',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="trash-outline" size={17} color="#EF4444" />
          </Pressable>
        )}
      </View>

      {/* Filter tabs + Mark all */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 16,
          paddingBottom: 12,
          paddingTop: 10,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: '#F1F5F9',
        }}
      >
        <View style={{ flexDirection: 'row', gap: 8, flex: 1 }}>
          {(['all', 'unread'] as const).map((f) => {
            const active = filter === f;
            const label = f === 'all' ? `Tümü (${items.length})` : `Okunmamış (${unreadCount})`;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={{
                  height: 32,
                  paddingHorizontal: 14,
                  borderRadius: 16,
                  backgroundColor: active ? colors.primary : '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: active ? fonts.bold : fonts.medium,
                    fontSize: 12,
                    color: active ? '#fff' : colors.textSecondary,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {unreadCount > 0 && (
          <Pressable onPress={handleMarkAllRead}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.primary }}>
              Tümünü oku
            </Text>
          </Pressable>
        )}
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadNotifications(true)}
            tintColor={colors.primary}
          />
        }
      >
        {loading ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
            <BoxMascot variant="loading" size={90} animated />
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 12 }}>
              Bildirimler yükleniyor...
            </Text>
          </View>
        ) : visibleItems.length === 0 ? (
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 60,
              paddingHorizontal: 24,
            }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: '#EFF6FF',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Ionicons name="notifications-off-outline" size={32} color={colors.primary} />
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>
              {filter === 'unread' ? 'Okunmamış bildirim yok' : 'Henüz bildirim yok'}
            </Text>
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 13,
                color: colors.textSecondary,
                marginTop: 8,
                textAlign: 'center',
                lineHeight: 20,
              }}
            >
              {filter === 'unread'
                ? 'Harika! Tüm bildirimleri okudun.'
                : 'Yeni sipariş, mesaj veya favori bildirimlerin burada görünecek.'}
            </Text>
            {filter === 'unread' && items.length > 0 && (
              <Pressable
                onPress={() => setFilter('all')}
                style={{
                  marginTop: 16,
                  height: 40,
                  paddingHorizontal: 24,
                  borderRadius: 20,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>
                  Tümünü Göster
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            <Text
              style={{
                fontFamily: fonts.medium,
                fontSize: 11,
                color: colors.textMuted,
                marginBottom: 12,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {visibleItems.length} bildirim • Uzun basarak sil
            </Text>
            {visibleItems.map((item) => (
              <NotificationCard
                key={item.id}
                item={item}
                onPress={handleOpenNotification}
                onDelete={handleDeleteItem}
              />
            ))}
          </>
        )}

        {error ? (
          <View
            style={{
              marginTop: 16,
              borderRadius: 12,
              backgroundColor: '#FEF2F2',
              borderWidth: 1,
              borderColor: '#FCA5A5',
              padding: 12,
            }}
          >
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: '#991B1B' }}>
              {error}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
