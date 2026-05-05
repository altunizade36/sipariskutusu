import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SellerMetrics {
  sellerId: string;
  responseCount: number;
  totalResponseTime: number; // in milliseconds
  averageResponseTime: number; // in milliseconds
  lastResponseAt?: number;
  isOnline: boolean;
  lastSeenAt?: number;
}

const SELLER_METRICS_KEY = '@sipariskutusu/seller_metrics';

export class SellerMetricsService {
  static formatResponseTime(ms: number): string {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    if (ms < 86400000) return `${Math.round(ms / 3600000)}h`;
    return `${Math.round(ms / 86400000)}d`;
  }

  static recordResponse(sellerId: string, responseTimeMs: number): Promise<SellerMetrics> {
    return new Promise(async (resolve) => {
      try {
        const metrics = await this.getSellerMetrics(sellerId);

        if (metrics) {
          metrics.responseCount += 1;
          metrics.totalResponseTime += responseTimeMs;
          metrics.averageResponseTime = metrics.totalResponseTime / metrics.responseCount;
          metrics.lastResponseAt = Date.now();
          metrics.isOnline = true;
        } else {
          const newMetrics: SellerMetrics = {
            sellerId,
            responseCount: 1,
            totalResponseTime: responseTimeMs,
            averageResponseTime: responseTimeMs,
            lastResponseAt: Date.now(),
            isOnline: true,
            lastSeenAt: Date.now(),
          };

          return resolve(newMetrics);
        }

        await this.saveSellerMetrics(metrics);
        resolve(metrics);
      } catch (error) {
        console.error('Failed to record response:', error);
        resolve({
          sellerId,
          responseCount: 0,
          totalResponseTime: 0,
          averageResponseTime: 0,
          isOnline: false,
        });
      }
    });
  }

  static async getSellerMetrics(sellerId: string): Promise<SellerMetrics | null> {
    try {
      const data = await AsyncStorage.getItem(SELLER_METRICS_KEY);
      if (!data) return null;

      const metrics = JSON.parse(data);
      return metrics[sellerId] || null;
    } catch (error) {
      console.error('Failed to get seller metrics:', error);
      return null;
    }
  }

  static async getAllSellerMetrics(): Promise<SellerMetrics[]> {
    try {
      const data = await AsyncStorage.getItem(SELLER_METRICS_KEY);
      if (!data) return [];

      const metrics = JSON.parse(data);
      return Object.values(metrics) as SellerMetrics[];
    } catch (error) {
      console.error('Failed to get all seller metrics:', error);
      return [];
    }
  }

  static async recordSellerOnline(sellerId: string): Promise<void> {
    try {
      const metrics = await this.getSellerMetrics(sellerId);
      if (metrics) {
        metrics.isOnline = true;
        metrics.lastSeenAt = Date.now();
        await this.saveSellerMetrics(metrics);
      }
    } catch (error) {
      console.error('Failed to record seller online:', error);
    }
  }

  static async recordSellerOffline(sellerId: string): Promise<void> {
    try {
      const metrics = await this.getSellerMetrics(sellerId);
      if (metrics) {
        metrics.isOnline = false;
        await this.saveSellerMetrics(metrics);
      }
    } catch (error) {
      console.error('Failed to record seller offline:', error);
    }
  }

  static async getResponseTimeRating(sellerId: string): Promise<number> {
    try {
      const metrics = await this.getSellerMetrics(sellerId);
      if (!metrics || metrics.averageResponseTime === 0) return 0;

      // Rating scale: 5 = under 5 minutes, 4 = under 30 minutes, 3 = under 1 hour, 2 = under 24 hours, 1 = over 24 hours
      if (metrics.averageResponseTime < 5 * 60 * 1000) return 5;
      if (metrics.averageResponseTime < 30 * 60 * 1000) return 4;
      if (metrics.averageResponseTime < 60 * 60 * 1000) return 3;
      if (metrics.averageResponseTime < 24 * 60 * 60 * 1000) return 2;
      return 1;
    } catch (error) {
      console.error('Failed to get response time rating:', error);
      return 0;
    }
  }

  static async clearSellerMetrics(sellerId: string): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(SELLER_METRICS_KEY);
      if (data) {
        const metrics = JSON.parse(data);
        delete metrics[sellerId];
        await AsyncStorage.setItem(SELLER_METRICS_KEY, JSON.stringify(metrics));
      }
    } catch (error) {
      console.error('Failed to clear seller metrics:', error);
    }
  }

  static async clearAllMetrics(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SELLER_METRICS_KEY);
    } catch (error) {
      console.error('Failed to clear all metrics:', error);
    }
  }

  private static async saveSellerMetrics(metrics: SellerMetrics): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(SELLER_METRICS_KEY);
      const allMetrics = data ? JSON.parse(data) : {};
      allMetrics[metrics.sellerId] = metrics;
      await AsyncStorage.setItem(SELLER_METRICS_KEY, JSON.stringify(allMetrics));
    } catch (error) {
      console.error('Failed to save seller metrics:', error);
    }
  }
}
