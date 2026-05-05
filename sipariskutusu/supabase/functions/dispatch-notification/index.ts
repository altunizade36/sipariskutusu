import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key',
};

type NotificationChannel = 'push' | 'sms' | 'email';

type DispatchRequestBody = {
  channels?: NotificationChannel[];
  userIds?: string[];
  push?: {
    title?: string;
    body?: string;
    data?: Record<string, string | number | boolean | null>;
  };
  sms?: {
    to?: string[];
    message?: string;
    templateId?: string;
  };
  email?: {
    to?: string[];
    subject?: string;
    html?: string;
    text?: string;
    templateId?: string;
    templateData?: Record<string, string | number | boolean | null>;
  };
};

type DeliveryLog = {
  request_id: string;
  user_id?: string;
  channel: NotificationChannel;
  recipient: string;
  status: 'queued' | 'sent' | 'failed';
  provider: string;
  provider_message_id?: string;
  error_message?: string;
};

function maskRecipient(value: string): string {
  if (!value) return '';
  if (value.startsWith('ExponentPushToken[') || value.startsWith('ExpoPushToken[')) {
    return value.slice(0, 20) + '...redacted';
  }
  const atIndex = value.indexOf('@');
  if (atIndex > 0) {
    const local = value.slice(0, atIndex);
    const domain = value.slice(atIndex);
    return local.slice(0, 2) + '***' + domain;
  }
  if (value.startsWith('+') && value.length > 6) {
    return value.slice(0, 4) + '***' + value.slice(-2);
  }
  return value.slice(0, 8) + '...redacted';
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function unique(values?: string[]) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function generateRequestId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function isExpoToken(token: string) {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

function assertDispatchPayload(payload: unknown): DispatchRequestBody {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Bildirim payload gecersiz.');
  }

  const parsed = payload as DispatchRequestBody;
  const channels = [...new Set(parsed.channels ?? [])];
  if (channels.length === 0) {
    throw new Error('En az bir kanal secilmelidir.');
  }

  if (channels.some((channel) => !['push', 'sms', 'email'].includes(channel))) {
    throw new Error('Gecersiz bildirim kanali.');
  }

  const normalizedUserIds = unique(parsed.userIds);
  const normalizedSmsRecipients = unique(parsed.sms?.to);
  const normalizedEmailRecipients = unique(parsed.email?.to);

  if (channels.includes('push')) {
    if (normalizedUserIds.length === 0) {
      throw new Error('Push gonderimi icin userIds zorunludur.');
    }
    if (!parsed.push?.title?.trim() || !parsed.push?.body?.trim()) {
      throw new Error('Push icin title ve body zorunludur.');
    }
  }

  if (channels.includes('sms')) {
    if (normalizedSmsRecipients.length === 0 || !parsed.sms?.message?.trim()) {
      throw new Error('SMS icin alici listesi ve mesaj zorunludur.');
    }
  }

  if (channels.includes('email')) {
    const hasEmailContent = Boolean(parsed.email?.html?.trim() || parsed.email?.text?.trim() || parsed.email?.templateId?.trim());
    if (normalizedEmailRecipients.length === 0 || !parsed.email?.subject?.trim() || !hasEmailContent) {
      throw new Error('Email icin alici, konu ve icerik/template zorunludur.');
    }
  }

  return {
    ...parsed,
    channels,
    userIds: normalizedUserIds,
    sms: parsed.sms
      ? {
          ...parsed.sms,
          to: normalizedSmsRecipients,
        }
      : undefined,
    email: parsed.email
      ? {
          ...parsed.email,
          to: normalizedEmailRecipients,
        }
      : undefined,
  };
}

async function sendPush(
  admin: ReturnType<typeof createClient>,
  requestId: string,
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, string | number | boolean | null>,
) {
  const { data: tokens, error } = await admin
    .from('user_push_tokens')
    .select('token,provider,user_id')
    .in('user_id', userIds)
    .eq('is_active', true);

  if (error) throw error;

  const tokenRows = (tokens ?? []) as Array<{ token: string; provider?: string | null; user_id?: string }>;
  const expoRows = tokenRows.filter((row) => (row.provider ? row.provider === 'expo' : isExpoToken(row.token)));
  const fcmRows = tokenRows.filter((row) => row.provider === 'fcm');

  let delivered = 0;
  let failed = 0;
  const logs: DeliveryLog[] = [];
  const invalidTokens: string[] = [];

  if (expoRows.length > 0) {
    const expoMessages = expoRows.map((row) => ({
      to: row.token,
      sound: 'default',
      title,
      body,
      data,
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(expoMessages),
    });

    const result = (await response.json()) as {
      data?: Array<{ status?: string; details?: { error?: string }; id?: string }>;
      errors?: Array<{ message?: string }>;
    };

    if (!response.ok) {
      throw new Error(result.errors?.[0]?.message ?? 'Expo push gonderimi basarisiz.');
    }

    (result.data ?? []).forEach((ticket, index) => {
      const row = expoRows[index];
      if (!row) return;

      if (ticket.status === 'ok') {
        delivered += 1;
        logs.push({
          request_id: requestId,
          user_id: row.user_id,
          channel: 'push',
          recipient: maskRecipient(row.token),
          status: 'sent',
          provider: 'expo',
          provider_message_id: ticket.id,
        });
        return;
      }

      failed += 1;
      const errorMessage = ticket.details?.error ?? 'expo_push_failed';
      if (errorMessage === 'DeviceNotRegistered') {
        invalidTokens.push(row.token);
      }

      logs.push({
        request_id: requestId,
        user_id: row.user_id,
        channel: 'push',
        recipient: maskRecipient(row.token),
        status: 'failed',
        provider: 'expo',
        error_message: errorMessage,
      });
    });
  }

  const fcmServerKey = Deno.env.get('FCM_SERVER_KEY') ?? '';
  if (fcmRows.length > 0 && fcmServerKey) {
    for (const row of fcmRows) {
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${fcmServerKey}`,
        },
        body: JSON.stringify({
          to: row.token,
          priority: 'high',
          notification: { title, body },
          data,
        }),
      });

      const result = (await response.json()) as {
        success?: number;
        message_id?: string;
        results?: Array<{ error?: string }>;
      };

      if (response.ok && (result.success ?? 0) > 0) {
        delivered += 1;
        logs.push({
          request_id: requestId,
          user_id: row.user_id,
          channel: 'push',
          recipient: maskRecipient(row.token),
          status: 'sent',
          provider: 'fcm',
          provider_message_id: result.message_id,
        });
        continue;
      }

      failed += 1;
      const errorMessage = result.results?.[0]?.error ?? 'fcm_push_failed';
      if (errorMessage === 'NotRegistered' || errorMessage === 'InvalidRegistration') {
        invalidTokens.push(row.token);
      }

      logs.push({
        request_id: requestId,
        user_id: row.user_id,
        channel: 'push',
        recipient: maskRecipient(row.token),
        status: 'failed',
        provider: 'fcm',
        error_message: errorMessage,
      });
    }
  } else if (fcmRows.length > 0) {
    failed += fcmRows.length;
    fcmRows.forEach((row) => {
      logs.push({
        request_id: requestId,
        user_id: row.user_id,
        channel: 'push',
        recipient: maskRecipient(row.token),
        status: 'failed',
        provider: 'fcm',
        error_message: 'FCM_SERVER_KEY missing',
      });
    });
  }

  if (invalidTokens.length > 0) {
    await admin
      .from('user_push_tokens')
      .update({
        is_active: false,
        failure_count: 1,
        last_error: 'invalid_or_unregistered_token',
        updated_at: new Date().toISOString(),
      })
      .in('token', [...new Set(invalidTokens)]);
  }

  return {
    queued: tokenRows.length,
    delivered,
    failed,
    logs,
  };
}

async function sendSms(requestId: string, payload: NonNullable<DispatchRequestBody['sms']>) {
  const smsApiUrl = Deno.env.get('SMS_API_URL') ?? '';
  const smsApiKey = Deno.env.get('SMS_API_KEY') ?? '';
  const smsSenderId = Deno.env.get('SMS_SENDER_ID') ?? '';

  const logs: DeliveryLog[] = [];
  if (!smsApiUrl || !smsApiKey) {
    payload.to?.forEach((recipient) => {
      logs.push({
        request_id: requestId,
        channel: 'sms',
        recipient: maskRecipient(recipient),
        status: 'failed',
        provider: 'sms',
        error_message: 'SMS provider not configured',
      });
    });

    return {
      queued: payload.to?.length ?? 0,
      delivered: 0,
      failed: payload.to?.length ?? 0,
      logs,
    };
  }

  let delivered = 0;
  let failed = 0;

  for (const recipient of payload.to ?? []) {
    const response = await fetch(smsApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${smsApiKey}`,
      },
      body: JSON.stringify({
        to: recipient,
        message: payload.message,
        templateId: payload.templateId,
        senderId: smsSenderId || undefined,
        requestId,
      }),
    });

    const result = (await response.json().catch(() => ({}))) as { id?: string; ok?: boolean; message?: string };

    if (response.ok && result.ok !== false) {
      delivered += 1;
      logs.push({
        request_id: requestId,
        channel: 'sms',
        recipient: maskRecipient(recipient),
        status: 'sent',
        provider: 'sms',
        provider_message_id: result.id,
      });
    } else {
      failed += 1;
      logs.push({
        request_id: requestId,
        channel: 'sms',
        recipient: maskRecipient(recipient),
        status: 'failed',
        provider: 'sms',
        error_message: result.message ?? `sms_failed_${response.status}`,
      });
    }
  }

  return {
    queued: payload.to?.length ?? 0,
    delivered,
    failed,
    logs,
  };
}

