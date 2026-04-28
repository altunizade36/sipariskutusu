import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Listing {
  id: string;
  title: string;
  price: number;
  status: string;
  created_at: string;
  user_name: string;
  cover_url: string | null;
}

type FilterStatus = 'pending' | 'active' | 'rejected';

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_pending_listings_admin', {
      p_limit: 100,
      p_offset: 0,
    });
    if (!error && data) {
      // filter client-side for non-pending statuses since the RPC only returns pending
      if (filter === 'pending') {
        setListings(data as Listing[]);
      } else {
        const { data: other } = await supabase
          .from('listings')
          .select(`
            id, title, price, status, created_at,
            profiles (full_name, username)
          `)
          .eq('status', filter)
          .order('created_at', { ascending: false })
          .limit(100);
        setListings(
          (other ?? []).map((l: any) => ({
            id: l.id,
            title: l.title,
            price: l.price,
            status: l.status,
            created_at: l.created_at,
            user_name: l.profiles?.full_name ?? l.profiles?.username ?? 'Anonim',
            cover_url: null,
          })),
        );
      }
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [filter]);

  async function approve(id: string) {
    setActing(true);
    await supabase.rpc('review_listing_admin', {
      p_listing_id: id,
      p_action: 'approve',
      p_reason: null,
    });
    await load();
    setActing(false);
  }

  async function reject() {
    if (!rejectId) return;
    setActing(true);
    await supabase.rpc('review_listing_admin', {
      p_listing_id: rejectId,
      p_action: 'reject',
      p_reason: rejectReason || 'Kural ihlali',
    });
    setRejectId(null);
    setRejectReason('');
    await load();
    setActing(false);
  }

  return (
    <div>
      <h1 className="page-title">İlan Yönetimi</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['pending', 'active', 'rejected'] as FilterStatus[]).map(s => (
          <button
            key={s}
            className={`btn ${filter === s ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(s)}
          >
            {s === 'pending' ? 'Onay Bekliyor' : s === 'active' ? 'Aktif' : 'Reddedilmiş'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">Yükleniyor…</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Başlık</th>
                <th>Fiyat</th>
                <th>Satıcı</th>
                <th>Tarih</th>
                <th>Durum</th>
                {filter === 'pending' && <th>İşlem</th>}
              </tr>
            </thead>
            <tbody>
              {listings.length === 0 ? (
                <tr className="empty-row"><td colSpan={6}>Kayıt yok</td></tr>
              ) : listings.map(l => (
                <tr key={l.id}>
                  <td>{l.title}</td>
                  <td>₺{Number(l.price).toLocaleString('tr-TR')}</td>
                  <td>{l.user_name}</td>
                  <td>{new Date(l.created_at).toLocaleDateString('tr-TR')}</td>
                  <td>
                    <span className={`badge badge-${l.status}`}>{l.status}</span>
                  </td>
                  {filter === 'pending' && (
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-success" disabled={acting} onClick={() => approve(l.id)}>Onayla</button>
                        <button className="btn btn-danger"  disabled={acting} onClick={() => { setRejectId(l.id); setRejectReason(''); }}>Reddet</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject modal */}
      {rejectId && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>İlanı Reddet</h3>
            <div className="form-group">
              <label>Red Gerekçesi</label>
              <input
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Opsiyonel açıklama"
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setRejectId(null)}>İptal</button>
              <button className="btn btn-danger" disabled={acting} onClick={reject}>Reddet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
