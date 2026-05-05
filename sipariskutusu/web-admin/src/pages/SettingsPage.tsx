import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface PlatformStats {
  totalUsers: number;
  totalListings: number;
  totalStores: number;
  pendingListings: number;
  openReports: number;
}

interface AnnouncementRow {
  id: string;
  message: string;
  is_active: boolean;
  created_at: string;
}

export default function SettingsPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [savingAnn, setSavingAnn] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // System health toggles (local state — would connect to a settings table in production)
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [newRegistrations, setNewRegistrations] = useState(true);
  const [newListings, setNewListings] = useState(true);
  const [moderationRequired, setModerationRequired] = useState(true);

  async function loadStats() {
    const [
      { count: totalUsers },
      { count: totalListings },
      { count: totalStores },
      { count: pendingListings },
      { count: openReports },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('listings').select('*', { count: 'exact', head: true }),
      supabase.from('stores').select('*', { count: 'exact', head: true }),
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    setStats({
      totalUsers: totalUsers ?? 0,
      totalListings: totalListings ?? 0,
      totalStores: totalStores ?? 0,
      pendingListings: pendingListings ?? 0,
      openReports: openReports ?? 0,
    });
  }

  async function loadAnnouncements() {
    // Check if platform_announcements table exists
    const { data, error } = await supabase
      .from('platform_announcements' as any)
      .select('id, message, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setAnnouncements(data as AnnouncementRow[]);
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    await Promise.all([loadStats(), loadAnnouncements()]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function addAnnouncement() {
    const msg = newAnnouncement.trim();
    if (!msg) return;
    setSavingAnn(true);
    const { error } = await supabase
      .from('platform_announcements' as any)
      .insert({ message: msg, is_active: true });
    if (error) {
      setNotice('Tablo mevcut değil — önce migration çalıştırın.');
    } else {
      setNewAnnouncement('');
      setNotice('Duyuru eklendi.');
      await loadAnnouncements();
    }
    setTimeout(() => setNotice(null), 4000);
    setSavingAnn(false);
  }

  async function toggleAnnouncement(id: string, current: boolean) {
    await supabase
      .from('platform_announcements' as any)
      .update({ is_active: !current })
      .eq('id', id);
    await loadAnnouncements();
  }

  async function deleteAnnouncement(id: string) {
    await supabase
      .from('platform_announcements' as any)
      .delete()
      .eq('id', id);
    await loadAnnouncements();
  }

  function showNotice(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Platform Ayarları</h1>
          <p className="page-sub">Sistem kontrolü, özellik bayrakları ve duyuru yönetimi</p>
        </div>
        <button className="btn btn-primary" onClick={() => void load()} disabled={loading}>Yenile</button>
      </div>

      {notice && <div className="success-msg">{notice}</div>}
      {error && <div className="error-banner">Hata: {error}</div>}

      {/* Platform Overview */}
      {stats && (
        <div className="settings-stats-row">
          <div className="settings-stat"><div className="settings-stat-val">{stats.totalUsers.toLocaleString('tr-TR')}</div><div className="settings-stat-lbl">Kullanıcı</div></div>
          <div className="settings-stat"><div className="settings-stat-val">{stats.totalListings.toLocaleString('tr-TR')}</div><div className="settings-stat-lbl">İlan</div></div>
          <div className="settings-stat"><div className="settings-stat-val">{stats.totalStores.toLocaleString('tr-TR')}</div><div className="settings-stat-lbl">Mağaza</div></div>
          <div className="settings-stat" style={{ borderColor: stats.pendingListings > 10 ? 'var(--warn)' : 'var(--border)' }}>
            <div className="settings-stat-val" style={{ color: stats.pendingListings > 10 ? 'var(--warn)' : undefined }}>{stats.pendingListings}</div>
            <div className="settings-stat-lbl">Onay Bekliyor</div>
          </div>
          <div className="settings-stat" style={{ borderColor: stats.openReports > 5 ? 'var(--danger)' : 'var(--border)' }}>
            <div className="settings-stat-val" style={{ color: stats.openReports > 5 ? 'var(--danger)' : undefined }}>{stats.openReports}</div>
            <div className="settings-stat-lbl">Açık Şikayet</div>
          </div>
        </div>
      )}

      <div className="settings-grid">
        {/* Feature Flags */}
        <div className="card settings-section">
          <div className="section-title">Özellik Bayrakları</div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
            Bu ayarlar görsel olarak durumu yansıtır. Kalıcı etki için backend config güncellemesi gerekir.
          </p>

          {[
            { label: 'Bakım Modu', sub: 'Tüm kullanıcıları geçici olarak kilitler', val: maintenanceMode, set: setMaintenanceMode, danger: true },
            { label: 'Yeni Kayıt', sub: 'Yeni kullanıcı kaydına izin verir', val: newRegistrations, set: setNewRegistrations, danger: false },
            { label: 'Yeni İlan Verme', sub: 'Satıcıların ilan eklemesine izin verir', val: newListings, set: setNewListings, danger: false },
            { label: 'Moderasyon Zorunlu', sub: 'İlanlar admin onayı olmadan yayına girmez', val: moderationRequired, set: setModerationRequired, danger: false },
          ].map(f => (
            <div key={f.label} className="settings-toggle-row">
              <div className="settings-toggle-info">
                <div className="settings-toggle-label">{f.label}</div>
                <div className="settings-toggle-sub">{f.sub}</div>
              </div>
              <button
                className={`toggle-btn ${f.val ? (f.danger ? 'toggle-on-danger' : 'toggle-on') : 'toggle-off'}`}
                onClick={() => {
                  f.set(!f.val);
                  showNotice(`${f.label}: ${!f.val ? 'Açık' : 'Kapalı'}`);
                }}
              >
                {f.val ? 'Açık' : 'Kapalı'}
              </button>
            </div>
          ))}
        </div>

        {/* Announcements */}
        <div className="card settings-section">
          <div className="section-title">Platform Duyuruları</div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
            Uygulamada gösterilecek duyuruları buradan yönetin. Önce <code>platform_announcements</code> tablosunu oluşturun.
          </p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              className="search-input"
              style={{ flex: 1 }}
              type="text"
              placeholder="Yeni duyuru metni…"
              value={newAnnouncement}
              onChange={e => setNewAnnouncement(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void addAnnouncement()}
            />
            <button className="btn btn-primary" onClick={() => void addAnnouncement()} disabled={savingAnn || !newAnnouncement.trim()}>
              Ekle
            </button>
          </div>

          {announcements.length === 0 ? (
            <div className="small-empty">Duyuru yok</div>
          ) : announcements.map(ann => (
            <div key={ann.id} className="announcement-row">
              <div style={{ flex: 1, fontSize: 13 }}>{ann.message}</div>
              <span className={`badge ${ann.is_active ? 'badge-active' : 'badge-rejected'}`} style={{ marginRight: 8 }}>
                {ann.is_active ? 'Aktif' : 'Pasif'}
              </span>
              <button
                className={`btn ${ann.is_active ? 'btn-warn' : 'btn-success'}`}
                style={{ fontSize: 11, marginRight: 4 }}
                onClick={() => void toggleAnnouncement(ann.id, ann.is_active)}
              >
                {ann.is_active ? 'Durdur' : 'Etkinleştir'}
              </button>
              <button
                className="btn btn-danger"
                style={{ fontSize: 11 }}
                onClick={() => void deleteAnnouncement(ann.id)}
              >
                Sil
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* DB info */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title">Sistem Bilgisi</div>
        <table>
          <tbody>
            {[
              ['Supabase URL', import.meta.env.VITE_SUPABASE_URL ?? '—'],
              ['Ortam', import.meta.env.MODE ?? 'unknown'],
              ['Panel Versiyonu', '2.0.0'],
              ['Son Yükleme', new Date().toLocaleDateString('tr-TR')],
            ].map(([k, v]) => (
              <tr key={k}>
                <td style={{ fontWeight: 600, width: 200 }}>{k}</td>
                <td style={{ color: 'var(--muted)', fontSize: 12, wordBreak: 'break-all' }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
