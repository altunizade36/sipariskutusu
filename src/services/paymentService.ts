import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { CircuitBreaker, withRetry, withTimeout } from '../utils/resilience';
import { backendRequest, isBackendApiConfigured, isBackendStrictMode } from './backendApiClient';

export type PaymentProvider = 'stripe' | 'iyzico';
export type PaymentMethodType = 'card' | 'wallet' | 'bank_transfer' | 'cash_on_delivery';

export type ProcessPaymentInput = {
  amount: number;
  currency?: string;
  orderReference: string;
  method: PaymentMethodType;
  cardLast4?: string;
};

export type PaymentResult = {
  ok: boolean;
  transactionId: string;
  provider: PaymentProvider;
  status: 'authorized' | 'captured' | 'failed';
  message?: string;
};

function assertPaymentResultPayload(payload: unknown): PaymentResult {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Odeme cevabi gecersiz formatta.');
  }

  const parsed = payload as Partial<PaymentResult>;
  if (parsed.ok !== true) {
    throw new Error('Odeme cevabinda ok=true bekleniyor.');
  }

  if (!parsed.transactionId || typeof parsed.transactionId !== 'string') {
    throw new Error('Odeme cevabinda transactionId zorunlu.');
  }

  if (!parsed.provider || (parsed.provider !== 'stripe' && parsed.provider !== 'iyzico')) {
    throw new Error('Odeme cevabinda provider gecersiz.');
  }

  if (!parsed.status || !['authorized', 'captured', 'failed'].includes(parsed.status)) {
    throw new Error('Odeme cevabinda status gecersiz.');
  }

  return {
    ok: true,
    transactionId: parsed.transactionId,
    provider: parsed.provider,
    status: parsed.status as PaymentResult['status'],
    message: typeof parsed.message === 'string' ? parsed.message : undefined,
  };
}

function generateFallbackTxId(orderReference: string) {
  return `sim-${orderReference}-${Date.now()}`;
}

const paymentCircuitBreaker = new CircuitBreaker(
  {
    failureThreshold: 3,
    resetTimeoutMs: 20_000,
  },
  'payment-service',
);

export async function processPayment(input: ProcessPaymentInput): Promise<PaymentResult> {
  const allowedMethods: PaymentMethodType[] = ['card', 'wallet', 'bank_transfer', 'cash_on_delivery'];

  if (!input.orderReference?.trim()) {
    throw new Error('Siparis referansi zorunlu.');
  }

  if (!allowedMethods.includes(input.method)) {
    throw new Error('Desteklenmeyen ödeme metodu.');
  }

  if (input.amount <= 0 || !Number.isFinite(input.amount)) {
    throw new Error('Tutar sıfırdan büyük olmalı.');
  }

  if (input.amount > 500000) {
    throw new Error('Tek işlem limiti aşıldı.');
  }

  const currency = (input.currency ?? 'TRY').toUpperCase();
  if (!['TRY', 'USD', 'EUR'].includes(currency)) {
    throw new Error('Desteklenmeyen para birimi.');
  }

  if (isBackendApiConfigured) {
    try {
      return await backendRequest<PaymentResult>('/v1/payments/process', {
        method: 'POST',
        body: {
          ...input,
          currency,
        },
        idempotencyKey: `payment:${input.orderReference}:${input.amount}:${currency}:${input.method}`,
        responseValidator: assertPaymentResultPayload,
      });
    } catch (error) {
      if (isBackendStrictMode) {
        throw error;
      }
    }
  }

  if (!isSupabaseConfigured) {
    return {
      ok: true,
      transactionId: generateFallbackTxId(input.orderReference),
      provider: 'stripe',
      status: 'authorized',
      message: 'Supabase olmadığı için test ödeme uygulandı.',
    };
  }

  const supabase = getSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Ödeme için giriş yapmanız gerekiyor.');
  }

  const provider = (process.env.EXPO_PUBLIC_PAYMENT_PROVIDER as PaymentProvider | undefined) ?? 'stripe';

  const { data, error } = await paymentCircuitBreaker.execute(() =>
    withRetry(
      () =>
        withTimeout(
          () =>
            supabase.functions.invoke('process-payment', {
              body: {
                userId: user.id,
                provider,
                orderReference: input.orderReference,
                amount: input.amount,
                currency,
                method: input.method,
                cardLast4: input.cardLast4 ?? null,
              },
            }),
          {
            timeoutMs: 7_000,
            name: 'process-payment',
          },
        ),
      {
        retries: 2,
        baseDelayMs: 250,
      },
    ),
  );

  if (error) {
    throw new Error(error.message || 'Ödeme servisine bağlanılamadı.');
  }

  const result = data as Partial<PaymentResult> | null;

  if (!result?.ok || !result.transactionId) {
    throw new Error(result?.message || 'Ödeme işlemi başarısız.');
  }

  return {
    ok: true,
    transactionId: result.transactionId,
    provider,
    status: result.status ?? 'authorized',
    message: result.message,
  };
}