async function sendEmail(requestId: string, payload: NonNullable<DispatchRequestBody['email']>) {
  const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY') ?? '';
  const emailFromAddress = Deno.env.get('EMAIL_FROM_ADDRESS') ?? '';
  const emailFromName = Deno.env.get('EMAIL_FROM_NAME') ?? 'Sipariskutusu';

  const logs: DeliveryLog[] = [];
  if (!sendgridApiKey || !emailFromAddress) {
    payload.to?.forEach((recipient) => {
      logs.push({
        request_id: requestId,
        channel: 'email',
        recipient: maskRecipient(recipient),
        status: 'failed',
        provider: 'sendgrid',
        error_message: 'Email provider not configured',
      });
    });

    return {
      queued: payload.to?.length ?? 0,
      delivered: 0,
      failed: payload.to?.length ?? 0,
      logs,
    };
  }

  const personalizations = (payload.to ?? []).map((recipient) => ({
    to: [{ email: recipient }],
    dynamic_template_data: payload.templateData,
  }));

  const requestBody = payload.templateId
    ? {
        personalizations,
        from: { email: emailFromAddress, name: emailFromName },
        template_id: payload.templateId,
      }
    : {
        personalizations,
        from: { email: emailFromAddress, name: emailFromName },
        subject: payload.subject,
        content: [
          payload.text ? { type: 'text/plain', value: payload.text } : null,
          payload.html ? { type: 'text/html', value: payload.html } : null,
        ].filter(Boolean),
      };

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sendgridApiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (response.ok) {
    (payload.to ?? []).forEach((recipient) => {
      logs.push({
        request_id: requestId,
        channel: 'email',
        recipient: maskRecipient(recipient),
        status: 'sent',
        provider: 'sendgrid',
      });
    });

    return {
      queued: payload.to?.length ?? 0,
      delivered: payload.to?.length ?? 0,
      failed: 0,
      logs,
    };
  }

  const errorText = (await response.text().catch(() => '')).slice(0, 400);
  (payload.to ?? []).forEach((recipient) => {
    logs.push({
      request_id: requestId,
      channel: 'email',
      recipient: maskRecipient(recipient),
      status: 'failed',
      provider: 'sendgrid',
      error_message: errorText || `sendgrid_failed_${response.status}`,
    });
  });

  return {
    queued: payload.to?.length ?? 0,
    delivered: 0,
    failed: payload.to?.length ?? 0,
    logs,
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, message: 'Method not allowed.' }, 405);
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
      return jsonResponse({ ok: false, message: 'Unauthorized.' }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || callerProfile?.role !== 'admin') {
      return jsonResponse({ ok: false, message: 'Forbidden.' }, 403);
    }

    const payload = assertDispatchPayload(await req.json());
    const requestId = req.headers.get('X-Idempotency-Key') || generateRequestId();

    const admin = adminClient;

    const channels: Partial<Record<NotificationChannel, { queued: number; delivered: number; failed: number }>> = {};
    const logs: DeliveryLog[] = [];

    if (payload.channels?.includes('push') && payload.push && payload.userIds && payload.userIds.length > 0) {
      const pushResult = await sendPush(admin, requestId, payload.userIds, payload.push.title ?? '', payload.push.body ?? '', payload.push.data);
      channels.push = {
        queued: pushResult.queued,
        delivered: pushResult.delivered,
        failed: pushResult.failed,
      };
      logs.push(...pushResult.logs);
    }

    if (payload.channels?.includes('sms') && payload.sms) {
      const smsResult = await sendSms(requestId, payload.sms);
      channels.sms = {
        queued: smsResult.queued,
        delivered: smsResult.delivered,
        failed: smsResult.failed,
      };
      logs.push(...smsResult.logs);
    }

    if (payload.channels?.includes('email') && payload.email) {
      const emailResult = await sendEmail(requestId, payload.email);
      channels.email = {
        queued: emailResult.queued,
        delivered: emailResult.delivered,
        failed: emailResult.failed,
      };
      logs.push(...emailResult.logs);
    }

    if (logs.length > 0) {
      await admin.from('notification_deliveries').insert(logs);
    }

    return jsonResponse({ ok: true, requestId, channels });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Notification dispatch failed.';
    return jsonResponse({ ok: false, message }, 400);
  }
});
