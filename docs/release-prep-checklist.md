# Yayina Hazirlik Kontrol Listesi

Bu belge, mobil yayina cikmadan once zorunlu kalemleri tek yerden takip etmek icin hazirlandi.

## 1) Logo / Splash ekrani
- Durum: Hazir
- Konfig:
  - `assets/images/icon.png`
  - `assets/images/adaptive-icon.png`
  - `assets/images/splash-icon.png`
  - `assets/images/favicon.png`
- Kontrol:
  - `app.json` icinde icon, adaptive icon ve splash tanimli.
  - Splash arka plan rengi `#ffffff`.

## 2) Uygulama adi
- Durum: Guncellendi
- Deger:
  - Expo ad: `Siparis Kutusu`
  - Slug: `sipariskutusu`
  - Android package: `com.sipariskutusu.app`
  - iOS bundle id: `com.sipariskutusu.app`

## 3) KVKK / Kullanici sozlesmesi
- Durum: Hazir
- Uygulama ici ekran:
  - `/legal/[doc]`
- Dokumanlar:
  - Kullanim Sartlari
  - KVKK metni
  - Sorumluluk reddi
  - Yasakli urun listesi

## 4) Gizlilik politikasi
- Durum: Hazir
- Uygulama ici: `privacy-kvkk` dokumani
- Not:
  - Gizlilik ve KVKK talepleri icin iletisim e-postasi tanimlandi.

## 5) Iletisim e-postasi
- Durum: Hazir
- E-posta: `iletisim@sipariskutusu.com`
- Uygulama ici:
  - Hesabim > Destek > Iletisim E-postasi (mailto)
  - KVKK metni icinde iletisim bolumu

## 6) Play Store aciklamasi
- Durum: Hazir
- Dosya:
  - `docs/play-store-aciklama.md`

## 7) Ekran goruntuleri
- Durum: Cekim plani hazir
- Dosya:
  - `docs/play-store-ekran-goruntuleri.md`

## 8) Test hesabi
- Durum: Hazir
- Dosya:
  - `docs/test-hesaplari.md`

## Yayin Oncesi Son Kontroller
- Production API ve Supabase degiskenlerini dogrula.
- Push notification anahtarlarini dogrula.
- Admin panelde ilan onay/reddet, yorum gizle, kullanici yasakla akislarini smoke et.
- En az 1 alici + 1 satici + 1 admin senaryosu ile dry-run yap.
