import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import CriticalActionModal from '../components/CriticalActionModal';

interface Report {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  status: string;
  created_at: string;
  reporter_name: string;
}

type BulkAction = 'resolved' | 'rejected' | null;

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkAction>(null);
  const [bulkNote, setBulkNote] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase.rpc('get_open_reports_admin', { p_limit: 100, p_offset: 0 });
    if (qErr) {
      setError(qErr.message);
      setLoading(false);
      return;
    }
    setReports((data ?? []) as Report[]);
    setSelectedIds([]);
    setLastUpdated(new Date().toISOString());
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      void load();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [autoRefresh]);

  async function resolve(id: string, status: 'resolved' | 'rejected', resolverNote?: string) {
    setActing(true);
    setNotice(null);
    await supabase.rpc('review_report_admin', {
      p_report_id: id,
      p_status: status,
      p_review_note: resolverNote ?? null,
    });
    setNoteId(null);
    setNote('');
    await load();
    setNotice(status === 'resolved' ? 'Sikayet cozuldu.' : 'Sikayet gecersiz olarak kapatildi.');
    setActing(false);
  }

  const allSelected = useMemo(() => {
    if (reports.length === 0) return false;
    return reports.every(r => selectedIds.includes(r.id));
  }, [reports, selectedIds]);

  function toggleAll() {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(reports.map(r => r.id));
  }

  function toggleOne(id: string) {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]));
  }

  async function runBulk() {
    if (!bulkAction || selectedIds.length === 0) return;
    setActing(true);
    setNotice(null);
    setError(null);

    let success = 0;
    let failed = 0;

    for (const id of selectedIds) {
      const { error: opErr } = await supabase.rpc('review_report_admin', {
        p_report_id: id,
        p_status: bulkAction,
        p_review_note: bulkNote || null,
      });

      if (opErr) failed += 1;
      else success += 1;
    }

    setBulkAction(null);
    setBulkNote('');
    setSelectedIds([]);
    await load();
    setNotice(`Toplu sikayet islemi tamamlandi. Basarili: ${success}, Hatali: ${failed}`);
    setActing(false);
  }

  return (
    <div>
      <h1 className="page-title">Sikayet Yonetimi</h1>

      <div className="toolbar-row">
        <button className={`btn ${autoRefresh ? 'btn-success' : 'btn-ghost'}`} onClick={() => setAutoRefresh(v => !v)}>
          {autoRefresh ? 'Canli Acik' : 'Canli Kapali'}
        </button>
        <button className="btn btn-ghost" onClick={() => void load()}>
          Yenile
        </button>
        <button className="btn btn-success" disabled={acting || selectedIds.length === 0} onClick={() => setBulkAction('resolved')}>
          Toplu Cozuldu ({selectedIds.length})
        </button>
        <button className="btn btn-warn" disabled={acting || selectedIds.length === 0} onClick={() => setBulkAction('rejected')}>
          Toplu Gecersiz ({selectedIds.length})
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
                <th>Tur</th>
                <th>Hedef ID</th>
                <th>Gerekce</th>
                <th>Bildiren</th>
                <th>Durum</th>
                <th>Tarih</th>
                <th>Islem</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr className="empty-row"><td colSpan={8}>Acik sikayet yok</td></tr>
              ) : reports.map(r => (
                <tr key={r.id} className={selectedIds.includes(r.id) ? 'row-selected' : ''}>
                  <td>
                    <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggleOne(r.id)} />
                  </td>
                  <td>{r.target_type}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.target_id.slice(0, 8)}...</td>
                  <td>{r.reason}</td>
                  <td>{r.reporter_name}</td>
                  <td><span className="badge badge-open">{r.status}</span></td>
                  <td>{new Date(r.created_at).toLocaleDateString('tr-TR')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-success" disabled={acting} onClick={() => setNoteId(r.id)}>Cozuldu</button>
                      <button className="btn btn-ghost" disabled={acting} onClick={() => void resolve(r.id, 'rejected')}>Gecersiz</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {noteId && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Cozum Notu</h3>
            <div className="form-group">
              <label>Not (opsiyonel)</label>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Yapilan islemi aciklayin" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setNoteId(null)}>Iptal</button>
              <button className="btn btn-success" disabled={acting} onClick={() => void resolve(noteId, 'resolved', note)}>Onayla</button>
            </div>
          </div>
        </div>
      )}

      <CriticalActionModal
        open={bulkAction !== null}
        title={bulkAction === 'resolved' ? 'Toplu Cozum Islemi' : 'Toplu Gecersiz Islemi'}
        description={`${selectedIds.length} sikayet icin toplu islem yapilacak.`}
        confirmLabel={bulkAction === 'resolved' ? 'Toplu Cozuldu Yap' : 'Toplu Gecersiz Yap'}
        confirmClassName={bulkAction === 'resolved' ? 'btn-success' : 'btn-warn'}
        requirePhrase={bulkAction === 'resolved' ? 'COZ' : 'GECERSIZ'}
        extra={
          <div className="form-group" style={{ marginTop: 12 }}>
            <label>Toplu islem notu</label>
            <input
              value={bulkNote}
              onChange={e => setBulkNote(e.target.value)}
              placeholder="Opsiyonel not"
            />
          </div>
        }
        onCancel={() => {
          if (acting) return;
          setBulkAction(null);
          setBulkNote('');
        }}
        onConfirm={runBulk}
        busy={acting}
      />
    </div>
  );
}
