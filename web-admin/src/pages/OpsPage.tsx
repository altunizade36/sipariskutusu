import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type CheckState = 'ok' | 'warn' | 'fail';

interface OpsSnapshot {
  pendingListings: number;
  openReports: number;
  hiddenComments: number;
  bannedUsers: number;
  totalUsers: number;
  totalListings: number;
  activeListings: number;
  totalStores: number;
  activeStores: number;
  newUsersToday: number;
  newListingsToday: number;
  unverifiedStores: number;
  checkedAt: string;
}

interface HealthRow {
  title: string;
  state: CheckState;
  detail: string;
  action?: string;
  actionLink?: string;
}

function StatCard({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div className="metric-card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="metric-label">{label}</div>
      <div className="metric-val" style={{ color }}>{typeof value === 'number' ? value.toLocaleString('tr-TR') : value}</div>
      {sub && <div className="metric-foot">{sub}</div>}
    </div>
  );
}

export default function OpsPage() {
  const [snapshot, setSnapshot] = useState<OpsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [liveMode, setLiveMode] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [
      { count: pendingListings, error: e1 },
      { count: openReports, error: e2 },
      { count: hiddenComments },
      { count: bannedUsers },
      { count: totalUsers },
      { count: totalListings },
      { count: activeListings },
      { count: totalStores },
      { count: activeStores },
      { count: newUsersToday },
      { count: newListingsToday },
      { count: unverifiedStores },
    ] = await Promise.all([
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('listing_comments').select('*', { count: 'exact', head: true }).eq('is_hidden', true),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_banned', true),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('listings').select('*', { count: 'exact', head: true }),
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('stores').select('*', { count: 'exact', head: true }),
      supabase.from('stores').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      supabase.from('listings').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      supabase.from('stores').select('*', { count: 'exact', head: true }).eq('is_verified', false),
    ]);

    if (e1 || e2) {
      setError((e1 ?? e2)?.message ?? 'Bilinmeyen hata');
      setLoading(false);
      return;
    }

    setSnapshot({
      pendingListings: pendingListings ?? 0,
      openReports: openReports ?? 0,
      hiddenComments: hiddenComments ?? 0,
      bannedUsers: bannedUsers ?? 0,
      totalUsers: totalUsers ?? 0,
      totalListings: totalListings ?? 0,
      activeListings: activeListings ?? 0,
      totalStores: totalStores ?? 0,
      activeStores: activeStores ?? 0,
      newUsersToday: newUsersToday ?? 0,
      newListingsToday: newListingsToday ?? 0,
      unverifiedStores: unverifiedStores ?? 0,
      checkedAt: new Date().toISOString(),
    });
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!liveMode) return;
    const ch = supabase.channel('ops-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listing_comments' }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [liveMode, load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => { void load(); }, 15_000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  const healthRows = useMemo<HealthRow[]>(() => {
    if (!snapshot) return [
      { title: 'Veri bağlantısı', state: 'warn', detail: 'Kontrol bekleniyor' },
    ];

    const moderationLoad = snapshot.pendingListings + snapshot.openReports;
    const activeRatio = snapshot.totalListings > 0
      ? (snapshot.activeListings / snapshot.totalListings) * 100 : 0;
    const storeActiveRatio = snapshot.totalStores > 0
      ? (snapshot.activeStores / snapshot.totalStores) * 100 : 0;

    return [
      {
        title: 'Veri bağlantısı',
        state: error ? 'fail' : 'ok',
        detail: error ? `Supabase hatası: ${error}` : 'Supabase sorgular yanıt veriyor',
      },
      {
        title: 'Moderasyon kuyruğu',
        state: moderationLoad > 50 ? 'fail' : moderationLoad > 20 ? 'warn' : 'ok',
        detail: moderationLoad > 20
          ? `Yüksek yük: ${snapshot.pendingListings} ilan + ${snapshot.openReports} şikayet bekliyor`
          : `Kuyruk kontrol altında (${moderationLoad} bekleyen)`,
        action: moderationLoad > 0 ? 'Moderasyona Git' : undefined,
        actionLink: '/listings',
      },
      {
        title: 'Aktif ilan oranı',
        state: activeRatio < 30 ? 'warn' : 'ok',
        detail: `${snapshot.activeListings.toLocaleString('tr-TR')} aktif / ${snapshot.totalListings.toLocaleString('tr-TR')} toplam (%${activeRatio.toFixed(1)})`,
      },
      {
        title: 'Mağaza aktiflik oranı',
        state: storeActiveRatio < 50 ? 'warn' : 'ok',
        detail: `${snapshot.activeStores.toLocaleString('tr-TR')} aktif / ${snapshot.totalStores.toLocaleString('tr-TR')} toplam (%${storeActiveRatio.toFixed(1)})`,
      },
      {
        title: 'Gizli yorum durumu',
        state: snapshot.hiddenComments > 200 ? 'warn' : 'ok',
        detail: snapshot.hiddenComments > 100
          ? `Yüksek: ${snapshot.hiddenComments.toLocaleString('tr-TR')} gizli yorum`
          : `Normal: ${snapshot.hiddenComments.toLocaleString('tr-TR')} gizli yorum`,
        action: snapshot.hiddenComments > 0 ? 'Yorumlara Git' : undefined,
        actionLink: '/comments',
      },
      {
        title: 'Kullanıcı yasakları',
        state: snapshot.bannedUsers > 100 ? 'warn' : 'ok',
        detail: `${snapshot.bannedUsers.toLocaleString('tr-TR')} yasaklı hesap (${snapshot.totalUsers > 0 ? ((snapshot.bannedUsers / snapshot.totalUsers) * 100).toFixed(2) : 0}% oran)`,
      },
      {
        title: 'Onaysız mağazalar',
        state: snapshot.unverifiedStores > 50 ? 'warn' : 'ok',
        detail: `${snapshot.unverifiedStores.toLocaleString('tr-TR')} mağaza satıcı onayı bekliyor`,
        action: snapshot.unverifiedStores > 0 ? 'Mağazalara Git' : undefined,
        actionLink: '/stores',
      },
      {
        title: 'Açık şikayetler',
        state: snapshot.openReports > 30 ? 'fail' : snapshot.openReports > 10 ? 'warn' : 'ok',
        detail: snapshot.openReports > 0
          ? `${snapshot.openReports.toLocaleString('tr-TR')} şikayet çözüm bekliyor`
          : 'Tüm şikayetler çözüldü',
        action: snapshot.openReports > 0 ? 'Şikayetlere Git' : undefined,
        actionLink: '/reports',
      },
    ];
  }, [snapshot, error]);

  const systemScore = useMemo(() => {
    const issues = healthRows.filter(r => r.state !== 'ok').length;
    const total = healthRows.length;
    return total > 0 ? Math.round(((total - issues) / total) * 100) : 100;
  }, [healthRows]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Operasyon Kontrol Merkezi</h1>
          <p className="page-sub">Tüm kritik sinyaller tek ekranda — canlı takip ve anlık müdahale</p>
        </div>
        <div className="header-actions">
          <button className={`btn ${liveMode ? 'btn-success' : 'btn-ghost'}`} onClick={() => setLiveMode(v => !v)}>
            {liveMode ? '● Canlı' : '○ Canlı Kapalı'}
          </button>
          <button className={`btn ${autoRefresh ? 'btn-success' : 'btn-ghost'}`} onClick={() => setAutoRefresh(v => !v)}>
            {autoRefresh ? '⟳ 15s' : '⟳ Durduruldu'}
          </button>
          <button className="btn btn-primary" onClick={() => void load()} disabled={loading}>Yenile</button>
        </div>
      </div>

      {snapshot && (
        <div style={{ marginBottom: 16 }}>
          <span className="badge badge-open" style={{ marginRight: 8 }}>
            Son kontrol: {new Date(snapshot.checkedAt).toLocaleTimeString('tr-TR')}
          </span>
          <span className={`badge ${systemScore >= 90 ? 'badge-active' : systemScore >= 70 ? 'badge-pending' : 'badge-rejected'}`}>
            Sistem Skoru: {systemScore}/100
          </span>
        </div>
      )}

      {error && <div className="error-msg" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        <StatCard label="Bugün Yeni Kullanıcı" value={snapshot?.newUsersToday ?? '-'} color="#2563eb" sub="günlük kayıt" />
        <StatCard label="Bugün Yeni İlan" value={snapshot?.newListingsToday ?? '-'} color="#16a34a" sub="günlük ilan" />
        <StatCard label="Onay Bekleyen İlan" value={snapshot?.pendingListings ?? '-'} color="#d97706" sub="moderasyon" />
        <StatCard label="Açık Şikayet" value={snapshot?.openReports ?? '-'} color="#dc2626" sub="çözüm bekliyor" />
      </div>

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        <StatCard label="Toplam Kullanıcı" value={snapshot?.totalUsers ?? '-'} color="#374151" />
        <StatCard label="Aktif İlan" value={snapshot?.activeListings ?? '-'} color="#059669" />
        <StatCard label="Aktif Mağaza" value={snapshot?.activeStores ?? '-'} color="#7c3aed" />
        <StatCard label="Yasaklı Hesap" value={snapshot?.bannedUsers ?? '-'} color="#6b7280" />
      </div>

      <div className="card" style={{ padding: '0 0 4px' }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f3f4f6' }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Sistem Sağlık Kontrolleri</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Kontrol</th>
              <th>Durum</th>
              <th>Detay</th>
              <th>Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {healthRows.map(row => (
              <tr key={row.title}>
                <td style={{ fontWeight: 600 }}>{row.title}</td>
                <td>
                  <span className={`badge ${row.state === 'ok' ? 'badge-active' : row.state === 'warn' ? 'badge-open' : 'badge-rejected'}`}>
                    {row.state === 'ok' ? '✓ Sağlıklı' : row.state === 'warn' ? '⚠ İzlenmeli' : '✕ Hata'}
                  </span>
                </td>
                <td style={{ color: '#374151', fontSize: 13 }}>{row.detail}</td>
                <td>
                  {row.action && row.actionLink && (
                    <a href={row.actionLink} style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
                      {row.action} →
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
