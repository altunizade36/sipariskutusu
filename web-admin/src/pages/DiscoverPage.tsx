import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface LeaderboardRow {
  seller_id: string;
  rank: number;
  score: number;
  period_start: string;
  leaderboard_type: string;
  metric_breakdown: Record<string, number> | null;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  stores: { id: string; name: string; is_active: boolean; is_verified: boolean } | null;
}

interface FeaturedStory {
  id: string;
  story_id: string;
  seller_id: string;
  featured_type: string;
  popularity_score: number;
  is_active: boolean;
  expires_at: string | null;
  stories: {
    image_url: string | null;
    caption: string | null;
    profiles: { full_name: string | null } | null;
  } | null;
}

const PERIOD_LABELS: Record<Period, string> = {
  daily: 'Günlük',
  weekly: 'Haftalık',
  monthly: 'Aylık',
  yearly: 'Yıllık',
};

function periodStartIso(period: Period): string {
  const now = new Date();
  if (period === 'daily') { now.setHours(0, 0, 0, 0); return now.toISOString(); }
  if (period === 'weekly') {
    const d = now.getDay(); now.setDate(now.getDate() - (d === 0 ? 6 : d - 1));
    now.setHours(0, 0, 0, 0); return now.toISOString();
  }
  if (period === 'monthly') { now.setDate(1); now.setHours(0, 0, 0, 0); return now.toISOString(); }
  now.setMonth(0, 1); now.setHours(0, 0, 0, 0); return now.toISOString();
}

function computeDiscoveryScore(m: Record<string, number> | null): number {
  if (!m) return 0;
  const n = (k: string) => Number(m[k] ?? 0);
  return (
    n('sales') * 5 +
    n('product_views') * 1 +
    n('store_views') * 2 +
    n('story_views') * 1 +
    n('likes') * 2 +
    n('favorites') * 3 +
    n('comments') * 3 +
    n('messages') * 4 +
    n('follower_growth') * 4 +
    n('new_products') * 2 +
    n('rating') * 10
  );
}

const BADGE_OPTIONS = ['Yükselen', 'Popüler', 'Güvenilir', 'Yeni Drop', 'Haftanın Satıcısı', 'Trend', 'Öne Çıkan'];

