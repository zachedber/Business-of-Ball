'use client';
import { calculateValuation, getGMTier, calcStakeValue } from '@/lib/engine';
import { Sparkline } from '@/app/components/AnalyticsScreen';

// ============================================================
// PORTFOLIO SCREEN
// ============================================================
export default function PortfolioScreen({ af, fr, stakes, lt, gmRep, dynasty, season, setScreen }) {
  const franchiseValue = calculateValuation(af);
  const liquidCash = af.cash || 0;
  const stakeValue = stakes.reduce((sum, s) => sum + calcStakeValue(s, lt || { ngl: [], abl: [] }), 0);
  const netWorth = Math.round((franchiseValue + liquidCash + stakeValue) * 10) / 10;
  const gmTier = getGMTier(gmRep);

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 12px' }}>
      <h2 className="font-display section-header" style={{ fontSize: '1.2rem' }}>Empire Overview</h2>
      <div className="card" style={{ padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, borderLeft: '4px solid var(--gold)' }}>
        <span style={{ fontSize: '1.4rem' }}>{gmTier.badge}</span>
        <div>
          <div className="font-display" style={{ fontSize: '1rem', fontWeight: 700 }}>{gmTier.label}</div>
          <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>GM Reputation: {gmRep}/100</div>
        </div>
        <div style={{ flex: 1, marginLeft: 8 }}>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${gmRep}%`, background: gmRep >= 65 ? 'var(--gold)' : gmRep >= 40 ? 'var(--amber)' : 'var(--ink-muted)' }} />
          </div>
        </div>
      </div>
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        {[
          ['Net Worth', `$${netWorth}M`, 'var(--gold)'],
          ['Liquid Capital', `$${Math.round(liquidCash * 10) / 10}M`, liquidCash > 0 ? 'var(--green)' : 'var(--red)'],
          ['Franchise Value', `$${franchiseValue}M`],
          ['Stake Value', `$${Math.round(stakeValue * 10) / 10}M`],
          ['Debt', `$${af.debt || 0}M`, (af.debt || 0) > 0 ? 'var(--red)' : 'var(--ink)'],
          ['Franchises', fr.length],
          ['Stakes', stakes.length],
          ['Season', season],
          ['Titles', af.championships || 0, 'var(--gold)'],
          ['Legends', (af.localLegends || []).length],
        ].map(([label, value, color]) => (
          <div key={label} className="card" style={{ padding: '10px 12px', textAlign: 'center' }}>
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ fontSize: '1rem', color: color || 'var(--ink)' }}>{value}</div>
          </div>
        ))}
      </div>
      {/* Phase 4: Sparklines on franchise card */}
      {af.history && af.history.length >= 2 && (
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <h3 className="font-display" style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: af.primaryColor || 'var(--ink-soft)' }}>
            {af.city} {af.name} — {af.history.length}yr trend
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {[
              { label: 'Win%', data: af.history.map(h => Math.round((h.winPct || 0) * 100)), color: '#C8202A' },
              { label: 'Revenue', data: af.history.map(h => h.revenue || 0), color: '#1A6B3A' },
              { label: 'Fan Rating', data: af.history.map(h => h.fanRating || 0), color: '#2A5FA0' },
              { label: 'Profit', data: af.history.map(h => h.profit || 0), color: '#D4A843' },
            ].map(({ label, data, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--cream-darker)' }}>
                <div>
                  <div className="stat-label" style={{ fontSize: '0.7rem' }}>{label}</div>
                  <div className="font-mono" style={{ fontSize: '0.72rem', fontWeight: 600 }}>{data[data.length - 1]}{label === 'Win%' ? '%' : label === 'Fan Rating' ? '' : 'M'}</div>
                </div>
                <Sparkline data={data} color={color} height={24} />
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <button className="btn-secondary" style={{ fontSize: '0.7rem' }} onClick={() => setScreen('finances')}>
          View Empire Finances
        </button>
      </div>
      {dynasty.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Dynasty Eras</h3>
          {dynasty.map((d, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div className="font-display" style={{ fontSize: '0.85rem', color: 'var(--gold)', fontWeight: 600 }}>
                {d.era} <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>S{d.season}</span>
              </div>
              <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>{d.narrative}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
