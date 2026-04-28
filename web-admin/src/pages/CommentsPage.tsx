import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Comment {
  id: string;
  content: string;
  is_hidden: boolean;
  created_at: string;
  listing_id: string;
  user_id: string;
  user_name?: string;
}

export default function CommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('listing_comments')
      .select(`
        id, content, is_hidden, created_at, listing_id, user_id,
        profiles (full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    setComments(
      (data ?? []).map((c: any) => ({
        id: c.id,
        content: c.content,
        is_hidden: c.is_hidden,
        created_at: c.created_at,
        listing_id: c.listing_id,
        user_id: c.user_id,
        user_name: c.profiles?.full_name ?? 'Anonim',
      })),
    );
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

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

  return (
    <div>
      <h1 className="page-title">Yorum Yönetimi</h1>

      {loading ? (
        <div className="loading">Yükleniyor…</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>İçerik</th>
                <th>Kullanıcı</th>
                <th>Tarih</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {comments.length === 0 ? (
                <tr className="empty-row"><td colSpan={5}>Yorum yok</td></tr>
              ) : comments.map(c => (
                <tr key={c.id} style={{ opacity: c.is_hidden ? 0.5 : 1 }}>
                  <td style={{ maxWidth: 300, wordBreak: 'break-word' }}>{c.content}</td>
                  <td>{c.user_name}</td>
                  <td>{new Date(c.created_at).toLocaleDateString('tr-TR')}</td>
                  <td>
                    <span className={`badge ${c.is_hidden ? 'badge-rejected' : 'badge-active'}`}>
                      {c.is_hidden ? 'Gizli' : 'Görünür'}
                    </span>
                  </td>
                  <td>
                    {c.is_hidden ? (
                      <button className="btn btn-success" disabled={acting} onClick={() => unhide(c.id)}>Göster</button>
                    ) : (
                      <button className="btn btn-warn" disabled={acting} onClick={() => hide(c.id)}>Gizle</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
