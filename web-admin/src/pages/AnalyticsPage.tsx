import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

interface DayCount { day: string; count: number }
interface TopSeller {
  id: string;
  name: string;
  listings: number;
  activeListings: number;
  views: number;
  favorites: number;
  comments: number;
  reports: number;
  score: number;
}

interface TopStore {
  id: string;
  name: string;
  username: string;
  listings: number;
  activeListings: number;
  followers: number;
  rating: number;
  ratingCount: number;
  views: number;
  favorites: number;
  score: number;
  verified: boolean;
  active: boolean;
}

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
  topStores: TopStore[];
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
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [liveMode, setLiveMode] = useState(true);
  const [sellerSort, setSellerSort] = useState<'score' | 'listings' | 'views' | 'favorites' | 'reports'>('score');
  const [storeSort, setStoreSort] = useState<'score' | 'followers' | 'rating' | 'listings' | 'views'>('score');

  const load = useCallback(async () => {
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

      // Seller and store leaderboard sources
      const { data: leaderboardListings } = await supabase
        .from('listings')
        .select('id, seller_id, store_id, status, view_count, favorite_count, comment_count, profiles (full_name, username)')
        .limit(6000);

      const { data: reportsRaw } = await supabase
        .from('reports')
        .select('target_type, target_id, status')
        .limit(6000);

      const { data: storesRaw } = await supabase
        .from('stores')
        .select('id, name, username, follower_count, rating, rating_count, is_verified, is_active')
        .limit(2000);

      const sellerMap: Record<string, TopSeller> = {};
      const listingIdToSeller: Record<string, string> = {};

      (leaderboardListings ?? []).forEach((listing: any) => {
        if (!listing?.seller_id) {
          return;
        }

        const sellerId = listing.seller_id as string;
        listingIdToSeller[listing.id] = sellerId;
        if (!sellerMap[sellerId]) {
          const sellerName = listing.profiles?.full_name ?? listing.profiles?.username ?? sellerId.slice(0, 8);
          sellerMap[sellerId] = {
            id: sellerId,
            name: sellerName,
            listings: 0,
            activeListings: 0,
            views: 0,
            favorites: 0,
            comments: 0,
            reports: 0,
            score: 0,
          };
        }

        sellerMap[sellerId].listings += 1;
        if (listing.status === 'active') {
          sellerMap[sellerId].activeListings += 1;
        }
        sellerMap[sellerId].views += Number(listing.view_count ?? 0);
        sellerMap[sellerId].favorites += Number(listing.favorite_count ?? 0);
        sellerMap[sellerId].comments += Number(listing.comment_count ?? 0);
      });

      (reportsRaw ?? []).forEach((report: any) => {
        if (!report?.target_id) {
          return;
        }

        if (report.target_type === 'listing') {
          const sellerId = listingIdToSeller[report.target_id as string];
          if (sellerId && sellerMap[sellerId]) {
            sellerMap[sellerId].reports += 1;
          }
        }
      });

      const topSellers: TopSeller[] = Object.values(sellerMap).map((seller) => ({
        ...seller,
        score: Number(
          (
            seller.listings * 3 +
            seller.activeListings * 1.5 +
            seller.views * 0.02 +
            seller.favorites * 0.7 +
            seller.comments * 0.9 -
            seller.reports * 1.8
          ).toFixed(2),
        ),
      }));

      const storeMap: Record<string, TopStore> = {};
      (storesRaw ?? []).forEach((store: any) => {
        if (!store?.id) {
          return;
        }

        storeMap[store.id] = {
          id: store.id,
          name: store.name ?? 'Magaza',
          username: store.username ?? '',
          listings: 0,
          activeListings: 0,
          followers: Number(store.follower_count ?? 0),
          rating: Number(store.rating ?? 0),
          ratingCount: Number(store.rating_count ?? 0),
          views: 0,
          favorites: 0,
          score: 0,
          verified: Boolean(store.is_verified),
          active: Boolean(store.is_active),
        };
      });

      (leaderboardListings ?? []).forEach((listing: any) => {
        const storeId = listing.store_id as string | null;
        if (!storeId || !storeMap[storeId]) {
          return;
        }

        storeMap[storeId].listings += 1;
        if (listing.status === 'active') {
          storeMap[storeId].activeListings += 1;
        }
        storeMap[storeId].views += Number(listing.view_count ?? 0);
        storeMap[storeId].favorites += Number(listing.favorite_count ?? 0);
      });

      const topStores: TopStore[] = Object.values(storeMap).map((store) => ({
        ...store,
        score: Number(
          (
            store.listings * 3 +
            store.activeListings * 1.8 +
            store.followers * 0.05 +
            store.rating * 22 +
            store.views * 0.02 +
            store.favorites * 0.5
          ).toFixed(2),
        ),
      }));

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
        topStores,
      });
    } catch (e: any) {
      setError(e.message ?? 'Bilinmeyen hata');
    }

    setLastUpdated(new Date().toLocaleTimeString('tr-TR'));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const timer = window.setInterval(() => {
      void load();
    }, 15000);

    return () => window.clearInterval(timer);
  }, [autoRefresh, load]);

  useEffect(() => {
    if (!liveMode) {
      return;
    }

    const channel = supabase
      .channel('analytics-live-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { void load(); })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [liveMode, load]);

  const userChartMax = useMemo(() => Math.max(1, ...(data?.newUsersLast30.map(d => d.count) ?? [0])), [data]);
  const listingChartMax = useMemo(() => Math.max(1, ...(data?.newListingsLast30.map(d => d.count) ?? [0])), [data]);
  const sortedTopSellers = useMemo(() => {
    if (!data) {
      return [];
    }

    const list = [...data.topSellers];
    switch (sellerSort) {
      case 'listings':
        return list.sort((a, b) => b.listings - a.listings);
      case 'views':
        return list.sort((a, b) => b.views - a.views);
      case 'favorites':
        return list.sort((a, b) => b.favorites - a.favorites);
      case 'reports':
        return list.sort((a, b) => b.reports - a.reports);
      default:
        return list.sort((a, b) => b.score - a.score);
    }
  }, [data, sellerSort]);

  const sortedTopStores = useMemo(() => {
    if (!data) {
      return [];
    }

    const list = [...data.topStores];
    switch (storeSort) {
      case 'followers':
        return list.sort((a, b) => b.followers - a.followers);
      case 'rating':
        return list.sort((a, b) => b.rating - a.rating);
      case 'listings':
        return list.sort((a, b) => b.listings - a.listings);
      case 'views':
        return list.sort((a, b) => b.views - a.views);
      default:
        return list.sort((a, b) => b.score - a.score);
    }
  }, [data, storeSort]);

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
          <button className={`btn ${liveMode ? 'btn-success' : 'btn-ghost'}`} onClick={() => setLiveMode(v => !v)}>
            {liveMode ? 'Canli: Acik' : 'Canli: Kapali'}
          </button>
          <button className={`btn ${autoRefresh ? 'btn-success' : 'btn-ghost'}`} onClick={() => setAutoRefresh(v => !v)}>
            {autoRefresh ? 'Oto Yenile: 15sn' : 'Oto Yenile: Kapali'}
          </button>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 0' }}>
              <div className="section-title" style={{ marginBottom: 0 }}>Populer Satici Liderligi</div>
              <select value={sellerSort} onChange={(e) => setSellerSort(e.target.value as typeof sellerSort)} className="search-input" style={{ width: 230 }}>
                <option value="score">Skor (onerilen)</option>
                <option value="listings">Ilan sayisi</option>
                <option value="views">Goruntulenme</option>
                <option value="favorites">Favori</option>
                <option value="reports">Sikayet</option>
              </select>
            </div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Satıcı</th>
                  <th>İlan Sayısı</th>
                  <th>Goruntulenme</th>
                  <th>Favori</th>
                  <th>Sikayet</th>
                  <th>Skor</th>
                </tr>
              </thead>
              <tbody>
                {sortedTopSellers.length === 0 ? (
                  <tr className="empty-row"><td colSpan={7}>Veri yok</td></tr>
                ) : sortedTopSellers.slice(0, 25).map((s, i) => (
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
                    <td>{s.views.toLocaleString('tr-TR')}</td>
                    <td>{s.favorites.toLocaleString('tr-TR')}</td>
                    <td>
                      <span className={`badge ${s.reports > 0 ? 'badge-rejected' : 'badge-active'}`}>
                        {s.reports.toLocaleString('tr-TR')}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: '#1d4ed8' }}>{s.score.toLocaleString('tr-TR')}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 0' }}>
              <div className="section-title" style={{ marginBottom: 0 }}>Populer Magaza Liderligi</div>
              <select value={storeSort} onChange={(e) => setStoreSort(e.target.value as typeof storeSort)} className="search-input" style={{ width: 230 }}>
                <option value="score">Skor (onerilen)</option>
                <option value="followers">Takipci</option>
                <option value="rating">Puan</option>
                <option value="listings">Ilan sayisi</option>
                <option value="views">Goruntulenme</option>
              </select>
            </div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Magaza</th>
                  <th>Takipci</th>
                  <th>Puan</th>
                  <th>Ilan</th>
                  <th>Goruntulenme</th>
                  <th>Skor</th>
                </tr>
              </thead>
              <tbody>
                {sortedTopStores.length === 0 ? (
                  <tr className="empty-row"><td colSpan={7}>Veri yok</td></tr>
                ) : sortedTopStores.slice(0, 25).map((s, i) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 700, color: i < 3 ? '#d97706' : 'var(--muted)', width: 32 }}>{i + 1}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {s.username ? `@${s.username}` : 'kullanici-adi-yok'}
                        {s.verified ? ' • dogrulanmis' : ''}
                        {s.active ? '' : ' • pasif'}
                      </div>
                    </td>
                    <td>{s.followers.toLocaleString('tr-TR')}</td>
                    <td>{s.rating > 0 ? `${s.rating.toFixed(1)} (${s.ratingCount})` : '—'}</td>
                    <td>{s.listings.toLocaleString('tr-TR')}</td>
                    <td>{s.views.toLocaleString('tr-TR')}</td>
                    <td><strong style={{ color: '#1d4ed8' }}>{s.score.toLocaleString('tr-TR')}</strong></td>
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
