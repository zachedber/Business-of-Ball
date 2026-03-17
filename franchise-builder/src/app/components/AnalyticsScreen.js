'use client';
import { useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';

// ============================================================
// SPARKLINE — tiny inline trend chart
// ============================================================
export function Sparkline({ data, color = '#C8202A', height = 28 }) {
  if (!data || data.length < 2) return null;
  const vals = data.map(Number).filter(n => !isNaN(n));
  if (vals.length < 2) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const w = 60;
  const h = height;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

// ============================================================
// CUSTOM TOOLTIP
// ============================================================
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--cream)', border: '1px solid var(--cream-darker)', borderRadius: 6, padding: '8px 12px', fontSize: '0.72rem', fontFamily: 'var(--font-mono, monospace)' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>S{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? (p.value % 1 === 0 ? p.value : p.value.toFixed(1)) : p.value}
          {p.name?.includes('$') || p.name?.includes('Rev') || p.name?.includes('Exp') || p.name?.includes('Profit') ? 'M' : ''}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// ANALYTICS SCREEN
// ============================================================
export default function AnalyticsScreen({ fr, lt, stakes, season }) {
  const history = fr?.history || [];

  const perfData = useMemo(() => history.map(h => ({
    s: h.season,
    W: h.wins,
    L: h.losses,
    WP: h.winPct != null ? Math.round(h.winPct * 100) : Math.round(h.wins / Math.max(1, h.wins + h.losses) * 100),
    Fan: h.fanRating || 0,
    Chem: h.chemistry || 0,
    Quality: h.rosterQuality || 0,
  })), [history]);

  const finData = useMemo(() => history.map(h => ({
    s: h.season,
    Rev: h.revenue != null ? Number(h.revenue.toFixed(1)) : 0,
    Exp: h.expenses != null ? Number(h.expenses.toFixed(1)) : 0,
    Profit: h.profit != null ? Number(h.profit.toFixed(1)) : 0,
    Cash: h.cash != null ? Number(h.cash.toFixed(1)) : 0,
  })), [history]);

  const noHistory = history.length === 0;
  const games = fr?.league === 'ngl' ? 17 : 82;
  const winThreshold = Math.round(games * 0.5);

  if (!fr) return null;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 className="font-display section-header" style={{ fontSize: '1.2rem' }}>
        Analytics — {fr.city} {fr.name}
      </h2>

      {noHistory && (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--ink-muted)' }}>
          <div className="font-body" style={{ fontSize: '0.85rem' }}>Complete Season 1 to see analytics.</div>
        </div>
      )}

      {!noHistory && <>
        {/* Performance — Win% + Fan trend */}
        <div className="card" style={{ padding: 16 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem', marginBottom: 8 }}>Performance Trends</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={perfData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--cream-darker)" />
              <XAxis dataKey="s" tick={{ fontSize: 10, fontFamily: 'monospace' }} label={{ value: 'Season', position: 'insideBottom', offset: -2, fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: '0.7rem' }} />
              <ReferenceLine y={50} stroke="var(--ink-muted)" strokeDasharray="4 2" />
              <Line type="monotone" dataKey="WP" name="Win%" stroke="#C8202A" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Fan" name="Fan" stroke="#2A5FA0" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="Quality" name="Quality" stroke="#1A6B3A" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Finance — Revenue/Expenses/Profit bar chart */}
        <div className="card" style={{ padding: 16 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem', marginBottom: 8 }}>Finances ($M)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={finData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--cream-darker)" />
              <XAxis dataKey="s" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: '0.7rem' }} />
              <ReferenceLine y={0} stroke="var(--ink-muted)" />
              <Bar dataKey="Rev" name="Revenue" fill="#1A6B3A" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Exp" name="Expenses" fill="#C8202A" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Profit" name="Profit" fill="#D4A843" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cash trend sparkline + summary row */}
        <div className="card" style={{ padding: 16 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem', marginBottom: 8 }}>Cash & Chemistry</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={finData.map((d, i) => ({ ...d, Chem: perfData[i]?.Chem || 0 }))} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--cream-darker)" />
              <XAxis dataKey="s" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: '0.7rem' }} />
              <ReferenceLine y={0} stroke="var(--red)" strokeDasharray="4 2" />
              <Line type="monotone" dataKey="Cash" name="Cash" stroke="#D4A843" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Chem" name="Chemistry" stroke="#C47B18" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Summary stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
          {[
            ['Seasons', history.length],
            ['Best Record', (() => { const b = [...history].sort((a,b) => b.wins - a.wins)[0]; return b ? `${b.wins}-${b.losses}` : '—'; })()],
            ['Championships', fr.championships || 0],
            ['Best Win%', history.length ? (Math.max(...history.map(h => h.winPct || h.wins/(h.wins+h.losses+0.01))) * 100).toFixed(0) + '%' : '—'],
            ['Peak Fan', history.length ? Math.max(...history.map(h => h.fanRating || 0)) : '—'],
            ['Peak Quality', history.length ? Math.max(...history.map(h => h.rosterQuality || 0)) : '—'],
          ].map(([label, value]) => (
            <div key={label} className="card" style={{ padding: '10px 12px', textAlign: 'center' }}>
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{ fontSize: '1rem' }}>{value}</div>
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}
