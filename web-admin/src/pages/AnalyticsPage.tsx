import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

interface DayCount { day: string; count: number }
interface TopSeller { id: string; name: string; listings: number; reports: number }

interface AnalyticsData {
  totalListings: number;
  totalUsers: number;
  totalReports: number;
  totalComments: number;
  pendingListings: number;
  openReports: number;
  bannedUsers: number;
  hiddenComments: number;
  newUsersLast30: DayCount[];
  newListingsLast30: DayCount[];
  listingsByStatus: { status: string; count: number }[];
  reportsByStatus: { status: string; count: number }[];
  topSellers: TopSeller[];
}

function barMaxWidth(val: number, max: number) {
  if (max === 0) return '2px';
  return `${Math.max(2, Math.round((val / max) * 220))}px`;
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    active: '#15803d', pending: '#d97706', rejected: '#dc2626',
    sold: '#6b7280', paused: '#9ca3af',
    resolved: '#15803d', reviewed: '#d97706', open: '#dc2626',
  };
  return map[status] ?? '#6b7280';
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    active: 'Aktif', pending: 'Onay Bekliyor', rejected: 'Reddedildi',
    sold: 'Satıldı', paused: 'Duraklatıldı',
    resolved: 'Çözüldü', reviewed: 'İncelendi',
    open: 'Açık',
  };
  return map[status] ?? status;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      // Aggregate counts
      const [
        { count: totalListings },
        { count: totalUsers },
        { count: totalReports },
        { count: totalComments },
        { count: pendingListings },
        { count: openReports },
        { count: bannedUsers },
        { count: hiddenComments },
      ] = await Promise.all([
        supabase.from('listings').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('reports').select('*', { count: 'exact', head: true }),
        supabase.from('listing_comments').select('*', { count: 'exact', head: true }),
        supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_banned', true),
        supabase.from('listing_comments').select('*', { count: 'exact', head: true }).eq('is_hidden', true),
      ]);

      // New users last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

      const { data: userDays } = await supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      const { data: listingDays } = await supabase
        .from('listings')
        .select('created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      // Group by day
      function groupByDay(rows: { created_at: string }[]): DayCount[] {
        const map: Record<string, number> = {};
        rows.forEach(r => {
          const day = r.created_at.slice(0, 10);
          map[day] = (map[day] ?? 0) + 1;
        });
        // Fill all 30 days
        const result: DayCount[] = [];
        for (let i = 29; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          result.push({ day: key, count: map[key] ?? 0 });
        }
        return result;
      }

      // Listings by status
      const { data: lsByStatus } = await supabase
        .from('listings')
        .select('status')
        .limit(10000);
      const lsStatusMap: Record<string, number> = {};
      (lsByStatus ?? []).forEach((l: any) => {
        lsStatusMap[l.status] = (lsStatusMap[l.status] ?? 0) + 1;
      });
      const listingsByStatus = Object.entries(lsStatusMap).map(([status, count]) => ({ status, count }));

      // Reports by status
      const { data: rpByStatus } = await supabase
        .from('reports')
        .select('status')
        .limit(5000);
      const rpStatusMap: Record<string, number> = {};
      (rpByStatus ?? []).forEach((r: any) => {
        rpStatusMap[r.status] = (rpStatusMap[r.status] ?? 0) + 1;
      });
      const reportsByStatus = Object.entries(rpStatusMap).map(([status, count]) => ({ status, count }));

      // Top sellers by listing count
      const { data: topRaw } = await supabase
        .from('listings')
        .select('seller_id, profiles (full_name, username)')
        .limit(500);
      const sellerMap: Record<string, { name: string; listings: number }> = {};
      (topRaw ?? []).forEach((l: any) => {
        const id = l.seller_id;
        if (!sellerMap[id]) {
          sellerMap[id] = {
            name: l.profiles?.full_name ?? l.profiles?.username ?? id.slice(0, 8),
            listings: 0,
          };
        }
        sellerMap[id].listings++;
      });
      const topSellers: TopSeller[] = Object.entries(sellerMap)
        .sort((a, b) => b[1].listings - a[1].listings)
        .slice(0, 10)
        .map(([id, v]) => ({ id, name: v.name, listings: v.listings, reports: 0 }));

      setData({
        totalListings: totalListings ?? 0,
        totalUsers: totalUsers ?? 0,
        totalReports: totalReports ?? 0,
        totalComments: totalComments ?? 0,
        pendingListings: pendingListings ?? 0,
        openReports: openReports ?? 0,
        bannedUsers: bannedUsers ?? 0,
        hiddenComments: hiddenComments ?? 0,
        newUsersLast30: groupByDay(userDays ?? []),
        newListingsLast30: groupByDay(listingDays ?? []),
        listingsByStatus,
        reportsByStatus,
        topSellers,
      });
    } catch (e: any) {
      setError(e.message ?? 'Bilinmeyen hata');
    }

    setLastUpdated(new Date().toLocaleTimeString('tr-TR'));
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const userChartMax = useMemo(() => Math.max(1, ...(data?.newUsersLast30.map(d => d.count) ?? [0])), [data]);
  const listingChartMax = useMemo(() => Math.max(1, ...(data?.newListingsLast30.map(d => d.count) ?? [0])), [data]);

  const bigStats = data
    ? [
        { label: 'Toplam İlan', value: data.totalListings, sub: `${data.pendingListings} onay bekliyor`, color: '#d97706' },
        { label: 'Toplam Kullanıcı', value: data.totalUsers, sub: `${data.bannedUsers} yasaklı`, color: '#2563eb' },
        { label: 'Toplam Şikayet', value: data.totalReports, sub: `${data.openReports} açık`, color: '#dc2626' },
        { label: 'Toplam Yorum', value: data.totalComments, sub: `${data.hiddenComments} gizli`, color: '#7c3aed' },
      ]
    : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analitik & İstatistikler</h1>
          <p className="page-sub">Platform geneli gerçek zamanlı metrikler</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => void load()} disabled={loading}>Yenile</button>
        </div>
      </div>

      {lastUpdated && <div className="last-updated">Son güncelleme: {lastUpdated}</div>}
      {error && <div className="error-banner">Hata: {error}</div>}

      {loading ? (
        <div className="loading">Yükleniyor…</div>
      ) : data ? (
        <>
          {/* Big Stats */}
          <div className="analytics-big-stats">
            {bigStats.map(s => (
              <div key={s.label} className="analytics-stat-card" style={{ borderTop: `4px solid ${s.color}` }}>
                <div className="analytics-stat-val" style={{ color: s.color }}>
                  {s.value.toLocaleString('tr-TR')}
                </div>
                <div className="analytics-stat-label">{s.label}</div>
                <div className="analytics-stat-sub">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Bar Charts */}
          <div className="analytics-charts-row">
            <div className="card analytics-chart-card">
              <div className="section-title">Son 30 Gün — Yeni Kullanıcı</div>
              <div className="bar-chart">
                {data.newUsersLast30.map(d => (
                  <div key={d.day} className="bar-item" title={`${d.day}: ${d.count}`}>
                    <div
                      className="bar-fill bar-blue"
                      style={{ height: `${Math.max(2, Math.round((d.count / userChartMax) * 100))}%` }}
                    />
                    <div className="bar-label">{d.day.slice(8)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card analytics-chart-card">
              <div className="section-title">Son 30 Gün — Yeni İlan</div>
              <div className="bar-chart">
                {data.newListingsLast30.map(d => (
                  <div key={d.day} className="bar-item" title={`${d.day}: ${d.count}`}>
                    <div
                      className="bar-fill bar-orange"
                      style={{ height: `${Math.max(2, Math.round((d.count / listingChartMax) * 100))}%` }}
                    />
                    <div className="bar-label">{d.day.slice(8)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Status breakdowns */}
          <div className="analytics-charts-row">
            <div className="card analytics-breakdown-card">
              <div className="section-title">İlan Durum Dağılımı</div>
              {data.listingsByStatus.length === 0 ? (
                <div className="small-empty">Veri yok</div>
              ) : data.listingsByStatus.sort((a,b) => b.count - a.count).map(row => {
                const max = Math.max(...data.listingsByStatus.map(r => r.count));
                return (
                  <div key={row.status} className="breakdown-row">
                    <div className="breakdown-label">
                      <span className="breakdown-dot" style={{ background: statusColor(row.status) }} />
                      {statusLabel(row.status)}
                    </div>
                    <div className="breakdown-bar-wrap">
                      <div
                        className="breakdown-bar"
                        style={{ width: barMaxWidth(row.count, max), background: statusColor(row.status) }}
                      />
                    </div>
                    <div className="breakdown-count">{row.count.toLocaleString('tr-TR')}</div>
                  </div>
                );
              })}
            </div>

            <div className="card analytics-breakdown-card">
              <div className="section-title">Şikayet Durum Dağılımı</div>
              {data.reportsByStatus.length === 0 ? (
                <div className="small-empty">Veri yok</div>
              ) : data.reportsByStatus.sort((a,b) => b.count - a.count).map(row => {
                const max = Math.max(...data.reportsByStatus.map(r => r.count));
                return (
                  <div key={row.status} className="breakdown-row">
                    <div className="breakdown-label">
                      <span className="breakdown-dot" style={{ background: statusColor(row.status) }} />
                      {statusLabel(row.status)}
                    </div>
                    <div className="breakdown-bar-wrap">
                      <div
                        className="breakdown-bar"
                        style={{ width: barMaxWidth(row.count, max), background: statusColor(row.status) }}
                      />
                    </div>
                    <div className="breakdown-count">{row.count.toLocaleString('tr-TR')}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Sellers */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title">En Çok İlan Veren Satıcılar</div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Satıcı</th>
                  <th>İlan Sayısı</th>
                </tr>
              </thead>
              <tbody>
                {data.topSellers.length === 0 ? (
                  <tr className="empty-row"><td colSpan={3}>Veri yok</td></tr>
                ) : data.topSellers.map((s, i) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 700, color: i < 3 ? '#d97706' : 'var(--muted)', width: 32 }}>{i + 1}</td>
                    <td>{s.name}</td>
                    <td>
                      <span style={{
                        background: '#eff6ff', color: '#2563eb', fontWeight: 700,
                        padding: '2px 10px', borderRadius: 999, fontSize: 12,
                      }}>
                        {s.listings.toLocaleString('tr-TR')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
