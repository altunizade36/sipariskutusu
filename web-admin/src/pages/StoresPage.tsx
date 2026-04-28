import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import CriticalActionModal from '../components/CriticalActionModal';

interface Store {
  id: string;
  name: string;
  username: string | null;
  city: string | null;
  category_id: string | null;
  is_active: boolean;
  is_verified: boolean;
  follower_count: number;
  rating: number;
  rating_count: number;
  created_at: string;
  seller_name: string;
  seller_id: string;
  listing_count: number;
}

type FilterStatus = 'all' | 'active' | 'inactive' | 'verified' | 'unverified';
type BulkAction = 'activate' | 'deactivate' | 'verify' | 'unverify' | null;

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkAction>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('stores')
      .select(`
        id, name, username, city, category_id,
        is_active, is_verified, follower_count, rating, rating_count, created_at, seller_id,
        profiles!stores_seller_id_fkey (full_name, username)
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Get listing counts per store
    const { data: listingCounts } = await supabase
      .from('listings')
      .select('store_id')
      .not('store_id', 'is', null)
      .limit(10000);

    const countMap: Record<string, number> = {};
    (listingCounts ?? []).forEach((l: any) => {
      if (l.store_id) countMap[l.store_id] = (countMap[l.store_id] ?? 0) + 1;
    });

    setStores(
      (data ?? []).map((s: any) => ({
        id: s.id,
        name: s.name,
        username: s.username,
        city: s.city,
        category_id: s.category_id,
        is_active: s.is_active,
        is_verified: s.is_verified,
        follower_count: s.follower_count ?? 0,
        rating: s.rating ?? 0,
        rating_count: s.rating_count ?? 0,
        created_at: s.created_at,
        seller_name: s.profiles?.full_name ?? s.profiles?.username ?? 'Anonim',
        seller_id: s.seller_id,
        listing_count: countMap[s.id] ?? 0,
      })),
    );
    setLastUpdated(new Date().toLocaleTimeString('tr-TR'));
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => { void load(); }, 20_000);
    return () => clearInterval(t);
  }, [autoRefresh]);

  const filtered = useMemo(() => {
    let list = stores;
    if (filter === 'active')    list = list.filter(s => s.is_active);
    if (filter === 'inactive')  list = list.filter(s => !s.is_active);
    if (filter === 'verified')  list = list.filter(s => s.is_verified);
    if (filter === 'unverified') list = list.filter(s => !s.is_verified);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.username ?? '').toLowerCase().includes(q) ||
        s.seller_name.toLowerCase().includes(q) ||
        (s.city ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [stores, filter, search]);

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleAll() {
    if (selectedIds.length === filtered.length) setSelectedIds([]);
    else setSelectedIds(filtered.map(s => s.id));
  }

  async function doBulk(action: BulkAction) {
    if (!action || selectedIds.length === 0) return;
    const count = selectedIds.length;
    setActing(true);
    setBulkAction(null);

    const updates: Record<string, boolean> = {
      activate:   { is_active: true },
      deactivate: { is_active: false },
      verify:     { is_verified: true },
      unverify:   { is_verified: false },
    }[action] as any;

    await supabase.from('stores').update(updates).in('id', selectedIds);

    setSelectedIds([]);
    const labels: Record<string, string> = {
      activate: 'aktif edildi', deactivate: 'devre dışı bırakıldı',
      verify: 'doğrulandı', unverify: 'doğrulama kaldırıldı',
    };
    setNotice(`${count} mağaza ${labels[action]}.`);
    setTimeout(() => setNotice(null), 4000);
    await load();
    setActing(false);
  }

  async function toggleSingle(id: string, field: 'is_active' | 'is_verified', current: boolean) {
    setActing(true);
    await supabase.from('stores').update({ [field]: !current }).eq('id', id);
    await load();
    setActing(false);
  }

  const activeCount   = stores.filter(s => s.is_active).length;
  const verifiedCount = stores.filter(s => s.is_verified).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mağaza Yönetimi</h1>
          <p className="page-sub">
            Toplam <strong>{stores.length}</strong> mağaza —{' '}
            <span style={{ color: 'var(--success)' }}>{activeCount} aktif</span>,{' '}
            <span style={{ color: '#2563eb' }}>{verifiedCount} doğrulanmış</span>
          </p>
        </div>
        <div className="header-actions">
          <button
            className={`btn ${autoRefresh ? 'btn-success' : 'btn-ghost'}`}
            onClick={() => setAutoRefresh(v => !v)}
          >
            {autoRefresh ? '⟳ Otomatik: Açık' : '⟳ Otomatik: Kapalı'}
          </button>
          <button className="btn btn-primary" onClick={() => void load()} disabled={loading}>Yenile</button>
        </div>
      </div>

      {lastUpdated && <div className="last-updated">Son güncelleme: {lastUpdated}</div>}
      {error && <div className="error-banner">Hata: {error}</div>}
      {notice && <div className="success-msg">{notice}</div>}

      <div className="filter-bar">
        {(['all', 'active', 'inactive', 'verified', 'unverified'] as FilterStatus[]).map(f => (
          <button
            key={f}
            className={`btn ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setFilter(f); setSelectedIds([]); }}
          >
            {f === 'all' ? 'Tümü' : f === 'active' ? 'Aktif' : f === 'inactive' ? 'Devre Dışı' : f === 'verified' ? 'Doğrulanmış' : 'Doğrulanmamış'}
          </button>
        ))}
        <input
          className="search-input"
          type="search"
          placeholder="Mağaza adı, kullanıcı adı veya şehir ara…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {selectedIds.length > 0 && (
        <div className="select-bar">
          <span>{selectedIds.length} mağaza seçildi</span>
          <button className="btn btn-success" onClick={() => setBulkAction('activate')} disabled={acting}>Toplu Aktifleştir</button>
          <button className="btn btn-warn" onClick={() => setBulkAction('deactivate')} disabled={acting}>Toplu Devre Dışı</button>
          <button className="btn btn-primary" onClick={() => setBulkAction('verify')} disabled={acting}>Toplu Doğrula</button>
          <button className="btn btn-ghost" onClick={() => setBulkAction('unverify')} disabled={acting}>Doğrulama Kaldır</button>
          <button className="btn btn-ghost" onClick={() => setSelectedIds([])}>İptal</button>
        </div>
      )}

      {loading ? (
        <div className="loading">Yükleniyor…</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th className="checkbox-cell">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                  />
                </th>
                <th>Mağaza</th>
                <th>Satıcı</th>
                <th>Şehir</th>
                <th>İlan</th>
                <th>Takipçi</th>
                <th>Puan</th>
                <th>Durum</th>
                <th>Doğrulama</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr className="empty-row"><td colSpan={10}>Mağaza bulunamadı</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className={selectedIds.includes(s.id) ? 'selected-row' : ''}>
                  <td className="checkbox-cell">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(s.id)}
                      onChange={() => toggleSelect(s.id)}
                    />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    {s.username && (
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>@{s.username}</div>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{s.seller_name}</td>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: 12 }}>{s.city ?? '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{s.listing_count}</td>
                  <td style={{ textAlign: 'right' }}>{s.follower_count.toLocaleString('tr-TR')}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                    {s.rating_count > 0 ? `${Number(s.rating).toFixed(1)} (${s.rating_count})` : '—'}
                  </td>
                  <td>
                    <span className={`badge ${s.is_active ? 'badge-active' : 'badge-rejected'}`}>
                      {s.is_active ? 'Aktif' : 'Devre Dışı'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${s.is_verified ? 'badge-open' : ''}`} style={s.is_verified ? {} : { background: '#f3f4f6', color: '#6b7280' }}>
                      {s.is_verified ? '✓ Doğrulandı' : 'Doğrulanmamış'}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className={`btn ${s.is_active ? 'btn-warn' : 'btn-success'}`}
                      disabled={acting}
                      onClick={() => void toggleSingle(s.id, 'is_active', s.is_active)}
                      style={{ marginRight: 4, fontSize: 11 }}
                    >
                      {s.is_active ? 'Durdur' : 'Aktifleştir'}
                    </button>
                    <button
                      className={`btn ${s.is_verified ? 'btn-ghost' : 'btn-primary'}`}
                      disabled={acting}
                      onClick={() => void toggleSingle(s.id, 'is_verified', s.is_verified)}
                      style={{ fontSize: 11 }}
                    >
                      {s.is_verified ? 'Doğrulamayı Kaldır' : 'Doğrula'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CriticalActionModal
        open={bulkAction !== null}
        title={
          bulkAction === 'activate' ? `${selectedIds.length} Mağazayı Aktifleştir` :
          bulkAction === 'deactivate' ? `${selectedIds.length} Mağazayı Devre Dışı Bırak` :
          bulkAction === 'verify' ? `${selectedIds.length} Mağazayı Doğrula` :
          `${selectedIds.length} Mağazanın Doğrulamasını Kaldır`
        }
        description={`${selectedIds.length} seçili mağazaya toplu işlem uygulanacak.`}
        confirmLabel="Onayla"
        requirePhrase="ONAYLA"
        onConfirm={() => void doBulk(bulkAction)}
        onCancel={() => setBulkAction(null)}
      />
    </div>
  );
}
