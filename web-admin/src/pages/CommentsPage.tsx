import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import CriticalActionModal from '../components/CriticalActionModal';

interface Comment {
  id: string;
  content: string;
  is_hidden: boolean;
  created_at: string;
  listing_id: string;
  user_id: string;
  user_name: string;
}

type FilterVis = 'all' | 'visible' | 'hidden';
type BulkAction = 'hide' | 'show' | null;

export default function CommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterVis>('all');
  const [search, setSearch] = useState('');
  const [acting, setActing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkAction>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('listing_comments')
      .select('id, content, is_hidden, created_at, listing_id, user_id, profiles (full_name, username)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setComments(
      (data ?? []).map((c: any) => ({
        id: c.id,
        content: c.content,
        is_hidden: c.is_hidden,
        created_at: c.created_at,
        listing_id: c.listing_id,
        user_id: c.user_id,
        user_name: c.profiles?.full_name ?? c.profiles?.username ?? 'Anonim',
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
    let list = comments;
    if (filter === 'visible') list = list.filter(c => !c.is_hidden);
    if (filter === 'hidden')  list = list.filter(c => c.is_hidden);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.content.toLowerCase().includes(q) ||
        c.user_name.toLowerCase().includes(q),
      );
    }
    return list;
  }, [comments, filter, search]);

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleAll() {
    if (selectedIds.length === filtered.length) setSelectedIds([]);
    else setSelectedIds(filtered.map(c => c.id));
  }

  async function hide(id: string) {
    setActing(true);
    await supabase.rpc('hide_listing_comment_admin', { p_comment_id: id });
    await load();
    setActing(false);
  }

  async function unhide(id: string) {
    setActing(true);
    await supabase.from('listing_comments').update({ is_hidden: false }).eq('id', id);
    await load();
    setActing(false);
  }

  async function doBulk(action: BulkAction) {
    if (!action || selectedIds.length === 0) return;
    const count = selectedIds.length;
    setActing(true);
    setBulkAction(null);
    if (action === 'hide') {
      for (const id of selectedIds) {
        await supabase.rpc('hide_listing_comment_admin', { p_comment_id: id });
      }
    } else {
      await supabase
        .from('listing_comments')
        .update({ is_hidden: false })
        .in('id', selectedIds);
    }
    setSelectedIds([]);
    setNotice(`${count} yorum ${action === 'hide' ? 'gizlendi' : 'görünür yapıldı'}.`);
    setTimeout(() => setNotice(null), 4000);
    await load();
    setActing(false);
  }

  const hiddenCount  = comments.filter(c => c.is_hidden).length;
  const visibleCount = comments.filter(c => !c.is_hidden).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Yorum Yönetimi</h1>
          <p className="page-sub">
            Toplam <strong>{comments.length}</strong> yorum —{' '}
            <span style={{ color: 'var(--success)' }}>{visibleCount} görünür</span>,{' '}
            <span style={{ color: 'var(--danger)' }}>{hiddenCount} gizli</span>
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
      {notice && <div className="success-msg">{notice}</div>}

      <div className="filter-bar">
        {(['all', 'visible', 'hidden'] as FilterVis[]).map(f => (
          <button
            key={f}
            className={`btn ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setFilter(f); setSelectedIds([]); }}
          >
            {f === 'all' ? 'Tümü' : f === 'visible' ? 'Görünür' : 'Gizli'}
          </button>
        ))}
        <input
          className="search-input"
          type="search"
          placeholder="İçerik veya kullanıcı ara…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {selectedIds.length > 0 && (
        <div className="select-bar">
          <span>{selectedIds.length} yorum seçildi</span>
          <button className="btn btn-warn" onClick={() => setBulkAction('hide')} disabled={acting}>Toplu Gizle</button>
          <button className="btn btn-success" onClick={() => setBulkAction('show')} disabled={acting}>Toplu Göster</button>
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
                <th>İçerik</th>
                <th>Kullanıcı</th>
                <th>Tarih</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr className="empty-row"><td colSpan={6}>Yorum bulunamadı</td></tr>
              ) : filtered.map(c => (
                <tr
                  key={c.id}
                  style={{ opacity: c.is_hidden ? 0.55 : 1 }}
                  className={selectedIds.includes(c.id) ? 'selected-row' : ''}
                >
                  <td className="checkbox-cell">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(c.id)}
                      onChange={() => toggleSelect(c.id)}
                    />
                  </td>
                  <td style={{ maxWidth: 340, wordBreak: 'break-word', fontSize: 13 }}>
                    {c.content.length > 160 ? c.content.slice(0, 160) + '…' : c.content}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{c.user_name}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {new Date(c.created_at).toLocaleDateString('tr-TR')}
                  </td>
                  <td>
                    <span className={`badge ${c.is_hidden ? 'badge-rejected' : 'badge-active'}`}>
                      {c.is_hidden ? 'Gizli' : 'Görünür'}
                    </span>
                  </td>
                  <td>
                    {c.is_hidden ? (
                      <button className="btn btn-success" disabled={acting} onClick={() => void unhide(c.id)}>Göster</button>
                    ) : (
                      <button className="btn btn-warn" disabled={acting} onClick={() => void hide(c.id)}>Gizle</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CriticalActionModal
        open={bulkAction !== null}
        title={bulkAction === 'hide' ? `${selectedIds.length} Yorumu Gizle` : `${selectedIds.length} Yorumu Göster`}
        description={
          bulkAction === 'hide'
            ? `${selectedIds.length} seçili yorum gizlenecek. Kullanıcılar bu yorumları göremeyecek.`
            : `${selectedIds.length} seçili yorum tekrar görünür yapılacak.`
        }
        confirmLabel="Onayla"
        requirePhrase="ONAYLA"
        onConfirm={() => void doBulk(bulkAction)}
        onCancel={() => setBulkAction(null)}
      />
    </div>
  );
}
