# Gercek Kullanici Test Plani (10-20 Kisi)

Bu plan, canliya cikis oncesi gercek kullanici davranisini yakalamak icin hazirlandi.
Hedef: Kayit, ilan, mesaj, yorum, favori ve genel UX sorunlarini dogrudan sahadan toplamak.

## 1. Hedef Grup ve Dagitim

- Toplam katilimci: 10-20 kisi
- Dagitim onerisi:
- 6-8 kisi: Alici odakli (kesfet, favori, yorum, mesaj)
- 4-6 kisi: Satici odakli (kayit, ilan ekleme, mesajlara donus)
- 2-4 kisi: Karma profil (hem alici hem satici akis)

## 2. Test Ortami

- Build: Son test build (Android agirlkli, varsa iOS)
- Ortam: Staging veya canliya yakin pre-prod
- Zorunlu: Her katilimciya ayri hesap (ortak hesap yok)
- Zorunlu: Test baslangic ve bitis saatleri kayit altina alinacak

## 3. Zorunlu Senaryolar (Tum katilimcilar)

1. Kayit olsunlar
- Uygulama ac -> Kayit ol
- E-posta/sifre veya mevcut auth akisiyla hesap olustur
- Cikis yapip tekrar giris yap

2. Ilan eklesinler (satici veya karma roller)
- En az 1 ilan olustur
- Baslik, aciklama, fiyat, kategori, sehir doldur
- En az 1 gorsel ekle ve yayinla

3. Mesaj atsinlar
- Bir ilan uzerinden saticiya mesaj gonder
- Karsilikli en az 2 mesajlasma turu yap

4. Yorum yapsinlar
- Bir ilana yorum birak
- Yorum gorunurlugu ve guncelleme gecikmesini not et

5. Favoriye alsinlar
- En az 3 ilan favoriye eklensin
- Favoriden cikar ve tekrar ekle (toggle test)

6. Sorunlari yazsinlar
- Her katilimci en az 3 gozlem girsin:
- 1 adet hata
- 1 adet performans gozlemi
- 1 adet UX onerisi

## 4. Basari Kriterleri

- Kayit/giris basari orani >= %95
- Ilan yayinlama basari orani >= %90
- Mesajlasma basari orani >= %95
- Yorum/favori islemleri basari orani >= %95
- Kritik (P0/P1) acik bug sayisi = 0 (release oncesi)

## 5. Oturum Akisi (45-60 dk)

1. 0-10 dk: Kayit ve giris
2. 10-25 dk: Ilan ekleme veya kesfet
3. 25-40 dk: Mesaj + yorum + favori
4. 40-60 dk: Sorun girisi ve serbest kullanim

## 6. Toplanacak Metrikler

- Senaryo bazli basari/hatali deneme sayisi
- Ortalama tamamlanma suresi (dk)
- Ekran donma/cokme sayisi
- Kullanici memnuniyeti (1-5)
- Acik yorumlar

## 7. Cikti Dosyalari

- Geri bildirim tablosu: docs/real-user-feedback-log.csv
- Bug raporu sablonu: docs/real-user-bug-template.md

## 8. Test Sonu Karar Kapisi

- P0/P1 bug varsa: release bloklanir
- P2 bug > 5 ise: ikinci tur kisa test planlanir
- Kritik akislarda basari %95 altindaysa: iyilestirme turu zorunlu
