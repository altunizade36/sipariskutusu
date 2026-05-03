import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useSubscription } from '../src/lib/revenuecat';
import {
  getMyWallet,
  getMyCreditTransactions,
  type CreditWallet,
  type CreditTransaction,
} from '../src/services/entitlementService';
import { colors, fonts } from '../src/constants/theme';
import type { PurchasesPackage } from 'react-native-purchases';

type CreditPackageInfo = {
  credits: number;
  label: string;
  popular?: boolean;
  priceKey: string;
};

const CREDIT_PACKAGE_INFO: Record<string, CreditPackageInfo> = {
  '30':   { credits: 30,   label: '30 Kredi',   priceKey: '30' },
  '80':   { credits: 80,   label: '80 Kredi',   popular: false, priceKey: '80' },
  '180':  { credits: 180,  label: '180 Kredi',  popular: true,  priceKey: '180' },
  '420':  { credits: 420,  label: '420 Kredi',  popular: false, priceKey: '420' },
  '1000': { credits: 1000, label: '1000 Kredi', popular: false, priceKey: '1000' },
};

const CREDIT_FALLBACK_PRICES: Record<string, string> = {
  '30': '₺39', '80': '₺79', '180': '₺149', '420': '₺299', '1000': '₺599',
};

function buildPalette(isDarkMode: boolean) {
  return {
    bg: isDarkMode ? '#0F172A' : '#F2F3F7',
    card: isDarkMode ? '#111827' : '#FFFFFF',
    border: isDarkMode ? '#1E293B' : '#E5E7EB',
    textPrimary: isDarkMode ? '#E5E7EB' : '#111827',
    textSecondary: isDarkMode ? '#94A3B8' : '#6B7280',
    textMuted: isDarkMode ? '#4B5563' : '#9CA3AF',
  };
}

function formatTransactionType(type: string): { label: string; color: string; icon: string } {
  if (type === 'purchase')      return { label: 'Satın Alma',     color: '#10B981', icon: 'add-circle-outline' };
  if (type === 'monthly_grant') return { label: 'Aylık Kredi',    color: '#3B82F6', icon: 'gift-outline' };
  if (type === 'spend')         return { label: 'Harcama',        color: '#EF4444', icon: 'remove-circle-outline' };
  if (type === 'refund')        return { label: 'İade',           color: '#F59E0B', icon: 'refresh-outline' };
  return { label: type,                                            color: '#6B7280', icon: 'ellipse-outline' };
}

