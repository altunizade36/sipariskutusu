# Supabase + FCM Altyapi Rehberi

Bu proje icin onerilen altyapi parcasi ve gorevleri:

## 1) Supabase Auth

- Giris / kayit / sifre sifirlama / OTP / OAuth oturum yonetimi.
- Mobil tarafta kullanici oturumu `AuthContext` ile yonetilir.
- Yetkilendirme kontrolu: `auth.uid()` + RLS politikasi.

## 2) Supabase PostgreSQL

- Cekirdek veriler: ilanlar, yorumlar, favoriler, profiller, raporlar, goruntulenme ve bildirimler.
- Is kurallari DB fonksiyonlari ile zorunlu kilinir (security definer RPC).
- Ana tablolar: `listings`, `listing_comments`, `favorites`, `reports`, `notifications`, `user_push_tokens`.

## 3) Supabase Storage

- Gorsel ve medya saklama.
- Bucket bazli politika: `listing-images`, `avatars`, `store-banners`, `story-images`.
- RLS + storage policy ile dosya erisim guvenligi saglanir.

## 4) Supabase Edge Functions

- Guvenli sunucu tarafi islemler:
  - `send-push`: push dagitimi (Expo + FCM)
  - `dispatch-notification`: push/sms/email kanal yonetimi
  - `process-payment`: odeme akisi entegrasyon noktasi
- Service role ile DB yazimi yapilir; istemciye yalnizca sonuc donulur.

## 5) Supabase Realtime

- Bildirim, yorum, mesaj gibi tablolar icin anlik degisim dinleme.
- Mobil tarafta `channel(...).on('postgres_changes', ...)` ile abone olunur.
- UI sayaclari ve liste ekranlari event geldiginde yenilenir.

## 6) Firebase Cloud Messaging (FCM)

- Android cihazlara native push teslimati.
- Bu projede iki yol desteklenir:
  - Expo token (Expo Push Gateway)
  - Native FCM token (FCM HTTP endpoint)
- Tokenler `user_push_tokens` tablosunda `provider` bilgisi ile tutulur.

## Uctan Uca Akis

1. Kullanici uygulamaya girer, izin verir.
2. Cihaz Expo/FMC token uretir.
3. Token DB'ye RPC ile kayit edilir: `register_my_push_token`.
4. Is olayi olusur (yorum, moderasyon, rapor karari vb).
5. `notifications` tablosuna kayit atilir.
6. Realtime ile uygulama ekrani anlik guncellenir.
7. Gerekirse Edge Function ile push dagitimi yapilir.
8. Gecersiz tokenler pasiflenir.

## Guvenlik Checklist

- Tum tablolar RLS acik.
- RPC fonksiyonlari icin `revoke all from public/anon`, sadece `authenticated` grant.
- Edge function cagrilarinda Authorization zorunlu.
- Push token pasifleme logout ve hata durumlarinda zorunlu.

## Bu adimla gelen ekler

- `030_push_token_lifecycle_hardening.sql`
  - `register_my_push_token`
  - `unregister_my_push_token`
  - `unregister_all_my_push_tokens`
  - token yasam dongusu icin ek indeks/alanlar

## Security Audit Runbook (RLS + RPC + Storage)

Bu proje icin guvenlik sertlestirme migrationlari:

- `045_security_rls_storage_admin_hardening.sql`
  - admin RPC fonksiyonlarinda admin role dogrulamasi
  - profile alanlarinda privilege-escalation engeli
  - mesaj update/delete owner-only kisiti
  - storage access policy hardening
- `046_security_function_grants_and_policy_sweep.sql`
  - hassas fonksiyon grant sweep (anon/public kapatma)
  - legacy policy temizligi ve savunma-derinligi

Canli dogrulama sorgulari:

- `supabase/security_rls_audit_queries.sql`

Uygulama adimlari:

1. Supabase SQL Editor'da migrationlari sirali calistirin.
2. Ardindan `supabase/security_rls_audit_queries.sql` dosyasini calistirin.
3. Asagidaki kosullari dogrulayin:
   - public tablolarinda RLS kapali tablo kalmamis olmali.
   - admin RPC fonksiyonlarinda `anon` execute hakki olmamali.
   - storage `message-files`/`message-images` bucket politikalarinda katilimci + owner/path kontrolu olmali.
   - `profiles` update policy owner check + with_check ile sinirli olmali.

Beklenen sonuc:

- Audit scriptindeki "expected 0 rows" kontrolleri bos donmelidir.
