'use client';
import { useState, useMemo } from 'react';
import { NGL_TEAMS, ABL_TEAMS, MARKET_TIERS, getMarketTier, getMarketTierInfo } from '@/data/leagues';
import { getContrastText } from '@/data/teamColors';
import { calculateDynamicInterestRate, calculateDebtPayment } from '@/lib/engine/finance';
import { FRANCHISE_IDENTITIES } from '@/lib/engine/simulation';

// Starting cash by market tier
const TIER_CASH = { 1: 120, 2: 100, 3: 85, 4: 75, 5: 65 };

// Identity flavor lookup by team id
const IDENTITY = {
  'ngl-bos': 'Legacy', 'ngl-chi': 'Legacy',
  'ngl-bay': 'Dynasty', 'ngl-lac': 'Dynasty',
  'ngl-grb': 'Underdog', 'ngl-buf': 'Underdog', 'ngl-jax': 'Underdog',
  'ngl-cle': 'Rebuild', 'ngl-det': 'Rebuild',
  'abl-bos': 'Legacy', 'abl-chi': 'Legacy', 'abl-lal': 'Legacy', 'abl-bay': 'Legacy',
  'abl-nyk': 'Dynasty', 'abl-lac': 'Dynasty',
  'abl-okc': 'Underdog', 'abl-mil': 'Underdog', 'abl-mem': 'Underdog',
  'abl-det': 'Rebuild', 'abl-cle': 'Rebuild', 'abl-cha': 'Rebuild',
};
function getIdentity(id) { return IDENTITY[id] || 'Contender'; }

const IDENTITY_COLORS = {
  Legacy: 'badge-purple',
  Dynasty: 'badge-amber',
  Underdog: 'badge-teal',
  Rebuild: 'badge-red',
  Contender: 'badge-blue',
};

