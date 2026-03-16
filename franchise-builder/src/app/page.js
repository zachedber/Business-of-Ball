'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  initializeLeague, createPlayerFranchise,
  simulateFullSeason, simulateFullSeasonFirstHalf, simulateFullSeasonSecondHalf,
  generateDraftProspects, draftPlayer, generateFreeAgents, generateDeadlineFreeAgents,
  calculateCapSpace, calculateValuation, projectRevenue,
  rand, pick, clamp, generateId,
  generateCoachCandidates, fireCoach, hireCoach,
  genPressConference, generateStakeOffers, calcStakeIncome, calcStakeValue,
  genRivalryEvent, maxLoan, takeLoan, repayDebt,
  GM_TIERS, getGMTier,
  generateNamingRightsOffer, acceptNamingRights,
  generateCBAEvent, generateNewspaper,
  generateNotifications, updateGMReputation,
} from '@/lib/engine';
import {
  NGL_TEAMS, ABL_TEAMS, MARKET_TIERS, getMarketTier, getMarketTierInfo,
  UPGRADE_COSTS, STARTING_CASH,
} from '@/data/leagues';
import { saveGame, loadGame, deleteSave } from '@/lib/storage';
import {
  generateSeasonRecap, generateGMGrade, generateDynastyNarrative,
  generateOffseasonEvents, setNarrativeApiKey, hasNarrativeApi,
} from '@/lib/narrative';
import TradeDeadlineScreen from '@/app/components/TradeDeadlineScreen';
import NotificationsPanel, { NotificationBadge } from '@/app/components/NotificationsPanel';

