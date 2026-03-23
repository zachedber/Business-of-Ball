'use client';
import { useReducer, useEffect, useCallback, useRef } from 'react';
import {
  initializeLeague, createPlayerFranchise,
  simulateFullSeasonFirstHalf, simulateFullSeasonSecondHalf,
  generateDraftProspects, generateFreeAgents,
  calculateValuation, clamp, generateId,
  genPressConference, calcStakeIncome,
  maxLoan, takeLoan, repayDebt,
  getGMTier,
  generateNamingRightsOffer, acceptNamingRights,
  generateCBAEvent, generateNewspaper,
  generateNotifications, updateGMReputation,
  signToSlot, releaseSlot,
  getFranchiseAskingPrice, getFranchiseFlavor,
  generateDraftPickPositions,
  generateOffseasonFAPool,
  simulatePlayoffs, simulateAIFreeAgency,
  generateExtensionDemands, applyExtension, checkPressureEvent,
  generateNewStadiumNamingRightsOffer,
  initLeagueHistory, addChampion, checkNotableSeasons,
  initFranchiseRecords, updateFranchiseRecords, evaluateHallOfFame,
  initHeadToHead, updateHeadToHead, initRivalry, updateRivalry,
  initDraftPickInventory,
  formatMoney, generateTVDealEvent, formatLabel, r1,
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
import { gameReducer, initialState } from '@/lib/gameReducer';
import TradeDeadlineScreen from '@/app/components/TradeDeadlineScreen';
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

  const saveTimer = useRef(null);
  useEffect(() => {
    if (!lt || fr.length === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 500);
    return () => clearTimeout(saveTimer.current);
  }, [fr, lt, cash, season, doSave]);

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

  function handleCreate(template, league) {
    const newFr = createPlayerFranchise(template, league);
    const newFrArray = [...fr, newFr];
    const newLt = { ...lt, [league]: lt[league].map(t => t.id === template.id ? { ...t, isPlayerOwned: true } : t) };
    dispatch({ type: 'SET_FRANCHISE', payload: newFrArray });
    dispatch({ type: 'SET_LEAGUE_TEAMS', payload: newLt });
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
    if (player) {
      dispatch({
        type: 'SET_FRANCHISE',
        payload: prev => prev.map((f, i) => {
          if (i !== activeIdx) return f;
          const taxi = [...(f.taxiSquad || [])];
          const draftedPlayer = { ...player, isRookie: true, draftRound: usedPick?.round, draftPick: usedPick?.pick, seasonsOnTaxi: 0 };
          if (taxi.length < 4) {
            // Route to taxi squad (max 4)
            taxi.push(draftedPlayer);
            return { ...f, taxiSquad: taxi };
          }
          // Overflow: taxi squad full, route to players/rookieSlots
          const rookies = [...(f.rookieSlots || [])];
          if (rookies.length < 3) {
            rookies.push(draftedPlayer);
            return { ...f, rookieSlots: rookies };
          }
          return f;
        }),
      });
    }
  }

  function handleDraftDone() {
    const af = fr[activeIdx];

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
    dispatch({ type: 'SLOT_DECISION_CLOSE' });
    dispatch({ type: 'FA_OPEN', payload: { offseasonFAPool: offseasonFAPool, aiSigningsLog: aiSigningsLog } });
  }

  function handleFreeAgencyDone() {
    dispatch({ type: 'FA_CLOSE' });
    dispatch({ type: 'SET_SCREEN', payload: 'dashboard' });
  }

  // ── Simulation handlers ───────────────────────────────────────
  async function handleSim() {
    if (simming) return;
    dispatch({ type: 'BEGIN_SIM' });
    dispatch({ type: 'SET_RECAP', payload: { recap: null, grade: null } });
    dispatch({ type: 'SET_NEWSPAPER', payload: { newspaper: null, newspaperDismissed: true } });
    await new Promise(r => setTimeout(r, 400));
    const result = simulateFullSeasonFirstHalf(lt, fr, season);
    dispatch({ type: 'SET_FRANCHISE', payload: result.franchises });
    dispatch({ type: 'TRADE_DEADLINE_OPEN', payload: result.leagueTeams });
  }

  async function handleContinueSeason() {
    dispatch({ type: 'BEGIN_SIM' });
    dispatch({ type: 'TRADE_DEADLINE_CLOSE' });
    const prevFranchise = fr[activeIdx];
    await new Promise(r => setTimeout(r, 300));

    const result = simulateFullSeasonSecondHalf(tradeDeadlineLeague, fr, season);
    const af = result.franchises[activeIdx];

    // Dispatch simulation results so state reflects simulated season
    dispatch({ type: 'SET_LEAGUE_TEAMS', payload: result.leagueTeams });
    dispatch({ type: 'SET_FRANCHISE', payload: result.franchises });

    // NGL Playoffs — run bracket, show bracket UI before offseason
    if (af && af.league === 'ngl') {
      const pResult = simulatePlayoffs(result.leagueTeams.ngl, af);
      if (pResult.playerWonChampionship) {
        dispatch({
          type: 'SET_FRANCHISE',
          payload: prev => prev.map((f, i) => i === activeIdx ? {
            ...f,
            championships: (f.championships || 0) + 1,
            trophies: [...(f.trophies || []), { season, wins: af.wins, losses: af.losses }],
            leagueRank: 1,
          } : f),
        });
      }
      dispatch({
        type: 'PLAYOFF_OPEN',
        payload: { playoffResult: pResult, tradeDeadlineLeague: result.leagueTeams },
      });
      return; // Bugfix: the trade-deadline pause now exits cleanly into the playoff flow without auto-running the offseason.
    }

    // ABL / fallback path
    await runEndOfSeasonFlow(result, af, prevFranchise);
    dispatch({ type: 'END_SIM' });
    await doSave();
  }

  // Called by PlayoffBracketScreen when all rounds are viewed
  async function handlePlayoffFinished() {
    dispatch({ type: 'PLAYOFF_CLOSE' });
    const playoffChampion = playoffResult?.champion;
    const playoffFranchises = fr.map(f => playoffChampion && f.id === playoffChampion.id && !playoffResult?.playerWonChampionship
      ? { ...f, championships: (f.championships || 0) + 1, trophies: [...(f.trophies || []), { season, wins: playoffChampion.wins, losses: playoffChampion.losses }], leagueRank: 1 }
      : f
    ); // Bugfix: playoff champions now get their title credited even when the user is not the team that won the bracket.
    const playoffLeagueTeams = {
      ...lt,
      ngl: (lt?.ngl || []).map(t => playoffChampion && t.id === playoffChampion.id ? { ...t, leagueRank: 1 } : t),
    }; // Bugfix: the post-playoff flow now uses the settled playoff snapshot instead of stale pre-bracket state.
    const result = {
      leagueTeams: playoffLeagueTeams,
      franchises: playoffFranchises,
      standings: {
        ngl: [...(playoffLeagueTeams?.ngl || [])].sort((a, b) => b.wins - a.wins),
        abl: [...(playoffLeagueTeams?.abl || [])].sort((a, b) => b.wins - a.wins),
      },
      playoffResult,
    };
    const afNow = playoffFranchises[activeIdx];
    await runEndOfSeasonFlow(result, afNow, afNow);
    await doSave();
  }

  async function runEndOfSeasonFlow(result, af, prevFranchise) {
    const newSeason = season + 1;
    dispatch({ type: 'SET_SEASON', payload: newSeason });

    // ── Accumulate all franchise changes locally ───────────────
    // Start from the result franchises (or current fr if called from handlePlayoffFinished)
    let newFr = result.franchises;

    // Stake income — add to active franchise cash
    const stakeIncome = calcStakeIncome(stakes, result.leagueTeams);
    let newCash = af ? r1((af.cash || 0) + stakeIncome) : r1(cash || 0); // Round stake cash before syncing both franchise and top-level cash.
    if (af && stakeIncome !== 0) {
      newFr = newFr.map((f, i) => i === activeIdx ? { ...f, cash: newCash } : f);
    }

    // GM Reputation
    const newRep = af ? updateGMReputation(gmRep, af, prevFranchise) : gmRep;

    // ── League history (synchronous accumulation) ──────────────
    let newLeagueHistory = leagueHistory;
    if (af && result.leagueTeams) {
      const nglStandings = [...(result.leagueTeams.ngl || [])].sort((a, b) => b.wins - a.wins);
      const champion = result.playoffResult?.champion || nglStandings[0]; // Bugfix: league history now records the actual playoff champion instead of the regular-season leader.
      if (champion) {
        const isPlayer = result.franchises.some(pf => pf.id === champion.id);
        newLeagueHistory = addChampion(newLeagueHistory, {
          season, teamName: champion.name, city: champion.city,
          isPlayerTeam: isPlayer, record: `${champion.wins}-${champion.losses}`,
          coachName: isPlayer ? af.coach?.name : null,
          starPlayer: isPlayer ? (af.star1?.name || null) : null,
        });
        newLeagueHistory = checkNotableSeasons(
          newLeagueHistory,
          [...(result.leagueTeams.ngl || []), ...(result.leagueTeams.abl || [])],
          result.franchises, season
        );
      }

      // Franchise records
      const curRecords = af.franchiseRecords || initFranchiseRecords();
      const { records: newRecords } = updateFranchiseRecords(curRecords, af, season);
      newFr = newFr.map((x, i) => i === activeIdx ? { ...x, franchiseRecords: newRecords } : x);

      // Hall of Fame eval for retiring players
      for (const slotKey of ['star1', 'star2', 'corePiece']) {
        const p = af[slotKey];
        if (p && p.age >= 34 && p.rating < 70) {
          const hofCandidate = evaluateHallOfFame(p, af);
          if (hofCandidate) {
            newLeagueHistory = {
              ...newLeagueHistory,
              hallOfFame: [
                ...(newLeagueHistory.hallOfFame || []),
                { ...hofCandidate, inductionSeason: season, team: `${af.city} ${af.name}` },
              ],
            };
          }
        }
      }
    }

    // B3: Rivalry update
    if (af && result.leagueTeams) {
      const leagueTeams = result.leagueTeams[af.league] || [];
      const h2h = af.headToHead || initHeadToHead();
      const curRivalry = af.rivalry || initRivalry();
      const newRivalry = updateRivalry(curRivalry, af, leagueTeams, season, h2h, false);
      newFr = newFr.map((x, i) => i === activeIdx ? { ...x, rivalry: newRivalry } : x);
    }

    // ── Notifications (accumulate all at once) ────────────────
    let allNotifications = [...notifications.filter(n => !['contract', 'cap', 'stadium', 'fans', 'player'].includes(n.type))];
    let newNamingOffer = namingOffer;

    if (af) {
      const newNotifs = generateNotifications(af, prevFranchise);
      // Taxi squad auto-release notifications from endOfSeasonAging
      const afCurrent = newFr[activeIdx];
      if (afCurrent?.taxiNotifications) {
        newNotifs.push(...afCurrent.taxiNotifications);
        newFr = newFr.map((x, i) => i === activeIdx ? { ...x, taxiNotifications: undefined } : x);
      }
      if (stakeIncome > 0.1) {
        newNotifs.push({ id: 'stake_' + Date.now(), severity: 'info', message: `Stake income: +$${Math.round(stakeIncome * 10) / 10}M added to liquid capital.`, type: 'stakes' });
      }
      if (af.finances.profit > 0) {
        newNotifs.push({ id: 'profit_' + Date.now(), severity: 'info', message: `Your franchise turned $${af.finances.profit}M profit, increasing your liquid capital to $${Math.round(newCash * 10) / 10}M.`, type: 'finance' });
      } else if (af.finances.profit < 0) {
        newNotifs.push({ id: 'loss_' + Date.now(), severity: 'warning', message: `Season loss of $${Math.abs(af.finances.profit)}M drained liquid capital to $${Math.round(newCash * 10) / 10}M.`, type: 'finance' });
      }
      // A1: Stadium project events
      if (af.pendingStadiumEvent) {
        const sevt = af.pendingStadiumEvent;
        newNotifs.push({ id: 'stad_' + Date.now(), severity: sevt.type === 'stadium_complete' ? 'success' : 'info', message: `${sevt.headline}: ${sevt.desc}`, type: 'stadium' });
        if (sevt.newNamingOffer) {
          newNamingOffer = generateNewStadiumNamingRightsOffer(af);
        }
        newFr = newFr.map((x, i) => i === activeIdx ? { ...x, pendingStadiumEvent: null } : x);
      }
      allNotifications = [...allNotifications, ...newNotifs];
    }

    // ── Async: narratives ─────────────────────────────────────
    let rc = null, gr = null, dynastyEra = null;
    if (result.franchises.length > 0) {
      const f = af || result.franchises[activeIdx];
      [rc, gr] = await Promise.all([generateSeasonRecap(f), generateGMGrade(f)]);

      if (season % 3 === 0) {
        dynastyEra = await generateDynastyNarrative(f);
        newFr = newFr.map((x, i) => i === activeIdx ? { ...x, dynastyEra: dynastyEra.era } : x);
      }

      const leagueStandings = f.league === 'ngl' ? result.standings?.ngl : result.standings?.abl;
      const generatedNewspaper = generateNewspaper(leagueStandings, result.franchises, season, result.leagueTeams);
      const newPressConf = genPressConference(f);
      const newCbaEvent = generateCBAEvent(season);
      if (!f.namingRightsActive && f.fanRating >= 55 && Math.random() < 0.3) {
        newNamingOffer = generateNamingRightsOffer(f);
      } else if (!af?.pendingStadiumEvent?.newNamingOffer) {
        newNamingOffer = null;
      }

      // B5: TV deal event (every 8 seasons)
      const tvDeal = generateTVDealEvent(season);
      if (tvDeal) {
        newFr = newFr.map((x, i) => i === activeIdx ? {
          ...x, capModifier: (x.capModifier || 0) + tvDeal.capModifier,
        } : x);
        allNotifications = [...allNotifications, {
          id: 'tv_deal_' + season,
          severity: 'info',
          message: `${tvDeal.title}: ${tvDeal.description}`,
          type: 'league',
        }];
      }

      // Phase 3: rival stake fan penalty
      if (stakes.length > 0 && f.rivalIds?.length > 0) {
        const rivalStakeCount = stakes.filter(s => f.rivalIds.includes(s.teamId)).length;
        if (rivalStakeCount > 0) {
          newFr = newFr.map((x, i) => i === activeIdx
            ? { ...x, fanRating: clamp(x.fanRating - rivalStakeCount * 2, 0, 100) }
            : x
          );
        }
      }

      // Offseason events + extension demands + pressure
      const offseasonEvents = await generateOffseasonEvents(f);
      const extDemands = generateExtensionDemands(f, gmRep);

      const games = f.league === 'ngl' ? 17 : 82;
      const winPct = f.wins / Math.max(1, games);
      const isLosing = winPct < 0.400;
      const prevConsecutive = f.consecutiveLosingSeason || 0;
      const newConsecutive = isLosing ? prevConsecutive + 1 : 0;
      newFr = newFr.map((x, i) => i === activeIdx ? { ...x, consecutiveLosingSeason: newConsecutive } : x);
      const pressureEvt = checkPressureEvent({ ...f, consecutiveLosingSeason: prevConsecutive }, season);

      const allEvents = [
        ...offseasonEvents.map(e => ({ ...e, resolved: false })),
        ...extDemands,
        ...(pressureEvt ? [{ ...pressureEvt, resolved: false }] : []),
      ];

      // B4: Refresh draft pick inventory for next season
      newFr = newFr.map((x, i) => i === activeIdx ? {
        ...x, gmInvestments: {}, stadiumUnderConstruction: false, pendingStadiumEvent: null, // Bugfix: per-season stadium/investment flags now reset before the next season begins.
        draftPickInventory: initDraftPickInventory(newSeason, x.id),
      } : x);

      // Draft flow setup
      const picks = generateDraftPickPositions(f, result.leagueTeams);
      const prospects = generateDraftProspects(f.league, 20, f.scoutingStaff, picks[0]?.round || 1);

      // ── Dispatch all accumulated changes ─────────────────────
      dispatch({ type: 'SET_GM_REP', payload: newRep });
      dispatch({ type: 'SET_LEAGUE_HISTORY', payload: newLeagueHistory });
      dispatch({ type: 'SET_FRANCHISE', payload: newFr }); // also auto-syncs cash
      dispatch({ type: 'SET_CASH', payload: newCash });     // ensure cash is correct
      dispatch({ type: 'SET_NOTIFICATIONS', payload: allNotifications });
      dispatch({ type: 'SET_RECAP', payload: { recap: rc, grade: gr } });
      dispatch({ type: 'SET_NEWSPAPER', payload: { newspaper: generatedNewspaper, newspaperDismissed: false } });
      dispatch({ type: 'SET_PRESS_CONF', payload: newPressConf });
      dispatch({ type: 'SET_CBA', payload: newCbaEvent });
      dispatch({ type: 'SET_NAMING', payload: newNamingOffer });
      if (dynastyEra) {
        dispatch({ type: 'SET_DYNASTY', payload: [...dynasty, { ...dynastyEra, season }] });
      }
      dispatch({ type: 'SET_EVENTS', payload: allEvents });
      dispatch({ type: 'SET_FREE_AG', payload: { ngl: generateFreeAgents('ngl'), abl: generateFreeAgents('abl') } });
      dispatch({ type: 'DRAFT_OPEN', payload: { draftPicks: picks, draftProspects: prospects } });
    } else {
      // No franchises — still dispatch the basic updates
      dispatch({ type: 'SET_GM_REP', payload: newRep });
      dispatch({ type: 'SET_LEAGUE_HISTORY', payload: newLeagueHistory });
      dispatch({ type: 'SET_FRANCHISE', payload: newFr });
      dispatch({ type: 'SET_CASH', payload: newCash });
      dispatch({ type: 'SET_NOTIFICATIONS', payload: allNotifications });
      dispatch({ type: 'SET_FREE_AG', payload: { ngl: generateFreeAgents('ngl'), abl: generateFreeAgents('abl') } });
    }
  }

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
      />

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

        {/* Trade deadline overrides the dashboard screen */}
        {tradeDeadlineActive && !playoffActive && af && (
          <TradeDeadlineScreen
            fr={af}
            setFr={setActiveFr}
            onContinue={handleContinueSeason}
            cash={af.cash ?? cash}
            setCash={newCash => dispatch({ type: 'SET_CASH', payload: newCash })}
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
