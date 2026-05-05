import { Pressable, ScrollView, Text, View, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { colors, fonts } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import { fetchMyReports, type ReportRecord, type ReportStatus } from '../src/services/reportService';
import BoxMascot from '../src/components/BoxMascot';

function formatReportTarget(targetType: ReportRecord['targetType']): string {
  if (targetType === 'listing') return 'İlan';
  if (targetType === 'user') return 'Kullanıcı';
  return 'Yorum';
}

function statusMeta(status: ReportStatus) {
  if (status === 'pending') return { label: 'Bekliyor', text: '#92400E', bg: '#FEF3C7' };
  if (status === 'reviewed') return { label: 'İncelendi', text: '#1E40AF', bg: '#DBEAFE' };
  if (status === 'resolved') return { label: 'Çözüldü', text: '#065F46', bg: '#D1FAE5' };
  return { label: 'Reddedildi', text: '#991B1B', bg: '#FEE2E2' };
}

export default function MyReportsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>('all');
  const [reports, setReports] = useState<ReportRecord[]>([]);

  useEffect(() => {
    if (!user) {
      router.replace('/auth');
      return;
    }

    setLoading(true);
    setError('');
    fetchMyReports(200)
      .then((data) => setReports(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Şikayetler yüklenemedi.'))
      .finally(() => setLoading(false));
  }, [router, user]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') {
      return reports;
    }

    return reports.filter((report) => report.status === statusFilter);
  }, [reports, statusFilter]);

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
      <View className="px-4 pt-3 pb-2 flex-row items-center justify-between">
        <Pressable onPress={() => router.back()} className="w-10 h-10 items-center justify-center rounded-full bg-white border border-[#33333315]">
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.textPrimary }}>
          Tüm Şikayetlerim
        </Text>
        <View className="w-10 h-10" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8, flexDirection: 'row' }}>
        {(['all', 'pending', 'reviewed', 'resolved', 'rejected'] as const).map((status) => {
          const active = statusFilter === status;
          const label = status === 'all' ? 'Tümü' : status === 'pending' ? 'Bekleyen' : status === 'reviewed' ? 'İncelendi' : status === 'resolved' ? 'Çözüldü' : 'Reddedildi';
          return (
            <Pressable
              key={status}
              onPress={() => setStatusFilter(status)}
              style={{ backgroundColor: active ? '#DBEAFE' : '#F3F4F6' }}
              className="rounded-full px-3 py-1.5"
            >
              <Text style={{ fontFamily: active ? fonts.bold : fonts.medium, fontSize: 11, color: active ? '#1E40AF' : colors.textSecondary }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        {loading ? (
          <View className="mt-8 items-center justify-center">
            <BoxMascot variant="loading" size={90} animated />
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>
              Şikayetler yükleniyor...
            </Text>
          </View>
        ) : filtered.length > 0 ? (
          <View className="rounded-2xl border border-[#33333315] bg-white p-3">
            {filtered.map((report, index) => {
              const meta = statusMeta(report.status);
              return (
                <View
                  key={report.id}
                  style={{ borderBottomWidth: index < filtered.length - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}
                  className="py-2.5"
                >
                  <View className="flex-row items-center justify-between">
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }}>
                      {formatReportTarget(report.targetType)} • {report.reason}
                    </Text>
                    <View style={{ backgroundColor: meta.bg }} className="rounded-full px-2 py-0.5">
                      <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: meta.text }}>{meta.label}</Text>
                    </View>
                  </View>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                    {new Date(report.createdAt).toLocaleString('tr-TR')}
                  </Text>
                  {report.description ? (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 3 }}>
                      {report.description}
                    </Text>
                  ) : null}
                  {report.reviewNote ? (
                    <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary, marginTop: 3 }}>
                      Not: {report.reviewNote}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <View className="rounded-2xl border border-dashed border-[#D1D5DB] bg-white px-4 py-10 items-center">
            <View style={{ backgroundColor: '#EFF6FF' }} className="w-14 h-14 rounded-full items-center justify-center mb-3">
              <Ionicons name="flag-outline" size={24} color={colors.primary} />
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>
              {statusFilter === 'all' ? 'Şikayet Yok' : 'Sonuç Bulunamadı'}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 6, textAlign: 'center' }}>
              {statusFilter === 'all'
                ? 'Henüz hiç şikayet oluşturmadın.'
                : 'Bu durumda şikayet bulunamadı.'}
            </Text>
          </View>
        )}

        {error ? (
          <View className="mt-3 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2.5">
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: '#991B1B' }}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
