/**
 * Phase 5 Tests — Dynasty, Empire, Board, Media, ABL mechanics
 *
 * Run: node --loader ./alias-loader.mjs tests/phase5.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  initializeLeague, createPlayerFranchise, simPlayerSeason,
  computeDynastyEffects, canOfferABLMaxContract, checkBoardPressure,
  flushPendingEffects, r1,
} from '@/lib/engine';
import {
  calculateValuation, getDebtPressureLevel, getEmpireTier, calcEmpireSynergy,
} from '@/lib/engine/finance';
import { generateBoardMeeting, computeMediaNarrative } from '@/lib/engine/events';
import { NGL_TEAMS, ABL_TEAMS, ABL_SALARY_CAP } from '@/data/leagues';

// ── Helper: run N seasons on a franchise, collect telemetry ──────
function runSimulation(franchise, numSeasons) {
  const telemetry = [];
  let f = franchise;
  for (let s = 1; s <= numSeasons; s++) {
    f = simPlayerSeason(f, s);
    const { franchise: flushed } = flushPendingEffects(f, s);
    f = flushed;
    const lastHist = f.history?.[f.history.length - 1];
    telemetry.push({
      season: s,
      cash: r1(f.cash || 0),
      debt: r1(f.debt || 0),
      winPct: lastHist?.winPct ?? 0,
      fanRating: f.fanRating,
      valuation: calculateValuation(f),
      boardTrust: f.boardTrust ?? 60,
      debtPressure: getDebtPressureLevel(f),
      dynastyLevel: f.dynastyLevel,
      lastBoardMeeting: f.lastBoardMeeting,
      lastMediaNarrative: f.lastMediaNarrative,
    });
  }
  return { franchise: f, telemetry };
}

// ── TEST 1: computeDynastyEffects returns correct levels ──────
test('computeDynastyEffects returns correct levels', () => {
  // 0 winning seasons → none
  const f0 = { history: [], trophies: [], season: 5 };
  const r0 = computeDynastyEffects(f0);
  assert.strictEqual(r0.level, 'none');
  assert.strictEqual(r0.fanBonus, 0);

  // 2 consecutive winning seasons → building
  const f2 = { history: [{ winPct: 0.6 }, { winPct: 0.55 }], trophies: [], season: 5 };
  const r2 = computeDynastyEffects(f2);
  assert.strictEqual(r2.level, 'building');
  assert.strictEqual(r2.fanBonus, 3);

  // 4 consecutive winning seasons → established
  const f4 = { history: [{ winPct: 0.6 }, { winPct: 0.55 }, { winPct: 0.52 }, { winPct: 0.58 }], trophies: [], season: 5 };
  const r4 = computeDynastyEffects(f4);
  assert.strictEqual(r4.level, 'established');
  assert.strictEqual(r4.fanBonus, 5);
  assert.strictEqual(r4.mediaBonus, 3);

  // 6 consecutive winning seasons → dynasty
  const f6 = { history: [{ winPct: 0.6 }, { winPct: 0.55 }, { winPct: 0.52 }, { winPct: 0.58 }, { winPct: 0.51 }, { winPct: 0.54 }], trophies: [], season: 7 };
  const r6 = computeDynastyEffects(f6);
  assert.strictEqual(r6.level, 'dynasty');
  assert.strictEqual(r6.fanBonus, 8);
  assert.strictEqual(r6.chemBonus, 5);
  assert.strictEqual(r6.mediaBonus, 8);
  assert.strictEqual(r6.boardBonus, 10);

  // Streak resets: 1 winning + 1 losing + 3 winning → streak=3, level 'building'
  const fReset = { history: [{ winPct: 0.6 }, { winPct: 0.3 }, { winPct: 0.55 }, { winPct: 0.52 }, { winPct: 0.58 }], trophies: [], season: 6 };
  const rReset = computeDynastyEffects(fReset);
  assert.strictEqual(rReset.consecutiveWins, 3);
  assert.strictEqual(rReset.level, 'building');

  // 2 championships in last 5 seasons → dynasty (regardless of streak)
  const fChamps = { history: [{ winPct: 0.3 }], trophies: [{ season: 3 }, { season: 5 }], season: 6 };
  const rChamps = computeDynastyEffects(fChamps);
  assert.strictEqual(rChamps.level, 'dynasty');
});

// ── TEST 2: computeDynastyEffects does not mutate franchise ──────
test('computeDynastyEffects does not mutate franchise', () => {
  const franchise = Object.freeze({
    history: Object.freeze([Object.freeze({ winPct: 0.6 }), Object.freeze({ winPct: 0.55 })]),
    trophies: Object.freeze([]),
    season: 3,
  });
  // Should not throw
  const result = computeDynastyEffects(franchise);
  assert.strictEqual(result.level, 'building');
});

// ── TEST 3: getEmpireTier returns correct tiers ──────
test('getEmpireTier returns correct tiers', () => {
  // Owner
  const t1 = getEmpireTier(100, [], 0);
  assert.strictEqual(t1.tier, 'Owner');
  assert.strictEqual(t1.nextTier, 'Magnate');
  assert.ok(t1.progressPct >= 0 && t1.progressPct <= 100);

  // Magnate (netWorth >= 500)
  const t2 = getEmpireTier(600, [], 0);
  assert.strictEqual(t2.tier, 'Magnate');
  assert.strictEqual(t2.nextTier, 'Baron');

  // Magnate (2+ stakes)
  const t3 = getEmpireTier(400, [{}, {}], 0);
  assert.strictEqual(t3.tier, 'Magnate');

  // Baron (netWorth >= 1000, 4+ stakes)
  const t4 = getEmpireTier(1100, [{}, {}, {}, {}], 0);
  assert.strictEqual(t4.tier, 'Baron');
  assert.strictEqual(t4.nextTier, 'Mogul');

  // Mogul (netWorth >= 2000, 3+ stakes)
  const t5 = getEmpireTier(2500, [{}, {}, {}], 0);
  assert.strictEqual(t5.tier, 'Mogul');
  assert.strictEqual(t5.nextTier, 'Legend');

  // Legend
  const t6 = getEmpireTier(4500, [{}, {}, {}, {}, {}, {}], 3);
  assert.strictEqual(t6.tier, 'Legend');
  assert.strictEqual(t6.nextTier, null);
  assert.strictEqual(t6.progressPct, 100);
});

// ── TEST 4: calcEmpireSynergy returns correct bonuses ──────
test('calcEmpireSynergy returns correct bonuses', () => {
  const franchise = { league: 'ngl' };

  // No same-league stakes
  const s0 = calcEmpireSynergy(franchise, []);
  assert.strictEqual(s0.fanBonus, 0);
  assert.strictEqual(s0.mediaBonus, 0);
  assert.strictEqual(s0.sponsorBoost, 0);

  // 1 same-league stake
  const s1 = calcEmpireSynergy(franchise, [{ league: 'ngl' }]);
  assert.strictEqual(s1.fanBonus, 2);
  assert.strictEqual(s1.mediaBonus, 0);
  assert.strictEqual(s1.sponsorBoost, 0);

  // 2 same-league stakes
  const s2 = calcEmpireSynergy(franchise, [{ league: 'ngl' }, { league: 'ngl' }]);
  assert.strictEqual(s2.fanBonus, 4);
  assert.strictEqual(s2.sponsorBoost, 0.05);

  // 3 same-league stakes
  const s3 = calcEmpireSynergy(franchise, [{ league: 'ngl' }, { league: 'ngl' }, { league: 'ngl' }]);
  assert.strictEqual(s3.fanBonus, 6);
  assert.strictEqual(s3.mediaBonus, 3);
  assert.strictEqual(s3.sponsorBoost, 0.10);

  // Cross-league stakes (different league from franchise) → all zeros
  const sCross = calcEmpireSynergy(franchise, [{ league: 'abl' }, { league: 'abl' }]);
  assert.strictEqual(sCross.fanBonus, 0);
});

// ── TEST 5: generateBoardMeeting — championship-or-bust ──────
test('generateBoardMeeting — championship-or-bust profile', () => {
  const base = {
    franchiseIdentity: { fanExpectationProfile: 'championship-or-bust' },
    history: [{ winPct: 0.55 }],
    trophies: [],
    season: 3,
  };

  // Won championship
  const rChamp = generateBoardMeeting({
    ...base,
    playoffTeam: true,
    trophies: [{ season: 3 }],
  });
  assert.strictEqual(rChamp.boardTrustDelta, 15);
  assert.strictEqual(rChamp.tone, 'positive');

  // Missed playoffs, winPct 0.48
  const rMissed = generateBoardMeeting({
    ...base,
    playoffTeam: false,
    history: [{ winPct: 0.48 }],
  });
  assert.strictEqual(rMissed.boardTrustDelta, -15);
  assert.strictEqual(rMissed.tone, 'negative');

  // Missed playoffs, winPct 0.30
  const rBad = generateBoardMeeting({
    ...base,
    playoffTeam: false,
    history: [{ winPct: 0.30 }],
  });
  assert.strictEqual(rBad.boardTrustDelta, -22);
  assert.strictEqual(rBad.tone, 'negative');

  // Playoffs, winPct 0.65
  const rStrong = generateBoardMeeting({
    ...base,
    playoffTeam: true,
    history: [{ winPct: 0.65 }],
  });
  assert.strictEqual(rStrong.boardTrustDelta, 5);
  assert.strictEqual(rStrong.tone, 'positive');
});

// ── TEST 6: generateBoardMeeting — rebuild-tolerant ──────
test('generateBoardMeeting — rebuild-tolerant profile', () => {
  const base = {
    franchiseIdentity: { fanExpectationProfile: 'rebuild-tolerant' },
    trophies: [],
    season: 3,
  };

  // Improving (prevWinPct 0.35, currentWinPct 0.42)
  const rImprove = generateBoardMeeting({
    ...base,
    playoffTeam: false,
    history: [{ winPct: 0.35 }, { winPct: 0.42 }],
  });
  assert.ok(rImprove.boardTrustDelta > 0, `Improving should get positive delta, got ${rImprove.boardTrustDelta}`);

  // Not improving
  const rStag = generateBoardMeeting({
    ...base,
    playoffTeam: false,
    history: [{ winPct: 0.42 }, { winPct: 0.38 }],
  });
  assert.ok(rStag.boardTrustDelta <= 0, `Not improving should get 0 or negative delta, got ${rStag.boardTrustDelta}`);

  // Made playoffs
  const rPlayoff = generateBoardMeeting({
    ...base,
    playoffTeam: true,
    history: [{ winPct: 0.55 }],
  });
  assert.strictEqual(rPlayoff.boardTrustDelta, 12);
});

// ── TEST 7: generateBoardMeeting dynasty modifier ──────
test('generateBoardMeeting dynasty modifier reduces negative trust delta', () => {
  const rNoDynasty = generateBoardMeeting({
    franchiseIdentity: { fanExpectationProfile: 'championship-or-bust' },
    playoffTeam: false,
    history: [{ winPct: 0.48 }],
    trophies: [],
    season: 5,
    dynastyLevel: 'none',
  });
  assert.strictEqual(rNoDynasty.boardTrustDelta, -15);

  const rDynasty = generateBoardMeeting({
    franchiseIdentity: { fanExpectationProfile: 'championship-or-bust' },
    playoffTeam: false,
    history: [{ winPct: 0.48 }],
    trophies: [],
    season: 5,
    dynastyLevel: 'dynasty',
  });
  // -15 * 0.6 = -9
  assert.strictEqual(rDynasty.boardTrustDelta, -9);
});

// ── TEST 8: computeMediaNarrative returns correct tone ──────
test('computeMediaNarrative returns correct tone', () => {
  // Hot: championship
  const rHot = computeMediaNarrative({
    mediaRep: 75, history: [{ winPct: 0.65 }],
    trophies: [{ season: 1 }], season: 1,
    franchiseIdentity: { mediaPressureIndex: 5 },
    city: 'Bay City', name: 'Titans',
  });
  assert.strictEqual(rHot.tone, 'hot');
  assert.ok(rHot.headline.length > 0);
  assert.strictEqual(typeof rHot.mediaImpact, 'number');

  // Warm
  const rWarm = computeMediaNarrative({
    mediaRep: 60, history: [{ winPct: 0.50 }],
    trophies: [], season: 2,
    franchiseIdentity: { mediaPressureIndex: 5 },
    city: 'Metro', name: 'Hawks',
  });
  assert.strictEqual(rWarm.tone, 'warm');

  // Cool
  const rCool = computeMediaNarrative({
    mediaRep: 45, history: [{ winPct: 0.42 }],
    trophies: [], season: 3,
    franchiseIdentity: { mediaPressureIndex: 5 },
    city: 'Valley', name: 'Stars',
  });
  assert.strictEqual(rCool.tone, 'cool');

  // Cold
  const rCold = computeMediaNarrative({
    mediaRep: 30, history: [{ winPct: 0.30 }],
    trophies: [], season: 4,
    franchiseIdentity: { mediaPressureIndex: 5 },
    city: 'Port', name: 'Wolves',
  });
  assert.strictEqual(rCold.tone, 'cold');
});

// ── TEST 9: computeMediaNarrative scales with MPI ──────
test('computeMediaNarrative mediaImpact scales with mediaPressureIndex', () => {
  const baseFranchise = {
    mediaRep: 30, history: [{ winPct: 0.25 }],
    trophies: [], season: 4,
    city: 'Port', name: 'Wolves',
  };

  const rLow = computeMediaNarrative({ ...baseFranchise, franchiseIdentity: { mediaPressureIndex: 2 } });
  const rHigh = computeMediaNarrative({ ...baseFranchise, franchiseIdentity: { mediaPressureIndex: 10 } });

  assert.ok(Math.abs(rHigh.mediaImpact) >= Math.abs(rLow.mediaImpact),
    `High MPI impact (${rHigh.mediaImpact}) should be >= low MPI impact (${rLow.mediaImpact}) in absolute value`);
});

// ── TEST 10: canOfferABLMaxContract validation ──────
test('canOfferABLMaxContract — validation rules', () => {
  // NGL franchise → canOffer: false
  const rNGL = canOfferABLMaxContract({ league: 'ngl', players: [] }, { id: 'p1', rating: 90, salary: 10 });
  assert.strictEqual(rNGL.canOffer, false);

  // ABL, player rating 80 → canOffer: false
  const rLowRating = canOfferABLMaxContract(
    { league: 'abl', players: [] },
    { id: 'p1', rating: 80, salary: 10 }
  );
  assert.strictEqual(rLowRating.canOffer, false);

  // ABL, player rating 88, no existing max → canOffer: true
  const rGood = canOfferABLMaxContract(
    { league: 'abl', players: [{ id: 'p2', salary: 10 }] },
    { id: 'p1', rating: 88, salary: 10 }
  );
  assert.strictEqual(rGood.canOffer, true);

  // ABL, player rating 88, existing max player → canOffer: false
  const maxSalary = ABL_SALARY_CAP * 0.35;
  const rExistingMax = canOfferABLMaxContract(
    { league: 'abl', players: [{ id: 'p2', salary: maxSalary }] },
    { id: 'p1', rating: 88, salary: 10 }
  );
  assert.strictEqual(rExistingMax.canOffer, false);
});

// ── TEST 11: ABL star concentration bonus in calcWinProb ──────
test('ABL star concentration bonus applies correctly in calcWinProb', () => {
  initializeLeague();
  const ablTemplate = ABL_TEAMS[0];
  const baseFranchise = createPlayerFranchise(ablTemplate, 'abl');

  // Run 100 times with high star rating
  let sumHigh = 0;
  for (let i = 0; i < 100; i++) {
    const f = { ...baseFranchise, star1: { ...baseFranchise.star1, rating: 92, injured: false } };
    // simPlayerSeason calls calcWinProb internally; we test via win rate
    const result = simPlayerSeason(f, 1);
    const totalGames = Math.max(1, result.wins + result.losses);
    sumHigh += result.wins / totalGames;
  }
  const avgHigh = sumHigh / 100;

  // Run 100 times with low star rating
  let sumLow = 0;
  for (let i = 0; i < 100; i++) {
    const f = { ...baseFranchise, star1: { ...baseFranchise.star1, rating: 70, injured: false } };
    const result = simPlayerSeason(f, 1);
    const totalGames = Math.max(1, result.wins + result.losses);
    sumLow += result.wins / totalGames;
  }
  const avgLow = sumLow / 100;

  console.log(`  ABL star bonus: avgWP(92)=${avgHigh.toFixed(3)} avgWP(70)=${avgLow.toFixed(3)} diff=${(avgHigh - avgLow).toFixed(3)}`);
  assert.ok(avgHigh > avgLow, `92-rated star (${avgHigh.toFixed(3)}) should win more than 70-rated (${avgLow.toFixed(3)})`);
});

// ── TEST 12: 20-season stability with all Phase 5 systems active ──────
test('20-season stability with all Phase 5 systems active — regression', () => {
  initializeLeague();
  const template = NGL_TEAMS.find(t => t.id === 'ngl-bay') || NGL_TEAMS[0];
  const franchise = createPlayerFranchise(template, 'ngl');

  const SEASONS = 20;
  const { franchise: finalFr, telemetry } = runSimulation(franchise, SEASONS);

  // Phase 5 fields are stable
  assert.ok(['none', 'building', 'established', 'dynasty'].includes(finalFr.dynastyLevel),
    `dynastyLevel should be valid: ${finalFr.dynastyLevel}`);

  // Board meeting fired at least once (check telemetry — board meetings happen at end of season in useSimulation,
  // but simPlayerSeason alone doesn't fire them. Test that dynastyLevel is set after 20 seasons.)
  assert.ok(finalFr.dynastyLevel !== undefined, 'dynastyLevel should be set');
  assert.ok(typeof finalFr.dynastyStreakYears === 'number', 'dynastyStreakYears should be a number');

  // pendingEffects is still an Array
  assert.ok(Array.isArray(finalFr.pendingEffects), 'pendingEffects should still be an array');

  // Prior invariants from phase4-telemetry hold
  const finalTel = telemetry[SEASONS - 1];
  const firstTel = telemetry[0];
  assert.ok(finalTel.valuation >= firstTel.valuation * 0.5,
    `Valuation collapse: S1=${firstTel.valuation} S${SEASONS}=${finalTel.valuation}`);

  const minCash = Math.min(...telemetry.map(t => t.cash));
  assert.ok(minCash >= -500, `Cash floor breached: min=${minCash}`);

  const avgWP = telemetry.reduce((s, t) => s + t.winPct, 0) / SEASONS;
  assert.ok(avgWP >= 0.05 && avgWP <= 0.80, `Win rate out of range: avg=${avgWP.toFixed(3)}`);

  const minTrust = Math.min(...telemetry.map(t => t.boardTrust));
  assert.ok(minTrust >= 0, `boardTrust went negative: min=${minTrust}`);
});
