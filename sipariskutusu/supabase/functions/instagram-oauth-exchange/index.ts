import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type AuthProvider = 'facebook' | 'instagram';

type ExchangeBody = {
  code?: string;
  redirectUri?: string;
  provider?: AuthProvider;
};

type MetaTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: { message?: string };
};

type InstagramTokenResponse = {
  access_token?: string;
  user_id?: number;
  error_message?: string;
};

type InstagramProfile = {
  user_id?: string;
  id?: string;
  username?: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
  account_type?: 'BUSINESS' | 'CREATOR';
  error?: { message?: string };
};

type PageWithInstagram = {
  id: string;
  name?: string;
  instagram_business_account?: {
    id: string;
    username?: string;
    profile_picture_url?: string;
    followers_count?: number;
    media_count?: number;
  };
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message ?? `Meta request failed: ${response.status}`);
  }
  return payload as T;
}

async function fetchFormJson<T>(url: string, form: URLSearchParams): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const payload = await response.json();
  if (!response.ok || payload?.error || payload?.error_message) {
    throw new Error(payload?.error?.message ?? payload?.error_message ?? `Instagram request failed: ${response.status}`);
  }
  return payload as T;
}

async function exchangeInstagramLoginCode(params: {
  appId: string;
  appSecret: string;
  code: string;
  redirectUri: string;
}) {
  const form = new URLSearchParams();
  form.set('client_id', params.appId);
  form.set('client_secret', params.appSecret);
  form.set('grant_type', 'authorization_code');
  form.set('redirect_uri', params.redirectUri);
  form.set('code', params.code);

  const shortToken = await fetchFormJson<InstagramTokenResponse>('https://api.instagram.com/oauth/access_token', form);
  if (!shortToken.access_token) {
    throw new Error('Instagram access token alınamadı.');
  }

  const longTokenUrl = new URL('https://graph.instagram.com/access_token');
  longTokenUrl.searchParams.set('grant_type', 'ig_exchange_token');
  longTokenUrl.searchParams.set('client_secret', params.appSecret);
  longTokenUrl.searchParams.set('access_token', shortToken.access_token);
  const longToken = await fetchJson<MetaTokenResponse>(longTokenUrl.toString());
  const accessToken = longToken.access_token ?? shortToken.access_token;
  const expiresIn = longToken.expires_in ?? 60 * 24 * 60 * 60;

  const profileUrl = new URL('https://graph.instagram.com/me');
  profileUrl.searchParams.set('fields', 'user_id,username,profile_picture_url,followers_count,media_count,account_type');
  profileUrl.searchParams.set('access_token', accessToken);
  const profile = await fetchJson<InstagramProfile>(profileUrl.toString());
  const instagramId = profile.user_id ?? profile.id ?? (shortToken.user_id ? String(shortToken.user_id) : null);
  if (!instagramId) {
    throw new Error('Instagram Business/Creator hesabı bulunamadı.');
  }

  return {
    accessToken,
    tokenExpiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    instagram: {
      id: instagramId,
      username: profile.username ?? '',
      profile_picture_url: profile.profile_picture_url ?? null,
      followers_count: profile.followers_count ?? 0,
      media_count: profile.media_count ?? 0,
      account_type: profile.account_type ?? 'BUSINESS',
    },
  };
}

