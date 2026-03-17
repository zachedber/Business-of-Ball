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
  SLOT_BUDGET, calcSlotQuality, calcDepthQuality, generateSlotPlayer,
  getFranchiseAskingPrice, getFranchiseFlavor, generateInitialSlots,
  generateDraftPickPositions, generatePickTradeOffer,
  generateOffseasonFAPool, signToSlot, releaseSlot, repCostMultiplier,
  simulatePlayoffs, simulateAIFreeAgency,
  generateExtensionDemands, applyExtension, checkPressureEvent,
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
          {[['portfolio', 'Empire'], ['dashboard', 'Team'], ['league', 'League'], ['market', 'Market'], ['finances', 'Finances']].map(([s, label]) => (
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
// FRANCHISE SELECTION SCREEN
// ============================================================
function FranchiseSelectionScreen({ onCreate }) {
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
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 12px' }}>
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
            style={{ fontSize: '0.7rem', padding: '5px 12px', opacity: comingSoon ? 0.55 : 1, position: 'relative' }}
            onClick={() => !comingSoon && setLeagueFilter(val)}
            disabled={comingSoon}
            title={comingSoon ? 'ABL — Coming Soon' : undefined}
          >
            {label}{comingSoon && <span className="badge badge-amber" style={{ fontSize: '0.5rem', marginLeft: 5, verticalAlign: 'middle' }}>SOON</span>}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10, marginBottom: 24 }}>
        {filtered.map(team => {
          const extras = getTeamExtras(team);
          const tierInfo = getMarketTierInfo(team.market);
          const isSelected = selected?.id === team.id && selected?.league === team.league;
          const isABL = team.league === 'abl';
          return (
            <div
              key={`${team.league}-${team.id}`}
              className="card"
              onClick={() => !isABL && setSelected(isSelected ? null : team)}
              style={{
                padding: '12px 14px',
                cursor: isABL ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                border: isSelected ? '2px solid var(--red)' : '1px solid var(--cream-darker)',
                background: isSelected ? '#fef5f5' : isABL ? '#f5f5f0' : 'var(--cream)',
                transition: 'border-color 0.15s',
                position: 'relative',
                opacity: isABL ? 0.7 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="font-display" style={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.2 }}>
                  {team.city}<br />{team.name}
                </div>
                <span className="badge badge-ink" style={{ fontSize: '0.55rem', background: team.league === 'ngl' ? '#1a3a5c' : '#2d5a3d', color: '#fff', marginLeft: 6, flexShrink: 0 }}>
                  {team.league === 'ngl' ? 'NGL' : 'ABL'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                <span className="font-mono" style={{ fontSize: '0.6rem', color: tierInfo?.color || 'var(--ink-muted)' }}>T{getMarketTier(team.market)} {tierInfo?.label}</span>
                <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--ink-muted)' }}>{team.division || ''}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div>
                  <div className="stat-label" style={{ fontSize: '0.55rem' }}>Ask Price</div>
                  <div className="font-mono" style={{ fontSize: '0.75rem', color: extras.askingPrice > STARTING ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>
                    ${extras.askingPrice}M
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="stat-label" style={{ fontSize: '0.55rem' }}>Fans</div>
                  <div className="font-mono" style={{ fontSize: '0.75rem' }}>{extras.fanRating}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="stat-label" style={{ fontSize: '0.55rem' }}>Stadium</div>
                  <div className="font-mono" style={{ fontSize: '0.75rem', color: extras.stadiumCondition > 75 ? 'var(--green)' : extras.stadiumCondition > 60 ? 'var(--amber)' : 'var(--red)' }}>
                    {extras.stadiumCondition}%
                  </div>
                </div>
              </div>
              <p className="font-body" style={{ fontSize: '0.65rem', color: 'var(--ink-muted)', lineHeight: 1.4, marginTop: 4, fontStyle: 'italic' }}>
                {extras.flavor}
              </p>
              {extras.askingPrice > STARTING && !isABL && (
                <div className="badge badge-red" style={{ fontSize: '0.55rem', marginTop: 6 }}>
                  DEBT: ${extras.askingPrice - STARTING}M
                </div>
              )}
              {isABL && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', background: 'rgba(245,245,240,0.82)', borderRadius: 2,
                }}>
                  <span className="font-display" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Coming Soon
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {selected && sel && (
        <div className="card-elevated" style={{ padding: 16, position: 'sticky', bottom: 16, background: 'var(--cream)', borderTop: '2px solid var(--ink)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div className="font-display" style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selected.city} {selected.name}</div>
              <div className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--ink-muted)' }}>
                {selected.league === 'ngl' ? 'NGL Football' : 'ABL Basketball'} · Asking ${sel.askingPrice}M · Starting Cash $30M
              </div>
              {hasDebt && (
                <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--red)', marginTop: 4 }}>
                  You will carry ${sel.askingPrice - STARTING}M acquisition debt at 8% interest.
                </div>
              )}
            </div>
            <button className="btn-gold" style={{ padding: '12px 28px' }} onClick={() => onCreate(selected, selected.league)}>
              {hasDebt ? `Buy Franchise (${sel.askingPrice - STARTING}M Debt)` : 'Launch Franchise'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================================
// MINI SPARKLINE
// ============================================================
function MiniSparkline({ data, width = 120, height = 32, color = 'var(--green)' }) {
  if (!data || data.length < 2) return <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--ink-muted)' }}>—</span>;
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
            {fr.league === 'ngl' ? 'NGL' : 'ABL'} · S{fr.season || 1} · {fr.coach.name}
            {fr.economyCycle === 'boom' ? ' UP' : fr.economyCycle === 'recession' ? ' DOWN' : ''}
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
        {['home', 'slots', 'coach', 'biz', 'facilities', 'legacy', 'history'].map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === 'home' && <HomeTab fr={fr} onSim={onSim} simming={simming} recap={recap} grade={grade} events={events} onResolve={onResolve} pressConf={pressConf} onPressConf={onPressConf} newspaper={newspaper} newspaperDismissed={newspaperDismissed} onDismissNewspaper={onDismissNewspaper} cbaEvent={cbaEvent} onCBA={onCBA} namingOffer={namingOffer} onNaming={onNaming} notifications={notifications} onDismissNotif={onDismissNotif} />}
      {tab === 'slots' && <SlotsTab fr={fr} setFr={setFr} gmRep={gmRep} />}
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
      {notifications && notifications.length > 0 && (
        <NotificationsPanel notifications={notifications} onDismiss={onDismissNotif} />
      )}
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
                GM of the Year: {newspaper.gmOfYear}
              </div>
            )}
          </div>
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--cream-darker)', textAlign: 'center' }}>
            <button className="btn-gold" style={{ padding: '10px 28px' }} onClick={onDismissNewspaper}>
              Continue to Season
            </button>
          </div>
        </div>
      )}
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
      {pressConf && pressConf.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Press Conference</h3>
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
      {cbaEvent && (
        <div className="card" style={{ padding: 16, borderLeft: '4px solid var(--amber)' }}>
          <h3 className="font-display" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--amber)', marginBottom: 6 }}>{cbaEvent.title}</h3>
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
      {namingOffer && (
        <div className="card" style={{ padding: 16 }}>
          <h3 className="font-display" style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 6 }}>Naming Rights Offer</h3>
          <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginBottom: 10 }}>
            {namingOffer.company} wants to name your stadium. ${namingOffer.annualPay}M/year for {namingOffer.years} years.
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-primary" style={{ fontSize: '0.7rem', padding: '5px 12px' }} onClick={() => onNaming(true)}>Accept</button>
            <button className="btn-secondary" style={{ fontSize: '0.7rem', padding: '5px 12px' }} onClick={() => onNaming(false)}>Decline</button>
          </div>
        </div>
      )}
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
      {fr.economyCycle && fr.economyCycle !== 'stable' && (
        <div className={`card`} style={{ padding: '8px 14px', textAlign: 'center', fontSize: '0.75rem', background: fr.economyCycle === 'boom' ? 'var(--green)' : 'var(--red)', color: '#fff' }}>
          {fr.economyCycle === 'boom' ? 'City Economy: BOOM — Revenue boosted' : 'City Economy: RECESSION — Revenue reduced'}
        </div>
      )}
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
// SLOTS TAB
// ============================================================
function SlotsTab({ fr, setFr, gmRep }) {
  const [showFA, setShowFA] = useState(false);
  const [faPool, setFaPool] = useState([]);
  const [signingSlot, setSigningSlot] = useState(null);

  const budget = SLOT_BUDGET[fr.league] || 80;
  const usedBudget = ['star1', 'star2', 'corePiece'].reduce((s, k) => s + (fr[k]?.salary || 0), 0);
  const depthQ = calcDepthQuality(fr);
  const slotQ = calcSlotQuality(fr);
  const isOffseason = (fr.season || 1) > 0 && fr.wins !== undefined;

  function openFA() {
    const pool = generateOffseasonFAPool(fr.league, gmRep, 10);
    setFaPool(pool);
    setShowFA(true);
  }

  function doRelease(slotName) {
    setFr(prev => releaseSlot(prev, slotName));
  }

  function doSign(player, slotName) {
    setFr(prev => signToSlot(prev, slotName, player));
    setFaPool(prev => prev.filter(p => p.id !== player.id));
    setSigningSlot(null);
  }

  const slotDefs = [
    { key: 'star1', label: 'Star 1' },
    { key: 'star2', label: 'Star 2' },
    { key: 'corePiece', label: 'Core Piece' },
  ];

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card" style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span className="stat-label">Slot Budget</span>
          <span className="font-mono" style={{ fontSize: '0.75rem' }}>
            ${usedBudget}M / ${budget}M
            <span style={{ color: usedBudget > budget ? 'var(--red)' : 'var(--green)', marginLeft: 6 }}>
              (${budget - usedBudget}M free)
            </span>
          </span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${Math.min(100, (usedBudget / budget) * 100)}%`, background: usedBudget > budget ? 'var(--red)' : usedBudget / budget > 0.85 ? 'var(--amber)' : 'var(--green)' }} />
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          <div><span className="stat-label">Star Quality</span> <span className="font-mono" style={{ fontSize: '0.75rem' }}>{slotQ}</span></div>
          <div><span className="stat-label">Depth</span> <span className="font-mono" style={{ fontSize: '0.75rem', color: depthQ > 65 ? 'var(--green)' : depthQ > 45 ? 'var(--amber)' : 'var(--red)' }}>{depthQ}</span></div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
        {slotDefs.map(({ key, label }) => {
          const player = fr[key];
          return (
            <div key={key} className="card-elevated" style={{ padding: 14 }}>
              <div className="font-display" style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 8, letterSpacing: '0.08em' }}>{label}</div>
              {player ? (
                <>
                  <div className="font-display" style={{ fontSize: '1rem', fontWeight: 700 }}>{player.name}</div>
                  <div className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--ink-muted)', marginBottom: 4 }}>{player.position} · Age {player.age}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <div>
                      <span className="stat-label" style={{ fontSize: '0.55rem' }}>Rating</span>
                      <div className="font-display" style={{ fontSize: '1.2rem', fontWeight: 700, color: player.rating >= 85 ? 'var(--green)' : player.rating >= 70 ? 'var(--amber)' : 'var(--ink)' }}>{player.rating}</div>
                    </div>
                    <div>
                      <span className="stat-label" style={{ fontSize: '0.55rem' }}>Salary</span>
                      <div className="font-mono" style={{ fontSize: '0.85rem' }}>${player.salary}M</div>
                    </div>
                    <div>
                      <span className="stat-label" style={{ fontSize: '0.55rem' }}>Years</span>
                      <div className="font-mono" style={{ fontSize: '0.85rem', color: player.yearsLeft <= 1 ? 'var(--red)' : 'var(--ink)' }}>{player.yearsLeft}yr</div>
                    </div>
                  </div>
                  {player.trait && (
                    <span className={`badge ${player.trait === 'leader' ? 'badge-green' : player.trait === 'mercenary' ? 'badge-amber' : ['volatile', 'injury_prone'].includes(player.trait) ? 'badge-red' : 'badge-ink'}`} style={{ marginBottom: 8, display: 'inline-block' }}>
                      {player.trait}
                    </span>
                  )}
                  <div style={{ marginTop: 6 }}>
                    <button
                      className="btn-secondary"
                      style={{ fontSize: '0.62rem', padding: '4px 10px', borderColor: 'var(--red)', color: 'var(--red)' }}
                      onClick={() => doRelease(key)}
                    >
                      Release
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--ink-muted)', fontSize: '0.8rem', fontStyle: 'italic', padding: '8px 0' }}>
                  Empty Slot
                  <div style={{ marginTop: 8 }}>
                    <button
                      className="btn-secondary"
                      style={{ fontSize: '0.62rem', padding: '4px 10px' }}
                      onClick={() => { openFA(); setSigningSlot(key); }}
                    >
                      Sign Player
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 4 }}>
        <button className="btn-primary" onClick={() => { openFA(); setSigningSlot(null); }}>
          Offseason Signing Pool
        </button>
      </div>
      {showFA && faPool.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Free Agent Pool</h3>
            <button className="btn-secondary" style={{ fontSize: '0.62rem', padding: '4px 10px' }} onClick={() => setShowFA(false)}>Close</button>
          </div>
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--cream-darker)' }}>
                  {['Name', 'Pos', 'Age', 'Rtg', '$M', 'Trait', 'Sign To'].map(h => (
                    <th key={h} className="stat-label" style={{ padding: '6px 8px', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...faPool].sort((a, b) => b.rating - a.rating).map(p => {
                  const canAfford = (fr.cash || 0) >= p.salary;
                  const wouldOverBudget = usedBudget + p.salary > budget;
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--cream-dark)' }}>
                      <td className="font-body" style={{ padding: '6px 8px', fontWeight: 500 }}>{p.name}</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>{p.position}</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>{p.age}</td>
                      <td className="font-mono" style={{ padding: '6px 8px', fontWeight: 600, color: p.rating >= 85 ? 'var(--green)' : p.rating >= 70 ? 'var(--ink)' : 'var(--ink-muted)' }}>{p.rating}</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>${p.salary}M</td>
                      <td>{p.trait && <span className="badge badge-ink">{p.trait}</span>}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {slotDefs.map(({ key, label }) => {
                            const slotFull = !!fr[key];
                            return (
                              <button
                                key={key}
                                className="btn-secondary"
                                style={{ fontSize: '0.58rem', padding: '3px 6px', opacity: (!canAfford || wouldOverBudget || slotFull) ? 0.4 : 1 }}
                                disabled={!canAfford || wouldOverBudget || slotFull}
                                onClick={() => doSign(p, key)}
                                title={slotFull ? 'Slot full — release first' : !canAfford ? 'Insufficient cash' : wouldOverBudget ? 'Over budget' : `Sign to ${label}`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
      <div className="card" style={{ padding: 16 }}>
        <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Revenue Projection</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div><div className="stat-label">Revenue</div><div className="stat-value" style={{ color: 'var(--green)' }}>${proj.totalRevenue}M</div></div>
          <div><div className="stat-label">Expenses</div><div className="stat-value" style={{ color: 'var(--red)' }}>${proj.totalExpenses}M</div></div>
          <div><div className="stat-label">Profit</div><div className="stat-value" style={{ color: proj.projectedProfit > 0 ? 'var(--green)' : 'var(--red)' }}>${proj.projectedProfit}M</div></div>
        </div>
      </div>
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
      <div className="card" style={{ padding: 16 }}>
        <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Debt and Loans</h3>
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
      {fr.namingRightsActive && (
        <div className="card" style={{ padding: '10px 14px' }}>
          <span className="stat-label">Stadium: </span>
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
        <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Championship Banners</h3>
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
        <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Local Legends</h3>
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
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Season Timeline</h3>
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
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Cash History</h3>
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
                      <td className="font-mono" style={{ padding: '6px 8px' }}>{h.economy === 'boom' ? 'UP' : h.economy === 'recession' ? 'DOWN' : '—'}</td>
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
        <button className={viewLeague === 'ngl' ? 'btn-primary' : 'btn-secondary'} onClick={() => setViewLeague('ngl')}>NGL — Football</button>
        <button className={viewLeague === 'abl' ? 'btn-primary' : 'btn-secondary'} onClick={() => setViewLeague('abl')}>ABL — Basketball</button>
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
                  <td><span className="font-mono" style={{ fontSize: '0.6rem', color: tierInfo?.color || 'var(--ink-muted)' }}>T{getMarketTier(t.market)}</span></td>
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
// MARKET SCREEN
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
function PortfolioScreen({ af, fr, stakes, lt, gmRep, dynasty, season, setScreen }) {
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
          <div className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--ink-muted)' }}>GM Reputation: {gmRep}/100</div>
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
// EMPIRE FINANCE SCREEN
// ============================================================
function EmpireFinanceScreen({ af, fr, stakes, lt, season }) {
  const ltSafe = lt || { ngl: [], abl: [] };

  // Empire summary
  const liquidCash = af.cash || 0;
  const franchiseValue = calculateValuation(af);
  const stakeValue = stakes.reduce((sum, s) => sum + calcStakeValue(s, ltSafe), 0);
  const netWorth = Math.round((franchiseValue + liquidCash + stakeValue) * 10) / 10;
  const totalRevenue = af.finances?.revenue || 0;
  const totalExpenses = af.finances?.expenses || 0;
  const netProfit = af.finances?.profit || 0;
  const stakeIncome = calcStakeIncome(stakes, ltSafe);
  const debt = af.debt || 0;
  const interestCost = Math.round(debt * 0.08 * 10) / 10;

  // Prior season deltas
  const prevH = af.history && af.history.length > 0 ? af.history[af.history.length - 1] : null;
  const cashDelta = prevH ? Math.round((liquidCash - (prevH.cash || 0)) * 10) / 10 : null;
  const profitDelta = prevH ? Math.round((netProfit - (prevH.profit || 0)) * 10) / 10 : null;
  const revDelta = prevH ? Math.round((totalRevenue - (prevH.revenue || 0)) * 10) / 10 : null;

  function delta(val) {
    if (val === null) return null;
    return (
      <span style={{ fontSize: '0.65rem', color: val > 0 ? 'var(--green)' : val < 0 ? 'var(--red)' : 'var(--ink-muted)', marginLeft: 4 }}>
        {val > 0 ? '+' : ''}{val}M
      </span>
    );
  }

  // Sell timing: compare valuation history
  const valHistory = af.history ? af.history.map(h => h.valuation || franchiseValue) : [];
  const avgVal = valHistory.length > 0 ? valHistory.reduce((a, b) => a + b, 0) / valHistory.length : franchiseValue;
  const sellSignal = franchiseValue > avgVal * 1.15 ? 'GOOD TIME TO SELL' : franchiseValue < avgVal * 0.9 ? 'BELOW AVERAGE' : 'HOLD';
  const sellColor = sellSignal === 'GOOD TIME TO SELL' ? 'var(--green)' : sellSignal === 'BELOW AVERAGE' ? 'var(--red)' : 'var(--amber)';

  // Projected end-of-season cash
  const proj = projectRevenue(af);
  const projCash = Math.round((liquidCash + (proj.projectedProfit || 0) - interestCost) * 10) / 10;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 12px', fontFamily: 'var(--font-mono)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="font-display section-header" style={{ fontSize: '1.2rem' }}>Empire Finances</h2>
        <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--ink-muted)' }}>Season {season}</span>
      </div>

      {/* Section 1: Empire Summary */}
      <div className="card" style={{ padding: 16, marginBottom: 12, borderLeft: '4px solid var(--gold)' }}>
        <h3 className="font-display" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--gold)' }}>
          Empire Summary
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
          {[
            ['Net Worth', `$${netWorth}M`, 'var(--gold)', null],
            ['Liquid Capital', `$${Math.round(liquidCash * 10) / 10}M`, liquidCash > 5 ? 'var(--green)' : 'var(--red)', cashDelta],
            ['Total Revenue', `$${totalRevenue}M`, 'var(--green)', revDelta],
            ['Total Expenses', `$${totalExpenses}M`, 'var(--red)', null],
            ['Net Profit', `$${netProfit}M`, netProfit > 0 ? 'var(--green)' : 'var(--red)', profitDelta],
            ['Stake Income', `$${Math.round(stakeIncome * 10) / 10}M`, stakeIncome > 0 ? 'var(--green)' : 'var(--ink-muted)', null],
            ['Debt', `$${debt}M`, debt > 0 ? 'var(--red)' : 'var(--ink)', null],
            ['Interest/yr', `$${interestCost}M`, debt > 0 ? 'var(--red)' : 'var(--ink-muted)', null],
          ].map(([label, value, color, d]) => (
            <div key={label} className="card" style={{ padding: '10px 12px', background: 'var(--cream-dark)' }}>
              <div className="stat-label" style={{ fontSize: '0.6rem' }}>{label}</div>
              <div className="font-mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: color || 'var(--ink)' }}>
                {value}{delta(d)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Franchise Breakdown */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <h3 className="font-display" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Franchise Breakdown
        </h3>
        {fr.map((f) => {
          const fVal = calculateValuation(f);
          const prevFH = f.history && f.history.length > 0 ? f.history[f.history.length - 1] : null;
          const prevVal = prevFH?.valuation || fVal;
          const valChangePct = prevVal > 0 ? Math.round(((fVal - prevVal) / prevVal) * 1000) / 10 : 0;
          const valSparkData = f.history ? f.history.slice(-5).map(h => h.valuation || fVal) : [fVal];
          return (
            <div key={f.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--cream-darker)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ minWidth: 160 }}>
                <div className="font-display" style={{ fontSize: '0.9rem', fontWeight: 700 }}>{f.city} {f.name}</div>
                <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--ink-muted)' }}>{f.league === 'ngl' ? 'NGL' : 'ABL'} · S{f.season}</div>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div className="stat-label" style={{ fontSize: '0.55rem' }}>Revenue</div>
                  <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--green)' }}>${f.finances?.revenue || 0}M</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div className="stat-label" style={{ fontSize: '0.55rem' }}>Profit</div>
                  <div className="font-mono" style={{ fontSize: '0.75rem', color: (f.finances?.profit || 0) > 0 ? 'var(--green)' : 'var(--red)' }}>${f.finances?.profit || 0}M</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div className="stat-label" style={{ fontSize: '0.55rem' }}>Valuation</div>
                  <div className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 700 }}>${fVal}M</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div className="stat-label" style={{ fontSize: '0.55rem' }}>Val Change</div>
                  <div className="font-mono" style={{ fontSize: '0.75rem', color: valChangePct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {valChangePct >= 0 ? '+' : ''}{valChangePct}%
                  </div>
                </div>
                <div>
                  <div className="stat-label" style={{ fontSize: '0.55rem', marginBottom: 2 }}>5yr Trend</div>
                  <MiniSparkline data={valSparkData} width={80} height={24} color={valChangePct >= 0 ? 'var(--green)' : 'var(--red)'} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Section 3: Stake Portfolio */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <h3 className="font-display" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Stake Portfolio
        </h3>
        {stakes.length === 0 ? (
          <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>No stakes held. Buy stakes from the Market screen.</p>
        ) : (
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--cream-darker)' }}>
                  {['Team', 'League', 'Owned%', 'Est. Value', 'Passive Income', 'Acq. Cost', 'Gain/Loss'].map(h => (
                    <th key={h} className="stat-label" style={{ padding: '6px 8px', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stakes.map((s, i) => {
                  const cv = calcStakeValue(s, ltSafe);
                  const income = calcStakeIncome([s], ltSafe);
                  const gain = Math.round((cv - s.purchasePrice) * 10) / 10;
                  return (
                    <tr key={s.id || i} style={{ borderBottom: '1px solid var(--cream-dark)' }}>
                      <td className="font-body" style={{ padding: '6px 8px', fontWeight: 500 }}>{s.teamName}</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>{(s.league || '').toUpperCase()}</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>{s.stakePct}%</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>${cv}M</td>
                      <td className="font-mono" style={{ padding: '6px 8px', color: 'var(--green)' }}>${Math.round(income * 10) / 10}M</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>${s.purchasePrice}M</td>
                      <td className="font-mono" style={{ padding: '6px 8px', color: gain >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {gain >= 0 ? '+' : ''}{gain}M
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 4: Capital Planning */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <h3 className="font-display" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Capital Planning
        </h3>
        <div style={{ marginBottom: 16 }}>
          <h4 className="font-display" style={{ fontSize: '0.75rem', marginBottom: 8, color: 'var(--ink-muted)' }}>Cash Flow Projection</h4>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.75rem' }}>
            <span className="font-mono" style={{ color: 'var(--ink)' }}>Current: ${Math.round(liquidCash * 10) / 10}M</span>
            <span style={{ color: 'var(--ink-muted)' }}>+</span>
            <span className="font-mono" style={{ color: proj.projectedProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>Profit: ${proj.projectedProfit}M</span>
            {interestCost > 0 && <>
              <span style={{ color: 'var(--ink-muted)' }}>-</span>
              <span className="font-mono" style={{ color: 'var(--red)' }}>Interest: ${interestCost}M</span>
            </>}
            <span style={{ color: 'var(--ink-muted)' }}>=</span>
            <span className="font-mono" style={{ fontWeight: 700, fontSize: '0.85rem', color: projCash > 0 ? 'var(--green)' : 'var(--red)' }}>
              Projected: ${projCash}M
            </span>
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <h4 className="font-display" style={{ fontSize: '0.75rem', marginBottom: 8, color: 'var(--ink-muted)' }}>Franchise Sell Timing</h4>
          {fr.map(f => {
            const fVal = calculateValuation(f);
            const fPrevH = f.history && f.history.length > 0 ? f.history[f.history.length - 1] : null;
            const fAvg = f.history && f.history.length > 0 ? f.history.reduce((a, h) => a + (h.valuation || fVal), 0) / f.history.length : fVal;
            const fSignal = fVal > fAvg * 1.15 ? 'SELL' : fVal < fAvg * 0.9 ? 'HOLD LOW' : 'HOLD';
            const fColor = fSignal === 'SELL' ? 'var(--green)' : fSignal === 'HOLD LOW' ? 'var(--red)' : 'var(--amber)';
            return (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--cream-dark)' }}>
                <span className="font-body" style={{ fontSize: '0.8rem' }}>{f.city} {f.name}</span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span className="font-mono" style={{ fontSize: '0.7rem' }}>${fVal}M vs avg ${Math.round(fAvg)}M</span>
                  <span className="font-mono" style={{ fontSize: '0.65rem', fontWeight: 700, color: fColor }}>{fSignal}</span>
                </div>
              </div>
            );
          })}
        </div>
        {debt > 0 && (
          <div style={{ padding: '10px 12px', background: '#fef5f5', border: '1px solid var(--red)', borderRadius: 2 }}>
            <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--red)', fontWeight: 700 }}>
              Debt: ${debt}M @ 8% = ${interestCost}M interest this season
            </div>
            <div className="font-body" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginTop: 3 }}>
              Repay debt from BizTab to reduce interest burden.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ============================================================
// DRAFT FLOW SCREEN
// ============================================================
function DraftFlowScreen({ fr, lt, draftPicks, draftProspects, onPickMade, onAutoPick, onDone, gmRep }) {
  const [pickedPlayers, setPickedPlayers] = useState([]);
  const [remainingPicks, setRemainingPicks] = useState(draftPicks || []);
  const [tradeOfferAccepted, setTradeOfferAccepted] = useState(false);
  const [tradeOfferId, setTradeOfferId] = useState(null);

  const prospects = useMemo(() => {
    return [...(draftProspects || [])].sort((a, b) => b.projectedRating - a.projectedRating).slice(0, 15);
  }, [draftProspects]);

  const allPicksDone = remainingPicks.length === 0;

  const pick1 = draftPicks?.[0];
  const tradeOffer = pick1 && !tradeOfferAccepted ? generatePickTradeOffer(pick1) : null;

  function handlePick(prospect) {
    if (remainingPicks.length === 0) return;
    const usedPick = remainingPicks[0];
    const player = draftPlayer(prospect, fr.league);
    setPickedPlayers(prev => [...prev, { ...player, round: usedPick.round, pick: usedPick.pick }]);
    setRemainingPicks(prev => prev.slice(1));
    onPickMade(player, usedPick);
  }

  function handleAutoPickAction() {
    if (remainingPicks.length === 0) return;
    const topProspect = prospects.find(p => !pickedPlayers.some(x => x.id === p.id));
    if (topProspect) handlePick(topProspect);
    else onAutoPick();
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 12px' }}>
      <h2 className="font-display section-header" style={{ fontSize: '1.2rem' }}>Draft Day</h2>
      <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: 16 }}>
        {fr.city} {fr.name} — {remainingPicks.length} pick{remainingPicks.length !== 1 ? 's' : ''} remaining
      </p>

      {/* Pick positions */}
      {draftPicks && draftPicks.length > 0 && (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <h3 className="font-display" style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', color: 'var(--ink-muted)' }}>Your Draft Picks</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {draftPicks.map((p, i) => {
              const used = i >= remainingPicks.length && pickedPlayers.length > (draftPicks.length - remainingPicks.length - 1 - (draftPicks.length - i - 1));
              const isNext = i === draftPicks.length - remainingPicks.length;
              return (
                <div key={i} style={{ padding: '8px 12px', borderRadius: 2, background: isNext ? 'var(--red)' : used ? 'var(--cream-darker)' : 'var(--cream-dark)', color: isNext ? '#fff' : 'var(--ink)', minWidth: 80, textAlign: 'center' }}>
                  <div className="font-mono" style={{ fontSize: '0.65rem', fontWeight: 700 }}>Round {p.round}</div>
                  <div className="font-mono" style={{ fontSize: '0.75rem' }}>Pick #{p.pick}</div>
                  {p.aiPicksBefore > 0 && <div className="font-mono" style={{ fontSize: '0.55rem', marginTop: 2, opacity: 0.7 }}>{p.aiPicksBefore} before</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trade offer for pick 1 */}
      {tradeOffer && remainingPicks.length > 0 && !tradeOfferAccepted && (
        <div className="card" style={{ padding: 14, marginBottom: 12, borderLeft: '4px solid var(--amber)' }}>
          <h3 className="font-display" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--amber)', marginBottom: 6 }}>Trade Offer</h3>
          <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginBottom: 10 }}>
            {tradeOffer.offeringTeam} offers {tradeOffer.description} for your Round {pick1.round} pick.
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-secondary" style={{ fontSize: '0.7rem', padding: '5px 12px', borderColor: 'var(--green)', color: 'var(--green)' }} onClick={() => { setTradeOfferAccepted(true); setTradeOfferId(tradeOffer.id); onPickMade(null, pick1, tradeOffer); setRemainingPicks(prev => prev.slice(1)); }}>
              Accept Trade
            </button>
            <button className="btn-secondary" style={{ fontSize: '0.7rem', padding: '5px 12px' }} onClick={() => setTradeOfferAccepted(true)}>
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Draft board */}
      {!allPicksDone && (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 className="font-display" style={{ fontSize: '0.85rem', fontWeight: 700 }}>Top Prospects</h3>
            <button className="btn-secondary" style={{ fontSize: '0.65rem', padding: '5px 12px' }} onClick={handleAutoPickAction}>Auto-Pick</button>
          </div>
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--cream-darker)' }}>
                  {['#', 'Name', 'Pos', 'Proj', 'Upside', 'Trait', ''].map(h => (
                    <th key={h} className="stat-label" style={{ padding: '6px 8px', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prospects.map((p, i) => {
                  const alreadyPicked = pickedPlayers.some(x => x.name === p.name);
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--cream-dark)', opacity: alreadyPicked ? 0.4 : 1 }}>
                      <td className="font-mono" style={{ padding: '6px 8px', fontWeight: 600 }}>{i + 1}</td>
                      <td className="font-body" style={{ padding: '6px 8px', fontWeight: 500 }}>{p.name}</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>{p.position}</td>
                      <td className="font-mono" style={{ padding: '6px 8px', fontWeight: 600, color: p.projectedRating >= 75 ? 'var(--green)' : 'var(--ink)' }}>{p.projectedRating}</td>
                      <td><span className={`badge ${p.upside === 'high' ? 'badge-green' : p.upside === 'mid' ? 'badge-amber' : 'badge-ink'}`}>{p.upside}</span></td>
                      <td>{p.trait && <span className="badge badge-ink">{p.trait}</span>}</td>
                      <td>
                        <button
                          className="btn-secondary"
                          style={{ fontSize: '0.6rem', padding: '3px 8px', opacity: alreadyPicked ? 0.3 : 1 }}
                          disabled={alreadyPicked || remainingPicks.length === 0}
                          onClick={() => handlePick(p)}
                        >
                          Draft
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary card when picks done */}
      {allPicksDone && pickedPlayers.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Draft Summary</h3>
          {pickedPlayers.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--cream-dark)' }}>
              <span className="font-body" style={{ fontSize: '0.85rem' }}>
                R{p.round} P{p.pick} — {p.name} ({p.position})
              </span>
              <span className="font-mono" style={{ fontSize: '0.75rem', color: p.rating >= 75 ? 'var(--green)' : 'var(--ink-muted)' }}>
                {p.rating} rtg
              </span>
            </div>
          ))}
        </div>
      )}

      {allPicksDone && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button className="btn-gold" style={{ padding: '12px 32px', fontSize: '0.9rem' }} onClick={onDone}>
            Continue to Free Agency
          </button>
        </div>
      )}
    </div>
  );
}


// ============================================================
// FREE AGENCY FLOW SCREEN
// ============================================================
function FreeAgencyFlowScreen({ fr, setFr, offseasonFAPool, aiSigningsLog, onDone, gmRep }) {
  const [pool, setPool] = useState(offseasonFAPool || []);
  const [biddingWar, setBiddingWar] = useState(null); // { player, slotName, aiSalary, aiTeamName }
  const [showTransactions, setShowTransactions] = useState(false);
  const budget = SLOT_BUDGET[fr.league] || 80;
  const usedBudget = ['star1', 'star2', 'corePiece'].reduce((s, k) => s + (fr[k]?.salary || 0), 0);

  const slotDefs = [
    { key: 'star1', label: 'Star 1' },
    { key: 'star2', label: 'Star 2' },
    { key: 'corePiece', label: 'Core Piece' },
  ];

  const aiTeamNames = ['Dallas Lone Stars', 'Bay City Gold', 'New York Titans', 'Chicago Wolves', 'Los Angeles Crown', 'Seattle Rain', 'Miami Surge'];

  function doSign(player, slotName) {
    setFr(prev => signToSlot(prev, slotName, player));
    setPool(prev => prev.filter(p => p.id !== player.id));
  }

  function attemptSign(player, slotName) {
    // 25% chance another team is also interested — trigger bidding war
    if (Math.random() < 0.25) {
      const boostPct = 0.10 + Math.random() * 0.10;
      const aiSalary = Math.round(player.salary * (1 + boostPct) * 10) / 10;
      const aiTeamName = aiTeamNames[Math.floor(Math.random() * aiTeamNames.length)];
      setBiddingWar({ player, slotName, aiSalary, aiTeamName });
    } else {
      doSign(player, slotName);
    }
  }

  function acceptBid(matchBoost) {
    if (!biddingWar) return;
    const newSalary = Math.round(biddingWar.aiSalary * (1 + matchBoost) * 10) / 10;
    const adjustedPlayer = { ...biddingWar.player, salary: newSalary };
    doSign(adjustedPlayer, biddingWar.slotName);
    setBiddingWar(null);
  }

  function walkAway() {
    // AI gets the player — remove from pool
    setPool(prev => prev.filter(p => p.id !== biddingWar?.player?.id));
    setBiddingWar(null);
  }

  function doRelease(slotName) {
    setFr(prev => releaseSlot(prev, slotName));
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 12px' }}>
      <h2 className="font-display section-header" style={{ fontSize: '1.2rem' }}>Free Agency</h2>
      <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: 16 }}>
        Sign players to your 3 franchise slots. Budget: ${budget}M/season.
      </p>

      {/* Current slots */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10, marginBottom: 16 }}>
        {slotDefs.map(({ key, label }) => {
          const player = fr[key];
          return (
            <div key={key} className="card-elevated" style={{ padding: 14 }}>
              <div className="font-display" style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6, letterSpacing: '0.08em' }}>{label}</div>
              {player ? (
                <>
                  <div className="font-display" style={{ fontSize: '0.95rem', fontWeight: 700 }}>{player.name}</div>
                  <div className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--ink-muted)' }}>{player.position} · {player.rating} rtg · ${player.salary}M</div>
                  <button className="btn-secondary" style={{ fontSize: '0.6rem', padding: '3px 8px', marginTop: 6, borderColor: 'var(--red)', color: 'var(--red)' }} onClick={() => doRelease(key)}>
                    Release
                  </button>
                </>
              ) : (
                <div style={{ color: 'var(--ink-muted)', fontSize: '0.78rem', fontStyle: 'italic' }}>Empty Slot</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Budget bar */}
      <div className="card" style={{ padding: '10px 14px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span className="stat-label">Slot Budget</span>
          <span className="font-mono" style={{ fontSize: '0.75rem' }}>
            ${usedBudget}M / ${budget}M
            <span style={{ color: usedBudget > budget ? 'var(--red)' : 'var(--green)', marginLeft: 6 }}>
              (${budget - usedBudget}M free)
            </span>
          </span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${Math.min(100, (usedBudget / budget) * 100)}%`, background: usedBudget > budget ? 'var(--red)' : 'var(--green)' }} />
        </div>
      </div>

      {/* FA pool */}
      {pool.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <h3 className="font-display" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 10 }}>Available Free Agents</h3>
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--cream-darker)' }}>
                  {['Name', 'Pos', 'Age', 'Rtg', '$M', 'Trait', 'Sign To'].map(h => (
                    <th key={h} className="stat-label" style={{ padding: '6px 8px', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...pool].sort((a, b) => b.rating - a.rating).map(p => {
                  const canAfford = (fr.cash || 0) >= p.salary;
                  const wouldOverBudget = usedBudget + p.salary > budget;
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--cream-dark)' }}>
                      <td className="font-body" style={{ padding: '6px 8px', fontWeight: 500 }}>{p.name}</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>{p.position}</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>{p.age}</td>
                      <td className="font-mono" style={{ padding: '6px 8px', fontWeight: 600, color: p.rating >= 85 ? 'var(--green)' : p.rating >= 70 ? 'var(--ink)' : 'var(--ink-muted)' }}>{p.rating}</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>${p.salary}M</td>
                      <td>{p.trait && <span className="badge badge-ink">{p.trait}</span>}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {slotDefs.map(({ key, label }) => {
                            const slotFull = !!fr[key];
                            return (
                              <button
                                key={key}
                                className="btn-secondary"
                                style={{ fontSize: '0.58rem', padding: '3px 6px', opacity: (!canAfford || wouldOverBudget || slotFull) ? 0.4 : 1 }}
                                disabled={!canAfford || wouldOverBudget || slotFull}
                                onClick={() => attemptSign(p, key)}
                                title={slotFull ? 'Slot full' : !canAfford ? 'Insufficient cash' : wouldOverBudget ? 'Over budget' : `Sign to ${label}`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pool.length === 0 && (
        <div className="card" style={{ padding: 14, textAlign: 'center', color: 'var(--ink-muted)', fontSize: '0.8rem' }}>
          Free agent pool exhausted.
        </div>
      )}

      {/* Bidding War Modal */}
      {biddingWar && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(30,26,20,0.55)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16,
        }}>
          <div className="card-elevated" style={{ maxWidth: 420, width: '100%', padding: 20, border: '2px solid var(--amber)' }}>
            <h3 className="font-display" style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--amber)', marginBottom: 6 }}>
              Bidding War!
            </h3>
            <p className="font-body" style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', lineHeight: 1.55, marginBottom: 12 }}>
              <strong>{biddingWar.aiTeamName}</strong> is also pursuing <strong>{biddingWar.player.name}</strong> and has
              offered <strong>${biddingWar.aiSalary}M/yr</strong>.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn-primary"
                style={{ fontSize: '0.72rem', padding: '7px 14px' }}
                disabled={(fr.cash || 0) < biddingWar.aiSalary}
                onClick={() => acceptBid(0)}
              >
                Match — ${biddingWar.aiSalary}M/yr
              </button>
              <button
                className="btn-secondary"
                style={{ fontSize: '0.72rem', padding: '7px 14px', borderColor: 'var(--green)', color: 'var(--green)' }}
                disabled={(fr.cash || 0) < Math.round(biddingWar.aiSalary * 1.10 * 10) / 10}
                onClick={() => acceptBid(0.10)}
              >
                Outbid (+10%) — ${Math.round(biddingWar.aiSalary * 1.10 * 10) / 10}M/yr
              </button>
              <button
                className="btn-secondary"
                style={{ fontSize: '0.72rem', padding: '7px 14px', borderColor: 'var(--red)', color: 'var(--red)' }}
                onClick={walkAway}
              >
                Walk Away
              </button>
            </div>
            <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--ink-muted)', marginTop: 8 }}>
              Walk away = {biddingWar.aiTeamName} signs {biddingWar.player.name}.
            </p>
          </div>
        </div>
      )}

      {/* League Transactions Feed */}
      {aiSigningsLog && aiSigningsLog.length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h3 className="font-display" style={{ fontSize: '0.78rem', fontWeight: 700 }}>League Transactions</h3>
            <button className="btn-secondary" style={{ fontSize: '0.58rem', padding: '3px 8px' }} onClick={() => setShowTransactions(t => !t)}>
              {showTransactions ? 'Hide' : 'Show'}
            </button>
          </div>
          {showTransactions && (
            <div style={{ maxHeight: 160, overflowY: 'auto' }}>
              {aiSigningsLog.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--cream-dark)', fontSize: '0.68rem' }}>
                  <span className="font-body">{s.teamName}</span>
                  <span className="font-mono" style={{ color: 'var(--ink-muted)' }}>signed {s.player.name} · {s.player.rating} rtg · ${s.player.salary}M</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <button className="btn-gold" style={{ padding: '12px 32px', fontSize: '0.9rem' }} onClick={onDone}>
          Done — Start Next Season
        </button>
      </div>
    </div>
  );
}

// ============================================================
// PLAYOFF BRACKET SCREEN
// ============================================================
function PlayoffBracketScreen({ playoffResult, playerFranchise, season, onContinue, onDone }) {
  const [roundIdx, setRoundIdx] = useState(0);
  const { eastSeeds, westSeeds, rounds, champion, playerMadePlayoffs, playerEliminated, playerWonChampionship } = playoffResult;

  const currentRound = rounds[roundIdx];
  const isLastRound = roundIdx >= rounds.length - 1;

  const pId = playerFranchise?.id;

  function playerGameInRound(round) {
    return round?.games.find(g => g.teamA?.id === pId || g.teamB?.id === pId) || null;
  }

  const playerGame = playerGameInRound(currentRound);
  const playerElimThisRound = playerGame && playerGame.loser?.id === pId;
  const playerWonThisRound = playerGame && playerGame.winner?.id === pId;

  const isChampionshipRound = currentRound?.name === 'NGL Championship';

  function advanceRound() {
    if (isLastRound) {
      onDone();
    } else {
      setRoundIdx(r => r + 1);
    }
  }

  // Seed badge helper
  function SeedBadge({ team, winnerOf }) {
    const isPlayer = team?.id === pId;
    const isChamp = champion?.id === team?.id;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
        fontWeight: isPlayer ? 700 : 400,
        color: isChamp ? 'var(--gold)' : isPlayer ? 'var(--red)' : 'var(--ink)',
      }}>
        <span style={{ fontSize: '0.55rem', color: 'var(--ink-muted)' }}>#{team?.seed}</span>
        {' '}{team?.city} {team?.name}
        {isPlayer && <span style={{ color: 'var(--red)', fontSize: '0.55rem' }}>YOU</span>}
      </span>
    );
  }

  // Seeds table (top 6 per conf) for reference
  function SeedsPanel({ seeds, label }) {
    return (
      <div style={{ flex: '1 1 200px' }}>
        <div className="font-display" style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6, letterSpacing: '0.08em' }}>
          {label} Conference
        </div>
        {seeds.map(t => (
          <div key={t.id} style={{
            display: 'flex', justifyContent: 'space-between', padding: '4px 6px',
            borderBottom: '1px solid var(--cream-dark)',
            background: t.id === pId ? '#fef5f5' : 'transparent',
            borderLeft: t.id === pId ? '3px solid var(--red)' : '3px solid transparent',
          }}>
            <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--ink-muted)', minWidth: 14 }}>#{t.seed}</span>
            <span className="font-body" style={{ fontSize: '0.68rem', flex: 1, marginLeft: 6 }}>{t.city} {t.name}</span>
            <span className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--ink-muted)' }}>{t.wins}-{t.losses}</span>
          </div>
        ))}
      </div>
    );
  }

  // Championship celebration
  if (isLastRound && playerWonChampionship) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '30px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏆</div>
        <h2 className="font-display" style={{ fontSize: 'clamp(1.4rem,5vw,2.2rem)', fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          NGL Champions!
        </h2>
        <div style={{ width: 60, height: 3, background: 'var(--gold)', margin: '10px auto 14px' }} />
        <p className="font-body" style={{ fontSize: '0.95rem', color: 'var(--ink-soft)', lineHeight: 1.65, marginBottom: 20 }}>
          The {playerFranchise.city} {playerFranchise.name} have won the NGL Championship in Season {season}.
          A dynasty is being built.
        </p>
        <div className="card" style={{ padding: '12px 16px', display: 'inline-block', marginBottom: 20, borderLeft: '4px solid var(--gold)' }}>
          <div className="font-mono" style={{ fontSize: '0.75rem' }}>
            {playerFranchise.city} {playerFranchise.name} defeated {currentRound.games[0]?.loser?.city} {currentRound.games[0]?.loser?.name}
          </div>
          <div className="font-body" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginTop: 4 }}>
            {currentRound.games[0]?.narrative}
          </div>
        </div>
        <div>
          <button className="btn-gold" style={{ padding: '12px 32px' }} onClick={onContinue}>
            Continue to Offseason
          </button>
        </div>
      </div>
    );
  }

  // Player eliminated
  if (playerMadePlayoffs && playerElimThisRound) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '30px 16px' }}>
        <h2 className="font-display section-header" style={{ fontSize: '1.2rem' }}>Season Over — {currentRound.name} Exit</h2>
        <div className="card" style={{ padding: 16, marginBottom: 12, borderLeft: '4px solid var(--red)' }}>
          <p className="font-body" style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>
            {playerGame.narrative}
          </p>
          <div style={{ display: 'flex', gap: 20, marginTop: 10, flexWrap: 'wrap' }}>
            <div><span className="stat-label">Final Record</span><div className="stat-value">{playerFranchise.wins}-{playerFranchise.losses}</div></div>
            <div><span className="stat-label">Playoff Exit</span><div className="stat-value" style={{ color: 'var(--red)' }}>{currentRound.name}</div></div>
          </div>
        </div>
        {/* Show remaining bracket results */}
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <h3 className="font-display" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 8 }}>Full {currentRound.name} Results</h3>
          {currentRound.games.map((g, i) => (
            <div key={i} style={{ padding: '5px 0', borderBottom: '1px solid var(--cream-dark)', fontSize: '0.72rem' }}>
              <span className="font-body" style={{ color: 'var(--green)' }}>{g.winner?.city} {g.winner?.name}</span>
              <span className="font-mono" style={{ color: 'var(--ink-muted)', margin: '0 6px' }}>def.</span>
              <span className="font-body" style={{ color: 'var(--ink-muted)', textDecoration: 'line-through' }}>{g.loser?.city} {g.loser?.name}</span>
              {g.isUpset && <span className="badge badge-amber" style={{ fontSize: '0.5rem', marginLeft: 6 }}>UPSET</span>}
            </div>
          ))}
        </div>
        <button className="btn-gold" style={{ padding: '12px 28px' }} onClick={onContinue}>
          Continue to Offseason
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 12px' }}>
      <h2 className="font-display section-header" style={{ fontSize: '1.2rem' }}>
        NGL Playoffs — {currentRound?.name}
      </h2>
      <p className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--ink-muted)', marginBottom: 14 }}>
        Season {season} · Round {roundIdx + 1} of {rounds.length}
      </p>

      {/* Seedings reference — only show on first round */}
      {roundIdx === 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <h3 className="font-display" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 10 }}>Playoff Field (12 Teams)</h3>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <SeedsPanel seeds={eastSeeds} label="East" />
            <SeedsPanel seeds={westSeeds} label="West" />
          </div>
          <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--ink-muted)', marginTop: 8 }}>
            Seeds 1-2 per conference have a bye. Seeds 3-6 play Wild Card round.
          </p>
        </div>
      )}

      {/* Player's game highlight */}
      {playerGame && playerMadePlayoffs && (
        <div className="card" style={{ padding: 14, marginBottom: 12, borderLeft: '4px solid var(--red)' }}>
          <h3 className="font-display" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--red)', marginBottom: 6 }}>
            Your Matchup — {currentRound.name}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <SeedBadge team={playerGame.teamA} />
            <span className="font-mono" style={{ color: 'var(--ink-muted)' }}>vs</span>
            <SeedBadge team={playerGame.teamB} />
          </div>
          <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', lineHeight: 1.55, marginBottom: 6 }}>
            {playerGame.narrative}
          </p>
          {playerWonThisRound && (
            <span className="badge badge-green">ADVANCE</span>
          )}
          {playerElimThisRound && (
            <span className="badge badge-red">ELIMINATED</span>
          )}
        </div>
      )}

      {/* All games this round */}
      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <h3 className="font-display" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 8 }}>
          {currentRound?.name} Results
        </h3>
        {['East', 'West', 'Neutral'].map(conf => {
          const confGames = currentRound?.games.filter(g => g.conf === conf);
          if (!confGames || confGames.length === 0) return null;
          return (
            <div key={conf} style={{ marginBottom: 10 }}>
              {conf !== 'Neutral' && (
                <div className="font-mono" style={{ fontSize: '0.58rem', color: 'var(--ink-muted)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.06em' }}>
                  {conf} Conference
                </div>
              )}
              {confGames.map((g, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0',
                  borderBottom: '1px solid var(--cream-dark)', flexWrap: 'wrap',
                }}>
                  <span className="font-mono" style={{ fontSize: '0.58rem', color: 'var(--ink-faint)', minWidth: 70 }}>{g.label}</span>
                  <span className="font-body" style={{ fontSize: '0.72rem', color: 'var(--green)', fontWeight: 600, flex: '1 1 120px' }}>
                    {g.winner?.city} {g.winner?.name}
                    {g.winner?.id === pId && <span style={{ color: 'var(--red)', marginLeft: 4, fontSize: '0.55rem' }}>YOU</span>}
                  </span>
                  <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--ink-muted)' }}>def.</span>
                  <span className="font-body" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', flex: '1 1 100px', textDecoration: 'line-through' }}>
                    {g.loser?.city} {g.loser?.name}
                  </span>
                  {g.isUpset && <span className="badge badge-amber" style={{ fontSize: '0.5rem' }}>UPSET</span>}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Championship reveal */}
      {isLastRound && !playerWonChampionship && (
        <div className="card" style={{ padding: 14, marginBottom: 14, borderLeft: '4px solid var(--gold)' }}>
          <div className="font-display" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--gold)' }}>
            NGL Champion: {champion?.city} {champion?.name}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        {!isLastRound && !playerElimThisRound && (
          <button className="btn-primary" style={{ padding: '10px 24px' }} onClick={advanceRound}>
            Next Round →
          </button>
        )}
        {isLastRound && !playerWonChampionship && (
          <button className="btn-gold" style={{ padding: '12px 28px' }} onClick={onContinue}>
            Continue to Offseason
          </button>
        )}
      </div>
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
          <button className="btn-secondary" onClick={saveApiKey}>{saved ? 'Saved' : 'Save'}</button>
        </div>
        <div className="font-mono" style={{ fontSize: '0.65rem', color: hasNarrativeApi() ? 'var(--green)' : 'var(--ink-muted)', marginTop: 6 }}>
          {hasNarrativeApi() ? 'AI Active' : 'Procedural mode'}
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

  // Playoff state
  const [playoffActive, setPlayoffActive] = useState(false);
  const [playoffResult, setPlayoffResult] = useState(null);
  const [aiSigningsLog, setAiSigningsLog] = useState([]);

  // Draft & free agency flow state
  const [draftActive, setDraftActive] = useState(false);
  const [draftPicks, setDraftPicks] = useState([]);
  const [draftProspects, setDraftProspects] = useState([]);
  const [draftDone, setDraftDone] = useState(false);
  const [freeAgencyActive, setFreeAgencyActive] = useState(false);
  const [offseasonFAPool, setOffseasonFAPool] = useState([]);

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
    setDraftActive(false); setDraftDone(false); setFreeAgencyActive(false);
    setPlayoffActive(false); setPlayoffResult(null); setAiSigningsLog([]);
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

      // Extension demand events
      if (event.type === 'extension_demand') {
        setFr(prevFr => prevFr.map((f, i) => {
          if (i !== activeIdx) return f;
          if (choice.action === 'sign') {
            return applyExtension(f, event.slotKey, event.extSalary, event.extYears);
          } else if (choice.action === 'release') {
            const updated = { ...f, [event.slotKey]: null };
            updated.players = [updated.star1, updated.star2, updated.corePiece].filter(Boolean);
            updated.totalSalary = Math.round(updated.players.reduce((s, p) => s + p.salary, 0) * 10) / 10;
            return updated;
          }
          // play_out: no change
          return f;
        }));
        return { ...event, resolved: true };
      }

      // Pressure events
      if (event.type === 'pressure') {
        if (event.gmRepDelta) setGmRep(r => clamp(r + event.gmRepDelta, 0, 100));
        setFr(prevFr => prevFr.map((f, i) => {
          if (i !== activeIdx) return f;
          let updated = { ...f };
          if (event.fanRatingDelta) updated.fanRating = clamp(updated.fanRating + event.fanRatingDelta, 0, 100);
          if (event.sponsorPenalty) updated.sponsorLevel = Math.max(0, (updated.sponsorLevel || 1) * event.sponsorPenalty);
          if (choice.action === 'fine') updated.cash = Math.round(((updated.cash || 0) - (choice.cost || 10)) * 10) / 10;
          if (choice.action === 'audit') {
            // Release lowest-morale non-star (core piece or depth)
            const slots = ['corePiece'];
            for (const slot of slots) {
              if (updated[slot]) { updated = { ...updated, [slot]: null }; break; }
            }
            updated.players = [updated.star1, updated.star2, updated.corePiece].filter(Boolean);
            updated.totalSalary = Math.round(updated.players.reduce((s, p) => s + p.salary, 0) * 10) / 10;
          }
          return updated;
        }));
        return { ...event, resolved: true };
      }

      // Default: standard event handling
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
        if (option.moraleBonus) updated.players = (updated.players || []).map(p => ({ ...p, morale: clamp(p.morale + option.moraleBonus, 0, 100) }));
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
      if (choice.moraleBonus) updated.players = (updated.players || []).map(p => ({ ...p, morale: clamp(p.morale + choice.moraleBonus, 0, 100) }));
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
    setDraftActive(false); setDraftDone(false); setFreeAgencyActive(false);
    setPlayoffActive(false); setPlayoffResult(null); setAiSigningsLog([]);
  }

  // ── Draft handlers ───────────────────────────────────────────
  function handleDraftPickMade(player, usedPick, tradeOffer) {
    if (player) {
      // Add player to slot if empty
      setFr(prev => prev.map((f, i) => {
        if (i !== activeIdx) return f;
        const updated = { ...f };
        // Find empty slot and fill
        if (!updated.star1) return signToSlot(updated, 'star1', player);
        if (!updated.star2) return signToSlot(updated, 'star2', player);
        if (!updated.corePiece) return signToSlot(updated, 'corePiece', player);
        return updated;
      }));
    }
  }

  function handleDraftDone() {
    setDraftActive(false);
    setDraftDone(true);
    const af = fr[activeIdx];
    // Generate larger pool, run AI signings first, then give player the remainder
    const fullPool = generateOffseasonFAPool(af.league, gmRep, 18);
    const { signed: aiSigned, remaining: playerPool } = simulateAIFreeAgency(fullPool, lt || { ngl: [], abl: [] }, af.league);
    setAiSigningsLog(aiSigned);
    setOffseasonFAPool(playerPool);
    setFreeAgencyActive(true);
  }

  function handleFreeAgencyDone() {
    setFreeAgencyActive(false);
    setDraftDone(false);
    setScreen('dashboard');
  }

  // ── Simulation handlers ───────────────────────────────────────
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

  async function handleContinueSeason() {
    setSimming(true);
    setTradeDeadlineActive(false);
    const prevFranchise = fr[activeIdx];
    await new Promise(r => setTimeout(r, 300));

    const result = simulateFullSeasonSecondHalf(tradeDeadlineLeague, fr, season);
    setLt(result.leagueTeams);
    setFr(result.franchises);

    const af = result.franchises[activeIdx];

    // NGL Playoffs — run bracket, show bracket UI before offseason
    if (af && af.league === 'ngl') {
      const pResult = simulatePlayoffs(result.leagueTeams.ngl, af);
      if (pResult.playerWonChampionship) {
        setFr(prev => prev.map((f, i) => i === activeIdx ? {
          ...f,
          championships: (f.championships || 0) + 1,
          trophies: [...(f.trophies || []), { season, wins: af.wins, losses: af.losses }],
          leagueRank: 1,
        } : f));
      }
      setPlayoffResult(pResult);
      // Store result snapshot so playoff-finished handler can use it
      setTradeDeadlineLeague(result.leagueTeams); // reuse this slot to carry lt forward
      setPlayoffActive(true);
      setSimming(false);
      return;
    }

    // ABL / fallback path
    await runEndOfSeasonFlow(result, af, prevFranchise);
    setSimming(false);
    await doSave();
  }

  // Called by PlayoffBracketScreen when all rounds are viewed
  async function handlePlayoffFinished() {
    setPlayoffActive(false);
    const afNow = fr[activeIdx];
    const result = {
      leagueTeams: lt,
      franchises: fr,
      standings: {
        ngl: [...(lt?.ngl || [])].sort((a, b) => b.wins - a.wins),
        abl: [...(lt?.abl || [])].sort((a, b) => b.wins - a.wins),
      },
    };
    await runEndOfSeasonFlow(result, afNow, afNow);
    await doSave();
  }

  async function runEndOfSeasonFlow(result, af, prevFranchise) {
    setSeason(s => s + 1);

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
      const f = af || result.franchises[activeIdx];
      const [rc, gr] = await Promise.all([generateSeasonRecap(f), generateGMGrade(f)]);
      setRecap(rc);
      setGrade(gr);

      if (season % 3 === 0) {
        const dynastyEra = await generateDynastyNarrative(f);
        setDynasty(prev => [...prev, { ...dynastyEra, season }]);
        setFr(prev => prev.map((x, i) => i === activeIdx ? { ...x, dynastyEra: dynastyEra.era } : x));
      }

      // Newspaper
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

      // Phase 2: extension demands (for slot players in final year)
      const extDemands = generateExtensionDemands(f, gmRep);

      // Phase 2: consecutive losing season tracking + pressure event
      const games = f.league === 'ngl' ? 17 : 82;
      const winPct = f.wins / Math.max(1, games);
      const isLosing = winPct < 0.400;
      const prevConsecutive = f.consecutiveLosingSeason || 0;
      const newConsecutive = isLosing ? prevConsecutive + 1 : 0;
      // Update franchise consecutive field
      setFr(prev => prev.map((x, i) => i === activeIdx ? { ...x, consecutiveLosingSeason: newConsecutive } : x));
      const pressureEvt = checkPressureEvent({ ...f, consecutiveLosingSeason: prevConsecutive }, season);

      const allEvents = [
        ...offseasonEvents.map(e => ({ ...e, resolved: false })),
        ...extDemands,
        ...(pressureEvt ? [{ ...pressureEvt, resolved: false }] : []),
      ];
      setEvents(allEvents);

      // Draft flow
      const picks = generateDraftPickPositions(f, result.leagueTeams[f.league] || []);
      const prospects = generateDraftProspects(f.league, 20, f.scoutingStaff);
      setDraftPicks(picks);
      setDraftProspects(prospects);
      setDraftActive(true);
    }

    setFreeAg({ ngl: generateFreeAgents('ngl'), abl: generateFreeAgents('abl') });
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
        {screen === 'setup' && <FranchiseSelectionScreen onCreate={handleCreate} />}

        {/* Draft flow — shown after each completed season */}
        {draftActive && !tradeDeadlineActive && af && (
          <DraftFlowScreen
            fr={af}
            lt={lt}
            draftPicks={draftPicks}
            draftProspects={draftProspects}
            onPickMade={handleDraftPickMade}
            onAutoPick={() => {}}
            onDone={handleDraftDone}
            gmRep={gmRep}
          />
        )}

        {/* Free agency flow — shown after draft */}
        {freeAgencyActive && !draftActive && af && (
          <FreeAgencyFlowScreen
            fr={af}
            setFr={setActiveFr}
            offseasonFAPool={offseasonFAPool}
            aiSigningsLog={aiSigningsLog}
            onDone={handleFreeAgencyDone}
            gmRep={gmRep}
          />
        )}

        {/* Playoff bracket — shown after regular season for NGL franchises */}
        {playoffActive && playoffResult && af && (
          <PlayoffBracketScreen
            playoffResult={playoffResult}
            playerFranchise={af}
            season={season}
            onContinue={handlePlayoffFinished}
            onDone={handlePlayoffFinished}
          />
        )}

        {/* Trade deadline overrides the dashboard screen */}
        {tradeDeadlineActive && !playoffActive && af && (
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

        {screen === 'dashboard' && af && !tradeDeadlineActive && !draftActive && !freeAgencyActive && !playoffActive && (
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
            setScreen={setScreen}
          />
        )}

        {screen === 'finances' && af && (
          <EmpireFinanceScreen
            af={af}
            fr={fr}
            stakes={stakes}
            lt={lt}
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
