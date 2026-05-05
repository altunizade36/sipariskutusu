# Backend Setup (Supabase + Auth)

## 1) Supabase project oluştur

1. [https://supabase.com](https://supabase.com) üzerinde yeni proje aç.
2. `Project Settings > API` bölümünden şu değerleri al:
   - `Project URL`
   - `anon public key`
   - `service_role key`
3. `project-ref` bilgisini de not et (ör: `abcd1234efgh5678`).

## 2) Sadece keyleri doldur

1. `.env.example` dosyasını `.env` olarak kopyala.
2. Sadece key ve URL alanlarını doldur.

Ek olarak local SQL araclari icin PostgreSQL baglanti satiri:

```bash
postgresql://postgres:[YOUR-PASSWORD]@db.jvcncrdwikbvvehkimet.supabase.co:5432/postgres
```

## 2.1) Supabase CLI hizli kurulum

Asagidaki komutlari proje kokunde sirayla calistir:

```bash
supabase login
supabase init
supabase link --project-ref jvcncrdwikbvvehkimet
```

## 3) Tek komutla otomatik altyapı

Önce kontrol:

```bash
npm run infra:check
```

Sonra otomatik secret yükleme + function deploy:

```bash
npm run infra:auto -- --project-ref YOUR_PROJECT_REF
```

Bu komut:

- `.env` alanlarını kontrol eder
- Supabase projesine link olur
- `supabase secrets` değerlerini yükler
- `send-push`, `dispatch-notification` ve `process-payment` fonksiyonlarını deploy eder

## 4) SQL migration (1 kez manuel)

Supabase `SQL Editor` uzerinden sirayla calistir:

1. `supabase/migrations/001_schema.sql`
2. `supabase/migrations/002_functions.sql`
3. `supabase/migrations/003_social_payment.sql`
4. `supabase/migrations/004_payment_methods.sql`
5. `supabase/migrations/005_push_notifications.sql`
6. `supabase/migrations/006_story_engagement.sql`
7. `supabase/migrations/007_instagram_handle.sql`
8. `supabase/migrations/008_store_terms_acceptance.sql`
9. `supabase/migrations/009_messaging_backend_alignment.sql`
10. `supabase/migrations/013_data_storage_hardening.sql`
11. `supabase/migrations/014_notification_channel_hardening.sql`

Not: `0001_marketplace_core.sql` eski dosyadir, kullanma.

Canli oncesi kontrol:

- `story_likes` ve `story_comments` tablolarinin olustugunu dogrula.
- `increment_unread`, `increment_store_followers`, `decrement_store_followers`, `increment_story_view_count` fonksiyonlarinin aktif oldugunu dogrula.

Mesajlasma odakli backend smoke-check SQL:

```sql
-- Required messaging columns
select column_name
from information_schema.columns
where table_schema = 'public'
   and table_name = 'conversations'
   and column_name in ('type','store_id','buyer_unread','seller_unread','buyer_unread_count','seller_unread_count');

select column_name
from information_schema.columns
where table_schema = 'public'
   and table_name = 'messages'
   and column_name in ('receiver_id','message_type','image_url','offer_amount','offer_status','status','seen_at');

-- Required RPC functions
select routine_name
from information_schema.routines
where specific_schema = 'public'
   and routine_name in ('get_or_create_conversation','mark_conversation_seen','increment_unread');

-- Required uniqueness constraints via indexes
select indexname
from pg_indexes
where schemaname = 'public'
   and indexname in ('conversations_unique_listing_pair','conversations_unique_store_pair');
```

## 5) Auth provider ayarları

`Supabase > Authentication > Providers` bölümünde ihtiyacına göre aç:

- Email

Redirect URI:

- `sipariskutusu://oauth-callback`
- `sipariskutusu://reset-password`
- `sipariskutusu://**`

## 6) Uygulamayı çalıştır

```bash
npm run start
```

## Notlar

- Ödeme (iyzico) bu aşamada bilinçli olarak kurulu değil.
- SMS ve sosyal giriş bu sade kurulumdan çıkarıldı; çekirdek akış yalnız e-posta doğrulama üzerindedir.

## 7) API Layer (REST + GraphQL)

Mobil uygulama artik dogrudan veritabani yerine once API katmanini kullanacak sekilde hazirlandi.

Ek ortam degiskenleri:

- `EXPO_PUBLIC_BACKEND_API_URL` (or: `https://api.sipariskutusu.com`)
- `EXPO_PUBLIC_BACKEND_STRICT_MODE=true|false`

Davranis:

- `EXPO_PUBLIC_BACKEND_API_URL` doluysa uygulama once backend REST endpointlerini dener.
- `EXPO_PUBLIC_BACKEND_STRICT_MODE=true` ise backend hatasinda Supabase fallback kapatilir (onerilen production).
- Strict mode kapaliysa gecici gecis sureci icin fallback devam eder.

Beklenen REST endpointleri (Node.js Express/NestJS, Spring Boot, .NET Core fark etmeksizin):

Auth:

- `POST /v1/auth/login`
- `POST /v1/auth/signup`
- `POST /v1/auth/otp/email/send`
- `POST /v1/auth/otp/email/verify`
- `POST /v1/auth/otp/phone/send`
- `POST /v1/auth/otp/phone/verify`
- `POST /v1/auth/password/reset`
- `POST /v1/auth/password/update`
- `POST /v1/auth/logout`
- `GET /v1/auth/me`

Is kurallari:

- Login/OTP verify cevabinda `accessToken` + `refreshToken` donulmeli.
- `GET /v1/auth/me` cevabi dogrulanmis kullanici profilini donmelidir.
- Signup cevabi eger e-posta dogrulama bekliyorsa token donmeyebilir.
- Tum mutasyon endpointlerinde bruteforce/rate-limit uygulanmali.

- `POST /v1/orders`
- `GET /v1/orders/me`
- `GET /v1/orders/sales`
- `PATCH /v1/orders/:id/status`
- `POST /v1/payments/process`
- `GET /v1/listings`
- `GET /v1/listings/:id`
- `GET /v1/listings/me`
- `PATCH /v1/listings/:id`
- `DELETE /v1/listings/:id`

Medya depolama (S3/GCS gibi external provider):

- `POST /v1/media/presign-upload`
- `POST /v1/media/delete-objects`
- `POST /v1/notifications/dispatch`

Ortam degiskeni:

- `EXPO_PUBLIC_MEDIA_STORAGE_MODE=supabase|external`
- `EXPO_PUBLIC_IMAGE_UPLOAD_TIMEOUT_MS` (default: `20000`)
- `EXPO_PUBLIC_MAX_IMAGE_BYTES` (default: `8388608`, yaklasik 8 MB)
- `EXPO_PUBLIC_IMAGE_UPLOAD_CONCURRENCY` (default: `2`)
- `EXPO_PUBLIC_NOTIFICATION_DISPATCH_TIMEOUT_MS` (default: `10000`)

Kurallar:

- `external` modda mobil istemci once `presign-upload` alir, sonra URL'e `PUT` ile binary yukler.
- Presign cevabinda en az `uploadUrl` ve `publicUrl` alanlari donulmelidir.
- Backend object key donduruyorsa `objectKey` ile rollback/temizlik endpointi calistirilir.
- `delete-objects` endpointi idempotent olmalidir (olmayan key silme isteginde hata vermemeli).
- Yuksek trafik senaryosunda istemci tarafi eszamanli upload sayisini dusuk tut (2-3) ve backend tarafinda da rate-limit + queue uygula.

Bildirim kanallari (push + sms + email):

- `POST /v1/notifications/dispatch` endpointi `channels: ['push'|'sms'|'email']` alacak sekilde tasarlanmalidir.
- Tum mutasyonlarda `X-Idempotency-Key` zorunlu olmalidir.
- Basarili cevapta kanal bazli sonuc metrikleri donulmelidir (`queued`, `delivered`, `failed`).

Provider secretleri:

- `FCM_SERVER_KEY` (FCM push)
- `SMS_API_URL`, `SMS_API_KEY`, `SMS_SENDER_ID` (SMS provider)
- `SENDGRID_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` (email)

Guclendirme onerisi:

- Push token gecersiz donerse (`NotRegistered`, `DeviceNotRegistered`) tokeni pasife cek.
- SMS/Email kanallarinda provider timeout/retry/backoff uygula; 4xx hata tiplerini retry etme.
- Yuksek hacimde bildirimleri kuyrukla (batch worker + dead-letter queue) ve `notification_deliveries` tablosuna yaz.

JWT yetkilendirme:

- Mobil taraf `Authorization: Bearer <token>` header gonderir.
- Backend tarafinda rol/claim kontrolu zorunlu olmalidir (`buyer`, `seller`, `admin` gibi).
- `orders/:id/status` sadece siparisin saticisi veya admin tarafindan guncellenebilmelidir.
- `orders/me` sadece token sahibi alicinin siparislerini donmelidir.
- `orders/sales` sadece token sahibi saticinin satislarini donmelidir.
- `payments/process` icin tutar, para birimi, siparis sahipligi ve idempotency kontrolu zorunludur.
- `listings/:id` mutate endpointleri yalnizca ilan sahibi veya admin tarafindan cagrilabilmelidir.

Retry ve idempotency:

- Mobil istemci retry yapabilir (ozellikle 429/5xx/timeouts).
- Mutasyonlarda `X-Idempotency-Key` header degerini kullanip duplicate islemleri engelle.
- `X-Client-Request-Id` ile loglarda request zincirini izlenebilir yap.

GraphQL kullanmak istersen:

- Endpoint: `POST /graphql`
- Mobil katmanda `backendGraphQL()` yardimcisi hazirdir.

## 8) Data Storage sertlestirme notlari

SQL (PostgreSQL):

- `013_data_storage_hardening.sql` ile siparis/kalem/listing tutarlilik check constraintleri eklenir.
- Siparis ve favori sorgulari icin ek indeksler performans ve stabiliteyi artirir.

NoSQL (mobil cache/session):

- Mobil tarafta TTL destekli cache zarfi kullanilir.
- Bozuk cache kayitlari otomatik temizlenir.
- `auth/me` cevabi kisa sureli cache ile backend gecici kesintilerinde crash/fail riskini azaltir.

Redis resilience (milyonlarca trafik icin):

- `REDIS_CONNECT_TIMEOUT_MS`
- `REDIS_COMMAND_TIMEOUT_MS`
- `REDIS_DEGRADED_COOLDOWN_MS`
- `REDIS_MAX_RETRIES_PER_REQUEST`
- `RATE_LIMIT_SCOPE_BY_ROUTE=true`
- `RATE_LIMIT_FAIL_OPEN=false` (strict abuse block) veya `true` (availability-first)

Release gate (onerilen):

- `cd address-module/backend`
- `npm run release:gate -- --base-url http://localhost:4100`
- Sonuc raporu: `address-module/backend/reports/performance-release-gate-report.json`

## 9) Cache ve Performans (Redis + CDN + Session + Rate Limit)

Kritik hiz ve dayaniklilik akislarinda su backend modulu kullanilabilir:

- `address-module/backend/src/modules/performance`

Saglanan kapsama:

- Redis urun cache (detay + arama)
- Redis session store (multi-instance uyumlu)
- Redis tabanli distributed rate limiting
- CDN (Cloudflare vb.) uyumlu cache-control interceptor

Kurulum ozeti:

1. `address-module/backend/.env.example` dosyasini `.env` olarak kopyalayin.
2. Redis URL ve TTL degerlerini ortama gore ayarlayin.
3. Backend app module icine `PerformanceModule` import edin.
4. Product read endpointlerinde `@CdnCache(...)` + `@UseGuards(RedisRateLimitGuard)` kullanin.
5. Listeleme servisinde `ProductCacheService` ile read-through cache uygulayin.
6. Listing mutasyonlari sonrasinda `invalidateProduct(productId)` cagirarak stale cache temizleyin.

Detayli teknik blueprint:

- `docs/cache-performance-blueprint.md`
