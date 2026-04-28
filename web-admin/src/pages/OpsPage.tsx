import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type CheckState = 'ok' | 'warn' | 'fail';

interface OpsSnapshot {
  pendingListings: number;
  openReports: number;
  hiddenComments: number;
  bannedUsers: number;
  checkedAt: string;
}

interface HealthRow {
  title: string;
  state: CheckState;
  detail: string;
}

export default function OpsPage() {
  const [snapshot, setSnapshot] = useState<OpsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [
      { count: pendingListings, error: listingsErr },
      { count: openReports, error: reportsErr },
      { count: hiddenComments, error: commentsErr },
      { count: bannedUsers, error: bannedErr },
    ] = await Promise.all([
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('listing_comments').select('*', { count: 'exact', head: true }).eq('is_hidden', true),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_banned', true),
    ]);

    const firstError = listingsErr || reportsErr || commentsErr || bannedErr;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    setSnapshot({
      pendingListings: pendingListings ?? 0,
      openReports: openReports ?? 0,
      hiddenComments: hiddenComments ?? 0,
      bannedUsers: bannedUsers ?? 0,
      checkedAt: new Date().toISOString(),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: reload snapshot when listings, reports, or profiles change
  useEffect(() => {
    const channel = supabase
      .channel('ops-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' },  () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listing_comments' }, () => { void load(); })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      void load();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, load]);

  const healthRows = useMemo<HealthRow[]>(() => {
    if (!snapshot) {
      return [
        { title: 'Veri baglantisi', state: 'warn', detail: 'Kontrol bekleniyor' },
        { title: 'Moderasyon kuyrugu', state: 'warn', detail: 'Kontrol bekleniyor' },
      ];
    }

    const moderationLoad = snapshot.pendingListings + snapshot.openReports;
    return [
      {
        title: 'Veri baglantisi',
        state: error ? 'fail' : 'ok',
        detail: error ? 'Supabase sorgusunda hata var' : 'Supabase sorgulari yanit veriyor',
      },
      {
        title: 'Moderasyon kuyrugu',
        state: moderationLoad > 25 ? 'warn' : 'ok',
        detail:
          moderationLoad > 25
            ? 'Kuyruk yogun, moderasyon aksiyonlarini hizlandir'
            : 'Kuyruk kontrol altinda',
      },
      {
        title: 'Yorum gorunurluk durumu',
        state: snapshot.hiddenComments > 100 ? 'warn' : 'ok',
        detail:
          snapshot.hiddenComments > 100
            ? 'Gizli yorum sayisi yuksek'
            : 'Gizli yorum orani normal',
      },
    ];
  }, [snapshot, error]);

  return (
    <div>
      <h1 className="page-title">Operasyon Kontrol Merkezi</h1>
      <p className="page-subtitle">Tum kritik sinyaller tek ekranda. Canli takip ve anlik mudahale icin tasarlandi.</p>

      <div style={{ display: 'flex', gap: 8, margin: '14px 0 20px', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => void load()} disabled={loading}>
          Simdi Yenile
        </button>
        <button className={`btn ${autoRefresh ? 'btn-success' : 'btn-ghost'}`} onClick={() => setAutoRefresh(v => !v)}>
          {autoRefresh ? 'Canli Izleme: Acik (15sn)' : 'Canli Izleme: Kapali'}
        </button>
        {snapshot && (
          <span className="badge badge-open" style={{ alignSelf: 'center' }}>
            Son kontrol: {new Date(snapshot.checkedAt).toLocaleTimeString('tr-TR')}
          </span>
        )}
      </div>

      {error && <div className="error-msg" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="metrics-grid" style={{ marginBottom: 16 }}>
        <div className="metric-card metric-sand">
          <div className="metric-label">Onay Bekleyen Ilan</div>
          <div className="metric-val">{snapshot?.pendingListings ?? '-'}</div>
        </div>
        <div className="metric-card metric-rose">
          <div className="metric-label">Acik Sikayet</div>
          <div className="metric-val">{snapshot?.openReports ?? '-'}</div>
        </div>
        <div className="metric-card metric-mint">
          <div className="metric-label">Gizli Yorum</div>
          <div className="metric-val">{snapshot?.hiddenComments ?? '-'}</div>
        </div>
        <div className="metric-card metric-ink">
          <div className="metric-label">Yasakli Kullanici</div>
          <div className="metric-val">{snapshot?.bannedUsers ?? '-'}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 10 }}>Sistem Sagligi</h3>
        <table>
          <thead>
            <tr>
              <th>Kontrol</th>
              <th>Durum</th>
              <th>Detay</th>
            </tr>
          </thead>
          <tbody>
            {healthRows.map(row => (
              <tr key={row.title}>
                <td>{row.title}</td>
                <td>
                  <span className={`badge ${row.state === 'ok' ? 'badge-active' : row.state === 'warn' ? 'badge-open' : 'badge-rejected'}`}>
                    {row.state === 'ok' ? 'Saglikli' : row.state === 'warn' ? 'Izlenmeli' : 'Hata'}
                  </span>
                </td>
                <td>{row.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
