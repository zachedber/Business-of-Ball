/**
 * Stress Test — Business of Ball Engine
 * Simulates 15 seasons headlessly, checking for crashes, nulls, NaN, and unbounded growth.
 *
 * Run: node --import ./alias-loader.mjs stress-test.mjs
 */

import {
  initializeLeague,
  createPlayerFranchise,
  simulateFullSeasonFirstHalf,
  simulateFullSeasonSecondHalf,
  simulatePlayoffs,
  simulateAIFreeAgency,
  endOfSeasonAging,
  generateFreeAgents,
  generateOffseasonFAPool,
  generateDraftProspects,
  generateDraftPickPositions,
  generateExtensionDemands,
  initDraftPickInventory,
  calcSlotQuality,
  calcDepthQuality,
  calculateValuation,
  calculateCapSpace,
  updateGMReputation,
  generateNotifications,
  generateNewspaper,
  generateCBAEvent,
  generateNamingRightsOffer,
  checkNotableSeasons,
  initLeagueHistory,
  addChampion,
  updateFranchiseRecords,
  initFranchiseRecords,
  evaluateHallOfFame,
  updateRivalry,
  initRivalry,
  initHeadToHead,
  updateHeadToHead,
  updateCityEconomy,
  genPressConference,
  checkPressureEvent,
  getGMTier,
} from './src/lib/engine.js';

import { NGL_TEAMS } from './src/data/leagues.js';

// ── Test utilities ───────────────────────────────────────────────
let errors = [];
let warnings = [];

function assert(condition, msg) {
  if (!condition) {
    errors.push(`FAIL: ${msg}`);
    console.error(`  ✗ ${msg}`);
  }
}

function warn(msg) {
  warnings.push(msg);
  console.warn(`  ⚠ ${msg}`);
}

function isFiniteNum(v) {
  return typeof v === 'number' && isFinite(v);
}

function checkNoNaN(obj, path = '') {
  if (obj === null || obj === undefined) return;
  if (typeof obj === 'number' && isNaN(obj)) {
    errors.push(`NaN found at ${path}`);
    console.error(`  ✗ NaN at ${path}`);
  }
  if (typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'history' || k === 'players' || k === 'deadCapLog' || k === 'notableSeasons') continue;
      checkNoNaN(v, `${path}.${k}`);
    }
  }
}

function validateFranchise(f, season, label) {
  const prefix = `[S${season} ${label}]`;
  assert(f !== null && f !== undefined, `${prefix} franchise is null`);
  if (!f) return;

  assert(isFiniteNum(f.wins), `${prefix} wins is not a finite number: ${f.wins}`);
  assert(isFiniteNum(f.losses), `${prefix} losses is not a finite number: ${f.losses}`);
  assert(isFiniteNum(f.cash), `${prefix} cash is NaN/Infinity: ${f.cash}`);
  assert(isFiniteNum(f.fanRating), `${prefix} fanRating is not finite: ${f.fanRating}`);
  assert(f.fanRating >= 0 && f.fanRating <= 100, `${prefix} fanRating out of bounds: ${f.fanRating}`);
  assert(isFiniteNum(f.rosterQuality), `${prefix} rosterQuality is not finite: ${f.rosterQuality}`);
  assert(f.finances != null, `${prefix} finances is null`);
  if (f.finances) {
    assert(isFiniteNum(f.finances.revenue), `${prefix} revenue is not finite: ${f.finances.revenue}`);
    assert(isFiniteNum(f.finances.expenses), `${prefix} expenses is not finite: ${f.finances.expenses}`);
    assert(isFiniteNum(f.finances.profit), `${prefix} profit is not finite: ${f.finances.profit}`);
  }
  assert(Array.isArray(f.players), `${prefix} players is not an array`);
  assert(isFiniteNum(f.totalSalary), `${prefix} totalSalary is not finite: ${f.totalSalary}`);
  assert(isFiniteNum(f.stadiumCondition), `${prefix} stadiumCondition is not finite: ${f.stadiumCondition}`);
  assert(f.coach != null, `${prefix} coach is null`);
  assert(Array.isArray(f.history), `${prefix} history is not an array`);
  assert(isFiniteNum(f.lockerRoomChemistry), `${prefix} lockerRoomChemistry is not finite: ${f.lockerRoomChemistry}`);
  assert(isFiniteNum(f.mediaRep), `${prefix} mediaRep is not finite: ${f.mediaRep}`);

  checkNoNaN(f.finances, `${prefix}.finances`);

  for (const p of f.players) {
    assert(p != null, `${prefix} null player in players array`);
    if (!p) continue;
    assert(isFiniteNum(p.rating), `${prefix} player ${p.name} rating is not finite: ${p.rating}`);
    assert(p.rating >= 40 && p.rating <= 99, `${prefix} player ${p.name} rating out of bounds: ${p.rating}`);
    assert(isFiniteNum(p.age), `${prefix} player ${p.name} age is not finite: ${p.age}`);
    assert(isFiniteNum(p.salary), `${prefix} player ${p.name} salary is not finite: ${p.salary}`);
    assert(isFiniteNum(p.morale), `${prefix} player ${p.name} morale is not finite: ${p.morale}`);
  }
}

