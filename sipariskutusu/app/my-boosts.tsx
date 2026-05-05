import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { getMyAllBoosts, type ActiveBoost } from '../src/services/entitlementService';
import { colors, fonts } from '../src/constants/theme';

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

function boostIcon(type: string): string {
  const icons: Record<string, string> = {
    product_feature:   'star-outline',
    story_boost:       'play-circle-outline',
    category_top:      'podium-outline',
    discovery_boost:   'compass-outline',
    store_feature:     'storefront-outline',
    homepage_showcase: 'home-outline',
    product_slot_5:    'cube-outline',
    product_slot_10:   'cube-outline',
    product_slot_25:   'cube-outline',
  };
  return icons[type] ?? 'flash-outline';
}

function boostColor(type: string): string {
  const c: Record<string, string> = {
    product_feature:   '#F59E0B',
    story_boost:       '#3B82F6',
    category_top:      '#8B5CF6',
    discovery_boost:   '#EC4899',
    store_feature:     '#10B981',
    homepage_showcase: '#EF4444',
    product_slot_5:    '#0EA5E9',
    product_slot_10:   '#0EA5E9',
    product_slot_25:   '#0EA5E9',
  };
  return c[type] ?? '#6B7280';
}

function formatRemaining(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Sona erdi';
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours >= 24) return `${Math.floor(hours / 24)}g ${hours % 24}s kaldı`;
  if (hours > 0) return `${hours}s ${mins}d kaldı`;
  return `${mins}d kaldı`;
}

export default function MyBoostsScreen() {
  const router = useRouter();
  const { isDarkMode } = useAuth();
  const palette = buildPalette(isDarkMode);

  const [boosts, setBoosts] = useState<ActiveBoost[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'all'>('active');

  const loadBoosts = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getMyAllBoosts(60);
      setBoosts(all);
    } catch {
      setBoosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadBoosts(); }, [loadBoosts]);

  const now = new Date().toISOString();
  const activeBoosts = boosts.filter((b) => b.is_active && b.ends_at > now);
  const pastBoosts = boosts.filter((b) => !b.is_active || b.ends_at <= now);
  const displayBoosts = tab === 'active' ? activeBoosts : boosts;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top']}>
      <View style={{ backgroundColor: '#F59E0B', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => router.back()} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 20, color: '#fff' }}>Boostlarım</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: '#FEF3C7', marginTop: 2 }}>Aktif boostlar ve geçmiş</Text>
        </View>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{activeBoosts.length} aktif</Text>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={{ flexDirection: 'row', backgroundColor: palette.card, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        {(['active', 'all'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: tab === t ? '#F59E0B' : 'transparent' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: tab === t ? '#F59E0B' : palette.textSecondary }}>
              {t === 'active' ? `Aktif (${activeBoosts.length})` : `Tümü (${boosts.length})`}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
        {loading ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <ActivityIndicator size="large" color="#F59E0B" />
          </View>
        ) : displayBoosts.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#F59E0B20', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="flash-outline" size={36} color="#F59E0B" />
            </View>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: palette.textPrimary, textAlign: 'center' }}>
              {tab === 'active' ? 'Aktif boost yok' : 'Henüz boost kullanmadınız'}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: palette.textSecondary, marginTop: 8, textAlign: 'center' }}>
              Kredilerinizi kullanarak ürünlerinizi ve mağazanızı öne çıkarın.
            </Text>
            <Pressable
              onPress={() => router.push('/credits' as never)}
              style={{ marginTop: 20, backgroundColor: '#F59E0B', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>Kredi Satın Al</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {displayBoosts.map((boost) => {
              const isActive = boost.is_active && boost.ends_at > now;
              const color = boostColor(boost.type);
              return (
                <View
                  key={boost.id}
                  style={{ backgroundColor: palette.card, borderRadius: 14, borderWidth: 1, borderColor: isActive ? color + '40' : palette.border, padding: 14 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={boostIcon(boost.type) as any} size={20} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: palette.textPrimary }}>{boostLabel(boost.type)}</Text>
                        <View style={{ backgroundColor: isActive ? color + '20' : palette.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: isActive ? color : palette.textMuted }}>
                            {isActive ? 'AKTİF' : 'SONA ERDİ'}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary, marginTop: 2 }}>
                        {new Date(boost.starts_at).toLocaleString('tr-TR')} — {new Date(boost.ends_at).toLocaleString('tr-TR')}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: color }}>{boost.credit_cost}</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: palette.textMuted }}>kredi</Text>
                    </View>
                  </View>
                  {isActive && (
                    <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: palette.border, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="time-outline" size={13} color={color} />
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: color }}>{formatRemaining(boost.ends_at)}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
