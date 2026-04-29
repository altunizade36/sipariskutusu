import { Image } from 'react-native';

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1
  format?: 'jpeg' | 'png' | 'webp';
}

export class ImageOptimizer {
  static async getImageDimensions(uri: string): Promise<ImageDimensions> {
    return new Promise((resolve, reject) => {
      Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        (error) => reject(error),
      );
    });
  }

  static calculateAspectRatio(width: number, height: number): number {
    return width / height;
  }

  static calculateOptimalDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number,
  ): ImageDimensions {
    let width = originalWidth;
    let height = originalHeight;

    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }

    if (height > maxHeight) {
      width = (width * maxHeight) / height;
      height = maxHeight;
    }

    return { width: Math.round(width), height: Math.round(height) };
  }

  static getImageUrl(
    uri: string,
    options: ImageOptimizationOptions = {},
  ): string {
    const {
      maxWidth = 800,
      maxHeight = 600,
      quality = 0.8,
      format = 'jpeg',
    } = options;

    // For web URLs, add query parameters
    if (uri.startsWith('http')) {
      const url = new URL(uri);
      url.searchParams.set('w', maxWidth.toString());
      url.searchParams.set('h', maxHeight.toString());
      url.searchParams.set('q', Math.round(quality * 100).toString());
      url.searchParams.set('f', format);
      return url.toString();
    }

    return uri;
  }

  static async cacheImage(uri: string): Promise<boolean> {
    try {
      await Image.prefetch(uri);
      return true;
    } catch (error) {
      console.error('Failed to cache image:', error);
      return false;
    }
  }

  static async preloadImages(uris: string[]): Promise<void> {
    await Promise.all(uris.map((uri) => this.cacheImage(uri)));
  }

  static getThumbnailUrl(uri: string, size: number = 150): string {
    return this.getImageUrl(uri, {
      maxWidth: size,
      maxHeight: size,
      quality: 0.7,
      format: 'jpeg',
    });
  }

  static getResponsiveImageUrl(
    uri: string,
    screenWidth: number,
  ): string {
    let targetWidth = 400;

    if (screenWidth < 600) {
      targetWidth = Math.min(screenWidth, 400);
    } else if (screenWidth < 900) {
      targetWidth = Math.min(screenWidth, 600);
    } else {
      targetWidth = Math.min(screenWidth, 800);
    }

    return this.getImageUrl(uri, {
      maxWidth: targetWidth,
      maxHeight: targetWidth,
      quality: 0.85,
    });
  }
}
