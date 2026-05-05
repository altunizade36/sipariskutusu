# Turkey Address Module (Production-Grade Blueprint)

## 1) Mimari Aciklama
- Bu model idari hiyerarsiyi (il > ilce > mahalle/koy > sokak/cadde > bina > daire) foreign key ile korur, boylece kargo/fatura/kurye akislari deterministic olur.
- `normalized_*` kolonlari hem typo toleransi hem de dilsel varyasyon (mah., sk., cd., turkce karakter) icin kullanilir.
- `pg_trgm` indexleri fuzzy aramayi hizlandirir; exact + trigram + full text birlikte hibrit arama saglar.
- Serbest metin + kademeli secim birlikte sunulur: UX hizli olur, kayit dogrulugu idari kodlarla korunur.
- `snapshot_json` eski kayitlari korur: idari isim degisse bile gecmis adres metni bozulmaz.

## 2) Klasor Yapisi
- `backend/src/modules/location/*`: NestJS module, entities, DTO, services, tests.
- `backend/src/database/migrations/*`: SQL migration dosyalari.
- `backend/src/database/seeds/*`: Ornek seederlar (81 il + secili ilceler).
- `frontend/src/components/address/*`: React address form bilesenleri.
- `frontend/src/hooks/*`: hierarchy + autocomplete hooklari.
- `frontend/src/api/locationApi.ts`: API client.
- `examples/payloads/*`: ornek request/response JSON.

## 3) Arama Stratejisi
- Minimum 3 karakterde arama tetiklenir.
- Once normalize edilir.
- Once local DB candidate pool kullanilir.
- Sonra trigram `%` operatoru ve `similarity` ile siralanir.
- Query timeout (`maxExecutionTime`) + limit korumasi vardir.
- Dilerseniz ikinci katman olarak Google/Mapbox/HERE fallback eklenir.

## 4) Guvenlik ve Validation
- DTO validation: `class-validator` + `ValidationPipe` whitelist.
- Query uzunluk limiti: `ADDRESS_QUERY_MAX_LENGTH`.
- Abuse prevention: API gateway veya Nest throttler ile rate limit.
- SQL injection: QueryBuilder parameter binding.
- Audit: `address_search_logs`, `imported_location_sources`.

## 5) Is Kurallari
- Ayni mahalle adi farkli ilcelerde olabilir (`district_id + normalized_name + type`).
- Ayni sokak adi farkli mahallelerde olabilir (`neighborhood_id + normalized_name + type`).
- Il bulunmadan ilce kesinlenmez; dusuk confidence otomatik kaydedilmez.
- Kismi eslesmeler `alternatives` listesi olarak doner.
- Son kayitta FK + metinsel snapshot birlikte saklanir.

## 6) Calistirma Notlari
- Bu modul bu repoda referans implementasyon olarak `address-module/` altindadir.
- Ayrik NestJS servisine alinabilir veya monorepo backend paketine tasinabilir.
- Mevcut Expo derlemesini bozmamasi icin kok `tsconfig.json` icinde `address-module` exclude edilmistir.

## 7) Harita/Geocoding Yol Haritasi
- Harita ekleme: PostGIS + map tile + pin reverse geocode.
- Google/Mapbox/HERE: autocomplete sonuclarini gecici aday olarak gostermek, kalici kayit oncesi local hiyerarsiye resolve etmek.
- Resmi veri importu: MAKS/AKS dosyasi CSV/JSON geldiginde `import:locations` komutuyla batch import.
- Lojistik genisleme: teslimat zonelari, SLA pencereleri, servislenebilirlik kurallari (polygon + district bazli).
