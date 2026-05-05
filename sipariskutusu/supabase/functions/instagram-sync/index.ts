import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type InstagramAccountRow = {
  id: string;
  store_id: string;
  user_id: string;
  instagram_user_id: string;
  username: string | null;
  access_token: string;
  auth_provider?: 'facebook' | 'instagram';
};

type InstagramMedia = {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url?: string;
  thumbnail_url?: string;
  timestamp?: string;
  permalink?: string;
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

function titleFromCaption(caption: string) {
  const title = caption
    .split(/\s+/)
    .filter((word) => word && !word.startsWith('#') && !word.startsWith('@'))
    .slice(0, 7)
    .join(' ')
    .trim();
  return title || 'Instagram paylaşımı';
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
    const graphVersion = Deno.env.get('META_GRAPH_API_VERSION') ?? 'v21.0';

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      throw new Error('Instagram sync runtime env eksik.');
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

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: account, error: accountError } = await admin
      .from('instagram_accounts')
      .select('id,store_id,user_id,instagram_user_id,username,access_token,auth_provider')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (accountError) throw accountError;
    if (!account?.instagram_user_id || !account.access_token) {
      throw new Error('Bağlı Instagram hesabı bulunamadı.');
    }

    const igAccount = account as InstagramAccountRow;
    const mediaUrl = new URL(
      igAccount.auth_provider === 'instagram'
        ? 'https://graph.instagram.com/me/media'
        : `https://graph.facebook.com/${graphVersion}/${igAccount.instagram_user_id}/media`
    );
    mediaUrl.searchParams.set(
      'fields',
      'id,caption,media_type,media_url,thumbnail_url,timestamp,permalink',
    );
    mediaUrl.searchParams.set('limit', '50');
    mediaUrl.searchParams.set('access_token', igAccount.access_token);

    const payload = await fetchJson<{ data?: InstagramMedia[] }>(mediaUrl.toString());
    const media = payload.data ?? [];

    const rows = media
      .filter((item) => item.media_url || item.thumbnail_url)
      .map((item) => {
        const caption = item.caption ?? '';
        return {
          store_id: igAccount.store_id,
          seller_id: user.id,
          source_type: 'instagram',
          source_id: item.id,
          image_url: item.media_url ?? item.thumbnail_url,
          thumbnail_url: item.thumbnail_url ?? null,
          caption: caption || null,
          title: titleFromCaption(caption),
          post_type: 'product',
          media_type: item.media_type === 'VIDEO' ? 'video' : item.media_type === 'CAROUSEL_ALBUM' ? 'carousel' : 'image',
          like_count: 0,
          comment_count: 0,
          original_timestamp: item.timestamp ?? null,
        };
      });

    if (rows.length > 0) {
      const { error: upsertError } = await admin
        .from('store_posts')
        .upsert(rows, { onConflict: 'store_id,source_type,source_id' });
      if (upsertError) throw upsertError;
    }

    await admin
      .from('instagram_accounts')
      .update({ last_synced_at: new Date().toISOString(), media_count: media.length })
      .eq('id', igAccount.id);

    return jsonResponse({
      ok: true,
      account: {
        id: igAccount.instagram_user_id,
        username: igAccount.username,
      },
      media,
    });
  } catch (error) {
    return jsonResponse({ ok: false, message: error instanceof Error ? error.message : 'instagram sync failed' }, 400);
  }
});
