# Sistem Kurulumunda Gorev Paylasimi

Amac: Sistemi canliya hazir hale getirmek, eksik/hata/cakisma riskini dusurmek.

## Copilot (ben) ne yapacagim

1. Kod duzeltmeleri
- Uygulama, script, migration ve edge function duzeltmelerini yazip entegre edecegim.

2. Otomatik dogrulama
- Tum kritik akislari tek komutta kontrol edecegim.
- Komut: npm run system:ready

3. Sorun siniflandirma
- Fail olanlari kod kaynakli ve altyapi kaynakli olarak ayiracagim.
- Ozellikle email rate-limit gibi dis blokajlari acik raporlayacagim.

4. Guvenli degisiklik akisi
- Minimum gerekli degisikligi yapacagim.
- Cakisma olusturabilecek yerlerde net diff ve etkileri belirtecegim.

## Sen (urun sahibi) ne yapacaksin

1. Supabase panel ayarlari
- Authentication > Email: SMTP saglayicisini bagla.
- Authentication > Rate Limits: signup/reset email limitlerini uygun seviyeye cikar.
- URL Configuration: Site URL ve redirect URL degerlerini dogrula.

2. Gizli anahtarlar ve servis bilgileri
- .env degerlerini kesinlestir.
- SMS/Email provider anahtarlarini (kullaniyorsan) Supabase secrets tarafinda dogrula.

3. Onay ve kararlar
- Uretim davranislari: timeout, retry, blokajta fallback kurali gibi urun kararlarini ver.

4. Son kabul testi
- Benim verdigim son checklist ile staging/production smoke kosularini sen de calistir.

## Birlikte calisma dongusu

1. Ben kodlarim ve test ederim.
2. Sana kisa rapor gecerim: PASS / BLOCKED / FAIL.
3. Sen panel/secret tarafini uygularsin.
4. Ben tekrar kosup final raporu veririm.

## Hedef durum

- Kod kaynakli fail = 0
- Bilinen dis blokajlar = 0 (veya net dokumante)
- Tek komutla readiness ozeti alinabiliyor: npm run system:ready
