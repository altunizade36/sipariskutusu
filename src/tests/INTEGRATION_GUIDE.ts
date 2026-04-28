/**
 * LISTING MEDIA INTEGRATION GUIDE
 * Görsel yükleme: Geliştiriciler için pratik rehber
 * 
 * Bu dosya, stress test sonuçlarını kod pratiğine dönüştürür.
 * Her senaryo için gerçek implementasyon örnekleri ve best practices.
 */

/**
 * SENARYO 1: Yüksek Çözünürlük Fotoğraf İşleme
 * ═════════════════════════════════════════════════════════════════════════
 * 
 * İşlenecek: 8 tane 8MB+ yüksek çözünürlük fotoğraf
 * Hedef: <3MB sıkıştırılmış, WebP format
 * Zaman: <5 saniye (2 eşzamanlı işlem)
 */

// ✓ DOĞRU KULLANIM (Pseudo-code - src/services/listingService.ts'de implemente edilmiş)
export const correctHighResHandlingExample = `
async function createListing(input: CreateListingInput): Promise<Listing> {
  // 1. Validasyon
  const mediaUris = input.mediaUris ?? [...input.imageUris, ...(input.videoUri ? [input.videoUri] : [])];
  
  if (mediaUris.length === 0) {
    throw new Error('En az bir fotoğraf gerekli.');
  }
  if (mediaUris.length > MAX_LISTING_MEDIA_COUNT) {
    throw new Error('Maksimum 8 fotoğraf yükleyebilirsiniz.');
  }

  // 2. Sıkıştırma (concurrency=2 ile) - ImageManipulator kullan
  const imageRows = await mapWithConcurrency(
    mediaUris.map((uri, i) => ({ uri, index: i })),
    IMAGE_UPLOAD_CONCURRENCY, // = 2
    async ({ uri, index }) => {
      // compressListingImage() WebP @ 85% quality, JPEG fallback
      const compressed = await compressListingImage(uri, MAX_IMAGE_BYTES);
      // ✓ uploadListingImage() sıkıştırılmış URI ile
      const uploaded = await uploadListingImage(seller_id, listing_id, compressed.uri, index);
      return { 
        listing_id, 
        url: uploaded.url, 
        storage_path: uploaded.path, 
        sort_order: index, 
        is_cover: index === 0 // ✓ İlk item her zaman kapak
      };
    }
  );

  // 3. DB'ye kaydet
  await supabase.from('listing_images').insert(imageRows);
  return listing;
}
`;

// ✗ HATA KULLANIM
export const incorrectHighResHandlingExample = `
async function createListing(input: CreateListingInput) {
  // BU YAPMA: Sıkıştırma olmadan direkt yükleme
  // - Yavaş (8MB * 8 = 64MB!)
  // - Timeout riski yüksek (20s) → ÇÖKÜŞ
  // - Kullanıcı deneyimi kötü (dakikalar sürüyor)
  const mediaUris = [...input.imageUris, ...(input.videoUri ? [input.videoUri] : [])];
  
  const imageRows = await Promise.all(
    mediaUris.map((uri, index) => {
      // ❌ HATA: Sıkıştırma atlandı!
      // ❌ HATA: uploadListingImage() orijinal 8MB ile çağrılıyor!
      return uploadListingImage(seller_id, listing_id, uri, index);
    })
  );
}
`;

/**
 * SENARYO 2: Video-First Hata Yönetimi
 * ═════════════════════════════════════════════════════════════════════════
 * 
 * Kural: İlk medya HER ZAMAN görsel (fotoğraf) olmalı, video OLAMAZ
 */

export function isVideoUri(uri: string): boolean {
  const lowerUri = uri.toLocaleLowerCase();
  return /\.(mp4|mov|m4v)(\?|$)/i.test(lowerUri);
}

// ✓ DOĞRU KULLANIM
export const correctMediaOrdering = (imageUris: string[], videoUri?: string) => {
  // 1. Medyaları sıra ile birleştir: görseller ÖNCE, sonra video
  const mediaUris = [
    ...imageUris, // Görseller önce
    ...(videoUri ? [videoUri] : []), // Video son
  ];

  // 2. İlk medya kontrol et
  if (mediaUris.length === 0) {
    throw new Error('En az bir medya gerekli.');
  }

  if (isVideoUri(mediaUris[0])) {
    throw new Error('Kapak fotoğrafı zorunlu. İlk medya bir fotoğraf olmalı.');
  }

  return mediaUris;
};

