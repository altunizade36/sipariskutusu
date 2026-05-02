import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import LineChart from '../components/LineChart';

interface DayCount { day: string; count: number; }
interface DashData {
  totalUsers: number;
  totalListings: number;
  activeListings: number;
  totalStores: number;
  activeStores: number;
  pendingListings: number;
  openReports: number;
  bannedUsers: number;
  totalComments: number;
  newUsersThisWeek: number;
  newListingsThisWeek: number;
  newUsersLast30: DayCount[];
  newListingsLast30: DayCount[];
  recentListings: { id: string; title: string; price: number; status: string; created_at: string }[];
  recentUsers: { id: string; full_name: string | null; username: string | null; created_at: string }[];
  categoryBreakdown: { category_id: string; count: number }[];
}

function groupByDay(rows: { created_at: string }[], days = 30): DayCount[] {
  const map: Record<string, number> = {};
  rows.forEach(r => { const d = r.created_at.slice(0, 10); map[d] = (map[d] ?? 0) + 1; });
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
    const k = d.toISOString().slice(0, 10);
    return { day: k, count: map[k] ?? 0 };
  });
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const now = new Date();
    const thirtyAgo = new Date(now); thirtyAgo.setDate(now.getDate() - 30);
    const sevenAgo = new Date(now); sevenAgo.setDate(now.getDate() - 7);

    const [
      { count: totalUsers },
      { count: totalListings },
      { count: activeListings },
      { count: totalStores },
      { count: activeStores },
      { count: pendingListings },
      { count: openReports },
      { count: bannedUsers },
      { count: totalComments },
      { count: newUsersThisWeek },
      { count: newListingsThisWeek },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('listings').select('*', { count: 'exact', head: true }),
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('stores').select('*', { count: 'exact', head: true }),
      supabase.from('stores').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_banned', true),
      supabase.from('listing_comments').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', sevenAgo.toISOString()),
      supabase.from('listings').select('*', { count: 'exact', head: true }).gte('created_at', sevenAgo.toISOString()),
    ]);

    const [
      { data: userDays },
      { data: listingDays },
      { data: recentListingsRaw },
      { data: recentUsersRaw },
      { data: catRaw },
    ] = await Promise.all([
      supabase.from('profiles').select('created_at').gte('created_at', thirtyAgo.toISOString()).order('created_at', { ascending: true }),
      supabase.from('listings').select('created_at').gte('created_at', thirtyAgo.toISOString()).order('created_at', { ascending: true }),
      supabase.from('listings').select('id,title,price,status,created_at').order('created_at', { ascending: false }).limit(6),
      supabase.from('profiles').select('id,full_name,username,created_at').order('created_at', { ascending: false }).limit(6),
      supabase.from('listings').select('category_id').not('category_id', 'is', null).limit(5000),
    ]);

    const catMap: Record<string, number> = {};
    (catRaw ?? []).forEach((r: any) => { catMap[r.category_id] = (catMap[r.category_id] ?? 0) + 1; });
    const categoryBreakdown = Object.entries(catMap)
      .map(([category_id, count]) => ({ category_id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    setData({
      totalUsers: totalUsers ?? 0,
      totalListings: totalListings ?? 0,
      activeListings: activeListings ?? 0,
      totalStores: totalStores ?? 0,
      activeStores: activeStores ?? 0,
      pendingListings: pendingListings ?? 0,
      openReports: openReports ?? 0,
      bannedUsers: bannedUsers ?? 0,
      totalComments: totalComments ?? 0,
      newUsersThisWeek: newUsersThisWeek ?? 0,
      newListingsThisWeek: newListingsThisWeek ?? 0,
      newUsersLast30: groupByDay(userDays ?? []),
      newListingsLast30: groupByDay(listingDays ?? []),
      recentListings: (recentListingsRaw ?? []) as any,
      recentUsers: (recentUsersRaw ?? []) as any,
      categoryBreakdown,
    });

    setLastUpdated(new Date().toLocaleTimeString('tr-TR'));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    if (autoRefresh) {
      intervalRef.current = setInterval(() => { void load(); }, 30_000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, load]);

  const catMax = useMemo(() => Math.max(1, ...(data?.categoryBreakdown.map(c => c.count) ?? [0])), [data]);

  const kpis = data ? [
    { label: 'Toplam Kullanıcı', value: data.totalUsers, sub: `+${data.newUsersThisWeek} bu hafta`, color: '#2563eb', icon: '👥', link: '/users' },
    { label: 'Aktif İlan', value: data.activeListings, sub: `${data.totalListings.toLocaleString('tr-TR')} toplam`, color: '#16a34a', icon: '📋', link: '/listings' },
    { label: 'Toplam Mağaza', value: data.totalStores, sub: `${data.activeStores} aktif`, color: '#7c3aed', icon: '🏪', link: '/stores' },
    { label: 'Onay Bekleyen', value: data.pendingListings, sub: 'ilan moderasyon', color: '#d97706', icon: '⏳', link: '/listings' },
    { label: 'Açık Şikayet', value: data.openReports, sub: 'çözüm bekliyor', color: '#dc2626', icon: '🚨', link: '/reports' },
    { label: 'Yasaklı Kullanıcı', value: data.bannedUsers, sub: 'hesap engeli', color: '#6b7280', icon: '🚫', link: '/users' },
    { label: 'Toplam Yorum', value: data.totalComments, sub: 'listing yorumları', color: '#0891b2', icon: '💬', link: '/comments' },
    { label: 'Yeni İlan (Bu Hafta)', value: data.newListingsThisWeek, sub: `+${data.newUsersThisWeek} kullanıcı`, color: '#059669', icon: '📈', link: '/listings' },
  ] : [];

  return (
    <div className="dashboard-page">
      <div className="dashboard-head">
        <div>
          <h1 className="page-title">Hoş Geldin, Admin</h1>
          <p className="page-subtitle">Mağaza ekosisteminin tam kontrolü bu panelde.</p>
          {lastUpdated && <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0' }}>Son güncelleme: {lastUpdated}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn ${autoRefresh ? 'btn-success' : 'btn-ghost'}`} onClick={() => setAutoRefresh(v => !v)}>
            {autoRefresh ? '⟳ Canlı (30s)' : '⟳ Durduruldu'}
          </button>
          <button className="btn btn-ghost" onClick={() => void load()}>Yenile</button>
          <button className="btn btn-primary" onClick={() => navigate('/ops')}>Canlı Durum</button>
        </div>
      </div>

      {loading && !data ? (
        <div className="loading">Yükleniyor…</div>
      ) : data ? (
        <>
          <div className="kpi-grid">
            {kpis.map(k => (
              <div
                key={k.label}
                className="kpi-card"
                style={{ cursor: 'pointer', borderTop: `3px solid ${k.color}` }}
                onClick={() => navigate(k.link)}
                role="button" tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && navigate(k.link)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div className="kpi-value" style={{ color: k.color }}>{k.value.toLocaleString('tr-TR')}</div>
                    <div className="kpi-label">{k.label}</div>
                    <div className="kpi-sub">{k.sub}</div>
                  </div>
                  <span style={{ fontSize: 22, opacity: 0.8 }}>{k.icon}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '20px 24px 16px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>30 Günlük Büyüme Trendi</div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280' }}>
                  <span style={{ width: 12, height: 12, borderRadius: 2, background: '#2563eb', display: 'inline-block' }} />
                  Yeni Kullanıcı
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280' }}>
                  <span style={{ width: 12, height: 12, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} />
                  Yeni İlan
                </div>
              </div>
            </div>
            <LineChart
              height={200}
              series={[
                { label: 'Yeni Kullanıcı', color: '#2563eb', data: data.newUsersLast30 },
                { label: 'Yeni İlan', color: '#f59e0b', data: data.newListingsLast30 },
              ]}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
            <section className="card" style={{ padding: '16px 20px' }}>
              <div className="section-title">Son İlanlar</div>
              {data.recentListings.length === 0 ? (
                <div className="small-empty">İlan yok</div>
              ) : (
                <ul className="item-list">
                  {data.recentListings.map(item => (
                    <li key={item.id}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="item-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                          <div className="item-sub">{new Date(item.created_at).toLocaleDateString('tr-TR')}</div>
                          <span className={`badge ${item.status === 'active' ? 'badge-active' : item.status === 'pending' ? 'badge-pending' : 'badge-rejected'}`} style={{ fontSize: 10 }}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                      <div className="item-price">{Number(item.price).toLocaleString('tr-TR')} ₺</div>
                    </li>
                  ))}
                </ul>
              )}
              <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8, fontSize: 12 }} onClick={() => navigate('/listings')}>
                Tüm İlanları Gör →
              </button>
            </section>

            <section className="card" style={{ padding: '16px 20px' }}>
              <div className="section-title">Son Üyeler</div>
              {data.recentUsers.length === 0 ? (
                <div className="small-empty">Kullanıcı yok</div>
              ) : (
                <ul className="item-list">
                  {data.recentUsers.map(u => (
                    <li key={u.id}>
                      <div style={{ flex: 1 }}>
                        <div className="item-title">{u.full_name ?? 'İsimsiz'}</div>
                        <div className="item-sub">
                          {u.username ? `@${u.username} · ` : ''}{new Date(u.created_at).toLocaleDateString('tr-TR')}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8, fontSize: 12 }} onClick={() => navigate('/users')}>
                Tüm Kullanıcılar →
              </button>
            </section>

            <section className="card" style={{ padding: '16px 20px' }}>
              <div className="section-title">Kategori Dağılımı</div>
              {data.categoryBreakdown.length === 0 ? (
                <div className="small-empty">Veri yok</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.categoryBreakdown.map((c, i) => {
                    const colors = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2'];
                    const color = colors[i % colors.length];
                    return (
                      <div key={c.category_id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                          <span style={{ color: '#374151', fontWeight: 500 }}>Kategori {c.category_id.slice(0, 8)}</span>
                          <span style={{ color: '#6b7280' }}>{c.count.toLocaleString('tr-TR')}</span>
                        </div>
                        <div style={{ height: 6, background: '#f3f4f6', borderRadius: 99 }}>
                          <div style={{ height: 6, borderRadius: 99, background: color, width: `${Math.round((c.count / catMax) * 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <button className="btn btn-ghost" style={{ width: '100%', marginTop: 12, fontSize: 12 }} onClick={() => navigate('/analytics')}>
                Detaylı Analitik →
              </button>
            </section>
          </div>

          <section className="card" style={{ padding: '16px 20px' }}>
            <div className="section-title">Hızlı Eylemler</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              {[
                { label: '📋 İlan Moderasyonu', to: '/listings', count: data.pendingListings, urgent: data.pendingListings > 0 },
                { label: '🚨 Şikayet Yönetimi', to: '/reports', count: data.openReports, urgent: data.openReports > 0 },
                { label: '👥 Kullanıcı Yönetimi', to: '/users', count: data.bannedUsers },
                { label: '🏪 Mağaza Yönetimi', to: '/stores', count: data.totalStores },
                { label: '💬 Yorum Yönetimi', to: '/comments' },
                { label: '🔔 Bildirim Gönder', to: '/notifications' },
                { label: '📦 Siparişler', to: '/orders' },
                { label: '📈 Analitik', to: '/analytics' },
                { label: '⚙️ Operasyon', to: '/ops' },
                { label: '📝 Denetim Günlüğü', to: '/audit' },
              ].map(item => (
                <button
                  key={item.to}
                  className={`btn ${item.urgent ? 'btn-danger' : 'btn-ghost'}`}
                  style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center', fontSize: 13, padding: '10px 14px' }}
                  onClick={() => navigate(item.to)}
                >
                  <span>{item.label}</span>
                  {item.count != null && item.count > 0 && (
                    <span style={{ background: item.urgent ? 'rgba(255,255,255,0.3)' : '#e5e7eb', borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
