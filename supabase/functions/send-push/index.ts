import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PushBody = {
  userIds?: string[];
  title?: string;
  body?: string;
  data?: Record<string, string | number | boolean | null>;
};

type StoredPushToken = {
  token: string;
  provider?: 'expo' | 'fcm' | 'apns' | 'webpush' | null;
  user_id?: string;
};

type DeliveryLog = {
  request_id: string;
  user_id?: string;
  channel: 'push';
  recipient: string;
  status: 'sent' | 'failed';
  provider: string;
  provider_message_id?: string;
  error_message?: string;
};

type ExpoPushMessage = {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data?: Record<string, string | number | boolean | null>;
};

function chunkArray<T>(list: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < list.length; i += chunkSize) {
    chunks.push(list.slice(i, i + chunkSize));
  }
  return chunks;
}

function isExpoPushToken(token: string) {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

function buildRequestId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `push-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

async function sendExpoMessages(messages: ExpoPushMessage[]) {
  if (messages.length === 0) {
    return {
      delivered: 0,
      invalidTokens: [] as string[],
    };
  }

  const batches = chunkArray(messages, 100);
  let delivered = 0;
  const invalidTokens: string[] = [];

  for (const batch of batches) {
    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(batch),
    });

    const expoResult = (await expoResponse.json()) as {
      data?: Array<{ status?: string; details?: { error?: string }; id?: string }>;
      errors?: Array<{ message?: string }>;
    };

    if (!expoResponse.ok) {
      throw new Error(expoResult.errors?.[0]?.message ?? 'Expo push gönderimi başarısız oldu.');
    }

    const tickets = expoResult.data ?? [];
    tickets.forEach((ticket, index) => {
      if (ticket.status === 'ok') {
        delivered += 1;
        return;
      }

      if (ticket.details?.error === 'DeviceNotRegistered') {
        invalidTokens.push(batch[index]?.to ?? '');
      }
    });
  }

  return {
    delivered,
    invalidTokens: invalidTokens.filter(Boolean),
  };
}

async function sendFcmMessages(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string | number | boolean | null>,
) {
  const fcmServerKey = Deno.env.get('FCM_SERVER_KEY') ?? '';
  if (!fcmServerKey || tokens.length === 0) {
    return {
      delivered: 0,
      invalidTokens: [] as string[],
      skipped: tokens.length,
    };
  }

  let delivered = 0;
  const invalidTokens: string[] = [];

  // Legacy FCM endpoint tek token ile daha öngörülebilir hata yönetimi saglar.
  for (const token of tokens) {
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${fcmServerKey}`,
      },
      body: JSON.stringify({
        to: token,
        priority: 'high',
        notification: {
          title,
          body,
        },
        data,
      }),
    });

    const result = (await response.json()) as {
      success?: number;
      failure?: number;
      message_id?: string;
      results?: Array<{ error?: string }>;
    };

    if (response.ok && (result.success ?? 0) > 0) {
      delivered += 1;
      continue;
    }

    const errorCode = result.results?.[0]?.error ?? '';
    if (errorCode === 'NotRegistered' || errorCode === 'InvalidRegistration') {
      invalidTokens.push(token);
    }
  }

  return {
    delivered,
    invalidTokens,
    skipped: 0,
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, message: 'Method not allowed.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      throw new Error('Supabase runtime env eksik.');
    }

    const authHeader = req.headers.get('Authorization') ?? '';

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ ok: false, message: 'Unauthorized.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = (await req.json()) as PushBody;
    const userIds = [...new Set((payload.userIds ?? []).filter(Boolean))].slice(0, 200);
    const title = payload.title?.trim() ?? '';
    const body = payload.body?.trim() ?? '';
    const requestId = buildRequestId();

    if (userIds.length === 0) {
      throw new Error('En az bir userId gerekli.');
    }

    if (!title || !body) {
      throw new Error('Push bildirimi için başlık ve içerik gerekli.');
    }

    if (title.length > 120 || body.length > 1000) {
      throw new Error('Push başlık/içerik limiti aşıldı.');
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: tokens, error: tokensError } = await admin
      .from('user_push_tokens')
      .select('token,provider,user_id')
      .in('user_id', userIds)
      .eq('is_active', true);

    if (tokensError) {
      throw tokensError;
    }

    const uniqueTokens = [...new Set((tokens ?? []).map((item: StoredPushToken) => item.token).filter(Boolean))];

    if (uniqueTokens.length === 0) {
      return new Response(JSON.stringify({ ok: true, delivered: 0, message: 'Aktif push token bulunamadı.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const expoTokens = uniqueTokens.filter((token) => {
      const tokenRow = (tokens ?? []).find((item: StoredPushToken) => item.token === token);
      if (!tokenRow?.provider) {
        return isExpoPushToken(token);
      }

      return tokenRow.provider === 'expo';
    });

    const fcmTokens = uniqueTokens.filter((token) => {
      const tokenRow = (tokens ?? []).find((item: StoredPushToken) => item.token === token);
      return tokenRow?.provider === 'fcm';
    });

    const expoMessages: ExpoPushMessage[] = expoTokens.map((token) => ({
      to: token,
      sound: 'default',
      title,
      body,
      data: payload.data,
    }));

    const logs: DeliveryLog[] = [];

    const expoDelivery = await sendExpoMessages(expoMessages);
    const fcmDelivery = await sendFcmMessages(fcmTokens, title, body, payload.data);

    (expoDelivery.invalidTokens ?? []).forEach((token) => {
      const row = (tokens ?? []).find((item: StoredPushToken) => item.token === token);
      logs.push({
        request_id: requestId,
        user_id: row?.user_id,
        channel: 'push',
        recipient: token,
        status: 'failed',
        provider: 'expo',
        error_message: 'DeviceNotRegistered',
      });
    });

    expoTokens
      .filter((token) => !expoDelivery.invalidTokens.includes(token))
      .forEach((token) => {
        const row = (tokens ?? []).find((item: StoredPushToken) => item.token === token);
        logs.push({
          request_id: requestId,
          user_id: row?.user_id,
          channel: 'push',
          recipient: token,
          status: 'sent',
          provider: 'expo',
        });
      });

    (fcmDelivery.invalidTokens ?? []).forEach((token) => {
      const row = (tokens ?? []).find((item: StoredPushToken) => item.token === token);
      logs.push({
        request_id: requestId,
        user_id: row?.user_id,
        channel: 'push',
        recipient: token,
        status: 'failed',
        provider: 'fcm',
        error_message: 'DeviceNotRegistered',
      });
    });

    fcmTokens
      .filter((token) => !fcmDelivery.invalidTokens.includes(token))
      .forEach((token) => {
        const row = (tokens ?? []).find((item: StoredPushToken) => item.token === token);
        logs.push({
          request_id: requestId,
          user_id: row?.user_id,
          channel: 'push',
          recipient: token,
          status: 'sent',
          provider: 'fcm',
        });
      });

    const invalidTokens = [...new Set([...expoDelivery.invalidTokens, ...fcmDelivery.invalidTokens])];
    if (invalidTokens.length > 0) {
      await admin
        .from('user_push_tokens')
        .update({
          is_active: false,
          last_error: 'DeviceNotRegistered',
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in('token', invalidTokens);
    }

    if (logs.length > 0) {
      await admin.from('notification_deliveries').insert(logs);
    }

    return new Response(JSON.stringify({
      ok: true,
      requestId,
      delivered: expoDelivery.delivered + fcmDelivery.delivered,
      channels: {
        expo: {
          requested: expoTokens.length,
          delivered: expoDelivery.delivered,
        },
        fcm: {
          requested: fcmTokens.length,
          delivered: fcmDelivery.delivered,
          skipped: fcmDelivery.skipped,
        },
      },
      invalidatedTokens: invalidTokens.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Push bildirimi gönderilemedi.';
    return new Response(JSON.stringify({ ok: false, message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});