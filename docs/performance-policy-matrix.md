# Performance Policy Matrix

## Product endpoints

| Endpoint | Redis Cache | CDN Cache | Rate Limit |
|---|---|---|---|
| `GET /v1/products/:id` | 60s | `max-age=10, s-maxage=120, swr=60, sie=600` | 180 req/min per user/ip |
| `GET /v1/products` | 30s | `max-age=5, s-maxage=60, swr=30, sie=300` | 120 req/min per user/ip |
| `POST/PATCH/DELETE /v1/products/*` | invalidate product + search namespace bump | bypass | 60 req/min per user |

## Session endpoints

| Endpoint | Redis Session | CDN | Rate Limit |
|---|---|---|---|
| `POST /v1/auth/login` | create session (14d TTL) | bypass | 20 req/min per ip |
| `POST /v1/auth/refresh` | touch session TTL | bypass | 120 req/min per user |
| `POST /v1/auth/logout` | revoke session | bypass | 60 req/min per user |
| `POST /v1/auth/logout-all` | revoke all user sessions | bypass | 10 req/min per user |

## Global notes

- Use Redis TLS and password in production.
- Keep `CDN-Cache-Control` aligned with `Cache-Control`.
- Never cache authenticated payloads at edge.
- Always bump product search cache namespace after product mutations.
