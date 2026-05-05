# Backend Performance Module

This package provides production-ready Redis and CDN primitives for speed-critical flows.

## Includes

- Product cache (single product + search pages)
- Session store (Redis-backed)
- Rate limiting guard (Redis sliding-window)
- CDN cache-control interceptor (Cloudflare-compatible headers)
- Bootstrap security hardening (request IDs, strict headers, body limits, CORS, trust proxy)
- Ops endpoints (liveness, readiness, runtime config, security posture)
- Lightweight Redis-backed queue primitives for delayed job promotion and backlog metrics

## Install

1. Copy `.env.example` to `.env`.
2. Install dependencies:

```bash
npm install
```

Compile only the performance module blueprint:

```bash
npm run build:performance
```

Run quick load benchmark:

```bash
npm run load:performance -- --url http://localhost:4100/performance/products/1 --concurrency 50 --requests 2000
```

Run SLO gate (fails on threshold breach):

```bash
npm run load:gate -- --url http://localhost:4100/performance/products/1 --concurrency 50 --requests 2000 --max-p95 250 --max-p99 600 --min-success-rate 0.995
```

Run full release gate (build + load gate + metrics snapshot):

```bash
npm run release:gate -- --base-url http://localhost:4100
```

Report artifact is written to:

- `reports/performance-release-gate-report.json`

## Redis use-cases implemented

- Product cache: reduce repeated DB reads for hot listings
- Session storage: central session state for multi-instance deployments
- Rate limiting: distributed abuse protection across all API pods

## CDN use-cases implemented

- Public product endpoints emit `Cache-Control` and `CDN-Cache-Control`
- Supports `s-maxage`, `stale-while-revalidate`, `stale-if-error`
- Cloudflare can cache at edge while origin remains consistent

## Suggested integration

- Import `PerformanceModule` into your app module.
- Protect public APIs with `RedisRateLimitGuard`.
- Add `@CdnCache(...)` to product list/detail endpoints.
- Use `ProductCacheService` in listing service read paths.
- Use `SessionStoreService` in auth/session lifecycle.

## Hardening details included

- Cache stampede protection with Redis lock keys.
- O(1) product search cache invalidation via namespace versioning.
- Precise Redis Lua sliding-window rate limiting.
- CDN headers emitted only for GET endpoints with explicit `@CdnCache` metadata.
- Redis degraded-state tracking with timeout-guarded operations.
- Emergency local limiter fallback when Redis is unavailable.

## Recommended production env flags

- `CACHE_LOCK_TTL_SECONDS=5`
- `PERFORMANCE_METRIC_TTL_SECONDS=604800`
- `RATE_LIMIT_FAIL_OPEN=false` (true only if you prefer availability over strict abuse blocking during Redis outages)
- `STORE_RAW_SESSION_METADATA=false`
- `RATE_LIMIT_SCOPE_BY_ROUTE=true`
- `REDIS_DEGRADED_COOLDOWN_MS=15000`
- `REDIS_COMMAND_TIMEOUT_MS=1200`
- `PRODUCT_NEGATIVE_CACHE_TTL_SECONDS=10`
- `SLO_MAX_P95_MS=250`
- `SLO_MAX_P99_MS=600`
- `SLO_MIN_SUCCESS_RATE=0.995`
- `REQUIRE_REDIS_HEALTH=true`

## Observability endpoints

- `GET /ops/live`
- `GET /ops/ready`
- `GET /ops/security`
- `GET /ops/config`
- `GET /ops/overview`
- `GET /ops/queues/:queue/stats`
- `GET /performance/health/redis`
- `GET /performance/metrics/cache`
- `GET /performance/metrics/rate-limit`
- `GET /performance/metrics/overview`
- `GET /performance/metrics/sessions`

## Scale hardening highlights

- Per-user session cap with oldest-session eviction (`MAX_SESSIONS_PER_USER`).
- Product stale-if-error fallback shadow cache (`PRODUCT_STALE_FALLBACK_TTL_SECONDS`).
- Release gate policy checks for cache/rate-limit error metrics.
- Temporary abuse bans after repeated rate-limit strikes (`RATE_LIMIT_BAN_THRESHOLD`, `RATE_LIMIT_BAN_SECONDS`).
- Bounded emergency limiter map memory (`LOCAL_EMERGENCY_LIMIT_MAP_MAX`).
- Canary rollout for abuse bans (`RATE_LIMIT_BAN_CANARY_PERCENT`) to reduce release risk.
- Mutation-time automatic product cache invalidation via `ProductCacheInvalidationInterceptor` + `@InvalidateProductCache`.
- Release gate now supports fallback/ban/session budget checks (`RELEASE_MAX_RATE_LIMIT_FALLBACK_EMERGENCY`, `RELEASE_MAX_BAN_BLOCKED_METRIC`, `RELEASE_MAX_SESSION_EVICTED_METRIC`).
- Real location endpoints (`/locations/*`) now use Redis distributed rate-limit profiles and CDN cache headers on read routes.
- Location route rate limits are environment-driven with `LOCATION_RATE_LIMIT_*` variables for runtime tuning.
- Redis queue primitives add a startup-friendly background job path without introducing a separate broker on day one.
