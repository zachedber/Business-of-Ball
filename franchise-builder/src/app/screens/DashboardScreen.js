'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  calculateCapSpace, calculateValuation, getGMTier,
  projectRevenue, formatMoney, formatLabel,
  SLOT_BUDGET, calcSlotQuality, calcDepthQuality,
  signToSlot, releaseSlot,
  maxLoan, takeLoan, repayDebt, canAfford,
  getRivalryTier,
  generateCoachCandidates, fireCoach, hireCoach,
  r1,
} from '@/lib/engine';
import { DEBT_INTEREST, STAFF_SALARIES } from '@/data/leagues';
import { UPGRADE_COSTS } from '@/data/leagues';
import { getContrastText } from '@/data/teamColors';
import MathTooltip from '@/app/components/MathTooltip';
import NotificationsPanel from '@/app/components/NotificationsPanel';
import { Sparkline } from '@/app/components/AnalyticsScreen';
import InfrastructureTab from '@/app/components/InfrastructureTab';
import { FacilitiesSection } from '@/app/components/InfrastructureTab';
import StadiumManagementSection from '@/app/components/StadiumManagementSection';
import StaffTab from '@/app/components/StaffTab';
import { MiniChart, RATING_TOOLTIP } from '@/app/components/SharedComponents';
import TutorialOverlay from '@/app/components/TutorialOverlay';
import { Home, Users, Brain, Briefcase, Building2, CreditCard, Trophy, BookOpen } from 'lucide-react';

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ============================================================
// DASHBOARD
// ============================================================
export default function Dashboard({ fr, setFr, onSim, simming, recap, grade, events, onResolve, pressConf, onPressConf, newspaper, newspaperDismissed, onDismissNewspaper, cbaEvent, onCBA, namingOffer, onNaming, gmRep, notifications, onDismissNotif, onCashChange, leagueHistory, offseasonFAPool, quarterPhase }) {
  const [tab, setTab] = useState('home');
  const [showTutorial, setShowTutorial] = useState(false);
  const cap = useMemo(() => calculateCapSpace(fr), [fr]);
  const val = useMemo(() => calculateValuation(fr), [fr]);
  const gmTier = getGMTier(gmRep);

  useEffect(() => {
    try {
      if (!localStorage.getItem('bob_tutorial_seen')) {
        setShowTutorial(true);
      }
    } catch {}
  }, []);

  function closeTutorial() {
    setShowTutorial(false);
    try { localStorage.setItem('bob_tutorial_seen', '1'); } catch {}
  }

  return (
    <div style={{
      maxWidth: 980, margin: '0 auto', padding: '12px 12px',
      '--team-primary': fr.primaryColor || '#2563EB',
      '--team-secondary': fr.secondaryColor || '#FFFFFF',
      '--team-accent': fr.accentColor || fr.secondaryColor || '#2563EB',
      '--team-tint': hexToRgba(fr.primaryColor || '#2563EB', 0.11),
      '--team-text': getContrastText(fr.primaryColor || '#2563EB'),
    }}>
      {showTutorial && <TutorialOverlay onClose={closeTutorial} />}
      <div className="card-elevated scoreboard scoreboard-hero" style={{ marginBottom: 14 }}>
        <div>
          <h2 className="font-display" style={{ fontSize: 'clamp(1.4rem, 5vw, 2rem)', fontWeight: 700, textTransform: 'uppercase', color: fr.primaryColor || 'var(--ink)', position: 'relative' }}>
            {fr.city} {fr.name}
          </h2>
          <div className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', position: 'relative' }}>
            {fr.league === 'ngl' ? 'NGL' : 'ABL'} · S{fr.season || 1} · {fr.coach?.name || 'No Coach'}
            {fr.economyCycle !== 'stable' ? ` · ${formatLabel(fr.economyCycle)}` : ''}
            {' · '}<span style={{ color: 'var(--ink-muted)' }}>{gmTier.label}</span>
          </div>
        </div>
        <div className="scoreboard-stats">
          {[
            ['Record', `${fr.wins}-${fr.losses}`],
            ['Rank', `#${fr.leagueRank || '—'}`, 'var(--red)'],
            ['Value', `$${val}M`, null],
            ['Cash', formatMoney(fr.cash || 0), (fr.cash || 0) > 5 ? 'var(--green)' : 'var(--red)'],
          ].map(([label, value, color]) => (
            <div key={label} style={{ textAlign: 'center', padding: '6px 0', position: 'relative' }}>
              <div className="stat-label">{label}</div>
              <div className="font-display" style={{ fontSize: label === 'Record' ? 'clamp(1.1rem, 4vw, 1.6rem)' : '1.2rem', fontWeight: 700, color: color || 'var(--ink)' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="tab-nav" style={{ marginBottom: 12 }}>
        {[['home', 'Home', Home], ['slots', 'Slots', Users], ['staff', 'Coach', Brain], ['biz', 'Biz', Briefcase], ['stadium', 'Stadium', Building2], ['facilities', 'Facilities', Building2], ['finance', 'Finance', CreditCard], ['legacy', 'Legacy', Trophy], ['history', 'History', BookOpen]].map(([key, label, Icon]) => (
          <button key={key} className={`tab-btn ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
      {tab === 'home' && <HomeTab fr={fr} onSim={onSim} simming={simming} recap={recap} grade={grade} events={events} onResolve={onResolve} pressConf={pressConf} onPressConf={onPressConf} newspaper={newspaper} newspaperDismissed={newspaperDismissed} onDismissNewspaper={onDismissNewspaper} cbaEvent={cbaEvent} onCBA={onCBA} namingOffer={namingOffer} onNaming={onNaming} notifications={notifications} onDismissNotif={onDismissNotif} quarterPhase={quarterPhase} />}
      {tab === 'slots' && <SlotsTab fr={fr} setFr={setFr} gmRep={gmRep} offseasonFAPool={offseasonFAPool} />}
      {tab === 'staff' && <StaffTab fr={fr} setFr={setFr} gmRep={gmRep} />}
      {tab === 'biz' && <BizTab fr={fr} setFr={setFr} />}
      {tab === 'stadium' && <div className="fade-in"><StadiumManagementSection fr={fr} setFr={setFr} season={fr.season || 1} /></div>}
      {tab === 'facilities' && <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><FacilitiesSection fr={fr} setFr={setFr} onCashChange={onCashChange} /></div>}
      {tab === 'finance' && <DashFinanceTab fr={fr} />}
      {tab === 'legacy' && <LegacyTab fr={fr} leagueHistory={leagueHistory} />}
      {tab === 'history' && <HistTab fr={fr} />}
    </div>
  );
}


// ============================================================
// HOME TAB
// ============================================================
function HomeTab({ fr, onSim, simming, recap, grade, events, onResolve, pressConf, onPressConf, newspaper, newspaperDismissed, onDismissNewspaper, cbaEvent, onCBA, namingOffer, onNaming, notifications, onDismissNotif, quarterPhase }) {
  const unresolvedEvents = events.filter(e => !e.resolved);
  const simBlocked = simming || unresolvedEvents.length > 0 || (pressConf && pressConf.length > 0) || cbaEvent || (newspaper && !newspaperDismissed);
  const simReady = !simBlocked && !simming;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {(quarterPhase || 0) > 0 && (
        <div className="card" style={{ padding: '10px 14px', textAlign: 'center', background: 'linear-gradient(180deg, rgba(26,18,8,0.04), transparent)' }}>
          <div className="stat-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Current Season Record</div>
          <div className="font-display" style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--ink)' }}>
            {fr.wins ?? 0}–{fr.losses ?? 0}
          </div>
          <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
            {((fr.wins ?? 0) + (fr.losses ?? 0)) > 0
              ? `${(((fr.wins ?? 0) / ((fr.wins ?? 0) + (fr.losses ?? 0))) * 100).toFixed(0)}% win rate · Q${quarterPhase}`
              : `Quarter ${quarterPhase}`}
          </div>
        </div>
      )}
      {notifications && notifications.length > 0 && (
        <NotificationsPanel notifications={notifications} onDismiss={onDismissNotif} />
      )}
      {newspaper && !newspaperDismissed && (
        <div className="card fade-in" style={{ padding: 0, border: '2px solid var(--ink)', overflow: 'hidden', background: 'linear-gradient(180deg,#f8f4eb,#f1e8d9)' }}>
          <div style={{ background: 'var(--ink)', color: 'var(--cream)', padding: '10px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="font-display" style={{ fontSize: '0.72rem', letterSpacing: '0.2em' }}>THE DAILY BALL</div>
            <div className="font-mono" style={{ fontSize: '0.7rem', color: '#aaa' }}>SEASON {newspaper.season} WRAP-UP</div>
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
        <div className="card" style={{ background: 'linear-gradient(180deg,rgba(212,168,67,0.08),rgba(255,255,255,0.4))' }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Season Recap</h3>
          <p className="font-body" style={{ lineHeight: 1.6, color: 'var(--ink-soft)', fontSize: '0.85rem' }}>{recap}</p>
          {grade && (
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(26,18,8,0.08)' }}>
              <span className="font-display" style={{ fontSize: '2.6rem', lineHeight: 1, fontWeight: 700, color: grade.grade.startsWith('A') ? 'var(--green)' : grade.grade.startsWith('B') ? 'var(--amber)' : 'var(--red)' }}>
                {grade.grade}
              </span>
              <span className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>{grade.analysis}</span>
            </div>
          )}
        </div>
      )}
      {pressConf && pressConf.length > 0 && (
        <div className="card" style={{ borderLeft: '5px solid var(--ink)', background: 'linear-gradient(180deg,rgba(26,18,8,0.03),rgba(255,255,255,0.4))' }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Press Conference</h3>
          {pressConf.map(pc => (
            <div key={pc.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--cream-darker)' }}>
              <p className="font-body" style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--ink-soft)', marginBottom: 10 }}>{pc.prompt}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {pc.options.map((opt, oi) => (
                  <button key={oi} className="btn-secondary" style={{ fontSize: '0.72rem', textAlign: 'left' }} onClick={() => onPressConf(pc.id, oi)}>
                    {opt.label}
                    {opt.effectLabels?.length > 0 && (
                      <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                        {opt.effectLabels.map((el, ei) => (
                          <span key={ei} style={{ fontSize: '0.62rem', padding: '1px 4px', borderRadius: 3, background: el.includes('-') ? 'rgba(180,40,40,0.12)' : 'rgba(40,140,40,0.12)', color: el.includes('-') ? '#b42828' : '#1a7a1a' }}>{el}</span>
                        ))}
                      </span>
                    )}
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
              <button key={ci} className="btn-secondary" style={{ fontSize: '0.72rem', alignItems: 'flex-start', textAlign: 'left' }} onClick={() => onCBA(ci)}>
                {ch.label}<br /><span style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>{ch.desc}</span>
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
            <button className="btn-primary" style={{ fontSize: '0.78rem' }} onClick={() => onNaming(true)}>Accept</button>
            <button className="btn-secondary" style={{ fontSize: '0.78rem' }} onClick={() => onNaming(false)}>Decline</button>
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
                  <button key={ci} className="btn-secondary" style={{ fontSize: '0.72rem' }} onClick={() => onResolve(ev.id, ci)}>
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
          ['Win Prob', fr.mathBreakdowns?.winProbability?.finalValue != null ? `${Math.round(fr.mathBreakdowns.winProbability.finalValue * 100)}%` : '—', null, 'winProbability'],
          ['Fan', fr.fanRating, fr.fanRating > 65 ? 'var(--green)' : null, 'fanRating'],
          ['Chem', fr.lockerRoomChemistry, fr.lockerRoomChemistry > 60 ? 'var(--green)' : 'var(--amber)', 'lockerRoomChemistry'],
          ['Media', fr.mediaRep, null, 'mediaRep'],
          ['Community', fr.communityRating, null, 'communityRating'],
          ['Revenue', `$${fr.finances?.revenue ?? 0}M`, 'var(--green)', 'revenue'],
          ['Profit', `$${fr.finances?.profit ?? 0}M`, (fr.finances?.profit ?? 0) > 0 ? 'var(--green)' : 'var(--red)', null],
        ].map(([label, value, color, breakdownKey]) => {
          const bd = breakdownKey ? fr.mathBreakdowns?.[breakdownKey] : null;
          return (
            <div key={label} className="card" style={{ padding: '10px 12px', textAlign: 'center' }}>
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{ fontSize: '1rem', color: color || 'var(--ink)' }}>
                {bd ? (
                  <MathTooltip breakdown={bd} label={label}>{value}</MathTooltip>
                ) : value}
              </div>
            </div>
          );
        })}
      </div>
      {/* Rival Card */}
      {fr.rivalry?.active && fr.rivalry.teamName && (
        <div className="card" style={{ padding: '10px 14px', borderLeft: '3px solid var(--red)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <div>
              <div className="stat-label" style={{ fontSize: '0.7rem' }}>RIVAL</div>
              <div className="font-display" style={{ fontSize: '0.9rem', fontWeight: 700 }}>{fr.rivalry.teamName}</div>
              <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginTop: 2 }}>
                {getRivalryTier(fr.rivalry.intensityScore)} · H2H: {fr.rivalry.h2hRecord?.wins || 0}-{fr.rivalry.h2hRecord?.losses || 0}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="stat-label" style={{ fontSize: '0.7rem' }}>Intensity</div>
              <div className="font-display" style={{ fontSize: '1.1rem', fontWeight: 700, color: fr.rivalry.intensityScore >= 76 ? 'var(--red)' : fr.rivalry.intensityScore >= 51 ? 'var(--amber)' : 'var(--ink-muted)' }}>
                {fr.rivalry.intensityScore}
              </div>
            </div>
          </div>
        </div>
      )}
      {fr.economyCycle && fr.economyCycle !== 'stable' && (
        <div className={`card`} style={{ padding: '8px 14px', textAlign: 'center', fontSize: '0.75rem', background: fr.economyCycle === 'boom' ? 'var(--green)' : 'var(--red)', color: '#fff' }}>
          {fr.economyCycle === 'boom' ? 'City Economy: BOOM — Revenue boosted' : 'City Economy: RECESSION — Revenue reduced'}
        </div>
      )}
      {(quarterPhase || 0) === 0 && (
        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <button
            className={`btn-gold simulate-cta ${simReady ? 'ready' : ''}`}
            onClick={onSim}
            disabled={simBlocked}
          >
            {simming ? 'Simulating...' : newspaper && !newspaperDismissed ? 'Read Newspaper First' : unresolvedEvents.length > 0 || pressConf?.length > 0 || cbaEvent ? 'Resolve All Events' : 'Simulate Season'}
          </button>
        </div>
      )}
    </div>
  );
}


// ============================================================
// SLOTS TAB
// ============================================================
function SlotsTab({ fr, setFr, gmRep, offseasonFAPool: frozenPool }) {
  const [showFA, setShowFA] = useState(false);
  const [signingSlot, setSigningSlot] = useState(null);
  // Read-only frozen pool from state — never regenerate
  const faPool = frozenPool || [];

  const budget = SLOT_BUDGET[fr.league] || 80;
  const usedBudget = ['star1', 'star2', 'corePiece'].reduce((s, k) => s + (fr[k]?.salary || 0), 0);
  const budgetDelta = Math.round((budget - usedBudget) * 10) / 10;
  const depthQ = calcDepthQuality(fr);
  const slotQ = calcSlotQuality(fr);

  function doRelease(slotName) {
    setFr(prev => releaseSlot(prev, slotName));
  }

  function doSign(player, slotName) {
    const signedFranchise = signToSlot(fr, slotName, player);
    if (!signedFranchise) return; // Bugfix: dashboard slot signings now ignore invalid FA moves instead of writing a null franchise.
    setFr(() => signedFranchise);
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <span className="stat-label">Slot Budget</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <span className="font-mono" style={{ fontSize: '0.75rem', textAlign: 'right' }}>
              ${usedBudget}M / ${budget}M
            </span>
            <span className="font-mono" style={{ fontSize: '0.68rem', color: budgetDelta < 0 ? 'var(--red)' : 'var(--green)', textAlign: 'right' }}>
              {budgetDelta < 0 ? `$${Math.abs(budgetDelta)}M over` : `$${budgetDelta}M free`}
            </span>
          </div>
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
                  <div className="font-display" style={{ fontSize: '1rem', fontWeight: 700 }}>{player.name || 'Unknown'}</div>
                  <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginBottom: 4 }}>{player.position || '—'} · Age {player.age || '?'}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <div>
                      <span className="stat-label" style={{ fontSize: '0.7rem' }}>Rating</span>
                      <div className="font-display" title={RATING_TOOLTIP} style={{ fontSize: '1.2rem', fontWeight: 700, cursor: 'help', color: (player.rating || 0) >= 85 ? 'var(--green)' : (player.rating || 0) >= 70 ? 'var(--amber)' : 'var(--ink)' }}>{player.rating || 0}</div>
                    </div>
                    <div>
                      <span className="stat-label" style={{ fontSize: '0.7rem' }}>Salary</span>
                      <div className="font-mono" style={{ fontSize: '0.85rem' }}>${player.salary || 0}M</div>
                    </div>
                    <div>
                      <span className="stat-label" style={{ fontSize: '0.7rem' }}>Years</span>
                      <div className="font-mono" style={{ fontSize: '0.85rem', color: (player.yearsLeft || 0) <= 1 ? 'var(--red)' : 'var(--ink)' }}>{player.yearsLeft || 0}yr</div>
                    </div>
                  </div>
                  {player.trait && (
                    <span className={`badge ${player.trait === 'leader' ? 'badge-green' : player.trait === 'mercenary' ? 'badge-amber' : ['volatile', 'injury_prone'].includes(player.trait) ? 'badge-red' : 'badge-ink'}`} style={{ marginBottom: 8, display: 'inline-block' }}>
                      {formatLabel(player.trait)}
                    </span>
                  )}
                  <div style={{ marginTop: 6 }}>
                    <button
                      className="btn-secondary"
                      style={{ fontSize: '0.7rem', padding: '4px 10px', borderColor: 'var(--red)', color: 'var(--red)' }}
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
                      style={{ fontSize: '0.7rem', padding: '4px 10px', opacity: faPool.length > 0 ? 1 : 0.4 }}
                      disabled={faPool.length === 0}
                      onClick={() => { setShowFA(true); setSigningSlot(key); }}
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
      {faPool.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <button className="btn-primary" onClick={() => { setShowFA(true); setSigningSlot(null); }}>
            Offseason Signing Pool
          </button>
        </div>
      )}
      {showFA && faPool.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Free Agent Pool</h3>
            <button className="btn-secondary" style={{ fontSize: '0.7rem', padding: '4px 10px' }} onClick={() => setShowFA(false)}>Close</button>
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
                  const canAffordPlayer = (fr.cash || 0) >= p.salary;
                  const wouldOverBudget = usedBudget + p.salary > budget;
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--cream-dark)' }}>
                      <td className="font-body" style={{ padding: '6px 8px', fontWeight: 500 }}>{p.name}</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>{p.position}</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>{p.age}</td>
                      <td className="font-mono" title={RATING_TOOLTIP} style={{ padding: '6px 8px', fontWeight: 600, cursor: 'help', color: p.rating >= 85 ? 'var(--green)' : p.rating >= 70 ? 'var(--ink)' : 'var(--ink-muted)' }}>{p.rating}</td>
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
                                style={{ fontSize: '0.7rem', padding: '3px 6px', opacity: (!canAffordPlayer || wouldOverBudget || slotFull) ? 0.4 : 1 }}
                                disabled={!canAffordPlayer || wouldOverBudget || slotFull}
                                onClick={() => doSign(p, key)}
                                title={slotFull ? 'Slot full — release first' : !canAffordPlayer ? 'Insufficient cash' : wouldOverBudget ? 'Over budget' : `Sign to ${label}`}
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

      {/* Taxi Squad */}
      {(fr.taxiSquad || []).length > 0 && (
        <div className="card" style={{ padding: 14, marginTop: 12, borderLeft: '3px solid var(--blue)' }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.85rem' }}>Taxi Squad ({(fr.taxiSquad || []).length}/4)</h3>
          <p className="font-body" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginBottom: 8 }}>
            Drafted rookies develop here without counting against salary cap. Max 2 seasons before they must be promoted or released.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {(fr.taxiSquad || []).map((r, idx) => (
              <div key={r.id || idx} className="card" style={{ padding: '10px 12px' }}>
                <div className="font-display" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{r.name || 'Unknown'}</div>
                <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>
                  {r.position || '—'} · Age {r.age || '?'} · {r.rating || 0} rtg
                </div>
                <div className="font-mono" style={{ fontSize: '0.7rem', color: (r.seasonsOnTaxi || 0) >= 1 ? 'var(--amber)' : 'var(--ink-muted)' }}>
                  Year {(r.seasonsOnTaxi || 0) + 1} of 2
                </div>
                {r.draftRound && <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>R{r.draftRound} P{r.draftPick}</div>}
                {r.trait && <span className="badge badge-ink" style={{ fontSize: '0.7rem', marginTop: 4 }}>{r.trait}</span>}
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  <button
                    className="btn-primary"
                    style={{ fontSize: '0.7rem', padding: '3px 8px' }}
                    onClick={() => {
                      setFr(prev => {
                        const updated = { ...prev };
                        updated.taxiSquad = (prev.taxiSquad || []).filter((_, ri) => ri !== idx);
                        // Move to depth roster (fr.players is derived from slots, so add to rookieSlots)
                        updated.rookieSlots = [...(prev.rookieSlots || []), r];
                        return updated;
                      });
                    }}
                  >
                    Promote
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '0.7rem', padding: '3px 8px', borderColor: 'var(--red)', color: 'var(--red)' }}
                    onClick={() => {
                      setFr(prev => ({ ...prev, taxiSquad: (prev.taxiSquad || []).filter((_, ri) => ri !== idx) }));
                    }}
                  >
                    Release
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rookie Slots (overflow / legacy) */}
      {(fr.rookieSlots || []).length > 0 && (
        <div className="card" style={{ padding: 14, marginTop: 12 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.85rem' }}>Depth Roster ({(fr.rookieSlots || []).length})</h3>
          <p className="font-body" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginBottom: 8 }}>
            Players ready for promotion to a franchise slot or release.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
            {(fr.rookieSlots || []).map((r, idx) => (
              <div key={r.id || idx} className="card" style={{ padding: '10px 12px' }}>
                <div className="font-display" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{r.name || 'Unknown'}</div>
                <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>
                  {r.position || '—'} · Age {r.age || '?'} · {r.rating || 0} rtg
                </div>
                {r.draftRound && <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>R{r.draftRound} P{r.draftPick}</div>}
                {r.trait && <span className="badge badge-ink" style={{ fontSize: '0.7rem', marginTop: 4 }}>{r.trait}</span>}
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  {slotDefs.map(({ key, label }) => (
                    <button
                      key={key}
                      className="btn-secondary"
                      style={{ fontSize: '0.7rem', padding: '2px 6px', opacity: fr[key] ? 0.4 : 1 }}
                      disabled={!!fr[key]}
                      title={fr[key] ? 'Slot occupied' : `Promote to ${label}`}
                      onClick={() => {
                        setFr(prev => {
                          const promoted = signToSlot(prev, key, r);
                          if (!promoted) {
                            // Over budget — bypass signToSlot and write slot directly (promotion, not new signing)
                            const direct = { ...prev, [key]: { ...r, slotType: key } };
                            direct.rookieSlots = (prev.rookieSlots || []).filter((_, ri) => ri !== idx);
                            direct.players = [direct.star1, direct.star2, direct.corePiece].filter(Boolean);
                            direct.totalSalary = r1(direct.players.reduce((s, p) => s + (p.salary || 0), 0));
                            direct.depthQuality = calcDepthQuality(direct);
                            direct.rosterQuality = calcSlotQuality(direct);
                            return direct;
                          }
                          return { ...promoted, rookieSlots: (promoted.rookieSlots || []).filter((_, ri) => ri !== idx) };
                        });
                      }}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '0.7rem', padding: '2px 6px', borderColor: 'var(--red)', color: 'var(--red)' }}
                    onClick={() => {
                      setFr(prev => ({ ...prev, rookieSlots: (prev.rookieSlots || []).filter((_, ri) => ri !== idx) }));
                    }}
                  >
                    Cut
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================================
// COACH TAB
// ============================================================
// Phase 3: coach level rep requirements
const COACH_REP_GATE = { 3: 55, 4: 75 };

function CoachTab({ fr, setFr, gmRep }) {
  const [candidates, setCandidates] = useState(null);
  const [confirmFire, setConfirmFire] = useState(false);
  const coach = fr.coach;
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card-elevated" style={{ padding: 16 }}>
        <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Head Coach</h3>
        {coach ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="font-display" style={{ fontSize: '1.1rem', fontWeight: 700 }}>{coach.name}</div>
            <div className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginTop: 3 }}>
              {coach.personality} · <span title={`Coach Level ${coach.level}: +${coach.level * 1.5}% win probability bonus. Higher levels improve player development and morale.`} style={{ cursor: 'help', borderBottom: '1px dotted var(--ink-muted)' }}>Lvl {coach.level}/4</span> · {coach.seasonsWithTeam}yr
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
        ) : (
        <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>No head coach — hire from candidates below.</p>
        )}
      </div>
      {candidates && (
        <div className="card" style={{ padding: 16 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Coaching Candidates</h3>
          {candidates.map(cd => {
            const repRequired = COACH_REP_GATE[cd.level];
            const repLocked = repRequired && gmRep < repRequired;
            return (
              <div key={cd.name} className="card" style={{ padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div className="font-display" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{cd.name}</div>
                  <div className="font-body" style={{ fontSize: '0.75rem', color: 'var(--ink-soft)' }}>{cd.personality} · Lvl {cd.level}</div>
                  <div className="font-body" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', fontStyle: 'italic', marginTop: 3 }}>{cd.backstory}</div>
                  {repLocked && <div style={{ fontSize: '0.7rem', color: 'var(--red)', marginTop: 2 }}>Requires {repRequired} GM Rep (you have {Math.round(gmRep)})</div>}
                </div>
                <button
                  className="btn-primary"
                  style={{ fontSize: '0.7rem', padding: '5px 12px', opacity: repLocked ? 0.4 : 1 }}
                  disabled={repLocked}
                  title={repLocked ? `Need ${repRequired} GM Rep` : ''}
                  onClick={() => { setFr(() => hireCoach(fr, cd)); setCandidates(null); }}
                >
                  Hire
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// BUSINESS TAB
// ============================================================
function BizTab({ fr, setFr }) {
  const [ticketPriceDraft, setTicketPriceDraft] = useState(fr.ticketPrice);

  useEffect(() => {
    setTicketPriceDraft(fr.ticketPrice);
  }, [fr.ticketPrice]);

  const proj = useMemo(() => projectRevenue(fr), [fr]);
  const valuePerception = Math.round((fr.rosterQuality / 100) * 200 - ticketPriceDraft);
  const isOverpriced = valuePerception < -40;
  const isGoodValue = valuePerception > 60;

  function commitTicketPrice(nextPrice) {
    setFr(prev => (prev.ticketPrice === nextPrice ? prev : { ...prev, ticketPrice: nextPrice }));
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card" style={{ padding: 16 }}>
        <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Revenue Projection</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div><div className="stat-label">Revenue</div><div className="stat-value" style={{ color: 'var(--green)' }}>
            {fr.mathBreakdowns?.revenue ? (
              <MathTooltip breakdown={fr.mathBreakdowns.revenue} label="Revenue">${proj.totalRevenue}M</MathTooltip>
            ) : `$${proj.totalRevenue}M`}
          </div></div>
          <div><div className="stat-label">Expenses</div><div className="stat-value" style={{ color: 'var(--red)' }}>${proj.totalExpenses}M</div></div>
          <div><div className="stat-label">Profit</div><div className="stat-value" style={{ color: proj.projectedProfit > 0 ? 'var(--green)' : 'var(--red)' }}>${proj.projectedProfit}M</div></div>
        </div>
      </div>
      <div className="card" style={{ padding: 16 }}>
        <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Ticket Pricing</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="stat-label">Price</span>
          <input
            type="range"
            min="30"
            max="200"
            step="5"
            value={ticketPriceDraft}
            onChange={e => setTicketPriceDraft(Number(e.target.value))}
            onMouseUp={e => commitTicketPrice(Number(e.currentTarget.value))}
            onTouchEnd={e => commitTicketPrice(Number(e.currentTarget.value))}
            onKeyUp={e => commitTicketPrice(Number(e.currentTarget.value))}
            style={{ flex: 1, minWidth: 160 }}
          />
          <span className="stat-value">${ticketPriceDraft}</span>
          {isOverpriced && <span className="badge badge-red">OVERPRICED</span>}
          {isGoodValue && <span className="badge badge-green">GOOD VALUE</span>}
        </div>
        <p className="font-body" style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: 6, fontStyle: 'italic' }}>
          Fans compare price to team quality — overpricing hurts attendance and fan rating.
        </p>
        <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
          <div><span className="stat-label">Attendance</span><div className="stat-value" style={{ color: proj.attendance > 75 ? 'var(--green)' : proj.attendance > 55 ? 'var(--amber)' : 'var(--red)' }}>
            {fr.mathBreakdowns?.attendance ? (
              <MathTooltip breakdown={fr.mathBreakdowns.attendance} label="Attendance">{proj.attendance}%</MathTooltip>
            ) : `${proj.attendance}%`}
          </div></div>
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
          <button className="btn-secondary" style={{ fontSize: '0.7rem', opacity: (fr.debt || 0) >= maxLoan(fr) ? 0.4 : 1 }} disabled={(fr.debt || 0) >= maxLoan(fr)} onClick={() => setFr(p => takeLoan(p, 10))}>Borrow $10M</button>
          <button className="btn-secondary" style={{ fontSize: '0.7rem', opacity: !(fr.debt > 0 && canAfford(fr.cash, 10)) ? 0.4 : 1 }} disabled={!(fr.debt > 0 && canAfford(fr.cash, 10))} onClick={() => setFr(p => repayDebt(p, 10))}>Repay $10M</button>
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
// DASHBOARD FINANCE TAB (Phase 1.5 — Full Itemized Ledger)
// ============================================================
function DashFinanceTab({ fr }) {
  const proj = useMemo(() => projectRevenue(fr), [fr]);
  const cap = useMemo(() => calculateCapSpace(fr), [fr]);
  const history = fr.history || [];

  // ── Revenue items ────────────────────────────────────────────
  const revenueItems = [
    { label: 'Gate Revenue', amount: proj.gateRevenue },
    { label: 'TV Revenue', amount: proj.tvRevenue },
    { label: 'Merchandise', amount: proj.merchRevenue },
    { label: 'Sponsorship', amount: proj.sponsorRevenue || 0 },
    { label: 'Naming Rights', amount: proj.namingRevenue || 0 },
  ];
  const totalRevenue = proj.totalRevenue;

  // ── Expense items ────────────────────────────────────────────
  const star1Sal = fr.star1?.salary || 0;
  const star2Sal = fr.star2?.salary || 0;
  const coreSal = fr.corePiece?.salary || 0;
  const depthPayroll = r1(Math.max(0, (fr.totalSalary || 0) - star1Sal - star2Sal - coreSal));
  const coachSalary = r1((fr.coach?.level || 1) * 2);
  const ocSal = fr.offensiveCoordinator ? (STAFF_SALARIES.oc[fr.offensiveCoordinator.level] || 1) : 0;
  const dcSal = fr.defensiveCoordinator ? (STAFF_SALARIES.dc[fr.defensiveCoordinator.level] || 1) : 0;
  const pdcSal = fr.playerDevCoach ? (STAFF_SALARIES.pdc[fr.playerDevCoach.level] || 0.8) : 0;
  const scoutCost = (fr.scoutingStaff || 1) * 2;
  const devCost = (fr.developmentStaff || 1) * 2;
  const medCost = (fr.medicalStaff || 1) * 2;
  const mktCost = (fr.marketingStaff || 1) * 2;
  const trainFac = (fr.trainingFacility || 1) * 1.5;
  const weightRm = (fr.weightRoom || 1) * 1.5;
  const filmRm = (fr.filmRoom || 1) * 1.5;
  const stadMaint = fr.stadiumAge > 15 ? r1(fr.stadiumAge * 0.3) : 1;
  const deadCap = fr.capDeadMoney || 0;
  const debtRepay = r1((fr.debt || 0) * DEBT_INTEREST);

  const expenseItems = [
    { label: fr.star1 ? `Star 1 — ${fr.star1.name}` : 'Star 1 (vacant)', amount: star1Sal },
    { label: fr.star2 ? `Star 2 — ${fr.star2.name}` : 'Star 2 (vacant)', amount: star2Sal },
    { label: fr.corePiece ? `Core — ${fr.corePiece.name}` : 'Core Piece (vacant)', amount: coreSal },
    { label: 'Depth Roster Payroll', amount: depthPayroll },
    { label: 'Head Coach', amount: coachSalary },
    { label: 'OC Salary', amount: r1(ocSal) },
    { label: 'DC Salary', amount: r1(dcSal) },
    { label: 'PDC Salary', amount: r1(pdcSal) },
    { label: 'Scouting Staff', amount: r1(scoutCost) },
    { label: 'Player Development', amount: r1(devCost) },
    { label: 'Medical Staff', amount: r1(medCost) },
    { label: 'Marketing Staff', amount: r1(mktCost) },
    { label: 'Training Facility', amount: r1(trainFac) },
    { label: 'Weight Room', amount: r1(weightRm) },
    { label: 'Film Room', amount: r1(filmRm) },
    { label: 'Stadium Maintenance', amount: r1(stadMaint) },
    { label: 'Dead Cap', amount: r1(deadCap) },
    { label: 'Debt Interest', amount: debtRepay },
  ];
  const totalExpenses = proj.totalExpenses;
  const netProfit = proj.projectedProfit;

  // ── Dead cap breakdown ───────────────────────────────────────
  const deadCapLog = fr.deadCapLog || [];
  const currentSeasonDead = deadCapLog.filter(d => d.season === (fr.season || 1));
  const adjCap = cap.cap;
  const deadCapPct = adjCap > 0 ? r1((deadCap / adjCap) * 100) : 0;

  const LedgerRow = ({ label, amount, color, bold }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--cream-darker)' }}>
      <span className="font-body" style={{ fontSize: '0.78rem', fontWeight: bold ? 700 : 400, color: color || 'var(--ink)' }}>{label}</span>
      <span className="font-mono" style={{ fontSize: '0.78rem', fontWeight: bold ? 700 : 400, color: color || 'var(--ink)' }}>${r1(amount)}M</span>
    </div>
  );

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Available Cash — prominent top card */}
      <div className="card-elevated" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '5px solid var(--green)' }}>
        <div>
          <div className="stat-label" style={{ fontSize: '0.72rem', letterSpacing: '0.1em' }}>AVAILABLE CASH</div>
          <div className="font-display" style={{ fontSize: '1.5rem', fontWeight: 700, color: (fr.cash || 0) > 0 ? 'var(--green)' : 'var(--red)' }}>
            {formatMoney(fr.cash || 0)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="stat-label" style={{ fontSize: '0.68rem' }}>Franchise Valuation</div>
          <div className="font-mono" style={{ fontSize: '0.85rem', color: 'var(--ink-muted)' }}>{formatMoney(calculateValuation(fr))}</div>
        </div>
      </div>

      {/* Revenue Section */}
      <div className="card" style={{ padding: 14 }}>
        <h3 className="font-display section-header" style={{ fontSize: '0.85rem', color: 'var(--green)', marginBottom: 8 }}>Revenue</h3>
        {revenueItems.filter(r => r.amount > 0).map(r => (
          <LedgerRow key={r.label} label={r.label} amount={r.amount} color="var(--green)" />
        ))}
        <LedgerRow label="Total Revenue" amount={totalRevenue} color="var(--green)" bold />
      </div>

      {/* Expenses Section */}
      <div className="card" style={{ padding: 14 }}>
        <h3 className="font-display section-header" style={{ fontSize: '0.85rem', color: 'var(--red)', marginBottom: 8 }}>Expenses</h3>
        {expenseItems.filter(e => e.amount > 0).map(e => (
          <LedgerRow key={e.label} label={e.label} amount={e.amount} color="var(--ink-soft)" />
        ))}
        <LedgerRow label="Total Expenses" amount={totalExpenses} color="var(--red)" bold />
      </div>

      {/* Net Profit/Loss */}
      <div className="card-elevated" style={{ padding: '12px 16px', borderLeft: `5px solid ${netProfit >= 0 ? 'var(--green)' : 'var(--red)'}` }}>
        <LedgerRow label="Net Profit / Loss" amount={netProfit} color={netProfit >= 0 ? 'var(--green)' : 'var(--red)'} bold />
      </div>

      {/* Dead Cap Breakdown */}
      {(deadCap > 0 || (fr.deferredDeadCap || 0) > 0 || deadCapLog.length > 0) && (
        <div className="card" style={{ padding: 14, borderLeft: '3px solid var(--amber)' }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.85rem', color: 'var(--amber)', marginBottom: 8 }}>Dead Cap</h3>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
            <div>
              <div className="stat-label">This Season</div>
              <div className="font-mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--red)' }}>{formatMoney(deadCap)}</div>
            </div>
            <div>
              <div className="stat-label">Deferred (Next Season)</div>
              <div className="font-mono" style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--amber)' }}>{formatMoney(fr.deferredDeadCap || 0)}</div>
            </div>
            <div>
              <div className="stat-label">% of Cap</div>
              <div className="font-mono" style={{ fontSize: '0.9rem', color: deadCapPct > 10 ? 'var(--red)' : 'var(--ink)' }}>{deadCapPct}%</div>
            </div>
          </div>
          {deadCapLog.length > 0 && (
            <div>
              <div className="stat-label" style={{ marginBottom: 4 }}>Sources</div>
              {deadCapLog.map((d, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--cream-darker)', fontSize: '0.72rem' }}>
                  <span className="font-body">{d.name} <span style={{ color: 'var(--ink-muted)' }}>({d.reason})</span></span>
                  <span className="font-mono" style={{ color: 'var(--red)' }}>${d.amount}M <span style={{ color: 'var(--ink-muted)' }}>S{d.season}</span></span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Season-by-Season History Table */}
      {history.length > 0 && (
        <div className="card" style={{ padding: 14 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.85rem', marginBottom: 6 }}>Season-by-Season Finances</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', fontFamily: 'var(--font-mono, monospace)' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--cream-darker)' }}>
                  {['S', 'W-L', 'Revenue', 'Expenses', 'Profit', 'Cash', 'Fan'].map(h => (
                    <th key={h} style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((h, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--cream-darker)' }}>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>{h.season}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>{h.wins}-{h.losses}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', color: 'var(--green)' }}>${h.revenue}M</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', color: 'var(--red)' }}>${h.expenses}M</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', color: (h.profit || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>${h.profit || 0}M</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>${h.cash || 0}M</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>{h.fanRating || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sparkline summary */}
      {history.length > 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
          {[
            { label: 'Revenue', data: history.map(h => h.revenue || 0), color: '#1A6B3A' },
            { label: 'Profit', data: history.map(h => h.profit || 0), color: '#D4A843' },
            { label: 'Fan Rating', data: history.map(h => h.fanRating || 0), color: '#2A5FA0' },
            { label: 'Win%', data: history.map(h => Math.round((h.winPct || 0) * 100)), color: '#C8202A' },
          ].map(({ label, data, color }) => (
            <div key={label} className="card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="stat-label">{label}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="stat-value" style={{ fontSize: '0.85rem' }}>{data[data.length - 1]}{label === 'Win%' ? '%' : label === 'Fan Rating' ? '' : 'M'}</span>
                <Sparkline data={data} color={color} height={22} />
              </div>
            </div>
          ))}
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
    const newCash = r1((fr.cash || 0) - cost); // Round facility spend before syncing both cash stores.
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
        const canAffordIt = (fr.cash || 0) >= (cost || 999);
        return (
          <div key={key} className="card" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="font-display" style={{ fontSize: '0.8rem', fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>{desc}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', gap: 2 }}>
                {[1, 2, 3].map(l => <div key={l} style={{ width: 18, height: 6, borderRadius: 2, background: current >= l ? 'var(--red)' : 'var(--cream-darker)' }} />)}
              </div>
              {current < 3 && (
                <button
                  className="btn-secondary"
                  style={{ fontSize: '0.7rem', padding: '3px 8px', opacity: canAffordIt ? 1 : 0.4, minHeight: 28 }}
                  disabled={!canAffordIt}
                  onClick={() => upgrade(key)}
                  title={!canAffordIt ? 'Insufficient cash' : `Upgrade for $${cost}M`}
                >
                  ${cost}M
                </button>
              )}
              {current >= 3 && <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>MAX</span>}
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
function LegacyTab({ fr, leagueHistory }) {
  const trophies = Array.isArray(fr?.trophies) ? fr.trophies : [];
  const legends = Array.isArray(fr?.localLegends) ? fr.localLegends : [];
  const records = fr?.franchiseRecords || {};
  const history = Array.isArray(fr?.history) ? fr.history : [];
  const hof = (leagueHistory?.hallOfFame || []).filter(h => h.team === `${fr?.city} ${fr?.name}`);
  const champions = Array.isArray(leagueHistory?.champions) ? leagueHistory.champions : [];
  const notableSeasons = Array.isArray(leagueHistory?.notableSeasons) ? leagueHistory.notableSeasons : [];

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Championship Banners */}
      <div className="card" style={{ padding: 16 }}>
        <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Championship Banners</h3>
        {trophies.length === 0
          ? <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>No championships yet. Keep building.</p>
          : <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {trophies.map((t, i) => (
                <div key={i} style={{ background: 'var(--gold)', color: 'var(--ink)', padding: '10px 16px', borderRadius: 2, textAlign: 'center', minWidth: 80 }}>
                  <div className="font-display" style={{ fontSize: '1rem', fontWeight: 700 }}>S{t.season}</div>
                  <div className="font-mono" style={{ fontSize: '0.7rem' }}>{t.wins}-{t.losses}</div>
                </div>
              ))}
            </div>
        }
      </div>

      {/* Franchise Records */}
      {Object.keys(records).length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Franchise Records</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
            {[
              ['Most Wins', records.mostWinsInSeason?.value, records.mostWinsInSeason?.season],
              ['Best Win%', records.bestWinPct?.value ? `${Math.round(records.bestWinPct.value * 100)}%` : null, records.bestWinPct?.season],
              ['Top Revenue', records.mostRevenue?.value ? `$${records.mostRevenue.value}M` : null, records.mostRevenue?.season],
              ['Peak Value', records.highestValuation?.value ? `$${records.highestValuation.value}M` : null, records.highestValuation?.season],
              ['Championships', records.championships || 0, null],
              ['Playoff Apps', records.playoffAppearances || 0, null],
            ].map(([label, val, s]) => val != null && val !== 0 && (
              <div key={label} style={{ textAlign: 'center', padding: '6px 4px' }}>
                <div className="stat-label">{label}</div>
                <div className="font-display" style={{ fontSize: '0.95rem', fontWeight: 700 }}>{val}</div>
                {s && <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>S{s}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hall of Fame */}
      {hof.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Hall of Fame</h3>
          {hof.map((h, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--cream-darker)', flexWrap: 'wrap', gap: 4 }}>
              <div>
                <div className="font-display" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{h.name}</div>
                <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>
                  {h.position} · Peak {h.peakRating} · {h.seasons}yr · Inducted S{h.inductionSeason}
                </div>
              </div>
              <span className="badge badge-gold" style={{ fontSize: '0.7rem', background: 'var(--gold)', color: 'var(--ink)' }}>HOF</span>
            </div>
          ))}
        </div>
      )}

      {/* Local Legends */}
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

      {/* League Champions History */}
      {champions.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>League Champions</h3>
          {[...champions].reverse().map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--cream-darker)', flexWrap: 'wrap', gap: 4 }}>
              <div>
                <span className="font-mono" style={{ fontSize: '0.7rem', fontWeight: 600 }}>S{c.season}</span>
                <span className="font-body" style={{ fontSize: '0.8rem', marginLeft: 8, fontWeight: c.isPlayerTeam ? 700 : 400, color: c.isPlayerTeam ? 'var(--red)' : 'var(--ink)' }}>
                  {c.city} {c.teamName}
                </span>
              </div>
              <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>{c.record}</span>
            </div>
          ))}
        </div>
      )}

      {/* Notable Seasons */}
      {notableSeasons.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Notable Moments</h3>
          {[...notableSeasons].reverse().slice(0, 10).map((n, i) => (
            <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--cream-darker)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="font-mono" style={{ fontSize: '0.7rem', fontWeight: 600 }}>S{n.season}</span>
                <span className={`badge ${n.isPlayerTeam ? 'badge-red' : 'badge-ink'}`} style={{ fontSize: '0.7rem' }}>{n.type}</span>
              </div>
              <div className="font-body" style={{ fontSize: '0.72rem', color: 'var(--ink-soft)', marginTop: 2 }}>{n.description}</div>
            </div>
          ))}
        </div>
      )}

      {/* Season Timeline */}
      {history.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Season Timeline</h3>
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 8 }}>
            {history.map(h => {
              const wp = (h.wins + h.losses) > 0 ? h.wins / (h.wins + h.losses) : 0;
              const isChamp = trophies.some(t => t.season === h.season);
              return (
                <div key={h.season} style={{ minWidth: 50, textAlign: 'center', padding: '6px 4px', borderRadius: 2, background: isChamp ? 'var(--gold)' : wp > 0.6 ? 'var(--green)' : wp < 0.35 ? 'var(--red)' : 'var(--cream-dark)', color: isChamp || wp > 0.6 || wp < 0.35 ? '#fff' : 'var(--ink)' }}>
                  <div className="font-mono" style={{ fontSize: '0.7rem', fontWeight: 600 }}>S{h.season}</div>
                  <div className="font-mono" style={{ fontSize: '0.7rem' }}>{h.wins}-{h.losses}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {history.length > 1 && (
        <div className="card" style={{ padding: 16 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Cash History</h3>
          <MiniChart data={history.map(h => h.cash || 0)} color="var(--green)" />
        </div>
      )}
    </div>
  );
}

// ============================================================
// HISTORY TAB
// ============================================================
function HistTab({ fr }) {
  const history = Array.isArray(fr?.history) ? fr.history : [];
  return (
    <div className="fade-in">
      <div className="card" style={{ padding: 16 }}>
        <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Season History</h3>
        {history.length === 0
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
                  {[...history].reverse().map(h => (
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
