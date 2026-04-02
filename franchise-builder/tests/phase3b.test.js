/**
 * Phase 3B Tests — UI Layer Logic: Owner Report Pending Consequences,
 * Trade Posture Classification, Scouting Gating, Reducer Integration
 *
 * Run: node --loader ./alias-loader.mjs tests/phase3b.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildOwnerReport } from '@/lib/economy/ownerReport';
import { gameReducer, initialState, selectCurrentFranchise } from '@/lib/gameReducer';
import { initializeLeague, createPlayerFranchise } from '@/lib/engine/simulation';
import { NGL_TEAMS } from '@/data/leagues';

// ── TEST 1 ──────────────────────────────────────────────────
test('buildOwnerReport returns pendingConsequences section', () => {
  const franchise = {
    season: 3,
    history: [{ wins: 9, losses: 8, winPct: 0.529, season: 3 }],
    boardTrust: 55,
    pendingEffects: [
      { id: 'e1', triggerSeason: 4, type: 'fanRating', delta: -8, source: 'test', resolved: false },
      { id: 'e2', triggerSeason: 5, type: 'boardTrust', delta: -5, source: 'test', resolved: false },
    ],
    franchiseIdentity: { boardTrustFloor: 15, mediaPressureIndex: 5 },
    wins: 9, losses: 8, fanRating: 60, mediaRep: 50, cash: 50,
    market: 70, stadiumCondition: 70, championships: 0, city: 'Test',
    totalSalary: 40, sponsorLevel: 1, ticketPrice: 80,
    players: [], coach: { level: 2 }, lockerRoomChemistry: 50, schemeFit: 50,
    rosterQuality: 70,
  };

  const report = buildOwnerReport(franchise, null);
  assert.ok(report.pendingConsequences, 'pendingConsequences is defined');
  assert.strictEqual(report.pendingConsequences.items.length, 2, 'Two items');
  assert.strictEqual(report.pendingConsequences.items[0].timing, 'next', 'First item fires next season');
  assert.strictEqual(report.pendingConsequences.items[1].timing, 'future', 'Second item fires later');
  assert.strictEqual(report.pendingConsequences.boardTrust, 55, 'boardTrust passed through');
  assert.strictEqual(report.pendingConsequences.boardTrustFloor, 15, 'boardTrustFloor passed through');
});

// ── TEST 2 ──────────────────────────────────────────────────
test('buildOwnerReport returns empty items when no pending effects', () => {
  const franchise = {
    season: 3,
    history: [{ wins: 9, losses: 8, winPct: 0.529, season: 3 }],
    boardTrust: 55,
    pendingEffects: [],
    franchiseIdentity: { boardTrustFloor: 15, mediaPressureIndex: 5 },
    wins: 9, losses: 8, fanRating: 60, mediaRep: 50, cash: 50,
    market: 70, stadiumCondition: 70, championships: 0, city: 'Test',
    totalSalary: 40, sponsorLevel: 1, ticketPrice: 80,
    players: [], coach: { level: 2 }, lockerRoomChemistry: 50, schemeFit: 50,
    rosterQuality: 70,
  };

  const report = buildOwnerReport(franchise, null);
  assert.strictEqual(report.pendingConsequences.items.length, 0, 'No items');
  assert.strictEqual(report.pendingConsequences.boardTrust, 55, 'boardTrust present');
});

// ── TEST 3 ──────────────────────────────────────────────────
test('buildOwnerReport excludes already-resolved effects', () => {
  const franchise = {
    season: 3,
    history: [{ wins: 9, losses: 8, winPct: 0.529, season: 3 }],
    boardTrust: 55,
    pendingEffects: [
      { id: 'e1', triggerSeason: 4, type: 'fanRating', delta: -5, source: 'test', resolved: true },
      { id: 'e2', triggerSeason: 4, type: 'mediaRep', delta: 3, source: 'test', resolved: false },
    ],
    franchiseIdentity: { boardTrustFloor: 15, mediaPressureIndex: 5 },
    wins: 9, losses: 8, fanRating: 60, mediaRep: 50, cash: 50,
    market: 70, stadiumCondition: 70, championships: 0, city: 'Test',
    totalSalary: 40, sponsorLevel: 1, ticketPrice: 80,
    players: [], coach: { level: 2 }, lockerRoomChemistry: 50, schemeFit: 50,
    rosterQuality: 70,
  };

  const report = buildOwnerReport(franchise, null);
  assert.strictEqual(report.pendingConsequences.items.length, 1, 'Only unresolved effect');
  assert.strictEqual(report.pendingConsequences.items[0].type, 'mediaRep', 'Correct effect type');
});

// ── TEST 4 ──────────────────────────────────────────────────
test('formatPendingEffectLabel formats correctly for all types', () => {
  const franchise = {
    season: 3,
    history: [{ wins: 9, losses: 8, winPct: 0.529, season: 3 }],
    boardTrust: 55,
    pendingEffects: [
      { id: 'e1', triggerSeason: 4, type: 'fanRating', delta: -8, source: 'test fan', resolved: false },
      { id: 'e2', triggerSeason: 4, type: 'boardTrust', delta: -5, source: 'test board', resolved: false },
      { id: 'e3', triggerSeason: 4, type: 'fanExpectations', delta: 0, source: 'test expectations', resolved: false },
    ],
    franchiseIdentity: { boardTrustFloor: 15, mediaPressureIndex: 5 },
    wins: 9, losses: 8, fanRating: 60, mediaRep: 50, cash: 50,
    market: 70, stadiumCondition: 70, championships: 0, city: 'Test',
    totalSalary: 40, sponsorLevel: 1, ticketPrice: 80,
    players: [], coach: { level: 2 }, lockerRoomChemistry: 50, schemeFit: 50,
    rosterQuality: 70,
  };

  const report = buildOwnerReport(franchise, null);
  const items = report.pendingConsequences.items;

  const fanItem = items.find(i => i.type === 'fanRating');
  assert.ok(fanItem.label.includes('Fan Rating'), 'fanRating label contains Fan Rating');
  assert.ok(fanItem.label.includes('-8'), 'fanRating label contains -8');

  const boardItem = items.find(i => i.type === 'boardTrust');
  assert.ok(boardItem.label.includes('Board Trust'), 'boardTrust label contains Board Trust');
  assert.ok(boardItem.label.includes('-5'), 'boardTrust label contains -5');

  const expectItem = items.find(i => i.type === 'fanExpectations');
  assert.ok(expectItem.label.includes('expectations'), 'fanExpectations label contains expectations');
});

// ── TEST 5 ──────────────────────────────────────────────────
test('leaguePostureBoard logic: buyer/seller/pat classification', () => {
  function classifyPosture(wins, losses, cash, riskTolerance, spendingTendency) {
    const gp = Math.max(1, wins + losses);
    const winPct = wins / gp;
    if (winPct > 0.62 || (winPct > 0.50 && riskTolerance === 'high')) return 'buyer';
    if (winPct < 0.38 || (cash < 0 && spendingTendency === 'small-market-patient')) return 'seller';
    return 'pat';
  }

  assert.strictEqual(classifyPosture(13, 4, 20, 'medium', 'mid-market-opportunist'), 'buyer');
  assert.strictEqual(classifyPosture(5, 12, 30, 'low', 'mid-market-opportunist'), 'seller');
  assert.strictEqual(classifyPosture(2, 15, 30, 'low', 'mid-market-opportunist'), 'seller');
  assert.strictEqual(classifyPosture(9, 8, -20, 'medium', 'small-market-patient'), 'seller');
  assert.strictEqual(classifyPosture(9, 8, 30, 'medium', 'mid-market-opportunist'), 'pat');
  assert.strictEqual(classifyPosture(10, 7, 30, 'high', 'big-market-aggressive'), 'buyer');
});

// ── TEST 6 ──────────────────────────────────────────────────
test('visiblePostureCount gating by scoutingStaff', () => {
  function getVisibleCount(scoutingStaff, total) {
    if (scoutingStaff >= 3) return total;
    if (scoutingStaff >= 2) return Math.min(12, total);
    return Math.min(5, total);
  }

  assert.strictEqual(getVisibleCount(1, 30), 5);
  assert.strictEqual(getVisibleCount(2, 30), 12);
  assert.strictEqual(getVisibleCount(3, 30), 30);
  assert.strictEqual(getVisibleCount(2, 8), 8);
  assert.strictEqual(getVisibleCount(1, 3), 3);
});

// ── TEST 7 ──────────────────────────────────────────────────
test('ADD_PENDING_EFFECT dispatches from decision sites are additive, not destructive', () => {
  const league = initializeLeague();
  const template = league.ngl[0];
  const newFr = createPlayerFranchise(template, 'ngl');

  let state = gameReducer(initialState, { type: 'FINISH_LOADING' });
  state = gameReducer(state, {
    type: 'CREATE_FRANCHISE',
    payload: {
      lt: league,
      frArray: [newFr],
      cash: newFr.cash || 0,
      events: [],
      freeAg: { ngl: [], abl: [] },
    },
  });

  const frBefore = selectCurrentFranchise(state);
  const cashBefore = frBefore.cash;
  const fanBefore = frBefore.fanRating;

  state = gameReducer(state, {
    type: 'ADD_PENDING_EFFECT',
    payload: {
      id: 'test_fan_1',
      triggerSeason: 2,
      type: 'fanRating',
      delta: -8,
      source: 'test',
    },
  });

  state = gameReducer(state, {
    type: 'ADD_PENDING_EFFECT',
    payload: {
      id: 'test_board_1',
      triggerSeason: 2,
      type: 'boardTrust',
      delta: -5,
      source: 'test',
    },
  });

  const fr = selectCurrentFranchise(state);
  assert.strictEqual(fr.pendingEffects.length, 2, 'Two pending effects added');
  assert.strictEqual(fr.pendingEffects[0].resolved, false, 'First effect not resolved');
  assert.strictEqual(fr.pendingEffects[1].resolved, false, 'Second effect not resolved');
  assert.strictEqual(fr.cash, cashBefore, 'Cash unchanged by ADD_PENDING_EFFECT');
  assert.strictEqual(fr.fanRating, fanBefore, 'fanRating unchanged by ADD_PENDING_EFFECT');
});

// ── TEST 8 ──────────────────────────────────────────────────
test('Owner Report tab label integrity — pendingConsequences section is always returned', () => {
  const franchise = {
    season: 2,
    history: [{ wins: 8, losses: 9, winPct: 0.471, season: 2 }],
    boardTrust: 60,
    // No pendingEffects field at all — simulate older save
    franchiseIdentity: { boardTrustFloor: 10, mediaPressureIndex: 5 },
    wins: 8, losses: 9, fanRating: 55, mediaRep: 45, cash: 40,
    market: 70, stadiumCondition: 70, championships: 0, city: 'Test',
    totalSalary: 35, sponsorLevel: 1, ticketPrice: 75,
    players: [], coach: { level: 1 }, lockerRoomChemistry: 50, schemeFit: 50,
    rosterQuality: 65,
  };

  const report = buildOwnerReport(franchise, null);
  assert.ok(report.pendingConsequences, 'pendingConsequences is defined');
  assert.ok(Array.isArray(report.pendingConsequences.items), 'items is an Array');
  assert.strictEqual(report.pendingConsequences.items.length, 0, 'items is empty for missing field');
});
