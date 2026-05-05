import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Subscription {
  id: string;
  user_id: string;
  plan: string;
  entitlement: string | null;
  status: string;
  platform: string | null;
  billing_period: string | null;
  started_at: string | null;
  expires_at: string | null;
  auto_renewing: boolean;
  created_at: string;
  profile?: { full_name: string | null; username: string | null };
}

interface CreditWallet {
  id: string;
  user_id: string;
  balance: number;
  lifetime_purchased: number;
  lifetime_spent: number;
  updated_at: string;
  profile?: { full_name: string | null; username: string | null };
}

interface RcEvent {
  id: string;
  event_type: string;
  user_id: string | null;
  product_id: string | null;
  revenue: number | null;
  created_at: string;
}

interface PageStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  totalCreditsBalance: number;
  totalCreditsPurchased: number;
  totalCreditsSpent: number;
  planBreakdown: { plan: string; count: number }[];
}

type Tab = 'overview' | 'subscriptions' | 'credits' | 'events';

function planColor(plan: string) {
  const map: Record<string, string> = {
    free: '#6b7280', starter: '#3b82f6', plus: '#8b5cf6', pro: '#f59e0b', elite: '#ef4444',
  };
  return map[plan] ?? '#6b7280';
}

function planLabel(plan: string) {
  const map: Record<string, string> = {
    free: 'Ücretsiz', starter: 'Başlangıç', plus: 'Plus', pro: 'Pro', elite: 'Elite',
  };
  return map[plan] ?? plan;
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    active: '#16a34a', expired: '#6b7280', cancelled: '#dc2626', trial: '#f59e0b', paused: '#9ca3af',
  };
  return map[status] ?? '#6b7280';
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    active: 'Aktif', expired: 'Sona Erdi', cancelled: 'İptal', trial: 'Deneme', paused: 'Duraklatıldı',
  };
  return map[status] ?? status;
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtNum(n: number) {
  return n.toLocaleString('tr-TR');
}

const MIGRATION_SQL_HINT = `
-- Supabase Dashboard → SQL Editor'da şunu çalıştırın:
-- supabase/migrations/053_revenuecat_tables.sql dosyasını kopyalayıp yapıştırın.
`.trim();