// ✗ HATA KULLANIM
export const incorrectMediaOrdering = (mediaUris: string[]) => {
  // BU YAPMA: Video'yu ilk sıraya koyma
  const badOrder = [
    'file:///video.mp4', // ❌ Video ilk! ÇÖKÜŞ!
    'file:///photo.jpg',
    'file:///photo2.jpg',
  ];

  // BU YAPMA: sort_order manuel atama (DB trigger yapacak)
  const imageRows = badOrder.map((uri, index) => ({
    url: uri,
    sort_order: index,
    is_cover: index === 0, // ❌ Video'ya is_cover=true! HATA!
  }));
};

/**
 * SENARYO 3: Kapak Fotoğrafı Bozulması Tespiti
 * ═════════════════════════════════════════════════════════════════════════
 * 
 * Bozulma senaryoları:
 * - Birden fazla is_cover=true (hatalı update)
 * - Hiç is_cover=true yok (silme sonrası)
 * - İlk sırada is_cover=false (yeniden sıralama başarısız)
 */

// ✓ DOĞRU BOZULMA TESPİTİ
export const detectCoverCorruption = (
  mediaRows: Array<{ sort_order: number; is_cover: boolean }>
): { corrupted: boolean; issue: string } => {
  const coverCount = mediaRows.filter((m) => m.is_cover).length;
  const firstIsCover = mediaRows[0]?.is_cover ?? false;

  // Bozulma kontrolü
  if (coverCount === 0) {
    return { corrupted: true, issue: 'No cover photo found' };
  }
  if (coverCount > 1) {
    return { corrupted: true, issue: 'Multiple covers found' };
  }
  if (!firstIsCover) {
    return { corrupted: true, issue: 'First item is not cover' };
  }

  return { corrupted: false, issue: '' };
};

// ✓ DOĞRU BOZULMA DÜZELTME (DB trigger siler ama güvenlik için validasyon)
export const validateCoverIntegrity = async (listingId: string, supabase: any) => {
  const { data: images, error } = await supabase
    .from('listing_images')
    .select('id, sort_order, is_cover')
    .eq('listing_id', listingId)
    .order('sort_order');

  if (error) throw error;

  const corruption = detectCoverCorruption(images);
  if (corruption.corrupted) {
    // Trigger olacak ama manual validasyon güvenlik katı ekler
    console.warn(`[WARNING] Cover corruption detected: ${corruption.issue}`);

    // Trigger çalışıncaya kadar, client-side fix'i geri koy
    // (gerçek durumda trigger zaten düzelmiş olacak)
    const corrected = images.map((img, idx) => ({
      ...img,
      is_cover: idx === 0,
    }));

    return { valid: false, corrected };
  }

  return { valid: true, data: images };
};

/**
 * SENARYO 4: Medya Silme & Temizlik
 * ═════════════════════════════════════════════════════════════════════════
 * 
 * Senaryo: 5 medya içinden 3'ünü sil → DB güncellemeleri + storage temizliği
 */

// ✓ DOĞRU MEDYA SİLME PROTOKOLÜ (Pseudo-code - gerçek: updateListing fonksiyonunda)
export const correctMediaDeletionExample = `
async function updateListing(id: string, updates: Partial<CreateListingInput>) {
  const nextMediaUris = [...]; // Yeni medya listesi (küçültülmüş)
  
  // 1. Var olan medyaları bul
  const existingMedia = await supabase
    .from('listing_images')
    .select('url, storage_path')
    .eq('listing_id', id);

  // 2. DB'den SİL: eski medyaları kaldır
  await supabase.from('listing_images').delete().eq('listing_id', id);

  // 3. YENİ MEDYALARI EKLE: sıkıştırma + yeniden yükle
  const imageRows = await mapWithConcurrency(
    nextMediaUris.map((uri, index) => ({ uri, index })),
    IMAGE_UPLOAD_CONCURRENCY,
    async ({ uri, index }) => {
      const isRemoteUrl = /^https?:\/\//i.test(uri);
      if (isRemoteUrl) {
        return { listing_id: id, url: uri, sort_order: index, is_cover: index === 0 };
      }
      const uploaded = await uploadListingImage(seller_id, id, uri, index);
      return { listing_id: id, url: uploaded.url, sort_order: index, is_cover: index === 0 };
    }
  );

  await supabase.from('listing_images').insert(imageRows);

  // 4. STORAGE TEMIZLIK: silinenleri kaldır (yeni listede olmayan)
  const keptUrlSet = new Set(imageRows.map((row) => row.url));
  const removablePaths = existingMedia
    .filter((item) => !keptUrlSet.has(item.url))
    .map((item) => item.storage_path)
    .filter(Boolean);

  if (removablePaths.length > 0) {
    await supabase.storage.from('listing-images').remove(removablePaths);
  }
}
`;

