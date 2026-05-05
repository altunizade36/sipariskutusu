import { getSupabaseClient, isSupabaseConfigured } from './supabase';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type BackendRequestOptions = {
  method?: HttpMethod;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  requireAuth?: boolean;
  idempotencyKey?: string;
  retryCount?: number;
  responseValidator?: (response: unknown) => unknown;
};

export class BackendApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'BackendApiError';
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_COUNT = 2;

function generateClientRequestId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // Fallback path.
  }

  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isRetryableStatus(status: number) {
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldRetryMethod(method: HttpMethod, idempotencyKey?: string) {
  if (method === 'GET' || method === 'DELETE' || method === 'PUT') {
    return true;
  }

  return Boolean(idempotencyKey);
}

export const backendApiBaseUrl = (process.env.EXPO_PUBLIC_BACKEND_API_URL ?? '').trim().replace(/\/$/, '');
export const isBackendApiConfigured = backendApiBaseUrl.length > 0;
export const isBackendStrictMode = process.env.EXPO_PUBLIC_BACKEND_STRICT_MODE === 'true';

function buildUrl(path: string, query?: BackendRequestOptions['query']) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = `${backendApiBaseUrl}${normalizedPath}`;

  if (!query) {
    return base;
  }

  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }

    params.set(key, String(value));
  });

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

async function getAccessToken() {
  if (!isSupabaseConfigured) {
    return null;
  }

  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

export async function backendRequest<T>(path: string, options: BackendRequestOptions = {}): Promise<T> {
  if (!isBackendApiConfigured) {
    throw new BackendApiError('Backend API URL yapılandırılmamış.', 0, 'BACKEND_NOT_CONFIGURED');
  }

  const {
    method = 'GET',
    body,
    query,
    headers = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    requireAuth = true,
    idempotencyKey,
    retryCount,
    responseValidator,
  } = options;

  const accessToken = requireAuth ? await getAccessToken() : null;

  if (requireAuth && !accessToken) {
    throw new BackendApiError('Yetkisiz erişim. Lütfen tekrar giriş yapın.', 401, 'UNAUTHORIZED');
  }

  const calculatedRetryCount =
    retryCount !== undefined
      ? Math.max(0, retryCount)
      : shouldRetryMethod(method, idempotencyKey)
        ? DEFAULT_RETRY_COUNT
        : 0;

  let attempt = 0;

  while (true) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(buildUrl(path, query), {
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Client-Request-Id': generateClientRequestId(),
          ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      const raw = await response.text();
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;

      if (!response.ok) {
        const apiError = (parsed ?? {}) as { message?: string; code?: string; details?: unknown };
        throw new BackendApiError(
          apiError.message ?? `API isteği başarısız (${response.status})`,
          response.status,
          apiError.code,
          apiError.details,
        );
      }

      if (!responseValidator) {
        return parsed as T;
      }

      try {
        return responseValidator(parsed) as T;
      } catch (error) {
        throw new BackendApiError(
          error instanceof Error ? error.message : 'Backend yanit dogrulamasi basarisiz.',
          502,
          'INVALID_BACKEND_RESPONSE',
          parsed,
        );
      }
    } catch (error) {
      const normalizedError =
        error instanceof BackendApiError
          ? error
          : error instanceof DOMException && error.name === 'AbortError'
            ? new BackendApiError('API isteği zaman aşımına uğradı.', 408, 'TIMEOUT')
            : new BackendApiError(
                error instanceof Error ? error.message : 'Backend API isteği başarısız.',
                0,
                'NETWORK_ERROR',
              );

      const canRetry =
        attempt < calculatedRetryCount &&
        (normalizedError.status === 0 || isRetryableStatus(normalizedError.status));

      if (!canRetry) {
        throw normalizedError;
      }

      const backoffMs = 250 * Math.pow(2, attempt);
      attempt += 1;
      await delay(backoffMs);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export async function backendGraphQL<TData = unknown, TVariables = Record<string, unknown>>(
  query: string,
  variables?: TVariables,
): Promise<TData> {
  const payload = await backendRequest<{
    data?: TData;
    errors?: Array<{ message: string }>;
  }>('/graphql', {
    method: 'POST',
    body: {
      query,
      variables: variables ?? {},
    },
  });

  if (payload.errors && payload.errors.length > 0) {
    throw new BackendApiError(payload.errors[0]?.message ?? 'GraphQL isteği başarısız.', 400, 'GRAPHQL_ERROR', payload.errors);
  }

  if (!payload.data) {
    throw new BackendApiError('GraphQL cevabında data bulunamadı.', 500, 'GRAPHQL_EMPTY_DATA');
  }

  return payload.data;
}
