import { useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { getSupabaseClient, isSupabaseConfigured } from '../services/supabase';

type NotificationsModule = typeof import('expo-notifications');
type Subscription = { remove: () => void };

type PushTokenRecord = {
  token: string;
  provider: 'expo' | 'fcm' | 'apns' | 'webpush';
};

function resolveNotificationTapRoute(data: Record<string, unknown> | undefined): string | null {
  if (!data) {
    return null;
  }

  const listingId = typeof data.listing_id === 'string' ? data.listing_id : null;
  if (listingId) {
    return `/product/${listingId}`;
  }

  const conversationId = typeof data.conversation_id === 'string' ? data.conversation_id : null;
  if (conversationId) {
    return `/messages?conversationId=${encodeURIComponent(conversationId)}`;
  }

  const reportId = typeof data.report_id === 'string' ? data.report_id : null;
  if (reportId) {
    return '/my-reports';
  }

  return '/notifications';
}

async function registerForPushNotificationsAsync(Notifications: NotificationsModule): Promise<PushTokenRecord[]> {
  if (Platform.OS === 'web') return [];

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return [];

  const projectId =
    Constants.easConfig?.projectId ??
    (typeof Constants.expoConfig?.extra?.eas?.projectId === 'string'
      ? Constants.expoConfig.extra.eas.projectId
      : undefined);

  const tokens: PushTokenRecord[] = [];

  const expoTokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  if (expoTokenData.data) {
    tokens.push({ token: expoTokenData.data, provider: 'expo' });
  }

  try {
    const nativeTokenData = await Notifications.getDevicePushTokenAsync();
    if (nativeTokenData?.data) {
      const provider =
        nativeTokenData.type === 'fcm' || nativeTokenData.type === 'android'
          ? 'fcm'
          : nativeTokenData.type === 'apns' || nativeTokenData.type === 'ios'
            ? 'apns'
            : 'webpush';
      tokens.push({ token: String(nativeTokenData.data), provider });
    }
  } catch {
    // Native token almak zorunlu degil; Expo token yeterli olabilir.
  }

  return tokens;
}

async function saveTokenToSupabase(record: PushTokenRecord): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = getSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const appVersion =
    typeof Constants.expoConfig?.version === 'string'
      ? Constants.expoConfig.version
      : null;

  // Yeni guvenli yol: token kaydi RPC ile yapilir.
  const { error: rpcError } = await supabase.rpc('register_my_push_token', {
    p_token: record.token,
    p_provider: record.provider,
    p_platform: Platform.OS,
    p_device_id: null,
    p_app_version: appVersion,
  });

  if (!rpcError) {
    return;
  }

  // Geriye donuk uyumluluk fallback'i.
  const { error } = await supabase.from('user_push_tokens').upsert(
    {
      user_id: user.id,
      token: record.token,
      platform: Platform.OS,
      provider: record.provider,
      is_active: true,
      updated_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,token' },
  );

  if (error) {
    await supabase.from('user_push_tokens').upsert(
      { user_id: user.id, token: record.token, platform: Platform.OS, is_active: true, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,token' },
    );
  }
}

export function usePushNotifications() {
  const notificationListener = useRef<Subscription | null>(null);
  const responseListener = useRef<Subscription | null>(null);

  useEffect(() => {
    let active = true;

    // Expo Go (Android) uzaktan push desteği sunmuyor; bu yüzden akışı burada pas geçiyoruz.
    const isExpoGo = isRunningInExpoGo || Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';
    if (Platform.OS === 'android' && isExpoGo) {
      return () => {
        active = false;
      };
    }

    (async () => {
      const Notifications = await import('expo-notifications');

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      const tokens = await registerForPushNotificationsAsync(Notifications);
      if (active && tokens.length > 0) {
        await Promise.all(tokens.map((token) => saveTokenToSupabase(token)));
      }

      if (!active) return;

      notificationListener.current = Notifications.addNotificationReceivedListener(() => {
        // Bildirim alındığında gerekirse state güncellemesi yapılabilir
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
        const route = resolveNotificationTapRoute(response.notification.request.content.data as Record<string, unknown> | undefined);
        if (route) {
          router.push(route as never);
        }
      });
    })().catch(() => {});

    return () => {
      active = false;
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
}
