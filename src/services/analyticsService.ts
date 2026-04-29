import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserAnalytics {
  sessionStart: number;
  sessionEnd?: number;
  eventsCount: number;
  viewedProductIds: string[];
  searchQueries: string[];
  timeSpentMinutes: number;
  lastActiveScreen?: string;
}

export interface AnalyticsEvent {
  event: string;
  timestamp: number;
  data?: Record<string, any>;
}

const ANALYTICS_KEY = '@sipariskutusu/analytics';
const EVENTS_KEY = '@sipariskutusu/events';

export class AnalyticsService {
  static async startSession(): Promise<void> {
    try {
      const session: UserAnalytics = {
        sessionStart: Date.now(),
        eventsCount: 0,
        viewedProductIds: [],
        searchQueries: [],
        timeSpentMinutes: 0,
      };
      await AsyncStorage.setItem(ANALYTICS_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Failed to start analytics session:', error);
    }
  }

  static async trackEvent(event: string, data?: Record<string, any>): Promise<void> {
    try {
      const analyticsEvent: AnalyticsEvent = {
        event,
        timestamp: Date.now(),
        data,
      };

      const existingEvents = await AsyncStorage.getItem(EVENTS_KEY);
      const events = existingEvents ? JSON.parse(existingEvents) : [];
      events.push(analyticsEvent);

      // Keep only last 100 events
      if (events.length > 100) {
        events.shift();
      }

      await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(events));

      // Update session
      const session = await AsyncStorage.getItem(ANALYTICS_KEY);
      if (session) {
        const parsed = JSON.parse(session);
        parsed.eventsCount = (parsed.eventsCount || 0) + 1;
        await AsyncStorage.setItem(ANALYTICS_KEY, JSON.stringify(parsed));
      }
    } catch (error) {
      console.error('Failed to track analytics event:', error);
    }
  }

  static async trackProductView(productId: string): Promise<void> {
    try {
      const session = await AsyncStorage.getItem(ANALYTICS_KEY);
      if (session) {
        const parsed = JSON.parse(session);
        if (!parsed.viewedProductIds.includes(productId)) {
          parsed.viewedProductIds.push(productId);
          await AsyncStorage.setItem(ANALYTICS_KEY, JSON.stringify(parsed));
        }
      }
    } catch (error) {
      console.error('Failed to track product view:', error);
    }
  }

  static async trackSearch(query: string): Promise<void> {
    try {
      const session = await AsyncStorage.getItem(ANALYTICS_KEY);
      if (session) {
        const parsed = JSON.parse(session);
        if (!parsed.searchQueries.includes(query)) {
          parsed.searchQueries.push(query);
        }
        await AsyncStorage.setItem(ANALYTICS_KEY, JSON.stringify(parsed));
      }
    } catch (error) {
      console.error('Failed to track search:', error);
    }
  }

  static async trackScreenView(screenName: string): Promise<void> {
    await this.trackEvent('screen_view', { screen: screenName });
  }

  static async endSession(): Promise<UserAnalytics | null> {
    try {
      const session = await AsyncStorage.getItem(ANALYTICS_KEY);
      if (session) {
        const parsed = JSON.parse(session);
        parsed.sessionEnd = Date.now();
        const timeSpent = (parsed.sessionEnd - parsed.sessionStart) / 1000 / 60;
        parsed.timeSpentMinutes = Math.round(timeSpent);
        await AsyncStorage.setItem(ANALYTICS_KEY, JSON.stringify(parsed));
        return parsed;
      }
    } catch (error) {
      console.error('Failed to end analytics session:', error);
    }
    return null;
  }

  static async getSessionData(): Promise<UserAnalytics | null> {
    try {
      const session = await AsyncStorage.getItem(ANALYTICS_KEY);
      return session ? JSON.parse(session) : null;
    } catch (error) {
      console.error('Failed to get session data:', error);
      return null;
    }
  }

  static async getEvents(limit = 20): Promise<AnalyticsEvent[]> {
    try {
      const events = await AsyncStorage.getItem(EVENTS_KEY);
      if (events) {
        const parsed = JSON.parse(events);
        return parsed.slice(-limit);
      }
    } catch (error) {
      console.error('Failed to get events:', error);
    }
    return [];
  }

  static async clearAllAnalytics(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([ANALYTICS_KEY, EVENTS_KEY]);
    } catch (error) {
      console.error('Failed to clear analytics:', error);
    }
  }
}
