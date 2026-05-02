import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface NotifRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
  profile?: { full_name: string | null; username: string | null };
}

type Target = 'all' | 'seller' | 'buyer' | 'admin';

const TARGET_LABELS: Record<Target, string> = {
  all: 'Tüm Kullanıcılar',
  seller: 'Satıcılar',
  buyer: 'Alıcılar',
  admin: 'Adminler',
};

export default function NotificationsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<Target>('all');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; error?: string } | null>(null);
  const [history, setHistory] = useState<NotifRecord[]>([]);
  const [histLoading, setHistLoading] = useState(true);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  async function loadHistory() {
    setHistLoading(true);
    const { data } = await supabase
      .from('in_app_notifications')
      .select('id, user_id, type, title, body, is_read, created_at, profiles!in_app_notifications_user_id_fkey(full_name, username)')
      .eq('type', 'system')
      .order('created_at', { ascending: false })
      .limit(50);
    setHistory((data ?? []).map((n: any) => ({
      id: n.id,
      user_id: n.user_id,
      type: n.type,
      title: n.title,
      body: n.body,
      is_read: n.is_read,
      created_at: n.created_at,
      profile: n.profiles,
    })));
    setHistLoading(false);
  }

  async function fetchTargetCount(t: Target) {
    setCountLoading(true);
    let q = supabase.from('profiles').select('*', { count: 'exact', head: true });
    if (t !== 'all') q = q.eq('role', t);
    const { count } = await q;
    setUserCount(count ?? 0);
    setCountLoading(false);
  }

  useEffect(() => { void loadHistory(); }, []);
  useEffect(() => { void fetchTargetCount(target); }, [target]);

  async function send() {
    if (!title.trim()) return;
    setSending(true);
    setSendResult(null);

    let profileQuery = supabase.from('profiles').select('id');
    if (target !== 'all') profileQuery = profileQuery.eq('role', target);
    const { data: profiles, error: pErr } = await profileQuery;

    if (pErr || !profiles) {
      setSendResult({ sent: 0, error: pErr?.message ?? 'Kullanıcılar alınamadı' });
      setSending(false);
      return;
    }

    const rows = profiles.map((p: any) => ({
      user_id: p.id,
      type: 'system',
      title: title.trim(),
      body: body.trim() || null,
      is_read: false,
    }));

    const BATCH = 500;
    let sent = 0;
    let lastError: string | undefined;
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error: insErr } = await supabase.from('in_app_notifications').insert(rows.slice(i, i + BATCH));
      if (insErr) { lastError = insErr.message; break; }
      sent += Math.min(BATCH, rows.length - i);
    }

    setSendResult({ sent, error: lastError });
    setTitle('');
    setBody('');
    setSending(false);
    void loadHistory();
  }

  const readRate = history.length
    ? Math.round((history.filter(n => n.is_read).length / history.length) * 100)
    : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bildirim Yönetimi</h1>
          <p className="page-sub">Kullanıcılara toplu in-app bildirim gönder ve geçmişi izle</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div className="card" style={{ padding: 24 }}>
          <div className="section-title" style={{ marginBottom: 16 }}>Yeni Yayın Bildirimi</div>

          <div className="form-group">
            <label>Hedef Kitle</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {(Object.keys(TARGET_LABELS) as Target[]).map(t => (
                <button
                  key={t}
                  className={`btn ${target === t ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 13, padding: '6px 14px' }}
                  onClick={() => setTarget(t)}
                >
                  {TARGET_LABELS[t]}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>
              {countLoading ? 'Sayılıyor…' : `${userCount?.toLocaleString('tr-TR') ?? 0} kullanıcıya gönderilecek`}
            </div>
          </div>

          <div className="form-group">
            <label>Başlık <span style={{ color: '#dc2626' }}>*</span></label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Bildirim başlığı"
              maxLength={100}
            />
            <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>{title.length}/100</div>
          </div>

          <div className="form-group">
            <label>Mesaj (opsiyonel)</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Bildirim içeriği..."
              rows={3}
              maxLength={500}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>{body.length}/500</div>
          </div>

          {title.trim() && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Önizleme</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>🔔 {title}</div>
              {body && <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{body}</div>}
            </div>
          )}

          {sendResult && (
            <div className={sendResult.error ? 'error-banner' : 'success-msg'} style={{ marginBottom: 12 }}>
              {sendResult.error
                ? `Hata: ${sendResult.error}`
                : `✓ ${sendResult.sent.toLocaleString('tr-TR')} kullanıcıya başarıyla gönderildi`}
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={() => void send()}
            disabled={sending || !title.trim()}
          >
            {sending ? 'Gönderiliyor…' : `Gönder → ${TARGET_LABELS[target]}`}
          </button>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <div className="section-title" style={{ marginBottom: 16 }}>İstatistikler</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#f0f9ff', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0369a1' }}>{history.length}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Son 50 Sistem Bildirimi</div>
            </div>
            <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#15803d' }}>{readRate}%</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Okunma Oranı</div>
            </div>
          </div>

          <div className="section-title" style={{ marginBottom: 10, fontSize: 13 }}>Son Gönderilen Bildirimler</div>
          {histLoading ? (
            <div className="loading" style={{ fontSize: 13 }}>Yükleniyor…</div>
          ) : history.length === 0 ? (
            <div className="small-empty">Henüz sistem bildirimi gönderilmedi</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
              {history.slice(0, 20).map(n => (
                <div key={n.id} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{n.title}</div>
                    <span className={`badge ${n.is_read ? 'badge-active' : 'badge-pending'}`} style={{ fontSize: 10, marginLeft: 8 }}>
                      {n.is_read ? 'Okundu' : 'Okunmadı'}
                    </span>
                  </div>
                  {n.body && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>{n.body}</div>}
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                    {n.profile?.full_name ?? n.profile?.username ?? 'Kullanıcı'} · {new Date(n.created_at).toLocaleString('tr-TR')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
