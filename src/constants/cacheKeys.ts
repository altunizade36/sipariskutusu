export const PRODUCTS_CACHE_PREFIX = 'products:cache:v1';
export const FAVORITES_CACHE_PREFIX = 'favorites:cache:v1';
export const AUTH_ME_CACHE_PREFIX = 'auth:me:v1';

export function buildUserScopedCacheKey(prefix: string, userId: string) {
  return `${prefix}:${userId}`;
}
