import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../constants/theme';
import type { Notification } from '../services/notificationQueueService';

interface NotificationCenterProps {
  notifications: Notification[];
  isLoading?: boolean;
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onDelete?: (id: string) => void;
  emptyMessage?: string;
}

const getNotificationIcon = (type: Notification['type']) => {
  const iconMap: Record<Notification['type'], string> = {
    message: 'chatbubble-outline',
    order: 'bag-outline',
    follow: 'person-add-outline',
    promotion: 'pricetag-outline',
    system: 'information-circle-outline',
  };
  return iconMap[type] || 'notifications-outline';
};

const getPriorityColor = (priority: Notification['priority']) => {
  switch (priority) {
    case 'high':
      return colors.danger;
    case 'normal':
      return colors.primary;
    case 'low':
      return colors.textMuted;
  }
};

export function NotificationCenter({
  notifications,
  isLoading = false,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  emptyMessage = 'Bildirim yok',
}: NotificationCenterProps) {
  if (isLoading && notifications.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!notifications.length) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: 12 }}>
          {emptyMessage}
        </Text>
      </View>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View className="flex-1">
      {unreadCount > 0 && (
        <View className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Ionicons name="alert-circle" size={18} color={colors.primary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>
              {unreadCount} okunmamış bildirim
            </Text>
          </View>
          {onMarkAllAsRead && (
            <Pressable onPress={onMarkAllAsRead}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>
                Hepsini Oku
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {notifications.map((notification) => (
          <Pressable
            key={notification.id}
            onPress={() => onMarkAsRead?.(notification.id)}
            className={`px-4 py-3 border-b border-[#E5E7EB] flex-row items-start gap-3 ${
              notification.read ? 'bg-white' : 'bg-blue-50'
            }`}
          >
            <View
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{
                backgroundColor: getPriorityColor(notification.priority) + '15',
              }}
            >
              <Ionicons
                name={getNotificationIcon(notification.type) as any}
                size={18}
                color={getPriorityColor(notification.priority)}
              />
            </View>

            <View className="flex-1">
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text
                    style={{
                      fontFamily: fonts.bold,
                      fontSize: 13,
                      color: colors.textPrimary,
                    }}
                  >
                    {notification.title}
                  </Text>
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
                    {notification.body}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.regular,
                      fontSize: 11,
                      color: colors.textMuted,
                      marginTop: 6,
                    }}
                  >
                    {new Date(notification.timestamp).toLocaleString('tr-TR')}
                  </Text>
                </View>

                {!notification.read && (
                  <View className="w-2 h-2 rounded-full mt-2" style={{ backgroundColor: colors.primary }} />
                )}
              </View>
            </View>

            {onDelete && (
              <Pressable onPress={() => onDelete(notification.id)}>
                <Ionicons name="close-outline" size={16} color={colors.textMuted} />
              </Pressable>
            )}
          </Pressable>
        ))}
      </ScrollView>

      {isLoading && (
        <View className="py-4 items-center">
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
    </View>
  );
}
