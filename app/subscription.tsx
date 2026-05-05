import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useSubscription } from '../src/lib/revenuecat';
import { getMyEntitlements, getMyWallet, getMySubscription, getPlanDisplayName, type UserEntitlement, type PlanName } from '../src/services/entitlementService';
import { colors, fonts } from '../src/constants/theme';
import type { PurchasesPackage } from 'react-native-purchases';

type PlanKey = 'free' | 'starter' | 'plus' | 'pro' | 'elite';

type PlanInfo = {
  key: PlanKey;
  label: string;
  color: string;
  badge?: string;
  maxProducts: string;
  dailyStories: string;
  monthlyCredits: string;
  discoveryBoost: string;
  extras: string[];
};

const PLAN_INFO: PlanInfo[] = [
  {
    key: 'free',
    label: 'Ücretsiz',
    color: '#6B7280',
    maxProducts: '10 aktif ürün',
    dailyStories: 'Günde 1 hikaye',
    monthlyCredits: 'Kredi yok',
    discoveryBoost: 'Standart keşfet',
    extras: ['Instagram import sınırsız'],
  },
  {
    key: 'starter',
    label: 'Starter',
    color: '#10B981',
    maxProducts: '20 aktif ürün',
    dailyStories: 'Günde 3 hikaye',
    monthlyCredits: 'Aylık 15 kredi',
    discoveryBoost: '+%5 keşfet avantajı',
    extras: ['Instagram import sınırsız'],
  },
  {
    key: 'plus',
    label: 'Plus',
    color: '#3B82F6',
    badge: 'Önerilen',
    maxProducts: '50 aktif ürün',
    dailyStories: 'Günde 8 hikaye',
    monthlyCredits: 'Aylık 50 kredi',
    discoveryBoost: '+%12 keşfet avantajı',
    extras: ['Instagram import sınırsız', 'Temel mağaza istatistikleri'],
  },
  {
    key: 'pro',
    label: 'Pro',
    color: '#8B5CF6',
    badge: 'Önerilen',
    maxProducts: '200 aktif ürün',
    dailyStories: 'Günde 25 hikaye',
    monthlyCredits: 'Aylık 150 kredi',
    discoveryBoost: '+%25 keşfet avantajı',
    extras: ['Instagram import sınırsız', 'Gelişmiş istatistikler', 'Pro Satıcı Rozeti'],
  },
  {
    key: 'elite',
    label: 'Elite',
    color: '#F59E0B',
    badge: 'En Güçlü',
    maxProducts: 'Sınırsız ürün',
    dailyStories: 'Sınırsız hikaye',
    monthlyCredits: 'Aylık 400 kredi',
    discoveryBoost: '+%50 keşfet avantajı',
    extras: ['Instagram import sınırsız', 'Gelişmiş istatistikler', 'Elite Satıcı Rozeti', 'Ana Sayfa Vitrin Hakkı', 'En yüksek öncelik'],
  },
];

function buildPalette(isDarkMode: boolean) {
  return {
    bg: isDarkMode ? '#0F172A' : '#F2F3F7',
    card: isDarkMode ? '#111827' : '#FFFFFF',
    border: isDarkMode ? '#1E293B' : '#E5E7EB',
    textPrimary: isDarkMode ? '#E5E7EB' : '#111827',
    textSecondary: isDarkMode ? '#94A3B8' : '#6B7280',
    textMuted: isDarkMode ? '#4B5563' : '#9CA3AF',
    activeCard: isDarkMode ? '#1E3A5F' : '#EFF6FF',
    activeBorder: colors.primary,
  };
}