// ============================================================
// TICKER
// ============================================================
function Ticker({ lt, fr, season }) {
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
function Nav({ screen, setScreen, fr, gmRep, cash, notifCount }) {
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
              <div className="stat-value" style={{ fontSize: '0.8rem', color: cash > 5 ? 'var(--green)' : cash > 0 ? 'var(--amber)' : 'var(--red)' }}>
                ${Math.round(cash * 10) / 10}M
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="stat-label">{tier.badge}</span>
              <div className="stat-value" style={{ fontSize: '0.7rem' }}>{gmRep}</div>
            </div>
          </>}
          <button className="tab-btn" onClick={() => setScreen('settings')} style={{ fontSize: '0.6rem' }}>⚙</button>
        </div>
      </div>
      {fr.length > 0 && (
        <div className="nav-links">
          {[['portfolio', 'Empire'], ['dashboard', 'Team'], ['league', 'League'], ['market', 'Market']].map(([s, label]) => (
            <button
              key={s}
              className="tab-btn"
              onClick={() => setScreen(s)}
              style={screen === s ? { color: 'var(--red)', fontWeight: 700 } : {}}
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
// INTRO
// ============================================================
function Intro({ onNew, onLoad, hasSv }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '75vh', padding: '30px 16px', textAlign: 'center' }}>
      <h1 className="font-display" style={{ fontSize: 'clamp(2rem,8vw,3.5rem)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Business of Ball
      </h1>
      <div style={{ width: 60, height: 3, background: 'var(--red)', margin: '8px auto 12px' }} />
      <p className="font-body" style={{ fontSize: 'clamp(0.85rem,3vw,1.05rem)', color: 'var(--ink-soft)', maxWidth: 460, lineHeight: 1.6, marginBottom: 28 }}>
        Build a sports empire. Manage franchises across a football league and a basketball league. Draft, negotiate, compete.
      </p>
      <p className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--ink-faint)', marginBottom: 20 }}>More features coming soon</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="btn-gold" onClick={onNew}>New Empire</button>
        {hasSv && <button className="btn-secondary" onClick={onLoad}>Continue</button>}
      </div>
    </div>
  );
}

// ============================================================
// SETUP
// ============================================================
function Setup({ onCreate }) {
  const [league, setLeague] = useState(null);
  const [tier, setTier] = useState(null);
  const [team, setTeam] = useState(null);
  const teams = league === 'ngl' ? NGL_TEAMS : league === 'abl' ? ABL_TEAMS : [];
  const teamsByTier = useMemo(() => {
    const grouped = {};
    teams.forEach(t => {
      const ti = getMarketTier(t.market);
      if (!grouped[ti]) grouped[ti] = [];
      grouped[ti].push(t);
    });
    return grouped;
  }, [teams]);

  return (
    <div style={{ maxWidth: 750, margin: '0 auto', padding: '30px 16px' }}>
      <h2 className="font-display section-header" style={{ fontSize: '1.3rem' }}>Choose Your Sport</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        {[['ngl', 'NGL', 'Football League — 32 teams', '🏈'], ['abl', 'ABL', 'Basketball League — 30 teams', '🏀']].map(([id, nm, desc, em]) => (
          <button
            key={id}
            className={league === id ? 'btn-primary' : 'btn-secondary'}
            onClick={() => { setLeague(id); setTeam(null); setTier(null); }}
            style={{ flex: 1, minWidth: 140, padding: '14px 16px', textAlign: 'left' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.4rem' }}>{em}</span>
              <div>
                <div className="font-display" style={{ fontSize: '1.1rem' }}>{nm}</div>
                <div className="font-body" style={{ fontSize: '0.75rem', textTransform: 'none', letterSpacing: 0, fontWeight: 400, marginTop: 2 }}>{desc}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
      {league && <>
        <h3 className="font-display section-header" style={{ fontSize: '1.1rem' }}>Select Market Tier</h3>
        <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: 14 }}>New GMs start in mid, small, or budget markets.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {Object.entries(MARKET_TIERS).map(([t, info]) => {
            const ti = Number(t);
            const locked = ![3, 4, 5].includes(ti);
            const count = teamsByTier[ti]?.length || 0;
            return (
              <button
                key={t}
                onClick={() => { if (!locked) { setTier(ti); setTeam(null); } }}
                disabled={locked}
                className="card"
                style={{ padding: '10px 14px', cursor: locked ? 'not-allowed' : 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: tier === ti ? `2px solid ${info.color}` : '1px solid var(--cream-darker)', opacity: locked ? 0.4 : 1 }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="font-display" style={{ fontSize: '0.85rem', fontWeight: 700, color: info.color }}>TIER {t} — {info.label}</span>
                    {locked && <span className="badge badge-ink" style={{ fontSize: '0.55rem' }}>LOCKED</span>}
                  </div>
                  <div className="font-body" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginTop: 1 }}>{info.desc}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>{count} teams</span>
                  {STARTING_CASH[ti] && <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--green)' }}>${STARTING_CASH[ti]}M</div>}
                </div>
              </button>
            );
          })}
        </div>
        {tier && teamsByTier[tier] && <>
          <h3 className="font-display section-header" style={{ fontSize: '1rem' }}>Pick Franchise</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 6, marginBottom: 20 }}>
            {teamsByTier[tier].map(t => (
              <button
                key={t.id}
                onClick={() => setTeam(t)}
                className="card"
                style={{ padding: '10px 12px', cursor: 'pointer', textAlign: 'left', border: team?.id === t.id ? '2px solid var(--red)' : '1px solid var(--cream-darker)', background: team?.id === t.id ? '#fef5f5' : 'var(--cream)' }}
              >
                <div className="font-display" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t.city} {t.name}</div>
                <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--ink-muted)' }}>Market {t.market} · {t.division}</div>
              </button>
            ))}
          </div>
        </>}
        {team && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <p className="font-body" style={{ fontSize: '0.95rem', marginBottom: 14 }}>
              <strong>{team.city} {team.name}</strong>{' '}
              <span className="font-mono" style={{ fontSize: '0.7rem', color: MARKET_TIERS[tier]?.color }}>T{tier} · ${STARTING_CASH[tier]}M</span>
            </p>
            <button className="btn-gold" onClick={() => onCreate(team, league)}>Launch Franchise</button>
          </div>
        )}
      </>}
    </div>
  );
}

// ============================================================
// MINI CHART
// ============================================================
function MiniChart({ data, width = 280, height = 80, color = 'var(--red)' }) {
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
// DASHBOARD
// ============================================================
function Dashboard({ fr, setFr, onSim, simming, recap, grade, events, onResolve, pressConf, onPressConf, newspaper, newspaperDismissed, onDismissNewspaper, cbaEvent, onCBA, namingOffer, onNaming, gmRep, notifications, onDismissNotif, onCashChange }) {
  const [tab, setTab] = useState('home');
  const cap = useMemo(() => calculateCapSpace(fr), [fr]);
  const val = useMemo(() => calculateValuation(fr), [fr]);
  const gmTier = getGMTier(gmRep);
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '12px 12px' }}>
      <div className="card-elevated scoreboard" style={{ marginBottom: 12 }}>
        <div>
          <h2 className="font-display" style={{ fontSize: 'clamp(1.1rem,4vw,1.5rem)', fontWeight: 700, textTransform: 'uppercase' }}>
            {fr.city} {fr.name}
          </h2>
          <div className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--ink-muted)' }}>
            {fr.league === 'ngl' ? '🏈 NGL' : '🏀 ABL'} · S{fr.season || 1} · {fr.coach.name}
            {fr.economyCycle === 'boom' ? ' 📈' : fr.economyCycle === 'recession' ? ' 📉' : ''}
            {' · '}<span style={{ color: 'var(--ink-muted)' }}>{gmTier.badge} {gmTier.label}</span>
          </div>
        </div>
        <div className="scoreboard-stats">
          {[
            ['Record', `${fr.wins}-${fr.losses}`],
            ['Rank', `#${fr.leagueRank || '—'}`, 'var(--red)'],
            ['Value', `$${val}M`],
            ['Cash', `$${Math.round((fr.cash || 0) * 10) / 10}M`, (fr.cash || 0) > 5 ? 'var(--green)' : 'var(--red)'],
          ].map(([label, value, color]) => (
            <div key={label} style={{ textAlign: 'center', padding: '4px 0' }}>
              <div className="stat-label">{label}</div>
              <div className="font-display" style={{ fontSize: '1.1rem', fontWeight: 700, color: color || 'var(--ink)' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="tab-nav" style={{ marginBottom: 12 }}>
        {['home', 'roster', 'draft', 'coach', 'biz', 'facilities', 'legacy', 'history'].map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === 'home' && <HomeTab fr={fr} onSim={onSim} simming={simming} recap={recap} grade={grade} events={events} onResolve={onResolve} pressConf={pressConf} onPressConf={onPressConf} newspaper={newspaper} newspaperDismissed={newspaperDismissed} onDismissNewspaper={onDismissNewspaper} cbaEvent={cbaEvent} onCBA={onCBA} namingOffer={namingOffer} onNaming={onNaming} notifications={notifications} onDismissNotif={onDismissNotif} />}
      {tab === 'roster' && <RosterTab fr={fr} cap={cap} />}
      {tab === 'draft' && <DraftTab fr={fr} setFr={setFr} />}
      {tab === 'coach' && <CoachTab fr={fr} setFr={setFr} />}
      {tab === 'biz' && <BizTab fr={fr} setFr={setFr} />}
      {tab === 'facilities' && <FacTab fr={fr} setFr={setFr} onCashChange={onCashChange} />}
      {tab === 'legacy' && <LegacyTab fr={fr} />}
      {tab === 'history' && <HistTab fr={fr} />}
    </div>
  );
}

// ============================================================
// HOME TAB
// ============================================================
function HomeTab({ fr, onSim, simming, recap, grade, events, onResolve, pressConf, onPressConf, newspaper, newspaperDismissed, onDismissNewspaper, cbaEvent, onCBA, namingOffer, onNaming, notifications, onDismissNotif }) {
  const unresolvedEvents = events.filter(e => !e.resolved);
  const simBlocked = simming || unresolvedEvents.length > 0 || (pressConf && pressConf.length > 0) || cbaEvent || (newspaper && !newspaperDismissed);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Notifications */}
      {notifications && notifications.length > 0 && (
        <NotificationsPanel notifications={notifications} onDismiss={onDismissNotif} />
      )}

      {/* Newspaper — blocks sim until dismissed */}
      {newspaper && !newspaperDismissed && (
        <div className="card fade-in" style={{ padding: 0, border: '2px solid var(--ink)', overflow: 'hidden' }}>
          <div style={{ background: 'var(--ink)', color: 'var(--cream)', padding: '6px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="font-display" style={{ fontSize: '0.6rem', letterSpacing: '0.2em' }}>THE DAILY BALL</div>
            <div className="font-mono" style={{ fontSize: '0.55rem', color: '#aaa' }}>SEASON {newspaper.season} WRAP-UP</div>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <div className="font-display" style={{ fontSize: 'clamp(1rem,4vw,1.5rem)', fontWeight: 700, lineHeight: 1.15, marginBottom: 10, borderBottom: '2px solid var(--ink)', paddingBottom: 8 }}>
              {newspaper.headline}
            </div>
            <div style={{ columns: '2 180px', gap: 20 }}>
              {newspaper.stories.map((story, i) => (
                <p key={i} className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', lineHeight: 1.55, marginBottom: 8, breakInside: 'avoid' }}>
                  {story}
                </p>
              ))}
            </div>
            {newspaper.gmOfYear && (
              <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--gold)', marginTop: 8, borderTop: '1px solid var(--cream-darker)', paddingTop: 8 }}>
                🏆 GM of the Year: {newspaper.gmOfYear}
              </div>
            )}
          </div>
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--cream-darker)', textAlign: 'center' }}>
            <button className="btn-gold" style={{ padding: '10px 28px' }} onClick={onDismissNewspaper}>
              Continue to Season →
            </button>
          </div>
        </div>
      )}

      {/* Season Recap */}
      {recap && (
        <div className="card" style={{ padding: 16 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Season Recap</h3>
          <p className="font-body" style={{ lineHeight: 1.6, color: 'var(--ink-soft)', fontSize: '0.85rem' }}>{recap}</p>
          {grade && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="font-display" style={{ fontSize: '1.8rem', fontWeight: 700, color: grade.grade.startsWith('A') ? 'var(--green)' : grade.grade.startsWith('B') ? 'var(--amber)' : 'var(--red)' }}>
                {grade.grade}
              </span>
              <span className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>{grade.analysis}</span>
            </div>
          )}
        </div>
      )}

      {/* Press Conference */}
      {pressConf && pressConf.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>📰 Press Conference</h3>
          {pressConf.map(pc => (
            <div key={pc.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--cream-darker)' }}>
              <p className="font-body" style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--ink-soft)', marginBottom: 10 }}>{pc.prompt}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {pc.options.map((opt, oi) => (
                  <button key={oi} className="btn-secondary" style={{ fontSize: '0.68rem', padding: '5px 12px' }} onClick={() => onPressConf(pc.id, oi)}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CBA Event */}
      {cbaEvent && (
        <div className="card" style={{ padding: 16, borderLeft: '4px solid var(--amber)' }}>
          <h3 className="font-display" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--amber)', marginBottom: 6 }}>⚖ {cbaEvent.title}</h3>
          <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginBottom: 10, lineHeight: 1.5 }}>{cbaEvent.description}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {cbaEvent.choices.map((ch, ci) => (
              <button key={ci} className="btn-secondary" style={{ fontSize: '0.68rem', padding: '5px 12px' }} onClick={() => onCBA(ci)}>
                {ch.label}<br /><span style={{ fontSize: '0.6rem', color: 'var(--ink-muted)' }}>{ch.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Naming Rights */}
      {namingOffer && (
        <div className="card" style={{ padding: 16 }}>
          <h3 className="font-display" style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 6 }}>🏟 Naming Rights Offer</h3>
          <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginBottom: 10 }}>
            {namingOffer.company} wants to name your stadium. ${namingOffer.annualPay}M/year for {namingOffer.years} years.
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-primary" style={{ fontSize: '0.7rem', padding: '5px 12px' }} onClick={() => onNaming(true)}>Accept</button>
            <button className="btn-secondary" style={{ fontSize: '0.7rem', padding: '5px 12px' }} onClick={() => onNaming(false)}>Decline</button>
          </div>
        </div>
      )}

      {/* Offseason Events */}
      {unresolvedEvents.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Offseason ({unresolvedEvents.length})</h3>
          {unresolvedEvents.map(ev => (
            <div key={ev.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--cream-darker)' }}>
              <h4 className="font-display" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 3 }}>{ev.title}</h4>
              <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginBottom: 10, lineHeight: 1.5 }}>{ev.description}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ev.choices.map((ch, ci) => (
                  <button key={ci} className="btn-secondary" style={{ fontSize: '0.68rem', padding: '5px 12px' }} onClick={() => onResolve(ev.id, ci)}>
                    {ch.label}{ch.cost ? ` (-$${ch.cost}M)` : ''}{ch.revenue ? ` (+$${ch.revenue}M)` : ''}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats grid */}
      <div className="stat-grid">
        {[
          ['Fan', fr.fanRating, fr.fanRating > 65 ? 'var(--green)' : null],
          ['Chem', fr.lockerRoomChemistry, fr.lockerRoomChemistry > 60 ? 'var(--green)' : 'var(--amber)'],
          ['Media', fr.mediaRep],
          ['Community', fr.communityRating],
          ['Revenue', `$${fr.finances.revenue}M`, 'var(--green)'],
          ['Profit', `$${fr.finances.profit}M`, fr.finances.profit > 0 ? 'var(--green)' : 'var(--red)'],
        ].map(([label, value, color]) => (
          <div key={label} className="card" style={{ padding: '10px 12px', textAlign: 'center' }}>
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ fontSize: '1rem', color: color || 'var(--ink)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Economy banner */}
      {fr.economyCycle && fr.economyCycle !== 'stable' && (
        <div className={`card ${fr.economyCycle === 'boom' ? 'badge-green' : 'badge-red'}`} style={{ padding: '8px 14px', textAlign: 'center', fontSize: '0.75rem' }}>
          {fr.economyCycle === 'boom' ? '📈 City Economy: BOOM — Revenue boosted' : '📉 City Economy: RECESSION — Revenue reduced'}
        </div>
      )}

      {/* Sim button */}
      <div style={{ textAlign: 'center', marginTop: 6 }}>
        <button
          className="btn-gold"
          onClick={onSim}
          disabled={simBlocked}
          style={{ padding: '12px 36px', fontSize: '0.95rem' }}
        >
          {simming ? 'Simulating...' : newspaper && !newspaperDismissed ? 'Read Newspaper First' : unresolvedEvents.length > 0 || pressConf?.length > 0 || cbaEvent ? 'Resolve All Events' : 'Simulate Season'}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// ROSTER TAB
// ============================================================
function RosterTab({ fr, cap }) {
  const sorted = useMemo(() => [...fr.players].sort((a, b) => b.rating - a.rating), [fr.players]);
  return (
    <div className="fade-in">
      <div className="card" style={{ padding: '10px 14px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="stat-label">Salary Cap</span>
          <span className="font-mono" style={{ fontSize: '0.75rem' }}>
            ${cap.used}M / ${cap.cap}M <span style={{ color: cap.space > 10 ? 'var(--green)' : 'var(--red)' }}>(${cap.space}M free)</span>
          </span>
        </div>
        <div className="progress-bar" style={{ marginTop: 5 }}>
          <div className="progress-bar-fill" style={{ width: `${Math.min(100, (cap.used / cap.cap) * 100)}%`, background: cap.space > 10 ? 'var(--green)' : cap.space > 0 ? 'var(--amber)' : 'var(--red)' }} />
        </div>
      </div>
      <div className="card table-wrap">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--cream-darker)' }}>
              {['Player', 'Pos', 'Age', 'Rtg', '$M', 'Yrs', 'Trait', 'Status'].map(h => (
                <th key={h} className="stat-label" style={{ padding: '6px 8px', textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--cream-dark)', background: p.injured ? '#fef5f5' : 'transparent' }}>
                <td className="font-body" style={{ padding: '6px 8px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {p.name}{p.isLocalLegend && <span style={{ color: 'var(--gold)', marginLeft: 3 }}>★</span>}
                </td>
                <td className="font-mono" style={{ padding: '6px 8px' }}>{p.position}</td>
                <td className="font-mono" style={{ padding: '6px 8px' }}>{p.age}</td>
                <td className="font-mono" style={{ padding: '6px 8px', fontWeight: 600, color: p.rating >= 85 ? 'var(--green)' : p.rating >= 70 ? 'var(--ink)' : 'var(--ink-muted)' }}>{p.rating}</td>
                <td className="font-mono" style={{ padding: '6px 8px' }}>{p.salary}</td>
                <td className="font-mono" style={{ padding: '6px 8px', color: p.yearsLeft <= 1 ? 'var(--red)' : 'var(--ink)' }}>{p.yearsLeft}</td>
                <td style={{ padding: '6px 8px' }}>
                  {p.trait && <span className={`badge ${p.trait === 'leader' ? 'badge-green' : p.trait === 'mercenary' ? 'badge-amber' : ['volatile', 'injury_prone'].includes(p.trait) ? 'badge-red' : 'badge-ink'}`}>{p.trait}</span>}
                </td>
                <td style={{ padding: '6px 8px' }}>
                  {p.injured ? <span className="badge badge-red">{p.injurySeverity}</span> : <span style={{ color: 'var(--green)', fontSize: '0.6rem' }}>OK</span>}
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
// DRAFT TAB
// ============================================================
function DraftTab({ fr, setFr }) {
  const [prospects, setProspects] = useState(null);
  const generateProspects = () => setProspects(generateDraftProspects(fr.league, 30, fr.scoutingStaff));
  const draftThisPlayer = (prospect) => {
    const player = draftPlayer(prospect, fr.league);
    setFr(prev => ({
      ...prev,
      players: [...prev.players, player],
      totalSalary: Math.round((prev.totalSalary + player.salary) * 10) / 10,
      rosterQuality: Math.round([...prev.players, player].reduce((s, x) => s + x.rating, 0) / (prev.players.length + 1)),
    }));
    setProspects(prev => prev.filter(x => x.id !== prospect.id));
  };
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 className="font-display" style={{ fontSize: '0.9rem', fontWeight: 600 }}>Draft Board</h3>
          <p className="font-body" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>Scout level {fr.scoutingStaff}/3</p>
        </div>
        <button className="btn-primary" onClick={generateProspects}>{prospects ? 'Reshuffle' : 'Scout Class'}</button>
      </div>
      {prospects && (
        <div className="card table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--cream-darker)' }}>
                {['#', 'Name', 'Pos', 'Proj', 'Upside', 'Trait', ''].map(h => (
                  <th key={h} className="stat-label" style={{ padding: '6px 8px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prospects.slice(0, 15).map((p, i) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--cream-dark)' }}>
                  <td className="font-mono" style={{ padding: '6px 8px', fontWeight: 600 }}>{i + 1}</td>
                  <td className="font-body" style={{ padding: '6px 8px', fontWeight: 500 }}>{p.name}</td>
                  <td className="font-mono" style={{ padding: '6px 8px' }}>{p.position}</td>
                  <td className="font-mono" style={{ padding: '6px 8px', fontWeight: 600, color: p.projectedRating >= 75 ? 'var(--green)' : 'var(--ink)' }}>{p.projectedRating}</td>
                  <td><span className={`badge ${p.upside === 'high' ? 'badge-green' : p.upside === 'mid' ? 'badge-amber' : 'badge-ink'}`}>{p.upside}</span></td>
                  <td>{p.trait && <span className="badge badge-ink">{p.trait}</span>}</td>
                  <td><button className="btn-secondary" style={{ fontSize: '0.6rem', padding: '3px 8px' }} onClick={() => draftThisPlayer(p)}>Draft</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// COACH TAB
// ============================================================
function CoachTab({ fr, setFr }) {
  const [candidates, setCandidates] = useState(null);
  const [confirmFire, setConfirmFire] = useState(false);
  const coach = fr.coach;
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card-elevated" style={{ padding: 16 }}>
        <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Head Coach</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="font-display" style={{ fontSize: '1.1rem', fontWeight: 700 }}>{coach.name}</div>
            <div className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginTop: 3 }}>
              {coach.personality} · Lvl {coach.level}/4 · {coach.seasonsWithTeam}yr
            </div>
            <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
              {[1, 2, 3, 4].map(l => (
                <div key={l} style={{ width: 20, height: 6, borderRadius: 2, background: coach.level >= l ? 'var(--red)' : 'var(--cream-darker)' }} />
              ))}
            </div>
          </div>
          {!confirmFire
            ? <button className="btn-secondary" style={{ borderColor: 'var(--red)', color: 'var(--red)', fontSize: '0.7rem' }} onClick={() => setConfirmFire(true)}>Fire</button>
            : <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-primary" style={{ fontSize: '0.7rem', padding: '5px 10px' }} onClick={() => { setFr(() => fireCoach(fr)); setCandidates(generateCoachCandidates(3)); setConfirmFire(false); }}>
                  Confirm (-${coach.level * 2}M)
                </button>
                <button className="btn-secondary" style={{ fontSize: '0.7rem', padding: '5px 10px' }} onClick={() => setConfirmFire(false)}>Cancel</button>
              </div>
          }
        </div>
      </div>
      {candidates && (
        <div className="card" style={{ padding: 16 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Coaching Candidates</h3>
          {candidates.map(cd => (
            <div key={cd.name} className="card" style={{ padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div className="font-display" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{cd.name}</div>
                <div className="font-body" style={{ fontSize: '0.75rem', color: 'var(--ink-soft)' }}>{cd.personality} · Lvl {cd.level}</div>
                <div className="font-body" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', fontStyle: 'italic', marginTop: 3 }}>{cd.backstory}</div>
              </div>
              <button className="btn-primary" style={{ fontSize: '0.65rem', padding: '5px 12px' }} onClick={() => { setFr(() => hireCoach(fr, cd)); setCandidates(null); }}>
                Hire
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// BUSINESS TAB
// ============================================================
function BizTab({ fr, setFr }) {
  const proj = useMemo(() => projectRevenue(fr), [fr]);
  const valuePerception = Math.round((fr.rosterQuality / 100) * 200 - fr.ticketPrice);
  const isOverpriced = valuePerception < -40;
  const isGoodValue = valuePerception > 60;
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Revenue summary */}
      <div className="card" style={{ padding: 16 }}>
        <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Revenue Projection</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div><div className="stat-label">Revenue</div><div className="stat-value" style={{ color: 'var(--green)' }}>${proj.totalRevenue}M</div></div>
          <div><div className="stat-label">Expenses</div><div className="stat-value" style={{ color: 'var(--red)' }}>${proj.totalExpenses}M</div></div>
          <div><div className="stat-label">Profit</div><div className="stat-value" style={{ color: proj.projectedProfit > 0 ? 'var(--green)' : 'var(--red)' }}>${proj.projectedProfit}M</div></div>
        </div>
      </div>
      {/* Ticket pricing */}
      <div className="card" style={{ padding: 16 }}>
        <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Ticket Pricing</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="stat-label">Price</span>
          <input type="range" min="30" max="200" step="5" value={fr.ticketPrice}
            onChange={e => setFr(p => ({ ...p, ticketPrice: Number(e.target.value) }))}
            style={{ flex: 1, minWidth: 100 }} />
          <span className="stat-value">${fr.ticketPrice}</span>
          {isOverpriced && <span className="badge badge-red">OVERPRICED</span>}
          {isGoodValue && <span className="badge badge-green">GOOD VALUE</span>}
        </div>
        <p className="font-body" style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: 6, fontStyle: 'italic' }}>
          Fans compare price to team quality — overpricing hurts attendance and fan rating.
        </p>
        <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
          <div><span className="stat-label">Attendance</span><div className="stat-value" style={{ color: proj.attendance > 75 ? 'var(--green)' : proj.attendance > 55 ? 'var(--amber)' : 'var(--red)' }}>{proj.attendance}%</div></div>
          <div><span className="stat-label">Gate Rev</span><div className="stat-value">${proj.gateRevenue}M</div></div>
        </div>
      </div>
      {/* Debt */}
      <div className="card" style={{ padding: 16 }}>
        <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Debt & Loans</h3>
        <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
          <div><span className="stat-label">Current Debt</span><div className="stat-value" style={{ color: (fr.debt || 0) > 0 ? 'var(--red)' : 'var(--ink)' }}>${fr.debt || 0}M</div></div>
          <div><span className="stat-label">Max Loan</span><div className="stat-value">${maxLoan(fr)}M</div></div>
          <div><span className="stat-label">Interest</span><div className="stat-value">8%/yr</div></div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn-secondary" style={{ fontSize: '0.7rem' }} disabled={(fr.debt || 0) >= maxLoan(fr)} onClick={() => setFr(p => takeLoan(p, 10))}>Borrow $10M</button>
          <button className="btn-secondary" style={{ fontSize: '0.7rem' }} disabled={!(fr.debt > 0 && fr.cash >= 10)} onClick={() => setFr(p => repayDebt(p, 10))}>Repay $10M</button>
        </div>
      </div>
      {/* Naming rights active */}
      {fr.namingRightsActive && (
        <div className="card" style={{ padding: '10px 14px' }}>
          <span className="stat-label">🏟 Stadium: </span>
          <span className="font-body" style={{ fontSize: '0.8rem' }}>{fr.namingRightsName} Arena — ${fr.namingRightsDeal}M/yr ({fr.namingRightsYears}yr left)</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// FACILITIES TAB
// ============================================================
function FacTab({ fr, setFr, onCashChange }) {
  function upgrade(field) {
    const current = fr[field];
    if (current >= 3) return;
    const cost = UPGRADE_COSTS[current] || 15;
    if ((fr.cash || 0) < cost) return;
    const newCash = Math.round(((fr.cash || 0) - cost) * 10) / 10;
    setFr(prev => ({ ...prev, [field]: current + 1, cash: newCash }));
    if (onCashChange) onCashChange(newCash);
  }
  const facilities = [
    ['scoutingStaff', 'Scouting', 'Draft eval'],
    ['developmentStaff', 'Player Dev', 'Player growth'],
    ['medicalStaff', 'Medical', 'Injury reduction'],
    ['marketingStaff', 'Marketing', 'Fan rating'],
    ['trainingFacility', 'Training Facility', 'Win probability'],
    ['weightRoom', 'Weight Room', 'Conditioning'],
    ['filmRoom', 'Film Room', 'Tactical edge'],
  ];
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="card" style={{ padding: 16 }}>
        <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Stadium</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div><div className="stat-label">Capacity</div><div className="stat-value">{fr.stadiumCapacity.toLocaleString()}</div></div>
          <div><div className="stat-label">Condition</div><div className="stat-value" style={{ color: fr.stadiumCondition > 70 ? 'var(--green)' : fr.stadiumCondition > 40 ? 'var(--amber)' : 'var(--red)' }}>{fr.stadiumCondition}%</div></div>
          <div><div className="stat-label">Age</div><div className="stat-value">{fr.stadiumAge}yr</div></div>
        </div>
      </div>
      <div className="card" style={{ padding: '8px 14px' }}>
        <span className="stat-label">Liquid Capital: </span>
        <span className="stat-value" style={{ color: (fr.cash || 0) > 5 ? 'var(--green)' : 'var(--red)' }}>${Math.round((fr.cash || 0) * 10) / 10}M</span>
      </div>
      {facilities.map(([key, label, desc]) => {
        const current = fr[key];
        const cost = UPGRADE_COSTS[current];
        const canAfford = (fr.cash || 0) >= (cost || 999);
        return (
          <div key={key} className="card" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="font-display" style={{ fontSize: '0.8rem', fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--ink-muted)' }}>{desc}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', gap: 2 }}>
                {[1, 2, 3].map(l => <div key={l} style={{ width: 18, height: 6, borderRadius: 2, background: current >= l ? 'var(--red)' : 'var(--cream-darker)' }} />)}
              </div>
              {current < 3 && (
                <button
                  className="btn-secondary"
                  style={{ fontSize: '0.6rem', padding: '3px 8px', opacity: canAfford ? 1 : 0.4, minHeight: 28 }}
                  disabled={!canAfford}
                  onClick={() => upgrade(key)}
                  title={!canAfford ? 'Insufficient cash' : `Upgrade for $${cost}M`}
                >
                  ${cost}M
                </button>
              )}
              {current >= 3 && <span className="badge badge-green" style={{ fontSize: '0.55rem' }}>MAX</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// LEGACY TAB
// ============================================================
function LegacyTab({ fr }) {
  const trophies = fr.trophies || [];
  const legends = fr.localLegends || [];
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card" style={{ padding: 16 }}>
        <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>🏆 Championship Banners</h3>
        {trophies.length === 0
          ? <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>No championships yet. Keep building.</p>
          : <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {trophies.map((t, i) => (
                <div key={i} style={{ background: 'var(--gold)', color: 'var(--ink)', padding: '10px 16px', borderRadius: 2, textAlign: 'center', minWidth: 80 }}>
                  <div className="font-display" style={{ fontSize: '1rem', fontWeight: 700 }}>S{t.season}</div>
                  <div className="font-mono" style={{ fontSize: '0.65rem' }}>{t.wins}-{t.losses}</div>
                </div>
              ))}
            </div>
        }
      </div>
      <div className="card" style={{ padding: 16 }}>
        <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>★ Local Legends</h3>
        {legends.length === 0
          ? <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>Players with 5+ seasons and 70+ peak rating become legends.</p>
          : legends.map((l, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--cream-dark)' }}>
                <span className="font-body" style={{ fontSize: '0.85rem', fontWeight: 500 }}>{l.name}</span>
                <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>Peak {l.rating} · {l.seasons}yr</span>
              </div>
            ))
        }
      </div>
      {fr.history.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>📅 Season Timeline</h3>
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 8 }}>
            {fr.history.map(h => {
              const wp = h.wins / (h.wins + h.losses);
              const isChamp = trophies.some(t => t.season === h.season);
              return (
                <div key={h.season} style={{ minWidth: 50, textAlign: 'center', padding: '6px 4px', borderRadius: 2, background: isChamp ? 'var(--gold)' : wp > 0.6 ? 'var(--green)' : wp < 0.35 ? 'var(--red)' : 'var(--cream-dark)', color: isChamp || wp > 0.6 || wp < 0.35 ? '#fff' : 'var(--ink)' }}>
                  <div className="font-mono" style={{ fontSize: '0.6rem', fontWeight: 600 }}>S{h.season}</div>
                  <div className="font-mono" style={{ fontSize: '0.55rem' }}>{h.wins}-{h.losses}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {fr.history.length > 1 && (
        <div className="card" style={{ padding: 16 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>📈 Cash History</h3>
          <MiniChart data={fr.history.map(h => h.cash || 0)} color="var(--green)" />
        </div>
      )}
    </div>
  );
}

// ============================================================
// HISTORY TAB
// ============================================================
function HistTab({ fr }) {
  return (
    <div className="fade-in">
      <div className="card" style={{ padding: 16 }}>
        <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Season History</h3>
        {fr.history.length === 0
          ? <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>No seasons completed yet.</p>
          : <div className="table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--cream-darker)' }}>
                    {['S', 'Record', 'Revenue', 'Profit', 'Cash', 'Fan', 'Econ'].map(h => (
                      <th key={h} className="stat-label" style={{ padding: '6px 8px', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...fr.history].reverse().map(h => (
                    <tr key={h.season} style={{ borderBottom: '1px solid var(--cream-dark)' }}>
                      <td className="font-mono" style={{ padding: '6px 8px', fontWeight: 600 }}>{h.season}</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>{h.wins}-{h.losses}</td>
                      <td className="font-mono" style={{ padding: '6px 8px', color: 'var(--green)' }}>${h.revenue}M</td>
                      <td className="font-mono" style={{ padding: '6px 8px', color: h.profit > 0 ? 'var(--green)' : 'var(--red)' }}>${h.profit}M</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>${Math.round((h.cash || 0) * 10) / 10}M</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>{h.fanRating}</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>{h.economy === 'boom' ? '📈' : h.economy === 'recession' ? '📉' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>
    </div>
  );
}

// ============================================================
// LEAGUE SCREEN
// ============================================================
function LeagueScreen({ lt, fr }) {
  const [viewLeague, setViewLeague] = useState('ngl');
  const standings = useMemo(() => [...(lt?.[viewLeague] || [])].sort((a, b) => b.wins - a.wins), [lt, viewLeague]);
  const playerIds = fr.map(f => f.id);
  return (
    <div style={{ maxWidth: 850, margin: '0 auto', padding: '16px 12px' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button className={viewLeague === 'ngl' ? 'btn-primary' : 'btn-secondary'} onClick={() => setViewLeague('ngl')}>🏈 NGL — Football</button>
        <button className={viewLeague === 'abl' ? 'btn-primary' : 'btn-secondary'} onClick={() => setViewLeague('abl')}>🏀 ABL — Basketball</button>
      </div>
      <div className="card table-wrap">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--cream-darker)' }}>
              {['#', 'Team', 'Tier', 'W', 'L', 'Win%', 'Fan', 'Mkt'].map(h => (
                <th key={h} className="stat-label" style={{ padding: '6px 8px', textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {standings.map((t, i) => {
              const isPlayer = playerIds.includes(t.id);
              const tierInfo = getMarketTierInfo(t.market);
              return (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--cream-dark)', background: isPlayer ? '#fef5f5' : 'transparent', fontWeight: isPlayer ? 600 : 400 }}>
                  <td className="font-mono" style={{ padding: '6px 8px' }}>{i + 1}</td>
                  <td className="font-body" style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                    {t.city} {t.name}
                    {isPlayer && <span style={{ color: 'var(--red)', marginLeft: 4, fontSize: '0.6rem' }}>YOU</span>}
                  </td>
                  <td><span className="font-mono" style={{ fontSize: '0.6rem', color: tierInfo.color }}>T{getMarketTier(t.market)}</span></td>
                  <td className="font-mono" style={{ padding: '6px 8px' }}>{t.wins}</td>
                  <td className="font-mono" style={{ padding: '6px 8px' }}>{t.losses}</td>
                  <td className="font-mono" style={{ padding: '6px 8px' }}>
                    {t.wins + t.losses > 0 ? ((t.wins / (t.wins + t.losses)) * 100).toFixed(0) : '—'}
                  </td>
                  <td className="font-mono" style={{ padding: '6px 8px' }}>{t.fanRating}</td>
                  <td className="font-mono" style={{ padding: '6px 8px' }}>{t.market}</td>
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
// MARKET SCREEN  (stakes: buy, sell, view income)
// ============================================================
function MarketScreen({ lt, cash, stakes, season, setStakes, setCash }) {
  const [offers, setOffers] = useState([]);
  useEffect(() => {
    if (lt) setOffers(generateStakeOffers(lt, cash, season));
  }, [lt, season]);

  const totalIncome = calcStakeIncome(stakes, lt || { ngl: [], abl: [] });

  function buyStake(offer) {
    if (cash < offer.price) return;
    setCash(c => Math.round((c - offer.price) * 10) / 10);
    setStakes(prev => [...prev, { id: generateId(), teamId: offer.teamId, teamName: offer.teamName, league: offer.league, stakePct: offer.stakePct, purchasePrice: offer.price, purchaseSeason: season }]);
    setOffers(prev => prev.filter(x => x.id !== offer.id));
  }

  function sellStake(stake) {
    const sellPrice = calcStakeValue(stake, lt || { ngl: [], abl: [] });
    setCash(c => Math.round((c + sellPrice) * 10) / 10);
    setStakes(prev => prev.filter(s => s.id !== stake.id));
  }

  return (
    <div style={{ maxWidth: 750, margin: '0 auto', padding: '16px 12px' }}>
      <h2 className="font-display section-header" style={{ fontSize: '1.2rem' }}>Investment Market</h2>

      {/* Current Holdings */}
      {stakes.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 className="font-display" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Your Stakes</h3>
            <div className="stat-label">
              Season Income: <span className="stat-value" style={{ color: totalIncome > 0 ? 'var(--green)' : 'var(--red)' }}>${Math.round(totalIncome * 10) / 10}M</span>
            </div>
          </div>
          {stakes.map((stake, i) => {
            const currentValue = calcStakeValue(stake, lt || { ngl: [], abl: [] });
            const gain = currentValue - stake.purchasePrice;
            return (
              <div key={stake.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--cream-dark)', flexWrap: 'wrap', gap: 6 }}>
                <div>
                  <span className="font-body" style={{ fontSize: '0.85rem', fontWeight: 500 }}>{stake.teamName}</span>
                  <div className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--ink-muted)' }}>
                    {stake.stakePct}% · Paid ${stake.purchasePrice}M · Now ${currentValue}M
                    <span style={{ color: gain >= 0 ? 'var(--green)' : 'var(--red)', marginLeft: 4 }}>({gain >= 0 ? '+' : ''}{gain}M)</span>
                  </div>
                </div>
                <button
                  className="btn-secondary"
                  style={{ fontSize: '0.62rem', padding: '4px 10px', color: 'var(--green)', borderColor: 'var(--green)' }}
                  onClick={() => sellStake(stake)}
                >
                  Sell ${currentValue}M
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Available Offers */}
      <div className="card" style={{ padding: 16 }}>
        <h3 className="font-display" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>Stake Offers</h3>
        {offers.length === 0
          ? <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
              {season < 3 ? 'Investment market unlocks in Season 3.' : cash < 15 ? 'Need $15M+ liquid capital to invest.' : 'No offers available this season.'}
            </p>
          : offers.map(offer => (
              <div key={offer.id} className="card" style={{ padding: '12px 14px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div className="font-display" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{offer.teamName}</div>
                  <div className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--ink-muted)' }}>
                    {offer.league.toUpperCase()} · {offer.record} · T{getMarketTier(offer.market)} · {offer.stakePct}% stake
                  </div>
                </div>
                <button
                  className="btn-primary"
                  style={{ fontSize: '0.65rem', padding: '5px 12px' }}
                  disabled={cash < offer.price}
                  onClick={() => buyStake(offer)}
                  title={cash < offer.price ? 'Insufficient liquid capital' : ''}
                >
                  Buy ${offer.price}M
                </button>
              </div>
            ))
        }
      </div>
    </div>
  );
}

// ============================================================
// PORTFOLIO SCREEN
// ============================================================
function PortfolioScreen({ af, fr, stakes, lt, gmRep, dynasty, season }) {
  const franchiseValue = calculateValuation(af);
  const liquidCash = af.cash || 0;
  const stakeValue = stakes.reduce((sum, s) => sum + calcStakeValue(s, lt || { ngl: [], abl: [] }), 0);
  const netWorth = Math.round((franchiseValue + liquidCash + stakeValue) * 10) / 10;
  const gmTier = getGMTier(gmRep);

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 12px' }}>
      <h2 className="font-display section-header" style={{ fontSize: '1.2rem' }}>Empire Overview</h2>

      {/* GM Reputation */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, borderLeft: '4px solid var(--gold)' }}>
        <span style={{ fontSize: '1.4rem' }}>{gmTier.badge}</span>
        <div>
          <div className="font-display" style={{ fontSize: '1rem', fontWeight: 700 }}>{gmTier.label}</div>
          <div className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--ink-muted)' }}>GM Reputation: {gmRep}/100</div>
        </div>
        <div style={{ flex: 1, marginLeft: 8 }}>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${gmRep}%`, background: gmRep >= 65 ? 'var(--gold)' : gmRep >= 40 ? 'var(--amber)' : 'var(--ink-muted)' }} />
          </div>
        </div>
      </div>

      {/* Key metrics */}
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

      {/* Dynasty Eras */}
      {dynasty.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Dynasty Eras</h3>
          {dynasty.map((d, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div className="font-display" style={{ fontSize: '0.85rem', color: 'var(--gold)', fontWeight: 600 }}>
                {d.era} <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--ink-muted)' }}>S{d.season}</span>
              </div>
              <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>{d.narrative}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SETTINGS
// ============================================================
function Settings({ onDelete, setScreen }) {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  function saveApiKey() {
    if (apiKey.trim()) {
      setNarrativeApiKey(apiKey.trim());
      try { localStorage.setItem('bob_api', apiKey.trim()); } catch {}
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }
  return (
    <div style={{ maxWidth: 550, margin: '0 auto', padding: '30px 16px' }}>
      <h2 className="font-display section-header" style={{ fontSize: '1.2rem' }}>Settings</h2>
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <h3 className="font-display" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Claude API (Optional)</h3>
        <p className="font-body" style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: 10 }}>Enables AI-generated narratives. Game works without it.</p>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            className="font-mono"
            style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--cream-darker)', borderRadius: 2, fontSize: '0.75rem', background: 'var(--cream)' }}
          />
          <button className="btn-secondary" onClick={saveApiKey}>{saved ? '✓ Saved' : 'Save'}</button>
        </div>
        <div className="font-mono" style={{ fontSize: '0.65rem', color: hasNarrativeApi() ? 'var(--green)' : 'var(--ink-muted)', marginTop: 6 }}>
          {hasNarrativeApi() ? '● AI Active' : '○ Procedural mode'}
        </div>
      </div>
      <div className="card" style={{ padding: 16, borderColor: 'var(--red)' }}>
        <button
          className="btn-secondary"
          style={{ borderColor: 'var(--red)', color: 'var(--red)', fontSize: '0.75rem' }}
          onClick={() => { if (confirm('Delete all save data?')) { onDelete(); setScreen('intro'); } }}
        >
          Delete Save Data
        </button>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP — state management and routing
// ============================================================

/**
 * Root application component.
 *
 * State ownership:
 *   screen             — which top-level screen is rendered
 *   loading            — initial load spinner
 *   cash               — global liquid capital (mirrors active franchise cash)
 *   gmRep              — GM reputation score (0–100)
 *   dynasty            — array of dynasty era records
 *   lt                 — leagueTeams: { ngl: [...], abl: [...] }
 *   fr                 — franchises array (player-owned teams)
 *   stakes             — stake holdings array
 *   season             — current season number
 *   freeAg             — free agent pools { ngl, abl }
 *   activeIdx          — index of active franchise in fr[]
 *   simming            — simulation in progress flag
 *   tradeDeadlineActive — first half done, awaiting player decisions
 *   tradeDeadlineLeague — league state after AI teams simmed (first half)
 *   notifications      — dismissable alert array
 *   recap / grade      — post-season narrative state
 *   events             — offseason event queue
 *   pressConf          — press conference questions
 *   newspaper          — end-of-season newspaper object
 *   newspaperDismissed — has player clicked "Continue to Season"
 *   cbaEvent           — CBA negotiation event (every 5 seasons)
 *   namingOffer        — naming rights offer object
 *   saveStatus         — 'saved' | 'saving'
 */
export default function App() {
  const [screen, setScreen] = useState('intro');
  const [loading, setLoading] = useState(true);

  // Financial & identity state
  const [cash, setCash] = useState(0);
  const [gmRep, setGmRep] = useState(50);
  const [dynasty, setDynasty] = useState([]);

  // Core game state
  const [lt, setLt] = useState(null);
  const [fr, setFr] = useState([]);
  const [stakes, setStakes] = useState([]);
  const [season, setSeason] = useState(1);
  const [freeAg, setFreeAg] = useState({ ngl: [], abl: [] });
  const [activeIdx] = useState(0);

  // Simulation state
  const [simming, setSimming] = useState(false);
  const [tradeDeadlineActive, setTradeDeadlineActive] = useState(false);
  const [tradeDeadlineLeague, setTradeDeadlineLeague] = useState(null);

  // UI / event state
  const [notifications, setNotifications] = useState([]);
  const [recap, setRecap] = useState(null);
  const [grade, setGrade] = useState(null);
  const [events, setEvents] = useState([]);
  const [pressConf, setPressConf] = useState(null);
  const [newspaper, setNewspaper] = useState(null);
  const [newspaperDismissed, setNewspaperDismissed] = useState(true);
  const [cbaEvent, setCbaEvent] = useState(null);
  const [namingOffer, setNamingOffer] = useState(null);
  const [saveStatus, setSaveStatus] = useState('saved');

  // Keep global cash in sync with active franchise cash
  useEffect(() => {
    const activeFr = fr[activeIdx];
    if (activeFr?.cash !== undefined) setCash(activeFr.cash);
  }, [fr, activeIdx]);

  // Load API key from localStorage
  useEffect(() => {
    try { const key = localStorage.getItem('bob_api'); if (key) setNarrativeApiKey(key); } catch {}
  }, []);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  // Load saved game
  useEffect(() => {
    (async () => {
      const saved = await loadGame();
      if (saved) {
        setCash(saved.cash ?? 0);
        setGmRep(saved.gmReputation || 50);
        setDynasty(saved.dynastyHistory || []);
        setLt(saved.leagueTeams);
        setFr(saved.franchises || []);
        setStakes(saved.stakes || []);
        setSeason(saved.season || 1);
        setFreeAg(saved.freeAgents || { ngl: [], abl: [] });
        setNotifications(saved.notifications || []);
      }
      setLoading(false);
    })();
  }, []);

  // Auto-save
  const doSave = useCallback(async () => {
    if (!lt || fr.length === 0) return;
    setSaveStatus('saving');
    await saveGame({ cash, gmReputation: gmRep, dynastyHistory: dynasty, leagueTeams: lt, franchises: fr, stakes, season, freeAgents: freeAg, notifications });
    setSaveStatus('saved');
  }, [cash, gmRep, dynasty, lt, fr, stakes, season, freeAg, notifications]);

  const saveTimer = useRef(null);
  useEffect(() => {
    if (!lt || fr.length === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 2000);
    return () => clearTimeout(saveTimer.current);
  }, [fr, lt, cash, season, doSave]);

  // ── Helpers ──────────────────────────────────────────────────

  /** Update only the active franchise, merging changes */
  const setActiveFr = (updater) =>
    setFr(prev => prev.map((f, i) => i === activeIdx ? (typeof updater === 'function' ? updater(f) : updater) : f));

  // ── Game setup handlers ───────────────────────────────────────

  function handleNew() {
    const league = initializeLeague();
    setLt(league);
    setCash(0); setGmRep(50); setDynasty([]); setFr([]); setStakes([]);
    setSeason(1);
    setFreeAg({ ngl: generateFreeAgents('ngl'), abl: generateFreeAgents('abl') });
    setRecap(null); setGrade(null); setEvents([]); setPressConf(null);
    setNewspaper(null); setNewspaperDismissed(true);
    setCbaEvent(null); setNamingOffer(null);
    setNotifications([]); setTradeDeadlineActive(false);
    setScreen('setup');
  }

  function handleLoad() {
    if (fr.length > 0 && lt) setScreen('dashboard');
  }

  function handleCreate(template, league) {
    const newFr = createPlayerFranchise(template, league);
    setCash(newFr.cash || 0);
    setLt(prev => ({ ...prev, [league]: prev[league].map(t => t.id === template.id ? { ...t, isPlayerOwned: true } : t) }));
    setFr(prev => [...prev, newFr]);
    generateOffseasonEvents(newFr).then(evts => setEvents(evts.map(e => ({ ...e, resolved: false }))));
    setScreen('dashboard');
  }

  // ── Event handlers ───────────────────────────────────────────

  function handleResolve(eventId, choiceIdx) {
    setEvents(prev => prev.map(event => {
      if (event.id !== eventId) return event;
      const choice = event.choices[choiceIdx];
      setFr(prevFr => prevFr.map((f, i) => {
        if (i !== activeIdx) return f;
        const updated = { ...f };
        if (choice.cost) updated.cash = Math.round(((updated.cash || 0) - choice.cost) * 10) / 10;
        if (choice.revenue) updated.cash = Math.round(((updated.cash || 0) + choice.revenue) * 10) / 10;
        if (choice.communityBonus) updated.communityRating = clamp((updated.communityRating || 50) + choice.communityBonus, 0, 100);
        if (choice.mediaBonus) updated.mediaRep = clamp((updated.mediaRep || 50) + choice.mediaBonus, 0, 100);
        if (choice.stadiumBonus) updated.stadiumCondition = clamp(updated.stadiumCondition + choice.stadiumBonus, 0, 100);
        if (choice.coachBonus && updated.coach.level < 4) updated.coach = { ...updated.coach, level: updated.coach.level + 1 };
        return updated;
      }));
      return { ...event, resolved: true };
    }));
  }

  function handlePressConf(pcId, optionIdx) {
    setPressConf(prev => {
      const pc = prev.find(x => x.id === pcId);
      if (!pc) return prev.filter(x => x.id !== pcId);
      const option = pc.options[optionIdx];
      setFr(prevFr => prevFr.map((f, i) => {
        if (i !== activeIdx) return f;
        const updated = { ...f };
        if (option.fanBonus) updated.fanRating = clamp(updated.fanRating + option.fanBonus, 0, 100);
        if (option.mediaBonus) updated.mediaRep = clamp((updated.mediaRep || 50) + option.mediaBonus, 0, 100);
        if (option.communityBonus) updated.communityRating = clamp((updated.communityRating || 50) + option.communityBonus, 0, 100);
        if (option.moraleBonus) updated.players = updated.players.map(p => ({ ...p, morale: clamp(p.morale + option.moraleBonus, 0, 100) }));
        return updated;
      }));
      return prev.filter(x => x.id !== pcId);
    });
  }

  function handleCBA(choiceIdx) {
    const choice = cbaEvent.choices[choiceIdx];
    if (choice.strikeRisk && Math.random() < choice.strikeRisk) {
      setRecap(prev => (prev || '') + ' A labour strike shortened the season, devastating gate revenue.');
    }
    setFr(prevFr => prevFr.map((f, i) => {
      if (i !== activeIdx) return f;
      const updated = { ...f };
      if (choice.moraleBonus) updated.players = updated.players.map(p => ({ ...p, morale: clamp(p.morale + choice.moraleBonus, 0, 100) }));
      if (choice.revenuePenalty) updated.cash = Math.round((updated.cash + (choice.revenuePenalty || 0)) * 10) / 10;
      return updated;
    }));
    setCbaEvent(null);
  }

  function handleNaming(accept) {
    if (accept && namingOffer) setFr(prev => prev.map((f, i) => i === activeIdx ? acceptNamingRights(f, namingOffer) : f));
    setNamingOffer(null);
  }

  async function handleDelete() {
    await deleteSave();
    setLt(null); setFr([]); setCash(0); setGmRep(50); setSeason(1);
    setRecap(null); setGrade(null); setEvents([]); setPressConf(null);
    setNewspaper(null); setCbaEvent(null); setNotifications([]);
    setTradeDeadlineActive(false);
  }

  // ── Simulation handlers ───────────────────────────────────────

  /** Phase 1: Simulate first half of season + all AI teams */
  async function handleSim() {
    if (simming) return;
    setSimming(true);
    setRecap(null); setGrade(null); setNewspaper(null); setNewspaperDismissed(true);
    await new Promise(r => setTimeout(r, 400));
    const result = simulateFullSeasonFirstHalf(lt, fr, season);
    setTradeDeadlineLeague(result.leagueTeams);
    setFr(result.franchises);
    setTradeDeadlineActive(true);
    setSimming(false);
  }

  /** Phase 2: Complete season after trade deadline roster moves */
  async function handleContinueSeason() {
    setSimming(true);
    setTradeDeadlineActive(false);
    const prevFranchise = fr[activeIdx];
    await new Promise(r => setTimeout(r, 300));

    const result = simulateFullSeasonSecondHalf(tradeDeadlineLeague, fr, season);
    setLt(result.leagueTeams);
    setFr(result.franchises);
    setSeason(s => s + 1);

    const af = result.franchises[activeIdx];

    // Stake income
    const stakeIncome = calcStakeIncome(stakes, result.leagueTeams);
    if (af && stakeIncome !== 0) {
      const newCash = Math.round(((af.cash || 0) + stakeIncome) * 10) / 10;
      setFr(prev => prev.map((f, i) => i === activeIdx ? { ...f, cash: newCash } : f));
    }

    // GM Reputation
    if (af) {
      const newRep = updateGMReputation(gmRep, af, prevFranchise);
      setGmRep(newRep);
    }

    // Notifications
    if (af) {
      const newNotifs = generateNotifications(af, prevFranchise);
      if (stakeIncome > 0.1) {
        newNotifs.push({ id: 'stake_' + Date.now(), severity: 'info', message: `Stake income: +$${Math.round(stakeIncome * 10) / 10}M added to liquid capital.`, type: 'stakes' });
      }
      if (af.finances.profit > 0) {
        newNotifs.push({ id: 'profit_' + Date.now(), severity: 'info', message: `Your franchise turned $${af.finances.profit}M profit, increasing your liquid capital to $${Math.round((af.cash || 0) * 10) / 10}M.`, type: 'finance' });
      } else if (af.finances.profit < 0) {
        newNotifs.push({ id: 'loss_' + Date.now(), severity: 'warning', message: `Season loss of $${Math.abs(af.finances.profit)}M drained liquid capital to $${Math.round((af.cash || 0) * 10) / 10}M.`, type: 'finance' });
      }
      setNotifications(prev => [
        ...prev.filter(n => !['contract', 'cap', 'stadium', 'fans', 'player'].includes(n.type)),
        ...newNotifs,
      ]);
    }

    // Narratives
    if (result.franchises.length > 0) {
      const f = result.franchises[activeIdx];
      const [rc, gr] = await Promise.all([generateSeasonRecap(f), generateGMGrade(f)]);
      setRecap(rc);
      setGrade(gr);

      if (season % 3 === 0) {
        const dynastyEra = await generateDynastyNarrative(f);
        setDynasty(prev => [...prev, { ...dynastyEra, season }]);
        setFr(prev => prev.map((x, i) => i === activeIdx ? { ...x, dynastyEra: dynastyEra.era } : x));
      }

      // Newspaper — blocks sim until dismissed
      const leagueStandings = f.league === 'ngl' ? result.standings.ngl : result.standings.abl;
      setNewspaper(generateNewspaper(leagueStandings, result.franchises, season, result.leagueTeams));
      setNewspaperDismissed(false);

      // Press conference + CBA + naming rights
      setPressConf(genPressConference(f));
      setCbaEvent(generateCBAEvent(season));
      if (!f.namingRightsActive && Math.random() < 0.3) {
        setNamingOffer(generateNamingRightsOffer(f));
      } else {
        setNamingOffer(null);
      }

      // Offseason events
      const offseasonEvents = await generateOffseasonEvents(f);
      setEvents(offseasonEvents.map(e => ({ ...e, resolved: false })));
    }

    setFreeAg({ ngl: generateFreeAgents('ngl'), abl: generateFreeAgents('abl') });
    setSimming(false);
    await doSave();
  }

  // ── Render ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 14 }}>
        <div className="spinner" style={{ width: 28, height: 28 }} />
        <span className="font-display" style={{ color: 'var(--ink-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.75rem' }}>Loading...</span>
      </div>
    );
  }

  const af = fr[activeIdx];
  const notifCount = notifications.length;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Ticker lt={lt} fr={fr} season={season} />
      <Nav screen={screen} setScreen={setScreen} fr={fr} gmRep={gmRep} cash={af?.cash ?? cash} notifCount={notifCount} />

      <main style={{ flex: 1, paddingBottom: 30 }}>
        {screen === 'intro' && <Intro onNew={handleNew} onLoad={handleLoad} hasSv={fr.length > 0} />}
        {screen === 'setup' && <Setup onCreate={handleCreate} />}

        {/* Trade deadline overrides the dashboard screen */}
        {tradeDeadlineActive && af && (
          <TradeDeadlineScreen
            fr={af}
            setFr={setActiveFr}
            onContinue={handleContinueSeason}
            cash={af.cash ?? cash}
            setCash={newCash => {
              setCash(newCash);
              setFr(prev => prev.map((f, i) => i === activeIdx ? { ...f, cash: newCash } : f));
            }}
          />
        )}

        {screen === 'dashboard' && af && !tradeDeadlineActive && (
          <Dashboard
            fr={af}
            setFr={setActiveFr}
            onSim={handleSim}
            simming={simming}
            recap={recap}
            grade={grade}
            events={events}
            onResolve={handleResolve}
            pressConf={pressConf}
            onPressConf={handlePressConf}
            newspaper={newspaper}
            newspaperDismissed={newspaperDismissed}
            onDismissNewspaper={() => setNewspaperDismissed(true)}
            cbaEvent={cbaEvent}
            onCBA={handleCBA}
            namingOffer={namingOffer}
            onNaming={handleNaming}
            gmRep={gmRep}
            notifications={notifications}
            onDismissNotif={id => setNotifications(prev => prev.filter(n => n.id !== id))}
            onCashChange={newCash => {
              setCash(newCash);
              setFr(prev => prev.map((f, i) => i === activeIdx ? { ...f, cash: newCash } : f));
            }}
          />
        )}

        {screen === 'league' && <LeagueScreen lt={lt} fr={fr} />}

        {screen === 'market' && (
          <MarketScreen
            lt={lt}
            cash={af?.cash ?? cash}
            stakes={stakes}
            season={season}
            setStakes={setStakes}
            setCash={newCash => {
              const val = typeof newCash === 'function' ? newCash(cash) : newCash;
              setCash(val);
              setFr(prev => prev.map((f, i) => i === activeIdx ? { ...f, cash: val } : f));
            }}
          />
        )}

        {screen === 'portfolio' && af && (
          <PortfolioScreen
            af={af}
            fr={fr}
            stakes={stakes}
            lt={lt}
            gmRep={gmRep}
            dynasty={dynasty}
            season={season}
          />
        )}

        {screen === 'settings' && <Settings onDelete={handleDelete} setScreen={setScreen} />}
      </main>

      {/* Save indicator */}
      <div style={{ position: 'fixed', bottom: 8, right: 8, padding: '3px 8px', borderRadius: 2, background: saveStatus === 'saving' ? 'var(--amber)' : 'var(--green)', color: '#fff', fontSize: '0.6rem', fontFamily: 'var(--font-mono)', opacity: 0.7 }}>
        {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
      </div>
    </div>
  );
}
