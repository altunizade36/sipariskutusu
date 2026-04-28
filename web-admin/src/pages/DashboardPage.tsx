import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface Stats {
  pending_listings: number;
  open_reports: number;
  total_users: number;
  banned_users: number;
}

interface MiniListing {
  id: string;
  title: string;
  price: number;
  created_at: string;
}

interface MiniUser {
  id: string;
  full_name: string | null;
  created_at: string;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentListings, setRecentListings] = useState<MiniListing[]>([]);
  const [recentUsers, setRecentUsers] = useState<MiniUser[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  async function load() {
    const [
      { count: pending_listings },
      { count: open_reports },
      { count: total_users },
      { count: banned_users },
    ] = await Promise.all([
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_banned', true),
    ]);
    setStats({
      pending_listings: pending_listings ?? 0,
      open_reports: open_reports ?? 0,
      total_users: total_users ?? 0,
      banned_users: banned_users ?? 0,
    });

    const [{ data: l }, { data: u }] = await Promise.all([
      supabase
        .from('listings')
        .select('id,title,price,created_at')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('profiles')
        .select('id,full_name,created_at')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    setRecentListings((l ?? []) as MiniListing[]);
    setRecentUsers((u ?? []) as MiniUser[]);
    setLastUpdated(new Date().toLocaleTimeString('tr-TR'));
  }

  useEffect(() => { void load(); }, []);

  const statCards = stats
    ? [
        { label: 'Onay Bekleyen Ilan', value: stats.pending_listings, tone: 'sand', link: '/listings' },
        { label: 'Acik Sikayet', value: stats.open_reports, tone: 'rose', link: '/reports' },
        { label: 'Toplam Kullanici', value: stats.total_users, tone: 'mint', link: '/users' },
        { label: 'Yasakli Kullanici', value: stats.banned_users, tone: 'ink', link: '/users' },
      ]
    : [];

  return (
    <div className="dashboard-page">
      <div className="dashboard-head">
        <div>
          <h1 className="page-title">Hos Geldin, Admin</h1>
          <p className="page-subtitle">Magaza ekosistemindeki son durumu bu panelden yonetebilirsin.</p>
          {lastUpdated && <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0' }}>Son güncelleme: {lastUpdated}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => void load()}>⟳ Yenile</button>
          <button className="btn btn-primary" onClick={() => navigate('/ops')}>Canli Durum</button>
        </div>
      </div>

      {!stats ? (
        <div className="loading">Yükleniyor…</div>
      ) : (
        <>
          <div className="metrics-grid">
            {statCards.map(card => (
              <div
                key={card.label}
                className={`metric-card metric-${card.tone}`}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(card.link)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && navigate(card.link)}
              >
                <div className="metric-label">{card.label}</div>
                <div className="metric-val">{card.value.toLocaleString('tr-TR')}</div>
                <div className="metric-foot">Tıkla → yönlendir</div>
              </div>
            ))}
          </div>

          <div className="dashboard-grid">
            <section className="card summary-card">
              <div className="section-title">Operasyon Ozeti</div>
              <div className="summary-chart" aria-hidden="true">
                <svg viewBox="0 0 620 180" className="summary-svg" role="img">
                  <path d="M10 140 C60 80, 100 95, 140 110 C170 122, 200 92, 230 78 C260 65, 290 70, 320 88 C350 108, 390 128, 420 100 C450 74, 500 54, 610 66" className="line-a" />
                  <path d="M10 125 C55 110, 95 95, 130 100 C165 105, 205 138, 240 145 C280 155, 320 135, 360 120 C400 102, 435 85, 480 90 C520 94, 560 115, 610 102" className="line-b" />
                </svg>
              </div>
            </section>

            <section className="card list-card">
              <div className="section-title">Son Ilanlar</div>
              {recentListings.length === 0 ? (
                <div className="small-empty">Ilan verisi yok</div>
              ) : (
                <ul className="item-list">
                  {recentListings.map(item => (
                    <li key={item.id}>
                      <div>
                        <div className="item-title">{item.title}</div>
                        <div className="item-sub">{new Date(item.created_at).toLocaleDateString('tr-TR')}</div>
                      </div>
                      <div className="item-price">{Number(item.price).toLocaleString('tr-TR')} TL</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="dashboard-grid bottom-grid">
            <section className="card table-card">
              <div className="section-title">Son Kayit Olan Kullanicilar</div>
              {recentUsers.length === 0 ? (
                <div className="small-empty">Kullanici verisi yok</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Ad</th>
                      <th>Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentUsers.map(user => (
                      <tr key={user.id}>
                        <td>{user.full_name || 'Adsiz kullanici'}</td>
                        <td>{new Date(user.created_at).toLocaleDateString('tr-TR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="card panel-card">
              <div className="section-title">Hizli Eylemler</div>
              <div className="panel-stack">
                <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left' }} onClick={() => navigate('/listings')}>→ İlan Moderasyonu</button>
                <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left' }} onClick={() => navigate('/reports')}>→ Şikayet Yönetimi</button>
                <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left' }} onClick={() => navigate('/users')}>→ Kullanıcı Yönetimi</button>
                <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left' }} onClick={() => navigate('/comments')}>→ Yorum Yönetimi</button>
                <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left' }} onClick={() => navigate('/audit')}>→ Denetim Günlüğü</button>
                <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left' }} onClick={() => navigate('/ops')}>→ Operasyon Merkezi</button>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