export default function SubscriptionScreen() {
  const router = useRouter();
  const { isDarkMode, user } = useAuth();
  const { offerings, customerInfo, isPurchasing, activePlan, purchasePackage, restorePurchases, isRestoring, refreshCustomerInfo } = useSubscription();
  const palette = buildPalette(isDarkMode);

  const [entitlement, setEntitlement] = useState<UserEntitlement | null>(null);
  const [creditBalance, setCreditBalance] = useState(0);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [billingMode, setBillingMode] = useState<'monthly' | 'yearly'>('monthly');
  const [confirmPkg, setConfirmPkg] = useState<PurchasesPackage | null>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ent, wallet, sub] = await Promise.all([getMyEntitlements(), getMyWallet(), getMySubscription()]);
      setEntitlement(ent);
      setCreditBalance(wallet?.balance ?? 0);
      setSubscription(sub);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const currentPlan = (activePlan as PlanKey) ?? (entitlement?.plan as PlanKey) ?? 'free';

  const getPackageForPlan = (planKey: PlanKey): PurchasesPackage | null => {
    if (planKey === 'free') return null;
    const subOffering = offerings?.all?.['subscriptions'] ?? offerings?.current;
    if (!subOffering) return null;
    const suffix = billingMode === 'yearly' ? 'yearly' : 'monthly';
    return subOffering.availablePackages.find((pkg) => {
      const id = pkg.identifier.toLowerCase();
      return id.includes(planKey) && id.includes(suffix);
    }) ?? null;
  };

  const getPriceForPlan = (planKey: PlanKey): string => {
    const pkg = getPackageForPlan(planKey);
    if (pkg) return pkg.product.priceString;
    const fallbacks: Record<PlanKey, string> = { free: 'Ücretsiz', starter: '₺79/ay', plus: '₺149/ay', pro: '₺299/ay', elite: '₺599/ay' };
    const yearlyFallbacks: Record<PlanKey, string> = { free: 'Ücretsiz', starter: '₺790/yıl', plus: '₺1.490/yıl', pro: '₺2.990/yıl', elite: '₺5.990/yıl' };
    return billingMode === 'yearly' ? yearlyFallbacks[planKey] : fallbacks[planKey];
  };

  const handleSelectPlan = (planKey: PlanKey) => {
    if (planKey === 'free' || planKey === currentPlan) return;
    if (!user) { router.push('/auth'); return; }
    const pkg = getPackageForPlan(planKey);
    if (!pkg) { showToast('Bu paket şu an mevcut değil.'); return; }
    setConfirmPkg(pkg);
  };

  const handleConfirmPurchase = async () => {
    if (!confirmPkg) return;
    setConfirmPkg(null);
    const result = await purchasePackage(confirmPkg);
    if (result) {
      await refreshCustomerInfo();
      void loadData();
      showToast('Satın alma başarılı! Paketiniz aktif edildi.');
    } else {
      showToast('Satın alma iptal edildi veya başarısız oldu.');
    }
  };

  const handleRestore = async () => {
    const result = await restorePurchases();
    if (result) {
      await refreshCustomerInfo();
      void loadData();
      showToast('Satın alımlar geri yüklendi.');
    } else {
      showToast('Geri yükleme tamamlandı.');
    }
  };

  const handleManageSubscription = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('https://apps.apple.com/account/subscriptions').catch(() => showToast('App Store açılamadı.'));
    } else {
      Linking.openURL('https://play.google.com/store/account/subscriptions').catch(() => showToast('Play Store açılamadı.'));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top']}>
      {/* Header */}
      <View style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => router.back()} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 20, color: '#fff' }}>Paketim</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: '#BFDBFE', marginTop: 2 }}>Abonelik ve entitlement yönetimi</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {loading ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: palette.textSecondary, marginTop: 12 }}>Yükleniyor...</Text>
          </View>
        ) : (
          <>
            {/* Current Plan Card */}
            <View style={{ marginHorizontal: 14, marginTop: 16, backgroundColor: palette.card, borderRadius: 16, borderWidth: 1, borderColor: palette.border, padding: 16 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Mevcut Paket</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 10 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: (PLAN_INFO.find((p) => p.key === currentPlan)?.color ?? colors.primary) + '20', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="diamond-outline" size={22} color={PLAN_INFO.find((p) => p.key === currentPlan)?.color ?? colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: palette.textPrimary }}>{getPlanDisplayName(currentPlan as PlanName)}</Text>
                  {subscription?.expires_at ? (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary, marginTop: 2 }}>
                      {subscription.status === 'cancelled' ? 'İptal edildi — ' : 'Yenileme: '}
                      {new Date(subscription.expires_at).toLocaleDateString('tr-TR')}
                    </Text>
                  ) : currentPlan === 'free' ? (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary, marginTop: 2 }}>Ücretsiz plan</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.primary }}>{creditBalance}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textMuted }}>kredi</Text>
                </View>
              </View>

              {entitlement && (
                <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: palette.border, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { label: entitlement.max_active_products >= 999999 ? 'Sınırsız ürün' : `${entitlement.max_active_products} ürün`, icon: 'cube-outline' },
                    { label: entitlement.daily_story_limit >= 999999 ? 'Sınırsız hikaye' : `${entitlement.daily_story_limit}/gün hikaye`, icon: 'play-circle-outline' },
                    { label: entitlement.monthly_credit_grant > 0 ? `${entitlement.monthly_credit_grant}/ay kredi` : 'Aylık kredi yok', icon: 'diamond-outline' },
                    { label: `×${entitlement.discovery_multiplier} keşfet`, icon: 'trending-up-outline' },
                  ].map((item) => (
                    <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: palette.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 }}>
                      <Ionicons name={item.icon as any} size={12} color={colors.primary} />
                      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: palette.textPrimary }}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Billing Mode Toggle */}
            <View style={{ marginHorizontal: 14, marginTop: 16, flexDirection: 'row', backgroundColor: palette.card, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: palette.border }}>
              {(['monthly', 'yearly'] as const).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => setBillingMode(mode)}
                  style={{ flex: 1, paddingVertical: 9, borderRadius: 9, backgroundColor: billingMode === mode ? colors.primary : 'transparent', alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: billingMode === mode ? '#fff' : palette.textSecondary }}>
                    {mode === 'monthly' ? 'Aylık' : 'Yıllık'}
                  </Text>
                  {mode === 'yearly' && (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: billingMode === 'yearly' ? '#BFDBFE' : palette.textMuted, marginTop: 1 }}>2 ay avantajlı</Text>
                  )}
                </Pressable>
              ))}
            </View>

            {/* Plan Cards */}
            <View style={{ marginHorizontal: 14, marginTop: 12, gap: 10 }}>
              {PLAN_INFO.map((plan) => {
                const isCurrent = plan.key === currentPlan;
                const price = getPriceForPlan(plan.key);
                return (
                  <Pressable
                    key={plan.key}
                    onPress={() => handleSelectPlan(plan.key)}
                    style={{
                      backgroundColor: isCurrent ? palette.activeCard : palette.card,
                      borderRadius: 16,
                      borderWidth: isCurrent ? 2 : 1,
                      borderColor: isCurrent ? plan.color : palette.border,
                      padding: 14,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: plan.color + '20', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                        <Ionicons name="diamond-outline" size={18} color={plan.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: palette.textPrimary }}>{plan.label}</Text>
                          {plan.badge && (
                            <View style={{ backgroundColor: plan.color + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                              <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: plan.color }}>{plan.badge}</Text>
                            </View>
                          )}
                          {isCurrent && (
                            <View style={{ backgroundColor: plan.color + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                              <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: plan.color }}>Mevcut Paket</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: plan.color, marginTop: 2 }}>{price}</Text>
                      </View>
                      {!isCurrent && plan.key !== 'free' && (
                        <View style={{ backgroundColor: plan.color, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>Seç</Text>
                        </View>
                      )}
                    </View>

                    <View style={{ marginTop: 12, gap: 5 }}>
                      {[plan.maxProducts, plan.dailyStories, plan.monthlyCredits, plan.discoveryBoost, ...plan.extras].map((item) => (
                        <View key={item} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="checkmark-circle" size={14} color={plan.color} />
                          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary }}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Actions */}
            <View style={{ marginHorizontal: 14, marginTop: 16, gap: 10 }}>
              <Pressable
                onPress={handleRestore}
                disabled={isRestoring}
                style={{ backgroundColor: palette.card, borderRadius: 12, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 10 }}
              >
                {isRestoring ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="refresh-outline" size={18} color={colors.primary} />}
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.primary }}>Satın Alımları Geri Yükle</Text>
              </Pressable>

              {currentPlan !== 'free' && (
                <Pressable
                  onPress={handleManageSubscription}
                  style={{ backgroundColor: palette.card, borderRadius: 12, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                >
                  <Ionicons name="settings-outline" size={18} color={palette.textSecondary} />
                  <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: palette.textSecondary }}>
                    {Platform.OS === 'ios' ? 'App Store\'da Yönet' : 'Play Store\'da Yönet'}
                  </Text>
                </Pressable>
              )}
            </View>

            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textMuted, textAlign: 'center', marginHorizontal: 20, marginTop: 16, lineHeight: 16 }}>
              Abonelikler otomatik yenilenir. İstediğiniz zaman iptal edebilirsiniz.{'\n'}
              Paketin sona ererse ürünler silinmez; limit üstü ürünler yayından kaldırılır.
            </Text>
          </>
        )}
      </ScrollView>

      {/* Purchase Confirm Modal */}
      <Modal visible={!!confirmPkg} transparent animationType="fade" onRequestClose={() => setConfirmPkg(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setConfirmPkg(null)}>
          <View style={{ backgroundColor: palette.card, borderRadius: 22, padding: 24, width: 300, alignItems: 'center' }}>
            <Ionicons name="diamond-outline" size={40} color={colors.primary} />
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: palette.textPrimary, marginTop: 12, textAlign: 'center' }}>Paketi Satın Al</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: palette.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
              {confirmPkg?.product.title}{'\n'}
              <Text style={{ fontFamily: fonts.bold, color: colors.primary }}>{confirmPkg?.product.priceString}</Text>
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' }}>
              <Pressable onPress={() => setConfirmPkg(null)} style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: palette.bg, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: palette.textPrimary }}>İptal</Text>
              </Pressable>
              <Pressable onPress={handleConfirmPurchase} disabled={isPurchasing} style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: isPurchasing ? 0.7 : 1 }}>
                {isPurchasing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>Satın Al</Text>}
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {toast ? (
        <View style={{ position: 'absolute', bottom: 24, left: 16, right: 16, backgroundColor: '#1F2937', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: '#fff', textAlign: 'center' }}>{toast}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
