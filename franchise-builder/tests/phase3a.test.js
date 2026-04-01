/**
 * Phase 3A Tests — Franchise Identity, Pending Effects, Trade Posture
 *
 * Run: node --loader ./alias-loader.mjs tests/phase3a.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { NGL_TEAMS, ABL_TEAMS } from '@/data/leagues';
import {
  FRANCHISE_IDENTITIES,
  DEFAULT_FRANCHISE_IDENTITY,
  addPendingEffect,
  flushPendingEffects,
  computeTradePosture,
  createPlayerFranchise,
  initializeLeague,
  simPlayerSeason,
} from '@/lib/engine/simulation';
import { resolvePressConference } from '@/lib/events/handlers';
import { gameReducer, initialState, selectCurrentFranchise } from '@/lib/gameReducer';

// ── TEST 1 ──────────────────────────────────────────────────
test('FRANCHISE_IDENTITIES covers all NGL and ABL teams', () => {
  const allTeams = [...NGL_TEAMS, ...ABL_TEAMS];
  assert.strictEqual(allTeams.length, 62, 'Expected 62 total teams');

  const validOwnerPersonalities = ['patient', 'aggressive', 'media-hungry', 'reclusive'];
  const validFanProfiles = ['championship-or-bust', 'rebuild-tolerant', 'balanced'];
  const validSpending = ['big-market-aggressive', 'mid-market-opportunist', 'small-market-patient'];
  const validCultures = ['winning-tradition', 'chaos-franchise', 'underdog-identity', 'expansion-franchise'];
  const validRisk = ['high', 'medium', 'low'];
  const validInjury = ['well-run', 'average', 'injury-mill'];

  for (const team of allTeams) {
    const identity = FRANCHISE_IDENTITIES[team.id];
    assert.ok(identity, `Missing identity for ${team.id}`);
    assert.ok(identity.mediaPressureIndex >= 1 && identity.mediaPressureIndex <= 10,
      `${team.id}: mediaPressureIndex ${identity.mediaPressureIndex} out of range`);
    assert.ok(identity.marketPrestige >= 1 && identity.marketPrestige <= 10,
      `${team.id}: marketPrestige ${identity.marketPrestige} out of range`);
    assert.ok(identity.boardTrustFloor >= 0 && identity.boardTrustFloor <= 30,
      `${team.id}: boardTrustFloor ${identity.boardTrustFloor} out of range`);
    assert.ok(validOwnerPersonalities.includes(identity.ownerPersonality),
      `${team.id}: invalid ownerPersonality ${identity.ownerPersonality}`);
    assert.ok(validFanProfiles.includes(identity.fanExpectationProfile),
      `${team.id}: invalid fanExpectationProfile ${identity.fanExpectationProfile}`);
    assert.ok(validSpending.includes(identity.spendingTendency),
      `${team.id}: invalid spendingTendency ${identity.spendingTendency}`);
    assert.ok(validCultures.includes(identity.historicCulture),
      `${team.id}: invalid historicCulture ${identity.historicCulture}`);
    assert.ok(validRisk.includes(identity.riskTolerance),
      `${team.id}: invalid riskTolerance ${identity.riskTolerance}`);
    assert.ok(validInjury.includes(identity.injuryReputation),
      `${team.id}: invalid injuryReputation ${identity.injuryReputation}`);
  }
});

// ── TEST 2 ──────────────────────────────────────────────────
test('createPlayerFranchise includes pendingEffects, boardTrust, franchiseIdentity', () => {
  initializeLeague();
  const fr = createPlayerFranchise(NGL_TEAMS[0], 'ngl');
  assert.ok(Array.isArray(fr.pendingEffects), 'pendingEffects is an array');
  assert.strictEqual(fr.pendingEffects.length, 0, 'pendingEffects starts empty');
  assert.strictEqual(typeof fr.boardTrust, 'number', 'boardTrust is a number');
  assert.ok(fr.boardTrust >= 0 && fr.boardTrust <= 100, `boardTrust in range (${fr.boardTrust})`);
  assert.ok(fr.franchiseIdentity !== null && typeof fr.franchiseIdentity === 'object',
    'franchiseIdentity is an object');
  assert.ok(fr.franchiseIdentity.mediaPressureIndex >= 1 && fr.franchiseIdentity.mediaPressureIndex <= 10,
    'franchiseIdentity.mediaPressureIndex in range');
  assert.strictEqual(fr.fanExpectationRaised, false, 'fanExpectationRaised starts false');
});

// ── TEST 3 ──────────────────────────────────────────────────
test('addPendingEffect is pure and does not mutate input', () => {
  const stub = Object.freeze({ id: 'test', pendingEffects: [] });
  const result = addPendingEffect(stub, {
    id: 'e1', triggerSeason: 3, type: 'fanRating', delta: 5, source: 'test',
  });
  assert.strictEqual(result.pendingEffects.length, 1);
  assert.strictEqual(result.pendingEffects[0].resolved, false);
  assert.strictEqual(result.pendingEffects[0].triggerSeason, 3);
});

// ── TEST 4 ──────────────────────────────────────────────────
test('flushPendingEffects fires only effects for currentSeason or earlier', () => {
  const stub = {
    fanRating: 60, mediaRep: 50, lockerRoomChemistry: 65, boardTrust: 60, sponsorLevel: 2,
    pendingEffects: [
      { id: 'e1', triggerSeason: 3, type: 'fanRating', delta: 10, source: 'test', resolved: false },
      { id: 'e2', triggerSeason: 5, type: 'mediaRep', delta: -5, source: 'test', resolved: false },
      { id: 'e3', triggerSeason: 3, type: 'boardTrust', delta: -8, source: 'test', resolved: false },
    ],
  };
  const { franchise, firedEffects } = flushPendingEffects(stub, 3);
  assert.strictEqual(firedEffects.length, 2, 'Two effects fired');
  assert.strictEqual(franchise.fanRating, 70, 'fanRating = 60 + 10');
  assert.strictEqual(franchise.boardTrust, 52, 'boardTrust = 60 - 8');
  assert.strictEqual(franchise.mediaRep, 50, 'mediaRep unchanged');
  assert.strictEqual(franchise.pendingEffects.length, 1, 'e2 remains');
  assert.strictEqual(franchise.pendingEffects[0].id, 'e2');
});

// ── TEST 5 ──────────────────────────────────────────────────
test('flushPendingEffects enforces boardTrustFloor from franchiseIdentity', () => {
  const stub = {
    boardTrust: 15,
    franchiseIdentity: { boardTrustFloor: 20, mediaPressureIndex: 5 },
    pendingEffects: [
      { id: 'e1', triggerSeason: 1, type: 'boardTrust', delta: -20, source: 'test', resolved: false },
    ],
  };
  const { franchise } = flushPendingEffects(stub, 1);
  assert.strictEqual(franchise.boardTrust, 20, 'boardTrust floored at boardTrustFloor');
});

// ── TEST 6 ──────────────────────────────────────────────────
test('flushPendingEffects clamps all field values to 0–100', () => {
  const stub = {
    fanRating: 95, mediaRep: 5,
    pendingEffects: [
      { id: 'e1', triggerSeason: 1, type: 'fanRating', delta: 20, source: 'test', resolved: false },
      { id: 'e2', triggerSeason: 1, type: 'mediaRep', delta: -20, source: 'test', resolved: false },
    ],
  };
  const { franchise } = flushPendingEffects(stub, 1);
  assert.strictEqual(franchise.fanRating, 100, 'fanRating clamped at 100');
  assert.strictEqual(franchise.mediaRep, 0, 'mediaRep clamped at 0');
});

// ── TEST 7 ──────────────────────────────────────────────────
test('computeTradePosture returns correct posture for buyer/seller/pat cases', () => {
  function makeTeam(wins, losses, cash, riskTolerance, spendingTendency) {
    return {
      wins, losses, cash,
      finances: { profit: cash / 2 },
      franchiseIdentity: { riskTolerance, spendingTendency, mediaPressureIndex: 5 },
    };
  }
  // Buyer: high winPct
  assert.strictEqual(computeTradePosture(makeTeam(12, 5, 20, 'medium', 'mid-market-opportunist'), 17), 'buyer');
  // Seller: low winPct
  assert.strictEqual(computeTradePosture(makeTeam(3, 14, 20, 'medium', 'mid-market-opportunist'), 17), 'seller');
  // Seller: negative cash + small market
  assert.strictEqual(computeTradePosture(makeTeam(8, 9, -50, 'medium', 'small-market-patient'), 17), 'seller');
  // Pat: middling
  assert.strictEqual(computeTradePosture(makeTeam(9, 8, 20, 'medium', 'mid-market-opportunist'), 17), 'pat');
  // High-risk buyer bump
  assert.strictEqual(computeTradePosture(makeTeam(9, 8, 20, 'high', 'mid-market-opportunist'), 17), 'buyer');
});

// ── TEST 8 ──────────────────────────────────────────────────
test('resolvePressConference scales fanBonus by mediaPressureIndex', () => {
  const baseStub = { fanRating: 50, mediaRep: 50, players: [{ morale: 50 }] };

  const lowPressure = { ...baseStub, franchiseIdentity: { mediaPressureIndex: 1 } };
  const midPressure = { ...baseStub, franchiseIdentity: { mediaPressureIndex: 5 } };
  const highPressure = { ...baseStub, franchiseIdentity: { mediaPressureIndex: 10 } };

  const option = { fanBonus: 10, mediaBonus: 6 };

  const rLow = resolvePressConference(lowPressure, option);
  const rMid = resolvePressConference(midPressure, option);
  const rHigh = resolvePressConference(highPressure, option);

  // mpi=1 → scale 0.6: round(10*0.6)=6 → 50+6=56
  assert.strictEqual(rLow.fanRating, 56, 'Low pressure fanRating');
  // mpi=5 → scale 1.0: round(10*1.0)=10 → 50+10=60
  assert.strictEqual(rMid.fanRating, 60, 'Mid pressure fanRating');
  // mpi=10 → scale 1.5: round(10*1.5)=15 → 50+15=65
  assert.strictEqual(rHigh.fanRating, 65, 'High pressure fanRating');

  // moraleBonus is NOT scaled
  const moraleOption = { moraleBonus: 10 };
  const rMoraleLow = resolvePressConference(lowPressure, moraleOption);
  const rMoraleHigh = resolvePressConference(highPressure, moraleOption);
  assert.strictEqual(rMoraleLow.players[0].morale, 60, 'Low mpi morale = 50+10');
  assert.strictEqual(rMoraleHigh.players[0].morale, 60, 'High mpi morale = 50+10');
});

// ── TEST 9 ──────────────────────────────────────────────────
test('ADD_PENDING_EFFECT reducer case appends to franchise pendingEffects', () => {
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

  state = gameReducer(state, {
    type: 'ADD_PENDING_EFFECT',
    payload: {
      id: 'test_effect_1',
      triggerSeason: 2,
      type: 'fanRating',
      delta: 5,
      source: 'test',
    },
  });

  const fr = selectCurrentFranchise(state);
  assert.strictEqual(fr.pendingEffects.length, 1, 'One pending effect added');
  assert.strictEqual(fr.pendingEffects[0].resolved, false, 'Effect not yet resolved');
  assert.strictEqual(fr.pendingEffects[0].type, 'fanRating', 'Correct effect type');
});

// ── TEST 10 ─────────────────────────────────────────────────
test('simPlayerSeason flushes pendingEffects before running — no infinite accumulation', () => {

  initializeLeague();
  let fr = createPlayerFranchise(NGL_TEAMS[0], 'ngl');
  fr = addPendingEffect(fr, { id: 'e1', triggerSeason: 1, type: 'fanRating', delta: 3, source: 'test' });
  fr = addPendingEffect(fr, { id: 'e2', triggerSeason: 1, type: 'mediaRep', delta: -2, source: 'test' });
  fr = addPendingEffect(fr, { id: 'e3', triggerSeason: 1, type: 'boardTrust', delta: 5, source: 'test' });

  const result1 = simPlayerSeason(fr, 1);
  // All three effects had triggerSeason 1, so they should be flushed
  const remaining = (result1.pendingEffects || []).filter(
    e => e.id === 'e1' || e.id === 'e2' || e.id === 'e3'
  );
  assert.strictEqual(remaining.length, 0, 'All manually added effects flushed');

  // Run season 2 — should not throw even with no pending effects
  const result2 = simPlayerSeason(result1, 2);
  assert.ok(Array.isArray(result2.pendingEffects), 'pendingEffects still an array after season 2');
});

// ── TEST 11 ─────────────────────────────────────────────────
test('franchiseIdentity does NOT change after simPlayerSeason — identity is immutable', () => {

  initializeLeague();
  let fr = createPlayerFranchise(NGL_TEAMS[0], 'ngl');
  const originalMPI = fr.franchiseIdentity.mediaPressureIndex;
  const originalOwner = fr.franchiseIdentity.ownerPersonality;

  const result = simPlayerSeason(fr, 1);
  assert.strictEqual(result.franchiseIdentity.mediaPressureIndex, originalMPI, 'MPI unchanged');
  assert.strictEqual(result.franchiseIdentity.ownerPersonality, originalOwner, 'ownerPersonality unchanged');
});

// ── TEST 12 ─────────────────────────────────────────────────
test('No dominant strategy — salary dump depresses fan rating next season', () => {

  initializeLeague();

  // Franchise A: clean, no backlash
  let frA = createPlayerFranchise(NGL_TEAMS[0], 'ngl');
  frA.fanRating = 70;
  frA.pendingEffects = [];

  // Franchise B: same base but with fan backlash queued (simulating releasing a long-tenure star)
  let frB = { ...frA };
  frB = addPendingEffect(frB, {
    id: 'cutFav_s1_test',
    triggerSeason: 2,
    type: 'fanRating',
    delta: -15,
    source: 'Released veteran star — fan backlash',
  });

  // Run season 1 for both (effects don't fire yet — triggerSeason is 2)
  const resultA1 = simPlayerSeason(frA, 1);
  const resultB1 = simPlayerSeason(frB, 1);

  // Normalize fan ratings before season 2 so comparison is fair
  resultA1.fanRating = 70;
  resultB1.fanRating = 70;

  // Run season 2 — franchise B's backlash fires at start
  const resultA2 = simPlayerSeason(resultA1, 2);
  const resultB2 = simPlayerSeason(resultB1, 2);

  // Franchise B should have lower fan rating due to -15 penalty
  assert.ok(resultB2.fanRating < resultA2.fanRating,
    `Backlash franchise fanRating (${resultB2.fanRating}) should be lower than clean franchise (${resultA2.fanRating})`);
});
