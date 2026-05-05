import AsyncStorage from '@react-native-async-storage/async-storage';

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description?: string;
  rolloutPercentage?: number;
}

const FEATURES_KEY = '@sipariskutusu/feature_flags';

const DEFAULT_FLAGS: Record<string, FeatureFlag> = {
  darkMode: {
    name: 'darkMode',
    enabled: false,
    description: 'Enable dark mode theme',
  },
  advancedSearch: {
    name: 'advancedSearch',
    enabled: true,
    description: 'Show advanced search filters',
  },
  productRecommendations: {
    name: 'productRecommendations',
    enabled: true,
    description: 'Show personalized product recommendations',
  },
  socialSharing: {
    name: 'socialSharing',
    enabled: true,
    description: 'Enable social sharing features',
  },
  pushNotifications: {
    name: 'pushNotifications',
    enabled: true,
    description: 'Send push notifications',
  },
  collectionFeature: {
    name: 'collectionFeature',
    enabled: true,
    description: 'Enable wishlist collections',
  },
  priceTracking: {
    name: 'priceTracking',
    enabled: true,
    description: 'Track product price changes',
  },
  sellerMetrics: {
    name: 'sellerMetrics',
    enabled: true,
    description: 'Show seller reliability metrics',
  },
  betaFeatures: {
    name: 'betaFeatures',
    enabled: false,
    description: 'Enable beta/experimental features',
  },
};

export class FeatureFlagService {
  static async initialize(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(FEATURES_KEY);
      if (!stored) {
        await AsyncStorage.setItem(FEATURES_KEY, JSON.stringify(DEFAULT_FLAGS));
      }
    } catch (error) {
      console.error('Failed to initialize feature flags:', error);
    }
  }

  static async isEnabled(flagName: string): Promise<boolean> {
    try {
      const flags = await this.getAllFlags();
      const flag = flags[flagName];
      return flag?.enabled ?? DEFAULT_FLAGS[flagName]?.enabled ?? false;
    } catch (error) {
      console.error('Failed to check feature flag:', error);
      return false;
    }
  }

  static async setFlag(flagName: string, enabled: boolean): Promise<void> {
    try {
      const flags = await this.getAllFlags();
      if (flags[flagName]) {
        flags[flagName].enabled = enabled;
        await AsyncStorage.setItem(FEATURES_KEY, JSON.stringify(flags));
      }
    } catch (error) {
      console.error('Failed to set feature flag:', error);
    }
  }

  static async toggleFlag(flagName: string): Promise<boolean> {
    try {
      const currentState = await this.isEnabled(flagName);
      await this.setFlag(flagName, !currentState);
      return !currentState;
    } catch (error) {
      console.error('Failed to toggle feature flag:', error);
      return false;
    }
  }

  static async getAllFlags(): Promise<Record<string, FeatureFlag>> {
    try {
      const stored = await AsyncStorage.getItem(FEATURES_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_FLAGS;
    } catch (error) {
      console.error('Failed to get feature flags:', error);
      return DEFAULT_FLAGS;
    }
  }

  static async resetToDefaults(): Promise<void> {
    try {
      await AsyncStorage.setItem(FEATURES_KEY, JSON.stringify(DEFAULT_FLAGS));
    } catch (error) {
      console.error('Failed to reset feature flags:', error);
    }
  }

  static async getBetaFeatures(): Promise<FeatureFlag[]> {
    try {
      const flags = await this.getAllFlags();
      const isBetaEnabled = flags.betaFeatures?.enabled ?? false;
      
      if (!isBetaEnabled) return [];

      return Object.values(flags).filter(
        (f) => f.name.includes('beta') || f.name.includes('experimental'),
      );
    } catch (error) {
      console.error('Failed to get beta features:', error);
      return [];
    }
  }

  static async isUserEligible(flagName: string, userId: string): Promise<boolean> {
    try {
      const flag = (await this.getAllFlags())[flagName];
      if (!flag || !flag.enabled) return false;

      if (flag.rolloutPercentage === undefined || flag.rolloutPercentage === 100) {
        return true;
      }

      // Use userId hash to determine rollout
      const hash = userId.split('').reduce((acc, char) => {
        return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
      }, 0);
      
      const percentage = Math.abs(hash % 100);
      return percentage < flag.rolloutPercentage;
    } catch (error) {
      console.error('Failed to check user eligibility:', error);
      return false;
    }
  }
}
