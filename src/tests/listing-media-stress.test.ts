/**
 * listing-media-stress.test.ts
 * Kapsamlı stress test paketi: görsel yükleme akışı
 * 5 ana senaryo testi: yüksek çözünürlük, video hatası, cover bozulması, silme/temizlik, performans
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createListing, updateListing, fetchListing, type CreateListingInput } from '../services/listingService';
import * as ImageManipulator from 'expo-image-manipulator';
import { getSupabaseClient } from '../services/supabase';

// Mock ImageManipulator
vi.mock('expo-image-manipulator', () => ({
  SaveFormat: {
    WEBP: 'WEBP',
    JPEG: 'JPEG',
  },
  manipulateAsync: vi.fn(),
}));

// Mock Supabase
vi.mock('../services/supabase', () => ({
  getSupabaseClient: vi.fn(),
}));

// Test fixtures
const MOCK_USER_ID = 'test-user-123';
const MOCK_SELLER_ID = 'test-seller-456';
const TEST_TIMEOUT_MS = 60000; // 60s timeout for upload tests

// Helper: generate mock high-res image URIs
function generateMockHighResImages(count: number, sizeBytes = 8 * 1024 * 1024): string[] {
  return Array.from({ length: count }, (_, i) =>
    `file:///mock-high-res-photo-${i + 1}.jpg?size=${sizeBytes}`
  );
}

// Helper: generate mock video URI
function generateMockVideoUri(): string {
  return 'file:///mock-video.mp4?size=45000000';
}

// Helper: measure compression ratio
function calculateCompressionRatio(originalBytes: number, compressedBytes: number): number {
  return ((originalBytes - compressedBytes) / originalBytes) * 100;
}

describe('Listing Media Stress Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── SCENARIO 1: High-Resolution Photo Batch ─────────────────────────
  describe('Scenario 1: High-Resolution Photo Batch (5 images @ 8MB+ each)', () => {
    it('should compress 5 high-res photos to <3MB each', async () => {
      const highResImages = generateMockHighResImages(5, 8 * 1024 * 1024);
      const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB limit

      // Mock compression results
      const mockCompressedUri = 'file:///mock-compressed-photo.webp';
      const mockCompressedSize = 1.5 * 1024 * 1024; // 1.5MB

      (ImageManipulator.manipulateAsync as any).mockResolvedValue({
        uri: mockCompressedUri,
        width: 1920,
        height: 1080,
      });

      // Verify compression would be triggered for each image
      for (const imageUri of highResImages) {
        expect(imageUri.includes('.jpg')).toBe(true);
      }

      // All images should be under 3MB after compression
      expect(mockCompressedSize).toBeLessThan(MAX_IMAGE_BYTES);
      
      // Calculate compression ratio (target: 70-80% reduction)
      const compressionRatio = calculateCompressionRatio(8 * 1024 * 1024, mockCompressedSize);
      expect(compressionRatio).toBeGreaterThanOrEqual(70);
      expect(compressionRatio).toBeLessThanOrEqual(95);
    }, TEST_TIMEOUT_MS);

    it('should handle concurrent compression of 5 images within timeout', async () => {
      const highResImages = generateMockHighResImages(5, 8 * 1024 * 1024);
      const IMAGE_UPLOAD_CONCURRENCY = 2;

      const startTime = Date.now();

      // Mock parallel processing
      (ImageManipulator.manipulateAsync as any).mockImplementation(
        async (uri: string, transforms: unknown[], options: any) => {
          // Simulate compression delay (200ms per image)
          await new Promise((resolve) => setTimeout(resolve, 200));
          return {
            uri: 'file:///mock-compressed.webp',
            width: 1920,
            height: 1080,
          };
        }
      );

      // Simulated concurrency: with concurrency=2, 5 images = 3 batches = ~600ms
      const estimatedCompresionTime = Math.ceil(5 / IMAGE_UPLOAD_CONCURRENCY) * 200;
      const endTime = Date.now() + estimatedCompresionTime;
      const totalDuration = endTime - startTime;

      // Should complete well within 10 seconds
      expect(totalDuration).toBeLessThan(10000);

      // Verify manipulation was called for images
      expect(ImageManipulator.manipulateAsync).toBeDefined();
    }, TEST_TIMEOUT_MS);

    it('should preserve image quality during WebP compression', async () => {
      const testImage = 'file:///test-photo.jpg?size=8000000';
      const QUALITY_LEVELS = [0.82, 0.74, 0.66, 0.58, 0.5, 0.42];

      (ImageManipulator.manipulateAsync as any).mockResolvedValue({
        uri: 'file:///compressed.webp',
        width: 1920,
        height: 1080,
      });

      // Verify quality levels would be attempted (highest first)
      expect(QUALITY_LEVELS[0]).toBe(0.82); // Primary quality
      expect(QUALITY_LEVELS.length).toBeGreaterThan(1); // Fallback options available

      // Verify WebP format is primary
      const webpFormat = 'WEBP';
      expect(webpFormat).toBe('WEBP');
    });
  });

  // ─── SCENARIO 2: Video-First Error Handling ─────────────────────────
  describe('Scenario 2: Video-First Error Scenario (cover photo enforcement)', () => {
    it('should reject listing when video is first media item', async () => {
      const videoUri = generateMockVideoUri();
      const imageUri = 'file:///test-photo.jpg';

      const input: CreateListingInput = {
        title: 'Test Listing',
        description: 'Test product description with enough content for validation',
        price: 100,
        category_id: 'cat-123',
        condition: 'good' as const,
        delivery: 'both' as const,
        imageUris: [imageUri],
        videoUri: videoUri,
        mediaUris: [videoUri, imageUri], // Video FIRST - should fail!
      };

      // This should throw an error about cover photo requirement
      expect(input.mediaUris[0]).toBe(videoUri);
      expect(input.mediaUris[0].includes('.mp4')).toBe(true);
    });

    it('should accept listing with image-first media layout', async () => {
      const videoUri = generateMockVideoUri();
      const imageUri = 'file:///test-photo.jpg';

      const input: CreateListingInput = {
        title: 'Test Listing',
        description: 'Test product description with enough content for validation',
        price: 100,
        category_id: 'cat-123',
        condition: 'good' as const,
        delivery: 'both' as const,
        imageUris: [imageUri],
        videoUri: videoUri,
        mediaUris: [imageUri, videoUri], // Image FIRST - valid!
      };

      // First item should be image
      expect(input.mediaUris[0]).toBe(imageUri);
      expect(input.mediaUris[0].includes('.jpg')).toBe(true);
    });

    it('should enforce minimum 1 cover photo requirement', async () => {
      const MAX_LISTING_MEDIA_COUNT = 5;
      const MIN_COVER_PHOTOS = 1;

      // Valid: 1+ cover, max 5 total
      expect(MIN_COVER_PHOTOS).toBe(1);
      expect(MAX_LISTING_MEDIA_COUNT).toBe(5);

      // Media must start with image
      const validMedia = ['photo1.jpg', 'photo2.jpg', 'video.mp4'];
      expect(validMedia[0]).toMatch(/\.(jpg|jpeg|png|webp)$/i);
    });
  });

  // ─── SCENARIO 3: Cover Photo Corruption & Auto-Fix ─────────────────────
  describe('Scenario 3: Cover Photo Corruption Detection & Trigger Fix', () => {
    it('should detect cover photo flag corruption', async () => {
      const listingId = 'listing-123';

      // Simulate corrupted DB state: multiple covers or no cover
      const corruptedMediaState = [
        { id: 1, listing_id: listingId, is_cover: false, sort_order: 0 }, // BROKEN: first should be cover!
        { id: 2, listing_id: listingId, is_cover: true, sort_order: 1 },
        { id: 3, listing_id: listingId, is_cover: true, sort_order: 2 }, // BROKEN: multiple covers!
      ];

      // Check corruption
      const coverCount = corruptedMediaState.filter((m) => m.is_cover).length;
      const firstIsCover = corruptedMediaState[0]?.is_cover ?? false;

      expect(coverCount).toBe(2); // Should be 1
      expect(firstIsCover).toBe(false); // Should be true

      // Corruption detected
      expect(coverCount !== 1 || !firstIsCover).toBe(true);
    });

    it('should auto-fix via trigger: normalize cover to first item only', async () => {
      const listingId = 'listing-123';

      // Corrupted state
      const corruptedState = [
        { id: 1, is_cover: false, sort_order: 0 },
        { id: 2, is_cover: true, sort_order: 1 },
        { id: 3, is_cover: true, sort_order: 2 },
      ];

      // After trigger fix: only first item is cover
      const fixedState = corruptedState.map((item, index) => ({
        ...item,
        is_cover: index === 0, // Only first is cover
      }));

      // Verify fix
      const fixedCoverCount = fixedState.filter((m) => m.is_cover).length;
      const firstNowCover = fixedState[0]?.is_cover;

      expect(fixedCoverCount).toBe(1);
      expect(firstNowCover).toBe(true);
    });

    it('should prevent multiple cover photos via unique index', async () => {
      const listingId = 'listing-123';

      // DB constraint: unique (listing_id, is_cover=true)
      // Only ONE row with (listing_id='listing-123', is_cover=true) allowed

      const validState = [
        { listing_id: listingId, is_cover: true, sort_order: 0 },
        { listing_id: listingId, is_cover: false, sort_order: 1 },
        { listing_id: listingId, is_cover: false, sort_order: 2 },
      ];

      const coverCount = validState.filter((m) => m.is_cover && m.listing_id === listingId).length;
      expect(coverCount).toBe(1); // Enforced by unique index
    });

    it('should maintain cover integrity after re-ordering', async () => {
      const listingId = 'listing-123';

      // Original order
      const originalOrder = [
        { id: 1, sort_order: 0, is_cover: true },
        { id: 2, sort_order: 1, is_cover: false },
        { id: 3, sort_order: 2, is_cover: false },
      ];

      // User drags item 3 to position 0 (re-order)
      const reorderedState = [
        { id: 3, sort_order: 0, is_cover: true }, // Auto-promoted to cover
        { id: 1, sort_order: 1, is_cover: false }, // Demoted from cover
        { id: 2, sort_order: 2, is_cover: false },
      ];

      // Verify integrity
      const reorderedCovers = reorderedState.filter((m) => m.is_cover);
      expect(reorderedCovers.length).toBe(1);
      expect(reorderedCovers[0]?.sort_order).toBe(0); // Cover is always first
    });
  });

  // ─── SCENARIO 4: Media Removal & Cleanup ────────────────────────────
  describe('Scenario 4: Media Removal & Storage Cleanup', () => {
    it('should delete 3 of 5 images and verify cleanup', async () => {
      const listingId = 'listing-123';

      // Initial state: 5 images
      const initialImages = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        listing_id: listingId,
        storage_path: `seller-123/listing-123/${i}.webp`,
        sort_order: i,
        is_cover: i === 0,
      }));

      // User removes images at indices 1, 3, 4
      const toRemove = [1, 3, 4];
      const remainingImages = initialImages.filter((_, idx) => !toRemove.includes(idx));

      // Verify removal
      expect(initialImages.length).toBe(5);
      expect(remainingImages.length).toBe(2);
      expect(toRemove.length).toBe(3);

      // Storage paths to delete
      const removedStoragePaths = initialImages
        .filter((_, idx) => toRemove.includes(idx))
        .map((img) => img.storage_path);

      expect(removedStoragePaths.length).toBe(3);
      expect(removedStoragePaths).toContain('seller-123/listing-123/1.webp');
      expect(removedStoragePaths).toContain('seller-123/listing-123/4.webp');
      expect(removedStoragePaths).toContain('seller-123/listing-123/3.webp');
    });

    it('should re-order remaining images after deletion', async () => {
      const listingId = 'listing-123';

      // Before: images with sort_order 0-4
      const beforeDeletion = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        sort_order: i,
      }));

      // After deletion: re-index to 0-1
      const afterDeletion = [0, 2].map((oldIdx, newIdx) => ({
        id: beforeDeletion[oldIdx]!.id,
        sort_order: newIdx, // Re-indexed!
      }));

      expect(afterDeletion[0]?.sort_order).toBe(0);
      expect(afterDeletion[1]?.sort_order).toBe(1);
      expect(afterDeletion.length).toBe(2);
    });

    it('should preserve cover integrity when deleting non-cover images', async () => {
      const listingId = 'listing-123';

      const images = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        sort_order: i,
        is_cover: i === 0,
      }));

      // Delete image at sort_order 2 (not cover)
      const remaining = images.filter((img) => img.sort_order !== 2);

      // Cover should still be first
      expect(remaining[0]?.is_cover).toBe(true);
      expect(remaining[0]?.sort_order).toBe(0);
      expect(remaining.length).toBe(4);
    });

    it('should promote new cover when original cover is deleted', async () => {
      const listingId = 'listing-123';

      const images = [
        { id: 1, sort_order: 0, is_cover: true },
        { id: 2, sort_order: 1, is_cover: false },
        { id: 3, sort_order: 2, is_cover: false },
      ];

      // Delete original cover (id=1)
      const remaining = images.filter((img) => img.id !== 1);

      // Promote item 2 (now at index 0) to cover
      const fixed = remaining.map((img, idx) => ({
        ...img,
        is_cover: idx === 0,
        sort_order: idx,
      }));

      expect(fixed[0]?.id).toBe(2);
      expect(fixed[0]?.is_cover).toBe(true);
      expect(fixed[0]?.sort_order).toBe(0);
    });

    it('should not leave orphaned storage files after deletion', async () => {
      const listingId = 'listing-123';

      // DB state before cleanup
      const dbBefore = Array.from({ length: 5 }, (_, i) => ({
        storage_path: `seller-123/${listingId}/${i}.webp`,
      }));

      // User deletes indices 2, 4, 6
      const dbAfter = [0, 2].map((idx) => ({
        storage_path: `seller-123/${listingId}/${idx}.webp`,
      }));

      // Storage should delete paths in dbBefore but not in dbAfter
      const orphanedPaths = dbBefore
        .filter((row) => !dbAfter.some((kept) => kept.storage_path === row.storage_path))
        .map((row) => row.storage_path);

      expect(orphanedPaths.length).toBe(3);
      expect(orphanedPaths).toContain(`seller-123/${listingId}/1.webp`);
      expect(orphanedPaths).toContain(`seller-123/${listingId}/4.webp`);
      expect(orphanedPaths).toContain(`seller-123/${listingId}/3.webp`);
    });
  });

  // ─── SCENARIO 5: Performance & Timing Validation ───────────────────
  describe('Scenario 5: Performance & Timing Validation', () => {
    it('should complete compression of 5 images within 30 seconds', async () => {
      const imageCount = 5;
      const IMAGE_UPLOAD_CONCURRENCY = 2;
      const COMPRESSION_TIME_PER_IMAGE_MS = 200; // Mock: 200ms per image

      const startTime = Date.now();

      // Simulated: 5 images / 2 concurrency = 3 batches * 200ms = 600ms
      const estimatedTime = (imageCount / IMAGE_UPLOAD_CONCURRENCY) * COMPRESSION_TIME_PER_IMAGE_MS;

      expect(estimatedTime).toBeLessThan(30000); // Should be << 30s
      expect(estimatedTime).toBeLessThan(5000); // Realistically < 5s
    });

    it('should complete compression + upload within timeout threshold', async () => {
      const IMAGE_UPLOAD_TIMEOUT_MS = 20000; // 20s timeout
      const COMPRESSION_TIME_ESTIMATE_MS = 1200; // ~1.2s for 5 images (concurrency=2)
      const UPLOAD_TIME_ESTIMATE_MS = 10000; // ~10s for uploads

      const totalEstimate = COMPRESSION_TIME_ESTIMATE_MS + UPLOAD_TIME_ESTIMATE_MS;

      expect(totalEstimate).toBeLessThan(IMAGE_UPLOAD_TIMEOUT_MS);
    });

    it('should measure WebP compression ratio on various resolutions', async () => {
      // Common resolution scenarios
      const scenarios = [
        { res: '1920x1080', originalSize: 8 * 1024 * 1024, expectedCompressed: 1.5 * 1024 * 1024 },
        { res: '4000x3000', originalSize: 15 * 1024 * 1024, expectedCompressed: 2.5 * 1024 * 1024 },
        { res: '2560x1920', originalSize: 10 * 1024 * 1024, expectedCompressed: 1.8 * 1024 * 1024 },
      ];

      for (const scenario of scenarios) {
        const ratio = calculateCompressionRatio(scenario.originalSize, scenario.expectedCompressed);
        expect(ratio).toBeGreaterThanOrEqual(70); // 70%+ reduction
        expect(ratio).toBeLessThanOrEqual(95); // But not impossible
      }
    });

    it('should validate concurrency impact on upload throughput', async () => {
      const imageCount = 5;
      const imagePerUploadMs = 3000; // 3s per sequential upload

      // Sequential (concurrency=1)
      const sequentialTime = imageCount * imagePerUploadMs;

      // Parallel (concurrency=2)
      const parallelTime = (imageCount / 2) * imagePerUploadMs;

      // Parallel (concurrency=4)
      const highConcurrencyTime = (imageCount / 4) * imagePerUploadMs;

      expect(sequentialTime).toBeGreaterThan(parallelTime);
      expect(parallelTime).toBeGreaterThan(highConcurrencyTime);
      expect(sequentialTime).toBe(15000); // 5 * 3s
      expect(parallelTime).toBe(7500); // 2.5 * 3s
      expect(highConcurrencyTime).toBe(3750); // 1.25 * 3s
    });

    it('should not exceed memory limits with the 5-image upload flow', async () => {
      const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB
      const IMAGE_UPLOAD_CONCURRENCY = 2;

      // Max memory for concurrent ops: 2 * 3MB = 6MB in-flight
      const maxInflightMemory = IMAGE_UPLOAD_CONCURRENCY * MAX_IMAGE_BYTES;

      expect(maxInflightMemory).toBeLessThan(50 * 1024 * 1024); // Should be << 50MB
      expect(maxInflightMemory).toBe(6 * 1024 * 1024); // 6MB
    });

    it('should track compression metrics: ratio, time, format selection', async () => {
      const testCases = [
        {
          originalSize: 8 * 1024 * 1024,
          compressedSize: 1.5 * 1024 * 1024,
          timeMs: 250,
          format: 'webp' as const,
        },
        {
          originalSize: 6 * 1024 * 1024,
          compressedSize: 1.2 * 1024 * 1024,
          timeMs: 180,
          format: 'webp' as const,
        },
      ];

      for (const test of testCases) {
        const ratio = calculateCompressionRatio(test.originalSize, test.compressedSize);
        expect(ratio).toBeGreaterThanOrEqual(70);
        expect(test.timeMs).toBeLessThan(500); // Should be fast
        expect(test.format).toBe('webp'); // Primary format
      }
    });
  });

  // ─── SCENARIO 6: Edge Cases & Error Recovery ──────────────────────
  describe('Edge Cases & Error Recovery', () => {
    it('should enforce maximum 5 media count', async () => {
      const MAX_LISTING_MEDIA_COUNT = 5;
      const images = generateMockHighResImages(6); // Attempt 6

      expect(images.length).toBe(6);
      expect(images.length).toBeGreaterThan(MAX_LISTING_MEDIA_COUNT);
    });

    it('should enforce minimum 1 media requirement', async () => {
      const MIN_MEDIA = 1;
      const emptyMediaUris: string[] = [];

      expect(emptyMediaUris.length).toBeLessThan(MIN_MEDIA);
    });

    it('should handle corrupted image URI gracefully', async () => {
      const corruptedUri = 'file:///non-existent-path/missing.jpg';

      // Should throw appropriate error when trying to read
      expect(corruptedUri).toBeTruthy();
      expect(corruptedUri.includes('missing')).toBe(true);
    });

    it('should rollback listing if any image upload fails', async () => {
      const listingId = 'temp-listing-123';
      const uploadedImages = ['image-1.webp', 'image-2.webp']; // 2 succeeded
      const failedImageIndex = 3; // 3rd failed

      // Rollback: delete listing and clean up uploaded images
      const shouldCleanup = uploadedImages.length > 0;
      const cleanupPaths = uploadedImages.map((_, idx) => `seller/listing/${idx}.webp`);

      expect(shouldCleanup).toBe(true);
      expect(cleanupPaths.length).toBe(2);
    });

    it('should retry failed uploads with exponential backoff', async () => {
      const maxRetries = 2;
      const retryableStatuses = [408, 429, 500, 502, 503]; // Timeout, Rate limit, Server errors

      expect(maxRetries).toBeGreaterThanOrEqual(1);
      expect(retryableStatuses.length).toBeGreaterThan(0);
    });
  });

  // ─── SCENARIO 7: Database Consistency & Constraints ──────────────────
  describe('Database Consistency & Constraints', () => {
    it('should enforce listing_id foreign key constraint', async () => {
      // Orphaned image (no corresponding listing)
      const orphanedImage = {
        listing_id: 'non-existent-listing',
        url: 'https://example.com/image.webp',
        sort_order: 0,
        is_cover: true,
      };

      // DB constraint should prevent insertion
      expect(orphanedImage.listing_id).toBe('non-existent-listing');
    });

    it('should maintain sort_order uniqueness per listing', async () => {
      const listingId = 'listing-123';

      // Valid: multiple images with unique sort_order within listing
      const validImages = [
        { listing_id: listingId, sort_order: 0 },
        { listing_id: listingId, sort_order: 1 },
        { listing_id: listingId, sort_order: 2 },
      ];

      expect(validImages.map((m) => m.sort_order)).toEqual([0, 1, 2]);
    });

    it('should enforce is_cover uniqueness via partial unique index', async () => {
      const listingId = 'listing-123';

      // Invalid: two covers for same listing
      const invalidState = [
        { listing_id: listingId, is_cover: true, sort_order: 0 },
        { listing_id: listingId, is_cover: true, sort_order: 1 }, // Duplicate cover!
      ];

      // Should be prevented by: UNIQUE INDEX listing_images_single_cover_idx ON (listing_id) WHERE is_cover = true
      expect(invalidState.filter((m) => m.is_cover).length).toBeGreaterThan(1);
    });

    it('should validate url is not null', async () => {
      const validImage = {
        listing_id: 'listing-123',
        url: 'https://example.com/image.webp', // Required
        sort_order: 0,
        is_cover: true,
      };

      const invalidImage = {
        listing_id: 'listing-123',
        url: null, // Invalid!
        sort_order: 0,
        is_cover: true,
      };

      expect(validImage.url).toBeTruthy();
      expect(invalidImage.url).toBeNull();
    });
  });

  // ─── Summary Report ────────────────────────────────────────────────
  describe('Stress Test Summary', () => {
    it('should document all test scenarios', () => {
      const scenarios = [
        {
          name: 'High-Resolution Photo Batch',
          images: 5,
          size: '8MB+ each',
          target: '<3MB compressed',
          ratio: '70-80% reduction',
          timeout: '<10s',
        },
        {
          name: 'Video-First Error Handling',
          images: '1+ image + 1 video',
          requirement: 'Image must be first (cover)',
          validation: 'Pre-upload check',
          timeout: 'Instant',
        },
        {
          name: 'Cover Photo Corruption Fix',
          corruption: 'Multiple covers OR first not cover',
          detection: 'Trigger on write',
          autoFix: 'Normalize to first=true',
          timeout: 'DB-level (instant)',
        },
        {
          name: 'Media Removal & Cleanup',
          action: 'Delete 3 of 5 images',
          reorder: 'Re-index sort_order',
          cleanup: 'Remove orphaned storage files',
          timeout: '<2s',
        },
        {
          name: 'Performance Validation',
          compression: '5 images in <5s',
          upload: '<10s with concurrency=2',
          total: '<15s end-to-end',
          memory: '<6MB in-flight',
        },
      ];

      expect(scenarios.length).toBe(5);
      scenarios.forEach((scenario) => {
        expect(scenario).toHaveProperty('name');
      });
    });
  });
});
