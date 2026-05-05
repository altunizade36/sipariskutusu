import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { getMyCreditTransactions, getMyAllBoosts, getMySubscription, type CreditTransaction, type ActiveBoost } from '../src/services/entitlementService';
import { colors, fonts } from '../src/constants/theme';

type TabKey = 'all' | 'subscriptions' | 'credits' | 'boosts';

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

type BillingEntry = {
  id: string;
  date: string;
  type: 'subscription' | 'credit' | 'boost';
  label: string;
  sublabel?: string;
  amount?: string;
  color: string;
  icon: string;
};

export default function BillingHistoryScreen() {
  const router = useRouter();
  const { isDarkMode } = useAuth();
  const palette = buildPalette(isDarkMode);

  const [tab, setTab] = useState<TabKey>('all');
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<BillingEntry[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tx, boosts, sub] = await Promise.all([
        getMyCreditTransactions(100),
        getMyAllBoosts(100),
        getMySubscription(),
      ]);

      const result: BillingEntry[] = [];

      if (sub) {
        result.push({
          id: sub.id,
          date: sub.created_at,
          type: 'subscription',
          label: `${sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)} Paketi`,
          sublabel: `${sub.billing_period === 'yearly' ? 'Yıllık' : 'Aylık'} — ${sub.status}`,
          color: colors.primary,
          icon: 'diamond-outline',
        });
      }

      for (const t of tx) {
        const isSpend = t.type === 'spend';
        result.push({
          id: t.id,
          date: t.created_at,
          type: 'credit',
          label: t.type === 'purchase' ? 'Kredi Satın Alma' : t.type === 'monthly_grant' ? 'Aylık Kredi' : t.type === 'spend' ? 'Kredi Harcama' : 'Kredi İşlemi',
          sublabel: t.reason ?? t.product_id ?? undefined,
          amount: `${t.amount > 0 ? '+' : ''}${t.amount} kredi`,
          color: isSpend ? '#EF4444' : '#8B5CF6',
          icon: isSpend ? 'remove-circle-outline' : 'add-circle-outline',
        });
      }

      for (const b of boosts) {
        result.push({
          id: b.id,
          date: b.created_at,
          type: 'boost',
          label: boostLabel(b.type),
          sublabel: new Date(b.starts_at).toLocaleDateString('tr-TR') + ' — ' + new Date(b.ends_at).toLocaleDateString('tr-TR'),
          amount: `-${b.credit_cost} kredi`,
          color: '#F59E0B',
          icon: 'flash-outline',
        });
      }

      result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEntries(result);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const filtered = entries.filter((e) => tab === 'all' || e.type === tab.replace('s', '').replace('credit', 'credit').replace('subscription', 'subscription').replace('boost', 'boost') || (tab === 'subscriptions' && e.type === 'subscription') || (tab === 'credits' && e.type === 'credit') || (tab === 'boosts' && e.type === 'boost'));

  const filteredEntries = tab === 'all' ? entries : entries.filter((e) => {
    if (tab === 'subscriptions') return e.type === 'subscription';
    if (tab === 'credits') return e.type === 'credit';
    if (tab === 'boosts') return e.type === 'boost';
    return true;
  });

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'Tümü' },
    { key: 'subscriptions', label: 'Abonelik' },
    { key: 'credits', label: 'Kredi' },
    { key: 'boosts', label: 'Boost' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top']}>
      <View style={{ backgroundColor: '#0EA5E9', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => router.back()} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 20, color: '#fff' }}>İşlem Geçmişi</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: '#BAE6FD', marginTop: 2 }}>Abonelik, kredi ve boost harcamaları</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: palette.card, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        {tabs.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={{ flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: tab === t.key ? '#0EA5E9' : 'transparent' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: tab === t.key ? '#0EA5E9' : palette.textSecondary }}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
        {loading ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <ActivityIndicator size="large" color="#0EA5E9" />
          </View>
        ) : filteredEntries.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#0EA5E920', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="receipt-outline" size={36} color="#0EA5E9" />
            </View>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: palette.textPrimary, textAlign: 'center' }}>İşlem bulunamadı</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: palette.textSecondary, marginTop: 8, textAlign: 'center' }}>
              Bu kategoride henüz bir işleminiz yok.
            </Text>
          </View>
        ) : (
          <View style={{ backgroundColor: palette.card, borderRadius: 14, borderWidth: 1, borderColor: palette.border, overflow: 'hidden' }}>
            {filteredEntries.map((entry, i) => (
              <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: i < filteredEntries.length - 1 ? 1 : 0, borderBottomColor: palette.border, gap: 12 }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: entry.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={entry.icon as any} size={18} color={entry.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: palette.textPrimary }}>{entry.label}</Text>
                  {entry.sublabel && (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textMuted, marginTop: 1 }} numberOfLines={1}>{entry.sublabel}</Text>
                  )}
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textMuted, marginTop: 1 }}>
                    {new Date(entry.date).toLocaleString('tr-TR')}
                  </Text>
                </View>
                {entry.amount && (
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: entry.color }}>{entry.amount}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function boostLabel(type: string): string {
  const labels: Record<string, string> = {
    product_feature:   'Ürün Öne Çıkar',
    story_boost:       'Hikaye Boost',
    category_top:      'Kategori Üst Sıra',
    discovery_boost:   'Keşfete Çıkar',
    store_feature:     'Mağaza Öne Çıkar',
    homepage_showcase: 'Ana Sayfa Vitrin',
    product_slot_5:    '+5 Ürün Slotu',
    product_slot_10:   '+10 Ürün Slotu',
    product_slot_25:   '+25 Ürün Slotu',
  };
  return labels[type] ?? type;
}
