import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PriceHistory {
  productId: string;
  prices: Array<{
    price: number;
    timestamp: number;
  }>;
  lowestPrice: number;
  highestPrice: number;
  averagePrice: number;
}

const PRICE_HISTORY_KEY = '@sipariskutusu/price_history';

export class PriceTracker {
  static async recordPrice(productId: string, price: number): Promise<void> {
    try {
      const historyData = await AsyncStorage.getItem(PRICE_HISTORY_KEY);
      const history = historyData ? JSON.parse(historyData) : {};

      if (!history[productId]) {
        history[productId] = {
          productId,
          prices: [],
          lowestPrice: price,
          highestPrice: price,
          averagePrice: price,
        };
      }

      const productHistory = history[productId];
      productHistory.prices.push({
        price,
        timestamp: Date.now(),
      });

      // Keep only last 30 days of history
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      productHistory.prices = productHistory.prices.filter(
        (p: any) => p.timestamp > thirtyDaysAgo,
      );

      // Update metrics
      const prices = productHistory.prices.map((p: any) => p.price);
      productHistory.lowestPrice = Math.min(...prices);
      productHistory.highestPrice = Math.max(...prices);
      productHistory.averagePrice = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;

      await AsyncStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to record price:', error);
    }
  }

  static async getPriceHistory(productId: string): Promise<PriceHistory | null> {
    try {
      const historyData = await AsyncStorage.getItem(PRICE_HISTORY_KEY);
      if (historyData) {
        const history = JSON.parse(historyData);
        return history[productId] || null;
      }
    } catch (error) {
      console.error('Failed to get price history:', error);
    }
    return null;
  }

  static async getPriceChange(productId: string): Promise<{ change: number; percent: number } | null> {
    try {
      const history = await this.getPriceHistory(productId);
      if (!history || history.prices.length < 2) return null;

      const sorted = [...history.prices].sort((a, b) => a.timestamp - b.timestamp);
      const oldPrice = sorted[0].price;
      const currentPrice = sorted[sorted.length - 1].price;

      const change = currentPrice - oldPrice;
      const percent = (change / oldPrice) * 100;

      return { change, percent };
    } catch (error) {
      console.error('Failed to calculate price change:', error);
      return null;
    }
  }

  static async getDiscountInfo(productId: string, originalPrice: number): Promise<{
    savedAmount: number;
    savedPercent: number;
  } | null> {
    try {
      const history = await this.getPriceHistory(productId);
      if (!history) return null;

      const savedAmount = originalPrice - history.lowestPrice;
      const savedPercent = (savedAmount / originalPrice) * 100;

      return { savedAmount, savedPercent };
    } catch (error) {
      console.error('Failed to get discount info:', error);
      return null;
    }
  }

  static async clearProductHistory(productId: string): Promise<void> {
    try {
      const historyData = await AsyncStorage.getItem(PRICE_HISTORY_KEY);
      if (historyData) {
        const history = JSON.parse(historyData);
        delete history[productId];
        await AsyncStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(history));
      }
    } catch (error) {
      console.error('Failed to clear product history:', error);
    }
  }

  static async clearAllHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(PRICE_HISTORY_KEY);
    } catch (error) {
      console.error('Failed to clear all price history:', error);
    }
  }
}
