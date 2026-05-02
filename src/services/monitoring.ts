/**
 * monitoring.ts
 * Sentry (hata takibi) + PostHog (analitik) başlatma ve yardımcı fonksiyonlar.
 *
 * Gerekli .env değişkenleri:
 *   EXPO_PUBLIC_SENTRY_DSN       — Sentry projesinden alın
 *   EXPO_PUBLIC_POSTHOG_API_KEY  — PostHog projesinden alın
 *   EXPO_PUBLIC_POSTHOG_HOST     — PostHog sunucu adresi (örn: https://eu.i.posthog.com)
 */

import * as Sentry from '@sentry/react-native';
import PostHog from 'posthog-react-native';
import { Platform } from 'react-native';
import { TELEMETRY_EVENTS } from '../constants/telemetryEvents';
import type { TelemetryEventName, TelemetryEventPayload, TelemetryRecord } from '../constants/telemetryEvents';

// ─── Sentry ──────────────────────────────────────────────────
export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return; // DSN yoksa sessizce geç

  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    // Hata örnekleme: production'da her hatayı yakala
    sampleRate: 1.0,
    // Performans örnekleme: %20 işlem
    tracesSampleRate: __DEV__ ? 0 : 0.2,
    // Font yükleme timeout hatalarını yok say
    ignoreErrors: [
      'timeout exceeded',
      'fontfaceobserver',
      /\d+ms timeout exceeded/,
    ],
    // Kişisel veriyi maskele
    beforeSend(event) {
      if (event.user) {
        delete event.user.ip_address;
      }
      // Font timeout hatalarını filtrele
      const msg = event.exception?.values?.[0]?.value ?? '';
      if (typeof msg === 'string' && msg.includes('timeout exceeded')) {
        return null;
      }
      return event;
    },
  });
}

export function setSentryUser(userId: string | null, email?: string): void {
  if (userId) {
    Sentry.setUser({ id: userId, email });
  } else {
    Sentry.setUser(null);
  }
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (context) {
    Sentry.withScope((scope) => {
      scope.setContext('extra', context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

// ─── PostHog ─────────────────────────────────────────────────
let posthog: PostHog | null = null;

/** PostHog singleton — PostHogProvider'a client prop olarak geçilebilir */
export function getPostHogClient(): PostHog | null {
  return posthog;
}

export function initPostHog(): void {
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
  if (!apiKey) return;

  posthog = new PostHog(apiKey, {
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    captureAppLifecycleEvents: true,
  });
}

type PHProps = TelemetryRecord;
const APP_SESSION_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function withOperationalContext(properties?: PHProps): PHProps {
  return {
    session_id: APP_SESSION_ID,
    platform: Platform.OS,
    runtime: __DEV__ ? 'development' : 'production',
    ...properties,
  };
}

export function identifyUser(userId: string, properties?: PHProps): void {
  posthog?.identify(userId, withOperationalContext(properties));
}

export function resetUser(): void {
  posthog?.reset();
}

/** Ekran görüntüleme takibi */
export function trackScreen(screenName: string, properties?: PHProps): void {
  posthog?.screen(screenName, withOperationalContext(properties));
}

/** Özel olay takibi */
export function trackEvent<E extends TelemetryEventName>(event: E, properties?: TelemetryEventPayload<E>): void {
  posthog?.capture(event, withOperationalContext(properties as PHProps));
}

/** İlan oluşturma */
export function trackListingCreated(categoryId?: string, price?: number): void {
  trackEvent(TELEMETRY_EVENTS.LISTING_CREATED, { category_id: categoryId ?? null, price: price ?? null });
}

/** Sipariş tamamlandı */
export function trackOrderPlaced(orderId: string, total: number): void {
  trackEvent(TELEMETRY_EVENTS.ORDER_PLACED, { order_id: orderId, total });
}

/** Arama yapıldı */
export function trackSearch(query: string, resultCount: number): void {
  trackEvent(TELEMETRY_EVENTS.SEARCH, { query, result_count: resultCount });
}

/** Mesaj gönderildi */
export function trackMessageSent(conversationId: string): void {
  trackEvent(TELEMETRY_EVENTS.MESSAGE_SENT, { conversation_id: conversationId });
}
