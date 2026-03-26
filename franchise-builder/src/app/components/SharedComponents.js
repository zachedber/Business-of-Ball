'use client';
import { useMemo } from 'react';
import { getGMTier, formatMoney } from '@/lib/engine';
import { NotificationBadge } from '@/app/components/NotificationsPanel';
import { Building2, ClipboardList, Trophy, TrendingUp, DollarSign, BarChart2, Settings } from 'lucide-react';

// ============================================================
// TICKER
// ============================================================
function TickerSegment({ label, labelClass, items }) {
  if (!items.length) return null;
  return (
    <>
      <span className={`ticker-label ${labelClass || ''}`}>{label}</span>
      {items.map((item, i) => (
        <span key={i} className="ticker-segment">
          <span className="ticker-team">{item.team}</span>
          <span className="ticker-score">{item.score}</span>
          {item.note && <span className="ticker-team" style={{color:'#666'}}>{item.note}</span>}
        </span>
      ))}
    </>
  );
}

export function Ticker({ lt, fr, season }) {
  const segments = useMemo(() => {
    if (!lt) return null;

    const nglItems = [...(lt.ngl || [])].sort((a, b) => b.wins - a.wins).slice(0, 5).map(t => ({
      team: `${t.city} ${t.name}`,
      score: `${t.wins}-${t.losses}`,
    }));
    const ablItems = [...(lt.abl || [])].sort((a, b) => b.wins - a.wins).slice(0, 5).map(t => ({
      team: `${t.city} ${t.name}`,
      score: `${t.wins}-${t.losses}`,
    }));
    const yourItems = (fr || []).map(f => ({
      team: `${f.city} ${f.name}`,
      score: `${f.wins}-${f.losses}`,
      note: `S${season || 1}`,
    }));

    return { nglItems, ablItems, yourItems };
  }, [lt, fr, season]);

  const innerContent = segments ? (
    <>
      <TickerSegment label="NGL" labelClass="ngl" items={segments.nglItems} />
      <TickerSegment label="ABL" labelClass="abl" items={segments.ablItems} />
      {segments.yourItems.length > 0 && <TickerSegment label="YOUR TEAM" labelClass="your" items={segments.yourItems} />}
    </>
  ) : (
    <span className="ticker-segment" style={{color:'#888'}}>BUSINESS OF BALL · MORE FEATURES COMING SOON</span>
  );

  return (
    <div className="ticker-bar">
      <div className="ticker-scroll">
        <span style={{display:'inline-flex',alignItems:'center'}}>{innerContent}{innerContent}</span>
      </div>
    </div>
  );
}

// ============================================================
// NAV
// ============================================================
export function Nav({ screen, setScreen, fr, gmRep, cash, notifCount, quarterPhase, activeFranchise }) {
  const tier = getGMTier(gmRep);
  return (
    <nav className="nav-bar">
      <div className="nav-top">
        <h1
          className="font-display"
          style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', color: '#fff' }}
          onClick={() => setScreen(fr.length > 0 ? 'portfolio' : 'intro')}
        >
          Business of Ball
        </h1>
        <div className="nav-stats">
          {fr.length > 0 && <>
            {(quarterPhase || 0) > 0 && activeFranchise && (
              <div style={{ textAlign: 'right' }}>
                <span className="stat-label" style={{ color: 'rgba(255,255,255,0.5)' }}>Record</span>
                <div className="stat-value" style={{ fontSize: '0.85rem', color: '#fff' }}>
                  {activeFranchise.wins ?? 0}–{activeFranchise.losses ?? 0}
                </div>
              </div>
            )}
            <div style={{ textAlign: 'right' }}>
              <span className="stat-label" style={{ color: 'rgba(255,255,255,0.5)' }}>Cash</span>
              <div className="stat-value" style={{ fontSize: '0.95rem', color: cash > 5 ? '#4ade80' : cash > 0 ? '#fbbf24' : '#f87171' }}>
                {formatMoney(cash)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="stat-label" style={{ color: 'rgba(255,255,255,0.5)' }}>Rep</span>
              <div className="stat-value" style={{ fontSize: '0.8rem', color: '#fff' }}>{gmRep}</div>
            </div>
          </>}
          <button className={`tab-btn ${screen === 'settings' ? 'active' : ''}`} onClick={() => setScreen('settings')} style={{ minWidth: 44, paddingInline: 12, fontSize: '0.9rem', color: screen === 'settings' ? undefined : '#fff', display: 'inline-flex', alignItems: 'center', gap: 4 }} aria-label="Settings"><Settings size={14} /></button>
        </div>
      </div>
      {fr.length > 0 && (
        <div className="nav-links">
          {[['portfolio', 'Empire', Building2], ['dashboard', 'Team', ClipboardList], ['league', 'League', Trophy], ['market', 'Market', TrendingUp], ['finances', 'Finances', DollarSign], ['analytics', 'Analytics', BarChart2]].map(([s, label, Icon]) => (
            <button
              key={s}
              className={`tab-btn ${screen === s ? 'active' : ''}`}
              onClick={() => setScreen(s)}
              style={{ color: screen === s ? undefined : 'rgba(255,255,255,0.6)', display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <Icon size={14} />
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

// ============================================================
// RATING TOOLTIP — displays player rating with hover explanation
// ============================================================
const RATING_TOOLTIP = 'Overall rating (40\u201399). Affected by age, development staff level, training camp focus, and morale. Peaks between ages 26\u201330 for NGL, 24\u201328 for ABL.';

export function RatingBadge({ rating, style }) {
  return (
    <span
      title={RATING_TOOLTIP}
      style={{
        cursor: 'help',
        borderBottom: '1px dotted var(--ink-muted)',
        ...style,
      }}
    >
      {rating}
    </span>
  );
}

export { RATING_TOOLTIP };
