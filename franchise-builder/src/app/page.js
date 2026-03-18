'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
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
  formatMoney, generateTVDealEvent, formatLabel,
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
import AnalyticsScreen from '@/app/components/AnalyticsScreen';
import HelpPanel from '@/app/components/HelpPanel';
import { Ticker, Nav } from '@/app/components/SharedComponents';
import Intro from '@/app/screens/IntroScreen';
import FranchiseSelectionScreen from '@/app/screens/FranchiseSelectionScreen';
import Dashboard from '@/app/screens/DashboardScreen';
import DraftFlowScreen from '@/app/screens/DraftFlowScreen';
import FreeAgencyFlowScreen from '@/app/screens/FreeAgencyScreen';
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
  const [helpOpen, setHelpOpen] = useState(false);
  const [leagueHistory, setLeagueHistory] = useState(() => initLeagueHistory());

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
        if (saved.leagueHistory) setLeagueHistory(saved.leagueHistory);
      }
      setLoading(false);
    })();
  }, []);

  // Auto-save
  const doSave = useCallback(async () => {
    if (!lt || fr.length === 0) return;
    setSaveStatus('saving');
    await saveGame({ cash, gmReputation: gmRep, dynastyHistory: dynasty, leagueTeams: lt, franchises: fr, stakes, season, freeAgents: freeAg, notifications, leagueHistory });
    setSaveStatus('saved');
  }, [cash, gmRep, dynasty, lt, fr, stakes, season, freeAg, notifications, leagueHistory]);

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
    setCash(0); setGmRep(50); setDynasty([]); setFr([]); setStakes([]); setLeagueHistory(initLeagueHistory());
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
  function handleDraftPickMade(player, usedPick) {
    if (player) {
      // B4: Place drafted player into rookie slots (up to 3)
      setFr(prev => prev.map((f, i) => {
        if (i !== activeIdx) return f;
        const rookies = [...(f.rookieSlots || [])];
        if (rookies.length < 3) {
          rookies.push({ ...player, isRookie: true, draftRound: usedPick?.round, draftPick: usedPick?.pick });
          return { ...f, rookieSlots: rookies };
        }
        // If rookie slots full, try main slots
        if (!f.star1) return signToSlot(f, 'star1', player);
        if (!f.star2) return signToSlot(f, 'star2', player);
        if (!f.corePiece) return signToSlot(f, 'corePiece', player);
        return f;
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

    // B2: League history — champion + notable seasons + franchise records
    if (af && result.leagueTeams) {
      // Determine NGL champion from playoff result or standings
      const nglStandings = [...(result.leagueTeams.ngl || [])].sort((a, b) => b.wins - a.wins);
      const champion = nglStandings[0];
      if (champion) {
        const isPlayer = fr.some(pf => pf.id === champion.id);
        setLeagueHistory(prev => {
          let h = addChampion(prev, {
            season, teamName: champion.name, city: champion.city,
            isPlayerTeam: isPlayer, record: `${champion.wins}-${champion.losses}`,
            coachName: isPlayer ? af.coach?.name : null,
            starPlayer: isPlayer ? (af.star1?.name || null) : null,
          });
          h = checkNotableSeasons(h, [...(result.leagueTeams.ngl || []), ...(result.leagueTeams.abl || [])], fr, season);
          return h;
        });
      }

      // Franchise records
      const curRecords = af.franchiseRecords || initFranchiseRecords();
      const { records: newRecords, newRecords: brokenList } = updateFranchiseRecords(curRecords, af, season);
      setFr(prev => prev.map((x, i) => i === activeIdx ? { ...x, franchiseRecords: newRecords } : x));

      // Hall of Fame eval for retiring players (age 34+ or low rating)
      const retirees = (af.localLegends || []);
      // We check current slot players approaching retirement
      for (const slotKey of ['star1', 'star2', 'corePiece']) {
        const p = af[slotKey];
        if (p && p.age >= 34 && p.rating < 70) {
          const hofCandidate = evaluateHallOfFame(p, af);
          if (hofCandidate) {
            setLeagueHistory(prev => ({
              ...prev,
              hallOfFame: [...(prev.hallOfFame || []), { ...hofCandidate, inductionSeason: season, team: `${af.city} ${af.name}` }],
            }));
          }
        }
      }
    }

    // B3: Rivalry update
    if (af && result.leagueTeams) {
      const leagueTeams = result.leagueTeams[af.league] || [];
      const h2h = af.headToHead || initHeadToHead();
      const curRivalry = af.rivalry || initRivalry();
      const metInPlayoffs = false; // Will be set correctly by playoff handler
      const newRivalry = updateRivalry(curRivalry, af, leagueTeams, season, h2h, metInPlayoffs);
      setFr(prev => prev.map((x, i) => i === activeIdx ? { ...x, rivalry: newRivalry } : x));
    }

    // Notifications
    if (af) {
      const newNotifs = generateNotifications(af, prevFranchise);
      const stakeIncome = calcStakeIncome(stakes, result.leagueTeams);
      if (stakeIncome > 0.1) {
        newNotifs.push({ id: 'stake_' + Date.now(), severity: 'info', message: `Stake income: +$${Math.round(stakeIncome * 10) / 10}M added to liquid capital.`, type: 'stakes' });
      }
      if (af.finances.profit > 0) {
        newNotifs.push({ id: 'profit_' + Date.now(), severity: 'info', message: `Your franchise turned $${af.finances.profit}M profit, increasing your liquid capital to $${Math.round((af.cash || 0) * 10) / 10}M.`, type: 'finance' });
      } else if (af.finances.profit < 0) {
        newNotifs.push({ id: 'loss_' + Date.now(), severity: 'warning', message: `Season loss of $${Math.abs(af.finances.profit)}M drained liquid capital to $${Math.round((af.cash || 0) * 10) / 10}M.`, type: 'finance' });
      }
      // A1: Stadium project events
      if (af.pendingStadiumEvent) {
        const sevt = af.pendingStadiumEvent;
        newNotifs.push({ id: 'stad_' + Date.now(), severity: sevt.type === 'stadium_complete' ? 'success' : 'info', message: `${sevt.headline}: ${sevt.desc}`, type: 'stadium' });
        if (sevt.newNamingOffer) {
          setNamingOffer(generateNewStadiumNamingRightsOffer(af));
        }
        // Clear the pending event from franchise state
        setFr(prev => prev.map((x, i) => i === activeIdx ? { ...x, pendingStadiumEvent: null } : x));
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
      // Phase 3: naming rights offer requires fan rating >= 55
      if (!f.namingRightsActive && f.fanRating >= 55 && Math.random() < 0.3) {
        setNamingOffer(generateNamingRightsOffer(f));
      } else {
        setNamingOffer(null);
      }

      // B5: TV deal event (every 8 seasons)
      const tvDeal = generateTVDealEvent(season);
      if (tvDeal) {
        setFr(prev => prev.map((x, i) => i === activeIdx ? {
          ...x,
          capModifier: (x.capModifier || 0) + tvDeal.capModifier,
        } : x));
        setNotifications(prev => [...prev, {
          id: 'tv_deal_' + season,
          severity: 'info',
          message: `${tvDeal.title}: ${tvDeal.description}`,
          type: 'league',
        }]);
      }

      // Phase 3: rival stake fan penalty (-2 fan per rival stake held)
      if (stakes.length > 0 && f.rivalIds?.length > 0) {
        const rivalStakeCount = stakes.filter(s => f.rivalIds.includes(s.teamId)).length;
        if (rivalStakeCount > 0) {
          setFr(prev => prev.map((x, i) => i === activeIdx
            ? { ...x, fanRating: clamp(x.fanRating - rivalStakeCount * 2, 0, 100) }
            : x
          ));
        }
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

      // B4: Refresh draft pick inventory for next season
      setFr(prev => prev.map((x, i) => i === activeIdx ? {
        ...x,
        draftPickInventory: initDraftPickInventory(season + 1, x.id),
      } : x));

      // Draft flow
      const picks = generateDraftPickPositions(f, result.leagueTeams);
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
      <div className="loading-overlay">
        <div className="loading-panel">
          <div className="spinner" style={{ width: 36, height: 36 }} />
          <span className="font-display" style={{ color: 'var(--ink)', letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: '0.95rem' }}>Preparing the Front Office</span>
          <span className="font-mono" style={{ color: 'var(--ink-muted)', fontSize: '0.72rem' }}>Loading schedules, finances, and franchise history...</span>
        </div>
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
            leagueHistory={leagueHistory}
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

        {screen === 'analytics' && af && (
          <AnalyticsScreen fr={af} lt={lt} stakes={stakes} season={season} />
        )}
      </main>

      {/* Help Panel */}
      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Floating help button */}
      {fr.length > 0 && !helpOpen && (
        <button
          onClick={() => setHelpOpen(true)}
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
