'use client';
import { useState, useMemo, useCallback } from 'react';
import { getFranchiseAskingPrice, getFranchiseFlavor } from '@/lib/engine';
import { NGL_TEAMS, ABL_TEAMS, getMarketTier, getMarketTierInfo } from '@/data/leagues';

// ============================================================
// FRANCHISE SELECTION SCREEN
// ============================================================
export default function FranchiseSelectionScreen({ onCreate }) {
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const STARTING = 30;

  const allTeams = useMemo(() => {
    const ngl = NGL_TEAMS.map(t => ({ ...t, league: 'ngl' }));
    const abl = ABL_TEAMS.map(t => ({ ...t, league: 'abl' }));
    return [...ngl, ...abl];
  }, []);

  const filtered = useMemo(() => {
    if (leagueFilter === 'all') return allTeams;
    return allTeams.filter(t => t.league === leagueFilter);
  }, [allTeams, leagueFilter]);

  const getTeamExtras = useCallback((team) => {
    const seed = team.id ? team.id.charCodeAt(0) + team.id.charCodeAt(team.id.length - 1) : 42;
    const fanRating = 40 + ((seed * 17 + 3) % 41);
    const stadiumCondition = 60 + ((seed * 13 + 7) % 31);
    const askingPrice = getFranchiseAskingPrice(team);
    const flavor = getFranchiseFlavor(team, askingPrice);
    return { fanRating, stadiumCondition, askingPrice, flavor };
  }, []);

  const sel = selected ? getTeamExtras(selected) : null;
  const hasDebt = sel && sel.askingPrice > STARTING;

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '20px 12px' }}>
      <h2 className="font-display section-header" style={{ fontSize: '1.3rem' }}>Choose Your Franchise</h2>
      <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: 16 }}>
        You start with <strong>$30M</strong> liquid capital. If the asking price exceeds $30M you will carry acquisition debt.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="stat-label" style={{ marginRight: 4 }}>Filter:</span>
        {[['all', 'All Leagues', false], ['ngl', 'NGL — Football', false], ['abl', 'ABL — Basketball', true]].map(([val, label, comingSoon]) => (
          <button
            key={val}
            className={leagueFilter === val ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '0.78rem', opacity: comingSoon ? 0.55 : 1, position: 'relative' }}
            onClick={() => !comingSoon && setLeagueFilter(val)}
            disabled={comingSoon}
            title={comingSoon ? 'ABL — Coming Soon' : undefined}
          >
            {label}{comingSoon && <span className="badge badge-amber" style={{ marginLeft: 6, verticalAlign: 'middle' }}>Soon</span>}
          </button>
        ))}
      </div>
      <div className="franchise-grid">
        {filtered.map(team => {
          const extras = getTeamExtras(team);
          const tierInfo = getMarketTierInfo(team.market);
          const isSelected = selected?.id === team.id && selected?.league === team.league;
          const isABL = team.league === 'abl';
          return (
            <div
              key={`${team.league}-${team.id}`}
              className={`card franchise-card ${isSelected ? 'selected' : ''}`}
              onClick={() => !isABL && setSelected(isSelected ? null : team)}
              style={{
                cursor: isABL ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                borderLeft: `5px solid ${team.primaryColor || 'var(--cream-darker)'}`,
                background: isABL ? '#f5f5f0' : undefined,
                transition: 'border-color 0.2s, box-shadow 0.2s',
                opacity: isABL ? 0.7 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div className="font-display" style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.08 }}>
                  {team.city}<br />{team.name}
                </div>
                <span className="badge badge-ink" style={{ background: team.primaryColor || (team.league === 'ngl' ? '#1a3a5c' : '#2d5a3d'), color: '#fff', marginLeft: 6, flexShrink: 0 }}>
                  {team.league === 'ngl' ? 'NGL' : 'ABL'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <span className="font-mono" style={{ fontSize: '0.72rem', color: tierInfo?.color || 'var(--ink-muted)' }}>Tier {getMarketTier(team.market)} · {tierInfo?.label}</span>
                <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>{team.division || ''}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10, marginBottom: 10 }}>
                <div>
                  <div className="stat-label">Ask Price</div>
                  <div className="font-mono" style={{ fontSize: '0.88rem', color: extras.askingPrice > STARTING ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>
                    ${extras.askingPrice}M
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="stat-label">Fans</div>
                  <div className="font-mono" style={{ fontSize: '0.88rem' }}>{extras.fanRating}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="stat-label">Stadium</div>
                  <div className="font-mono" style={{ fontSize: '0.88rem', color: extras.stadiumCondition > 75 ? 'var(--green)' : extras.stadiumCondition > 60 ? 'var(--amber)' : 'var(--red)' }}>
                    {extras.stadiumCondition}%
                  </div>
                </div>
              </div>
              <p className="font-body" style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', lineHeight: 1.55, marginTop: 4, fontStyle: 'italic' }}>
                {extras.flavor}
              </p>
              {extras.askingPrice > STARTING && !isABL && (
                <div className="badge badge-red" style={{ marginTop: 10 }}>
                  DEBT: ${extras.askingPrice - STARTING}M
                </div>
              )}
              {isABL && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', background: 'rgba(245,245,240,0.82)', borderRadius: 6,
                }}>
                  <span className="font-display" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Coming Soon
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {selected && sel && (
        <div className="card-elevated confirm-sheet" style={{ background: 'rgba(245,240,232,0.98)', borderTop: '3px solid var(--ink)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div className="font-display" style={{ fontSize: '1.25rem', fontWeight: 700 }}>{selected.city} {selected.name}</div>
              <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                {selected.league === 'ngl' ? 'NGL Football' : 'ABL Basketball'} · Asking ${sel.askingPrice}M · Starting Cash $30M
              </div>
              {hasDebt && (
                <div className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--red)', marginTop: 6 }}>
                  You will carry ${sel.askingPrice - STARTING}M acquisition debt at 8% interest.
                </div>
              )}
            </div>
            <button className="btn-gold" style={{ minHeight: 46, padding: '12px 28px' }} onClick={() => onCreate(selected, selected.league)}>
              {hasDebt ? `Buy Franchise (${sel.askingPrice - STARTING}M Debt)` : 'Launch Franchise'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