export default function CreditsScreen() {
  const router = useRouter();
  const { isDarkMode, user } = useAuth();
  const { offerings, isPurchasing, purchasePackage, refreshCustomerInfo } = useSubscription();
  const palette = buildPalette(isDarkMode);

  const [wallet, setWallet] = useState<CreditWallet | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmPkg, setConfirmPkg] = useState<PurchasesPackage | null>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [w, tx] = await Promise.all([getMyWallet(), getMyCreditTransactions(30)]);
      setWallet(w);
      setTransactions(tx);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const getCreditPackages = (): { pkg: PurchasesPackage; info: CreditPackageInfo }[] => {
    const creditOffering = offerings?.all?.['credits'] ?? null;
    if (!creditOffering) return [];
    return creditOffering.availablePackages
      .map((pkg) => {
        const key = pkg.identifier.replace(/^credits?[-_]?/, '').replace(/^com\.sipariskutusu\.credits\./, '');
        const info = CREDIT_PACKAGE_INFO[key];
        if (!info) return null;
        return { pkg, info };
      })
      .filter(Boolean) as { pkg: PurchasesPackage; info: CreditPackageInfo }[];
  };

  const creditPackages = getCreditPackages();

  const handleBuyCredits = (pkg: PurchasesPackage) => {
    if (!user) { router.push('/auth'); return; }
    setConfirmPkg(pkg);
  };

  const handleConfirmPurchase = async () => {
    if (!confirmPkg) return;
    setConfirmPkg(null);
    const result = await purchasePackage(confirmPkg);
    if (result) {
      await refreshCustomerInfo();
      showToast('Kredi satın alma işleniyor. Birkaç saniye içinde bakiyene yansır.');
      setTimeout(() => { void loadData(); }, 3000);
    } else {
      showToast('Satın alma iptal edildi veya başarısız oldu.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top']}>
      {/* Header */}
      <View style={{ backgroundColor: '#8B5CF6', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => router.back()} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 20, color: '#fff' }}>Kredilerim</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: '#DDD6FE', marginTop: 2 }}>Kredi satın al ve harca</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {loading ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <ActivityIndicator size="large" color="#8B5CF6" />
          </View>
        ) : (
          <>
            {/* Balance Card */}
            <View style={{ marginHorizontal: 14, marginTop: 16, backgroundColor: palette.card, borderRadius: 16, borderWidth: 1, borderColor: palette.border, padding: 20, alignItems: 'center' }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#8B5CF620', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Ionicons name="diamond" size={28} color="#8B5CF6" />
              </View>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 36, color: palette.textPrimary }}>{wallet?.balance ?? 0}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: palette.textSecondary, marginTop: 2 }}>Mevcut Kredi</Text>
              <View style={{ flexDirection: 'row', gap: 24, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: palette.border, width: '100%', justifyContent: 'center' }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#10B981' }}>{wallet?.lifetime_purchased ?? 0}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textMuted }}>Toplam Alınan</Text>
                </View>
                <View style={{ width: 1, backgroundColor: palette.border }} />
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#EF4444' }}>{wallet?.lifetime_spent ?? 0}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textMuted }}>Toplam Harcanan</Text>
                </View>
              </View>
            </View>

            {/* Credit Packages */}
            <View style={{ marginHorizontal: 14, marginTop: 18 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Kredi Paketleri</Text>
              <View style={{ gap: 10 }}>
                {creditPackages.length > 0 ? creditPackages.map(({ pkg, info }) => (
                  <Pressable
                    key={pkg.identifier}
                    onPress={() => handleBuyCredits(pkg)}
                    style={{ backgroundColor: palette.card, borderRadius: 14, borderWidth: info.popular ? 2 : 1, borderColor: info.popular ? '#8B5CF6' : palette.border, padding: 14, flexDirection: 'row', alignItems: 'center' }}
                  >
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#8B5CF620', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Ionicons name="diamond" size={20} color="#8B5CF6" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: palette.textPrimary }}>{info.label}</Text>
                        {info.popular && (
                          <View style={{ backgroundColor: '#8B5CF620', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: '#8B5CF6' }}>En Popüler</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#8B5CF6', marginTop: 2 }}>{pkg.product.priceString}</Text>
                    </View>
                    <View style={{ backgroundColor: '#8B5CF6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>Satın Al</Text>
                    </View>
                  </Pressable>
                )) : (
                  /* Fallback when RC offerings not loaded */
                  Object.entries(CREDIT_PACKAGE_INFO).map(([key, info]) => (
                    <View
                      key={key}
                      style={{ backgroundColor: palette.card, borderRadius: 14, borderWidth: info.popular ? 2 : 1, borderColor: info.popular ? '#8B5CF6' : palette.border, padding: 14, flexDirection: 'row', alignItems: 'center', opacity: 0.6 }}
                    >
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#8B5CF620', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Ionicons name="diamond" size={20} color="#8B5CF6" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: palette.textPrimary }}>{info.label}</Text>
                          {info.popular && (
                            <View style={{ backgroundColor: '#8B5CF620', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                              <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: '#8B5CF6' }}>En Popüler</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#8B5CF6', marginTop: 2 }}>{CREDIT_FALLBACK_PRICES[key]}</Text>
                      </View>
                      <View style={{ backgroundColor: '#8B5CF660', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>Yükleniyor</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* Credit Usage Info */}
            <View style={{ marginHorizontal: 14, marginTop: 18, backgroundColor: palette.card, borderRadius: 14, borderWidth: 1, borderColor: palette.border, padding: 14 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Kredi Kullanım Alanları</Text>
              {[
                { label: 'Ürün Öne Çıkar', cost: '5 kredi / 24 saat', icon: 'star-outline' },
                { label: 'Hikaye Boost', cost: '3 kredi / 24 saat', icon: 'play-circle-outline' },
                { label: 'Kategori Üst Sıra', cost: '8 kredi / 24 saat', icon: 'podium-outline' },
                { label: 'Keşfete Çıkar', cost: '12 kredi / 24 saat', icon: 'compass-outline' },
                { label: 'Mağaza Öne Çıkar', cost: '20 kredi / 3 gün', icon: 'storefront-outline' },
                { label: 'Ana Sayfa Vitrin', cost: '40 kredi / 24 saat', icon: 'home-outline' },
              ].map((item, i, arr) => (
                <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: palette.border }}>
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#8B5CF620', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={item.icon as any} size={14} color="#8B5CF6" />
                  </View>
                  <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: palette.textPrimary }}>{item.label}</Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#8B5CF6' }}>{item.cost}</Text>
                </View>
              ))}
            </View>

            {/* Transaction History */}
            {transactions.length > 0 && (
              <View style={{ marginHorizontal: 14, marginTop: 18 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Son İşlemler</Text>
                <View style={{ backgroundColor: palette.card, borderRadius: 14, borderWidth: 1, borderColor: palette.border, overflow: 'hidden' }}>
                  {transactions.slice(0, 15).map((tx, i) => {
                    const fmt = formatTransactionType(tx.type);
                    return (
                      <View key={tx.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: i < transactions.length - 1 ? 1 : 0, borderBottomColor: palette.border, gap: 10 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: fmt.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={fmt.icon as any} size={15} color={fmt.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: palette.textPrimary }}>{fmt.label}</Text>
                          {tx.reason ? <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textMuted, marginTop: 1 }} numberOfLines={1}>{tx.reason}</Text> : null}
                          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textMuted, marginTop: 1 }}>{new Date(tx.created_at).toLocaleString('tr-TR')}</Text>
                        </View>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: tx.amount > 0 ? '#10B981' : '#EF4444' }}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Purchase Confirm Modal */}
      <Modal visible={!!confirmPkg} transparent animationType="fade" onRequestClose={() => setConfirmPkg(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setConfirmPkg(null)}>
          <View style={{ backgroundColor: palette.card, borderRadius: 22, padding: 24, width: 300, alignItems: 'center' }}>
            <Ionicons name="diamond" size={40} color="#8B5CF6" />
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: palette.textPrimary, marginTop: 12, textAlign: 'center' }}>Kredi Satın Al</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: palette.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
              {confirmPkg?.product.title}{'\n'}
              <Text style={{ fontFamily: fonts.bold, color: '#8B5CF6' }}>{confirmPkg?.product.priceString}</Text>
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textMuted, marginTop: 8, textAlign: 'center' }}>
              Satın alma sonrası kredi birkaç saniye içinde bakiyene yansır.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' }}>
              <Pressable onPress={() => setConfirmPkg(null)} style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: palette.bg, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: palette.textPrimary }}>İptal</Text>
              </Pressable>
              <Pressable onPress={handleConfirmPurchase} disabled={isPurchasing} style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: '#8B5CF6', alignItems: 'center', justifyContent: 'center', opacity: isPurchasing ? 0.7 : 1 }}>
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
