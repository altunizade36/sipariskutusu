# Gercek Kullanici Testi - Yurutme Raporu (2026-04-29)

## Kapsam
- Hedef: 10-20 gercek kullanici ile UAT
- Senaryolar: kayit, ilan ekleme, mesaj, yorum, favori, sorun bildirimi

## Bu asamada tamamlananlar
- UAT plani hazirlandi: docs/real-user-test-plan.md
- Geri bildirim log dosyasi hazirlandi: docs/real-user-feedback-log.csv
- Bug giris formu hazirlandi: docs/real-user-bug-template.md
- UAT ozet scripti eklendi: scripts/uat-summary.mjs

## Teknik taban durumu (UAT oncesi)
- `npm run smoke:auth`: PASS
- `npm run smoke:chat`: PASS
- `npm run smoke:reactions`: Ilk calistirmada timeout fail, sistem readiness icinde PASS
- `npm run system:ready`: PASS (6/6)

## E-posta hata notu (cozuldu)
- Koken neden: Smoke scriptlerinde `@smoke.dev` kullanimi (MX/NXDOMAIN nedeniyle bounce).
- Cozum: Varsayilan test domaini MX kayitli domain fallback'i ile degistirildi.
- Standart:
	- `SMOKE_TEST_EMAIL_DOMAIN=mailinator.com`
	- `SMOKE_ENABLE_EMAIL_FLOWS=false` (default)
- E-posta akisi test etmek istenirse kontrollu calistirma:
	- `SMOKE_ENABLE_EMAIL_FLOWS=true node scripts/full-flow-smoke.mjs`

## UAT uygulama adimlari (ekip icin)
1. 10-20 testeri role gore dagit (alici/satici/karma).
2. Her testere tekil tester_id ver (or: T01..T20).
3. Test sirasinda her aksiyon icin `docs/real-user-feedback-log.csv` satiri ekle.
4. Hata olursa `docs/real-user-bug-template.md` ile detay kaydet.
5. Test bitince ozet al:
- `npm run uat:summary`

## Gecis kriteri
- P0/P1 bug = 0
- Kayit, ilan, mesaj, yorum, favori basari oranlari >= %95

## Not
- Bu ortamdan gercek insan kullanicilarla birebir test oturumu baslatamam.
- Ancak testin ayni gun uygulanmasi icin gerekli tum operasyon dosyalari ve otomatik ozetleme altyapisi hazirlandi.
