# Canliya Cikis Dry-Run Checklist

Bu listeyi release oncesi birebir doldurun. Her satir isaretlenmeden production deploy yapmayin.

## 1) Ortam ve Sirlar (ENV)

- [ ] Production `.env` dosyasinda tum zorunlu degiskenler tanimli.
- [ ] `EXPO_PUBLIC_SUPABASE_URL` dogru proje URL'si.
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY` production anahtari.
- [ ] Sentry/PostHog anahtarlari production ortamina uygun.
- [ ] Debug/test anahtarlari production paketinde yok.

## 2) Veritabani ve Migration

- [ ] Migration'lar production'da sira ile calistirildi: `001 -> 002 -> 003 -> 004 -> 005 -> 006`.
- [ ] `story_likes` tablosu var.
- [ ] `story_comments` tablosu var.
- [ ] `orders` ve `order_items` tablolari mevcut ve erisilebilir.
- [ ] Ilgili index'ler olustu (migration loglari kontrol edildi).
- [ ] RLS policy'leri aktif ve beklenen rol/senaryolari geciyor.

## 3) Kimlik Dogrulama (Auth)

- [ ] E-posta/sifre ile giris basarili.
- [ ] Kayit -> giris -> cikis dongusu hatasiz.
- [ ] OAuth callback production URL'ye donuyor.
- [ ] Demo/fallback kimliklerle production endpoint'e yazma olmuyor.
- [ ] Yetkisiz kullanici korumali ekranlarda dogru yonlendiriliyor.

## 4) Realtime ve Senkronizasyon

- [ ] Hikaye begeni/yorum backend'e yazilip tekrar okunuyor.
- [ ] Follow/unfollow backend tarafinda tutarli.
- [ ] Mesajlasma akisi (story -> message) UUID seller senaryosunda backend'e dusuyor.
- [ ] Listing guncelle/sil aksiyonlari remote state ile tutarli.
- [ ] Realtime acikken duplicate event veya ghost update yok.

## 5) Android Back / Navigation

- [ ] Alt tablarda hardware back davranisi tek tip: root tabda geri -> anasayfa, anasayfada geri -> sistem davranisi.
- [ ] Sepet tabindan geri donuste hesabim yerine anasayfaya donuyor.
- [ ] Deep link ile acilan ekranlardan geri akisi beklenen stack'e donuyor.
- [ ] `router.replace` kullanilan geri noktalari UX'e uygun.

## 6) Smoke Test (Uctan Uca)

- [ ] Uye ol/giris yap -> urun kesfet -> favoriye ekle -> sepet -> siparis tamamla.
- [ ] Satici: ilan olustur -> duzenle -> yayinla -> sil.
- [ ] Story: paylas -> 24 saat gorunur -> arsive duser (sadece sahibi gorur).
- [ ] Story yorum/begeni iki farkli hesapla capraz test edildi.
- [ ] Follow ve store gecis akislarinda state kaybi yok.
- [ ] `npm run smoke:notifications` basarili (dispatch + delivery log).
- [ ] Email login kapaliysa smoke komutu JWT ile calisti: `npm run smoke:notifications -- --access-token <JWT>`.

## 7) Gozlemleme ve Hata Takibi

- [ ] Sentry'de release/version etiketi dogru.
- [ ] Kritik akislarda hata loglari geliyor (orders, stories, auth).
- [ ] Beklenmeyen error spike veya warning spike yok.
- [ ] `notification_deliveries` tablosunda son smoke request kayitlari gorunuyor.

## 8) Release Karari

- [ ] Tum checklist maddeleri tamamlandi.
- [ ] Son `npm run typecheck` temiz.
- [ ] Son smoke test sonucu dokumante edildi.
- [ ] Release onayi verildi (sorumlu kisi + tarih kaydi).

---

## Dry-Run Notlari

- Tarih:
- Build numarasi:
- Test eden:
- Tespit edilen issue'lar:
- Aksiyonlar / owner:
