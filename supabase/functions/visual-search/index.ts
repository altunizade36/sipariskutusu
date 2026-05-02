import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type VisualSearchBody = {
  image_url?: string;
  imageUrl?: string;
  top_k?: number;
  limit?: number;
};

type ListingRow = {
  id: string;
  title: string;
  description: string | null;
  view_count: number | null;
  favorite_count: number | null;
  created_at: string;
};

function parseTokensFromImageUrl(imageUrl: string): string[] {
  const decoded = decodeURIComponent(imageUrl).toLocaleLowerCase('tr-TR');
  return decoded
    .replace(/https?:\/\/[^/]+/g, ' ')
    .replace(/[0-9]/g, ' ')
    .split(/[^\p{L}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .slice(0, 8);
}

function scoreListingByTokenMatch(listing: ListingRow, tokens: string[]): number {
  if (tokens.length === 0) {
    return 0;
  }

  const haystack = `${listing.title} ${listing.description ?? ''}`.toLocaleLowerCase('tr-TR');
  let score = 0;

  for (const token of tokens) {
    if (listing.title.toLocaleLowerCase('tr-TR').includes(token)) {
      score += 3.5;
    }

    if (haystack.includes(token)) {
      score += 1.8;
    }
  }

  return score;
}

function scoreListingByPopularity(listing: ListingRow): number {
  const views = listing.view_count ?? 0;
  const favorites = listing.favorite_count ?? 0;
  const ageDays = Math.max(1, Math.floor((Date.now() - new Date(listing.created_at).getTime()) / 86_400_000));

  const popularity = views * 0.03 + favorites * 0.18;
  const freshnessBoost = 1 / Math.sqrt(ageDays);
  return popularity + freshnessBoost;
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      throw new Error('Supabase runtime env eksik.');
    }

    const authHeader = req.headers.get('Authorization') ?? '';

    // Request'in oturumunu doğrula (anon key + authorization header)
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ ok: false, message: 'Unauthorized.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = (await req.json()) as VisualSearchBody;
    const imageUrl = (payload.image_url ?? payload.imageUrl ?? '').trim();
    const limit = Math.min(Math.max(payload.top_k ?? payload.limit ?? 20, 1), 50);

    if (!imageUrl) {
      throw new Error('image_url zorunlu.');
    }

    const tokens = parseTokensFromImageUrl(imageUrl);

    // Service role ile active listings çekilir (RLS'ten bağımsız, endpoint-side güvenli filtre uygulanır)
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await admin
      .from('listings')
      .select('id,title,description,view_count,favorite_count,created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(400);

    if (error) {
      throw new Error(`Listing sorgusu basarisiz: ${error.message}`);
    }

    const rows = (data ?? []) as ListingRow[];

    const ranked = rows
      .map((listing) => {
        const tokenScore = scoreListingByTokenMatch(listing, tokens);
        const popularityScore = scoreListingByPopularity(listing);

        // Token match varsa onu öne çıkar, yoksa popularity/freshness ile fallback sırala.
        const finalScore = tokenScore > 0 ? tokenScore * 1.9 + popularityScore : popularityScore;

        return {
          listing_id: listing.id,
          score: Number(finalScore.toFixed(5)),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return new Response(
      JSON.stringify({
        ok: true,
        mode: tokens.length > 0 ? 'token_match' : 'popularity_fallback',
        token_count: tokens.length,
        matches: ranked,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, message: error instanceof Error ? error.message : 'visual-search failed' }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
});
