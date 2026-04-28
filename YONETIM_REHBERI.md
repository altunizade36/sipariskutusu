# SiparişKutusu — Altyapı Kurulum & Yönetim Rehberi

<!-- markdownlint-disable MD031 MD034 MD040 -->

## NE KURDUK, NE İŞE YARAR

| Servis             | Ücretsiz Limit                               | Ne İşe Yarar                                                    |
| ------------------ | -------------------------------------------- | --------------------------------------------------------------- |
| **Supabase**       | 500 MB DB, 1 GB depolama, 50K auth kullanıcı | Veritabanı + Kullanıcı girişi + Dosya depolama + Anlık mesajlar |
| **Sentry**         | 5.000 hata/ay                                | Uygulamada çöküş olunca size e-posta gelir                      |
| **PostHog**        | 1 Milyon olay/ay                             | Kaç kişi hangi ekrana baktı, ne aradı                           |
| **GitHub**         | Ücretsiz (özel repo)                         | Kodun yedeklenmesi, sürüm geçmişi                               |

---

## HIZLI OTOMATIK KURULUM (SANA SADECE KEY GIRME KALIYOR)

1. `.env` dosyasını oluştur:
   ```bash
   cp .env.example .env
   ```
2. Sadece API key/secret alanlarını doldur.
3. Kontrol çalıştır:
   ```bash
   npm run infra:check
   ```
4. Otomatik altyapı kur:
   ```bash
   npm run infra:auto -- --project-ref YOUR_PROJECT_REF
   ```

Bu komut `supabase link`, `supabase secrets set` ve Edge Function deploy adımlarını otomatik yapar.

---

## ADIM 1 — SUPABASE KURULUMU (15 dakika)

### 1.1 Proje Oluştur

1. https://supabase.com → **New project**
2. İsim: `sipariskutusu`, şifre güçlü bir şey seçin, bölge: **Frankfurt (eu-central-1)**
3. Proje oluştuktan sonra **Settings → API** sayfasına gidin
4. `Project URL` ve `anon public` key'i kopyalayın

### 1.2 .env Dosyasını Oluşturun

```bash
cp .env.example .env
```

`.env` dosyasını açın ve Supabase değerlerini yapıştırın:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

### 1.3 Veritabanı Şemasını Uygulayın

1. Supabase → **SQL Editor**
2. `supabase/migrations/001_schema.sql` dosyasının içeriğini yapıştırın → **Run**
3. `supabase/migrations/002_functions.sql` dosyasının içeriğini yapıştırın → **Run**

### 1.4 E-posta Doğrulamasını Ayarlayın

1. Supabase → **Authentication → Email Templates**
2. "Confirm signup" şablonunu Türkçe'ye çevirin
3. **Authentication → URL Configuration** → Site URL: `expotemplate://`

### 1.5 Kimlik Doğrulama Sağlayıcıları (isteğe bağlı)

- **Google**: Authentication → Providers → Google → Client ID ve Secret girin
- **Apple**: Authentication → Providers → Apple → App ID girin

---

## ADIM 2 — SENTRY KURULUMU (5 dakika)

1. https://sentry.io → **Create account** (ücretsiz)
2. **New Project** → **React Native** → İsim: `sipariskutusu`
3. DSN URL'yi kopyalayın
4. `.env` dosyasına yapıştırın:
   ```
   EXPO_PUBLIC_SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz
   ```

**Nasıl yönetirsiniz?**

- Sentry.io → Issues → Çökme olduğunda e-posta alırsınız
- "Resolved" diyerek kapatırsınız
- Kaç kullanıcı etkilendi görürsünüz

---

## ADIM 3 — POSTHOG KURULUMU (5 dakika)

1. https://posthog.com → **Get started free**
2. **Project API Key**'i kopyalayın
3. `.env` dosyasına yapıştırın:
   ```
   EXPO_PUBLIC_POSTHOG_API_KEY=phc_xxxx
   ```

**Nasıl yönetirsiniz?**

- PostHog → **Dashboards** → Günlük/haftalık kullanıcı sayısı
- **Events** → Hangi ilan oluşturuldu, hangi arama yapıldı
- **Funnels** → Kaç kişi ilan oluşturma ekranına girdi, kaçı tamamladı

---

## ADIM 4 — RESEND E-POSTA (5 dakika)

Bu sade kurulumda özel işlem e-postaları kaldırıldı. Sistem yalnız Supabase Auth'in kendi e-posta doğrulama ve şifre sıfırlama akışını kullanır.

---

## ADIM 5 — GITHUB SÜRÜM KONTROLÜ (10 dakika)

GitHub şart değil ama **kesinlikle tavsiye edilir**. Kodunuz silinirse yedeği olur.

