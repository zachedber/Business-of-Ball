'use client';
import { useMemo } from 'react';
import { getGMTier, formatMoney } from '@/lib/engine';
import { NotificationBadge } from '@/app/components/NotificationsPanel';

// ============================================================
// TICKER
// ============================================================
export function Ticker({ lt, fr, season }) {
  const items = useMemo(() => {
    if (!lt) return ['BUSINESS OF BALL — MORE FEATURES COMING SOON'];
    const msgs = [`SEASON ${season || 1}`];
    [...(lt.ngl || [])].sort((a, b) => b.wins - a.wins).slice(0, 2)
      .forEach(t => msgs.push(`NGL: ${t.city} ${t.name} ${t.wins}-${t.losses}`));
    [...(lt.abl || [])].sort((a, b) => b.wins - a.wins).slice(0, 2)
      .forEach(t => msgs.push(`ABL: ${t.city} ${t.name} ${t.wins}-${t.losses}`));
    fr?.forEach(f => msgs.push(`YOUR TEAM: ${f.city} ${f.name} ${f.wins}-${f.losses}`));
    return msgs;
  }, [lt, fr, season]);
  const txt = items.join('   ///   ');
  return (
    <div className="ticker-bar">
      <div className="ticker-scroll"><span>{txt}   ///   {txt}</span></div>
    </div>
  );
}

// ============================================================
// NAV
// ============================================================
export function Nav({ screen, setScreen, fr, gmRep, cash, notifCount }) {
  const tier = getGMTier(gmRep);
  return (
    <nav className="nav-bar">
      <div className="nav-top">
        <h1
          className="font-display"
          style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
          onClick={() => setScreen(fr.length > 0 ? 'portfolio' : 'intro')}
        >
          Business of Ball
        </h1>
        <div className="nav-stats">
          {fr.length > 0 && <>
            <div style={{ textAlign: 'right' }}>
              <span className="stat-label">Cash</span>
              <div className="stat-value" style={{ fontSize: '0.95rem', color: cash > 5 ? 'var(--green)' : cash > 0 ? 'var(--amber)' : 'var(--red)' }}>
                {formatMoney(cash)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="stat-label">{tier.badge}</span>
              <div className="stat-value" style={{ fontSize: '0.8rem' }}>{gmRep}</div>
            </div>
          </>}
          <button className={`tab-btn ${screen === 'settings' ? 'active' : ''}`} onClick={() => setScreen('settings')} style={{ minWidth: 44, paddingInline: 12, fontSize: '0.9rem' }} aria-label="Settings">⚙</button>
        </div>
      </div>
      {fr.length > 0 && (
        <div className="nav-links">
          {[['portfolio', '🏟 Empire'], ['dashboard', '📋 Team'], ['league', '🏆 League'], ['market', '📈 Market'], ['finances', '💰 Finances'], ['analytics', '📊 Analytics']].map(([s, label]) => (
            <button
              key={s}
              className={`tab-btn ${screen === s ? 'active' : ''}`}
              onClick={() => setScreen(s)}
            >
              {label}
              {s === 'dashboard' && notifCount > 0 && <NotificationBadge count={notifCount} />}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}

// ============================================================
// MINI SPARKLINE
// ============================================================
export function MiniSparkline({ data, width = 120, height = 32, color = 'var(--green)' }) {
  if (!data || data.length < 2) return <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>—</span>;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - (((v - min) / range) * height * 0.8 + height * 0.1)}`
  ).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ============================================================
// MINI CHART (used in legacy tab)
// ============================================================
export function MiniChart({ data, width = 280, height = 80, color = 'var(--red)' }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - (((v - min) / range) * height * 0.8 + height * 0.1)}`
  ).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
