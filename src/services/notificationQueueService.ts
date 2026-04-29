import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Notification {
  id: string;
  type: 'message' | 'order' | 'follow' | 'promotion' | 'system';
  title: string;
  body: string;
  data?: Record<string, any>;
  timestamp: number;
  read: boolean;
  priority: 'high' | 'normal' | 'low';
}

const NOTIFICATIONS_KEY = '@sipariskutusu/notifications';
const MAX_STORED_NOTIFICATIONS = 100;

export class NotificationQueue {
  static async addNotification(
    notification: Omit<Notification, 'id' | 'timestamp' | 'read'>,
  ): Promise<Notification> {
    try {
      const full: Notification = {
        ...notification,
        id: `notif_${Date.now()}`,
        timestamp: Date.now(),
        read: false,
      };

      const notifications = await this.getAllNotifications();
      notifications.unshift(full);

      // Keep only latest N notifications
      if (notifications.length > MAX_STORED_NOTIFICATIONS) {
        notifications.splice(MAX_STORED_NOTIFICATIONS);
      }

      await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
      return full;
    } catch (error) {
      console.error('Failed to add notification:', error);
      throw error;
    }
  }

  static async getAllNotifications(): Promise<Notification[]> {
    try {
      const data = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get notifications:', error);
      return [];
    }
  }

  static async getUnreadNotifications(): Promise<Notification[]> {
    try {
      const notifications = await this.getAllNotifications();
      return notifications.filter((n) => !n.read);
    } catch (error) {
      console.error('Failed to get unread notifications:', error);
      return [];
    }
  }

  static async markAsRead(id: string): Promise<void> {
    try {
      const notifications = await this.getAllNotifications();
      const notification = notifications.find((n) => n.id === id);
      if (notification) {
        notification.read = true;
        await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  static async markAllAsRead(): Promise<void> {
    try {
      const notifications = await this.getAllNotifications();
      notifications.forEach((n) => {
        n.read = true;
      });
      await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }

  static async deleteNotification(id: string): Promise<void> {
    try {
      const notifications = await this.getAllNotifications();
      const filtered = notifications.filter((n) => n.id !== id);
      await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  }

  static async deleteOldNotifications(daysOld = 30): Promise<number> {
    try {
      const notifications = await this.getAllNotifications();
      const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
      const filtered = notifications.filter((n) => n.timestamp > cutoffTime);
      const deletedCount = notifications.length - filtered.length;

      await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(filtered));
      return deletedCount;
    } catch (error) {
      console.error('Failed to delete old notifications:', error);
      return 0;
    }
  }

  static async getNotificationsByType(type: Notification['type']): Promise<Notification[]> {
    try {
      const notifications = await this.getAllNotifications();
      return notifications.filter((n) => n.type === type);
    } catch (error) {
      console.error('Failed to get notifications by type:', error);
      return [];
    }
  }

  static async getUnreadCount(): Promise<number> {
    try {
      const unread = await this.getUnreadNotifications();
      return unread.length;
    } catch (error) {
      console.error('Failed to get unread count:', error);
      return 0;
    }
  }

  static async getStats(): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
  }> {
    try {
      const notifications = await this.getAllNotifications();
      const unread = notifications.filter((n) => !n.read).length;
      const byType = notifications.reduce(
        (acc, n) => {
          acc[n.type] = (acc[n.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      return {
        total: notifications.length,
        unread,
        byType,
      };
    } catch (error) {
      console.error('Failed to get notification stats:', error);
      return { total: 0, unread: 0, byType: {} };
    }
  }

  static async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(NOTIFICATIONS_KEY);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }
}
