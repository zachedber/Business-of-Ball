/**
 * Reducer Stress Test — Phase 1B action types
 *
 * Simulates 20 full seasons through the gameReducer, exercising every new
 * named action type added in Phase 1B plus the selectCurrentFranchise selector.
 *
 * Run: node --loader ./alias-loader.mjs tests/reducer-stress.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { gameReducer, initialState, selectCurrentFranchise } from '@/lib/gameReducer';
import {
  initializeLeague,
  createPlayerFranchise,
  simulateLeagueQuarter,
  generateDraftProspects,
  generateDraftPickPositions,
  generateFreeAgents,
  generateCoachCandidates,
  fireCoach,
  hireCoach,
  signToSlot,
  releaseSlot,
  generateDeadlineFreeAgents,
  generateNamingRightsOffer,
  generateCBAEvent,
  genPressConference,
  r1,
  SLOT_BUDGET,
} from '@/lib/engine';
import { applyLeveragedPurchase, rollCBAStrike } from '@/lib/economy/handlers';
import { processQuarterInjuries } from '@/lib/engine/injuries';
import { rollPlayerEvents } from '@/lib/events/playerEvents';
import { generateTradeOffers, generateWaiverWire, generateDraftTradeUpOffers } from '@/lib/tradeAI';
import { prepareOffseasonFAPool, needsSlotDecision } from '@/lib/freeAgency/handlers';
import { generateOffseasonEvents } from '@/lib/narrative';
import { UPGRADE_COSTS } from '@/data/leagues';

// ── Helpers ──────────────────────────────────────────────────
function isFinite(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function assertState(state, label) {
  const af = selectCurrentFranchise(state);
  assert.ok(af, `${label}: currentFranchise exists`);
  assert.ok(isFinite(af.cash), `${label}: cash is finite (${af.cash})`);
  assert.ok(af.cash >= -500, `${label}: cash not catastrophically negative (${af.cash})`);
  assert.strictEqual(state.cash, af.cash, `${label}: top-level cash synced with franchise cash`);
  assert.ok(isFinite(state.gmRep), `${label}: gmRep is finite (${state.gmRep})`);
  assert.ok(state.gmRep >= 0 && state.gmRep <= 100, `${label}: gmRep in range (${state.gmRep})`);
  assert.ok(Array.isArray(state.fr), `${label}: fr is array`);
  assert.ok(state.fr.length > 0, `${label}: fr is non-empty`);
}

// ── Main test ────────────────────────────────────────────────
test('20-season reducer stress test with all Phase 1B actions', async () => {
  const SEASONS = 20;

  // ── Setup: CREATE_FRANCHISE with leverage ──
  const league = initializeLeague();
  const template = league.ngl[0];
  let newFr = createPlayerFranchise(template, 'ngl');
  newFr = applyLeveragedPurchase(newFr, {
    leveraged: true,
    loanAmount: 30,
    interestRate: 0.08,
    termSeasons: 10,
    seasonalPayment: 4.5,
  });

  let state = gameReducer(initialState, { type: 'FINISH_LOADING' });
  state = gameReducer(state, { type: 'SET_LEAGUE_TEAMS', payload: league });
  state = gameReducer(state, {
    type: 'SET_FREE_AG',
    payload: { ngl: generateFreeAgents('ngl'), abl: generateFreeAgents('abl') },
  });
  state = gameReducer(state, {
    type: 'CREATE_FRANCHISE',
    payload: {
      lt: { ...league, ngl: league.ngl.map(t => t.id === template.id ? { ...t, isPlayerOwned: true } : t) },
      frArray: [newFr],
      cash: newFr.cash || 0,
      events: [],
      freeAg: state.freeAg,
    },
  });
  state = gameReducer(state, { type: 'SET_SCREEN', payload: 'dashboard' });

  assertState(state, 'Initial');
  assert.strictEqual(state.screen, 'dashboard');
  assert.ok(selectCurrentFranchise(state).debtObject, 'Initial: has debt from leveraged purchase');

  // Track action invocations
  const actionCounts = {};
  function dispatch(action) {
    actionCounts[action.type] = (actionCounts[action.type] || 0) + 1;
    state = gameReducer(state, action);
  }

  // ── Season loop ────────────────────────────────────────────
  for (let season = 1; season <= SEASONS; season++) {
    const label = `S${season}`;
    let af = selectCurrentFranchise(state);

    // ── SET_TICKET_PRICE ──
    const newPrice = 50 + Math.floor(Math.random() * 100);
    dispatch({ type: 'SET_TICKET_PRICE', payload: newPrice });
    af = selectCurrentFranchise(state);
    assert.strictEqual(af.ticketPrice, newPrice, `${label}: ticket price set`);

    // ── UPGRADE_FACILITY (first 6 seasons) ──
    if (season <= 6) {
      const fields = ['scoutingStaff', 'developmentStaff', 'medicalStaff', 'marketingStaff', 'trainingFacility', 'weightRoom', 'filmRoom'];
      const field = fields[(season - 1) % fields.length];
      const current = af[field] || 0;
      if (current < 3) {
        const cost = UPGRADE_COSTS[current] || 15;
        if ((af.cash || 0) >= cost) {
          const cashBefore = af.cash;
          dispatch({ type: 'UPGRADE_FACILITY', payload: { field, cost } });
          af = selectCurrentFranchise(state);
          assert.strictEqual(af[field], current + 1, `${label}: ${field} upgraded`);
          assert.ok(af.cash < cashBefore, `${label}: cash decreased after upgrade`);
          assertState(state, `${label} post-upgrade`);
        }
      }
    }

    // ── PAY_OFF_DEBT (if affordable) ──
    af = selectCurrentFranchise(state);
    if (af.debt > 0 && af.cash > 40 && season > 5) {
      const cashBefore = af.cash;
      dispatch({ type: 'PAY_OFF_DEBT', payload: { amount: af.debt } });
      af = selectCurrentFranchise(state);
      assert.strictEqual(af.debt, 0, `${label}: debt paid off`);
      assert.ok(af.cash < cashBefore, `${label}: cash decreased after debt payoff`);
    }

    // ── Quarterly simulation (Q1-Q4) ──
    dispatch({ type: 'TRAINING_CAMP_OPEN' });
    assert.strictEqual(state.trainingCampActive, true, `${label}: training camp opened`);
    dispatch({ type: 'TRAINING_CAMP_CLOSE' });
    dispatch({ type: 'BEGIN_SIM' });

    let updatedFr = state.fr.map((f, i) => i === state.activeIdx ? { ...f, trainingCampAllocation: 'offense' } : f);
    dispatch({ type: 'SET_FRANCHISE', payload: updatedFr });

    // Q1
    let qResult = simulateLeagueQuarter(state.lt, state.fr, season, 1);
    let qInjury = processQuarterInjuries(qResult.franchises[state.activeIdx]);
    let qFr = qResult.franchises.map((f, i) => i === state.activeIdx ? qInjury.franchise : f);
    dispatch({ type: 'SET_LEAGUE_TEAMS', payload: qResult.leagueTeams });
    dispatch({ type: 'SET_FRANCHISE', payload: qFr });
    dispatch({ type: 'SET_QUARTER_PHASE', payload: 1 });

    const evtsQ1 = rollPlayerEvents(qFr[state.activeIdx], season, 1);
    if (evtsQ1.length > 0) dispatch({ type: 'SET_PLAYER_EVENTS', payload: evtsQ1 });
    dispatch({ type: 'Q1_PAUSE_OPEN' });
    assert.strictEqual(state.q1PauseActive, true, `${label}: Q1 pause opened`);
    assert.strictEqual(state.simming, false, `${label}: simming false during Q1 pause`);
    dispatch({ type: 'Q1_PAUSE_CLOSE' });
    dispatch({ type: 'SET_PLAYER_EVENTS', payload: [] });

    // Q2
    dispatch({ type: 'BEGIN_SIM' });
    qResult = simulateLeagueQuarter(state.lt, state.fr, season, 2);
    qInjury = processQuarterInjuries(qResult.franchises[state.activeIdx]);
    qFr = qResult.franchises.map((f, i) => i === state.activeIdx ? qInjury.franchise : f);
    dispatch({ type: 'SET_LEAGUE_TEAMS', payload: qResult.leagueTeams });
    dispatch({ type: 'SET_FRANCHISE', payload: qFr });
    dispatch({ type: 'SET_QUARTER_PHASE', payload: 2 });

    // ── Trade deadline after Q2 ──
    af = selectCurrentFranchise(state);
    const tradeOffers = generateTradeOffers(af, qResult.leagueTeams, season);
    const waiverPool = generateWaiverWire(af.league);
    dispatch({ type: 'SET_TRADE_OFFERS', payload: tradeOffers });
    dispatch({ type: 'WAIVER_WIRE_OPEN', payload: waiverPool });
    dispatch({ type: 'TRADE_DEADLINE_OPEN', payload: qResult.leagueTeams });
    assert.strictEqual(state.tradeDeadlineActive, true, `${label}: trade deadline active`);

    // ── EXECUTE_TRADE (accept first offer if available) ──
    if (state.tradeOffers.length > 0) {
      const offer = state.tradeOffers[0];
      const cashBefore = state.cash;
      dispatch({ type: 'EXECUTE_TRADE', payload: { offer, tradeOffers: state.tradeOffers } });
      assertState(state, `${label} post-trade`);
      // Trade offer should be removed
      assert.ok(!state.tradeOffers.find(o => o.id === offer.id), `${label}: trade offer removed`);
    }

    // ── RESOLVE_TRADE_OFFER (decline remaining) ──
    while (state.tradeOffers.length > 0) {
      const offerId = state.tradeOffers[0].id;
      dispatch({ type: 'RESOLVE_TRADE_OFFER', payload: { offerId, tradeOffers: state.tradeOffers } });
    }
    assert.strictEqual(state.tradeOffers.length, 0, `${label}: all trade offers resolved`);

    // ── SIGN_WAIVER (sign first available if slot open) ──
    af = selectCurrentFranchise(state);
    if (state.waiverPool.length > 0 && (!af.star1 || !af.star2 || !af.corePiece)) {
      const player = state.waiverPool[0];
      dispatch({ type: 'SIGN_WAIVER', payload: { player, waiverPool: state.waiverPool } });
      assertState(state, `${label} post-waiver`);
    }

    dispatch({ type: 'TRADE_DEADLINE_CLOSE' });
    dispatch({ type: 'WAIVER_WIRE_CLOSE' });

    // Q3
    dispatch({ type: 'BEGIN_SIM' });
    qResult = simulateLeagueQuarter(state.lt, state.fr, season, 3);
    qInjury = processQuarterInjuries(qResult.franchises[state.activeIdx]);
    qFr = qResult.franchises.map((f, i) => i === state.activeIdx ? qInjury.franchise : f);
    dispatch({ type: 'SET_LEAGUE_TEAMS', payload: qResult.leagueTeams });
    dispatch({ type: 'SET_FRANCHISE', payload: qFr });
    dispatch({ type: 'SET_QUARTER_PHASE', payload: 3 });

    const evtsQ3 = rollPlayerEvents(qFr[state.activeIdx], season, 3);
    if (evtsQ3.length > 0) dispatch({ type: 'SET_PLAYER_EVENTS', payload: evtsQ3 });
    dispatch({ type: 'Q3_PAUSE_OPEN' });
    assert.strictEqual(state.q3PauseActive, true, `${label}: Q3 pause opened`);
    dispatch({ type: 'Q3_PAUSE_CLOSE' });
    dispatch({ type: 'SET_PLAYER_EVENTS', payload: [] });

    // Q4
    dispatch({ type: 'BEGIN_SIM' });
    qResult = simulateLeagueQuarter(state.lt, state.fr, season, 4);
    qInjury = processQuarterInjuries(qResult.franchises[state.activeIdx]);
    const finalResult = { ...qResult, franchises: qResult.franchises.map((f, i) => i === state.activeIdx ? qInjury.franchise : f) };
    dispatch({ type: 'SET_LEAGUE_TEAMS', payload: finalResult.leagueTeams });
    dispatch({ type: 'SET_FRANCHISE', payload: finalResult.franchises });
    dispatch({ type: 'SET_QUARTER_PHASE', payload: 4 });
    dispatch({ type: 'END_SIM' });

    af = selectCurrentFranchise(state);
    assertState(state, `${label} post-Q4`);
    assert.ok(isFinite(af.wins), `${label}: wins is finite`);
    assert.ok(isFinite(af.losses), `${label}: losses is finite`);
    assert.strictEqual(af.wins + af.losses, 17, `${label}: 17 total games (NGL)`);

    // ── End-of-season flow ──
    dispatch({ type: 'SET_SEASON', payload: season + 1 });
    dispatch({ type: 'SET_CASH', payload: r1(af.cash + 5) }); // stake income stand-in

    // ── Offseason events: RESOLVE_EVENT ──
    const offseasonEvents = (await generateOffseasonEvents(af)).map(e => ({ ...e, resolved: false }));
    dispatch({ type: 'SET_EVENTS', payload: offseasonEvents });

    for (const evt of offseasonEvents) {
      if (evt.choices && evt.choices.length > 0) {
        const choiceIdx = Math.floor(Math.random() * evt.choices.length);
        dispatch({ type: 'RESOLVE_EVENT', payload: { eventId: evt.id, choiceIdx } });
        assertState(state, `${label} post-event-${evt.id}`);
      }
    }

    // All events resolved
    const unresolvedEvents = state.events.filter(e => !e.resolved);
    assert.strictEqual(unresolvedEvents.length, 0, `${label}: all events resolved`);

    // ── RESOLVE_PRESS_CONF ──
    af = selectCurrentFranchise(state);
    const pressConf = genPressConference(af);
    if (pressConf && pressConf.length > 0) {
      dispatch({ type: 'SET_PRESS_CONF', payload: pressConf });
      for (const pc of pressConf) {
        if (pc.options && pc.options.length > 0) {
          const optionIdx = Math.floor(Math.random() * pc.options.length);
          dispatch({ type: 'RESOLVE_PRESS_CONF', payload: { pcId: pc.id, optionIdx } });
          assertState(state, `${label} post-press-${pc.id}`);
        }
      }
    }

    // ── RESOLVE_CBA ──
    const cbaEvent = generateCBAEvent(season);
    if (cbaEvent && cbaEvent.choices && cbaEvent.choices.length > 0) {
      dispatch({ type: 'SET_CBA', payload: cbaEvent });
      const choiceIdx = Math.floor(Math.random() * cbaEvent.choices.length);
      const choice = cbaEvent.choices[choiceIdx];
      const strikeOccurred = rollCBAStrike(choice);
      dispatch({ type: 'RESOLVE_CBA', payload: { choiceIdx, strikeOccurred } });
      assert.strictEqual(state.cbaEvent, null, `${label}: CBA event cleared`);
      assertState(state, `${label} post-CBA`);
    }

    // ── ACCEPT_NAMING_RIGHTS / DECLINE_NAMING_RIGHTS ──
    af = selectCurrentFranchise(state);
    const namingOffer = generateNamingRightsOffer(af);
    if (namingOffer && season % 2 === 0) {
      dispatch({ type: 'SET_NAMING', payload: namingOffer });
      dispatch({ type: 'ACCEPT_NAMING_RIGHTS', payload: namingOffer });
      af = selectCurrentFranchise(state);
      assert.strictEqual(af.namingRightsActive, true, `${label}: naming rights active`);
      assert.strictEqual(state.namingOffer, null, `${label}: naming offer cleared`);
    } else if (namingOffer) {
      dispatch({ type: 'SET_NAMING', payload: namingOffer });
      dispatch({ type: 'DECLINE_NAMING_RIGHTS' });
      assert.strictEqual(state.namingOffer, null, `${label}: naming offer declined`);
    }

    // ── Draft flow: SIGN_PLAYER (draft pick) ──
    af = selectCurrentFranchise(state);
    const picks = generateDraftPickPositions(af, state.lt);
    const prospects = generateDraftProspects(af.league, 20, af.scoutingStaff || 1, picks[0]?.round || 1)
      .map(({ trueRating, ...rest }) => rest);
    dispatch({ type: 'DRAFT_OPEN', payload: { draftPicks: picks, draftProspects: prospects } });
    assert.strictEqual(state.draftActive, true, `${label}: draft opened`);

    // ── ADVANCE_DRAFT_PICK (if trade-up offers exist) ──
    af = selectCurrentFranchise(state);
    const tradeUpOffers = generateDraftTradeUpOffers(af, state.lt, prospects, picks[0]);
    if (tradeUpOffers && tradeUpOffers.length > 0) {
      dispatch({ type: 'SET_TRADE_OFFERS', payload: tradeUpOffers });
      const tuOffer = tradeUpOffers[0];
      dispatch({
        type: 'ADVANCE_DRAFT_PICK',
        payload: {
          offer: tuOffer,
          currentPick: picks[0] || null,
          incomingPick: tuOffer.incomingPick || null,
          draftPicks: state.draftPicks,
          tradeOffers: state.tradeOffers,
        },
      });
      assertState(state, `${label} post-trade-up`);
    }

    // Draft 2 players
    for (let i = 0; i < Math.min(2, prospects.length); i++) {
      const player = prospects[i];
      const usedPick = state.draftPicks[i] || { round: 1, pick: i + 1 };
      dispatch({ type: 'SIGN_PLAYER', payload: { player, usedPick } });
      assertState(state, `${label} draft-pick-${i}`);
    }

    // Clear roster full alert if set
    if (state.rosterFullAlert) {
      dispatch({ type: 'SET_ROSTER_FULL_ALERT', payload: null });
    }

    // ── Slot decision → Free agency ──
    af = selectCurrentFranchise(state);
    const { playerPool, aiSigned } = prepareOffseasonFAPool({
      league: af.league,
      gmRep: state.gmRep,
      existingPool: [],
      existingAILog: [],
      leagueTeams: state.lt || { ngl: [], abl: [] },
    });

    if (needsSlotDecision(af)) {
      dispatch({ type: 'SLOT_DECISION_OPEN', payload: { offseasonFAPool: playerPool, aiSigningsLog: aiSigned } });
      assert.strictEqual(state.slotDecisionActive, true, `${label}: slot decision opened`);
      // Simulate slot decision done
      dispatch({ type: 'FA_OPEN', payload: { offseasonFAPool: playerPool, aiSigningsLog: aiSigned } });
    } else {
      dispatch({ type: 'DRAFT_CLOSE' });
      dispatch({ type: 'FA_OPEN', payload: { offseasonFAPool: playerPool, aiSigningsLog: aiSigned } });
    }
    assert.strictEqual(state.freeAgencyActive, true, `${label}: FA opened`);

    // Sign an FA via SET_FRANCHISE (simulating screen setFr prop)
    af = selectCurrentFranchise(state);
    if (playerPool.length > 0) {
      const faPlayer = playerPool[0];
      const emptySlot = !af.star1 ? 'star1' : !af.star2 ? 'star2' : !af.corePiece ? 'corePiece' : null;
      if (emptySlot) {
        const signed = signToSlot(af, emptySlot, faPlayer);
        if (signed) {
          // Use legacy setActiveFr path (SET_FRANCHISE updater)
          dispatch({
            type: 'SET_FRANCHISE',
            payload: state.fr.map((f, i) => i === state.activeIdx ? signed : f),
          });
          assertState(state, `${label} post-FA-sign`);
        }
      }
    }

    // Close FA
    dispatch({ type: 'FA_CLOSE' });
    assert.strictEqual(state.freeAgencyActive, false, `${label}: FA closed`);
    assert.strictEqual(state.draftDone, false, `${label}: draftDone reset`);
    dispatch({ type: 'SET_QUARTER_PHASE', payload: 0 });
    dispatch({ type: 'SET_SCREEN', payload: 'dashboard' });

    // ── Save/load cycle ──
    dispatch({ type: 'SET_SAVE_STATUS', payload: 'saving' });
    dispatch({ type: 'SET_SAVE_STATUS', payload: 'saved' });

    // ── Notifications ──
    dispatch({ type: 'SET_NOTIFICATIONS', payload: [{ id: `n${season}`, type: 'info', message: 'test' }] });
    dispatch({ type: 'DISMISS_NOTIF', payload: `n${season}` });
    assert.strictEqual(state.notifications.length, 0, `${label}: notification dismissed`);

    // ── Help panel ──
    dispatch({ type: 'SET_HELP', payload: true });
    assert.strictEqual(state.helpOpen, true, `${label}: help opened`);
    dispatch({ type: 'SET_HELP', payload: false });

    // ── Final season integrity ──
    assertState(state, `${label} end`);
  }

  // ── Post-20-season assertions ──────────────────────────────
  assertState(state, 'Final');
  assert.strictEqual(state.season, 21, 'Final: season incremented to 21');
  assert.strictEqual(state.screen, 'dashboard', 'Final: screen is dashboard');
  assert.strictEqual(state.simming, false, 'Final: not simming');
  assert.strictEqual(state.draftActive, false, 'Final: draft not active');
  assert.strictEqual(state.freeAgencyActive, false, 'Final: FA not active');
  assert.strictEqual(state.tradeDeadlineActive, false, 'Final: trade deadline not active');
  assert.strictEqual(state.playoffActive, false, 'Final: playoffs not active');
  assert.strictEqual(state.gameOverForced, false, 'Final: game not over');

  const finalAf = selectCurrentFranchise(state);
  assert.ok(finalAf.taxiSquad || finalAf.rookieSlots || finalAf.players,
    'Final: has some roster data after 20 seasons of drafting');

  // ── Verify action coverage ──
  const requiredActions = [
    'SET_FRANCHISE', 'SET_CASH', 'SET_LEAGUE_TEAMS', 'SET_SEASON',
    'SET_SCREEN', 'SET_EVENTS', 'SET_QUARTER_PHASE', 'SET_PLAYER_EVENTS',
    'SET_NOTIFICATIONS', 'DISMISS_NOTIF', 'SET_HELP', 'SET_SAVE_STATUS',
    'SET_TRADE_OFFERS',
    // CREATE_FRANCHISE + FINISH_LOADING dispatched before loop (via direct gameReducer)
    'BEGIN_SIM', 'END_SIM',
    'TRAINING_CAMP_OPEN', 'TRAINING_CAMP_CLOSE',
    'Q1_PAUSE_OPEN', 'Q1_PAUSE_CLOSE',
    'Q3_PAUSE_OPEN', 'Q3_PAUSE_CLOSE',
    'TRADE_DEADLINE_OPEN', 'TRADE_DEADLINE_CLOSE',
    'WAIVER_WIRE_OPEN', 'WAIVER_WIRE_CLOSE',
    'DRAFT_OPEN', 'FA_OPEN', 'FA_CLOSE',
    // Phase 1B new actions
    'RESOLVE_EVENT', 'SET_TICKET_PRICE', 'UPGRADE_FACILITY',
    'SIGN_PLAYER', 'EXECUTE_TRADE', 'RESOLVE_TRADE_OFFER',
    'RESOLVE_PRESS_CONF',
  ];

  for (const action of requiredActions) {
    assert.ok(
      (actionCounts[action] || 0) > 0,
      `Action coverage: ${action} was dispatched ${actionCounts[action] || 0} times`,
    );
  }

  // These may or may not fire depending on RNG — log but don't fail
  const conditionalActions = [
    'SET_ROSTER_FULL_ALERT',
    'RESOLVE_CBA', 'ACCEPT_NAMING_RIGHTS', 'DECLINE_NAMING_RIGHTS',
    'SIGN_WAIVER', 'ADVANCE_DRAFT_PICK', 'PAY_OFF_DEBT',
    'SLOT_DECISION_OPEN', 'DRAFT_CLOSE',
  ];
  for (const action of conditionalActions) {
    const count = actionCounts[action] || 0;
    // Just log — these depend on RNG
    if (count === 0) console.log(`  (info) ${action} did not fire (RNG-dependent)`);
  }

  // ── Phase 3A assertions ────────────────────────────────────
  const finalFr = selectCurrentFranchise(state);

  // pendingEffects field exists and is an array (never corrupted to non-array)
  assert.ok(Array.isArray(finalFr.pendingEffects),
    'Phase 3A: pendingEffects is an array after 20 seasons');

  // boardTrust is a number in valid range
  assert.ok(typeof finalFr.boardTrust === 'number' && finalFr.boardTrust >= 0 && finalFr.boardTrust <= 100,
    `Phase 3A: boardTrust in range after 20 seasons (${finalFr.boardTrust})`);

  // franchiseIdentity is preserved (not mutated or dropped)
  assert.ok(finalFr.franchiseIdentity !== null && typeof finalFr.franchiseIdentity === 'object',
    'Phase 3A: franchiseIdentity object preserved after 20 seasons');
  assert.ok(finalFr.franchiseIdentity.mediaPressureIndex >= 1 && finalFr.franchiseIdentity.mediaPressureIndex <= 10,
    `Phase 3A: mediaPressureIndex still in range after 20 seasons (${finalFr.franchiseIdentity.mediaPressureIndex})`);

  // No unresolved effects older than 2 seasons should remain (they must have been flushed)
  const stalledEffects = (finalFr.pendingEffects || []).filter(
    e => !e.resolved && e.triggerSeason < (finalFr.season - 2)
  );
  assert.strictEqual(stalledEffects.length, 0,
    `Phase 3A: no stale pending effects (${stalledEffects.length} found)`);

  // Simulation win probability must still be in valid range (identity/pressure fields didn't break calcWinProb)
  // Verify by checking the last season's history entry
  const lastHistory = finalFr.history?.[finalFr.history.length - 1];
  if (lastHistory) {
    assert.ok(lastHistory.winPct >= 0 && lastHistory.winPct <= 1,
      `Phase 3A: winPct still valid after identity system (${lastHistory.winPct})`);
  }

  // Print summary
  const totalDispatches = Object.values(actionCounts).reduce((a, b) => a + b, 0);
  console.log(`\n  Total dispatches: ${totalDispatches}`);
  console.log(`  Distinct action types used: ${Object.keys(actionCounts).length}`);
  console.log(`  Seasons completed: ${SEASONS}`);
});

test('selectCurrentFranchise returns null for empty state', () => {
  const af = selectCurrentFranchise(initialState);
  assert.strictEqual(af, null, 'Empty state returns null');
});

test('selectCurrentFranchise returns correct franchise by activeIdx', () => {
  const league = initializeLeague();
  const fr1 = createPlayerFranchise(league.ngl[0], 'ngl');
  const fr2 = createPlayerFranchise(league.ngl[1], 'ngl');

  let state = gameReducer(initialState, {
    type: 'CREATE_FRANCHISE',
    payload: { lt: league, frArray: [fr1, fr2], cash: fr1.cash, events: [], freeAg: { ngl: [], abl: [] } },
  });

  const af = selectCurrentFranchise(state);
  assert.strictEqual(af.id, fr1.id, 'activeIdx=0 returns first franchise');
});

test('RESOLVE_EVENT handles missing event gracefully', () => {
  const league = initializeLeague();
  const fr = createPlayerFranchise(league.ngl[0], 'ngl');
  let state = gameReducer(initialState, {
    type: 'CREATE_FRANCHISE',
    payload: { lt: league, frArray: [fr], cash: fr.cash, events: [], freeAg: { ngl: [], abl: [] } },
  });
  state = gameReducer(state, { type: 'SET_EVENTS', payload: [] });

  // Dispatch with non-existent event ID — should be a no-op
  const before = { ...state };
  state = gameReducer(state, { type: 'RESOLVE_EVENT', payload: { eventId: 'nonexistent', choiceIdx: 0 } });
  assert.deepStrictEqual(state, before, 'No-op for missing event');
});

test('EXECUTE_TRADE with cash component syncs cash correctly', () => {
  const league = initializeLeague();
  const fr = createPlayerFranchise(league.ngl[0], 'ngl');
  let state = gameReducer(initialState, {
    type: 'CREATE_FRANCHISE',
    payload: { lt: league, frArray: [fr], cash: fr.cash, events: [], freeAg: { ngl: [], abl: [] } },
  });

  const cashBefore = state.cash;
  const offer = {
    id: 'test-trade',
    type: 'buy',
    playerWanted: state.fr[0].star1,
    cashComponent: 10,
    draftCompensation: [],
  };

  state = gameReducer(state, {
    type: 'EXECUTE_TRADE',
    payload: { offer, tradeOffers: [offer] },
  });

  assert.strictEqual(state.cash, r1(cashBefore + 10), 'Cash increased by trade component');
  assert.strictEqual(state.fr[0].cash, state.cash, 'Franchise cash synced');
  assert.strictEqual(state.tradeOffers.length, 0, 'Trade offer removed');
});

test('PAY_OFF_DEBT rejects if insufficient cash', () => {
  const league = initializeLeague();
  const fr = { ...createPlayerFranchise(league.ngl[0], 'ngl'), cash: 5, debt: 50, debtObject: { principal: 50 } };
  let state = gameReducer(initialState, {
    type: 'CREATE_FRANCHISE',
    payload: { lt: league, frArray: [fr], cash: 5, events: [], freeAg: { ngl: [], abl: [] } },
  });

  state = gameReducer(state, { type: 'PAY_OFF_DEBT', payload: { amount: 50 } });
  assert.strictEqual(state.fr[0].debt, 50, 'Debt unchanged when insufficient cash');
  assert.strictEqual(state.cash, 5, 'Cash unchanged');
});

test('UPGRADE_FACILITY rejects if max level', () => {
  const league = initializeLeague();
  const fr = { ...createPlayerFranchise(league.ngl[0], 'ngl'), scoutingStaff: 3 };
  let state = gameReducer(initialState, {
    type: 'CREATE_FRANCHISE',
    payload: { lt: league, frArray: [fr], cash: fr.cash, events: [], freeAg: { ngl: [], abl: [] } },
  });

  const cashBefore = state.cash;
  state = gameReducer(state, { type: 'UPGRADE_FACILITY', payload: { field: 'scoutingStaff', cost: 15 } });
  assert.strictEqual(state.fr[0].scoutingStaff, 3, 'Level stays at 3');
  assert.strictEqual(state.cash, cashBefore, 'Cash unchanged');
});

test('SIGN_WAIVER returns state unchanged if no empty slot', () => {
  const league = initializeLeague();
  const fr = createPlayerFranchise(league.ngl[0], 'ngl');
  // Ensure all slots filled
  assert.ok(fr.star1 && fr.star2 && fr.corePiece, 'Precondition: all slots filled');
  let state = gameReducer(initialState, {
    type: 'CREATE_FRANCHISE',
    payload: { lt: league, frArray: [fr], cash: fr.cash, events: [], freeAg: { ngl: [], abl: [] } },
  });

  const before = JSON.stringify(state.fr);
  state = gameReducer(state, {
    type: 'SIGN_WAIVER',
    payload: { player: { id: 'waiver1', name: 'Test', salary: 5 }, waiverPool: [] },
  });
  assert.strictEqual(JSON.stringify(state.fr), before, 'No change when slots full');
});

test('RESET returns to clean state', () => {
  const league = initializeLeague();
  const fr = createPlayerFranchise(league.ngl[0], 'ngl');
  let state = gameReducer(initialState, {
    type: 'CREATE_FRANCHISE',
    payload: { lt: league, frArray: [fr], cash: fr.cash, events: [], freeAg: { ngl: [], abl: [] } },
  });

  state = gameReducer(state, { type: 'RESET' });
  assert.strictEqual(state.fr.length, 0, 'fr reset');
  assert.strictEqual(state.screen, 'intro', 'screen reset');
  assert.strictEqual(state.loading, false, 'loading false');
  assert.strictEqual(state.cash, 0, 'cash reset');
});
