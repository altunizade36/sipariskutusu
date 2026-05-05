import { getSupabaseClient, isSupabaseConfigured } from './supabase';

export type VisualSearchBackendResult = {
  source: 'edge_function' | 'rpc';
  sourceName: string;
  productIds: string[];
};

const EDGE_FUNCTION_CANDIDATES = ['visual-search', 'search-by-image'] as const;
const RPC_CANDIDATES = ['search_visual_products', 'match_listings_by_image'] as const;

function sanitizeImageExtension(uri: string): string {
  const clean = (uri.split('?')[0] ?? uri).toLowerCase();
  const ext = clean.split('.').pop();
  if (ext === 'png' || ext === 'webp' || ext === 'jpg' || ext === 'jpeg') {
    return ext === 'jpeg' ? 'jpg' : ext;
  }
  return 'jpg';
}

function extractIdsFromItem(item: unknown): string[] {
  if (!item) return [];

  if (typeof item === 'string') {
    const trimmed = item.trim();
    return trimmed ? [trimmed] : [];
  }

  if (typeof item !== 'object') {
    return [];
  }

  const row = item as Record<string, unknown>;
  const directId = row.product_id ?? row.listing_id ?? row.id;
  if (typeof directId === 'string' && directId.trim()) {
    return [directId.trim()];
  }

  const nested = row.product ?? row.listing;
  if (nested && typeof nested === 'object') {
    return extractIdsFromItem(nested);
  }

  return [];
}

function extractProductIds(payload: unknown): string[] {
  if (!payload) return [];

  if (Array.isArray(payload)) {
    return payload.flatMap((item) => extractIdsFromItem(item));
  }

  if (typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    const candidates = [
      obj.results,
      obj.matches,
      obj.items,
      obj.products,
      obj.listings,
      obj.data,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        const ids = candidate.flatMap((item) => extractIdsFromItem(item));
        if (ids.length > 0 || candidate.length === 0) {
          return ids;
        }
      }
    }

    return extractIdsFromItem(obj);
  }

  return [];
}

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  ids.forEach((id) => {
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  });

  return ordered;
}

async function uploadQueryImage(imageUri: string): Promise<string> {
  const supabase = getSupabaseClient();
  const extension = sanitizeImageExtension(imageUri);
  const contentType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';

  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id ?? 'anon';
  const path = `visual-search/${userId}/${Date.now()}.${extension}`;

  const response = await fetch(imageUri);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();

  const { error } = await supabase.storage
    .from('listing-images')
    .upload(path, arrayBuffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Gorsel yuklenemedi: ${error.message}`);
  }

  const { data: publicData } = supabase.storage.from('listing-images').getPublicUrl(path);
  return publicData.publicUrl;
}

async function tryInvokeEdgeFunction(imageUrl: string, limit: number): Promise<VisualSearchBackendResult | null> {
  const supabase = getSupabaseClient();

  for (const fnName of EDGE_FUNCTION_CANDIDATES) {
    const { data, error } = await supabase.functions.invoke(fnName, {
      body: {
        image_url: imageUrl,
        imageUrl,
        top_k: limit,
        limit,
      },
    });

    if (error) {
      continue;
    }

    const ids = uniqueIds(extractProductIds(data)).slice(0, limit);
    return {
      source: 'edge_function',
      sourceName: fnName,
      productIds: ids,
    };
  }

  return null;
}

async function tryInvokeRpc(imageUrl: string, limit: number): Promise<VisualSearchBackendResult | null> {
  const supabase = getSupabaseClient();
  const rpc = supabase.rpc as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;

  for (const fnName of RPC_CANDIDATES) {
    const payloadCandidates: Array<Record<string, unknown>> = [
      { p_image_url: imageUrl, p_limit: limit },
      { image_url: imageUrl, limit },
      { image_url: imageUrl, top_k: limit },
    ];

    for (const payload of payloadCandidates) {
      const { data, error } = await rpc(fnName, payload);
      if (error) {
        continue;
      }

      const ids = uniqueIds(extractProductIds(data)).slice(0, limit);
      return {
        source: 'rpc',
        sourceName: fnName,
        productIds: ids,
      };
    }
  }

  return null;
}

export async function performVisualSearchBackend(imageUri: string, limit = 20): Promise<VisualSearchBackendResult | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  try {
    const imageUrl = await uploadQueryImage(imageUri);

    const edgeResult = await tryInvokeEdgeFunction(imageUrl, limit);
    if (edgeResult) {
      return edgeResult;
    }

    const rpcResult = await tryInvokeRpc(imageUrl, limit);
    if (rpcResult) {
      return rpcResult;
    }
  } catch (error) {
    console.warn('[visualSearchService] backend visual search fallback:', error);
  }

  return null;
}
