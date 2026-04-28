import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Profile {
  id: string;
  email?: string;
  full_name?: string | null;
  role: string;
  is_banned: boolean;
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { setProfile(null); return; }
      const { data: p } = await supabase
        .from('profiles')
        .select('id,full_name,role,is_banned')
        .eq('id', data.session.user.id)
        .single();
      if (p?.role === 'admin') {
        setProfile({ ...p, email: data.session.user.email });
      } else {
        await supabase.auth.signOut();
        setProfile(null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (!session) { setProfile(null); return; }
      const { data: p } = await supabase
        .from('profiles')
        .select('id,full_name,role,is_banned')
        .eq('id', session.user.id)
        .single();
      if (p?.role === 'admin') {
        setProfile({ ...p, email: session.user.email });
      } else {
        await supabase.auth.signOut();
        setProfile(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
    setLoading(false);
  }

  if (profile === undefined) {
    return <div className="loading">Yükleniyor…</div>;
  }

  if (profile === null) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <h1>Sipariş Kutusu<br />Admin Paneli</h1>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>E-posta</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="form-group">
              <label>Şifre</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
            </button>
            {error && <div className="error-msg">{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
