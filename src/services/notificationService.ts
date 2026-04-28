import { backendRequest, isBackendApiConfigured, isBackendStrictMode } from './backendApiClient';
import { sendPushNotification } from './pushNotificationService';

export type NotificationChannel = 'push' | 'sms' | 'email';

export type NotificationDispatchInput = {
  channels: NotificationChannel[];
  userIds?: string[];
  push?: {
    title: string;
    body: string;
    data?: Record<string, string | number | boolean | null>;
  };
  sms?: {
    to: string[];
    message: string;
    templateId?: string;
  };
  email?: {
    to: string[];
    subject: string;
    html?: string;
    text?: string;
    templateId?: string;
    templateData?: Record<string, string | number | boolean | null>;
  };
};

type DispatchResponse = {
  ok: boolean;
  requestId?: string;
  channels?: Partial<Record<NotificationChannel, { queued?: number; delivered?: number; failed?: number }>>;
};

function uniqueValues(values: string[] | undefined) {
  return [...new Set((values ?? []).map((item) => item.trim()).filter(Boolean))];
}

function assertDispatchInput(input: NotificationDispatchInput) {
  const channels = [...new Set(input.channels ?? [])];
  if (channels.length === 0) {
    throw new Error('En az bir bildirim kanali secilmelidir.');
  }

  if (channels.includes('push')) {
    if (!input.push?.title?.trim() || !input.push?.body?.trim()) {
      throw new Error('Push bildirimi icin baslik ve icerik zorunludur.');
    }
  }

  if (channels.includes('sms')) {
    const recipients = uniqueValues(input.sms?.to);
    if (recipients.length === 0 || !input.sms?.message?.trim()) {
      throw new Error('SMS gonderimi icin alici listesi ve mesaj zorunludur.');
    }
  }

  if (channels.includes('email')) {
    const recipients = uniqueValues(input.email?.to);
    const hasContent = Boolean(input.email?.html?.trim() || input.email?.text?.trim() || input.email?.templateId?.trim());
    if (recipients.length === 0 || !input.email?.subject?.trim() || !hasContent) {
      throw new Error('Email gonderimi icin alici, konu ve icerik/template zorunludur.');
    }
  }
}

function validateDispatchResponse(payload: unknown): DispatchResponse {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Bildirim dispatch cevabi gecersiz formatta.');
  }

  const parsed = payload as Partial<DispatchResponse>;
  if (typeof parsed.ok !== 'boolean') {
    throw new Error('Bildirim dispatch cevabinda ok boolean olmali.');
  }

  if (parsed.requestId !== undefined && typeof parsed.requestId !== 'string') {
    throw new Error('Bildirim dispatch cevabinda requestId string olmali.');
  }

  return {
    ok: parsed.ok,
    requestId: parsed.requestId,
    channels: parsed.channels,
  };
}

function buildIdempotencyKey(input: NotificationDispatchInput) {
  const channelKey = [...new Set(input.channels)].sort().join(',');
  const userCount = uniqueValues(input.userIds).length;
  return `notification-dispatch:${channelKey}:${userCount}:${Date.now()}`;
}

export async function dispatchNotification(input: NotificationDispatchInput): Promise<DispatchResponse> {
  assertDispatchInput(input);

  const payload: NotificationDispatchInput = {
    ...input,
    channels: [...new Set(input.channels)],
    userIds: uniqueValues(input.userIds),
    sms: input.sms
      ? {
          ...input.sms,
          to: uniqueValues(input.sms.to),
        }
      : undefined,
    email: input.email
      ? {
          ...input.email,
          to: uniqueValues(input.email.to),
        }
      : undefined,
  };

  if (isBackendApiConfigured) {
    try {
      return await backendRequest<DispatchResponse>('/v1/notifications/dispatch', {
        method: 'POST',
        body: payload,
        idempotencyKey: buildIdempotencyKey(payload),
        responseValidator: validateDispatchResponse,
      });
    } catch (error) {
      if (isBackendStrictMode) {
        throw error;
      }
    }
  }

  // Gecis modunda push kanali icin mevcut edge function fallback'i aktif.
  if (payload.channels.includes('push') && payload.push && (payload.userIds?.length ?? 0) > 0) {
    await sendPushNotification({
      userIds: payload.userIds ?? [],
      title: payload.push.title,
      body: payload.push.body,
      data: payload.push.data,
    });

    return {
      ok: true,
      channels: {
        push: {
          delivered: payload.userIds?.length ?? 0,
        },
      },
    };
  }

  throw new Error('Bildirim servisi backend olmadan bu kanallari desteklemiyor.');
}
