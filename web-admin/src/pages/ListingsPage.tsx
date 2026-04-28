import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import CriticalActionModal from '../components/CriticalActionModal';

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
type BulkAction = 'approve' | 'reject' | null;

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkAction>(null);
  const [bulkRejectReason, setBulkRejectReason] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('get_pending_listings_admin', {
      p_limit: 100,
      p_offset: 0,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data) {
      if (filter === 'pending') {
        setListings(data as Listing[]);
      } else {
        const { data: other, error: otherErr } = await supabase
          .from('listings')
          .select(`
            id, title, price, status, created_at,
            profiles (full_name, username)
          `)
          .eq('status', filter)
          .order('created_at', { ascending: false })
          .limit(100);

        if (otherErr) {
          setError(otherErr.message);
          setLoading(false);
          return;
        }

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

    setSelectedIds([]);
    setLastUpdated(new Date().toISOString());
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [filter]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      void load();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, filter]);

  async function approve(id: string) {
    setActing(true);
    setNotice(null);
    await supabase.rpc('review_listing_admin', {
      p_listing_id: id,
      p_action: 'approve',
      p_reason: null,
    });
    await load();
    setNotice('Ilan onaylandi.');
    setActing(false);
  }

  async function reject() {
    if (!rejectId) return;
    setActing(true);
    setNotice(null);
    await supabase.rpc('review_listing_admin', {
      p_listing_id: rejectId,
      p_action: 'reject',
      p_reason: rejectReason || 'Kural ihlali',
    });
    setRejectId(null);
    setRejectReason('');
    await load();
    setNotice('Ilan reddedildi.');
    setActing(false);
  }

  const allSelected = useMemo(() => {
    if (listings.length === 0) return false;
    return listings.every(l => selectedIds.includes(l.id));
  }, [listings, selectedIds]);

  function toggleAll() {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(listings.map(l => l.id));
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
      const { error: actErr } = await supabase.rpc('review_listing_admin', {
        p_listing_id: id,
        p_action: bulkAction,
        p_reason: bulkAction === 'reject' ? bulkRejectReason || 'Toplu red' : null,
      });

      if (actErr) failed += 1;
      else success += 1;
    }

    setBulkAction(null);
    setBulkRejectReason('');
    setSelectedIds([]);
    await load();
    setNotice(`Toplu islem tamamlandi. Basarili: ${success}, Hatali: ${failed}`);
    setActing(false);
  }

  return (
    <div>
      <h1 className="page-title">Ilan Yonetimi</h1>

      <div className="toolbar-row">
        {(['pending', 'active', 'rejected'] as FilterStatus[]).map(s => (
          <button
            key={s}
            className={`btn ${filter === s ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(s)}
          >
            {s === 'pending' ? 'Onay Bekliyor' : s === 'active' ? 'Aktif' : 'Reddedilmis'}
          </button>
        ))}
        <button className={`btn ${autoRefresh ? 'btn-success' : 'btn-ghost'}`} onClick={() => setAutoRefresh(v => !v)}>
          {autoRefresh ? 'Canli Acik' : 'Canli Kapali'}
        </button>
        <button className="btn btn-ghost" onClick={() => void load()}>
          Yenile
        </button>
      </div>

      {filter === 'pending' && (
        <div className="toolbar-row" style={{ marginTop: -6 }}>
          <button className="btn btn-success" disabled={acting || selectedIds.length === 0} onClick={() => setBulkAction('approve')}>
            Toplu Onay ({selectedIds.length})
          </button>
          <button className="btn btn-danger" disabled={acting || selectedIds.length === 0} onClick={() => setBulkAction('reject')}>
            Toplu Red ({selectedIds.length})
          </button>
        </div>
      )}

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
                {filter === 'pending' && (
                  <th style={{ width: 40 }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  </th>
                )}
                <th>Baslik</th>
                <th>Fiyat</th>
                <th>Satici</th>
                <th>Tarih</th>
                <th>Durum</th>
                {filter === 'pending' && <th>Islem</th>}
              </tr>
            </thead>
            <tbody>
              {listings.length === 0 ? (
                <tr className="empty-row"><td colSpan={filter === 'pending' ? 7 : 6}>Kayit yok</td></tr>
              ) : listings.map(l => (
                <tr key={l.id} className={selectedIds.includes(l.id) ? 'row-selected' : ''}>
                  {filter === 'pending' && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(l.id)}
                        onChange={() => toggleOne(l.id)}
                      />
                    </td>
                  )}
                  <td>{l.title}</td>
                  <td>{Number(l.price).toLocaleString('tr-TR')} TL</td>
                  <td>{l.user_name}</td>
                  <td>{new Date(l.created_at).toLocaleDateString('tr-TR')}</td>
                  <td>
                    <span className={`badge badge-${l.status}`}>{l.status}</span>
                  </td>
                  {filter === 'pending' && (
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-success" disabled={acting} onClick={() => void approve(l.id)}>Onayla</button>
                        <button className="btn btn-danger" disabled={acting} onClick={() => { setRejectId(l.id); setRejectReason(''); }}>Reddet</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejectId && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Ilani Reddet</h3>
            <div className="form-group">
              <label>Red Gerekcesi</label>
              <input
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Opsiyonel aciklama"
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setRejectId(null)}>Iptal</button>
              <button className="btn btn-danger" disabled={acting} onClick={() => void reject()}>Reddet</button>
            </div>
          </div>
        </div>
      )}

      <CriticalActionModal
        open={bulkAction !== null}
        title={bulkAction === 'approve' ? 'Toplu Onay Islemi' : 'Toplu Red Islemi'}
        description={
          bulkAction === 'approve'
            ? `${selectedIds.length} ilan toplu olarak onaylanacak.`
            : `${selectedIds.length} ilan toplu olarak reddedilecek.`
        }
        confirmLabel={bulkAction === 'approve' ? 'Toplu Onayla' : 'Toplu Reddet'}
        confirmClassName={bulkAction === 'approve' ? 'btn-success' : 'btn-danger'}
        requirePhrase={bulkAction === 'approve' ? 'ONAYLA' : 'REDDET'}
        extra={
          bulkAction === 'reject' ? (
            <div className="form-group" style={{ marginTop: 12 }}>
              <label>Toplu red gerekcesi</label>
              <input
                value={bulkRejectReason}
                onChange={e => setBulkRejectReason(e.target.value)}
                placeholder="Tum ilanlar icin ortak gerekce"
              />
            </div>
          ) : null
        }
        onCancel={() => {
          if (acting) return;
          setBulkAction(null);
          setBulkRejectReason('');
        }}
        onConfirm={runBulk}
        busy={acting}
      />
    </div>
  );
}