// ✗ HATA MEDYA SİLME
export const incorrectMediaDeletion = async (listingId: string, supabase: any) => {
  // BU YAPMA: Storage temizliği olmadan sil
  await supabase
    .from('listing_images')
    .delete()
    .eq('listing_id', listingId);
  // ❌ Orphaned files kaldı! Storage dolu oluyor!

  // BU YAPMA: sort_order'ı manuel yeniden hesapla
  // (trigger yapacak, çift işlem = bozulma riski)
};

/**
 * SENARYO 5: Performans Doğrulaması
 * ═════════════════════════════════════════════════════════════════════════
 * 
 * Hedef: 5 görsel yükleme < 20 saniye
 * Bölüm: Sıkıştırma ~1s + Upload ~12s + Buffer ~7s
 */

// ✓ DOĞRU PERFORMANS MONİTÖRÜ (Pseudo-code örneği)
export const monitorUploadPerformanceExample = `
async function createListing(input: CreateListingInput): Promise<Listing> {
  const UPLOAD_TIMEOUT_MS = 20000;
  const startTime = Date.now();

  try {
    // 1. Medya validasyon
    const mediaUris = input.mediaUris ?? [...];
    
    // 2. Sıkıştırma başla
    const compressionStart = Date.now();
    const imageRows = await mapWithConcurrency(
      mediaUris.map((uri, i) => ({ uri, index: i })),
      IMAGE_UPLOAD_CONCURRENCY, // 2
      async ({ uri, index }) => {
        // compressListingImage() otomatik olarak WebP/JPEG seçer
        const compressed = await compressListingImage(uri, MAX_IMAGE_BYTES);
        const uploaded = await uploadListingImage(seller_id, listing_id, compressed.uri, index);
        return {
          listing_id,
          url: uploaded.url,
          storage_path: uploaded.path,
          sort_order: index,
          is_cover: index === 0,
        };
      }
    );
    const compressionTime = Date.now() - compressionStart;
    console.log(\`[PERF] Compression: \${compressionTime}ms for \${mediaUris.length} images\`);

    // 3. Total kontrol
    const totalTime = Date.now() - startTime;
    console.log(\`[PERF] Total: \${totalTime}ms (timeout: \${UPLOAD_TIMEOUT_MS}ms)\`);

    if (totalTime > UPLOAD_TIMEOUT_MS) {
      console.warn(\`[WARN] Upload exceeded timeout: \${totalTime}ms > \${UPLOAD_TIMEOUT_MS}ms\`);
    }

    return { success: true, totalTime, withinTimeout: totalTime <= UPLOAD_TIMEOUT_MS };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(\`[ERROR] Upload failed after \${elapsed}ms\`, error);
    throw error;
  }
}
`;

// ✓ DOĞRU TIMEOUT YÖNETIMI (fetchWithTimeout implementasyonu listingService.ts'de)
export const correctTimeoutHandlingExample = `
async function fetchWithTimeout(
  resource: string,
  options: RequestInit = {},
  timeoutMs = IMAGE_UPLOAD_TIMEOUT_MS
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId); // ✓ Cleanup!
  }
}
`;

/**
 * SENARYO 6: Hata Kurtarma
 * ═════════════════════════════════════════════════════════════════════════
 * 
 * Senaryo 6a: Kısmi upload başarısızlığı
 * Senaryo 6b: Network timeout ve retry
 * Senaryo 6c: Sıkıştırma başarısızlığı
 */

