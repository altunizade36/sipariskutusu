import { NavLink } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const links = [
  { to: '/',          label: '📊 Özet' },
  { to: '/listings',  label: '📋 İlanlar' },
  { to: '/reports',   label: '🚨 Şikayetler' },
  { to: '/comments',  label: '💬 Yorumlar' },
  { to: '/users',     label: '👥 Kullanıcılar' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">SK Admin</div>
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
        <button
          className="btn btn-ghost"
          style={{ width: '100%' }}
          onClick={() => supabase.auth.signOut()}
        >
          Çıkış
        </button>
      </div>
    </aside>
  );
}
