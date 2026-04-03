import { useCallback } from 'react';
import {
  simulateLeagueQuarter,
  calcStakeIncome,
  generateNamingRightsOffer,
  generateCBAEvent,
  generateNewspaper,
  generateNotifications,
  updateGMReputation,
  generateDraftPickPositions,
  simulatePlayoffs,
  generateExtensionDemands,
  checkPressureEvent,
  addChampion,
  checkNotableSeasons,
  initFranchiseRecords,
  updateFranchiseRecords,
  evaluateHallOfFame,
  initDraftPickInventory,
  generateFreeAgents,
  genPressConference,
  generateDraftProspects,
  checkBoardPressure,
  r1,
} from '@/lib/engine';
import { applyDebtPenalty, calculateDebtPayment } from '@/lib/engine/finance';
import { generateBoardMeeting, computeMediaNarrative } from '@/lib/engine/events';
import { processQuarterInjuries } from '@/lib/engine/injuries';
import { rollPlayerEvents } from '@/lib/events/playerEvents';
import { missedDebtWarnings } from '@/data/eventFlavor';
import { generateTradeOffers, generateWaiverWire, generateDraftTradeUpOffers } from '@/lib/tradeAI';
import { appendLogEntry } from '@/lib/economy';
import {
  generateSeasonRecap,
  generateGMGrade,
  generateDynastyNarrative,
  generateOffseasonEvents,
} from '@/lib/narrative';

