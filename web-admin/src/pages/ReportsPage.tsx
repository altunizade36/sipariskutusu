import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Report {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  status: string;
  created_at: string;
  reporter_name: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase.rpc('get_open_reports_admin', { p_limit: 100, p_offset: 0 });
    setReports((data ?? []) as Report[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function resolve(id: string, status: 'resolved' | 'rejected', resolverNote?: string) {
    setActing(true);
    await supabase.rpc('review_report_admin', {
      p_report_id: id,
      p_status: status,
      p_review_note: resolverNote ?? null,
    });
    setNoteId(null);
    setNote('');
    await load();
    setActing(false);
  }

  return (
    <div>
      <h1 className="page-title">Şikayet Yönetimi</h1>

      {loading ? (
        <div className="loading">Yükleniyor…</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Tür</th>
                <th>Hedef ID</th>
                <th>Gerekçe</th>
                <th>Bildiren</th>
                <th>Durum</th>
                <th>Tarih</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr className="empty-row"><td colSpan={6}>Açık şikayet yok</td></tr>
              ) : reports.map(r => (
                <tr key={r.id}>
                  <td>{r.target_type}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.target_id.slice(0, 8)}…</td>
                  <td>{r.reason}</td>
                  <td>{r.reporter_name}</td>
                  <td><span className={`badge badge-${r.status === 'pending' ? 'open' : 'resolved'}`}>{r.status}</span></td>
                  <td>{new Date(r.created_at).toLocaleDateString('tr-TR')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-success" disabled={acting} onClick={() => setNoteId(r.id)}>Çözüldü</button>
                      <button className="btn btn-ghost"   disabled={acting} onClick={() => resolve(r.id, 'rejected')}>Geçersiz</button>
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
            <h3>Çözüm Notu</h3>
            <div className="form-group">
              <label>Not (opsiyonel)</label>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Yapılan işlemi açıklayın" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setNoteId(null)}>İptal</button>
              <button className="btn btn-success" disabled={acting} onClick={() => resolve(noteId, 'resolved', note)}>Onayla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