async function exchangeFacebookLoginCode(params: {
  appId: string;
  appSecret: string;
  graphVersion: string;
  code: string;
  redirectUri: string;
}) {
  const tokenUrl = new URL(`https://graph.facebook.com/${params.graphVersion}/oauth/access_token`);
  tokenUrl.searchParams.set('client_id', params.appId);
  tokenUrl.searchParams.set('client_secret', params.appSecret);
  tokenUrl.searchParams.set('redirect_uri', params.redirectUri);
  tokenUrl.searchParams.set('code', params.code);
  const shortToken = await fetchJson<MetaTokenResponse>(tokenUrl.toString());
  if (!shortToken.access_token) {
    throw new Error('Meta access token alınamadı.');
  }

  const longTokenUrl = new URL(`https://graph.facebook.com/${params.graphVersion}/oauth/access_token`);
  longTokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
  longTokenUrl.searchParams.set('client_id', params.appId);
  longTokenUrl.searchParams.set('client_secret', params.appSecret);
  longTokenUrl.searchParams.set('fb_exchange_token', shortToken.access_token);
  const longToken = await fetchJson<MetaTokenResponse>(longTokenUrl.toString());
  const accessToken = longToken.access_token ?? shortToken.access_token;
  const expiresIn = longToken.expires_in ?? shortToken.expires_in ?? 60 * 24 * 60 * 60;

  const pagesUrl = new URL(`https://graph.facebook.com/${params.graphVersion}/me/accounts`);
  pagesUrl.searchParams.set(
    'fields',
    'id,name,instagram_business_account{id,username,profile_picture_url,followers_count,media_count}',
  );
  pagesUrl.searchParams.set('access_token', accessToken);
  const pages = await fetchJson<{ data?: PageWithInstagram[] }>(pagesUrl.toString());
  const page = (pages.data ?? []).find((item) => item.instagram_business_account);
  const instagram = page?.instagram_business_account;

  if (!instagram?.id) {
    throw new Error('Bağlı Instagram Business/Creator hesabı bulunamadı. Meta panelinde Instagram hesabını bir Facebook sayfasına bağla.');
  }

  return {
    accessToken,
    tokenExpiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    instagram: {
      id: instagram.id,
      username: instagram.username ?? '',
      profile_picture_url: instagram.profile_picture_url ?? null,
      followers_count: instagram.followers_count ?? 0,
      media_count: instagram.media_count ?? 0,
      account_type: 'BUSINESS' as const,
    },
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
    const appId = Deno.env.get('META_APP_ID') ?? '';
    const appSecret = Deno.env.get('META_APP_SECRET') ?? '';
    const instagramAppId = Deno.env.get('INSTAGRAM_APP_ID') ?? '';
    const instagramAppSecret = Deno.env.get('INSTAGRAM_APP_SECRET') ?? '';
    const graphVersion = Deno.env.get('META_GRAPH_API_VERSION') ?? 'v21.0';

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      throw new Error('Instagram OAuth runtime env eksik.');
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await authClient.auth.getUser();
    const user = authData.user;
    if (authError || !user) {
      return jsonResponse({ ok: false, message: 'Unauthorized.' }, 401);
    }

    const body = (await req.json()) as ExchangeBody;
    const code = body.code?.trim();
    const redirectUri = body.redirectUri?.trim();
    const provider: AuthProvider = body.provider === 'facebook' ? 'facebook' : 'instagram';
    if (!code || !redirectUri) {
      throw new Error('code ve redirectUri zorunlu.');
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: store, error: storeError } = await admin
      .from('stores')
      .select('id,seller_id')
      .eq('seller_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (storeError) throw storeError;
    if (!store) {
      throw new Error('Instagram bağlamak için önce mağaza oluşturmalısın.');
    }

    const exchange = provider === 'instagram'
      ? await exchangeInstagramLoginCode({
          appId: instagramAppId,
          appSecret: instagramAppSecret,
          code,
          redirectUri,
        })
      : await exchangeFacebookLoginCode({
          appId,
          appSecret,
          graphVersion,
          code,
          redirectUri,
        });

    const instagram = exchange.instagram;
    const { data: saved, error: saveError } = await admin
      .from('instagram_accounts')
      .upsert(
        {
          user_id: user.id,
          store_id: store.id,
          instagram_user_id: instagram.id,
          username: instagram.username,
          instagram_handle: instagram.username,
          access_token: exchange.accessToken,
          token_expires_at: exchange.tokenExpiresAt,
          followers_count: instagram.followers_count,
          media_count: instagram.media_count,
          profile_pic_url: instagram.profile_picture_url,
          account_type: instagram.account_type,
          auth_provider: provider,
          verified: true,
          is_active: true,
          connected_at: new Date().toISOString(),
          last_synced_at: null,
        },
        { onConflict: 'store_id' },
      )
      .select('id,store_id,instagram_user_id,username,instagram_handle,followers_count,media_count,profile_pic_url,account_type,connected_at,token_expires_at')
      .single();

    if (saveError) throw saveError;

    return jsonResponse({ ok: true, account: saved });
  } catch (error) {
    return jsonResponse({ ok: false, message: error instanceof Error ? error.message : 'instagram oauth failed' }, 400);
  }
});
