# Cache and Performance Blueprint

This blueprint implements speed-critical backend primitives for:

- Product cache (Redis)
- Session store (Redis)
- Rate limiting (Redis, distributed)
- CDN edge caching (Cloudflare-compatible response headers)

## Why these are required

- Product cache: reduces repeated DB load for hot listings and search pages.
- Session store: keeps auth/session state consistent across multiple API instances.
- Rate limiting: protects API from brute-force and bot spikes.
- CDN: serves repeated GET traffic from edge POPs, reducing origin latency and cost.

## Implemented files

- address-module/backend/src/modules/performance/performance.module.ts
- address-module/backend/src/modules/performance/services/product-cache.service.ts
- address-module/backend/src/modules/performance/services/session-store.service.ts
- address-module/backend/src/modules/performance/services/rate-limit.service.ts
- address-module/backend/src/modules/performance/guards/redis-rate-limit.guard.ts
- address-module/backend/src/modules/performance/interceptors/cdn-cache.interceptor.ts
- address-module/backend/src/modules/performance/decorators/rate-limit.decorator.ts
- address-module/backend/src/modules/performance/decorators/cdn-cache.decorator.ts
- address-module/backend/src/modules/performance/controllers/performance-demo.controller.ts

## Runtime behavior

### Product cache

- Product detail key: `sipariskutusu:product:detail:<stable-json>`
- Product search key: `sipariskutusu:product:search:<stable-json>`
- Detail TTL default: 60s
- Search TTL default: 30s
- Mutations should call `invalidateProduct(productId)` to evict stale entries.
- Search invalidation is O(1) via namespace version bump (no Redis SCAN storm).
- Lock keys reduce cache stampede on hot misses.
- Missing/invalid product IDs are short-lived negative-cached to protect origin from repeated 404-style bursts.
- Stale shadow entries allow stale-if-error serving during temporary origin failures.
- Mutation endpoints can use interceptor-driven invalidation to avoid manual cache clear drift.

### Sessions

- Session key: `sipariskutusu:session:<stable-json>`
- User session set: `sipariskutusu:session:user:<stable-json>`
- Session TTL default: 14 days
- Supports create, read, touch, revoke one, revoke all per user.
- Session IP/User-Agent values are hashed by default for lower PII risk.
- Per-user max session cap can auto-evict oldest sessions.
- Session lifecycle metrics are exposed for capacity drift detection.

### Rate limiting

- Uses Redis sorted-set sliding window.
- Core decision is atomic via Redis Lua script.
- Emits headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- On block: returns HTTP 429 with `Retry-After`.
- Key identity preference: authenticated user ID, fallback to client IP.
- `RATE_LIMIT_FAIL_OPEN` can be enabled for availability-first posture.
- Default key scope includes route (`method:path`) to avoid cross-endpoint starvation.
- If Redis is unavailable and fail-open is disabled, an in-process emergency limiter is applied.
- Metrics endpoint: `GET /performance/metrics/rate-limit`.
- Unified observability endpoint: `GET /performance/metrics/overview`.
- Repeated offenders can be temporarily banned via Redis strike/ban keys.
- Ban rollout can be gradually enabled with identifier-based canary percentage.
- Release gate can enforce fallback and ban budgets before rollout.
- Integration is now extended to real `locations` routes with endpoint-specific profiles, not only demo routes.

### Operations and security baseline

- Bootstrap now enforces request IDs, strict security headers, body-size limits, CORS policy, and trusted proxy configuration.
- Dedicated ops endpoints expose liveness, readiness, security posture, runtime config, and a merged operational overview.

### Queueing

- A lightweight Redis queue path now exists for delayed jobs and backlog visibility, suitable for startup scale before introducing a separate broker.
- Scheduled jobs can be promoted in bounded batches to protect Redis and worker memory.

### CDN cache headers

- Emits `Cache-Control` and `CDN-Cache-Control`.
- Supports `s-maxage`, `stale-while-revalidate`, `stale-if-error`.
- Supports `Vary` customization.

## Cloudflare recommendation

- Enable Cache Rules for product read endpoints (`GET /products/:id`, `GET /products`).
- Respect origin cache headers.
- Skip cache for authenticated endpoints and all mutations.

Ready-to-adapt templates:

- `docs/cloudflare-cache-rules.example.json`
- `docs/performance-policy-matrix.md`

## Integration checklist

1. Import `PerformanceModule` into backend app module.
2. Add `@UseGuards(RedisRateLimitGuard)` to public endpoints.
3. Add `@RateLimit({ ... })` per endpoint profile.
4. Add `@CdnCache({ ... })` to cacheable read endpoints.
5. Wrap listing reads with `ProductCacheService.getOrSet...`.
6. Invalidate cache on create/update/delete listing.
7. Persist login sessions with `SessionStoreService`.
8. Rotate Redis credentials and enforce TLS in production.
9. Monitor `GET /performance/metrics/cache` hit-ratio and tune TTLs.
10. Run `npm run load:gate` in CI/CD and block release on SLO breach.
11. Run `npm run release:gate` before production rollout and archive the generated report JSON.
