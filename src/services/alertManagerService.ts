import { Alert } from 'react-native';

export type AlertType = 'info' | 'success' | 'warning' | 'error';
export type DialogType = 'alert' | 'confirm' | 'prompt' | 'custom';

export interface AlertConfig {
  title: string;
  message: string;
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>;
}

export interface DialogConfig extends AlertConfig {
  type?: DialogType;
  cancelable?: boolean;
  onConfirm?: (value?: string) => void;
  onCancel?: () => void;
}

export class AlertManager {
  static showInfo(title: string, message: string) {
    Alert.alert(title, message, [{ text: 'Tamam' }]);
  }

  static showSuccess(title: string, message: string) {
    Alert.alert(title, message, [{ text: 'Tamam' }]);
  }

  static showWarning(title: string, message: string, onPress?: () => void) {
    Alert.alert(title, message, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Devam Et', onPress, style: 'destructive' },
    ]);
  }

  static showError(title: string, message: string) {
    Alert.alert('Hata', message, [{ text: 'Tamam' }]);
  }

  static confirm(title: string, message: string, onConfirm: () => void, onCancel?: () => void) {
    Alert.alert(title, message, [
      { text: 'Hayır', onPress: onCancel, style: 'cancel' },
      { text: 'Evet', onPress: onConfirm, style: 'default' },
    ]);
  }

  static delete(
    itemName: string,
    onConfirm: () => void,
    onCancel?: () => void,
  ) {
    Alert.alert(
      `${itemName} Sil?`,
      `${itemName} silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`,
      [
        { text: 'İptal Et', onPress: onCancel, style: 'cancel' },
        {
          text: 'Sil',
          onPress: onConfirm,
          style: 'destructive',
        },
      ],
    );
  }

  static logout(onConfirm: () => void, onCancel?: () => void) {
    Alert.alert('Çıkış Yap?', 'Çıkış yapmak istediğinizden emin misiniz?', [
      { text: 'Hayır', onPress: onCancel, style: 'cancel' },
      { text: 'Evet', onPress: onConfirm, style: 'destructive' },
    ]);
  }

  static custom(config: AlertConfig) {
    const buttons = config.buttons || [{ text: 'Tamam' }];
    Alert.alert(config.title, config.message, buttons);
  }

  static showNetworkError(onRetry?: () => void) {
    Alert.alert(
      'Bağlantı Hatası',
      'İnternet bağlantısını kontrol edin ve tekrar deneyin.',
      [
        { text: 'Kapat', style: 'cancel' },
        { text: 'Tekrar Dene', onPress: onRetry },
      ],
    );
  }

  static showServerError(message?: string) {
    Alert.alert(
      'Sunucu Hatası',
      message || 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
      [{ text: 'Tamam' }],
    );
  }

  static showValidationError(errors: string[]) {
    const message = errors.join('\n');
    Alert.alert('Hata', message, [{ text: 'Tamam' }]);
  }

  static showSuccessMessage(message: string, onDismiss?: () => void) {
    Alert.alert('Başarılı', message, [{ text: 'Tamam', onPress: onDismiss }]);
  }
}

export class ToastManager {
  private static toasts: Array<{
    id: string;
    message: string;
    type: AlertType;
    duration: number;
    timeoutId: ReturnType<typeof setTimeout>;
  }> = [];

  static show(message: string, type: AlertType = 'info', duration: number = 3000) {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const timeoutId = setTimeout(() => {
      this.remove(id);
    }, duration);

    this.toasts.push({ id, message, type, duration, timeoutId });

    // Simple logging for now, in real app would emit event to Toast component
    console.log(`[${type.toUpperCase()}] ${message}`);

    return id;
  }

  static success(message: string, duration?: number) {
    return this.show(message, 'success', duration);
  }

  static error(message: string, duration?: number) {
    return this.show(message, 'error', duration);
  }

  static warning(message: string, duration?: number) {
    return this.show(message, 'warning', duration);
  }

  static info(message: string, duration?: number) {
    return this.show(message, 'info', duration);
  }

  static remove(id: string) {
    const index = this.toasts.findIndex((t) => t.id === id);
    if (index !== -1) {
      clearTimeout(this.toasts[index].timeoutId);
      this.toasts.splice(index, 1);
    }
  }

  static clear() {
    this.toasts.forEach((t) => clearTimeout(t.timeoutId));
    this.toasts = [];
  }

  static getToasts() {
    return [...this.toasts];
  }
}
