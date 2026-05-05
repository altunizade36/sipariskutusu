export interface CdnCacheOptions {
  maxAge?: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  staleIfError?: number;
  isPublic?: boolean;
  varyBy?: string[];
}

export interface RateLimitOptions {
  maxRequests: number;
  windowSeconds: number;
  keyPrefix?: string;
}
