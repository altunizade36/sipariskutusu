import { NavLink } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/analytics', label: 'Analitik' },
  { to: '/discover', label: 'Keşfet Yönetimi' },
  { to: '/listings', label: 'İlanlar' },
  { to: '/reports', label: 'Şikayetler' },
  { to: '/comments', label: 'Yorumlar' },
  { to: '/users', label: 'Kullanıcılar' },
  { to: '/stores', label: 'Mağazalar' },
  { to: '/ops', label: 'Operasyon' },
  { to: '/audit', label: 'Denetim Günlüğü' },
  { to: '/settings', label: 'Ayarlar' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo-wrap">
        <div className="sidebar-logo-dot" aria-hidden="true" />
        <div className="sidebar-logo-text">
          <div className="sidebar-logo-brand">sipariskutusu</div>
          <div className="sidebar-logo-sub">Admin Console</div>
        </div>
      </div>
      <nav>
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            className={({ isActive }) => isActive ? 'active' : ''}
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-footer-note">Rol: admin</div>
        <button
          className="btn btn-ghost"
          style={{ width: '100%' }}
          onClick={() => supabase.auth.signOut()}
        >
          Cikis Yap
        </button>
      </div>
    </aside>
  );
}
