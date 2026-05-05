import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface Badges {
  pending: number;
  reports: number;
}

interface NavLink {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  badge?: keyof Badges;
}

interface NavGroup {
  label: string;
  links: NavLink[];
}

const groups: NavGroup[] = [
  {
    label: 'GENEL',
    links: [
      { to: '/', label: 'Dashboard', icon: '⊞', end: true },
      { to: '/analytics', label: 'Analitik', icon: '📈' },
      { to: '/ops', label: 'Operasyon', icon: '⚡' },
    ],
  },
  {
    label: 'İÇERİK',
    links: [
      { to: '/listings', label: 'İlanlar', icon: '📋', badge: 'pending' },
      { to: '/stores', label: 'Mağazalar', icon: '🏪' },
      { to: '/orders', label: 'Siparişler', icon: '📦' },
      { to: '/comments', label: 'Yorumlar', icon: '💬' },
      { to: '/discover', label: 'Keşfet', icon: '🔍' },
    ],
  },
  {
    label: 'KULLANICILAR',
    links: [
      { to: '/users', label: 'Kullanıcılar', icon: '👥' },
      { to: '/reports', label: 'Şikayetler', icon: '🚨', badge: 'reports' },
      { to: '/notifications', label: 'Bildirimler', icon: '🔔' },
    ],
  },
  {
    label: 'GELİR',
    links: [
      { to: '/subscriptions', label: 'Abonelikler', icon: '💳' },
    ],
  },
  {
    label: 'SİSTEM',
    links: [
      { to: '/audit', label: 'Denetim Günlüğü', icon: '📝' },
      { to: '/settings', label: 'Ayarlar', icon: '⚙️' },
    ],
  },
];

export default function Sidebar() {
  const [badges, setBadges] = useState<Badges>({ pending: 0, reports: 0 });

  useEffect(() => {
    async function fetchBadges() {
      const [{ count: pending }, { count: reports }] = await Promise.all([
        supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      setBadges({ pending: pending ?? 0, reports: reports ?? 0 });
    }
    void fetchBadges();
    const t = setInterval(() => void fetchBadges(), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo-wrap">
        <div className="sidebar-logo-dot" aria-hidden="true" />
        <div className="sidebar-logo-text">
          <div className="sidebar-logo-brand">sipariskutusu</div>
          <div className="sidebar-logo-sub">Admin Console</div>
        </div>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto' }}>
        {groups.map(group => (
          <div key={group.label} className="sidebar-group">
            <div className="sidebar-group-label">{group.label}</div>
            {group.links.map(l => {
              const badgeVal = l.badge ? badges[l.badge] : 0;
              return (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                >
                  <span className="sidebar-icon">{l.icon}</span>
                  <span>{l.label}</span>
                  {badgeVal > 0 && (
                    <span className="sidebar-badge">{badgeVal > 99 ? '99+' : badgeVal}</span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-note">Rol: admin</div>
        <button
          className="btn btn-ghost"
          style={{ width: '100%' }}
          onClick={() => supabase.auth.signOut()}
        >
          Çıkış Yap
        </button>
      </div>
    </aside>
  );
}
