import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type Offerings, type PurchasesPackage } from 'react-native-purchases';
import Constants from 'expo-constants';

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY ?? '';
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '';
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '';

export const ENTITLEMENT_IDS = {
  starter: 'starter',
  plus: 'plus',
  pro: 'pro',
  elite: 'elite',
} as const;

export type EntitlementId = (typeof ENTITLEMENT_IDS)[keyof typeof ENTITLEMENT_IDS];

function getRevenueCatApiKey(): string {
  const isDev = __DEV__ || Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient';
  if (isDev && REVENUECAT_TEST_API_KEY) return REVENUECAT_TEST_API_KEY;
  if (Platform.OS === 'ios' && REVENUECAT_IOS_API_KEY) return REVENUECAT_IOS_API_KEY;
  if (Platform.OS === 'android' && REVENUECAT_ANDROID_API_KEY) return REVENUECAT_ANDROID_API_KEY;
  return REVENUECAT_TEST_API_KEY;
}

let rcInitialized = false;

export function initializeRevenueCat(): void {
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) return;
  if (rcInitialized) return;
  rcInitialized = true;
  Purchases.setLogLevel(Purchases.LOG_LEVEL.ERROR);
  Purchases.configure({ apiKey });
}

export async function loginRevenueCat(userId: string): Promise<void> {
  try {
    await Purchases.logIn(userId);
  } catch {
    // silently fail
  }
}

export async function logoutRevenueCat(): Promise<void> {
  try {
    await Purchases.logOut();
  } catch {
    // silently fail
  }
}

type SubscriptionContextValue = {
  customerInfo: CustomerInfo | null;
  offerings: Offerings | null;
  isLoading: boolean;
  isPurchasing: boolean;
  isRestoring: boolean;
  activeEntitlement: EntitlementId | null;
  activePlan: string;
  creditBalance: number;
  refreshCustomerInfo: () => Promise<void>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<CustomerInfo | null>;
  restorePurchases: () => Promise<CustomerInfo | null>;
  isEntitlementActive: (id: EntitlementId) => boolean;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

function getActivePlanFromCustomerInfo(info: CustomerInfo | null): { plan: string; entitlement: EntitlementId | null } {
  if (!info) return { plan: 'free', entitlement: null };
  const active = info.entitlements.active;
  if (active[ENTITLEMENT_IDS.elite]) return { plan: 'elite', entitlement: 'elite' };
  if (active[ENTITLEMENT_IDS.pro]) return { plan: 'pro', entitlement: 'pro' };
  if (active[ENTITLEMENT_IDS.plus]) return { plan: 'plus', entitlement: 'plus' };
  if (active[ENTITLEMENT_IDS.starter]) return { plan: 'starter', entitlement: 'starter' };
  return { plan: 'free', entitlement: null };
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<Offerings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refreshCustomerInfo = async () => {
    try {
      const apiKey = getRevenueCatApiKey();
      if (!apiKey) return;
      setIsLoading(true);
      const [info, off] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);
      if (mounted.current) {
        setCustomerInfo(info);
        setOfferings(off);
      }
    } catch {
      // RC not configured yet — silently ignore
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshCustomerInfo();
  }, []);

  useEffect(() => {
    let sub: ReturnType<typeof Purchases.addCustomerInfoUpdateListener> | null = null;
    try {
      sub = Purchases.addCustomerInfoUpdateListener((info) => {
        if (mounted.current) setCustomerInfo(info);
      });
    } catch {
      // silently ignore
    }
    return () => {
      if (sub) {
        try { sub.remove(); } catch { /* ignore */ }
      }
    };
  }, []);

  const purchasePackage = async (pkg: PurchasesPackage): Promise<CustomerInfo | null> => {
    setIsPurchasing(true);
    try {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      if (mounted.current) setCustomerInfo(info);
      return info;
    } catch {
      return null;
    } finally {
      if (mounted.current) setIsPurchasing(false);
    }
  };

  const restorePurchases = async (): Promise<CustomerInfo | null> => {
    setIsRestoring(true);
    try {
      const info = await Purchases.restorePurchases();
      if (mounted.current) setCustomerInfo(info);
      return info;
    } catch {
      return null;
    } finally {
      if (mounted.current) setIsRestoring(false);
    }
  };

  const isEntitlementActive = (id: EntitlementId) => {
    return !!customerInfo?.entitlements.active[id];
  };

  const { plan: activePlan, entitlement: activeEntitlement } = getActivePlanFromCustomerInfo(customerInfo);

  return (
    <SubscriptionContext.Provider value={{
      customerInfo,
      offerings,
      isLoading,
      isPurchasing,
      isRestoring,
      activeEntitlement,
      activePlan,
      creditBalance,
      refreshCustomerInfo,
      purchasePackage,
      restorePurchases,
      isEntitlementActive,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}
