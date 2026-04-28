import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  full_name: string | null;
  username?: string | null;
  role: string;
  is_banned: boolean;
  banned_reason: string | null;
  created_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [banId, setBanId] = useState<string | null>(null);
  const [banReason, setBanReason] = useState('');
  const [search, setSearch] = useState('');

  async function load(q?: string) {
    setLoading(true);
    let query = supabase
      .from('profiles')
      .select('id, full_name, role, is_banned, banned_reason, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (q) {
      query = query.ilike('full_name', `%${q}%`);
    }

    const { data } = await query;
    setUsers((data ?? []) as User[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function ban() {
    if (!banId) return;
    setActing(true);
    await supabase.rpc('ban_user_admin', { p_user_id: banId, p_reason: banReason || null });
    setBanId(null);
    setBanReason('');
    await load(search || undefined);
    setActing(false);
  }

  async function unban(id: string) {
    setActing(true);
    await supabase.rpc('unban_user_admin', { p_user_id: id });
    await load(search || undefined);
    setActing(false);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    void load(search || undefined);
  }

  return (
    <div>
      <h1 className="page-title">Kullanıcı Yönetimi</h1>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, width: 280 }}
          placeholder="Ad veya kullanıcı adı ara…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="btn btn-primary" type="submit">Ara</button>
      </form>

      {loading ? (
        <div className="loading">Yükleniyor…</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Ad</th>
                <th>Rol</th>
                <th>Durum</th>
                <th>Kayıt</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr className="empty-row"><td colSpan={5}>Kullanıcı bulunamadı</td></tr>
              ) : users.map(u => (
                <tr key={u.id}>
                  <td>{u.full_name ?? '—'}</td>
                  <td><span className="badge badge-active">{u.role}</span></td>
                  <td>
                    {u.is_banned
                      ? <span className="badge badge-banned" title={u.banned_reason ?? ''}>Yasaklı</span>
                      : <span className="badge badge-active">Aktif</span>}
                  </td>
                  <td>{new Date(u.created_at).toLocaleDateString('tr-TR')}</td>
                  <td>
                    {u.is_banned ? (
                      <button className="btn btn-success" disabled={acting} onClick={() => unban(u.id)}>
                        Yasağı Kaldır
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
            <h3>Kullanıcıyı Yasakla</h3>
            <div className="form-group">
              <label>Gerekçe (opsiyonel)</label>
              <input
                value={banReason}
                onChange={e => setBanReason(e.target.value)}
                placeholder="Kural ihlali, spam, vb."
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setBanId(null)}>İptal</button>
              <button className="btn btn-danger" disabled={acting} onClick={ban}>Yasakla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
