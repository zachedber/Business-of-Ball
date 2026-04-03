'use client';
import { calculateValuation, getGMTier, calcStakeValue } from '@/lib/engine';
import { getEmpireTier, calcEmpireSynergy } from '@/lib/engine/finance';
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
      {/* Empire Tier — Phase 5 */}
      {(() => {
        const tier = getEmpireTier(netWorth, stakes, af.championships || 0);
        const tierColors = {
          Owner: 'var(--ink-muted)',
          Magnate: 'var(--ink)',
          Baron: '#7C5F2A', /* no existing token for bronze — muted gold-brown */
          Mogul: 'var(--gold)',
          Legend: '#D4A843', /* no existing token for bright gold — matches --gold accent */
        };
        return (
          <div className="card" style={{ padding: '14px 16px', marginBottom: 12, borderLeft: `4px solid ${tierColors[tier.tier] || 'var(--ink-muted)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div className="font-display" style={{ fontSize: '1.2rem', fontWeight: 700, color: tierColors[tier.tier] }}>
                  {tier.label}
                </div>
                <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
                  Empire Tier · Net Worth ${Math.round(netWorth)}M
                </div>
              </div>
              {tier.nextTier && (
                <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', textAlign: 'right' }}>
                  Next: {tier.nextTier}
                  <div className="progress-bar" style={{ width: 80, marginTop: 4 }}>
                    <div className="progress-bar-fill" style={{ width: `${tier.progressPct}%`, background: tierColors[tier.tier] }} />
                  </div>
                </div>
              )}
            </div>
            <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>GM Reputation: {gmRep}/100 · {gmTier.label}</div>
          </div>
        );
      })()}

      {/* Empire Synergy — Phase 5 */}
      {(() => {
        const synergy = calcEmpireSynergy(af, stakes);
        const hasSynergy = synergy.fanBonus > 0;
        return (
          <div className="card" style={{ padding: '12px 16px', marginBottom: 12 }}>
            <h3 className="font-display section-header" style={{ fontSize: '0.85rem' }}>Cross-League Synergy</h3>
            {hasSynergy ? (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {synergy.fanBonus > 0 && <span className="badge badge-green">Fan Rating +{synergy.fanBonus}/season</span>}
                {synergy.mediaBonus > 0 && <span className="badge badge-green">Media Rep +{synergy.mediaBonus}/season</span>}
                {synergy.sponsorBoost > 0 && <span className="badge badge-green">Sponsor +{Math.round(synergy.sponsorBoost * 100)}%</span>}
              </div>
            ) : (
              <p className="font-body" style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                Buy a stake in another {af.league === 'ngl' ? 'NGL' : 'ABL'} franchise to unlock synergy bonuses.
              </p>
            )}
          </div>
        );
      })()}
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