export default function SubscriptionsPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<PageStats | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [wallets, setWallets] = useState<CreditWallet[]>([]);
  const [events, setEvents] = useState<RcEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tablesExist, setTablesExist] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subsRes, walletsRes, eventsRes] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('id, user_id, plan, entitlement, status, platform, billing_period, started_at, expires_at, auto_renewing, created_at')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('credit_wallets')
          .select('id, user_id, balance, lifetime_purchased, lifetime_spent, updated_at')
          .order('balance', { ascending: false })
          .limit(200),
        supabase
          .from('revenuecat_events')
          .select('id, event_type, user_id, product_id, revenue, created_at')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      if (subsRes.error?.code === 'PGRST205') {
        setTablesExist(false);
        setLoading(false);
        return;
      }

      setTablesExist(true);

      const subs: Subscription[] = subsRes.data ?? [];
      const walls: CreditWallet[] = walletsRes.data ?? [];
      const evs: RcEvent[] = eventsRes.data ?? [];

      if (subs.length > 0) {
        const userIds = [...new Set(subs.map(s => s.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', userIds);
        const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
        subs.forEach(s => { s.profile = profileMap[s.user_id]; });
      }

      if (walls.length > 0) {
        const userIds = [...new Set(walls.map(w => w.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', userIds);
        const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
        walls.forEach(w => { w.profile = profileMap[w.user_id]; });
      }

      const planCounts: Record<string, number> = {};
      subs.forEach(s => { planCounts[s.plan] = (planCounts[s.plan] ?? 0) + 1; });

      setSubscriptions(subs);
      setWallets(walls);
      setEvents(evs);
      setStats({
        totalSubscriptions: subs.length,
        activeSubscriptions: subs.filter(s => s.status === 'active').length,
        trialSubscriptions: subs.filter(s => s.status === 'trial').length,
        totalCreditsBalance: walls.reduce((a, w) => a + w.balance, 0),
        totalCreditsPurchased: walls.reduce((a, w) => a + w.lifetime_purchased, 0),
        totalCreditsSpent: walls.reduce((a, w) => a + w.lifetime_spent, 0),
        planBreakdown: Object.entries(planCounts).map(([plan, count]) => ({ plan, count })).sort((a, b) => b.count - a.count),
      });
      setLastUpdated(new Date().toLocaleTimeString('tr-TR'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Veri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const filteredSubs = subscriptions.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || (s.profile?.full_name ?? '').toLowerCase().includes(q)
      || (s.profile?.username ?? '').toLowerCase().includes(q)
      || s.user_id.toLowerCase().includes(q);
    const matchPlan = planFilter === 'all' || s.plan === planFilter;
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchPlan && matchStatus;
  });

  const filteredWallets = wallets.filter(w => {
    const q = search.toLowerCase();
    return !q || (w.profile?.full_name ?? '').toLowerCase().includes(q)
      || (w.profile?.username ?? '').toLowerCase().includes(q)
      || w.user_id.toLowerCase().includes(q);
  });

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Abonelikler & Gelir</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
            RevenueCat IAP yönetimi — abonelikler, krediler, olaylar
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {lastUpdated && (
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Son güncelleme: {lastUpdated}</span>
          )}
          <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => void loadData()} disabled={loading}>
            {loading ? '⟳ Yükleniyor...' : '⟳ Yenile'}
          </button>
        </div>
      </div>

      {!tablesExist && (
        <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#92400e', marginBottom: 8 }}>
            ⚠️ Veritabanı tabloları henüz oluşturulmamış
          </div>
          <p style={{ fontSize: 13, color: '#78350f', margin: '0 0 12px' }}>
            RevenueCat tabloları Supabase'de mevcut değil. Aşağıdaki adımları takip edin:
          </p>
          <ol style={{ fontSize: 13, color: '#78350f', margin: '0 0 12px', paddingLeft: 20, lineHeight: 1.8 }}>
            <li>Supabase Dashboard'u açın → <strong>SQL Editor</strong></li>
            <li><code style={{ background: '#fde68a', padding: '1px 5px', borderRadius: 4 }}>supabase/migrations/053_revenuecat_tables.sql</code> dosyasını kopyalayıp yapıştırın</li>
            <li>Çalıştırın → ardından bu sayfayı yenileyin</li>
          </ol>
          <pre style={{ background: '#78350f', color: '#fef3c7', borderRadius: 8, padding: '12px 14px', fontSize: 11, overflowX: 'auto', margin: 0 }}>
            {MIGRATION_SQL_HINT}
          </pre>
        </div>
      )}

      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#dc2626', fontSize: 13 }}>
          Hata: {error}
        </div>
      )}

      {tablesExist && stats && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Toplam Abonelik', value: fmtNum(stats.totalSubscriptions), color: '#3b82f6', icon: '💳' },
              { label: 'Aktif Abonelik', value: fmtNum(stats.activeSubscriptions), color: '#16a34a', icon: '✅' },
              { label: 'Deneme', value: fmtNum(stats.trialSubscriptions), color: '#f59e0b', icon: '⏱' },
              { label: 'Toplam Kredi Bakiyesi', value: fmtNum(stats.totalCreditsBalance), color: '#8b5cf6', icon: '🪙' },
              { label: 'Toplam Satın Alınan', value: fmtNum(stats.totalCreditsPurchased), color: '#0ea5e9', icon: '📈' },
              { label: 'Toplam Harcanan', value: fmtNum(stats.totalCreditsSpent), color: '#ef4444', icon: '📉' },
            ].map(stat => (
              <div key={stat.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{stat.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {stats.planBreakdown.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Plan Dağılımı</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {stats.planBreakdown.map(p => (
                  <div key={p.plan} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f9fafb', borderRadius: 8, padding: '8px 14px' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: planColor(p.plan), display: 'inline-block' }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{planLabel(p.plan)}</span>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>{p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
        {(['overview', 'subscriptions', 'credits', 'events'] as Tab[]).map(t => {
          const labels: Record<Tab, string> = { overview: 'Genel Bakış', subscriptions: 'Abonelikler', credits: 'Krediler', events: 'RC Olayları' };
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: tab === t ? 700 : 400,
                color: tab === t ? '#2563eb' : '#6b7280',
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? '2px solid #2563eb' : '2px solid transparent',
                cursor: 'pointer',
                marginBottom: -1,
              }}
            >
              {labels[t]}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <div>
          {!tablesExist ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0', fontSize: 14 }}>
              Genel bakış için önce tablolar oluşturulmalıdır.
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>Yükleniyor...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Son Abonelikler</div>
                {subscriptions.slice(0, 8).map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid #f3f4f6' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{s.profile?.full_name ?? s.profile?.username ?? s.user_id.slice(0, 8)}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDate(s.created_at)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: planColor(s.plan), background: planColor(s.plan) + '18', borderRadius: 5, padding: '2px 7px' }}>{planLabel(s.plan)}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: statusColor(s.status), background: statusColor(s.status) + '18', borderRadius: 5, padding: '2px 7px' }}>{statusLabel(s.status)}</span>
                    </div>
                  </div>
                ))}
                {subscriptions.length === 0 && <div style={{ fontSize: 13, color: '#9ca3af' }}>Henüz abonelik yok.</div>}
              </div>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>En Fazla Kredisi Olanlar</div>
                {wallets.slice(0, 8).map(w => (
                  <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid #f3f4f6' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{w.profile?.full_name ?? w.profile?.username ?? w.user_id.slice(0, 8)}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>Toplam satın: {fmtNum(w.lifetime_purchased)}</div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#8b5cf6' }}>{fmtNum(w.balance)} 🪙</div>
                  </div>
                ))}
                {wallets.length === 0 && <div style={{ fontSize: 13, color: '#9ca3af' }}>Henüz cüzdan yok.</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'subscriptions' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="İsim veya kullanıcı adı ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: '1px solid #e5e7eb', borderRadius: 7, padding: '7px 12px', fontSize: 13, flex: 1, minWidth: 200 }}
            />
            <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: 7, padding: '7px 10px', fontSize: 13 }}>
              <option value="all">Tüm Planlar</option>
              {['free', 'starter', 'plus', 'pro', 'elite'].map(p => (
                <option key={p} value={p}>{planLabel(p)}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: 7, padding: '7px 10px', fontSize: 13 }}>
              <option value="all">Tüm Durumlar</option>
              {['active', 'expired', 'cancelled', 'trial', 'paused'].map(s => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
            <span style={{ fontSize: 13, color: '#6b7280', alignSelf: 'center' }}>{filteredSubs.length} kayıt</span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>Yükleniyor...</div>
          ) : !tablesExist ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0', fontSize: 14 }}>Tablo mevcut değil — önce migration çalıştırın.</div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['Kullanıcı', 'Plan', 'Durum', 'Platform', 'Dönem', 'Başlangıç', 'Bitiş', 'Oto-Yenileme'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSubs.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600 }}>{s.profile?.full_name ?? '—'}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>@{s.profile?.username ?? s.user_id.slice(0, 8)}</div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: planColor(s.plan), background: planColor(s.plan) + '18', borderRadius: 5, padding: '2px 8px' }}>
                          {planLabel(s.plan)}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: statusColor(s.status), background: statusColor(s.status) + '18', borderRadius: 5, padding: '2px 8px' }}>
                          {statusLabel(s.status)}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#6b7280' }}>{s.platform ?? '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#6b7280' }}>
                        {s.billing_period === 'monthly' ? 'Aylık' : s.billing_period === 'yearly' ? 'Yıllık' : s.billing_period ?? '—'}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#6b7280' }}>{fmtDate(s.started_at)}</td>
                      <td style={{ padding: '10px 14px', color: s.expires_at && new Date(s.expires_at) < new Date() ? '#dc2626' : '#6b7280' }}>{fmtDate(s.expires_at)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 12, color: s.auto_renewing ? '#16a34a' : '#9ca3af' }}>
                          {s.auto_renewing ? '✓ Açık' : '✗ Kapalı'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredSubs.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: '#9ca3af' }}>Sonuç bulunamadı.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'credits' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input
              type="text"
              placeholder="İsim veya kullanıcı adı ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: '1px solid #e5e7eb', borderRadius: 7, padding: '7px 12px', fontSize: 13, flex: 1, minWidth: 200 }}
            />
            <span style={{ fontSize: 13, color: '#6b7280', alignSelf: 'center' }}>{filteredWallets.length} cüzdan</span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>Yükleniyor...</div>
          ) : !tablesExist ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0', fontSize: 14 }}>Tablo mevcut değil — önce migration çalıştırın.</div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['Kullanıcı', 'Mevcut Bakiye', 'Toplam Satın Alınan', 'Toplam Harcanan', 'Son Güncelleme'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredWallets.map(w => (
                    <tr key={w.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600 }}>{w.profile?.full_name ?? '—'}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>@{w.profile?.username ?? w.user_id.slice(0, 8)}</div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: '#8b5cf6' }}>{fmtNum(w.balance)}</span>
                        <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 4 }}>🪙</span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#16a34a', fontWeight: 600 }}>{fmtNum(w.lifetime_purchased)}</td>
                      <td style={{ padding: '10px 14px', color: '#dc2626', fontWeight: 600 }}>{fmtNum(w.lifetime_spent)}</td>
                      <td style={{ padding: '10px 14px', color: '#6b7280' }}>{fmtDate(w.updated_at)}</td>
                    </tr>
                  ))}
                  {filteredWallets.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#9ca3af' }}>Cüzdan bulunamadı.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'events' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>Yükleniyor...</div>
          ) : !tablesExist ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0', fontSize: 14 }}>Tablo mevcut değil — önce migration çalıştırın.</div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['Olay Tipi', 'Kullanıcı ID', 'Ürün ID', 'Gelir', 'Tarih'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, background: '#f3f4f6', borderRadius: 5, padding: '2px 8px', fontFamily: 'monospace' }}>
                          {e.event_type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#6b7280', fontFamily: 'monospace', fontSize: 11 }}>{e.user_id?.slice(0, 12) ?? '—'}...</td>
                      <td style={{ padding: '10px 14px', color: '#6b7280', fontFamily: 'monospace', fontSize: 11 }}>{e.product_id ?? '—'}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: e.revenue ? '#16a34a' : '#9ca3af' }}>
                        {e.revenue != null ? `₺${e.revenue.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#6b7280' }}>{fmtDate(e.created_at)}</td>
                    </tr>
                  ))}
                  {events.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#9ca3af' }}>Henüz RC olayı yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
