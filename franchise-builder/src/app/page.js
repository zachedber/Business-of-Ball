'use client';
import { useReducer, useEffect, useCallback, useRef } from 'react';
import { useSimulation } from '@/app/hooks/useSimulation';
import {
  initializeLeague,
  createPlayerFranchise,
  generateFreeAgents,
  applyExtension,
  acceptNamingRights,
  clamp,
  r1,
} from '@/lib/engine';
import { generateTradeOffers, generateWaiverWire, generateDraftTradeUpOffers } from '@/lib/tradeAI';
import { saveGame, loadGame, deleteSave } from '@/lib/storage';
import {
  generateOffseasonEvents, setNarrativeApiKey,
} from '@/lib/narrative';
import { gameReducer, initialState } from '@/lib/gameReducer';
import { draftPlayer } from '@/lib/engine/roster';
import TradeDeadlineScreen from '@/app/components/TradeDeadlineScreen';
import TrainingCampScreen from '@/app/components/TrainingCampScreen';
import EventNotificationCard from '@/app/components/EventNotificationCard';
import AnalyticsScreen from '@/app/components/AnalyticsScreen';
import HelpPanel from '@/app/components/HelpPanel';
import { Ticker, Nav } from '@/app/components/SharedComponents';
import Intro from '@/app/screens/IntroScreen';
import FranchiseSelectionScreen from '@/app/screens/FranchiseSelectionScreen';
import Dashboard from '@/app/screens/DashboardScreen';
import DraftFlowScreen from '@/app/screens/DraftFlowScreen';
import FreeAgencyFlowScreen from '@/app/screens/FreeAgencyScreen';
import SlotDecisionScreen from '@/app/screens/SlotDecisionScreen';
import PlayoffBracketScreen from '@/app/screens/PlayoffScreen';
import LeagueScreen from '@/app/screens/LeagueScreen';
import MarketScreen from '@/app/screens/MarketScreen';
import PortfolioScreen from '@/app/screens/PortfolioScreen';
import EmpireFinanceScreen from '@/app/screens/FinanceScreen';
import Settings from '@/app/screens/SettingsScreen';

