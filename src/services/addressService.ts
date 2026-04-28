import { getSupabaseClient } from './supabase';

export interface AddressRow {
  id: string;
  user_id: string;
  title: string;
  full_name: string;
  phone: string;
  address_line: string;
  district?: string | null;
  city: string;
  postal_code?: string | null;
  is_default: boolean;
  created_at?: string;
}

export interface UpsertAddressInput {
  id?: string;
  title: string;
  full_name: string;
  phone: string;
  address_line: string;
  district?: string;
  city: string;
  postal_code?: string;
  is_default?: boolean;
}

async function getUserId() {
  const supabase = getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Giriş yapmanız gerekiyor.');
  }

  return user.id;
}

export async function fetchMyAddresses(): Promise<AddressRow[]> {
  const supabase = getSupabaseClient();
  const userId = await getUserId();

  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as AddressRow[];
}

export async function upsertAddress(input: UpsertAddressInput): Promise<void> {
  const supabase = getSupabaseClient();
  const userId = await getUserId();

  if (input.is_default) {
    const { error: unsetError } = await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', userId);

    if (unsetError) {
      throw unsetError;
    }
  }

  const payload = {
    user_id: userId,
    title: input.title,
    full_name: input.full_name,
    phone: input.phone,
    address_line: input.address_line,
    district: input.district ?? null,
    city: input.city,
    postal_code: input.postal_code ?? null,
    is_default: Boolean(input.is_default),
  };

  if (input.id) {
    const { error } = await supabase
      .from('addresses')
      .update(payload)
      .eq('id', input.id)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase.from('addresses').insert(payload);

  if (error) {
    throw error;
  }
}

export async function deleteAddress(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const userId = await getUserId();

  const { error } = await supabase
    .from('addresses')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

export async function setDefaultAddress(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const userId = await getUserId();

  const { error: unsetError } = await supabase
    .from('addresses')
    .update({ is_default: false })
    .eq('user_id', userId);

  if (unsetError) {
    throw unsetError;
  }

  const { error } = await supabase
    .from('addresses')
    .update({ is_default: true })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}