export function useSimulation({ state, dispatch, doSave, refs }) {
  const { frRef, ltRef, prevFranchiseRef } = refs;
  const {
    cash, gmRep, dynasty, lt, fr, stakes, season, activeIdx,
    simming, tradeDeadlineLeague, playoffResult, notifications,
    namingOffer, leagueHistory, playerEvents,
  } = state;

  const runEndOfSeasonFlow = useCallback(async (result, af, prevFranchise) => {
    const newSeason = season + 1;
    dispatch({ type: 'SET_SEASON', payload: newSeason });
    let newFr = result.franchises;
    const stakeIncome = calcStakeIncome(stakes, result.leagueTeams);
    let newCash = af ? r1((af.cash || 0) + stakeIncome) : r1(cash || 0);

    let debtNotifs = [];
    let gameOverForced = false;
    if (af?.debtObject?.principal > 0) {
      const debtResult = applyDebtPenalty(af.debtObject, newCash);
      newCash = debtResult.cash;
      const updatedDebt = {
        ...debtResult.debt,
        seasonalPayment: calculateDebtPayment(debtResult.debt),
        termSeasons: Math.max(0, (debtResult.debt.termSeasons || 1) - 1),
      };
      newFr = newFr.map((f, i) => i === activeIdx ? { ...f, cash: newCash, debt: updatedDebt.principal, debtObject: updatedDebt } : f);
      if (debtResult.unpaidRemainder > 0) {
        debtNotifs.push({ id: `debt_miss_${Date.now()}`, severity: 'warning', message: missedDebtWarnings[Math.floor(Math.random() * missedDebtWarnings.length)], type: 'finance' });
      }
      if ((updatedDebt.consecutiveMissedPayments || 0) >= 2) gameOverForced = true;
    }
    if (gameOverForced) return dispatch({ type: 'GAME_OVER_FORCED' });

    // Phase 4: Board pressure fire check
    const boardPressureResult = af ? checkBoardPressure(af) : { fired: false };
    if (boardPressureResult.fired) {
      return dispatch({
        type: 'BOARD_PRESSURE_FIRE',
        payload: { reason: boardPressureResult.reason },
      });
    }

    // Phase 5: Board meeting — apply seasonal trust delta
    if (af) {
      const boardMeeting = generateBoardMeeting(af);
      const newBoardTrust = Math.max(0, Math.min(100,
        (af.boardTrust ?? 60) + boardMeeting.boardTrustDelta
      ));
      const floor = af.franchiseIdentity?.boardTrustFloor ?? 0;
      const clampedBoardTrust = Math.max(newBoardTrust, floor);
      newFr = newFr.map((f, i) => i === activeIdx
        ? { ...f, boardTrust: clampedBoardTrust, lastBoardMeeting: boardMeeting }
        : f
      );
    }

    // Phase 5: Media narrative — apply seasonal media impact to fan rating
    if (af) {
      const afUpdated = newFr[activeIdx];
      const narrative = computeMediaNarrative(afUpdated);
      const updatedFanRating = Math.max(0, Math.min(100, (afUpdated.fanRating || 50) + narrative.mediaImpact));
      newFr = newFr.map((f, i) => i === activeIdx
        ? { ...f, fanRating: updatedFanRating, lastMediaNarrative: narrative }
        : f
      );
      // Append to front office log
      newFr = newFr.map((f, i) => i === activeIdx
        ? appendLogEntry(f, {
            season,
            quarter: null,
            type: 'media',
            headline: narrative.headline.slice(0, 80),
            detail: `Media tone: ${narrative.tone} · Fan impact: ${narrative.mediaImpact >= 0 ? '+' : ''}${narrative.mediaImpact}`,
            impact: narrative.tone === 'hot' ? 'positive' : narrative.tone === 'cold' ? 'negative' : 'neutral',
          })
        : f
      );
    }

    const newRep = af ? updateGMReputation(gmRep, af, prevFranchise) : gmRep;
    let newLeagueHistory = leagueHistory;
    if (af && result.leagueTeams) {
      const nglStandings = [...(result.leagueTeams.ngl || [])].sort((a, b) => b.wins - a.wins);
      const champion = result.playoffResult?.champion || nglStandings[0];
      if (champion) {
        const isPlayer = result.franchises.some(pf => pf.id === champion.id);
        newLeagueHistory = addChampion(newLeagueHistory, { season, teamName: champion.name, city: champion.city, isPlayerTeam: isPlayer, record: `${champion.wins}-${champion.losses}`, coachName: isPlayer ? af.coach?.name : null, starPlayer: isPlayer ? af.star1?.name : null });
        newLeagueHistory = checkNotableSeasons(newLeagueHistory, [...(result.leagueTeams.ngl || []), ...(result.leagueTeams.abl || [])], result.franchises, season);
      }
      const curRecords = af.franchiseRecords || initFranchiseRecords();
      const { records: newRecords } = updateFranchiseRecords(curRecords, af, season);
      newFr = newFr.map((x, i) => i === activeIdx ? { ...x, franchiseRecords: newRecords } : x);
      for (const slotKey of ['star1', 'star2', 'corePiece']) {
        const p = af[slotKey];
        if (!p || p.age < 34 || p.rating >= 70) continue;
        const hofCandidate = evaluateHallOfFame(p, af);
        if (!hofCandidate) continue;
        newLeagueHistory = { ...newLeagueHistory, hallOfFame: [...(newLeagueHistory.hallOfFame || []), { ...hofCandidate, inductionSeason: season, team: `${af.city} ${af.name}` }] };
      }
    }

    let allNotifications = [...notifications.filter(n => !['contract', 'cap', 'stadium', 'fans', 'player'].includes(n.type)), ...debtNotifs].slice(-15);
    const f = af || result.franchises[activeIdx];
    const [rc, gr] = await Promise.all([generateSeasonRecap(f), generateGMGrade(f)]);
    let dynastyEra = null;
    if (season % 3 === 0) {
      dynastyEra = await generateDynastyNarrative(f);
      newFr = newFr.map((x, i) => i === activeIdx ? { ...x, dynastyEra: dynastyEra.era } : x);
    }
    const leagueStandings = f.league === 'ngl' ? result.standings?.ngl : result.standings?.abl;
    const generatedNewspaper = generateNewspaper(leagueStandings, result.franchises, season, result.leagueTeams);
    const allEvents = [
      ...(await generateOffseasonEvents(f)).map(e => ({ ...e, resolved: false })),
      ...generateExtensionDemands(f, gmRep),
      ...(checkPressureEvent(f, season) ? [{ ...checkPressureEvent(f, season), resolved: false }] : []),
    ];

    const picks = generateDraftPickPositions(f, result.leagueTeams);
    const prospects = generateDraftProspects(f.league, 20, f.scoutingStaff, picks[0]?.round || 1).map(({ trueRating, ...rest }) => rest);
    newFr = newFr.map((x, i) => i === activeIdx ? { ...x, draftPickInventory: initDraftPickInventory(newSeason, x.id), trainingCampAllocation: undefined } : x);

    // Append playoff log entry for the player's franchise
    if (af) {
      const pr = result.playoffResult;
      const record = `${af.wins || 0}-${af.losses || 0}`;
      let playoffEntry;
      if (pr?.playerWonChampionship) {
        playoffEntry = { season, quarter: null, type: 'playoff', headline: `Championship won — ${record} season`.slice(0, 80), detail: null, impact: 'positive' };
      } else if (pr?.playerMadePlayoffs && pr?.playerEliminated) {
        playoffEntry = { season, quarter: null, type: 'playoff', headline: `Eliminated in playoffs — ${record}`.slice(0, 80), detail: pr.playerEliminated.roundName ? `Lost in ${pr.playerEliminated.roundName}` : null, impact: 'neutral' };
      } else {
        playoffEntry = { season, quarter: null, type: 'playoff', headline: `Missed playoffs — ${record}`.slice(0, 80), detail: null, impact: 'negative' };
      }
      newFr = newFr.map((x, i) => i === activeIdx ? appendLogEntry(x, playoffEntry) : x);
    }

    dispatch({ type: 'SET_GM_REP', payload: newRep });
    dispatch({ type: 'SET_LEAGUE_HISTORY', payload: newLeagueHistory });
    dispatch({ type: 'SET_FRANCHISE', payload: newFr });
    dispatch({ type: 'SET_CASH', payload: newCash });
    dispatch({ type: 'SET_NOTIFICATIONS', payload: [...allNotifications, ...generateNotifications(f, prevFranchise)] });
    dispatch({ type: 'SET_RECAP', payload: { recap: rc, grade: gr } });
    dispatch({ type: 'SET_NEWSPAPER', payload: { newspaper: generatedNewspaper, newspaperDismissed: false } });
    dispatch({ type: 'SET_PRESS_CONF', payload: genPressConference(f) });
    dispatch({ type: 'SET_CBA', payload: generateCBAEvent(season) });
    dispatch({ type: 'SET_NAMING', payload: !f.namingRightsActive && f.fanRating >= 55 ? generateNamingRightsOffer(f) : namingOffer });
    if (dynastyEra) dispatch({ type: 'SET_DYNASTY', payload: [...dynasty, { ...dynastyEra, season }] });
    dispatch({ type: 'SET_EVENTS', payload: allEvents });
    dispatch({ type: 'SET_FREE_AG', payload: { ngl: generateFreeAgents('ngl'), abl: generateFreeAgents('abl') } });
    dispatch({ type: 'SET_TRADE_OFFERS', payload: generateDraftTradeUpOffers(f, result.leagueTeams, prospects, picks[0]) });
    dispatch({ type: 'DRAFT_OPEN', payload: { draftPicks: picks, draftProspects: prospects } });
  }, [activeIdx, cash, dispatch, dynasty, gmRep, leagueHistory, namingOffer, notifications, season, stakes]);

  const handleSim = useCallback(async () => {
    if (simming) return;
    dispatch({ type: 'SET_RECAP', payload: { recap: null, grade: null } });
    dispatch({ type: 'SET_NEWSPAPER', payload: { newspaper: null, newspaperDismissed: true } });
    dispatch({ type: 'SET_PLAYER_EVENTS', payload: [] });
    dispatch({ type: 'SET_QUARTER_PHASE', payload: 0 });
    dispatch({ type: 'TRAINING_CAMP_OPEN' });
  }, [dispatch, simming]);

  const handleTrainingCampDone = useCallback(async (allocation) => {
    dispatch({ type: 'TRAINING_CAMP_CLOSE' });
    dispatch({ type: 'BEGIN_SIM' });
    const updatedFr = fr.map((f, i) => i === activeIdx ? { ...f, trainingCampAllocation: allocation } : f);
    dispatch({ type: 'SET_FRANCHISE', payload: updatedFr });
    await new Promise(r => setTimeout(r, 300));
    const r1Result = simulateLeagueQuarter(lt, updatedFr, season, 1);
    const q1 = processQuarterInjuries(r1Result.franchises[activeIdx]);
    const q1Franchises = r1Result.franchises.map((f, i) => i === activeIdx ? q1.franchise : f);
    dispatch({ type: 'SET_NOTIFICATIONS', payload: [...notifications, ...q1.notifications] });
    dispatch({ type: 'SET_LEAGUE_TEAMS', payload: r1Result.leagueTeams });
    dispatch({ type: 'SET_FRANCHISE', payload: q1Franchises });
    dispatch({ type: 'SET_QUARTER_PHASE', payload: 1 });
    const evts = rollPlayerEvents(q1Franchises[activeIdx], season, 1);
    if (evts.length > 0) dispatch({ type: 'SET_PLAYER_EVENTS', payload: evts });
    dispatch({ type: 'Q1_PAUSE_OPEN' });
  }, [activeIdx, dispatch, fr, lt, notifications, season]);

  const handleStartQ2 = useCallback(async () => {
    dispatch({ type: 'Q1_PAUSE_CLOSE' });
    dispatch({ type: 'BEGIN_SIM' });
    await new Promise(r => setTimeout(r, 200));
    const r2Result = simulateLeagueQuarter(ltRef.current, frRef.current, season, 2);
    const q2 = processQuarterInjuries(r2Result.franchises[activeIdx]);
    const q2Franchises = r2Result.franchises.map((f, i) => i === activeIdx ? q2.franchise : f);
    dispatch({ type: 'SET_NOTIFICATIONS', payload: [...notifications, ...q2.notifications] });
    dispatch({ type: 'SET_LEAGUE_TEAMS', payload: r2Result.leagueTeams });
    dispatch({ type: 'SET_FRANCHISE', payload: q2Franchises });
    dispatch({ type: 'SET_QUARTER_PHASE', payload: 2 });
    const af2 = q2Franchises[activeIdx];
    dispatch({ type: 'SET_TRADE_OFFERS', payload: generateTradeOffers(af2, r2Result.leagueTeams, season) });
    dispatch({ type: 'WAIVER_WIRE_OPEN', payload: generateWaiverWire(af2.league) });
    dispatch({ type: 'TRADE_DEADLINE_OPEN', payload: r2Result.leagueTeams });
  }, [activeIdx, dispatch, frRef, ltRef, notifications, season]);

  const handleContinueSeason = useCallback(async () => {
    dispatch({ type: 'BEGIN_SIM' });
    dispatch({ type: 'TRADE_DEADLINE_CLOSE' });
    dispatch({ type: 'WAIVER_WIRE_CLOSE' });
    await new Promise(r => setTimeout(r, 300));
    const r3Result = simulateLeagueQuarter(tradeDeadlineLeague || ltRef.current, frRef.current, season, 3);
    const q3 = processQuarterInjuries(r3Result.franchises[activeIdx]);
    const q3Franchises = r3Result.franchises.map((f, i) => i === activeIdx ? q3.franchise : f);
    dispatch({ type: 'SET_NOTIFICATIONS', payload: [...notifications, ...q3.notifications] });
    dispatch({ type: 'SET_LEAGUE_TEAMS', payload: r3Result.leagueTeams });
    dispatch({ type: 'SET_FRANCHISE', payload: q3Franchises });
    dispatch({ type: 'SET_QUARTER_PHASE', payload: 3 });
    const evts = rollPlayerEvents(q3Franchises[activeIdx], season, 3);
    if (evts.length > 0) dispatch({ type: 'SET_PLAYER_EVENTS', payload: [...(playerEvents || []), ...evts] });
    dispatch({ type: 'Q3_PAUSE_OPEN' });
  }, [activeIdx, dispatch, frRef, ltRef, notifications, playerEvents, season, tradeDeadlineLeague]);

  const handleStartQ4 = useCallback(async () => {
    dispatch({ type: 'Q3_PAUSE_CLOSE' });
    dispatch({ type: 'BEGIN_SIM' });
    const prevFranchise = fr[activeIdx];
    prevFranchiseRef.current = prevFranchise;
    await new Promise(r => setTimeout(r, 200));
    const r4Result = simulateLeagueQuarter(ltRef.current, frRef.current, season, 4);
    const q4 = processQuarterInjuries(r4Result.franchises[activeIdx]);
    const result = { ...r4Result, franchises: r4Result.franchises.map((f, i) => i === activeIdx ? q4.franchise : f) };
    const af = result.franchises[activeIdx];
    dispatch({ type: 'SET_LEAGUE_TEAMS', payload: result.leagueTeams });
    dispatch({ type: 'SET_FRANCHISE', payload: result.franchises });
    dispatch({ type: 'SET_QUARTER_PHASE', payload: 4 });
    if (af?.league === 'ngl') {
      const pResult = simulatePlayoffs(result.leagueTeams.ngl, af);
      return dispatch({ type: 'PLAYOFF_OPEN', payload: { playoffResult: pResult, tradeDeadlineLeague: result.leagueTeams } });
    }
    await runEndOfSeasonFlow(result, af, prevFranchise);
    dispatch({ type: 'END_SIM' });
    await doSave();
  }, [activeIdx, dispatch, doSave, fr, frRef, ltRef, prevFranchiseRef, runEndOfSeasonFlow, season]);

  const handlePlayoffFinished = useCallback(async () => {
    dispatch({ type: 'PLAYOFF_CLOSE' });
    const champion = playoffResult?.champion;
    const playoffLeagueTeams = { ...lt, ngl: (lt?.ngl || []).map(t => champion && t.id === champion.id ? { ...t, leagueRank: 1 } : t) };
    const result = { leagueTeams: playoffLeagueTeams, franchises: fr, standings: { ngl: [...(playoffLeagueTeams?.ngl || [])].sort((a, b) => b.wins - a.wins), abl: [...(playoffLeagueTeams?.abl || [])].sort((a, b) => b.wins - a.wins) }, playoffResult };
    const afNow = fr[activeIdx];
    await runEndOfSeasonFlow(result, afNow, prevFranchiseRef.current || afNow);
    prevFranchiseRef.current = null;
    await doSave();
  }, [activeIdx, dispatch, doSave, fr, lt, playoffResult, prevFranchiseRef, runEndOfSeasonFlow]);

  return { handleSim, handleTrainingCampDone, handleStartQ2, handleContinueSeason, handleStartQ4, handlePlayoffFinished };
}