// ============================================================
// MAIN APP — state management and routing
// ============================================================
export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  const {
    screen, loading,
    cash, gmRep, dynasty,
    lt, fr, stakes, season, freeAg, activeIdx,
    simming,
    tradeDeadlineActive, tradeDeadlineLeague,
    playoffActive, playoffResult, aiSigningsLog,
    draftActive, draftPicks, draftProspects, draftDone,
    freeAgencyActive, offseasonFAPool, slotDecisionActive,
    notifications, recap, grade, events, pressConf,
    newspaper, newspaperDismissed,
    cbaEvent, namingOffer, saveStatus, helpOpen, leagueHistory,
    rosterFullAlert,
    trainingCampActive, quarterPhase, q1PauseActive, q3PauseActive, playerEvents,
    waiverWireActive, waiverPool, tradeOffers,
    gameOverForced,
  } = state;

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
        dispatch({ type: 'LOAD_SAVE', payload: saved });
      } else {
        dispatch({ type: 'FINISH_LOADING' });
      }
    })();
  }, []);

  // Auto-save
  const doSave = useCallback(async () => {
    if (!lt || fr.length === 0) return;
    dispatch({ type: 'SET_SAVE_STATUS', payload: 'saving' });
    await saveGame({ cash, gmReputation: gmRep, dynastyHistory: dynasty, leagueTeams: lt, franchises: fr, stakes, season, freeAgents: freeAg, notifications, leagueHistory });
    dispatch({ type: 'SET_SAVE_STATUS', payload: 'saved' });
  }, [cash, gmRep, dynasty, lt, fr, stakes, season, freeAg, notifications, leagueHistory]);

  const prevFranchiseRef = useRef(null);
  const frRef = useRef(fr);
  frRef.current = fr;
  const ltRef = useRef(lt);
  ltRef.current = lt;
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!lt || fr.length === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 500);
    return () => clearTimeout(saveTimer.current);
  }, [fr, lt, cash, season, doSave]);

  // Emergency save on tab close — synchronous localStorage write
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!lt || fr.length === 0) return;
      try {
        localStorage.setItem('bob_v3_save', JSON.stringify({
          cash, gmReputation: gmRep, dynastyHistory: dynasty,
          leagueTeams: lt, franchises: fr, stakes, season,
          freeAgents: freeAg, notifications, leagueHistory,
          updatedAt: new Date().toISOString(), version: '3.0.0',
        }));
      } catch (e) { console.error('Emergency save failed:', e); }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [cash, gmRep, dynasty, lt, fr, stakes, season, freeAg, notifications, leagueHistory]);

  // ── Helpers ──────────────────────────────────────────────────
  const setActiveFr = (updater) =>
    dispatch({
      type: 'SET_FRANCHISE',
      payload: prev => prev.map((f, i) => i === activeIdx ? (typeof updater === 'function' ? updater(f) : updater) : f),
    });


  // ── Game setup handlers ───────────────────────────────────────
  function handleNew() {
    const league = initializeLeague();
    dispatch({ type: 'RESET' });
    dispatch({ type: 'SET_LEAGUE_TEAMS', payload: league });
    dispatch({
      type: 'SET_FREE_AG',
      payload: { ngl: generateFreeAgents('ngl'), abl: generateFreeAgents('abl') },
    });
    dispatch({ type: 'SET_SCREEN', payload: 'setup' });
  }

  function handleLoad() {
    if (fr.length > 0 && lt) dispatch({ type: 'SET_SCREEN', payload: 'dashboard' });
  }

  async function handleCreate(template, league, leverageOptions) {
    let newFr = createPlayerFranchise(template, league);

    // Apply leveraged purchase if selected
    if (leverageOptions?.leveraged) {
      newFr = {
        ...newFr,
        debt: leverageOptions.loanAmount,
        debtObject: {
          principal: leverageOptions.loanAmount,
          interestRate: leverageOptions.interestRate,
          termSeasons: leverageOptions.termSeasons,
          seasonalPayment: leverageOptions.seasonalPayment,
          gmRep: 50,
          consecutiveMissedPayments: 0,
        },
      };
    }

    const newFrArray = [...fr, newFr];
    const newLt = { ...lt, [league]: lt[league].map(t => t.id === template.id ? { ...t, isPlayerOwned: true } : t) };
    const initialEvents = await generateOffseasonEvents(newFr);
    dispatch({
      type: 'CREATE_FRANCHISE',
      payload: {
        lt: newLt,
        frArray: newFrArray,
        cash: newFr.cash || 0,
        events: initialEvents.map(e => ({ ...e, resolved: false })),
        freeAg: freeAg,
      },
    });
    dispatch({ type: 'SET_SCREEN', payload: 'dashboard' });
  }

  // ── Event handlers ───────────────────────────────────────────
  function handleResolve(eventId, choiceIdx) {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    const choice = event.choices[choiceIdx];

    // Compute franchise update
    dispatch({
      type: 'SET_FRANCHISE',
      payload: prev => prev.map((f, i) => {
        if (i !== activeIdx) return f;

        // Extension demand events
        if (event.type === 'extension_demand') {
          if (choice.action === 'sign') {
            return applyExtension(f, event.slotKey, event.extSalary, event.extYears);
          } else if (choice.action === 'release') {
            const updated = { ...f, [event.slotKey]: null };
            updated.players = [updated.star1, updated.star2, updated.corePiece].filter(Boolean);
            updated.totalSalary = r1(updated.players.reduce((s, p) => s + p.salary, 0));
            return updated;
          }
          // play_out: no change
          return f;
        }

        // Pressure events
        if (event.type === 'pressure') {
          let updated = { ...f };
          if (event.fanRatingDelta) updated.fanRating = clamp(updated.fanRating + event.fanRatingDelta, 0, 100);
          if (event.sponsorPenalty) updated.sponsorLevel = Math.max(0, (updated.sponsorLevel || 1) * event.sponsorPenalty);
          if (choice.action === 'fine') updated.cash = r1((updated.cash || 0) - (choice.cost || 10)); // Round event cash updates before they hit shared state.
          if (choice.action === 'audit') {
            const slots = ['corePiece'];
            for (const slot of slots) {
              if (updated[slot]) { updated = { ...updated, [slot]: null }; break; }
            }
            updated.players = [updated.star1, updated.star2, updated.corePiece].filter(Boolean);
            updated.totalSalary = r1(updated.players.reduce((s, p) => s + p.salary, 0));
          }
          return updated;
        }

        // Default: standard event handling
        const updated = { ...f };
        if (choice.cost) updated.cash = r1((updated.cash || 0) - choice.cost); // Round event cash updates before they hit shared state.
        if (choice.revenue) updated.cash = r1((updated.cash || 0) + choice.revenue); // Round event cash updates before they hit shared state.
        if (choice.communityBonus) updated.communityRating = clamp((updated.communityRating || 50) + choice.communityBonus, 0, 100);
        if (choice.mediaBonus) updated.mediaRep = clamp((updated.mediaRep || 50) + choice.mediaBonus, 0, 100);
        if (choice.stadiumBonus) updated.stadiumCondition = clamp(updated.stadiumCondition + choice.stadiumBonus, 0, 100);
        if (choice.coachBonus && updated.coach.level < 4) updated.coach = { ...updated.coach, level: updated.coach.level + 1 };
        return updated;
      }),
    });

    // GM rep side-effect for pressure events
    if (event.type === 'pressure' && event.gmRepDelta) {
      dispatch({ type: 'SET_GM_REP', payload: clamp(gmRep + event.gmRepDelta, 0, 100) });
    }

    // Mark event resolved
    dispatch({
      type: 'SET_EVENTS',
      payload: events.map(e => e.id === eventId ? { ...e, resolved: true } : e),
    });
  }

  function handlePressConf(pcId, optionIdx) {
    const pc = (pressConf || []).find(x => x.id === pcId);
    if (pc) {
      const option = pc.options[optionIdx];
      dispatch({
        type: 'SET_FRANCHISE',
        payload: prev => prev.map((f, i) => {
          if (i !== activeIdx) return f;
          const updated = { ...f };
          if (option.fanBonus) updated.fanRating = clamp(updated.fanRating + option.fanBonus, 0, 100);
          if (option.mediaBonus) updated.mediaRep = clamp((updated.mediaRep || 50) + option.mediaBonus, 0, 100);
          if (option.communityBonus) updated.communityRating = clamp((updated.communityRating || 50) + option.communityBonus, 0, 100);
          if (option.moraleBonus) updated.players = (updated.players || []).map(p => ({ ...p, morale: clamp(p.morale + option.moraleBonus, 0, 100) }));
          return updated;
        }),
      });
    }
    dispatch({ type: 'SET_PRESS_CONF', payload: (pressConf || []).filter(x => x.id !== pcId) });
  }

  function handleCBA(choiceIdx) {
    if (!cbaEvent?.choices?.[choiceIdx]) return;
    const choice = cbaEvent.choices[choiceIdx];
    if (choice.strikeRisk && Math.random() < choice.strikeRisk) {
      dispatch({ type: 'SET_RECAP', payload: { recap: (recap || '') + ' A labour strike shortened the season, devastating gate revenue.', grade } });
    }
    dispatch({
      type: 'SET_FRANCHISE',
      payload: prev => prev.map((f, i) => {
        if (i !== activeIdx) return f;
        const updated = { ...f };
        if (choice.moraleBonus) updated.players = (updated.players || []).map(p => ({ ...p, morale: clamp(p.morale + choice.moraleBonus, 0, 100) }));
        if (choice.revenuePenalty) updated.cash = r1((updated.cash || 0) + (choice.revenuePenalty || 0)); // Round event cash updates before they hit shared state.
        return updated;
      }),
    });
    dispatch({ type: 'SET_CBA', payload: null });
  }

  function handleNaming(accept) {
    if (accept && namingOffer) {
      dispatch({
        type: 'SET_FRANCHISE',
        payload: prev => prev.map((f, i) => i === activeIdx ? acceptNamingRights(f, namingOffer) : f),
      });
    }
    dispatch({ type: 'SET_NAMING', payload: null });
  }

  async function handleDelete() {
    await deleteSave();
    dispatch({ type: 'RESET' });
  }

  // ── Draft handlers ───────────────────────────────────────────
  function handleDraftPickMade(player, usedPick) {
    if (!player) return;
    // NOTE: Do NOT dispatch SET_DRAFT_PROSPECTS here — DraftFlowScreen already
    // removes the prospect locally in handlePick via setAvailableProspects.
    // Dispatching here would update the draftProspects prop, triggering the
    // useEffect in DraftFlowScreen that resets all local state (reset loop).
    dispatch({
      type: 'SET_FRANCHISE',
      payload: prev => {
        try {
          return prev.map((f, i) => {
            if (i !== activeIdx) return f;
            // Null guard: ensure franchise has required fields
            if (!f || typeof f !== 'object') return f;
            const updated = {
              ...f,
              rookieSlots: f.rookieSlots || [],
              taxiSquad: f.taxiSquad || [],
              players: f.players || [],
            };
            const validPlayer = draftPlayer(player, f.league);
            const draftedPlayer = { ...validPlayer, isRookie: true, draftRound: usedPick?.round, draftPick: usedPick?.pickPos ?? usedPick?.pick, seasonsOnTaxi: 0 };
            const taxi = [...updated.taxiSquad];
            if (taxi.length < 4) {
              // Route to taxi squad (max 4)
              taxi.push(draftedPlayer);
              return { ...updated, taxiSquad: taxi };
            }
            // Overflow: taxi squad full, route to rookieSlots
            const rookies = [...updated.rookieSlots];
            if (rookies.length < 3) {
              rookies.push(draftedPlayer);
              return { ...updated, rookieSlots: rookies };
            }
            // All slots full — signal roster full alert instead of silently discarding
            setTimeout(() => dispatch({ type: 'SET_ROSTER_FULL_ALERT', payload: draftedPlayer }), 0);
            return updated;
          });
        } catch (e) {
          console.error('handleDraftPickMade error:', e);
          return prev;
        }
      },
    });
  }

  function handleDraftDone() {
    const af = fr[activeIdx];
    if (!af) {
      console.error('handleDraftDone: no active franchise');
      dispatch({ type: 'DRAFT_CLOSE' });
      dispatch({ type: 'SET_SCREEN', payload: 'dashboard' });
      return;
    }

    // FA pool lock (1.2): only generate once per offseason; reuse if already populated
    let playerPool, aiSigned;
    if (offseasonFAPool && offseasonFAPool.length > 0) {
      playerPool = offseasonFAPool;
      aiSigned = aiSigningsLog || [];
    } else {
      const fullPool = generateOffseasonFAPool(af.league, gmRep, 18);
      const result = simulateAIFreeAgency(fullPool, lt || { ngl: [], abl: [] }, af.league);
      playerPool = result.remaining;
      aiSigned = result.signed;
    }

    // Slot decision (1.5): show if any slot is vacant and depth/taxi candidates exist
    const hasCandidates = (af.taxiSquad || []).length > 0 || (af.rookieSlots || []).length > 0 || af.players.length > 0;
    const needsSlotDecision = (!af.star1 || !af.star2 || !af.corePiece) && hasCandidates;
    if (needsSlotDecision) {
      dispatch({ type: 'SLOT_DECISION_OPEN', payload: { offseasonFAPool: playerPool, aiSigningsLog: aiSigned } });
    } else {
      dispatch({ type: 'DRAFT_CLOSE' });
      dispatch({ type: 'FA_OPEN', payload: { offseasonFAPool: playerPool, aiSigningsLog: aiSigned } });
    }
  }

  function handleSlotDecisionDone() {
    dispatch({ type: 'FA_OPEN', payload: { offseasonFAPool: offseasonFAPool, aiSigningsLog: aiSigningsLog } });
  }

  function handleFreeAgencyDone() {
    dispatch({ type: 'FA_CLOSE' });
    dispatch({ type: 'SET_QUARTER_PHASE', payload: 0 });
    dispatch({ type: 'SET_SCREEN', payload: 'dashboard' });
  }

  const simulation = useSimulation({
    state,
    dispatch,
    doSave,
    refs: { prevFranchiseRef, frRef, ltRef },
  });
  const {
    handleSim,
    handleTrainingCampDone,
    handleStartQ2,
    handleContinueSeason,
    handleStartQ4,
    handlePlayoffFinished,
  } = simulation;

  // ── Render ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-panel">
          <div className="spinner" style={{ width: 36, height: 36 }} />
          <span className="font-display" style={{ color: 'var(--ink)', letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: '0.95rem' }}>Preparing the Front Office</span>
          <span className="font-mono" style={{ color: 'var(--ink-muted)', fontSize: '0.72rem' }}>Loading schedules, finances, and historical records...</span>
        </div>
      </div>
    );
  }

  const af = fr[activeIdx];
  const notifCount = notifications.length;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Ticker lt={lt} fr={fr} season={season} />
      <Nav
        screen={screen}
        setScreen={s => dispatch({ type: 'SET_SCREEN', payload: s })}
        fr={fr}
        gmRep={gmRep}
        cash={af?.cash ?? cash}
        notifCount={notifCount}
        quarterPhase={quarterPhase}
        activeFranchise={af}
      />

      {/* Game Over — Forced Sale overlay */}
      {gameOverForced && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#1a1a1a', border: '2px solid var(--red)',
            borderRadius: 8, padding: '40px 32px', maxWidth: 500,
            textAlign: 'center',
          }}>
            <div className="font-display" style={{
              fontSize: '2rem', fontWeight: 700, color: 'var(--red)',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12,
            }}>
              Forced Sale
            </div>
            <p className="font-body" style={{
              fontSize: '0.9rem', color: '#ccc', lineHeight: 1.6, marginBottom: 24,
            }}>
              Your creditors have seized control of the franchise due to catastrophic insolvency.
            </p>
            <button
              className="btn-secondary"
              style={{ padding: '10px 28px', fontSize: '0.85rem', color: '#fff', borderColor: '#666' }}
              onClick={handleNew}
            >
              Start Over
            </button>
          </div>
        </div>
      )}

      <main style={{ flex: 1, paddingBottom: 30 }}>
        {screen === 'intro' && <Intro onNew={handleNew} onLoad={handleLoad} hasSv={fr.length > 0} />}
        {screen === 'setup' && <FranchiseSelectionScreen onCreate={handleCreate} />}

        {/* Training camp — shown before Q1 */}
        {trainingCampActive && af && (
          <TrainingCampScreen
            franchise={af}
            onSelectFocus={(allocation) => handleTrainingCampDone(allocation)}
          />
        )}

        {/* Player events — shown after Q1 and Q3 */}
        {playerEvents && playerEvents.length > 0 && !trainingCampActive && !tradeDeadlineActive && !waiverWireActive && (
          <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 12px' }}>
            <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Player Events</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {playerEvents.map((evt, i) => (
                <EventNotificationCard
                  key={i}
                  type={evt.type === 'social_media_drama' ? 'drama' : evt.type}
                  playerName={evt.playerName}
                  description={evt.description}
                />
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button
                className="btn-secondary"
                style={{ padding: '8px 24px', fontSize: '0.8rem' }}
                onClick={() => dispatch({ type: 'SET_PLAYER_EVENTS', payload: [] })}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

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
            rosterFullAlert={rosterFullAlert}
            onDismissRosterAlert={() => dispatch({ type: 'SET_ROSTER_FULL_ALERT', payload: null })}
            tradeUpOffers={tradeOffers}
            onAcceptTradeUp={(offer, currentPick, incomingPick) => {
              // Add cash component
              if (offer.cashComponent) {
                const newCash = cash + (offer.cashComponent || 0);
                dispatch({ type: 'SET_CASH', payload: newCash });
              }
              // Swap out the currently-traded draft pick with the incoming pick
              if (currentPick && incomingPick) {
                dispatch({
                  type: 'SET_DRAFT_PICKS',
                  payload: draftPicks.map((p) => {
                    if (p.id === currentPick.id) {
                      return { ...incomingPick, pick: incomingPick.pickPos ?? incomingPick.pick };
                    }
                    return p;
                  }),
                });
              }
              // Add draft compensation picks to franchise inventory
              if (offer.draftCompensation?.length > 0) {
                dispatch({
                  type: 'SET_FRANCHISE',
                  payload: prev => prev.map((f, i) => i === activeIdx ? {
                    ...f,
                    draftPickInventory: [...(f.draftPickInventory || []), ...offer.draftCompensation],
                  } : f),
                });
              }
              // Remove offer from list
              dispatch({ type: 'SET_TRADE_OFFERS', payload: tradeOffers.filter(o => o.id !== offer.id) });
            }}
          />
        )}

        {/* Slot decision flow — shown between draft and FA when slots are vacant */}
        {slotDecisionActive && !draftActive && !freeAgencyActive && af && (
          <SlotDecisionScreen
            fr={af}
            setFr={setActiveFr}
            onDone={handleSlotDecisionDone}
          />
        )}

        {/* Free agency flow — shown after draft (and slot decisions if any) */}
        {freeAgencyActive && !draftActive && !slotDecisionActive && af && (
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

        {/* Q1 Pause — shown after Q1 simulation, before Q2 */}
        {q1PauseActive && af && !trainingCampActive && (
          <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 12px' }} className="fade-in">
            <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <h3 className="font-display section-header" style={{ fontSize: '1rem', marginBottom: 8 }}>End of Q1</h3>
              <div className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: 4 }}>
                Record: {af.quarterWins ?? af.wins ?? 0}–{af.quarterLosses ?? af.losses ?? 0}
              </div>
              <p className="font-body" style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginBottom: 16 }}>
                Review your roster and player events before continuing to Q2.
              </p>
              <button className="btn-gold" style={{ padding: '12px 32px' }} onClick={handleStartQ2}>
                Start Q2
              </button>
            </div>
          </div>
        )}

        {/* Q3 Pause — shown after Q3 simulation, before Q4 */}
        {q3PauseActive && af && !tradeDeadlineActive && (
          <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 12px' }} className="fade-in">
            <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <h3 className="font-display section-header" style={{ fontSize: '1rem', marginBottom: 8 }}>End of Q3</h3>
              <div className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: 4 }}>
                Record: {af.quarterWins ?? af.wins ?? 0}–{af.quarterLosses ?? af.losses ?? 0}
              </div>
              <p className="font-body" style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginBottom: 16 }}>
                Final stretch — review your roster before the season finale.
              </p>
              <button className="btn-gold" style={{ padding: '12px 32px' }} onClick={handleStartQ4}>
                Start Q4
              </button>
            </div>
          </div>
        )}

        {/* Trade deadline overrides the dashboard screen */}
        {tradeDeadlineActive && !playoffActive && af && (
          <TradeDeadlineScreen
            fr={af}
            setFr={setActiveFr}
            onContinue={handleContinueSeason}
            cash={af.cash ?? cash}
            setCash={newCash => dispatch({ type: 'SET_CASH', payload: newCash })}
            tradeOffers={tradeOffers}
            onDeclineTrade={(offerId) => {
              dispatch({ type: 'SET_TRADE_OFFERS', payload: tradeOffers.filter(o => o.id !== offerId) });
            }}
            onAcceptTrade={(offer) => {
              setActiveFr(prev => {
                let updated = { ...prev };

                // Handle Buy Offers (AI wants your player)
                if (offer.type === 'buy' && offer.playerWanted) {
                  if (updated.star1?.id === offer.playerWanted.id) updated.star1 = null;
                  else if (updated.star2?.id === offer.playerWanted.id) updated.star2 = null;
                  else if (updated.corePiece?.id === offer.playerWanted.id) updated.corePiece = null;

                  // Handle salary retention dead cap
                  if (offer.salaryRetention > 0) {
                    const retainedAmount = r1(offer.playerWanted.salary * 0.5);
                    updated.deferredDeadCap = (updated.deferredDeadCap || 0) + retainedAmount;
                  }
                }

                // Handle Sell Offers (AI offers you a player)
                if (offer.type === 'sell' && offer.playerOffered) {
                  const emptySlot = !updated.star1 ? 'star1' : !updated.star2 ? 'star2' : !updated.corePiece ? 'corePiece' : null;
                  if (emptySlot) updated[emptySlot] = offer.playerOffered;
                }

                // Add draft picks to inventory
                if (offer.draftCompensation?.length > 0) {
                  updated.draftPickInventory = [...(updated.draftPickInventory || []), ...offer.draftCompensation];
                }

                // Update derived roster stats
                updated.players = [updated.star1, updated.star2, updated.corePiece].filter(Boolean);
                updated.totalSalary = r1(updated.players.reduce((s, p) => s + p.salary, 0));
                return updated;
              });

              // Handle Cash Component — use current cash from state, not stale af snapshot
              if (offer.cashComponent && offer.cashComponent !== 0) {
                const currentCash = fr[activeIdx]?.cash ?? cash;
                dispatch({ type: 'SET_CASH', payload: r1(currentCash + offer.cashComponent) });
              }
              dispatch({ type: 'SET_TRADE_OFFERS', payload: tradeOffers.filter(o => o.id !== offer.id) });
            }}
            waiverPool={waiverPool}
            onSignWaiver={(player) => {
              // Sign waiver player to first empty slot
              const slotKey = !af.star1 ? 'star1' : !af.star2 ? 'star2' : !af.corePiece ? 'corePiece' : null;
              if (!slotKey) return;
              setActiveFr(prev => {
                const updated = { ...prev, [slotKey]: player };
                updated.players = [updated.star1, updated.star2, updated.corePiece].filter(Boolean);
                updated.totalSalary = r1(updated.players.reduce((s, p) => s + p.salary, 0));
                return updated;
              });
              dispatch({ type: 'WAIVER_WIRE_OPEN', payload: waiverPool.filter(p => p.id !== player.id) });
            }}
          />
        )}

        {screen === 'dashboard' && af && !tradeDeadlineActive && !draftActive && !slotDecisionActive && !freeAgencyActive && !playoffActive && (
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
            onDismissNewspaper={() => dispatch({ type: 'SET_NEWSPAPER', payload: { newspaper, newspaperDismissed: true } })}
            cbaEvent={cbaEvent}
            onCBA={handleCBA}
            namingOffer={namingOffer}
            onNaming={handleNaming}
            gmRep={gmRep}
            notifications={notifications}
            onDismissNotif={id => dispatch({ type: 'DISMISS_NOTIF', payload: id })}
            onCashChange={newCash => dispatch({ type: 'SET_CASH', payload: newCash })}
            leagueHistory={leagueHistory}
            offseasonFAPool={offseasonFAPool}
            quarterPhase={quarterPhase}
          />
        )}

        {screen === 'league' && <LeagueScreen lt={lt} fr={fr} />}

        {screen === 'market' && (
          <MarketScreen
            lt={lt}
            cash={af?.cash ?? cash}
            stakes={stakes}
            season={season}
            setStakes={newStakes => dispatch({ type: 'SET_STAKES', payload: newStakes })}
            setCash={newCash => {
              const val = typeof newCash === 'function' ? newCash(cash) : newCash;
              dispatch({ type: 'SET_CASH', payload: val });
            }}
            playerLeague={af?.league}
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
            setScreen={s => dispatch({ type: 'SET_SCREEN', payload: s })}
          />
        )}

        {screen === 'finances' && af && (
          <EmpireFinanceScreen
            af={af}
            fr={fr}
            stakes={stakes}
            lt={lt}
            season={season}
            onPayOffDebt={(amount) => {
              setActiveFr(prev => {
                if ((prev.cash || 0) < amount) return prev;
                return {
                  ...prev,
                  cash: r1((prev.cash || 0) - amount),
                  debt: 0,
                  debtObject: null,
                };
              });
            }}
          />
        )}

        {screen === 'settings' && (
          <Settings
            onDelete={handleDelete}
            setScreen={s => dispatch({ type: 'SET_SCREEN', payload: s })}
          />
        )}

        {screen === 'analytics' && af && (
          <AnalyticsScreen fr={af} lt={lt} stakes={stakes} season={season} />
        )}
      </main>

      {/* Help Panel */}
      <HelpPanel open={helpOpen} onClose={() => dispatch({ type: 'SET_HELP', payload: false })} />

      {/* Floating help button */}
      {fr.length > 0 && !helpOpen && (
        <button
          onClick={() => dispatch({ type: 'SET_HELP', payload: true })}
          style={{
            position: 'fixed', bottom: 48, right: 12, width: 36, height: 36,
            borderRadius: '50%', background: 'var(--ink)', color: 'var(--cream)',
            border: 'none', fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)', zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Help & Reference"
        >
          ?
        </button>
      )}

      {/* Save indicator */}
      <div className="save-indicator" data-state={saveStatus}>
        {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
      </div>
    </div>
  );
}
