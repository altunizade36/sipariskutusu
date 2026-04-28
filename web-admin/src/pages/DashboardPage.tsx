import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Stats {
  pending_listings: number;
  open_reports: number;
  total_users: number;
  banned_users: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    async function load() {
      const [
        { count: pending_listings },
        { count: open_reports },
        { count: total_users },
        { count: banned_users },
      ] = await Promise.all([
        supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_banned', true),
      ]);
      setStats({
        pending_listings: pending_listings ?? 0,
        open_reports: open_reports ?? 0,
        total_users: total_users ?? 0,
        banned_users: banned_users ?? 0,
      });
    }
    void load();
  }, []);

  return (
    <div>
      <h1 className="page-title">Genel Özet</h1>
      {!stats ? (
        <div className="loading">Yükleniyor…</div>
      ) : (
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-val">{stats.pending_listings}</div>
            <div className="stat-label">Onay bekleyen ilan</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{stats.open_reports}</div>
            <div className="stat-label">Açık şikayet</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{stats.total_users}</div>
            <div className="stat-label">Toplam kullanıcı</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{stats.banned_users}</div>
            <div className="stat-label">Yasaklı kullanıcı</div>
          </div>
        </div>
      )}
    </div>
  );
}
