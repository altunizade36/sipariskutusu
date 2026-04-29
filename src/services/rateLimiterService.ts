import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // milliseconds
}

export interface RateLimitStatus {
  remaining: number;
  resetAt: number;
  isLimited: boolean;
}

const RATE_LIMIT_KEY = '@sipariskutusu/rate_limits';

export class RateLimiter {
  private static config: Map<string, RateLimitConfig> = new Map();

  static setConfig(endpoint: string, config: RateLimitConfig) {
    this.config.set(endpoint, config);
  }

  static async checkLimit(endpoint: string): Promise<RateLimitStatus> {
    try {
      const config = this.config.get(endpoint);
      if (!config) {
        return {
          remaining: config?.maxRequests || 100,
          resetAt: 0,
          isLimited: false,
        };
      }

      const data = await AsyncStorage.getItem(RATE_LIMIT_KEY);
      const limits = data ? JSON.parse(data) : {};

      const now = Date.now();
      const endpointLimit = limits[endpoint] || { requests: [], resetAt: now + config.windowMs };

      // Remove old requests outside window
      endpointLimit.requests = endpointLimit.requests.filter(
        (timestamp: number) => timestamp > now - config.windowMs,
      );

      const remaining = Math.max(0, config.maxRequests - endpointLimit.requests.length);
      const isLimited = remaining === 0;

      await AsyncStorage.setItem(
        RATE_LIMIT_KEY,
        JSON.stringify({
          ...limits,
          [endpoint]: endpointLimit,
        }),
      );

      return {
        remaining,
        resetAt: endpointLimit.resetAt,
        isLimited,
      };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return { remaining: 0, resetAt: 0, isLimited: true };
    }
  }

  static async recordRequest(endpoint: string): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(RATE_LIMIT_KEY);
      const limits = data ? JSON.parse(data) : {};

      const config = this.config.get(endpoint);
      if (!config) return;

      const now = Date.now();
      const endpointLimit = limits[endpoint] || { requests: [], resetAt: now + config.windowMs };

      endpointLimit.requests.push(now);
      endpointLimit.requests = endpointLimit.requests.filter(
        (timestamp: number) => timestamp > now - config.windowMs,
      );

      await AsyncStorage.setItem(
        RATE_LIMIT_KEY,
        JSON.stringify({
          ...limits,
          [endpoint]: endpointLimit,
        }),
      );
    } catch (error) {
      console.error('Failed to record request:', error);
    }
  }

  static async reset(endpoint: string): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(RATE_LIMIT_KEY);
      if (data) {
        const limits = JSON.parse(data);
        delete limits[endpoint];
        await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(limits));
      }
    } catch (error) {
      console.error('Failed to reset rate limit:', error);
    }
  }

  static async resetAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(RATE_LIMIT_KEY);
    } catch (error) {
      console.error('Failed to reset all rate limits:', error);
    }
  }
}
