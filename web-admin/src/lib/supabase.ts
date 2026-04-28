import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  throw new Error('Supabase URL ve ANON_KEY eksik. web-admin/.env dosyasını kontrol edin.');
}

export const supabase = createClient(url, key);
