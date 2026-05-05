import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type PaymentProvider = 'stripe' | 'iyzico';
type PaymentMethodType = 'card' | 'wallet' | 'bank_transfer' | 'cash_on_delivery';
type PaymentStatus = 'authorized' | 'captured' | 'failed';

type ProcessPaymentBody = {
  userId?: string;
  provider?: PaymentProvider;
  orderReference?: string;
  amount?: number;
  currency?: string;
  method?: PaymentMethodType;
  cardLast4?: string | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function sanitizeOrderReference(value: string) {
  return value.trim().slice(0, 120);
}

function isSupportedCurrency(value: string) {
  return ['TRY', 'USD', 'EUR'].includes(value);
}

function buildTransactionId(provider: PaymentProvider) {
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return `${provider}-${Date.now()}-${random}`;
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase runtime env is missing.');
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

    const payload = (await req.json()) as ProcessPaymentBody;

    const provider = payload.provider === 'iyzico' ? 'iyzico' : 'stripe';
    const method = payload.method ?? 'card';
    const amount = Number(payload.amount ?? 0);
    const currency = (payload.currency ?? 'TRY').toUpperCase();
    const orderReference = sanitizeOrderReference(payload.orderReference ?? '');
    const cardLast4 = (payload.cardLast4 ?? '').trim();

    if (!orderReference || !/^[A-Za-z0-9\-_:/]{3,120}$/.test(orderReference)) {
      throw new Error('orderReference is required and must be normalized.');
    }

    if (!Number.isFinite(amount) || amount <= 0 || amount > 500000) {
      throw new Error('amount must be greater than zero and below limit.');
    }

    if (!isSupportedCurrency(currency)) {
      throw new Error('Unsupported currency.');
    }

    if (!['card', 'wallet', 'bank_transfer', 'cash_on_delivery'].includes(method)) {
      throw new Error('Unsupported payment method.');
    }

    const { data: existingTx, error: existingTxError } = await supabase
      .from('payment_transactions')
      .select('external_tx_id, provider, status')
      .eq('user_id', user.id)
      .eq('order_reference', orderReference)
      .maybeSingle();

    if (existingTxError) {
      throw existingTxError;
    }

    if (existingTx?.external_tx_id) {
      return new Response(
        JSON.stringify({
          ok: true,
          transactionId: existingTx.external_tx_id,
          provider: (existingTx.provider as PaymentProvider) ?? provider,
          status: (existingTx.status as PaymentStatus) ?? 'authorized',
          message: 'Idempotent replay.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const status: PaymentStatus = method === 'cash_on_delivery' ? 'captured' : 'authorized';
    const transactionId = buildTransactionId(provider);

    const { error: insertError } = await supabase.from('payment_transactions').insert({
      user_id: user.id,
      provider,
      order_reference: orderReference,
      external_tx_id: transactionId,
      amount,
      currency,
      method,
      status,
      meta: {
        cardLast4: cardLast4 || null,
        source: 'edge-function',
      },
    });

    if (insertError) {
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        transactionId,
        provider,
        status,
        message: 'Payment authorized.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment processing failed.';
    return new Response(JSON.stringify({ ok: false, message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
