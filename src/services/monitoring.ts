/**
 * monitoring.ts
 * Sentry (hata takibi) + PostHog (analitik) başlatma ve yardımcı fonksiyonlar.
 *
 * Gerekli .env değişkenleri:
 *   EXPO_PUBLIC_SENTRY_DSN       — Sentry projesinden alın
 *   EXPO_PUBLIC_POSTHOG_API_KEY  — PostHog projesinden alın
 */

import * as Sentry from '@sentry/react-native';
import PostHog from 'posthog-react-native';

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
    // Kişisel veriyi maskele
    beforeSend(event) {
      if (event.user) {
        delete event.user.ip_address;
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

export function initPostHog(): void {
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
  if (!apiKey) return;

  posthog = new PostHog(apiKey, {
    host: 'https://eu.i.posthog.com',  // EU sunucusu (KVKK uyumu)
    captureAppLifecycleEvents: true,
  });
}

type PHProps = Record<string, string | number | boolean | null | undefined>;

export function identifyUser(userId: string, properties?: PHProps): void {
  posthog?.identify(userId, properties);
}

export function resetUser(): void {
  posthog?.reset();
}

/** Ekran görüntüleme takibi */
export function trackScreen(screenName: string, properties?: PHProps): void {
  posthog?.screen(screenName, properties);
}

/** Özel olay takibi */
export function trackEvent(event: string, properties?: PHProps): void {
  posthog?.capture(event, properties);
}

/** İlan oluşturma */
export function trackListingCreated(categoryId?: string, price?: number): void {
  trackEvent('listing_created', { category_id: categoryId ?? null, price: price ?? null });
}

/** Sipariş tamamlandı */
export function trackOrderPlaced(orderId: string, total: number): void {
  trackEvent('order_placed', { order_id: orderId, total });
}

/** Arama yapıldı */
export function trackSearch(query: string, resultCount: number): void {
  trackEvent('search', { query, result_count: resultCount });
}

/** Mesaj gönderildi */
export function trackMessageSent(conversationId: string): void {
  trackEvent('message_sent', { conversation_id: conversationId });
}
