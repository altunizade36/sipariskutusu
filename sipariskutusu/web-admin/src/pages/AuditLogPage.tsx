import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

interface AuditEntry {
  id: string;
  kind: 'report_action' | 'listing_status' | 'user_ban';
  actor: string;
  target: string;
  action: string;
  detail: string | null;
  ts: string;
}

type FilterKind = 'all' | 'report_action' | 'listing_status' | 'user_ban';

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKind>('all');
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    // 1. Report actions (admin moderation of reports)
    const { data: ra, error: raErr } = await supabase
      .from('report_actions')
      .select(`
        id, action_type, previous_status, next_status, note, created_at,
        actor:profiles!report_actions_actor_id_fkey (full_name, username),
        report:reports!report_actions_report_id_fkey (target_type, target_id)
      `)
      .order('created_at', { ascending: false })
      .limit(80);

    if (raErr) {
      setError(raErr.message);
      setLoading(false);
      return;
    }

    // 2. Recent listing status changes (approved / rejected)
    const { data: ls, error: lsErr } = await supabase
      .from('listings')
      .select('id, title, status, updated_at, profiles (full_name, username)')
      .in('status', ['active', 'rejected'])
      .order('updated_at', { ascending: false })
      .limit(60);

    if (lsErr) {
      setError(lsErr.message);
      setLoading(false);
      return;
    }

    // 3. Banned users
    const { data: bu, error: buErr } = await supabase
      .from('profiles')
      .select('id, full_name, username, updated_at')
      .eq('is_banned', true)
      .order('updated_at', { ascending: false })
      .limit(40);

    if (buErr) {
      setError(buErr.message);
      setLoading(false);
      return;
    }

    const raEntries: AuditEntry[] = (ra ?? []).map((r: any) => ({
      id: `ra-${r.id}`,
      kind: 'report_action',
      actor: r.actor?.full_name ?? r.actor?.username ?? 'Sistem',
      target: `${r.report?.target_type ?? 'hedef'} (${String(r.report?.target_id ?? '').slice(0, 8)}…)`,
      action: actionLabel(r.action_type),
      detail: r.note ?? null,
      ts: r.created_at,
    }));

    const lsEntries: AuditEntry[] = (ls ?? []).map((l: any) => ({
      id: `ls-${l.id}`,
      kind: 'listing_status',
      actor: 'Admin',
      target: l.title ?? l.id,
      action: l.status === 'active' ? 'İlan onaylandı' : 'İlan reddedildi',
      detail: null,
      ts: l.updated_at,
    }));

    const buEntries: AuditEntry[] = (bu ?? []).map((u: any) => ({
      id: `bu-${u.id}`,
      kind: 'user_ban',
      actor: 'Admin',
      target: u.full_name ?? u.username ?? u.id,
      action: 'Kullanıcı yasaklandı',
      detail: null,
      ts: u.updated_at,
    }));

    const all = [...raEntries, ...lsEntries, ...buEntries].sort(
      (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime(),
    );

    setEntries(all.slice(0, 150));
    setLastUpdated(new Date().toLocaleTimeString('tr-TR'));
    setLoading(false);
  }

  function actionLabel(type: string): string {
    const map: Record<string, string> = {
      submitted: 'Şikayet gönderildi',
      reviewed:  'Şikayet incelendi',
      resolved:  'Şikayet çözüldü',
      rejected:  'Şikayet reddedildi',
    };
    return map[type] ?? type;
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => { void load(); }, 30_000);
    return () => clearInterval(t);
  }, [autoRefresh]);

  const filtered = useMemo(() => {
    let list = entries;
    if (filter !== 'all') list = list.filter(e => e.kind === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.actor.toLowerCase().includes(q) ||
        e.target.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        (e.detail ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [entries, filter, search]);

  function kindBadge(kind: FilterKind) {
    const map: Record<string, string> = {
      report_action:  'badge-pending',
      listing_status: 'badge-active',
      user_ban:       'badge-rejected',
    };
    return map[kind as string] ?? '';
  }

  function kindLabel(kind: string) {
    const map: Record<string, string> = {
      report_action:  'Şikayet',
      listing_status: 'İlan',
      user_ban:       'Kullanıcı',
    };
    return map[kind] ?? kind;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Denetim Günlüğü</h1>
          <p className="page-sub">
            Son <strong>{entries.length}</strong> admin eylemi — gerçek zamanlı takip
          </p>
        </div>
        <div className="header-actions">
          <button
            className={`btn ${autoRefresh ? 'btn-success' : 'btn-ghost'}`}
            onClick={() => setAutoRefresh(v => !v)}
          >
            {autoRefresh ? '⟳ Otomatik: Açık' : '⟳ Otomatik: Kapalı'}
          </button>
          <button className="btn btn-primary" onClick={() => void load()} disabled={loading}>
            Yenile
          </button>
        </div>
      </div>

      {lastUpdated && <div className="last-updated">Son güncelleme: {lastUpdated}</div>}
      {error && <div className="error-banner">Hata: {error}</div>}

      <div className="filter-bar">
        {(['all', 'report_action', 'listing_status', 'user_ban'] as FilterKind[]).map(f => (
          <button
            key={f}
            className={`btn ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Tümü' : f === 'report_action' ? 'Şikayetler' : f === 'listing_status' ? 'İlanlar' : 'Kullanıcı Banlama'}
          </button>
        ))}
        <input
          className="search-input"
          type="search"
          placeholder="Eylem, hedef veya aktör ara…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading">Yükleniyor…</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Zaman</th>
                <th>Kategori</th>
                <th>Aktör</th>
                <th>Hedef</th>
                <th>Eylem</th>
                <th>Not</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr className="empty-row"><td colSpan={6}>Kayıt bulunamadı</td></tr>
              ) : filtered.map(e => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--muted)' }}>
                    {new Date(e.ts).toLocaleString('tr-TR')}
                  </td>
                  <td>
                    <span className={`badge ${kindBadge(e.kind as FilterKind)}`}>
                      {kindLabel(e.kind)}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{e.actor}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.target}
                  </td>
                  <td style={{ fontWeight: 600 }}>{e.action}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 12, maxWidth: 200, wordBreak: 'break-word' }}>
                    {e.detail ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
