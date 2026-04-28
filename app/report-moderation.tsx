import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { colors, fonts } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import { fetchMyProfile } from '../src/services/profileService';
import {
  fetchReportActionsAdmin,
  fetchReportReasonStatsAdmin,
  fetchReportsAdmin,
  resolveReportTargetContextAdmin,
  reviewReportAdmin,
  type ReportAction,
  type ReportReasonStat,
  type ReportRecord,
  type ReportStatus,
} from '../src/services/reportService';

function reportStatusMeta(status: ReportStatus) {
  if (status === 'pending') return { label: 'Bekliyor', text: '#92400E', bg: '#FEF3C7' };
  if (status === 'reviewed') return { label: 'İncelendi', text: '#1E40AF', bg: '#DBEAFE' };
  if (status === 'resolved') return { label: 'Çözüldü', text: '#065F46', bg: '#D1FAE5' };
  return { label: 'Reddedildi', text: '#991B1B', bg: '#FEE2E2' };
}

function reportTargetLabel(targetType: ReportRecord['targetType']) {
  if (targetType === 'listing') return 'İlan';
  if (targetType === 'user') return 'Kullanıcı';
  return 'Yorum';
}

export default function ReportModerationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>('pending');
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [stats, setStats] = useState<ReportReasonStat[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [actions, setActions] = useState<ReportAction[]>([]);
  const [busyReportId, setBusyReportId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const profile = await fetchMyProfile();
      const admin = profile?.role === 'admin';
      setIsAdmin(admin);

      if (!admin) {
        setReports([]);
        setStats([]);
        return;
      }

      const [nextReports, nextStats] = await Promise.all([
        fetchReportsAdmin({ status: statusFilter === 'all' ? undefined : statusFilter, limit: 120 }),
        fetchReportReasonStatsAdmin(30, 10),
      ]);

      setReports(nextReports);
      setStats(nextStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Moderasyon verileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (!user) {
      router.replace('/auth');
      return;
    }

    loadData();
  }, [loadData, router, user]);

  const pendingCount = useMemo(
    () => reports.filter((report) => report.status === 'pending').length,
    [reports],
  );

  async function handleDecision(reportId: string, status: Exclude<ReportStatus, 'pending'>) {
    setBusyReportId(reportId);
    setError('');
    try {
      await reviewReportAdmin(reportId, status, status === 'rejected' ? 'Admin reddi.' : 'Admin inceleme sonucu.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Şikayet güncellenemedi.');
    } finally {
      setBusyReportId(null);
    }
  }

  async function loadActions(reportId: string) {
    setActionsLoading(true);
    setError('');
    try {
      const next = await fetchReportActionsAdmin(reportId, 50);
      setActions(next);
      setSelectedReportId(reportId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Şikayet geçmişi alınamadı.');
    } finally {
      setActionsLoading(false);
    }
  }

  async function openReportTarget(report: ReportRecord) {
    try {
      const context = await resolveReportTargetContextAdmin(report);
      if (context.listingId) {
        router.push(`/product/${context.listingId}`);
        return;
      }

      if (context.userId) {
        router.push(`/(tabs)/store?sellerId=${encodeURIComponent(context.userId)}`);
        return;
      }

      setError('Hedefe gitmek için yeterli bağlam bulunamadı.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hedef ekran açılamadı.');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
      <View className="px-4 pt-3 pb-2 flex-row items-center justify-between">
        <Pressable onPress={() => router.back()} className="w-10 h-10 items-center justify-center rounded-full bg-white border border-[#33333315]">
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.textPrimary }}>
          Şikayet Moderasyonu
        </Text>
        <View className="w-10 h-10" />
      </View>

      {!isAdmin && !loading ? (
        <View className="mx-4 mt-3 rounded-2xl border border-[#FCA5A5] bg-[#FEF2F2] p-4">
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#991B1B' }}>
            Bu ekran yalnızca admin kullanıcılar için erişilebilir.
          </Text>
        </View>
      ) : null}

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        {loading ? (
          <View className="mt-8 items-center justify-center">
            <ActivityIndicator color={colors.primary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>
              Moderasyon verileri yükleniyor...
            </Text>
          </View>
        ) : isAdmin ? (
          <>
            <View className="rounded-2xl border border-[#33333315] bg-white p-3">
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>
                Son 30 Gün Neden Dağılımı
              </Text>
              {stats.length > 0 ? (
                <View className="mt-2">
                  {stats.map((row) => (
                    <View key={row.reason} className="py-2 border-b border-[#33333315] last:border-b-0">
                      <View className="flex-row items-center justify-between">
                        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textPrimary }}>{row.reason}</Text>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }}>{row.totalCount}</Text>
                      </View>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                        Bekleyen {row.pendingCount} • Çözüldü {row.resolvedCount} • Reddedildi {row.rejectedCount}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>
                  İstatistik verisi bulunamadı.
                </Text>
              )}
            </View>

            <View className="mt-4 rounded-2xl border border-[#33333315] bg-white p-3">
              <View className="flex-row items-center justify-between">
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>
                  Şikayet Kuyruğu
                </Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary }}>
                  {pendingCount} bekleyen
                </Text>
              </View>

              <View className="mt-2 flex-row" style={{ gap: 8 }}>
                {(['pending', 'reviewed', 'resolved', 'rejected', 'all'] as const).map((status) => {
                  const active = statusFilter === status;
                  return (
                    <Pressable
                      key={status}
                      onPress={() => setStatusFilter(status)}
                      style={{
                        backgroundColor: active ? '#DBEAFE' : '#F3F4F6',
                      }}
                      className="rounded-full px-3 py-1.5"
                    >
                      <Text style={{ fontFamily: active ? fonts.bold : fonts.medium, fontSize: 11, color: active ? '#1E40AF' : colors.textSecondary }}>
                        {status === 'pending' ? 'Bekleyen' : status === 'reviewed' ? 'İncelendi' : status === 'resolved' ? 'Çözüldü' : status === 'rejected' ? 'Reddedildi' : 'Tümü'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View className="mt-2">
                {reports.length > 0 ? reports.map((report) => {
                  const meta = reportStatusMeta(report.status);
                  return (
                    <View key={report.id} className="py-3 border-b border-[#33333315] last:border-b-0">
                      <View className="flex-row items-center justify-between">
                        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }}>
                          {reportTargetLabel(report.targetType)} • {report.reason}
                        </Text>
                        <View style={{ backgroundColor: meta.bg }} className="rounded-full px-2 py-0.5">
                          <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: meta.text }}>{meta.label}</Text>
                        </View>
                      </View>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 3 }}>
                        {new Date(report.createdAt).toLocaleString('tr-TR')}
                      </Text>
                      {report.description ? (
                        <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 3 }}>
                          {report.description}
                        </Text>
                      ) : null}
                      <View className="mt-2">
                        <View className="flex-row" style={{ gap: 8 }}>
                          <Pressable onPress={() => loadActions(report.id)} className="self-start rounded-lg border border-[#D1D5DB] bg-[#F9FAFB] px-3 py-1.5">
                            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary }}>Geçmişi Gör</Text>
                          </Pressable>
                          <Pressable onPress={() => openReportTarget(report)} className="self-start rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1.5">
                            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: '#1E40AF' }}>Hedefe Git</Text>
                          </Pressable>
                        </View>
                      </View>
                      {report.status === 'pending' ? (
                        <View className="flex-row mt-3" style={{ gap: 8 }}>
                          <Pressable disabled={busyReportId === report.id} onPress={() => handleDecision(report.id, 'reviewed')} className="rounded-lg border border-[#93C5FD] bg-[#EFF6FF] px-3 py-1.5">
                            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#1E40AF' }}>İncelendi</Text>
                          </Pressable>
                          <Pressable disabled={busyReportId === report.id} onPress={() => handleDecision(report.id, 'resolved')} className="rounded-lg border border-[#86EFAC] bg-[#ECFDF5] px-3 py-1.5">
                            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#065F46' }}>Çözüldü</Text>
                          </Pressable>
                          <Pressable disabled={busyReportId === report.id} onPress={() => handleDecision(report.id, 'rejected')} className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-1.5">
                            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#991B1B' }}>Reddet</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  );
                }) : (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>
                    Bu filtrede şikayet bulunmuyor.
                  </Text>
                )}
              </View>
            </View>

            <View className="mt-4 rounded-2xl border border-[#33333315] bg-white p-3">
              <View className="flex-row items-center justify-between">
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>
                  İşlem Geçmişi
                </Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary }}>
                  {selectedReportId ? selectedReportId.slice(0, 8) : 'Rapor seç'}
                </Text>
              </View>
              {actionsLoading ? (
                <View className="mt-3 flex-row items-center">
                  <ActivityIndicator color={colors.primary} size="small" />
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginLeft: 8 }}>
                    Geçmiş yükleniyor...
                  </Text>
                </View>
              ) : actions.length > 0 ? (
                <View className="mt-2">
                  {actions.map((action) => (
                    <View key={action.id} className="py-2 border-b border-[#33333315] last:border-b-0">
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }}>
                        {action.actionType.toUpperCase()} • {new Date(action.createdAt).toLocaleString('tr-TR')}
                      </Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                        {action.previousStatus ?? 'null'} → {action.nextStatus}
                      </Text>
                      {action.note ? (
                        <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                          {action.note}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>
                  Geçmiş görmek için bir rapor seç.
                </Text>
              )}
            </View>

            {error ? (
              <View className="mt-3 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2.5">
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: '#991B1B' }}>{error}</Text>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