```bash
# Git başlat
git init
git add .
git commit -m "İlk commit"

# GitHub'da yeni repo oluşturun (github.com → New repository)
git remote add origin https://github.com/KULLANICI/sipariskutusu.git
git push -u origin main
```

**Önemli**: `.env` dosyasını asla GitHub'a atmayın. `.gitignore` dosyasında `.env` yazıyor olmalı.

---

## UYGULAMAYI YAYINLAMAK

### Expo EAS ile yayınlama

```bash
npm install -g eas-cli
eas login
eas build:configure

# Android APK/AAB oluştur
eas build --platform android --profile production

# iOS IPA oluştur (Mac ve Apple Developer hesabı gerekir)
eas build --platform ios --profile production
```

**EAS Build ücretsiz plan**: Ayda 30 build hakkı var.

---

## GÜNLÜK YÖNETİM — HER GÜN NEREYE BAKILIR

### Sabah kontrolü (5 dakika)

1. **Sentry** → Issues listesi — Gece çökme olmuş mu?
2. **Supabase** → Dashboard → Database boyutu büyüyor mu?

### Haftalık (15 dakika)

1. **PostHog** → Bu hafta kaç yeni kullanıcı geldi?
2. **PostHog** → En çok hangi kategori arandı?
3. **Supabase** → Auth → Son kayıt olan kullanıcılar

### Aylık

1. **Resend** → Bu ay kaç e-posta gönderildi? Sınıra yaklaşıyor mu?
2. **Supabase** → Storage kullanımı → Sınıra yaklaşıyorsa ücretli plana geç

---

## SUPABASE YÖNETİM PANELİNDE NE YAPILIR

### Kullanıcıları yönetmek

- Supabase → **Authentication → Users**
- Kullanıcı silme, e-posta değiştirme buradan yapılır
- "Ban" butonu ile hesabı askıya alabilirsiniz

### Verileri düzenlemek

- Supabase → **Table Editor**
- İlanları, siparişleri, kullanıcıları tabloda görebilir ve düzenleyebilirsiniz

### SQL sorgusu çalıştırmak

- Supabase → **SQL Editor**
- Örnek: Tüm aktif ilanları listele:
  ```sql
  SELECT title, price, city, created_at FROM listings WHERE status = 'active' ORDER BY created_at DESC LIMIT 50;
  ```
- Örnek: Belirli bir kullanıcının ilanlarını sil:
  ```sql
  UPDATE listings SET status = 'deleted' WHERE seller_id = 'KULLANICI_ID';
  ```

### Storage'ı yönetmek

- Supabase → **Storage**
- Yüklenen görselleri görebilir, silebilirsiniz
- Buckets: `listing-images`, `avatars`, `store-banners`, `story-images`

---

## ÖDEME SİSTEMİ (ileride — iyzico)

Şu an kurulmadı. Hazır olduğunuzda:

1. https://iyzico.com → Üye İşyeri Başvurusu yapın
2. Test API Key alın → entegrasyon geliştirin
3. Canlıya geçmeden iyzico onayı gerekir (vergi levhası, imzalı sözleşme)

**Not**: Kullanıcılar birbirine para gönderecekse (P2P) ödeme aracılığı lisansı gerekebilir. Hukuki danışmanlık alın.

---

## ÜCRETSİZ LİMİTLER AŞILIRSA

| Servis   | Limit Aşılırsa                 | Maliyet                      |
| -------- | ------------------------------ | ---------------------------- |
| Supabase | +500 MB DB veya +50K kullanıcı | $25/ay Pro plan              |
| Sentry   | +5000 hata/ay                  | $26/ay Team plan             |
| PostHog  | +1M olay/ay                    | $0 (soft limit, uyarı gelir) |
| Resend   | +3000 e-posta/ay               | $20/ay (50K e-posta)         |

---

## YEDEKLEME

Supabase **otomatik günlük yedek** alır (Pro plan'da 7 gün, Free'de manuel).

Manuel yedek almak için:

- Supabase → **Project Settings → Database → Backups → Download**

---

## SSS

**Supabase'de bir şeyi yanlışlıkla sildim?**
→ SQL Editor'da `SELECT * FROM tablo_adi LIMIT 100;` ile kontrol edin. Supabase'in soft-delete kullandığınız tablolarda silinmiş kayıtlar `status='deleted'` olarak durur.

**Uygulama çalışıyor ama Supabase bağlanamıyor?**
→ `.env` dosyasındaki URL ve KEY'i kontrol edin. `EXPO_PUBLIC_` prefix'i olmalı.

**Yeni bir ekran ekledim, TypeScript hata veriyor?**
→ `npx expo start` yapın, `.expo/types/router.d.ts` otomatik güncellenir.

**PostHog veri göstermiyor?**
→ Geliştirme ortamında bazı olaylar gecikebilir. Production build'de test edin.