// ✓ DOĞRU KISMEN BAŞARILI UPLOAD GERI ALMA (createListing'de implementasyon)
export const correctPartialUploadRollbackExample = `
async function createListing(input: CreateListingInput): Promise<Listing> {
  const uploadedPaths: string[] = [];

  try {
    // ... upload logic ...
    const imageRows = await mapWithConcurrency(/* ... */);
    await supabase.from('listing_images').insert(imageRows);
  } catch (error) {
    // ✓ Upload başarısız → geri alma başla
    if (uploadedPaths.length > 0) {
      console.log(\`[ROLLBACK] Upload failed, cleaning up \${uploadedPaths.length} files...\`);
      
      // 1. Listing sil (cascade: listing_images otomatik silinir)
      await supabase.from('listings').delete().eq('id', listing.id).catch(() => undefined);
      
      // 2. Storage dosyaları sil
      if (USE_EXTERNAL_MEDIA_STORAGE && isBackendApiConfigured) {
        await backendRequest('/v1/media/delete-objects', {
          method: 'POST',
          body: { objectKeys: uploadedPaths },
          idempotencyKey: \`listing-media-cleanup:\${listing.id}\`,
        }).catch(() => undefined);
      } else {
        await supabase.storage.from('listing-images').remove(uploadedPaths);
      }
      
      console.log('[ROLLBACK] Cleanup complete');
    }
    throw error; // Original error'u yeniden fırla
  }

  return listing;
}
`;

// ✓ DOĞRU RETRY LOJİĞİ (uploadListingImage'de implementasyon)
export const correctRetryLogicExample = `
async function uploadListingImage(sellerId: string, listingId: string, uri: string, index: number) {
  const retryableStatuses = [408, 429, 500, 502, 503]; // Timeout, Rate limit, Server errors
  const maxRetries = 2;
  let lastUploadStatus = 0;
  let uploadCompleted = false;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      const uploadResponse = await fetchWithTimeout(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: arrayBuffer,
      }, IMAGE_UPLOAD_TIMEOUT_MS);

      if (uploadResponse.ok) {
        uploadCompleted = true;
        break; // ✓ Success
      }

      lastUploadStatus = uploadResponse.status;
      
      // Retry-able status? (timeout, rate limit, 5xx errors)
      const isRetryable = retryableStatuses.includes(uploadResponse.status);
      if (!isRetryable || attempt === maxRetries - 1) {
        break; // Stop retrying
      }
      
      // Exponential backoff: wait 1s, 2s, etc.
      const waitTime = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }
    }
  }

  if (!uploadCompleted) {
    throw new Error(\`Harici medya yukleme basarisiz (\${lastUploadStatus || 'timeout'}).\`);
  }

  return { url: presign.publicUrl, path: presign.objectKey };
}
`;

/**
 * SCENARIO 7: Veritabanı Kısıtlamaları Doğrulaması
 * ═════════════════════════════════════════════════════════════════════════
 */

// ✓ DOĞRU DB UYUMLULUĞU KONTROLÜ
export const validateDatabaseConstraintsExample = `
async function validateListingMediaIntegrity(listingId: string, supabase: any) {
  const { data: images, error } = await supabase
    .from('listing_images')
    .select('id, listing_id, url, sort_order, is_cover')
    .eq('listing_id', listingId)
    .order('sort_order');

  if (error) throw error;

  const checks = {
    hasUrl: images.every((img: any) => img.url), // ✓ URL NOT NULL
    validSortOrder: images.every((img: any, idx: number) => img.sort_order === idx), // ✓ 0,1,2...
    oneCover: images.filter((img: any) => img.is_cover).length === 1, // ✓ Exactly 1 cover
    coverIsFirst: images[0]?.is_cover === true, // ✓ First is cover
  };

  const allValid = Object.values(checks).every((v) => v);

  return {
    valid: allValid,
    checks,
    images: allValid ? images : null,
  };
}
`;

/**
 * TESTLERİ ÇALIŞTIĞINI DOĞRULAMA
 * ═════════════════════════════════════════════════════════════════════════
 * 
 * npm test -- src/tests/listing-media-stress.test.ts
 * 
 * ✓ Tüm 31 test geçmeli
 * ✓ Sıkıştırma oranları doğru
 * ✓ Timeout kontrolleri çalışıyor
 * ✓ Rollback protokolü geçerli
 * ✓ Database kısıtlamaları uygulanıyor
 */

export const INTEGRATION_CHECKLIST = [
  '✓ Use compressListingImage() BEFORE uploadListingImage()',
  '✓ Validate: 1 <= mediaCount <= 8',
  '✓ Enforce: first media must be image (not video)',
  '✓ Use mapWithConcurrency(items, 2, ...) for 2x throughput',
  '✓ Catch upload failures and rollback listing + storage',
  '✓ Set timeout to 20000ms (20 seconds)',
  '✓ Implement exponential backoff retry (max 2 times)',
  '✓ Validate cover integrity after deletions',
  '✓ Monitor performance: target <15s end-to-end',
  '✓ Log errors: compressionTime, uploadTime, totalTime',
  '✓ Run stress tests before production: npm test',
];
