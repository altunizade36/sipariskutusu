import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import CriticalActionModal from '../components/CriticalActionModal';

interface User {
  id: string;
  full_name: string | null;
  username?: string | null;
  role: string;
  is_banned: boolean;
  banned_reason: string | null;
  created_at: string;
}

interface UserDetail {
  user: User;
  listings: { id: string; title: string; status: string; created_at: string }[];
  reports: { id: string; reason: string; status: string; created_at: string }[];
}

type BulkUserAction = 'ban' | 'unban' | null;

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [banId, setBanId] = useState<string | null>(null);
  const [banReason, setBanReason] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'buyer' | 'seller'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkUserAction>(null);
  const [bulkReason, setBulkReason] = useState('');
  const [detailUser, setDetailUser] = useState<UserDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function load(q?: string) {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('profiles')
      .select('id, full_name, role, is_banned, banned_reason, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (q) {
      query = query.ilike('full_name', `%${q}%`);
    }

    if (roleFilter !== 'all') {
      query = query.eq('role', roleFilter);
    }

    if (statusFilter !== 'all') {
      query = query.eq('is_banned', statusFilter === 'banned');
    }

    const { data, error: qErr } = await query;
    if (qErr) {
      setError(qErr.message);
      setLoading(false);
      return;
    }

    setUsers((data ?? []) as User[]);
    setSelectedIds([]);
    setLastUpdated(new Date().toISOString());
    setLoading(false);
  }

  useEffect(() => {
    void load(search || undefined);
  }, [roleFilter, statusFilter]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      void load(search || undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, search, roleFilter, statusFilter]);

  async function openDetail(u: User) {
    setLoadingDetail(true);
    const [{ data: listings }, { data: reports }] = await Promise.all([
      supabase
        .from('listings')
        .select('id, title, status, created_at')
        .eq('seller_id', u.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('reports')
        .select('id, reason, status, created_at')
        .eq('target_id', u.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    setDetailUser({
      user: u,
      listings: (listings ?? []) as any,
      reports: (reports ?? []) as any,
    });
    setLoadingDetail(false);
  }

  async function ban() {
    if (!banId) return;
    setActing(true);
    setNotice(null);
    await supabase.rpc('ban_user_admin', { p_user_id: banId, p_reason: banReason || null });
    setBanId(null);
    setBanReason('');
    await load(search || undefined);
    setNotice('Kullanici yasaklandi.');
    setActing(false);
  }

  async function unban(id: string) {
    setActing(true);
    setNotice(null);
    await supabase.rpc('unban_user_admin', { p_user_id: id });
    await load(search || undefined);
    setNotice('Kullanici yasagi kaldirildi.');
    setActing(false);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    void load(search || undefined);
  }

  const selectableUsers = useMemo(() => users.filter(u => u.role !== 'admin'), [users]);

  const allSelected = useMemo(() => {
    if (selectableUsers.length === 0) return false;
    return selectableUsers.every(u => selectedIds.includes(u.id));
  }, [selectableUsers, selectedIds]);

  function toggleAll() {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(selectableUsers.map(u => u.id));
  }

  function toggleOne(id: string) {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]));
  }

  async function runBulk() {
    if (!bulkAction || selectedIds.length === 0) return;
    setActing(true);
    setError(null);
    setNotice(null);

    let success = 0;
    let failed = 0;

    for (const id of selectedIds) {
      if (bulkAction === 'ban') {
        const { error: opErr } = await supabase.rpc('ban_user_admin', {
          p_user_id: id,
          p_reason: bulkReason || 'Toplu moderasyon',
        });
        if (opErr) failed += 1;
        else success += 1;
      } else {
        const { error: opErr } = await supabase.rpc('unban_user_admin', {
          p_user_id: id,
        });
        if (opErr) failed += 1;
        else success += 1;
      }
    }

    setBulkAction(null);
    setBulkReason('');
    setSelectedIds([]);
    await load(search || undefined);
    setNotice(`Toplu kullanici islemi tamamlandi. Basarili: ${success}, Hatali: ${failed}`);
    setActing(false);
  }

  return (
    <div>
      <h1 className="page-title">Kullanici Yonetimi</h1>

      <form onSubmit={handleSearch} className="toolbar-row">
        <input
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, width: 280 }}
          placeholder="Ad veya kullanici adi ara..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="btn btn-primary" type="submit">Ara</button>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <option value="all">Tum Roller</option>
          <option value="admin">Admin</option>
          <option value="buyer">Buyer</option>
          <option value="seller">Seller</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <option value="all">Tum Durumlar</option>
          <option value="active">Aktif</option>
          <option value="banned">Yasakli</option>
        </select>
        <button className={`btn ${autoRefresh ? 'btn-success' : 'btn-ghost'}`} type="button" onClick={() => setAutoRefresh(v => !v)}>
          {autoRefresh ? 'Canli Acik' : 'Canli Kapali'}
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => void load(search || undefined)}>Yenile</button>
      </form>

      <div className="toolbar-row" style={{ marginTop: -6, marginBottom: 12 }}>
        <button className="btn btn-danger" type="button" disabled={acting || selectedIds.length === 0} onClick={() => setBulkAction('ban')}>
          Toplu Yasakla ({selectedIds.length})
        </button>
        <button className="btn btn-success" type="button" disabled={acting || selectedIds.length === 0} onClick={() => setBulkAction('unban')}>
          Toplu Yasak Kaldir ({selectedIds.length})
        </button>
      </div>

      {lastUpdated && <div className="status-note">Son guncelleme: {new Date(lastUpdated).toLocaleTimeString('tr-TR')}</div>}
      {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
      {notice && <div className="success-msg">{notice}</div>}

      {loading ? (
        <div className="loading">Yukleniyor...</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th>Ad</th>
                <th>Rol</th>
                <th>Durum</th>
                <th>Kayit</th>
                <th>Islem</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr className="empty-row"><td colSpan={6}>Kullanici bulunamadi</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className={selectedIds.includes(u.id) ? 'row-selected' : ''}>
                  <td>
                    {u.role === 'admin' ? null : (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(u.id)}
                        onChange={() => toggleOne(u.id)}
                      />
                    )}
                  </td>
                  <td>
                    <button
                      className="user-name-btn"
                      onClick={() => void openDetail(u)}
                      title="Detayları gör"
                    >
                      {u.full_name ?? '-'}
                    </button>
                  </td>
                  <td><span className="badge badge-active">{u.role}</span></td>
                  <td>
                    {u.is_banned
                      ? <span className="badge badge-banned" title={u.banned_reason ?? ''}>Yasakli</span>
                      : <span className="badge badge-active">Aktif</span>}
                  </td>
                  <td>{new Date(u.created_at).toLocaleDateString('tr-TR')}</td>
                  <td>
                    {u.is_banned ? (
                      <button className="btn btn-success" disabled={acting} onClick={() => void unban(u.id)}>
                        Yasagi Kaldir
                      </button>
                    ) : u.role !== 'admin' ? (
                      <button className="btn btn-danger" disabled={acting} onClick={() => { setBanId(u.id); setBanReason(''); }}>
                        Yasakla
                      </button>
                    ) : (
                      <span style={{ color: '#64748b', fontSize: 13 }}>Admin</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {banId && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Kullaniciyi Yasakla</h3>
            <div className="form-group">
              <label>Gerekce (opsiyonel)</label>
              <input
                value={banReason}
                onChange={e => setBanReason(e.target.value)}
                placeholder="Kural ihlali, spam vb."
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setBanId(null)}>Iptal</button>
              <button className="btn btn-danger" disabled={acting} onClick={() => void ban()}>Yasakla</button>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {detailUser && (
        <div className="modal-overlay" onClick={() => setDetailUser(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{detailUser.user.full_name ?? 'Kullanıcı'}</h3>
              <button className="modal-close" onClick={() => setDetailUser(null)}>✕</button>
            </div>

            <div className="user-detail-meta">
              <div><span className="detail-key">ID:</span> <code style={{ fontSize: 11 }}>{detailUser.user.id}</code></div>
              <div><span className="detail-key">Rol:</span> <span className="badge badge-active">{detailUser.user.role}</span></div>
              <div><span className="detail-key">Durum:</span> {detailUser.user.is_banned ? <span className="badge badge-banned">Yasaklı</span> : <span className="badge badge-active">Aktif</span>}</div>
              {detailUser.user.banned_reason && <div><span className="detail-key">Ban Gerekçesi:</span> {detailUser.user.banned_reason}</div>}
              <div><span className="detail-key">Kayıt:</span> {new Date(detailUser.user.created_at).toLocaleDateString('tr-TR')}</div>
            </div>

            <div className="user-detail-sections">
              <div className="user-detail-col">
                <div className="section-title">İlanlar ({detailUser.listings.length})</div>
                {detailUser.listings.length === 0 ? (
                  <div className="small-empty">İlan yok</div>
                ) : detailUser.listings.map(l => (
                  <div key={l.id} className="detail-row">
                    <div style={{ flex: 1, fontSize: 13 }}>{l.title}</div>
                    <span className={`badge ${l.status === 'active' ? 'badge-active' : l.status === 'pending' ? 'badge-pending' : 'badge-rejected'}`}>
                      {l.status}
                    </span>
                  </div>
                ))}
              </div>

              <div className="user-detail-col">
                <div className="section-title">Şikayetler ({detailUser.reports.length})</div>
                {detailUser.reports.length === 0 ? (
                  <div className="small-empty">Şikayet yok</div>
                ) : detailUser.reports.map(r => (
                  <div key={r.id} className="detail-row">
                    <div style={{ flex: 1, fontSize: 13 }}>{r.reason}</div>
                    <span className={`badge ${r.status === 'resolved' ? 'badge-active' : r.status === 'pending' ? 'badge-pending' : 'badge-rejected'}`}>
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              {!detailUser.user.is_banned && detailUser.user.role !== 'admin' && (
                <button
                  className="btn btn-danger"
                  disabled={acting}
                  onClick={() => { setDetailUser(null); setBanId(detailUser.user.id); setBanReason(''); }}
                >
                  Yasakla
                </button>
              )}
              {detailUser.user.is_banned && (
                <button
                  className="btn btn-success"
                  disabled={acting}
                  onClick={() => { void unban(detailUser.user.id); setDetailUser(null); }}
                >
                  Yasağı Kaldır
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => setDetailUser(null)}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      <CriticalActionModal
        open={bulkAction !== null}
        title={bulkAction === 'ban' ? 'Toplu Yasaklama' : 'Toplu Yasak Kaldirma'}
        description={`${selectedIds.length} kullanici icin toplu islem uygulanacak.`}
        confirmLabel={bulkAction === 'ban' ? 'Toplu Yasakla' : 'Toplu Yasak Kaldir'}
        confirmClassName={bulkAction === 'ban' ? 'btn-danger' : 'btn-success'}
        requirePhrase={bulkAction === 'ban' ? 'YASAKLA' : 'KALDIR'}
        extra={
          bulkAction === 'ban' ? (
            <div className="form-group" style={{ marginTop: 12 }}>
              <label>Toplu ban gerekcesi</label>
              <input
                value={bulkReason}
                onChange={e => setBulkReason(e.target.value)}
                placeholder="Toplu aksiyon aciklamasi"
              />
            </div>
          ) : null
        }
        onCancel={() => {
          if (acting) return;
          setBulkAction(null);
          setBulkReason('');
        }}
        onConfirm={runBulk}
        busy={acting}
      />
    </div>
  );
}
