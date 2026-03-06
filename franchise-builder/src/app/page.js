'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  initializeLeague, createPlayerFranchise, simulateFullSeason,
  generateDraftProspects, draftPlayer, generateFreeAgents,
  calculateCapSpace, calculateValuation, rand, pick, clamp, generateId,
} from '@/lib/engine';
import { NGL_TEAMS, ABL_TEAMS } from '@/data/leagues';
import { saveGame, loadGame, hasSave, deleteSave } from '@/lib/storage';
import {
  generateSeasonRecap, generateGMForecast, generateGMGrade,
  generateDynastyNarrative, generateOffseasonEvents, generateLeagueNewspaper,
  setNarrativeApiKey, hasNarrativeApi,
} from '@/lib/narrative';

// Re-export data for component use
import {
  NGL_SALARY_CAP, ABL_SALARY_CAP, NGL_DRAFT_ROUNDS, ABL_DRAFT_ROUNDS,
} from '@/data/leagues';

// ============================================================
// TICKER BAR COMPONENT
// ============================================================
function TickerBar({ leagueTeams, franchises, season }) {
  const items = useMemo(() => {
    if (!leagueTeams) return ['FRANCHISE BUILDER V2 — LOADING...'];
    const msgs = [];
    msgs.push(`SEASON ${season || 1}`);

    // Top teams from each league
    const nglTop = [...(leagueTeams.ngl || [])].sort((a, b) => b.wins - a.wins).slice(0, 3);
    const ablTop = [...(leagueTeams.abl || [])].sort((a, b) => b.wins - a.wins).slice(0, 3);

    nglTop.forEach(t => msgs.push(`NGL: ${t.city} ${t.name} (${t.wins}-${t.losses})`));
    ablTop.forEach(t => msgs.push(`ABL: ${t.city} ${t.name} (${t.wins}-${t.losses})`));

    franchises?.forEach(f => {
      msgs.push(`YOUR TEAM: ${f.city} ${f.name} — ${f.wins}-${f.losses} | Fan: ${f.fanRating}`);
    });

    return msgs;
  }, [leagueTeams, franchises, season]);

  const tickerText = items.join('   ///   ');

  return (
    <div className="ticker-bar" style={{ padding: '6px 0', position: 'relative', zIndex: 50 }}>
      <div className="ticker-scroll">
        <span>{tickerText}   ///   {tickerText}</span>
      </div>
    </div>
  );
}

