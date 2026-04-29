export interface DeviceInfo {
  osName: string;
  osVersion: string;
  platform: 'ios' | 'android' | 'web' | 'unknown';
  deviceName: string;
  deviceModel: string;
  appVersion: string;
  buildNumber: string;
  isTablet: boolean;
  screenWidth: number;
  screenHeight: number;
  pixelDensity: number;
}

export interface SystemInfo {
  totalMemory: number;
  freeMemory: number;
  usedMemory: number;
  batteryLevel: number;
  batteryState: 'charging' | 'full' | 'unplugged' | 'unknown';
  isLowPowerMode: boolean;
  orientation: 'portrait' | 'landscape';
  timeZone: string;
  locale: string;
  isDarkModeEnabled: boolean;
}

export interface StorageInfo {
  totalStorage: number;
  freeStorage: number;
  usedStorage: number;
}

export class DeviceInfoService {
  static getDeviceInfo(): DeviceInfo {
    const ua = navigator.userAgent;

    let osName = 'Unknown';
    let osVersion = 'Unknown';
    let platform: 'ios' | 'android' | 'web' | 'unknown' = 'web';

    if (ua.includes('iPhone') || ua.includes('iPad')) {
      osName = 'iOS';
      platform = 'ios';
      const match = ua.match(/OS (\d+_\d+)/);
      if (match) {
        osVersion = match[1].replace('_', '.');
      }
    } else if (ua.includes('Android')) {
      osName = 'Android';
      platform = 'android';
      const match = ua.match(/Android ([0-9.]*)/);
      if (match) {
        osVersion = match[1];
      }
    }

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const isTablet = screenWidth >= 768;

    return {
      osName,
      osVersion,
      platform,
      deviceName: platform === 'web' ? 'Web Browser' : 'Device',
      deviceModel: ua.includes('Chrome') ? 'Chrome' : ua.includes('Safari') ? 'Safari' : 'Unknown',
      appVersion: '1.0.0',
      buildNumber: '1',
      isTablet,
      screenWidth,
      screenHeight,
      pixelDensity: window.devicePixelRatio,
    };
  }

  static getScreenDimensions() {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      scale: window.devicePixelRatio,
    };
  }

  static isTablet(): boolean {
    return window.innerWidth >= 768;
  }

  static isMobile(): boolean {
    return window.innerWidth < 768;
  }

  static isSmallScreen(): boolean {
    return window.innerWidth < 375;
  }

  static getScreenCategory(): 'small' | 'medium' | 'large' {
    const width = window.innerWidth;
    if (width < 375) return 'small';
    if (width < 768) return 'medium';
    return 'large';
  }
}

export class SystemInfoService {
  static getSystemInfo(): Partial<SystemInfo> {
    return {
      batteryLevel: 100,
      batteryState: 'full',
      isLowPowerMode: false,
      orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: navigator.language,
      isDarkModeEnabled: this.isDarkModeEnabled(),
    };
  }

  static isDarkModeEnabled(): boolean {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  static listenToDarkModeChanges(callback: (isDark: boolean) => void): () => void {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handler = (e: MediaQueryListEvent) => {
      callback(e.matches);
    };

    mediaQuery.addListener(handler);

    return () => mediaQuery.removeListener(handler);
  }

  static getOrientation(): 'portrait' | 'landscape' {
    return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
  }

  static listenToOrientationChanges(callback: (orientation: 'portrait' | 'landscape') => void): () => void {
    const handler = () => {
      callback(this.getOrientation());
    };

    window.addEventListener('orientationchange', handler);
    window.addEventListener('resize', handler);

    return () => {
      window.removeEventListener('orientationchange', handler);
      window.removeEventListener('resize', handler);
    };
  }

  static getTimeZone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  static getLocale(): string {
    return navigator.language;
  }
}

export class StorageInfoService {
  static async getStorageInfo(): Promise<StorageInfo> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          totalStorage: estimate.quota || 0,
          usedStorage: estimate.usage || 0,
          freeStorage: (estimate.quota || 0) - (estimate.usage || 0),
        };
      } catch (error) {
        console.error('Error getting storage info:', error);
        return {
          totalStorage: 0,
          usedStorage: 0,
          freeStorage: 0,
        };
      }
    }

    return {
      totalStorage: 0,
      usedStorage: 0,
      freeStorage: 0,
    };
  }

  static async requestPersistentStorage(): Promise<boolean> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      try {
        return await navigator.storage.persist();
      } catch (error) {
        console.error('Error requesting persistent storage:', error);
        return false;
      }
    }

    return false;
  }

  static async isPersistentStorageGranted(): Promise<boolean> {
    if ('storage' in navigator && 'persisted' in navigator.storage) {
      try {
        return await navigator.storage.persisted();
      } catch (error) {
        console.error('Error checking persistent storage:', error);
        return false;
      }
    }

    return false;
  }
}

export class PerformanceMetricsService {
  static getNavigationTiming() {
    if (!window.performance || !window.performance.timing) {
      return null;
    }

    const { timing } = window.performance;

    return {
      dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
      tcpConnection: timing.connectEnd - timing.connectStart,
      requestTime: timing.responseStart - timing.requestStart,
      responseTime: timing.responseEnd - timing.responseStart,
      domParsing: timing.domInteractive - timing.domLoading,
      resourceLoading: timing.loadEventStart - timing.domComplete,
      domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
      pageLoadTime: timing.loadEventEnd - timing.navigationStart,
    };
  }

  static getResourceTimings() {
    if (!window.performance || !window.performance.getEntriesByType) {
      return [];
    }

    return window.performance.getEntriesByType('resource').map((entry) => ({
      name: entry.name,
      duration: entry.duration,
      size: (entry as any).transferSize || 0,
    }));
  }

  static getMemoryUsage() {
    if ((performance as any).memory) {
      const memory = (performance as any).memory;
      return {
        usedJsHeapSize: memory.usedJSHeapSize,
        totalJsHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        heapUsagePercent: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      };
    }

    return null;
  }
}