export default function DiscoverPage() {
  const [period, setPeriod] = useState<Period>('weekly');
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [featuredStories, setFeaturedStories] = useState<FeaturedStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [assigningBadge, setAssigningBadge] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  async function loadLeaderboard() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('seller_leaderboard')
      .select(`
        seller_id, rank, score, period_start, leaderboard_type, metric_breakdown,
        profiles(full_name, avatar_url),
        stores(id, name, is_active, is_verified)
      `)
      .eq('leaderboard_type', period)
      .gte('period_start', periodStartIso(period))
      .order('rank', { ascending: true })
      .limit(100);

    if (err) { setError(err.message); }
    else { setLeaderboard((data ?? []) as unknown as LeaderboardRow[]); }
    setLoading(false);
    setLastUpdated(new Date().toLocaleTimeString('tr-TR'));
  }

  async function loadFeaturedStories() {
    setStoriesLoading(true);
    const { data } = await supabase
      .from('explore_featured_stories')
      .select(`
        id, story_id, seller_id, featured_type, popularity_score, is_active, expires_at,
        stories(image_url, caption, profiles(full_name))
      `)
      .order('popularity_score', { ascending: false })
      .limit(50);
    setFeaturedStories((data ?? []) as unknown as FeaturedStory[]);
    setStoriesLoading(false);
  }

  useEffect(() => { loadLeaderboard(); }, [period]);
  useEffect(() => { loadFeaturedStories(); }, []);

  useEffect(() => {
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(loadLeaderboard, 60_000);
    }
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [autoRefresh, period]);

  async function toggleStoryActive(id: string, current: boolean) {
    setActing(id);
    const { error: err } = await supabase
      .from('explore_featured_stories')
      .update({ is_active: !current })
      .eq('id', id);
    if (err) { setNotice('Hata: ' + err.message); }
    else {
      setNotice(!current ? 'Hikaye öne çıkarıldı.' : 'Hikaye gizlendi.');
      setFeaturedStories((prev) => prev.map((s) => s.id === id ? { ...s, is_active: !current } : s));
    }
    setActing(null);
    setTimeout(() => setNotice(null), 3000);
  }

  async function toggleStoreVerified(storeId: string, current: boolean) {
    setActing(storeId);
    const { error: err } = await supabase
      .from('stores')
      .update({ is_verified: !current })
      .eq('id', storeId);
    if (err) { setNotice('Hata: ' + err.message); }
    else {
      setNotice(!current ? 'Satıcı doğrulandı.' : 'Doğrulama kaldırıldı.');
      setLeaderboard((prev) =>
        prev.map((row) =>
          row.stores?.id === storeId
            ? { ...row, stores: row.stores ? { ...row.stores, is_verified: !current } : null }
            : row
        )
      );
    }
    setActing(null);
    setTimeout(() => setNotice(null), 3000);
  }

  async function assignBadge(sellerId: string, badge: string) {
    setActing(sellerId + '_badge');
    const { error: err } = await supabase
      .from('seller_leaderboard')
      .update({ badge_label: badge } as any)
      .eq('seller_id', sellerId)
      .eq('leaderboard_type', period);
    if (err) { setNotice('Hata: ' + err.message); }
    else { setNotice(`"${badge}" rozeti atandı.`); }
    setActing(null);
    setAssigningBadge(null);
    setTimeout(() => setNotice(null), 3000);
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return leaderboard;
    const q = search.toLowerCase();
    return leaderboard.filter(
      (row) =>
        (row.profiles?.full_name ?? '').toLowerCase().includes(q) ||
        (row.stores?.name ?? '').toLowerCase().includes(q)
    );
  }, [leaderboard, search]);

  const topStats = useMemo(() => {
    const total = leaderboard.length;
    const avgScore = total > 0 ? Math.round(leaderboard.reduce((s, r) => s + r.score, 0) / total) : 0;
    const verified = leaderboard.filter((r) => r.stores?.is_verified).length;
    const active = leaderboard.filter((r) => r.stores?.is_active).length;
    return { total, avgScore, verified, active };
  }, [leaderboard]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Keşfet Yönetimi</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
            Lider tablosunu izle, satıcıları öne çıkar, hikayeleri yönet, rozet ata
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ accentColor: 'var(--primary)' }}
            />
            Otomatik yenile
          </label>
          {lastUpdated && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Son güncelleme: {lastUpdated}</span>
          )}
          <button className="btn btn-primary" onClick={loadLeaderboard} disabled={loading}>
            {loading ? 'Yükleniyor…' : 'Yenile'}
          </button>
        </div>
      </div>

      {notice && (
        <div className="notice notice-success" style={{ marginBottom: 16 }}>{notice}</div>
      )}
      {error && (
        <div className="notice notice-error" style={{ marginBottom: 16 }}>{error}</div>
      )}

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Toplam Satıcı', value: topStats.total, color: '#3B82F6' },
          { label: 'Ort. Keşif Puanı', value: topStats.avgScore.toLocaleString('tr-TR'), color: '#8B5CF6' },
          { label: 'Doğrulanmış', value: topStats.verified, color: '#10B981' },
          { label: 'Aktif Mağaza', value: topStats.active, color: '#F59E0B' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="card"
            style={{ padding: '16px 20px', borderTop: `3px solid ${stat.color}` }}
          >
            <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Leaderboard section */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Lider Tablosu</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['daily', 'weekly', 'monthly', 'yearly'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`btn ${period === p ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 12, padding: '4px 12px' }}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Satıcı veya mağaza ara…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
              style={{ width: 220, fontSize: 13 }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            {leaderboard.length === 0
              ? `${PERIOD_LABELS[period]} lider tablosu verisi bulunamadı.`
              : 'Aramanızla eşleşen satıcı bulunamadı.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th style={{ width: 50 }}>Sıra</th>
                  <th>Satıcı / Mağaza</th>
                  <th style={{ width: 120 }}>Keşif Puanı</th>
                  <th style={{ width: 80 }}>Puan</th>
                  <th style={{ width: 70 }}>Satış</th>
                  <th style={{ width: 70 }}>Beğeni</th>
                  <th style={{ width: 70 }}>Yorum</th>
                  <th style={{ width: 70 }}>Mesaj</th>
                  <th style={{ width: 90 }}>Durum</th>
                  <th style={{ width: 180 }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const m = row.metric_breakdown ?? {};
                  const n = (k: string) => Math.round(Number(m[k] ?? 0));
                  const discoveryScore = computeDiscoveryScore(row.metric_breakdown);
                  const isActingBadge = acting === row.seller_id + '_badge';
                  const isActingStore = acting === row.stores?.id;
                  return (
                    <tr key={row.seller_id}>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 28, height: 28, borderRadius: 14,
                          backgroundColor: row.rank <= 3 ? ['#FEF3C7', '#F1F5F9', '#FFF7ED'][row.rank - 1] : '#F8FAFC',
                          fontWeight: 700, fontSize: 12,
                          color: row.rank <= 3 ? ['#D97706', '#64748B', '#EA580C'][row.rank - 1] : 'var(--text-muted)',
                        }}>
                          {row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : `#${row.rank}`}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {row.profiles?.avatar_url && (
                            <img
                              src={row.profiles.avatar_url}
                              alt=""
                              style={{ width: 34, height: 34, borderRadius: 17, objectFit: 'cover', flexShrink: 0 }}
                            />
                          )}
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>
                              {row.stores?.name || row.profiles?.full_name || row.seller_id.slice(0, 8)}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {row.profiles?.full_name ?? '—'}
                            </div>
                          </div>
                          {row.stores?.is_verified && (
                            <span style={{ fontSize: 11, backgroundColor: '#DCFCE7', color: '#16A34A', borderRadius: 6, padding: '2px 6px', fontWeight: 600 }}>
                              ✓ Doğrulanmış
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#8B5CF6' }}>
                          {discoveryScore.toLocaleString('tr-TR')}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>keşif puanı</div>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{Math.round(row.score).toLocaleString('tr-TR')}</td>
                      <td>{n('sales')}</td>
                      <td>{n('likes')}</td>
                      <td>{n('comments')}</td>
                      <td>{n('messages')}</td>
                      <td>
                        <span style={{
                          fontSize: 11, borderRadius: 6, padding: '2px 8px', fontWeight: 600,
                          backgroundColor: row.stores?.is_active ? '#DCFCE7' : '#FEE2E2',
                          color: row.stores?.is_active ? '#16A34A' : '#DC2626',
                        }}>
                          {row.stores?.is_active ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {row.stores?.id && (
                            <button
                              className="btn btn-ghost"
                              style={{ fontSize: 11, padding: '3px 8px' }}
                              disabled={isActingStore}
                              onClick={() => toggleStoreVerified(row.stores!.id, row.stores!.is_verified)}
                            >
                              {row.stores.is_verified ? 'Doğrulamayı Kaldır' : 'Doğrula'}
                            </button>
                          )}
                          <div style={{ position: 'relative' }}>
                            <button
                              className="btn btn-ghost"
                              style={{ fontSize: 11, padding: '3px 8px' }}
                              disabled={isActingBadge}
                              onClick={() => setAssigningBadge(assigningBadge === row.seller_id ? null : row.seller_id)}
                            >
                              Rozet Ata ▾
                            </button>
                            {assigningBadge === row.seller_id && (
                              <div style={{
                                position: 'absolute', top: '100%', left: 0, zIndex: 100,
                                backgroundColor: '#fff', border: '1px solid var(--border)',
                                borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                                minWidth: 160, padding: 6,
                              }}>
                                {BADGE_OPTIONS.map((badge) => (
                                  <button
                                    key={badge}
                                    className="btn btn-ghost"
                                    style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 12, padding: '6px 10px' }}
                                    onClick={() => assignBadge(row.seller_id, badge)}
                                  >
                                    {badge}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Featured Stories section */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Editörün Seçimi — Öne Çıkan Hikayeler</h2>
          <button className="btn btn-ghost" onClick={loadFeaturedStories} disabled={storiesLoading} style={{ fontSize: 12 }}>
            {storiesLoading ? 'Yükleniyor…' : 'Yenile'}
          </button>
        </div>

        {storiesLoading ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor…</div>
        ) : featuredStories.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            Henüz öne çıkan hikaye yok. Supabase'de <code>explore_featured_stories</code> tablosuna kayıt ekleyin.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Kapak</th>
                  <th>Satıcı</th>
                  <th style={{ width: 100 }}>Tür</th>
                  <th style={{ width: 100 }}>Popülarite</th>
                  <th style={{ width: 130 }}>Son Geçerlilik</th>
                  <th style={{ width: 80 }}>Durum</th>
                  <th style={{ width: 130 }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {featuredStories.map((story) => {
                  const isActing = acting === story.id;
                  return (
                    <tr key={story.id}>
                      <td>
                        {story.stories?.image_url ? (
                          <img
                            src={story.stories.image_url}
                            alt=""
                            style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ width: 52, height: 52, borderRadius: 8, backgroundColor: '#F1F5F9' }} />
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {story.stories?.profiles?.full_name ?? story.seller_id.slice(0, 8)}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }} title={story.stories?.caption ?? ''}>
                          {(story.stories?.caption ?? '').slice(0, 48) || '—'}
                        </div>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11, borderRadius: 6, padding: '2px 8px', fontWeight: 600,
                          backgroundColor:
                            story.featured_type === 'trending' ? '#FEE2E2'
                            : story.featured_type === 'weekly' ? '#FEF3C7'
                            : '#EFF6FF',
                          color:
                            story.featured_type === 'trending' ? '#DC2626'
                            : story.featured_type === 'weekly' ? '#D97706'
                            : '#2563EB',
                        }}>
                          {story.featured_type === 'trending' ? 'Trend' : story.featured_type === 'weekly' ? 'Haftalık' : 'Günlük'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{story.popularity_score}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {story.expires_at ? new Date(story.expires_at).toLocaleString('tr-TR') : 'Süresiz'}
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11, borderRadius: 6, padding: '2px 8px', fontWeight: 600,
                          backgroundColor: story.is_active ? '#DCFCE7' : '#F1F5F9',
                          color: story.is_active ? '#16A34A' : '#94A3B8',
                        }}>
                          {story.is_active ? 'Aktif' : 'Gizli'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 11, padding: '3px 10px' }}
                          disabled={isActing}
                          onClick={() => toggleStoryActive(story.id, story.is_active)}
                        >
                          {isActing ? '…' : story.is_active ? 'Gizle' : 'Öne Çıkar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
