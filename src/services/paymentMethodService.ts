import { getSupabaseClient } from './supabase';

export interface PaymentMethodRow {
  id: string;
  user_id: string;
  provider: 'stripe' | 'iyzico';
  type: 'card' | 'wallet' | 'bank_transfer' | 'cash_on_delivery';
  brand?: string | null;
  last4?: string | null;
  holder_name?: string | null;
  expiry?: string | null;
  is_default: boolean;
  created_at?: string;
}

export interface CreatePaymentMethodInput {
  provider?: 'stripe' | 'iyzico';
  type?: 'card' | 'wallet' | 'bank_transfer' | 'cash_on_delivery';
  brand?: string;
  last4?: string;
  holder_name?: string;
  expiry?: string;
  is_default?: boolean;
}

async function getUserId() {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Giriş yapmanız gerekiyor.');
  }

  return user.id;
}

export async function fetchMyPaymentMethods(): Promise<PaymentMethodRow[]> {
  const supabase = getSupabaseClient();
  const userId = await getUserId();

  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as PaymentMethodRow[];
}

export async function createPaymentMethod(input: CreatePaymentMethodInput): Promise<void> {
  const supabase = getSupabaseClient();
  const userId = await getUserId();

  if (input.is_default) {
    const { error: unsetError } = await supabase
      .from('payment_methods')
      .update({ is_default: false })
      .eq('user_id', userId);

    if (unsetError) {
      throw unsetError;
    }
  }

  const { error } = await supabase.from('payment_methods').insert({
    user_id: userId,
    provider: input.provider ?? 'stripe',
    type: input.type ?? 'card',
    brand: input.brand ?? null,
    last4: input.last4 ?? null,
    holder_name: input.holder_name ?? null,
    expiry: input.expiry ?? null,
    is_default: Boolean(input.is_default),
  });

  if (error) {
    throw error;
  }
}

export async function setDefaultPaymentMethod(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const userId = await getUserId();

  const { error: unsetError } = await supabase
    .from('payment_methods')
    .update({ is_default: false })
    .eq('user_id', userId);

  if (unsetError) {
    throw unsetError;
  }

  const { error } = await supabase
    .from('payment_methods')
    .update({ is_default: true })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

export async function deletePaymentMethod(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const userId = await getUserId();

  const { error } = await supabase
    .from('payment_methods')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}
