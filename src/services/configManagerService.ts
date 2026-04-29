export interface AppConfig {
  app: {
    name: string;
    version: string;
    buildNumber: number;
    environment: 'development' | 'staging' | 'production';
  };
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
  };
  supabase: {
    url: string;
    anonKey: string;
  };
  features: {
    darkMode: boolean;
    notifications: boolean;
    analytics: boolean;
    crashReporting: boolean;
  };
  limits: {
    maxUploadSize: number; // bytes
    maxListingsPerDay: number;
    maxMessagesPerDay: number;
    sessionTimeout: number; // ms
    cacheTTL: number; // ms
  };
  storage: {
    recentlyViewedMax: number;
    searchHistoryMax: number;
    notificationsMax: number;
  };
}

export class ConfigManager {
  private static config: Partial<AppConfig> = {};
  private static overrides: Map<string, any> = new Map();

  static initialize(config: Partial<AppConfig>) {
    this.config = config;
  }

  static set<K extends keyof AppConfig>(key: K, value: AppConfig[K]) {
    this.overrides.set(String(key), value);
  }

  static get<K extends keyof AppConfig>(key: K): AppConfig[K] | undefined {
    if (this.overrides.has(String(key))) {
      return this.overrides.get(String(key));
    }
    return this.config[key] as AppConfig[K];
  }

  static getValue<T = any>(path: string): T | undefined {
    const keys = path.split('.');
    let current: any = this.config;

    for (const key of keys) {
      if (current && typeof current === 'object') {
        current = current[key];
      } else {
        return undefined;
      }
    }

    return current as T;
  }

  static getOrDefault<T = any>(path: string, defaultValue: T): T {
    return this.getValue<T>(path) ?? defaultValue;
  }

  static isDevelopment(): boolean {
    const env = this.getOrDefault('app.environment', 'production') as string;
    return env === 'development';
  }

  static isProduction(): boolean {
    const env = this.getOrDefault('app.environment', 'production') as string;
    return env === 'production';
  }

  static isStaging(): boolean {
    const env = this.getOrDefault('app.environment', 'production') as string;
    return env === 'staging';
  }

  static isFeatureEnabled(feature: keyof AppConfig['features']): boolean {
    return this.getOrDefault(`features.${feature}`, false);
  }

  static getAppInfo() {
    return {
      name: this.getOrDefault('app.name', 'Siparis Kutusu'),
      version: this.getOrDefault('app.version', '1.0.0'),
      buildNumber: this.getOrDefault('app.buildNumber', 1),
      environment: this.getOrDefault('app.environment', 'development'),
    };
  }

  static getApiConfig() {
    return {
      baseUrl: this.getOrDefault('api.baseUrl', 'https://api.example.com'),
      timeout: this.getOrDefault('api.timeout', 30000),
      retryAttempts: this.getOrDefault('api.retryAttempts', 3),
    };
  }

  static getLimits() {
    return {
      maxUploadSize: this.getOrDefault('limits.maxUploadSize', 10 * 1024 * 1024), // 10MB
      maxListingsPerDay: this.getOrDefault('limits.maxListingsPerDay', 20),
      maxMessagesPerDay: this.getOrDefault('limits.maxMessagesPerDay', 100),
      sessionTimeout: this.getOrDefault('limits.sessionTimeout', 30 * 60 * 1000), // 30 min
      cacheTTL: this.getOrDefault('limits.cacheTTL', 5 * 60 * 1000), // 5 min
    };
  }

  static getStorageLimits() {
    return {
      recentlyViewedMax: this.getOrDefault('storage.recentlyViewedMax', 20),
      searchHistoryMax: this.getOrDefault('storage.searchHistoryMax', 10),
      notificationsMax: this.getOrDefault('storage.notificationsMax', 100),
    };
  }

  static getAll(): Partial<AppConfig> {
    return { ...this.config };
  }

  static reset() {
    this.overrides.clear();
  }
}

// Default configuration
export const DEFAULT_CONFIG: AppConfig = {
  app: {
    name: 'Siparis Kutusu',
    version: '1.0.0',
    buildNumber: 1,
    environment: 'development',
  },
  api: {
    baseUrl: 'https://api.sipariskutusu.com',
    timeout: 30000,
    retryAttempts: 3,
  },
  supabase: {
    url: 'https://jvcncrdwikbvvehkimet.supabase.co',
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  },
  features: {
    darkMode: true,
    notifications: true,
    analytics: true,
    crashReporting: true,
  },
  limits: {
    maxUploadSize: 10 * 1024 * 1024, // 10MB
    maxListingsPerDay: 20,
    maxMessagesPerDay: 100,
    sessionTimeout: 30 * 60 * 1000, // 30 min
    cacheTTL: 5 * 60 * 1000, // 5 min
  },
  storage: {
    recentlyViewedMax: 20,
    searchHistoryMax: 10,
    notificationsMax: 100,
  },
};

// Initialize with defaults
ConfigManager.initialize(DEFAULT_CONFIG);
