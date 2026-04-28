import { getSupabaseClient } from './supabase';
import { CircuitBreaker, withRetry, withTimeout } from '../utils/resilience';

type PushPayload = {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, string | number | boolean | null>;
};

const pushCircuitBreaker = new CircuitBreaker(
  {
    failureThreshold: 3,
    resetTimeoutMs: 20_000,
  },
  'push-service',
);

export async function sendPushNotification(payload: PushPayload): Promise<void> {
  const uniqueUserIds = [...new Set(payload.userIds.filter(Boolean))];

  if (uniqueUserIds.length === 0) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await pushCircuitBreaker.execute(() =>
    withRetry(
      () =>
        withTimeout(
          () =>
            supabase.functions.invoke('send-push', {
              body: {
                ...payload,
                userIds: uniqueUserIds,
              },
            }),
          {
            timeoutMs: 7_000,
            name: 'send-push',
          },
        ),
      {
        retries: 2,
        baseDelayMs: 250,
      },
    ),
  );

  if (error) {
    throw new Error(error.message ?? 'Push bildirimi gönderilemedi.');
  }
}

export async function deactivateMyPushTokens(): Promise<void> {
  const supabase = getSupabaseClient();

  // Yeni guvenli yol: RPC.
  const { error: rpcError } = await supabase.rpc('unregister_all_my_push_tokens');
  if (!rpcError) {
    return;
  }

  // Geriye donuk uyumluluk fallback'i.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return;
  }

  await supabase
    .from('user_push_tokens')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('is_active', true);
}