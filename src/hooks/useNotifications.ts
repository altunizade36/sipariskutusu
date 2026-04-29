import { useCallback, useEffect, useRef, useState } from 'react';

export interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  title?: string;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
  dismissible?: boolean;
}

export interface ToastQueue {
  queue: Toast[];
  add: (toast: Omit<Toast, 'id'>) => string;
  remove: (id: string) => void;
  clear: () => void;
}

export function useToastQueue(): ToastQueue {
  const [queue, setQueue] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const add = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast_${++idRef.current}`;
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 3000,
      dismissible: toast.dismissible !== false,
    };

    setQueue((prev) => [...prev, newToast]);

    if (toast.duration !== 0) {
      const timeout = setTimeout(() => {
        remove(id);
      }, newToast.duration);

      return id;
    }

    return id;
  }, []);

  const remove = useCallback((id: string) => {
    setQueue((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clear = useCallback(() => {
    setQueue([]);
  }, []);

  return { queue, add, remove, clear };
}

export class NotificationService {
  private static toastQueue: Toast[] = [];
  private static listeners: ((toast: Toast) => void)[] = [];

  static subscribe(listener: (toast: Toast) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  static show(toast: Omit<Toast, 'id'>): string {
    const id = `notification_${Date.now()}_${Math.random()}`;
    const notification: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 3000,
      dismissible: toast.dismissible !== false,
    };

    this.toastQueue.push(notification);
    this.listeners.forEach((listener) => listener(notification));

    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        this.toastQueue = this.toastQueue.filter((t) => t.id !== id);
      }, notification.duration);
    }

    return id;
  }

  static success(message: string, title?: string, duration?: number): string {
    return this.show({
      type: 'success',
      message,
      title,
      duration,
    });
  }

  static error(message: string, title?: string, duration?: number): string {
    return this.show({
      type: 'error',
      message,
      title: title || 'Hata',
      duration,
    });
  }

  static warning(message: string, title?: string, duration?: number): string {
    return this.show({
      type: 'warning',
      message,
      title,
      duration,
    });
  }

  static info(message: string, title?: string, duration?: number): string {
    return this.show({
      type: 'info',
      message,
      title,
      duration,
    });
  }

  static dismiss(id: string): void {
    this.toastQueue = this.toastQueue.filter((t) => t.id !== id);
  }

  static dismissAll(): void {
    this.toastQueue = [];
  }

  static getQueue(): Toast[] {
    return [...this.toastQueue];
  }
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = NotificationService.subscribe((notification) => {
      setNotifications((prev) => {
        const updated = [...prev, notification];
        // Keep only last 10 notifications
        return updated.slice(-10);
      });
    });

    return unsubscribe;
  }, []);

  const dismissNotification = useCallback((id: string) => {
    NotificationService.dismiss(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    NotificationService.dismissAll();
    setNotifications([]);
  }, []);

  return {
    notifications,
    dismiss: dismissNotification,
    clearAll,
    show: NotificationService.show.bind(NotificationService),
    success: NotificationService.success.bind(NotificationService),
    error: NotificationService.error.bind(NotificationService),
    warning: NotificationService.warning.bind(NotificationService),
    info: NotificationService.info.bind(NotificationService),
  };
}

export interface NotificationOptions {
  title?: string;
  body: string;
  badge?: string;
  tag?: string;
  icon?: string;
  sound?: string;
  vibrate?: number[];
  requireInteraction?: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export class BrowserNotificationService {
  static isSupported(): boolean {
    return 'Notification' in window;
  }

  static async requestPermission(): Promise<'granted' | 'denied' | 'default'> {
    if (!this.isSupported()) {
      return 'denied';
    }

    if (Notification.permission !== 'default') {
      return Notification.permission as 'granted' | 'denied' | 'default';
    }

    return Notification.requestPermission();
  }

  static async show(
    title: string,
    options?: NotificationOptions,
  ): Promise<Notification | null> {
    if (!this.isSupported()) {
      return null;
    }

    if (Notification.permission !== 'granted') {
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        return null;
      }
    }

    const notification = new Notification(title, options);
    return notification;
  }

  static closeAll(): void {
    if (this.isSupported()) {
      // Note: Close all notifications (Notification API limitation)
    }
  }
}