// ============================================================
// FRANCHISE SELECTION SCREEN
// ============================================================
export default function FranchiseSelectionScreen({ onCreate }) {
  const [leagueTab, setLeagueTab] = useState('ngl');
  const [selected, setSelected] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const [leveraged, setLeveraged] = useState(false);
  const [downPct, setDownPct] = useState(30);

  const nglTeams = useMemo(() => NGL_TEAMS.map(t => ({ ...t, league: 'ngl' })), []);
  const ablTeams = useMemo(() => ABL_TEAMS.map(t => ({ ...t, league: 'abl' })), []);

  const teams = leagueTab === 'ngl' ? nglTeams : ablTeams;

  // Group by tier
  const tierGroups = useMemo(() => {
    const groups = {};
    for (const t of teams) {
      const tier = getMarketTier(t.market);
      if (!groups[tier]) groups[tier] = [];
      groups[tier].push(t);
    }
    return Object.entries(groups).sort(([a], [b]) => Number(a) - Number(b));
  }, [teams]);

  function toggleTier(tier) {
    setCollapsed(prev => ({ ...prev, [tier]: !prev[tier] }));
  }

  const sel = selected;
  const selTier = sel ? getMarketTier(sel.market) : null;
  const selCash = sel ? TIER_CASH[selTier] : 0;

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '20px 12px' }}>
      <h2 className="font-display" style={{ fontSize: '1.3rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        Choose Your Franchise
      </h2>
      <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: 18 }}>
        Select a team. Starting capital depends on market tier.
      </p>

      {/* League tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {[['ngl', 'NGL \u2014 Football'], ['abl', 'ABL \u2014 Basketball']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setLeagueTab(key); setSelected(null); }}
            className="font-display"
            style={{
              padding: '10px 20px',
              fontSize: '0.85rem',
              fontWeight: leagueTab === key ? 700 : 500,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              border: 'none',
              borderBottom: leagueTab === key ? '3px solid var(--ink)' : '3px solid transparent',
              background: 'transparent',
              color: leagueTab === key ? 'var(--ink)' : 'var(--ink-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tier groups */}
      <div style={{ marginBottom: 120 }}>
        {tierGroups.map(([tier, tierTeams]) => {
          const tierInfo = MARKET_TIERS[tier];
          const isCollapsed = collapsed[tier];
          return (
            <div key={tier} style={{ marginBottom: 16 }}>
              {/* Tier header */}
              <button
                onClick={() => toggleTier(tier)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '10px 14px', background: 'var(--card-secondary)',
                  border: '1px solid var(--border)', borderRadius: 6,
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span className="font-display" style={{
                  fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.06em', color: 'var(--ink)',
                }}>
                  {isCollapsed ? '+' : '\u2013'} Tier {tier}: {tierInfo.label}
                </span>
                <span className="font-body" style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', flex: 1 }}>
                  {tierInfo.desc}
                </span>
                <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
                  {tierTeams.length} teams \u00b7 ${TIER_CASH[tier]}M start
                </span>
              </button>

              {/* Team cards */}
              {!isCollapsed && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 10, marginTop: 10,
                }}>
                  {tierTeams.map(team => {
                    const isSelected = selected?.id === team.id && selected?.league === team.league;
                    const identity = getIdentity(team.id);
                    const teamTier = getMarketTier(team.market);
                    const startCash = TIER_CASH[teamTier];
                    return (
                      <div
                        key={`${team.league}-${team.id}`}
                        onClick={() => setSelected(isSelected ? null : team)}
                        className={`card ${isSelected ? 'selected' : ''}`}
                        style={{
                          cursor: 'pointer',
                          borderLeft: `5px solid ${team.primaryColor || 'var(--border)'}`,
                          padding: '14px 16px',
                          transition: 'border-color 0.2s, box-shadow 0.2s',
                          background: isSelected ? `linear-gradient(180deg, rgba(37,99,235,0.04), var(--card))` : 'var(--card)',
                          borderColor: isSelected ? team.primaryColor : undefined,
                          boxShadow: isSelected ? `0 8px 20px rgba(0,0,0,0.08)` : undefined,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div>
                            <div className="font-display" style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.1 }}>
                              {team.city}
                            </div>
                            <div className="font-display" style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.1 }}>
                              {team.name}
                            </div>
                          </div>
                          <span className={`badge ${IDENTITY_COLORS[identity]}`} style={{ flexShrink: 0 }}>
                            {identity}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.72rem', marginBottom: 4 }}>
                          <span className="font-mono" style={{ color: 'var(--ink-muted)' }}>Mkt {team.market}</span>
                          <span className="font-mono" style={{ color: 'var(--profit)' }}>${startCash}M</span>
                          <span className="font-mono" style={{ color: 'var(--ink-muted)' }}>{team.division}</span>
                        </div>
                        {FRANCHISE_IDENTITIES[team.id] && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '0.65rem', padding: '2px 7px', borderRadius: 10,
                              background: 'rgba(26,18,8,0.07)', color: 'var(--ink-muted)',
                              fontFamily: 'var(--font-mono, monospace)',
                            }}>
                              {FRANCHISE_IDENTITIES[team.id].historicCulture.replace(/-/g, ' ')}
                            </span>
                            <span style={{
                              fontSize: '0.65rem', padding: '2px 7px', borderRadius: 10,
                              background: 'rgba(26,18,8,0.07)', color: 'var(--ink-muted)',
                              fontFamily: 'var(--font-mono, monospace)',
                            }}>
                              {FRANCHISE_IDENTITIES[team.id].fanExpectationProfile.replace(/-/g, ' ')}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sticky confirmation sheet */}
      {selected && (() => {
        const isBigMarket = selTier <= 2;
        const franchisePrice = selCash;
        const downPayment = Math.round(franchisePrice * (downPct / 100));
        const loanAmount = franchisePrice - downPayment;
        const interestRate = calculateDynamicInterestRate(50, downPayment, loanAmount);
        const termSeasons = 10;
        const seasonalPayment = calculateDebtPayment({ principal: loanAmount, interestRate, termSeasons });

        return (
          <div className="card-elevated confirm-sheet" style={{
            background: 'rgba(255,255,255,0.98)',
            borderTop: `3px solid ${selected.primaryColor || 'var(--ink)'}`,
            padding: '16px 20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div className="font-display" style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  {selected.city} {selected.name}
                </div>
                <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                  {selected.league === 'ngl' ? 'NGL Football' : 'ABL Basketball'} {'\u00b7'} Starting Cash ${selCash}M
                </div>
              </div>
              <button
                onClick={() => {
                  if (leveraged && isBigMarket) {
                    onCreate(selected, selected.league, {
                      leveraged: true,
                      downPayment,
                      loanAmount,
                      interestRate,
                      termSeasons,
                      seasonalPayment: Math.round(seasonalPayment * 10) / 10,
                    });
                  } else {
                    onCreate(selected, selected.league);
                  }
                }}
                style={{
                  minHeight: 46, padding: '12px 28px', borderRadius: 4,
                  border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-display)', textTransform: 'uppercase',
                  letterSpacing: '0.06em', fontWeight: 700, fontSize: '0.88rem',
                  background: selected.primaryColor || 'var(--ink)',
                  color: getContrastText(selected.primaryColor || '#0E1117'),
                  boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
                  transition: 'all 0.15s',
                }}
              >
                Start Franchise
              </button>
            </div>

            {/* Leveraged Purchase Option — Tier 1 & 2 only */}
            {isBigMarket && (
              <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--cream-dark)', borderRadius: 4, border: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: leveraged ? 10 : 0 }}>
                  <input
                    type="checkbox"
                    checked={leveraged}
                    onChange={e => setLeveraged(e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  <span className="font-display" style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Leveraged Purchase
                  </span>
                  <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--ink-muted)' }}>
                    Finance your franchise with debt
                  </span>
                </label>
                {leveraged && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span className="stat-label" style={{ fontSize: '0.72rem', minWidth: 90 }}>Down Payment</span>
                      <input
                        type="range"
                        min="20"
                        max="50"
                        step="5"
                        value={downPct}
                        onChange={e => setDownPct(Number(e.target.value))}
                        style={{ flex: 1, minWidth: 120 }}
                      />
                      <span className="font-mono" style={{ fontSize: '0.78rem', fontWeight: 700, minWidth: 40, textAlign: 'right' }}>
                        {downPct}%
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, fontSize: '0.72rem' }}>
                      <div>
                        <div className="stat-label">Down Payment</div>
                        <div className="font-mono" style={{ fontWeight: 700, color: 'var(--green)' }}>${downPayment}M</div>
                      </div>
                      <div>
                        <div className="stat-label">Loan Amount</div>
                        <div className="font-mono" style={{ fontWeight: 700, color: 'var(--red)' }}>${loanAmount}M</div>
                      </div>
                      <div>
                        <div className="stat-label">Interest Rate</div>
                        <div className="font-mono" style={{ fontWeight: 700 }}>{(interestRate * 100).toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="stat-label">Seasonal Payment</div>
                        <div className="font-mono" style={{ fontWeight: 700, color: 'var(--amber)' }}>${Math.round(seasonalPayment * 10) / 10}M</div>
                      </div>
                      <div>
                        <div className="stat-label">Term</div>
                        <div className="font-mono" style={{ fontWeight: 700 }}>{termSeasons} seasons</div>
                      </div>
                    </div>
                    <p className="font-body" style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', marginTop: 8, fontStyle: 'italic' }}>
                      Missing 2 consecutive payments triggers a forced sale. Pay off early to save on interest.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
