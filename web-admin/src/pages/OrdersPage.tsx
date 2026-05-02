import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Order {
  id: string;
  buyer_id: string | null;
  seller_id: string | null;
  listing_id: string | null;
  status: string;
  total_amount: number | null;
  created_at: string;
  buyer_name?: string;
  seller_name?: string;
  listing_title?: string;
}

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Bekliyor', confirmed: 'Onaylandı', shipped: 'Kargoda',
  delivered: 'Teslim Edildi', cancelled: 'İptal', refunded: 'İade',
};
const STATUS_CLASS: Record<string, string> = {
  pending: 'badge-open', confirmed: 'badge-active', shipped: 'badge-pending',
  delivered: 'badge-active', cancelled: 'badge-rejected', refunded: 'badge-rejected',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noTable, setNoTable] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Order | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from('orders')
      .select(`
        id, buyer_id, seller_id, listing_id, status, total_amount, created_at,
        buyer:profiles!orders_buyer_id_fkey(full_name),
        seller:profiles!orders_seller_id_fkey(full_name),
        listing:listings(title)
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    if (qErr) {
      if (qErr.code === '42P01' || qErr.message?.includes('does not exist')) {
        setNoTable(true);
      } else {
        setError(qErr.message);
      }
      setLoading(false);
      return;
    }

    setOrders((data ?? []).map((o: any) => ({
      id: o.id,
      buyer_id: o.buyer_id,
      seller_id: o.seller_id,
      listing_id: o.listing_id,
      status: o.status ?? 'pending',
      total_amount: o.total_amount,
      created_at: o.created_at,
      buyer_name: o.buyer?.full_name ?? '—',
      seller_name: o.seller?.full_name ?? '—',
      listing_title: o.listing?.title ?? '—',
    })));
    setLastUpdated(new Date().toLocaleTimeString('tr-TR'));
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    let list = orders;
    if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        (o.buyer_name ?? '').toLowerCase().includes(q) ||
        (o.seller_name ?? '').toLowerCase().includes(q) ||
        (o.listing_title ?? '').toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, statusFilter, search]);

  const totalRevenue = useMemo(() =>
    orders.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.total_amount ?? 0), 0)
  , [orders]);

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    orders.forEach(o => { m[o.status] = (m[o.status] ?? 0) + 1; });
    return m;
  }, [orders]);

  if (noTable) {
    return (
      <div>
        <h1 className="page-title">Sipariş Yönetimi</h1>
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
          <h3 style={{ marginTop: 0, color: '#374151' }}>Sipariş sistemi henüz aktif değil</h3>
          <p style={{ color: '#6b7280', maxWidth: 400, margin: '0 auto' }}>
            Supabase'de <code>orders</code> tablosu oluşturulduktan sonra siparişler burada yönetilebilir.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sipariş Yönetimi</h1>
          <p className="page-sub">
            Toplam <strong>{orders.length}</strong> sipariş —{' '}
            Teslim edilen gelir: <strong style={{ color: '#15803d' }}>
              {totalRevenue.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
            </strong>
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => void load()} disabled={loading}>Yenile</button>
        </div>
      </div>

      {lastUpdated && <div className="last-updated">Son güncelleme: {lastUpdated}</div>}
      {error && <div className="error-banner">Hata: {error}</div>}

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)', marginBottom: 16 }}>
        {Object.entries(STATUS_LABELS).map(([st, label]) => (
          <div
            key={st}
            className="kpi-card"
            style={{ cursor: 'pointer', borderTop: `3px solid ${st === 'delivered' ? '#15803d' : st === 'pending' ? '#d97706' : st === 'cancelled' ? '#dc2626' : '#6b7280'}` }}
            onClick={() => setStatusFilter(st as StatusFilter)}
          >
            <div className="kpi-value" style={{ fontSize: 22 }}>{(statusCounts[st] ?? 0).toLocaleString('tr-TR')}</div>
            <div className="kpi-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="filter-bar">
        <button className={`btn ${statusFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStatusFilter('all')}>Tümü ({orders.length})</button>
        {Object.entries(STATUS_LABELS).map(([st, label]) => (
          <button key={st} className={`btn ${statusFilter === st ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStatusFilter(st as StatusFilter)}>
            {label} {statusCounts[st] ? `(${statusCounts[st]})` : ''}
          </button>
        ))}
        <input
          className="search-input"
          placeholder="Alıcı, satıcı veya ilan ara..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginLeft: 'auto', width: 260 }}
        />
      </div>

      {loading ? (
        <div className="loading">Yükleniyor…</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Sipariş ID</th>
                <th>İlan</th>
                <th>Alıcı</th>
                <th>Satıcı</th>
                <th>Tutar</th>
                <th>Durum</th>
                <th>Tarih</th>
                <th>Detay</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr className="empty-row"><td colSpan={8}>Sipariş bulunamadı</td></tr>
              ) : filtered.map(o => (
                <tr key={o.id}>
                  <td><code style={{ fontSize: 11, color: '#6b7280' }}>{o.id.slice(0, 8)}…</code></td>
                  <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.listing_title}</td>
                  <td>{o.buyer_name}</td>
                  <td>{o.seller_name}</td>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {o.total_amount != null ? o.total_amount.toLocaleString('tr-TR') + ' ₺' : '—'}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_CLASS[o.status] ?? 'badge-pending'}`}>
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: '#6b7280' }}>{new Date(o.created_at).toLocaleDateString('tr-TR')}</td>
                  <td>
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setDetail(o)}>
                      Detay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Sipariş Detayı</h3>
              <button className="modal-close" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div style={{ display: 'grid', gap: 10, padding: '8px 0' }}>
              <div><span style={{ color: '#6b7280', fontSize: 12 }}>Sipariş ID:</span><br /><code style={{ fontSize: 12 }}>{detail.id}</code></div>
              <div><span style={{ color: '#6b7280', fontSize: 12 }}>İlan:</span><br /><strong>{detail.listing_title}</strong></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><span style={{ color: '#6b7280', fontSize: 12 }}>Alıcı:</span><br />{detail.buyer_name}</div>
                <div><span style={{ color: '#6b7280', fontSize: 12 }}>Satıcı:</span><br />{detail.seller_name}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><span style={{ color: '#6b7280', fontSize: 12 }}>Tutar:</span><br /><strong style={{ color: '#15803d', fontSize: 18 }}>{detail.total_amount != null ? detail.total_amount.toLocaleString('tr-TR') + ' ₺' : '—'}</strong></div>
                <div><span style={{ color: '#6b7280', fontSize: 12 }}>Durum:</span><br /><span className={`badge ${STATUS_CLASS[detail.status] ?? 'badge-pending'}`}>{STATUS_LABELS[detail.status] ?? detail.status}</span></div>
              </div>
              <div><span style={{ color: '#6b7280', fontSize: 12 }}>Tarih:</span><br />{new Date(detail.created_at).toLocaleString('tr-TR')}</div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setDetail(null)}>Kapat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
