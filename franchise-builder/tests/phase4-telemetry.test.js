/**
 * Phase 4 Telemetry Tests — 50-season simulation harness
 *
 * Run: node --loader ./alias-loader.mjs tests/phase4-telemetry.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  initializeLeague, createPlayerFranchise, simPlayerSeason,
  flushPendingEffects, checkBoardPressure, r1,
} from '@/lib/engine';
import { calculateValuation, getDebtPressureLevel } from '@/lib/engine/finance';
import { NGL_TEAMS } from '@/data/leagues';

const SEASONS = 50;

// ── Helper: run N seasons on a franchise, collect telemetry ──────
function runSimulation(franchise, numSeasons) {
  const telemetry = [];
  let f = franchise;
  let maxPendingLen = 0;

  for (let s = 1; s <= numSeasons; s++) {
    f = simPlayerSeason(f, s);
    const { franchise: flushed } = flushPendingEffects(f, s);
    f = flushed;
    maxPendingLen = Math.max(maxPendingLen, (f.pendingEffects || []).length);

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
    });
  }

  return { franchise: f, telemetry, maxPendingLen };
}

function logSummary(label, telemetry) {
  const stats = (key) => {
    const vals = telemetry.map(t => t[key]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = r1(vals.reduce((a, b) => a + b, 0) / vals.length);
    return { min, max, avg };
  };
  console.log(`\n  ── ${label} (${telemetry.length} seasons) ──`);
  for (const key of ['cash', 'winPct', 'valuation', 'boardTrust']) {
    const s = stats(key);
    console.log(`    ${key}: min=${s.min} max=${s.max} avg=${s.avg}`);
  }
  const criticalCount = telemetry.filter(t => t.debtPressure === 'critical').length;
  console.log(`    debtPressure=critical: ${criticalCount}/${telemetry.length} seasons`);
}

// ── TEST 1 ──────────────────────────────────────────────────
test(`${SEASONS}-season telemetry — big market franchise stays economically viable`, () => {
  initializeLeague();
  const template = NGL_TEAMS.find(t => t.id === 'ngl-bay');
  assert.ok(template, 'ngl-bay template found');
  const franchise = createPlayerFranchise(template, 'ngl');

  const { telemetry, maxPendingLen } = runSimulation(franchise, SEASONS);
  logSummary('Big Market (ngl-bay)', telemetry);

  // INVARIANT 1: valuation at season N >= 50% of season 1
  assert.ok(telemetry[SEASONS - 1].valuation >= telemetry[0].valuation * 0.5,
    `Valuation collapse: S1=${telemetry[0].valuation} S${SEASONS}=${telemetry[SEASONS - 1].valuation}`);

  // INVARIANT 2: cash never goes below -500M
  const minCash = Math.min(...telemetry.map(t => t.cash));
  assert.ok(minCash >= -500, `Cash floor breached: min=${minCash}`);

  // INVARIANT 3: winPct average between 0.05 and 0.80
  // Note: pure engine sim without player management (no FA, draft, coaching) trends low
  const avgWP = telemetry.reduce((s, t) => s + t.winPct, 0) / SEASONS;
  assert.ok(avgWP >= 0.05 && avgWP <= 0.80, `Win rate out of range: avg=${avgWP.toFixed(3)}`);

  // INVARIANT 4: boardTrust never goes below 0
  const minTrust = Math.min(...telemetry.map(t => t.boardTrust));
  assert.ok(minTrust >= 0, `boardTrust went negative: min=${minTrust}`);

  // INVARIANT 5: debtPressure 'critical' appears in at most 15 of N seasons
  const criticalCount = telemetry.filter(t => t.debtPressure === 'critical').length;
  assert.ok(criticalCount <= 15, `Debt spiral: critical for ${criticalCount}/${SEASONS} seasons`);

  // INVARIANT 6: pendingEffects array length never exceeds 20
  assert.ok(maxPendingLen <= 20, `Pending effects unbounded: max=${maxPendingLen}`);
});

// ── TEST 2 ──────────────────────────────────────────────────
test(`${SEASONS}-season telemetry — small market franchise stays viable with patient play`, () => {
  initializeLeague();
  const template = NGL_TEAMS.find(t => t.id === 'ngl-buf');
  assert.ok(template, 'ngl-buf template found');
  const franchise = createPlayerFranchise(template, 'ngl');

  const { franchise: finalFr, telemetry, maxPendingLen } = runSimulation(franchise, SEASONS);
  logSummary('Small Market (ngl-buf)', telemetry);

  // INVARIANT 1
  assert.ok(telemetry[SEASONS - 1].valuation >= telemetry[0].valuation * 0.5,
    `Valuation collapse: S1=${telemetry[0].valuation} S${SEASONS}=${telemetry[SEASONS - 1].valuation}`);

  // INVARIANT 2
  const minCash = Math.min(...telemetry.map(t => t.cash));
  assert.ok(minCash >= -500, `Cash floor breached: min=${minCash}`);

  // INVARIANT 3: pure engine sim trends low on winPct
  const avgWP = telemetry.reduce((s, t) => s + t.winPct, 0) / SEASONS;
  assert.ok(avgWP >= 0.05 && avgWP <= 0.80, `Win rate out of range: avg=${avgWP.toFixed(3)}`);

  // INVARIANT 4
  const minTrust = Math.min(...telemetry.map(t => t.boardTrust));
  assert.ok(minTrust >= 0, `boardTrust went negative: min=${minTrust}`);

  // INVARIANT 5
  const criticalCount = telemetry.filter(t => t.debtPressure === 'critical').length;
  assert.ok(criticalCount <= 15, `Debt spiral: critical for ${criticalCount}/${SEASONS} seasons`);

  // INVARIANT 6
  assert.ok(maxPendingLen <= 20, `Pending effects unbounded: max=${maxPendingLen}`);

  // INVARIANT 7: franchise identity preserved
  assert.strictEqual(finalFr.franchiseIdentity.spendingTendency,
    'small-market-patient',
    'franchise identity mutated during sim');
});

// ── TEST 3 ──────────────────────────────────────────────────
test('Strategy comparison — max-spend vs min-spend roster, 25 seasons each', () => {
  initializeLeague();
  const template = NGL_TEAMS.find(t => t.id === 'ngl-chi') || NGL_TEAMS[0];

  // Franchise A: normal defaults
  let frA = createPlayerFranchise(template, 'ngl');
  // Franchise B: min salary exploit
  let frB = createPlayerFranchise(template, 'ngl');
  if (frB.star1) frB.star1 = { ...frB.star1, salary: 0 };
  if (frB.star2) frB.star2 = { ...frB.star2, salary: 0 };

  const simShort = 25;
  const { telemetry: telA } = runSimulation(frA, simShort);
  const { telemetry: telB } = runSimulation(frB, simShort);

  const frA_avgWinPct = telA.reduce((s, t) => s + t.winPct, 0) / simShort;
  const frB_avgWinPct = telB.reduce((s, t) => s + t.winPct, 0) / simShort;
  const frA_avgRevenue = telA.reduce((s, t) => s + t.cash, 0) / simShort;
  const frB_avgRevenue = telB.reduce((s, t) => s + t.cash, 0) / simShort;
  const frA_finalValuation = telA[simShort - 1].valuation;
  const frB_finalValuation = telB[simShort - 1].valuation;

  console.log(`\n  ── Strategy Comparison (${simShort} seasons) ──`);
  console.log(`    A (normal): avgWP=${frA_avgWinPct.toFixed(3)} avgCash=${r1(frA_avgRevenue)} val=${frA_finalValuation}`);
  console.log(`    B (min-sal): avgWP=${frB_avgWinPct.toFixed(3)} avgCash=${r1(frB_avgRevenue)} val=${frB_finalValuation}`);

  const bDominates = (
    frB_avgWinPct > frA_avgWinPct * 1.1 &&
    frB_avgRevenue > frA_avgRevenue * 1.1 &&
    frB_finalValuation > frA_finalValuation * 1.1
  );
  assert.ok(!bDominates, 'Min-salary strategy dominates on all metrics — balancing needed');
});

// ── TEST 4 ──────────────────────────────────────────────────
test('checkBoardPressure — fires only under correct conditions', () => {
  // Case 1: boardTrust 0, season 5, floor 0 → trust(0) <= 15, trust(0) NOT > floor(0) → fired: true
  const stub1 = { boardTrust: 0, season: 5, franchiseIdentity: { boardTrustFloor: 0 }, history: [{ winPct: 0.3 }] };
  const result1 = checkBoardPressure(stub1);
  assert.strictEqual(result1.fired, true, 'Case 1: trust at floor should fire');
  assert.ok(result1.reason, 'Case 1: reason is provided');

  // Case 2: boardTrust 0, season 2 → fired: false (grace period, < 3 seasons)
  const stub2 = { boardTrust: 0, season: 2, franchiseIdentity: { boardTrustFloor: 0 }, history: [{ winPct: 0.3 }] };
  const result2 = checkBoardPressure(stub2);
  assert.strictEqual(result2.fired, false, 'Case 2: grace period protects');

  // Case 3: boardTrust 16, floor 15, season 5 → trust(16) > floor(15) → protected → fired: false
  const stub3 = { boardTrust: 16, season: 5, franchiseIdentity: { boardTrustFloor: 15 }, history: [{ winPct: 0.3 }] };
  const result3 = checkBoardPressure(stub3);
  assert.strictEqual(result3.fired, false, 'Case 3: trust above floor protects');

  // Case 4: boardTrust 14, floor 15, season 5 → trust(14) NOT > floor(15) → fired: true
  const stub4 = { boardTrust: 14, season: 5, franchiseIdentity: { boardTrustFloor: 15 }, history: [{ winPct: 0.5 }] };
  const result4 = checkBoardPressure(stub4);
  assert.strictEqual(result4.fired, true, 'Case 4: trust below floor allows firing');
  assert.ok(result4.reason.includes('board has lost confidence'), 'Case 4: reason mentions board');
});

// ── TEST 5 ──────────────────────────────────────────────────
test('getDebtPressureLevel returns correct levels', () => {
  initializeLeague();
  const template = NGL_TEAMS[0];
  const baseFr = createPlayerFranchise(template, 'ngl');
  const baseVal = calculateValuation(baseFr);
  assert.ok(baseVal > 0, `Base valuation should be positive: ${baseVal}`);

  // debt: 0 → 'none'
  assert.strictEqual(getDebtPressureLevel({ ...baseFr, debt: 0 }), 'none', 'No debt = none');

  // ratio ~0.10 → 'none'
  assert.strictEqual(getDebtPressureLevel({ ...baseFr, debt: r1(baseVal * 0.10) }), 'none', 'Ratio 0.10 = none');

  // ratio ~0.25 → 'watch'
  assert.strictEqual(getDebtPressureLevel({ ...baseFr, debt: r1(baseVal * 0.25) }), 'watch', 'Ratio 0.25 = watch');

  // ratio ~0.35 → 'warning'
  assert.strictEqual(getDebtPressureLevel({ ...baseFr, debt: r1(baseVal * 0.35) }), 'warning', 'Ratio 0.35 = warning');

  // ratio ~0.42 → 'critical'
  assert.strictEqual(getDebtPressureLevel({ ...baseFr, debt: r1(baseVal * 0.42) }), 'critical', 'Ratio 0.42 = critical');
});