// ============================================================
// NAV BAR COMPONENT
// ============================================================
function NavBar({ screen, setScreen, franchises, gmReputation, portfolio }) {
  return (
    <nav style={{
      background: 'var(--cream-dark)',
      borderBottom: '2px solid var(--cream-darker)',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <h1
          className="font-display"
          style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', color: 'var(--ink)' }}
          onClick={() => setScreen(franchises.length > 0 ? 'portfolio' : 'intro')}
        >
          Franchise Builder
        </h1>
        {franchises.length > 0 && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="tab-btn" onClick={() => setScreen('portfolio')}
              style={screen === 'portfolio' ? { color: 'var(--red)', fontWeight: 700 } : {}}>
              Empire
            </button>
            <button className="tab-btn" onClick={() => setScreen('dashboard')}
              style={screen === 'dashboard' ? { color: 'var(--red)', fontWeight: 700 } : {}}>
              Dashboard
            </button>
            <button className="tab-btn" onClick={() => setScreen('league')}
              style={screen === 'league' ? { color: 'var(--red)', fontWeight: 700 } : {}}>
              League
            </button>
            <button className="tab-btn" onClick={() => setScreen('market')}
              style={screen === 'market' ? { color: 'var(--red)', fontWeight: 700 } : {}}>
              Market
            </button>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {franchises.length > 0 && (
          <>
            <div style={{ textAlign: 'right' }}>
              <span className="stat-label">Portfolio</span>
              <div className="stat-value" style={{ fontSize: '0.85rem' }}>${portfolio}M</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="stat-label">GM Rep</span>
              <div className="stat-value" style={{ fontSize: '0.85rem' }}>{gmReputation}</div>
            </div>
          </>
        )}
        <button className="tab-btn" onClick={() => setScreen('settings')} style={{ fontSize: '0.7rem' }}>
          Settings
        </button>
      </div>
    </nav>
  );
}

// ============================================================
// INTRO SCREEN
// ============================================================
function IntroScreen({ onNewGame, onLoadGame, hasSaveFile }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '80vh', padding: 40, textAlign: 'center',
    }}>
      <h1 className="font-display" style={{
        fontSize: '3.5rem', fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--ink)', marginBottom: 8,
      }}>
        Franchise Builder
      </h1>
      <div style={{
        width: 60, height: 3, background: 'var(--red)', margin: '0 auto 16px',
      }} />
      <p className="font-body" style={{
        fontSize: '1.1rem', color: 'var(--ink-soft)', maxWidth: 500, lineHeight: 1.6,
        marginBottom: 40,
      }}>
        Build a sports empire across two leagues. Draft players, negotiate contracts,
        manage finances, and compete for championships in the NGL and ABL.
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="btn-gold" onClick={onNewGame}>
          New Empire
        </button>
        {hasSaveFile && (
          <button className="btn-secondary" onClick={onLoadGame}>
            Continue Empire
          </button>
        )}
      </div>
      <div style={{ marginTop: 40, display: 'flex', gap: 32 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="font-display" style={{ fontSize: '2rem', color: 'var(--red)', fontWeight: 700 }}>62</div>
          <div className="stat-label">Teams</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="font-display" style={{ fontSize: '2rem', color: 'var(--red)', fontWeight: 700 }}>2</div>
          <div className="stat-label">Leagues</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="font-display" style={{ fontSize: '2rem', color: 'var(--red)', fontWeight: 700 }}>∞</div>
          <div className="stat-label">Seasons</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SETUP SCREEN — Choose league and team
// ============================================================
function SetupScreen({ onCreateFranchise }) {
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);

  const teams = selectedLeague === 'ngl' ? NGL_TEAMS : selectedLeague === 'abl' ? ABL_TEAMS : [];

  // Group by division
  const divisions = useMemo(() => {
    const grouped = {};
    teams.forEach(t => {
      if (!grouped[t.division]) grouped[t.division] = [];
      grouped[t.division].push(t);
    });
    return grouped;
  }, [teams]);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px' }}>
      <h2 className="font-display section-header" style={{ fontSize: '1.5rem' }}>Choose Your League</h2>

      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        <button
          className={selectedLeague === 'ngl' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => { setSelectedLeague('ngl'); setSelectedTeam(null); }}
          style={{ flex: 1, padding: '16px 20px' }}
        >
          <div className="font-display" style={{ fontSize: '1.2rem' }}>NGL</div>
          <div className="font-body" style={{ fontSize: '0.8rem', textTransform: 'none', letterSpacing: 0, fontWeight: 400, marginTop: 4 }}>
            National Gridiron League — 32 teams
          </div>
        </button>
        <button
          className={selectedLeague === 'abl' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => { setSelectedLeague('abl'); setSelectedTeam(null); }}
          style={{ flex: 1, padding: '16px 20px' }}
        >
          <div className="font-display" style={{ fontSize: '1.2rem' }}>ABL</div>
          <div className="font-body" style={{ fontSize: '0.8rem', textTransform: 'none', letterSpacing: 0, fontWeight: 400, marginTop: 4 }}>
            American Basketball League — 30 teams
          </div>
        </button>
      </div>

      {selectedLeague && (
        <>
          <h3 className="font-display section-header" style={{ fontSize: '1.1rem' }}>Select Your Franchise</h3>
          {Object.entries(divisions).map(([div, divTeams]) => (
            <div key={div} style={{ marginBottom: 24 }}>
              <h4 className="font-display" style={{
                fontSize: '0.8rem', color: 'var(--ink-muted)', letterSpacing: '0.1em',
                textTransform: 'uppercase', marginBottom: 8,
              }}>{div} Division</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {divTeams.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTeam(t)}
                    className="card"
                    style={{
                      padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
                      border: selectedTeam?.id === t.id ? '2px solid var(--red)' : '1px solid var(--cream-darker)',
                      background: selectedTeam?.id === t.id ? '#fef5f5' : 'var(--cream)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div className="font-display" style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                      {t.city} {t.name}
                    </div>
                    <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>
                      Market: {t.market}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {selectedTeam && (
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <p className="font-body" style={{ fontSize: '1rem', marginBottom: 16, color: 'var(--ink-soft)' }}>
                Take ownership of the <strong>{selectedTeam.city} {selectedTeam.name}</strong>
              </p>
              <button className="btn-gold" onClick={() => onCreateFranchise(selectedTeam, selectedLeague)}>
                Launch Franchise
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// DASHBOARD SCREEN — Main franchise management
// ============================================================
function DashboardScreen({ franchise, setFranchise, onSimulate, simulating, seasonRecap, gmGrade, events, onResolveEvent }) {
  const [tab, setTab] = useState('home');
  const capInfo = useMemo(() => calculateCapSpace(franchise), [franchise]);
  const valuation = useMemo(() => calculateValuation(franchise), [franchise]);

  const tabs = ['home', 'roster', 'business', 'facilities', 'history'];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '16px 20px' }}>
      {/* Scoreboard */}
      <div className="card-elevated" style={{ padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 className="font-display" style={{ fontSize: '1.6rem', fontWeight: 700, textTransform: 'uppercase' }}>
              {franchise.city} {franchise.name}
            </h2>
            <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
              {franchise.league.toUpperCase()} — Season {franchise.season || 1} — {franchise.coach.name} ({franchise.coach.personality})
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div className="stat-label">Record</div>
              <div className="font-display" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                {franchise.wins}-{franchise.losses}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="stat-label">Rank</div>
              <div className="font-display" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--red)' }}>
                #{franchise.leagueRank || '—'}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="stat-label">Value</div>
              <div className="stat-value" style={{ fontSize: '1.2rem' }}>${valuation}M</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="stat-label">Cap Space</div>
              <div className="stat-value" style={{ fontSize: '1.2rem', color: capInfo.space > 10 ? 'var(--green)' : capInfo.space > 0 ? 'var(--amber)' : 'var(--red)' }}>
                ${capInfo.space}M
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="tab-nav" style={{ marginBottom: 16 }}>
        {tabs.map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'home' && (
        <HomeTab
          franchise={franchise}
          onSimulate={onSimulate}
          simulating={simulating}
          seasonRecap={seasonRecap}
          gmGrade={gmGrade}
          events={events}
          onResolveEvent={onResolveEvent}
        />
      )}
      {tab === 'roster' && <RosterTab franchise={franchise} setFranchise={setFranchise} capInfo={capInfo} />}
      {tab === 'business' && <BusinessTab franchise={franchise} setFranchise={setFranchise} />}
      {tab === 'facilities' && <FacilitiesTab franchise={franchise} setFranchise={setFranchise} />}
      {tab === 'history' && <HistoryTab franchise={franchise} />}
    </div>
  );
}

// ============================================================
// HOME TAB
// ============================================================
function HomeTab({ franchise, onSimulate, simulating, seasonRecap, gmGrade, events, onResolveEvent }) {
  const unresolvedEvents = events.filter(e => !e.resolved);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Season Recap (if exists) */}
      {seasonRecap && (
        <div className="card" style={{ padding: 20 }}>
          <h3 className="font-display section-header" style={{ fontSize: '1rem' }}>Season Recap</h3>
          <p className="font-body" style={{ lineHeight: 1.7, color: 'var(--ink-soft)' }}>{seasonRecap}</p>
          {gmGrade && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="font-display" style={{
                fontSize: '2rem', fontWeight: 700,
                color: gmGrade.grade.startsWith('A') ? 'var(--green)' : gmGrade.grade.startsWith('B') ? 'var(--amber)' : 'var(--red)',
              }}>
                {gmGrade.grade}
              </span>
              <span className="font-body" style={{ fontSize: '0.85rem', color: 'var(--ink-muted)' }}>
                {gmGrade.analysis}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Offseason Events */}
      {unresolvedEvents.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <h3 className="font-display section-header" style={{ fontSize: '1rem' }}>
            Offseason Decisions ({unresolvedEvents.length} remaining)
          </h3>
          {unresolvedEvents.map(event => (
            <div key={event.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--cream-darker)' }}>
              <h4 className="font-display" style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 4 }}>{event.title}</h4>
              <p className="font-body" style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginBottom: 12, lineHeight: 1.5 }}>
                {event.description}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {event.choices.map((choice, ci) => (
                  <button
                    key={ci}
                    className="btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '6px 14px' }}
                    onClick={() => onResolveEvent(event.id, ci)}
                  >
                    {choice.label}
                    {choice.cost ? ` (-$${choice.cost}M)` : ''}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        {[
          { label: 'Fan Rating', value: franchise.fanRating, color: franchise.fanRating > 65 ? 'var(--green)' : 'var(--ink)' },
          { label: 'Chemistry', value: franchise.lockerRoomChemistry, color: franchise.lockerRoomChemistry > 60 ? 'var(--green)' : 'var(--amber)' },
          { label: 'Media Rep', value: franchise.mediaRep },
          { label: 'Community', value: franchise.communityRating },
          { label: 'Revenue', value: `$${franchise.finances.revenue}M`, color: 'var(--green)' },
          { label: 'Profit', value: `$${franchise.finances.profit}M`, color: franchise.finances.profit > 0 ? 'var(--green)' : 'var(--red)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ fontSize: '1.1rem', color: s.color || 'var(--ink)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Simulate Button */}
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <button
          className="btn-gold"
          onClick={onSimulate}
          disabled={simulating || unresolvedEvents.length > 0}
          style={{ padding: '14px 40px', fontSize: '1rem' }}
        >
          {simulating ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              Simulating Season...
            </span>
          ) : unresolvedEvents.length > 0 ? (
            `Resolve ${unresolvedEvents.length} Events First`
          ) : (
            'Simulate Season'
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// ROSTER TAB
// ============================================================
function RosterTab({ franchise, setFranchise, capInfo }) {
  const sortedRoster = useMemo(() =>
    [...franchise.players].sort((a, b) => b.rating - a.rating),
    [franchise.players]
  );

  return (
    <div className="fade-in">
      {/* Cap overview */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="stat-label">Salary Cap</span>
          <span className="font-mono" style={{ fontSize: '0.8rem' }}>
            ${capInfo.used}M / ${capInfo.cap}M
            <span style={{ color: capInfo.space > 10 ? 'var(--green)' : 'var(--red)', marginLeft: 8 }}>
              (${capInfo.space}M free)
            </span>
          </span>
        </div>
        <div className="progress-bar" style={{ marginTop: 6 }}>
          <div className="progress-bar-fill" style={{
            width: `${Math.min(100, (capInfo.used / capInfo.cap) * 100)}%`,
            background: capInfo.space > 10 ? 'var(--green)' : capInfo.space > 0 ? 'var(--amber)' : 'var(--red)',
          }} />
        </div>
      </div>

      {/* Roster table */}
      <div className="card" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--cream-darker)' }}>
              {['Player', 'Pos', 'Age', 'Rating', 'Salary', 'Years', 'Trait', 'Morale', 'Status'].map(h => (
                <th key={h} className="stat-label" style={{ padding: '8px 10px', textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRoster.map(p => (
              <tr key={p.id} style={{
                borderBottom: '1px solid var(--cream-dark)',
                background: p.injured ? '#fef5f5' : 'transparent',
              }}>
                <td className="font-body" style={{ padding: '8px 10px', fontWeight: 500 }}>
                  {p.name}
                  {p.isLocalLegend && <span style={{ color: 'var(--gold)', marginLeft: 4, fontSize: '0.7rem' }}>★</span>}
                </td>
                <td className="font-mono" style={{ padding: '8px 10px' }}>{p.position}</td>
                <td className="font-mono" style={{ padding: '8px 10px' }}>{p.age}</td>
                <td className="font-mono" style={{
                  padding: '8px 10px', fontWeight: 600,
                  color: p.rating >= 85 ? 'var(--green)' : p.rating >= 70 ? 'var(--ink)' : 'var(--ink-muted)',
                }}>{p.rating}</td>
                <td className="font-mono" style={{ padding: '8px 10px' }}>${p.salary}M</td>
                <td className="font-mono" style={{
                  padding: '8px 10px',
                  color: p.yearsLeft <= 1 ? 'var(--red)' : 'var(--ink)',
                }}>{p.yearsLeft}yr</td>
                <td style={{ padding: '8px 10px' }}>
                  {p.trait && <span className={`badge ${
                    p.trait === 'leader' ? 'badge-green' :
                    p.trait === 'mercenary' ? 'badge-amber' :
                    p.trait === 'volatile' || p.trait === 'injury_prone' ? 'badge-red' :
                    'badge-ink'
                  }`}>{p.trait}</span>}
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <div className="progress-bar" style={{ width: 50, display: 'inline-block', verticalAlign: 'middle' }}>
                    <div className="progress-bar-fill" style={{
                      width: `${p.morale}%`,
                      background: p.morale > 70 ? 'var(--green)' : p.morale > 40 ? 'var(--amber)' : 'var(--red)',
                    }} />
                  </div>
                </td>
                <td className="font-mono" style={{ padding: '8px 10px', fontSize: '0.7rem' }}>
                  {p.injured ? (
                    <span className="badge badge-red">{p.injurySeverity}</span>
                  ) : (
                    <span style={{ color: 'var(--green)' }}>Active</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// BUSINESS TAB
// ============================================================
function BusinessTab({ franchise, setFranchise }) {
  const updateBusiness = (field, value) => {
    setFranchise(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Revenue Breakdown */}
      <div className="card" style={{ padding: 20 }}>
        <h3 className="font-display section-header" style={{ fontSize: '1rem' }}>Financials</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <div className="stat-label">Revenue</div>
            <div className="stat-value" style={{ fontSize: '1.2rem', color: 'var(--green)' }}>${franchise.finances.revenue}M</div>
          </div>
          <div>
            <div className="stat-label">Expenses</div>
            <div className="stat-value" style={{ fontSize: '1.2rem', color: 'var(--red)' }}>${franchise.finances.expenses}M</div>
          </div>
          <div>
            <div className="stat-label">Profit</div>
            <div className="stat-value" style={{
              fontSize: '1.2rem',
              color: franchise.finances.profit > 0 ? 'var(--green)' : 'var(--red)',
            }}>${franchise.finances.profit}M</div>
          </div>
        </div>
      </div>

      {/* Ticket Pricing */}
      <div className="card" style={{ padding: 20 }}>
        <h3 className="font-display section-header" style={{ fontSize: '1rem' }}>Ticket Pricing</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="stat-label">Avg. Ticket Price</span>
          <input
            type="range" min="30" max="200" value={franchise.ticketPrice}
            onChange={e => updateBusiness('ticketPrice', Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span className="stat-value">${franchise.ticketPrice}</span>
        </div>
        <p className="font-body" style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 4 }}>
          Higher prices increase revenue but can lower attendance if fans feel the product doesn't match the cost.
        </p>
      </div>

      {/* Fan Demographics */}
      <div className="card" style={{ padding: 20 }}>
        <h3 className="font-display section-header" style={{ fontSize: '1rem' }}>Fan Base</h3>
        <div style={{ display: 'flex', gap: 24 }}>
          <div>
            <div className="stat-label">Die-Hard Fans</div>
            <div className="stat-value" style={{ color: 'var(--green)' }}>{franchise.fanDemographics.dieHard}%</div>
          </div>
          <div>
            <div className="stat-label">Casual Fans</div>
            <div className="stat-value">{franchise.fanDemographics.casual}%</div>
          </div>
        </div>
        <div className="progress-bar" style={{ marginTop: 8 }}>
          <div className="progress-bar-fill" style={{
            width: `${franchise.fanDemographics.dieHard}%`, background: 'var(--green)',
          }} />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FACILITIES TAB
// ============================================================
function FacilitiesTab({ franchise, setFranchise }) {
  const upgradeCost = (current) => (current + 1) * 5;

  const upgradeStaff = (field) => {
    const current = franchise[field];
    if (current >= 3) return;
    const cost = upgradeCost(current);
    setFranchise(prev => ({
      ...prev,
      [field]: current + 1,
      // Cost comes from portfolio in parent
    }));
  };

  const facilities = [
    { key: 'scoutingStaff', label: 'Scouting Department', desc: 'Better draft prospect evaluation' },
    { key: 'developmentStaff', label: 'Player Development', desc: 'Faster player growth' },
    { key: 'medicalStaff', label: 'Medical Staff', desc: 'Reduced injury risk & recovery' },
    { key: 'marketingStaff', label: 'Marketing Team', desc: 'Higher fan engagement & revenue' },
    { key: 'trainingFacility', label: 'Training Facility', desc: 'Win probability boost' },
    { key: 'weightRoom', label: 'Weight Room', desc: 'Player conditioning' },
    { key: 'filmRoom', label: 'Film Room', desc: 'Tactical edge' },
  ];

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Stadium */}
      <div className="card" style={{ padding: 20 }}>
        <h3 className="font-display section-header" style={{ fontSize: '1rem' }}>Stadium</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <div className="stat-label">Capacity</div>
            <div className="stat-value">{franchise.stadiumCapacity.toLocaleString()}</div>
          </div>
          <div>
            <div className="stat-label">Condition</div>
            <div className="stat-value" style={{
              color: franchise.stadiumCondition > 70 ? 'var(--green)' : franchise.stadiumCondition > 40 ? 'var(--amber)' : 'var(--red)',
            }}>{franchise.stadiumCondition}%</div>
          </div>
          <div>
            <div className="stat-label">Age</div>
            <div className="stat-value">{franchise.stadiumAge} yrs</div>
          </div>
        </div>
      </div>

      {/* Staff & Facilities */}
      {facilities.map(f => (
        <div key={f.key} className="card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="font-display" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{f.label}</div>
            <div className="font-body" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>{f.desc}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 3 }}>
              {[1, 2, 3].map(lvl => (
                <div key={lvl} style={{
                  width: 20, height: 8, borderRadius: 2,
                  background: franchise[f.key] >= lvl ? 'var(--red)' : 'var(--cream-darker)',
                }} />
              ))}
            </div>
            {franchise[f.key] < 3 && (
              <button className="btn-secondary" style={{ fontSize: '0.65rem', padding: '4px 10px' }}
                onClick={() => upgradeStaff(f.key)}>
                Upgrade (${upgradeCost(franchise[f.key])}M)
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// HISTORY TAB
// ============================================================
function HistoryTab({ franchise }) {
  return (
    <div className="fade-in">
      <div className="card" style={{ padding: 20 }}>
        <h3 className="font-display section-header" style={{ fontSize: '1rem' }}>Season History</h3>
        {franchise.history.length === 0 ? (
          <p className="font-body" style={{ color: 'var(--ink-muted)' }}>No seasons played yet. Simulate your first season to see history.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--cream-darker)' }}>
                {['Season', 'Record', 'Win%', 'Revenue', 'Profit', 'Fan Rating'].map(h => (
                  <th key={h} className="stat-label" style={{ padding: '8px 10px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...franchise.history].reverse().map(h => (
                <tr key={h.season} style={{ borderBottom: '1px solid var(--cream-dark)' }}>
                  <td className="font-mono" style={{ padding: '8px 10px', fontWeight: 600 }}>{h.season}</td>
                  <td className="font-mono" style={{ padding: '8px 10px' }}>{h.wins}-{h.losses}</td>
                  <td className="font-mono" style={{ padding: '8px 10px' }}>{h.winPct ? (h.winPct * 100).toFixed(1) + '%' : '—'}</td>
                  <td className="font-mono" style={{ padding: '8px 10px', color: 'var(--green)' }}>${h.revenue}M</td>
                  <td className="font-mono" style={{
                    padding: '8px 10px',
                    color: h.profit > 0 ? 'var(--green)' : 'var(--red)',
                  }}>${h.profit}M</td>
                  <td className="font-mono" style={{ padding: '8px 10px' }}>{h.fanRating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ============================================================
// LEAGUE SCREEN — Standings
// ============================================================
function LeagueScreen({ leagueTeams, franchises }) {
  const [viewLeague, setViewLeague] = useState('ngl');

  const standings = useMemo(() => {
    const teams = leagueTeams?.[viewLeague] || [];
    return [...teams].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  }, [leagueTeams, viewLeague]);

  const playerIds = franchises.map(f => f.id);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={viewLeague === 'ngl' ? 'btn-primary' : 'btn-secondary'} onClick={() => setViewLeague('ngl')}>NGL</button>
        <button className={viewLeague === 'abl' ? 'btn-primary' : 'btn-secondary'} onClick={() => setViewLeague('abl')}>ABL</button>
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--cream-darker)' }}>
              {['Rank', 'Team', 'W', 'L', 'Win%', 'Fan Rating', 'Market'].map(h => (
                <th key={h} className="stat-label" style={{ padding: '8px 10px', textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {standings.map((t, i) => {
              const isPlayer = playerIds.includes(t.id);
              return (
                <tr key={t.id} style={{
                  borderBottom: '1px solid var(--cream-dark)',
                  background: isPlayer ? '#fef5f5' : 'transparent',
                  fontWeight: isPlayer ? 600 : 400,
                }}>
                  <td className="font-mono" style={{ padding: '8px 10px' }}>{i + 1}</td>
                  <td className="font-body" style={{ padding: '8px 10px' }}>
                    {t.city} {t.name}
                    {isPlayer && <span style={{ color: 'var(--red)', marginLeft: 6, fontSize: '0.7rem' }}>YOU</span>}
                  </td>
                  <td className="font-mono" style={{ padding: '8px 10px' }}>{t.wins}</td>
                  <td className="font-mono" style={{ padding: '8px 10px' }}>{t.losses}</td>
                  <td className="font-mono" style={{ padding: '8px 10px' }}>
                    {t.wins + t.losses > 0 ? ((t.wins / (t.wins + t.losses)) * 100).toFixed(1) + '%' : '—'}
                  </td>
                  <td className="font-mono" style={{ padding: '8px 10px' }}>{t.fanRating}</td>
                  <td className="font-mono" style={{ padding: '8px 10px' }}>{t.market}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// SETTINGS SCREEN
// ============================================================
function SettingsScreen({ onDeleteSave, setScreen }) {
  const [apiKey, setApiKeyInput] = useState('');
  const [saved, setSaved] = useState(false);

  const saveApiKey = () => {
    if (apiKey.trim()) {
      setNarrativeApiKey(apiKey.trim());
      try { localStorage.setItem('fb_api_key', apiKey.trim()); } catch {}
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 20px' }}>
      <h2 className="font-display section-header" style={{ fontSize: '1.3rem' }}>Settings</h2>

      {/* Claude API Key */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h3 className="font-display" style={{ fontSize: '0.9rem', marginBottom: 8, fontWeight: 600 }}>Claude API Key (Optional)</h3>
        <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: 12, lineHeight: 1.5 }}>
          Adding an API key enables AI-generated narratives, season recaps, and dynamic events.
          The game works perfectly without it using procedural text.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKeyInput(e.target.value)}
            placeholder="sk-ant-..."
            className="font-mono"
            style={{
              flex: 1, padding: '8px 12px', border: '1px solid var(--cream-darker)',
              borderRadius: 2, fontSize: '0.8rem', background: 'var(--cream)',
            }}
          />
          <button className="btn-secondary" onClick={saveApiKey}>
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
        <div style={{ marginTop: 8 }}>
          <span className="font-mono" style={{ fontSize: '0.7rem', color: hasNarrativeApi() ? 'var(--green)' : 'var(--ink-muted)' }}>
            {hasNarrativeApi() ? '● AI Narratives Active' : '○ Using Procedural Text'}
          </span>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card" style={{ padding: 20, borderColor: 'var(--red)' }}>
        <h3 className="font-display" style={{ fontSize: '0.9rem', marginBottom: 8, fontWeight: 600, color: 'var(--red)' }}>Danger Zone</h3>
        <button className="btn-secondary" style={{ borderColor: 'var(--red)', color: 'var(--red)', fontSize: '0.8rem' }}
          onClick={() => {
            if (confirm('Delete all save data? This cannot be undone.')) {
              onDeleteSave();
              setScreen('intro');
            }
          }}>
          Delete All Save Data
        </button>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [screen, setScreen] = useState('intro');
  const [loading, setLoading] = useState(true);

  // Core game state
  const [portfolio, setPortfolio] = useState(50);
  const [gmReputation, setGmReputation] = useState(50);
  const [dynastyHistory, setDynastyHistory] = useState([]);
  const [leagueTeams, setLeagueTeams] = useState(null);
  const [franchises, setFranchises] = useState([]);
  const [stakes, setStakes] = useState([]);
  const [season, setSeason] = useState(1);
  const [notifications, setNotifications] = useState([]);
  const [freeAgents, setFreeAgents] = useState({ ngl: [], abl: [] });

  // UI state
  const [activeFranchiseIdx, setActiveFranchiseIdx] = useState(0);
  const [simulating, setSimulating] = useState(false);
  const [seasonRecap, setSeasonRecap] = useState(null);
  const [gmGrade, setGmGrade] = useState(null);
  const [events, setEvents] = useState([]);
  const [saveStatus, setSaveStatus] = useState('saved');

  // Load saved API key
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem('fb_api_key');
      if (savedKey) setNarrativeApiKey(savedKey);
    } catch {}
  }, []);

  // Initialize or load
  useEffect(() => {
    const init = async () => {
      const saved = await loadGame();
      if (saved) {
        setPortfolio(saved.portfolio || 50);
        setGmReputation(saved.gmReputation || 50);
        setDynastyHistory(saved.dynastyHistory || []);
        setLeagueTeams(saved.leagueTeams);
        setFranchises(saved.franchises || []);
        setStakes(saved.stakes || []);
        setSeason(saved.season || 1);
        setNotifications(saved.notifications || []);
        setFreeAgents(saved.freeAgents || { ngl: [], abl: [] });
      }
      setLoading(false);
    };
    init();
  }, []);

  // Auto-save
  const doSave = useCallback(async () => {
    if (!leagueTeams || franchises.length === 0) return;
    setSaveStatus('saving');
    await saveGame({
      portfolio, gmReputation, dynastyHistory, leagueTeams,
      franchises, stakes, season, notifications, freeAgents,
    });
    setSaveStatus('saved');
  }, [portfolio, gmReputation, dynastyHistory, leagueTeams, franchises, stakes, season, notifications, freeAgents]);

  // Save on significant state changes (debounced)
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!leagueTeams || franchises.length === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 2000);
    return () => clearTimeout(saveTimer.current);
  }, [franchises, leagueTeams, portfolio, season, doSave]);

  // --- HANDLERS ---
  const handleNewGame = () => {
    const league = initializeLeague();
    setLeagueTeams(league);
    setPortfolio(50);
    setGmReputation(50);
    setDynastyHistory([]);
    setFranchises([]);
    setStakes([]);
    setSeason(1);
    setFreeAgents({ ngl: generateFreeAgents('ngl'), abl: generateFreeAgents('abl') });
    setSeasonRecap(null);
    setGmGrade(null);
    setEvents([]);
    setScreen('setup');
  };

  const handleLoadGame = () => {
    if (franchises.length > 0 && leagueTeams) {
      setScreen('dashboard');
    }
  };

  const handleCreateFranchise = (teamTemplate, league) => {
    const newFranchise = createPlayerFranchise(teamTemplate, league);

    // Remove from AI team list
    setLeagueTeams(prev => ({
      ...prev,
      [league]: prev[league].map(t => t.id === teamTemplate.id ? { ...t, isPlayerOwned: true } : t),
    }));

    setFranchises(prev => [...prev, newFranchise]);
    setActiveFranchiseIdx(0);

    // Generate initial events
    generateOffseasonEvents(newFranchise).then(evts => {
      setEvents(evts.map(e => ({ ...e, resolved: false })));
    });

    setScreen('dashboard');
  };

  const handleResolveEvent = (eventId, choiceIdx) => {
    setEvents(prev => prev.map(e => {
      if (e.id !== eventId) return e;
      const choice = e.choices[choiceIdx];

      // Apply effects to franchise
      setFranchises(prevF => prevF.map((f, i) => {
        if (i !== activeFranchiseIdx) return f;
        const updated = { ...f };
        if (choice.cost) setPortfolio(p => Math.round((p - choice.cost) * 10) / 10);
        if (choice.communityBonus) updated.communityRating = clamp(updated.communityRating + choice.communityBonus, 0, 100);
        if (choice.mediaBonus) updated.mediaRep = clamp(updated.mediaRep + choice.mediaBonus, 0, 100);
        if (choice.stadiumBonus) updated.stadiumCondition = clamp(updated.stadiumCondition + choice.stadiumBonus, 0, 100);
        if (choice.revenue) setPortfolio(p => Math.round((p + choice.revenue) * 10) / 10);
        if (choice.coachBonus && updated.coach.level < 4) updated.coach = { ...updated.coach, level: updated.coach.level + 1 };
        return updated;
      }));

      return { ...e, resolved: true, chosenIdx: choiceIdx };
    }));
  };

  const handleSimulate = async () => {
    if (simulating) return;
    setSimulating(true);
    setSeasonRecap(null);
    setGmGrade(null);

    // Small delay for UI feedback
    await new Promise(r => setTimeout(r, 300));

    const result = simulateFullSeason(leagueTeams, franchises, season);

    setLeagueTeams(result.leagueTeams);
    setFranchises(result.franchises);
    setSeason(s => s + 1);

    // Add profit to portfolio
    const totalProfit = result.franchises.reduce((s, f) => s + f.finances.profit, 0);
    setPortfolio(p => Math.round((p + totalProfit) * 10) / 10);

    // Generate narrative
    if (result.franchises.length > 0) {
      const f = result.franchises[activeFranchiseIdx] || result.franchises[0];
      const [recap, grade] = await Promise.all([
        generateSeasonRecap(f),
        generateGMGrade(f),
      ]);
      setSeasonRecap(recap);
      setGmGrade(grade);

      // Dynasty narrative every 3 seasons
      if (season % 3 === 0) {
        const dynasty = await generateDynastyNarrative(f);
        setDynastyHistory(prev => [...prev, { ...dynasty, season }]);
        setFranchises(prevF => prevF.map((pf, i) =>
          i === activeFranchiseIdx ? { ...pf, dynastyEra: dynasty.era } : pf
        ));
      }

      // Generate new offseason events
      const newEvents = await generateOffseasonEvents(f);
      setEvents(newEvents.map(e => ({ ...e, resolved: false })));
    }

    // Refresh free agents
    setFreeAgents({ ngl: generateFreeAgents('ngl'), abl: generateFreeAgents('abl') });

    setSimulating(false);
    await doSave();
  };

  const handleDeleteSave = async () => {
    await deleteSave();
    setLeagueTeams(null);
    setFranchises([]);
    setPortfolio(50);
    setGmReputation(50);
    setSeason(1);
    setSeasonRecap(null);
    setGmGrade(null);
    setEvents([]);
  };

  const setActiveFranchise = (updater) => {
    setFranchises(prev => prev.map((f, i) =>
      i === activeFranchiseIdx ? (typeof updater === 'function' ? updater(f) : updater) : f
    ));
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
        <span className="font-display" style={{ color: 'var(--ink-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.8rem' }}>
          Loading Franchise Builder...
        </span>
      </div>
    );
  }

  const activeFranchise = franchises[activeFranchiseIdx];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TickerBar leagueTeams={leagueTeams} franchises={franchises} season={season} />
      <NavBar
        screen={screen} setScreen={setScreen}
        franchises={franchises} gmReputation={gmReputation} portfolio={portfolio}
      />

      <main style={{ flex: 1, paddingBottom: 40 }}>
        {screen === 'intro' && (
          <IntroScreen
            onNewGame={handleNewGame}
            onLoadGame={handleLoadGame}
            hasSaveFile={franchises.length > 0}
          />
        )}
        {screen === 'setup' && (
          <SetupScreen onCreateFranchise={handleCreateFranchise} />
        )}
        {screen === 'dashboard' && activeFranchise && (
          <DashboardScreen
            franchise={activeFranchise}
            setFranchise={setActiveFranchise}
            onSimulate={handleSimulate}
            simulating={simulating}
            seasonRecap={seasonRecap}
            gmGrade={gmGrade}
            events={events}
            onResolveEvent={handleResolveEvent}
          />
        )}
        {screen === 'league' && (
          <LeagueScreen leagueTeams={leagueTeams} franchises={franchises} />
        )}
        {screen === 'market' && (
          <div style={{ maxWidth: 600, margin: '40px auto', padding: 20, textAlign: 'center' }}>
            <h2 className="font-display section-header" style={{ fontSize: '1.3rem' }}>Franchise Market</h2>
            <p className="font-body" style={{ color: 'var(--ink-muted)' }}>
              The franchise market will expand in Phase 2 — buy stakes, acquire new teams, and build your empire.
            </p>
          </div>
        )}
        {screen === 'settings' && (
          <SettingsScreen onDeleteSave={handleDeleteSave} setScreen={setScreen} />
        )}
      </main>

      {/* Save status indicator */}
      <div style={{
        position: 'fixed', bottom: 12, right: 12,
        padding: '4px 10px', borderRadius: 2,
        background: saveStatus === 'saving' ? 'var(--amber)' : 'var(--green)',
        color: 'white', fontSize: '0.65rem',
        fontFamily: 'var(--font-mono)',
        opacity: 0.8,
      }}>
        {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
      </div>
    </div>
  );
}