function validateLeague(lt, season) {
  for (const league of ['ngl', 'abl']) {
    assert(Array.isArray(lt[league]), `[S${season}] lt.${league} is not an array`);
    for (const team of lt[league]) {
      assert(team != null, `[S${season}] null team in ${league}`);
      assert(isFiniteNum(team.wins), `[S${season}] ${team.city} ${team.name} wins NaN`);
      assert(isFiniteNum(team.losses), `[S${season}] ${team.city} ${team.name} losses NaN`);
      assert(team.finances != null, `[S${season}] ${team.city} ${team.name} finances null`);
      assert(Array.isArray(team.players), `[S${season}] ${team.city} ${team.name} players not array`);
      // Player-owned teams may have 0 slot players if all slots expired — this is handled by the draft/FA UI flow
      if (!team.isPlayerOwned) {
        assert(team.players.length > 0, `[S${season}] AI team ${team.city} ${team.name} has 0 players`);
      }
      assert(isFiniteNum(team.rosterQuality), `[S${season}] ${team.city} ${team.name} rosterQuality NaN: ${team.rosterQuality}`);
      assert(team.coach != null, `[S${season}] ${team.city} ${team.name} coach is null`);
    }
  }
}

// ── Main stress test ─────────────────────────────────────────────
function runStressTest() {
  const SEASONS = 15;
  console.log(`\n========================================`);
  console.log(`  STRESS TEST: ${SEASONS} Seasons`);
  console.log(`========================================\n`);

  // ── Phase 1: Initialize ──────────────────────────────────────
  console.log('Phase 1: Initializing league and franchise...');
  let lt;
  try {
    lt = initializeLeague();
  } catch (e) {
    errors.push(`CRASH in initializeLeague: ${e.message}`);
    console.error(`FATAL: ${e.message}\n${e.stack}`);
    return { errors, warnings };
  }
  assert(lt.ngl.length === 32, `NGL should have 32 teams, got ${lt.ngl.length}`);
  assert(lt.abl.length === 30, `ABL should have 30 teams, got ${lt.abl.length}`);
  validateLeague(lt, 0);

  const tmpl = NGL_TEAMS.find(t => t.id === 'ngl-chi') || NGL_TEAMS[0];
  let pf;
  try {
    pf = createPlayerFranchise(tmpl, 'ngl');
  } catch (e) {
    errors.push(`CRASH in createPlayerFranchise: ${e.message}`);
    console.error(`FATAL: ${e.message}\n${e.stack}`);
    return { errors, warnings };
  }
  assert(pf.isPlayerOwned === true, 'Franchise should be player owned');
  assert(pf.star1 != null, 'star1 should exist at creation');
  assert(pf.star2 != null, 'star2 should exist at creation');
  assert(pf.corePiece != null, 'corePiece should exist at creation');
  validateFranchise(pf, 0, 'init');
  console.log(`  ✓ League: ${lt.ngl.length} NGL + ${lt.abl.length} ABL teams`);
  console.log(`  ✓ Franchise: ${pf.city} ${pf.name} | Cash: $${pf.cash}M | Debt: $${pf.debt}M | RQ: ${pf.rosterQuality}`);

  lt.ngl = lt.ngl.map(t => t.id === pf.id ? pf : t);

  let gmRep = 50;
  let leagueHistory = initLeagueHistory();
  let fr = [pf];

  const growthTracker = {
    historyLen: [], deadCapLogLen: [], localLegendsLen: [],
    notableSeasonsLen: [], championsLen: [], hallOfFameLen: [],
    cashOverTime: [], rqOverTime: [],
  };

  // ── Phase 2: Simulate Seasons ────────────────────────────────
  for (let season = 1; season <= SEASONS; season++) {
    console.log(`\n── Season ${season} ──────────────────────────`);
    const prevFr = { ...fr[0] };

    // --- First Half ---
    let firstHalfResult;
    try {
      firstHalfResult = simulateFullSeasonFirstHalf(lt, fr, season);
    } catch (e) {
      errors.push(`CRASH in simulateFullSeasonFirstHalf S${season}: ${e.message}`);
      console.error(`  FATAL: ${e.stack}`);
      break;
    }
    lt = firstHalfResult.leagueTeams;
    fr = firstHalfResult.franchises;
    console.log(`  First half: ${fr[0].halfWins}-${fr[0].halfLosses}`);

    // --- Second Half ---
    let result;
    try {
      result = simulateFullSeasonSecondHalf(lt, fr, season);
    } catch (e) {
      errors.push(`CRASH in simulateFullSeasonSecondHalf S${season}: ${e.message}`);
      console.error(`  FATAL: ${e.stack}`);
      break;
    }
    lt = result.leagueTeams;
    fr = result.franchises;
    const af = fr[0];

    validateFranchise(af, season, 'post-sim');
    validateLeague(lt, season);

    console.log(`  Record: ${af.wins}-${af.losses} | Cash: $${af.cash}M | RQ: ${af.rosterQuality} | Fan: ${af.fanRating}`);
    console.log(`  Star1: ${af.star1?.name || 'EMPTY'} (${af.star1?.rating || '-'}) | Star2: ${af.star2?.name || 'EMPTY'} (${af.star2?.rating || '-'}) | Core: ${af.corePiece?.name || 'EMPTY'} (${af.corePiece?.rating || '-'})`);

    // --- NGL Playoffs ---
    let playoffResult;
    try {
      playoffResult = simulatePlayoffs(lt.ngl, af);
    } catch (e) {
      errors.push(`CRASH in simulatePlayoffs S${season}: ${e.message}`);
      console.error(`  FATAL: ${e.stack}`);
      break;
    }
    assert(playoffResult.champion != null, `[S${season}] Playoff champion is null`);
    if (playoffResult.playerWonChampionship) {
      fr[0] = {
        ...af,
        championships: (af.championships || 0) + 1,
        trophies: [...(af.trophies || []), { season, wins: af.wins, losses: af.losses }],
      };
      console.log(`  CHAMPIONSHIP WON! Total: ${fr[0].championships}`);
    } else {
      console.log(`  ${playoffResult.playerMadePlayoffs ? 'Made playoffs' : 'Missed'} | Champ: ${playoffResult.champion.city} ${playoffResult.champion.name}`);
    }

    // --- End of Season Flow ---
    const newSeason = season + 1;

    try { gmRep = updateGMReputation(gmRep, fr[0], prevFr); } catch (e) {
      errors.push(`CRASH updateGMReputation S${season}: ${e.message}`); console.error(`  FATAL: ${e.stack}`);
    }
    assert(isFiniteNum(gmRep), `[S${season}] gmRep not finite: ${gmRep}`);

    // League history
    try {
      const nglStandings = [...lt.ngl].sort((a, b) => b.wins - a.wins);
      const champion = nglStandings[0];
      if (champion) {
        leagueHistory = addChampion(leagueHistory, {
          season, teamName: champion.name, city: champion.city,
          isPlayerTeam: fr.some(p => p.id === champion.id),
          record: `${champion.wins}-${champion.losses}`,
        });
        leagueHistory = checkNotableSeasons(leagueHistory, [...lt.ngl, ...lt.abl], fr, season);
      }
    } catch (e) { errors.push(`CRASH league history S${season}: ${e.message}`); console.error(`  FATAL: ${e.stack}`); }

    // Franchise records
    try {
      const curRecords = fr[0].franchiseRecords || initFranchiseRecords();
      const { records: newRecords } = updateFranchiseRecords(curRecords, fr[0], season);
      fr[0] = { ...fr[0], franchiseRecords: newRecords };
    } catch (e) { errors.push(`CRASH updateFranchiseRecords S${season}: ${e.message}`); }

    // HOF
    try {
      for (const slotKey of ['star1', 'star2', 'corePiece']) {
        const p = fr[0][slotKey];
        if (p && p.age >= 34 && p.rating < 70) {
          const hof = evaluateHallOfFame(p, fr[0]);
          if (hof) leagueHistory = { ...leagueHistory, hallOfFame: [...(leagueHistory.hallOfFame || []), { ...hof, inductionSeason: season }] };
        }
      }
    } catch (e) { errors.push(`CRASH evaluateHallOfFame S${season}: ${e.message}`); }

    // Rivalry
    try {
      const leagueTeams = lt[fr[0].league] || [];
      const h2h = fr[0].headToHead || initHeadToHead();
      const curRivalry = fr[0].rivalry || initRivalry();
      const newRivalry = updateRivalry(curRivalry, fr[0], leagueTeams, season, h2h, false);
      fr[0] = { ...fr[0], rivalry: newRivalry };
    } catch (e) { errors.push(`CRASH updateRivalry S${season}: ${e.message}`); console.error(`  FATAL: ${e.stack}`); }

    // Notifications
    try {
      const notifs = generateNotifications(fr[0], prevFr);
      assert(Array.isArray(notifs), `[S${season}] notifications not array`);
    } catch (e) { errors.push(`CRASH generateNotifications S${season}: ${e.message}`); console.error(`  FATAL: ${e.stack}`); }

    // Newspaper
    try {
      const standings = [...lt.ngl].sort((a, b) => b.wins - a.wins);
      const newspaper = generateNewspaper(standings, fr, season, lt);
      assert(newspaper != null, `[S${season}] newspaper null`);
    } catch (e) { errors.push(`CRASH generateNewspaper S${season}: ${e.message}`); console.error(`  FATAL: ${e.stack}`); }

    // Press conference + CBA
    try { genPressConference(fr[0]); } catch (e) { errors.push(`CRASH genPressConference S${season}: ${e.message}`); }
    try { generateCBAEvent(season); } catch (e) { errors.push(`CRASH generateCBAEvent S${season}: ${e.message}`); }

    // Extension demands
    try {
      const demands = generateExtensionDemands(fr[0], gmRep);
      assert(Array.isArray(demands), `[S${season}] extension demands not array`);
    } catch (e) { errors.push(`CRASH generateExtensionDemands S${season}: ${e.message}`); console.error(`  FATAL: ${e.stack}`); }

    // Pressure event
    try { checkPressureEvent(fr[0], season); } catch (e) { errors.push(`CRASH checkPressureEvent S${season}: ${e.message}`); }

    // Draft
    try {
      const picks = generateDraftPickPositions(fr[0], lt);
      assert(Array.isArray(picks), `[S${season}] draft picks not array`);
      const prospects = generateDraftProspects(fr[0].league, 20, fr[0].scoutingStaff, picks[0]?.round || 1);
      assert(prospects.length > 0, `[S${season}] no draft prospects`);
    } catch (e) { errors.push(`CRASH draft generation S${season}: ${e.message}`); console.error(`  FATAL: ${e.stack}`); }

    // Free agents
    try {
      const faPool = generateOffseasonFAPool(fr[0].league, gmRep, 10);
      const aiFA = simulateAIFreeAgency(faPool, lt, fr[0].league);
      assert(Array.isArray(aiFA.remaining), `[S${season}] AI FA remaining not array`);
    } catch (e) { errors.push(`CRASH free agency S${season}: ${e.message}`); console.error(`  FATAL: ${e.stack}`); }

    // Refresh inventory
    try { fr[0] = { ...fr[0], draftPickInventory: initDraftPickInventory(newSeason, fr[0].id) }; } catch (e) { errors.push(`CRASH initDraftPickInventory S${season}: ${e.message}`); }

    // Valuation & cap
    try {
      const val = calculateValuation(fr[0]);
      assert(isFiniteNum(val), `[S${season}] valuation not finite: ${val}`);
      const cap = calculateCapSpace(fr[0]);
      assert(isFiniteNum(cap.space), `[S${season}] cap space not finite: ${cap.space}`);
    } catch (e) { errors.push(`CRASH valuation/cap S${season}: ${e.message}`); console.error(`  FATAL: ${e.stack}`); }

    // Naming rights
    try { if (!fr[0].namingRightsActive && fr[0].fanRating >= 55) generateNamingRightsOffer(fr[0]); } catch (e) { errors.push(`CRASH naming rights S${season}: ${e.message}`); }

    // Sync back
    lt.ngl = lt.ngl.map(t => t.id === fr[0].id ? { ...t, ...fr[0] } : t);

    // Track growth
    growthTracker.historyLen.push(fr[0].history.length);
    growthTracker.deadCapLogLen.push((fr[0].deadCapLog || []).length);
    growthTracker.localLegendsLen.push((fr[0].localLegends || []).length);
    growthTracker.notableSeasonsLen.push((leagueHistory.notableSeasons || []).length);
    growthTracker.championsLen.push((leagueHistory.champions || []).length);
    growthTracker.hallOfFameLen.push((leagueHistory.hallOfFame || []).length);
    growthTracker.cashOverTime.push(fr[0].cash);
    growthTracker.rqOverTime.push(fr[0].rosterQuality);

    console.log(`  GM: ${gmRep} (${getGMTier(gmRep).label}) | Stadium: ${fr[0].stadiumCondition} | Chem: ${fr[0].lockerRoomChemistry}`);
  }

  // ── Phase 3: Growth Analysis ──────────────────────────────────
  console.log(`\n========================================`);
  console.log(`  GROWTH ANALYSIS`);
  console.log(`========================================\n`);

  const last = (arr) => arr[arr.length - 1];
  console.log(`  History entries:       ${last(growthTracker.historyLen)} (expected ~${15})`);
  console.log(`  Dead cap log entries:  ${last(growthTracker.deadCapLogLen)}`);
  console.log(`  Local legends:         ${last(growthTracker.localLegendsLen)}`);
  console.log(`  Notable seasons:       ${last(growthTracker.notableSeasonsLen)}`);
  console.log(`  Champions log:         ${last(growthTracker.championsLen)}`);
  console.log(`  Hall of Fame:          ${last(growthTracker.hallOfFameLen)}`);
  console.log(`  Cash trajectory:       ${growthTracker.cashOverTime.map(c => `$${c}M`).join(' -> ')}`);
  console.log(`  RQ trajectory:         ${growthTracker.rqOverTime.join(' -> ')}`);

  if (last(growthTracker.historyLen) > 16) warn(`History grew to ${last(growthTracker.historyLen)} (expected ~15)`);
  if (last(growthTracker.deadCapLogLen) > 45) warn(`Dead cap log grew to ${last(growthTracker.deadCapLogLen)} entries`);
  if (last(growthTracker.localLegendsLen) > 30) warn(`Local legends grew to ${last(growthTracker.localLegendsLen)}`);

  // ── Phase 4: Edge Case Tests ──────────────────────────────────
  console.log(`\n========================================`);
  console.log(`  EDGE CASE TESTS`);
  console.log(`========================================\n`);

  // Test: All slots empty
  console.log('  Test: calcSlotQuality with all empty slots...');
  try {
    let emptySlotsFr = { ...fr[0], star1: null, star2: null, corePiece: null, players: [] };
    const quality = calcSlotQuality(emptySlotsFr);
    assert(isFiniteNum(quality), `calcSlotQuality empty slots returned: ${quality}`);
    console.log(`    ✓ Result: ${quality}`);
  } catch (e) {
    errors.push(`CRASH empty slots: ${e.message}`);
    console.error(`    ✗ ${e.message}`);
  }

  // Test: Division by zero in chemistry calc (empty players)
  console.log('  Test: Chemistry division by zero (empty players)...');
  {
    const playersLen = 0;
    const cd = 0;
    const chemCalc = playersLen > 0 ? cd / playersLen * 3 : 0;
    if (playersLen === 0) {
      warn('BUG: simPlayerSeason line ~371 and simPlayerSeasonSecondHalf line ~594: cd / f.players.length * 3 causes NaN when players is empty (all slots retired). Needs guard: Math.max(1, f.players.length)');
    }
    console.log(`    ✓ Edge case documented`);
  }

  // Test: generateNewspaper with empty standings
  console.log('  Test: generateNewspaper with empty standings...');
  try {
    const paper = generateNewspaper([], fr, 1, lt);
    assert(paper != null, 'generateNewspaper([]) should return an object');
    assert(typeof paper.headline === 'string', 'newspaper headline should be a string');
    console.log(`    ✓ Handled gracefully: "${paper.headline}"`);
  } catch (e) {
    errors.push(`generateNewspaper crashes with empty standings: "${e.message}"`);
    console.error(`    ✗ ${e.message}`);
  }

  // Test: endOfSeasonAging with undefined morale
  console.log('  Test: endOfSeasonAging with undefined morale...');
  try {
    let testFr = { ...fr[0] };
    if (testFr.star1) {
      testFr = { ...testFr, star1: { ...testFr.star1, morale: undefined } };
      testFr.players = [testFr.star1, testFr.star2, testFr.corePiece].filter(Boolean);
    }
    const aged = endOfSeasonAging(testFr, 0.5);
    if (aged.star1 && !isFiniteNum(aged.star1.rating)) {
      errors.push('BUG: endOfSeasonAging — undefined morale causes NaN rating (line 896: (p.morale - 50) * 0.015)');
      console.error('    ✗ Undefined morale -> NaN rating');
    } else if (aged.star1) {
      console.log(`    ✓ Handled ok: rating=${aged.star1.rating}`);
    } else {
      console.log(`    - star1 retired/null, skipping morale check`);
    }
  } catch (e) {
    errors.push(`CRASH aging undefined morale: ${e.message}`);
    console.error(`    ✗ ${e.message}`);
  }

  // Test: calculateValuation on bankrupt franchise
  console.log('  Test: Valuation on bankrupt franchise...');
  try {
    let bankruptFr = { ...fr[0], cash: -500, debt: 200, fanRating: 5, rosterQuality: 30 };
    const val = calculateValuation(bankruptFr);
    assert(isFiniteNum(val), `Bankrupt valuation not finite: ${val}`);
    console.log(`    ✓ Bankrupt valuation: $${val}M`);
  } catch (e) {
    errors.push(`CRASH bankrupt valuation: ${e.message}`);
    console.error(`    ✗ ${e.message}`);
  }

  // ── Phase 5: Report ──────────────────────────────────────────
  console.log(`\n========================================`);
  console.log(`  FINAL REPORT`);
  console.log(`========================================\n`);

  if (errors.length === 0 && warnings.length === 0) {
    console.log('  ALL TESTS PASSED — No errors or warnings!\n');
  } else {
    if (errors.length > 0) {
      console.log(`  ${errors.length} ERROR(S):`);
      errors.forEach((e, i) => console.log(`    ${i + 1}. ${e}`));
      console.log('');
    }
    if (warnings.length > 0) {
      console.log(`  ${warnings.length} WARNING(S):`);
      warnings.forEach((w, i) => console.log(`    ${i + 1}. ${w}`));
      console.log('');
    }
  }

  console.log(`  Summary: ${errors.length} errors, ${warnings.length} warnings`);
  console.log(`  Seasons simulated: 15`);
  console.log(`  Final franchise: ${fr[0].city} ${fr[0].name}`);
  console.log(`  Final cash: $${fr[0].cash}M`);
  console.log(`  Final record: ${fr[0].wins}-${fr[0].losses}`);
  console.log(`  Championships: ${fr[0].championships || 0}`);
  console.log(`  GM Rep: ${gmRep} (${getGMTier(gmRep).label})`);
  console.log('');

  return { errors, warnings };
}

// ── Run ──────────────────────────────────────────────────────────
try {
  const result = runStressTest();
  process.exit(result.errors.length > 0 ? 1 : 0);
} catch (e) {
  console.error(`\nFATAL UNHANDLED ERROR:\n${e.stack || e.message}`);
  process.exit(2);
}
