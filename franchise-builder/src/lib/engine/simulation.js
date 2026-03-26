import {
  NGL_TEAMS, ABL_TEAMS, RIVALRIES, NGL_POSITIONS, ABL_POSITIONS,
  NGL_ROSTER_SIZE, ABL_ROSTER_SIZE, NGL_SALARY_CAP, ABL_SALARY_CAP,
  REVENUE_SHARE_PCT, DEBT_INTEREST, TICKET_BASE_PRICE,
  STADIUM_TIERS, STADIUM_NAMING_FLAVORS, CITY_ECONOMY,
  getMarketTier, MARKET_STADIUM_CAPACITY, STADIUM_SUFFIXES,
  NGL_CONFERENCES, STAFF_SALARIES, PEAK_AGES, getStadiumTierFromCapacity,
} from '@/data/leagues';
import { generatePlayerName, generateCoachName } from '@/data/names';
import {
  rand, randFloat, pick, clamp, r1, generateId,
  generatePlayer, generateRoster, generateCoach,
  generateOC, generateDC, generatePDC,
  calcSlotQuality, calcDepthQuality, SLOT_BUDGET,
  generateInitialSlots, generateDraftPickPositions,
  initDraftPickInventory,
  updateStaffChemistry, calculateSchemeFit,
  endOfSeasonAging,
} from './roster';
import { calcAttendance, calculateValuation, getFranchiseAskingPrice, calculateEndSeasonFinances } from './finance';
import {
  updateCityEconomy, advanceStadiumProject,
  initFranchiseRecords, initHeadToHead, initRivalry,
} from './events';

// ============================================================
// ML MODELS
// ============================================================

/**
 * Predicts player rating development delta for a season.
 * @param {number} age - Player age
 * @param {number} rating - Current rating
 * @param {number} morale - Player morale (0–100)
 * @param {number} devStaff - Development staff level
 * @param {string|null} trait - Player trait
 * @param {string} league - League identifier ('ngl' or 'abl')
 * @returns {number} Rating change (can be negative)
 */
export function predictDev(age, rating, morale, devStaff, trait, league) {
  const [ps, pe] = PEAK_AGES[league] || [26, 30];
  let af = age < ps ? (ps - age) * 0.6 : age <= pe ? 0.3 : -(age - pe) * 0.8;
  let tb = 0;
  if (trait === 'hometown') tb = 0.3;
  if (trait === 'volatile') tb = randFloat(-1, 1.5);
  if (trait === 'leader') tb = 0.2;
  const cp = rating > 85 ? -(rating - 85) * 0.15 : 0;
  return Math.round(clamp(af + devStaff * 0.5 + (morale - 50) * 0.015 + tb + cp + randFloat(-1.5, 1.5), -5, 8));
}

/**
 * Predicts a player's injury probability for the season.
 * @param {number} age - Player age
 * @param {number} seasons - Seasons played (career wear)
 * @param {number} medStaff - Medical staff level
 * @param {string|null} trait - Player trait
 * @param {number} rating - Player rating
 * @returns {number} Injury probability clamped to [0.02, 0.65]
 */
export function predictInjury(age, seasons, medStaff, trait, rating) {
  let r = 0.08;
  if (age > 30) r += (age - 30) * 0.02;
  if (age > 34) r += (age - 34) * 0.03;
  r += seasons * 0.005 - medStaff * 0.025;
  if (trait === 'injury_prone') r *= 2;
  if (trait === 'ironman') r *= 0.4;
  if (rating > 85) r *= 0.85;
  return clamp(r + randFloat(-0.02, 0.02), 0.02, 0.65);
}

/** Helper: total staff salary expense for coordinators */
function calcCoordSalaries(f) {
  let total = 0;
  if (f.offensiveCoordinator) total += STAFF_SALARIES.oc[f.offensiveCoordinator.level] || 1;
  if (f.defensiveCoordinator) total += STAFF_SALARIES.dc[f.defensiveCoordinator.level] || 1;
  if (f.playerDevCoach) total += STAFF_SALARIES.pdc[f.playerDevCoach.level] || 0.8;
  return total;
}

function getSeasonGames(league) {
  return league === 'ngl' ? 17 : 82;
}

function sortTeamsByStanding(a, b) {
  const aGP = Math.max(1, (a.wins || 0) + (a.losses || 0));
  const bGP = Math.max(1, (b.wins || 0) + (b.losses || 0));
  const wpDiff = (b.wins / bGP) - (a.wins / aGP);
  if (Math.abs(wpDiff) > 0.001) return wpDiff;
  return ((b.rosterQuality || 0) - (a.rosterQuality || 0)) || a.id.localeCompare(b.id);
}

function applyLeagueStandings(teams, playoffSlots) {
  teams.forEach((t, i) => { t.playoffTeam = i < playoffSlots; t.leagueRank = i + 1; }); // Bugfix: playoff flags now match each league's actual field size so the standings cut line stays accurate.
  return teams;
}

// ============================================================
// SHARED WIN PROBABILITY ENGINE
// ============================================================

/**
 * Calculates pre-injury win probability for both AI and Player teams.
 * Applies a mathematical, interconnected scale based on compounding factors.
 */
function calcWinProb(f, options = {}) {
  const isAI = options.isAI || false;

  // 1. ROSTER QUALITY FACTOR
  let slotQ = 70;
  if (!isAI && f.star1 !== undefined) {
    slotQ = calcSlotQuality(f);
  } else {
    slotQ = f.rosterQuality || 70;
  }
  let rosterDelta = (slotQ - 72) / 40;

  // 2. COACHING FACTOR
  const coachLevel = f.coach?.level || 1;
  const coachMult = 0.85 + coachLevel * 0.075;
  rosterDelta *= coachMult;

  // 3. SCHEME & STAFF FACTOR (Player only)
  let schemeFitBonus = 0;
  let staffChemBonus = 0;
  let ocBonus = 0;
  let dcBonus = 0;
  if (!isAI) {
    const schemeFit = f.schemeFit || 50;
    const staffChem = f.staffChemistry || 65;
    schemeFitBonus = (schemeFit - 50) / 1000;
    staffChemBonus = (staffChem - 65) / 800;
    const _oc = f.offensiveCoordinator;
    const _dc = f.defensiveCoordinator;
    ocBonus = _oc ? (_oc.scheme === 'run_heavy' ? 0.01 : _oc.scheme === 'pass_heavy' ? 0.015 : 0.005) : 0;
    dcBonus = _dc ? (_dc.scheme === 'aggressive' ? 0.015 : _dc.scheme === 'zone' ? 0.01 : 0.005) : 0;
  }

  // 4. FACILITY FACTOR (Player only)
  const facilityFactor = !isAI ? (((f.trainingFacility || 1) + (f.filmRoom || 1)) * 0.01) : 0;

  // 5. CHEMISTRY FACTOR
  const chemFactor = ((f.lockerRoomChemistry || 65) - 50) * 0.002;

  // 6. MOMENTUM FACTOR
  let momentumDelta = 0;
  if (f.history && f.history.length > 0) {
    const hist = f.history;

    // Win% trend
    let momentumBonus = 0;
    if (hist.length >= 2) {
      const getWp = h => h.winPct !== undefined ? h.winPct : (h.wins / Math.max(1, h.wins + h.losses));
      const recentWP = getWp(hist[hist.length - 1]);
      const prevWP = getWp(hist[hist.length - 2]);
      const trend = recentWP - prevWP;
      momentumBonus = clamp(trend * 0.15, -0.04, 0.04);
    }

    // Winning streak (Dynasty)
    let streak = 0;
    for (let i = hist.length - 1; i >= 0; i--) {
      const h = hist[i];
      const wp = h.winPct !== undefined ? h.winPct : (h.wins / Math.max(1, h.wins + h.losses));
      if (wp > 0.5) streak++;
      else break;
    }
    const dynastyBonus = Math.min(streak * 0.008, 0.025);

    // Losing streak (Collapse)
    let loseStreak = 0;
    for (let i = hist.length - 1; i >= 0; i--) {
      const h = hist[i];
      const wp = h.winPct !== undefined ? h.winPct : (h.wins / Math.max(1, h.wins + h.losses));
      if (wp < 0.4) loseStreak++;
      else break;
    }
    const collapsePenalty = -Math.min(loseStreak * 0.010, 0.030);

    momentumDelta = momentumBonus + dynastyBonus + collapsePenalty;
  }

  // 7. FAN RATING FACTOR
  const homeFactor = ((f.fanRating || 50) - 50) * 0.0008;

  // ASSEMBLE WP
  let wp = 0.40 + rosterDelta + facilityFactor + chemFactor + ocBonus + dcBonus + schemeFitBonus + staffChemBonus + momentumDelta + homeFactor;

  // VARIANCE
  const structuralVar = isAI ? randFloat(-0.06, 0.06) : randFloat(-0.04, 0.04);
  const schemeVar = isAI ? 0 : (f.offensiveCoordinator?.scheme === 'balanced' ? randFloat(-0.03, 0.03) : randFloat(-0.05, 0.05));

  return clamp(wp + structuralVar + schemeVar, 0.06, 0.82);
}

// ============================================================
// SEASON SIMULATION — AI TEAMS
// ============================================================

/**
 * Simulates a full season for an AI-controlled team.
 * @param {Object} team - AI team state
 * @param {number} season - Season number
 * @returns {Object} Updated AI team state
 */
export function simAITeam(team, season) {
  const lg = team.league;
  const games = getSeasonGames(lg); // Bugfix: AI season length now comes from the same league-aware helper used across the sim.

  let wp = calcWinProb(team, { isAI: true });

  let w = 0;
  for (let g = 0; g < games; g++) if (Math.random() < wp) w++;
  const winPct = w / games;
  const att = calcAttendance(80, team.fanRating, winPct, team.market, team.stadiumCondition, team.rosterQuality || 70);
  const revenue = r1(
    att * team.stadiumCapacity * 80 * games / 1e6 +
    team.market * randFloat(0.8, 1.2) +
    team.market * winPct * randFloat(0.3, 0.6)
  );
  const expenses = r1(team.totalSalary + team.market * randFloat(0.3, 0.6));
  const profit = r1(revenue - expenses);
  const newFanRating = winPct > 0.6
    ? clamp(team.fanRating + rand(1, 4), 0, 100)
    : winPct < 0.35
      ? clamp(team.fanRating - rand(1, 5), 0, 100)
      : team.fanRating;
  const newStadiumAge = team.stadiumAge + 1;
  const newStadiumCondition = newStadiumAge > 15
    ? clamp(team.stadiumCondition - rand(1, 3), 20, 100)
    : team.stadiumCondition;
  let players = team.players.map(p => {
    const aged = { ...p };
    aged.age++;
    aged.seasonsPlayed++;
    const d = predictDev(aged.age, aged.rating, 65, 1, aged.trait, lg);
    aged.rating = clamp(aged.rating + d, 40, 99);
    return aged;
  });
  players = players.filter(p => !(p.age >= 35 && Math.random() < 0.3) && p.age < 38);
  const pos = lg === 'ngl' ? NGL_POSITIONS : ABL_POSITIONS;
  const tgt = lg === 'ngl' ? NGL_ROSTER_SIZE : ABL_ROSTER_SIZE;
  while (players.length < tgt) {
    players.push(generatePlayer(pos[players.length % pos.length], lg, { age: rand(22, 24), rating: rand(55, 72) }));
  }
  const rosterQuality = Math.round(players.reduce((s, p) => s + p.rating, 0) / players.length);
  let coach = team.coach;
  if (coach) {
    coach = { ...coach, seasonsWithTeam: coach.seasonsWithTeam + 1 };
    if (winPct < 0.35 && coach.seasonsWithTeam >= 2 && Math.random() < 0.5) coach = generateCoach();
  }
  let history = [...(team.history || []), { season, wins: w, losses: games - w, winPct: r1(winPct), rosterQuality, revenue, fanRating: newFanRating }];
  if (history.length > 25) history = history.slice(-25);
  return {
    ...team,
    wins: w,
    losses: games - w,
    season,
    finances: { revenue, expenses, profit },
    fanRating: newFanRating,
    stadiumAge: newStadiumAge,
    stadiumCondition: newStadiumCondition,
    players,
    rosterQuality,
    coach,
    history,
  };
}

// ============================================================
// PLAYER FRANCHISE SEASON SIM
// ============================================================

/**
 * Simulates a complete season for a player-controlled franchise.
 * Applies economy cycle, injuries, wins, revenue, player dev, retirements,
 * stadium age, coach update, and pushes to history.
 * @param {Object} f - Player franchise state
 * @param {number} season - Season number
 * @returns {Object} Updated franchise state
 */
export function simPlayerSeason(f, season) {
  const lg = f.league;
  const games = getSeasonGames(lg);

  // Phase 3: Roll deferred dead cap into current season cap dead money
  if (f.deferredDeadCap > 0) {
    f = { ...f, capDeadMoney: r1((f.capDeadMoney || 0) + f.deferredDeadCap), deferredDeadCap: 0 };
  }

  // Economy cycle
  f = updateCityEconomy(f);
  const econMod = f.economyCycle === 'boom' ? 1.10 : f.economyCycle === 'recession' ? 0.85 : 1.0;
  // A1: Advance stadium project if one is in progress
  if (f.stadiumProject) f = advanceStadiumProject(f, season);

  let wp = calcWinProb(f, { isAI: false });

  // Injuries (works on f.players = slot players for 3-slot model)
  f.players.forEach(p => {
    const risk = predictInjury(p.age, p.seasonsPlayed, f.medicalStaff, p.trait, p.rating);
    if (Math.random() < risk) {
      p.injured = true;
      const sr = Math.random();
      if (sr < 0.5) { p.injurySeverity = 'minor'; p.gamesOut = rand(2, 4); }
      else if (sr < 0.85) { p.injurySeverity = 'moderate'; p.gamesOut = rand(6, 10); }
      else { p.injurySeverity = 'severe'; p.gamesOut = games; }
    } else {
      p.injured = false;
      p.injurySeverity = null;
      p.gamesOut = 0;
    }
  });
  // Phase 2: injury WP impact by severity
  f.players.forEach(p => {
    if (!p.injured) return;
    if (p.injurySeverity === 'minor') wp -= 0.02;
    else if (p.injurySeverity === 'moderate') wp -= 0.04;
    else if (p.injurySeverity === 'severe') wp -= 0.07;
  });
  wp = clamp(wp, 0.05, 0.80);

  let w = 0;
  for (let g = 0; g < games; g++) if (Math.random() < wp) w++;
  f.wins = w;
  f.losses = games - w;
  f.season = season;
  const winPct = w / games;

  // Revenue & expenses
  f = calculateEndSeasonFinances(f, winPct, games, econMod);

  // Naming rights countdown
  if (f.namingRightsActive && f.namingRightsYears) {
    f.namingRightsYears--;
    if (f.namingRightsYears <= 0) {
      f.namingRightsActive = false;
      f.namingRightsDeal = null;
      f.namingRightsName = null;
    }
  }
  // A1: Honeymoon countdown
  if ((f.newStadiumHoneymoon || 0) > 0) f.newStadiumHoneymoon--;

  // Fan rating
  let fd = 0;
  if (winPct > 0.7) fd = rand(3, 6);
  else if (winPct > 0.55) fd = rand(1, 3);
  else if (winPct < 0.3) fd = -rand(3, 7);
  else if (winPct < 0.4) fd = -rand(1, 3);
  fd += f.marketingStaff * 0.5;
  // A1: Construction fan penalty
  if (f.stadiumUnderConstruction) fd -= 8;
  f.fanRating = clamp(Math.round(f.fanRating + fd), 0, 100);

  // Phase 3: naming rights sponsor pull-out if fans drop below 45
  if (f.namingRightsActive && f.fanRating < 45) {
    f.namingRightsActive = false;
    f.namingRightsDeal = null;
    f.namingRightsName = null;
    f.namingRightsYears = 0;
  }

  // Demographics
  if (winPct > 0.6) {
    f.fanDemographics.dieHard = clamp(f.fanDemographics.dieHard + rand(1, 3), 10, 70);
    f.fanDemographics.casual = 100 - f.fanDemographics.dieHard;
  } else if (winPct < 0.35) {
    f.fanDemographics.casual = clamp(f.fanDemographics.casual + rand(2, 5), 30, 90);
    f.fanDemographics.dieHard = 100 - f.fanDemographics.casual;
  }

  // Chemistry
  let cd = 0;
  f.players.forEach(p => {
    if (p.trait === 'leader' && p.morale > 60) cd += 2;
    if (p.trait === 'volatile') cd -= rand(2, 5);
    if (p.trait === 'showman') cd += winPct > 0.5 ? 2 : -3;
  });
  // mediaRep influence: high mediaRep slows chemistry decay, low accelerates it
  if (f.mediaRep > 70) cd += 1;
  else if (f.mediaRep < 40) cd -= 1;
  f.lockerRoomChemistry = clamp(Math.round(f.lockerRoomChemistry + cd / Math.max(1, f.players.length) * 3), 0, 100);

  // Unified end-of-season aging — 1.1
  f = endOfSeasonAging(f, winPct);

  // Stadium & coach
  f.stadiumAge++;
  if (f.stadiumAge > 12) f.stadiumCondition = clamp(f.stadiumCondition - rand(1, 3), 20, 100);
  f.coach.seasonsWithTeam++;
  f.coach.age++;
  if (winPct > 0.65) f.mediaRep = clamp(f.mediaRep + rand(1, 4), 0, 100);
  else if (winPct < 0.3) f.mediaRep = clamp(f.mediaRep - rand(1, 3), 0, 100);
  if (f.communityRating > 55) f.communityRating--;
  else if (f.communityRating < 45) f.communityRating++;

  if (f.star1 !== undefined) {
    f.depthQuality = calcDepthQuality(f);
    f.rosterQuality = calcSlotQuality(f);
  } else {
    f.rosterQuality = Math.round(f.players.reduce((s, p) => s + p.rating, 0) / Math.max(1, f.players.length));
  }
  f.totalSalary = r1(f.players.reduce((s, p) => s + p.salary, 0));
  // A2: Update staff chemistry and scheme fit at end of season
  f = updateStaffChemistry(f);
  f.schemeFit = calculateSchemeFit(f);

  // Championship check (rank #1 = championship) — set after standings calculated in simulateFullSeason
  f.history.push({
    season,
    wins: w,
    losses: games - w,
    winPct: r1(winPct),
    rosterQuality: f.rosterQuality,
    revenue: f.finances.revenue,
    expenses: f.finances.expenses,
    profit: f.finances.profit,
    fanRating: f.fanRating,
    cash: r1(f.cash),
    chemistry: f.lockerRoomChemistry,
    mediaRep: f.mediaRep,
    economy: f.economyCycle,
    injuries: f.players.filter(p => p.injured).map(p => ({ name: p.name, severity: p.injurySeverity })),
  });
  return f;
}

// ============================================================
// QUARTERLY SIMULATION (V4)
// ============================================================

/**
 * Simulates one quarter of a season for a player-controlled franchise.
 * @param {Object} f - Player franchise state
 * @param {number} season - Season number
 * @param {number} quarter - Quarter number (1–4)
 * @returns {Object} Updated franchise state
 */
export function simQuarter(f, season, quarter) {
  const lg = f.league;
  const totalGames = getSeasonGames(lg);
  const qStarts = [
    0,
    Math.floor(totalGames * 0.25),
    Math.floor(totalGames * 0.50),
    Math.floor(totalGames * 0.75),
  ];
  const qEnds = [
    Math.floor(totalGames * 0.25),
    Math.floor(totalGames * 0.50),
    Math.floor(totalGames * 0.75),
    totalGames,
  ];
  const gamesThisQuarter = qEnds[quarter - 1] - qStarts[quarter - 1];

  f = { ...f };
  f.mathBreakdowns = f.mathBreakdowns || {};

  // ── Q1-ONLY EFFECTS ──────────────────────────────────────────────
  if (quarter === 1) {
    // Roll deferred dead cap into current season cap dead money — ONLY in Q1
    if (f.deferredDeadCap > 0) {
      f.capDeadMoney = r1((f.capDeadMoney || 0) + f.deferredDeadCap);
      f.deferredDeadCap = 0;
    }

    // Economy cycle — ONLY in Q1
    f = updateCityEconomy(f);

    // Stadium project — ONLY in Q1
    if (f.stadiumProject) f = advanceStadiumProject(f, season);

    // Calculate and store win probability for the season (with breakdown)
    let wp = calcWinProb(f, { isAI: false });
    const wpFactors = [];

    // Build win probability breakdown
    const slotQ = f.star1 !== undefined ? calcSlotQuality(f) : (f.rosterQuality || 70);
    const playerFactor = (slotQ - 72) / 40;
    wpFactors.push({ label: 'Roster quality', impact: r1(playerFactor * 0.30 * 100) / 100 });

    const coachLevel = f.coach?.level || 1;
    wpFactors.push({ label: 'Coach level bonus', impact: r1((coachLevel * 0.075 - 0.15) * 100) / 100 });

    wpFactors.push({ label: 'Training facility', impact: r1(((f.trainingFacility || 1) + (f.filmRoom || 1)) * 0.01 * 100) / 100 });
    wpFactors.push({ label: 'Chemistry', impact: r1(((f.lockerRoomChemistry || 65) - 50) * 0.002 * 100) / 100 });

    const _oc = f.offensiveCoordinator;
    const _dc = f.defensiveCoordinator;
    if (_oc) wpFactors.push({ label: 'OC scheme bonus', impact: r1((_oc.scheme === 'pass_heavy' ? 0.015 : _oc.scheme === 'run_heavy' ? 0.01 : 0.005) * 100) / 100 });
    if (_dc) wpFactors.push({ label: 'DC scheme bonus', impact: r1((_dc.scheme === 'aggressive' ? 0.015 : _dc.scheme === 'zone' ? 0.01 : 0.005) * 100) / 100 });

    wpFactors.push({ label: 'Scheme fit', impact: r1(((f.schemeFit || 50) - 50) / 1000 * 100) / 100 });
    wpFactors.push({ label: 'Staff chemistry', impact: r1(((f.staffChemistry || 65) - 65) / 800 * 100) / 100 });

    // Training camp allocation bonus (point-based)
    const campOffense = f.trainingCampAllocation?.offense || 0;
    const campDefense = f.trainingCampAllocation?.defense || 0;
    const campConditioning = f.trainingCampAllocation?.conditioning || 0;
    if (campOffense > 0 && f.offensiveCoordinator) {
      wp += campOffense * 0.003;
      wpFactors.push({ label: 'Training camp (offense)', impact: r1(campOffense * 0.003) });
    }
    if (campDefense > 0 && f.defensiveCoordinator) {
      wp += campDefense * 0.003;
      wpFactors.push({ label: 'Training camp (defense)', impact: r1(campDefense * 0.003) });
    }
    if (campConditioning > 0) {
      wpFactors.push({ label: 'Training camp (conditioning)', impact: 0 });
    }

    f.mathBreakdowns.winProbability = {
      baseValue: 0.25,
      factors: wpFactors,
      finalValue: wp,
    };

    f._quarterWinProb = wp;
    f._quarterEconMod = f.economyCycle === 'boom' ? 1.10 : f.economyCycle === 'recession' ? 0.85 : 1.0;
    f._quarterGamesPlayed = 0;
    f.quarterWins = 0;
    f.quarterLosses = 0;
    f.season = season;
  }

  // ── INJURIES — every quarter ─────────────────────────────────────
  f.players = f.players.map(p => ({ ...p })); // shallow copy players
  // Re-sync slot refs
  if (f.star1?.id) f.star1 = f.players.find(pp => pp.id === f.star1.id) || f.star1;
  if (f.star2?.id) f.star2 = f.players.find(pp => pp.id === f.star2.id) || f.star2;
  if (f.corePiece?.id) f.corePiece = f.players.find(pp => pp.id === f.corePiece.id) || f.corePiece;

  f.players.forEach(p => {
    let risk = predictInjury(p.age, p.seasonsPlayed, f.medicalStaff, p.trait, p.rating);
    // Conditioning training camp bonus: point-based injury reduction for Q1 and Q2
    const condReduction = Math.min(0.50, (f.trainingCampAllocation?.conditioning || 0) * 0.05);
    if (condReduction > 0 && (quarter === 1 || quarter === 2)) {
      risk *= (1 - condReduction);
    }
    if (Math.random() < risk) {
      p.injured = true;
      const sr = Math.random();
      if (sr < 0.5) { p.injurySeverity = 'minor'; p.gamesOut = rand(2, 4); }
      else if (sr < 0.85) { p.injurySeverity = 'moderate'; p.gamesOut = rand(6, 10); }
      else { p.injurySeverity = 'severe'; p.gamesOut = totalGames; }
    } else {
      p.injured = false;
      p.injurySeverity = null;
      p.gamesOut = 0;
    }
  });

  // ── WIN PROBABILITY — use stored Q1 base with minor variance ─────
  let wp = f._quarterWinProb || 0.40;
  if (quarter > 1) {
    wp += randFloat(-0.02, 0.02); // momentum shifts
  }

  // Injury WP impact
  let injuryPenalty = 0;
  f.players.forEach(p => {
    if (!p.injured) return;
    if (p.injurySeverity === 'minor') injuryPenalty += 0.02;
    else if (p.injurySeverity === 'moderate') injuryPenalty += 0.04;
    else if (p.injurySeverity === 'severe') injuryPenalty += 0.07;
  });

  // Taxi squad coverage: reduce injury penalty if taxi players can fill in
  f.taxiCovering = [];
  const taxi = f.taxiSquad || [];
  if (taxi.length > 0 && injuryPenalty > 0) {
    const slots = ['star1', 'star2', 'corePiece'];
    for (const slotKey of slots) {
      const slotPlayer = f[slotKey];
      if (slotPlayer && slotPlayer.injured && (slotPlayer.injurySeverity === 'moderate' || slotPlayer.injurySeverity === 'severe')) {
        // Find the best available taxi player
        const bestTaxi = [...taxi]
          .filter(tp => !f.taxiCovering.some(tc => tc.playerId === tp.id))
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
        if (bestTaxi) {
          // Reduce penalty by 50% for this slot
          const slotPenalty = slotPlayer.injurySeverity === 'moderate' ? 0.04 : 0.07;
          injuryPenalty -= slotPenalty * 0.5;
          f.taxiCovering.push({ playerId: bestTaxi.id, playerName: bestTaxi.name, covering: slotKey, forPlayer: slotPlayer.name });
        }
      }
    }
  }

  wp -= Math.max(0, injuryPenalty);
  wp = clamp(wp, 0.05, 0.80);

  // ── SIMULATE GAMES ───────────────────────────────────────────────
  let qWins = 0;
  for (let g = 0; g < gamesThisQuarter; g++) {
    if (Math.random() < wp) qWins++;
  }
  f.quarterWins = (f.quarterWins || 0) + qWins;
  f.quarterLosses = (f.quarterLosses || 0) + (gamesThisQuarter - qWins);
  f._quarterGamesPlayed = (f._quarterGamesPlayed || 0) + gamesThisQuarter;

  // ── Q4-ONLY EFFECTS (END OF SEASON) ─────────────────────────────
  if (quarter === 4) {
    const w = f.quarterWins;
    const totalLosses = f.quarterLosses;
    f.wins = w;
    f.losses = totalLosses;
    const winPct = w / totalGames;
    const econMod = f._quarterEconMod || 1.0;

    // Revenue & expenses
    f = calculateEndSeasonFinances(f, winPct, totalGames, econMod);

    // Attendance breakdown (recompute lightweight values for mathBreakdowns display)
    const attRaw = calcAttendance(f.ticketPrice, f.fanRating, winPct, f.market, f.stadiumCondition, f.rosterQuality || 70);
    const att = f.namingRightsActive ? Math.max(0.25, attRaw - 0.03) : attRaw;
    const attBase = f.fanRating / 100 * 0.28 + winPct * 0.24 + f.market / 100 * 0.18 + f.stadiumCondition / 100 * 0.10 + 0.18;
    f.mathBreakdowns.attendance = {
      baseValue: r1(attBase * 100) / 100,
      factors: [
        { label: 'Naming rights penalty', impact: f.namingRightsActive ? -0.03 : 0 },
        { label: 'Economy modifier', impact: r1((econMod - 1.0) * 100) / 100 },
      ],
      finalValue: r1(att * 100) / 100,
    };

    // Revenue breakdown
    f.mathBreakdowns.revenue = {
      baseValue: f.finances.revenue,
      factors: [],
      finalValue: f.finances.revenue,
    };

    // Naming rights countdown
    if (f.namingRightsActive && f.namingRightsYears) {
      f.namingRightsYears--;
      if (f.namingRightsYears <= 0) {
        f.namingRightsActive = false;
        f.namingRightsDeal = null;
        f.namingRightsName = null;
      }
    }
    if ((f.newStadiumHoneymoon || 0) > 0) f.newStadiumHoneymoon--;

    // Fan rating
    let fd = 0;
    if (winPct > 0.7) fd = rand(3, 6);
    else if (winPct > 0.55) fd = rand(1, 3);
    else if (winPct < 0.3) fd = -rand(3, 7);
    else if (winPct < 0.4) fd = -rand(1, 3);
    const fdMarketing = f.marketingStaff * 0.5;
    fd += fdMarketing;
    const fdConstruction = f.stadiumUnderConstruction ? -8 : 0;
    if (f.stadiumUnderConstruction) fd -= 8;

    f.mathBreakdowns.fanRating = {
      baseValue: fd - fdMarketing - fdConstruction,
      factors: [
        { label: 'Marketing staff bonus', impact: fdMarketing },
        { label: 'Construction penalty', impact: fdConstruction },
      ],
      finalValue: fd,
    };

    f.fanRating = clamp(Math.round(f.fanRating + fd), 0, 100);

    // Naming rights sponsor pull-out
    if (f.namingRightsActive && f.fanRating < 45) {
      f.namingRightsActive = false;
      f.namingRightsDeal = null;
      f.namingRightsName = null;
      f.namingRightsYears = 0;
    }

    // Demographics
    if (winPct > 0.6) {
      f.fanDemographics = { ...f.fanDemographics };
      f.fanDemographics.dieHard = clamp(f.fanDemographics.dieHard + rand(1, 3), 10, 70);
      f.fanDemographics.casual = 100 - f.fanDemographics.dieHard;
    } else if (winPct < 0.35) {
      f.fanDemographics = { ...f.fanDemographics };
      f.fanDemographics.casual = clamp(f.fanDemographics.casual + rand(2, 5), 30, 90);
      f.fanDemographics.dieHard = 100 - f.fanDemographics.casual;
    }

    // Chemistry
    let cd = 0;
    const chemFactors = [];
    f.players.forEach(p => {
      if (p.trait === 'leader' && p.morale > 60) { cd += 2; chemFactors.push({ label: `Leader: ${p.name}`, impact: 2 }); }
      if (p.trait === 'volatile') { const v = -rand(2, 5); cd += v; chemFactors.push({ label: `Volatile: ${p.name}`, impact: v }); }
      if (p.trait === 'showman') { const v = winPct > 0.5 ? 2 : -3; cd += v; chemFactors.push({ label: `Showman: ${p.name}`, impact: v }); }
    });
    // mediaRep influence: high mediaRep slows chemistry decay, low accelerates it
    let mediaRepChemMod = 0;
    if (f.mediaRep > 70) mediaRepChemMod = 1;
    else if (f.mediaRep < 40) mediaRepChemMod = -1;
    cd += mediaRepChemMod;
    if (mediaRepChemMod !== 0) chemFactors.push({ label: 'Media reputation', impact: mediaRepChemMod });

    const chemDelta = Math.round(cd / Math.max(1, f.players.length) * 3);
    f.mathBreakdowns.lockerRoomChemistry = {
      baseValue: 0,
      factors: chemFactors,
      finalValue: chemDelta,
    };
    f.lockerRoomChemistry = clamp(f.lockerRoomChemistry + chemDelta, 0, 100);

    // End-of-season aging
    f = endOfSeasonAging(f, winPct);

    // Stadium & coach
    f.stadiumAge++;
    if (f.stadiumAge > 12) f.stadiumCondition = clamp(f.stadiumCondition - rand(1, 3), 20, 100);
    if (f.coach) {
      f.coach = { ...f.coach };
      f.coach.seasonsWithTeam++;
      f.coach.age++;
    }
    // Media rep with breakdown
    let mediaDelta = 0;
    if (winPct > 0.65) mediaDelta = rand(1, 4);
    else if (winPct < 0.3) mediaDelta = -rand(1, 3);
    f.mathBreakdowns.mediaRep = {
      baseValue: mediaDelta,
      factors: [],
      finalValue: mediaDelta,
    };
    f.mediaRep = clamp(f.mediaRep + mediaDelta, 0, 100);

    // Community rating with breakdown
    let commDelta = 0;
    if (f.communityRating > 55) commDelta = -1;
    else if (f.communityRating < 45) commDelta = 1;
    f.mathBreakdowns.communityRating = {
      baseValue: commDelta,
      factors: [],
      finalValue: commDelta,
    };
    f.communityRating = clamp(f.communityRating + commDelta, 0, 100);

    if (f.star1 !== undefined) {
      f.depthQuality = calcDepthQuality(f);
      f.rosterQuality = calcSlotQuality(f);
    } else {
      f.rosterQuality = Math.round(f.players.reduce((s, p) => s + p.rating, 0) / Math.max(1, f.players.length));
    }
    f.totalSalary = r1(f.players.reduce((s, p) => s + p.salary, 0));
    f = updateStaffChemistry(f);
    f.schemeFit = calculateSchemeFit(f);

    // History push
    f.history = [...(f.history || [])];
    f.history.push({
      season,
      wins: w,
      losses: totalLosses,
      winPct: r1(winPct),
      rosterQuality: f.rosterQuality,
      revenue: f.finances.revenue,
      expenses: f.finances.expenses,
      profit: f.finances.profit,
      fanRating: f.fanRating,
      cash: r1(f.cash),
      chemistry: f.lockerRoomChemistry,
      mediaRep: f.mediaRep,
      economy: f.economyCycle,
      injuries: f.players.filter(p => p.injured).map(p => ({ name: p.name, severity: p.injurySeverity })),
    });

    // Garbage collection (Phase 4C)
    const MAX_HISTORY = 25;
    if (f.history.length > MAX_HISTORY) f.history = f.history.slice(-MAX_HISTORY);
    if (f.deadCapLog && f.deadCapLog.length > MAX_HISTORY) f.deadCapLog = f.deadCapLog.slice(-MAX_HISTORY);
    if (f.leagueHistory?.champions?.length > MAX_HISTORY) {
      f.leagueHistory = { ...f.leagueHistory, champions: f.leagueHistory.champions.slice(-MAX_HISTORY) };
    }
    if (f.leagueHistory?.notableSeasons?.length > MAX_HISTORY) {
      f.leagueHistory = { ...f.leagueHistory, notableSeasons: f.leagueHistory.notableSeasons.slice(-MAX_HISTORY) };
    }

    // Cleanup quarter fields
    delete f.quarterWins;
    delete f.quarterLosses;
    delete f._quarterWinProb;
    delete f._quarterEconMod;
    delete f._quarterGamesPlayed;
    delete f.trainingCampFocus;
    delete f.trainingCampAllocation;
  }

  return f;
}

/**
 * League-level wrapper: simulates one quarter for all teams.
 * AI teams get full-season sim in Q1 only (skip Q2–Q4).
 * Player franchises get simQuarter() each quarter.
 * @param {Object} lt - League teams { ngl, abl }
 * @param {Object[]} pf - Player franchise array
 * @param {number} season - Season number
 * @param {number} quarter - Quarter (1–4)
 * @returns {{ leagueTeams: Object, franchises: Object[] }}
 */
export function simulateLeagueQuarter(lt, pf, season, quarter) {
  let ul;
  if (quarter === 1) {
    // AI teams: full-season sim in Q1
    ul = {
      ngl: lt.ngl.map(t => {
        if (pf.some(p => p.id === t.id)) return t;
        const simmed = simAITeam({ ...t }, season);
        // Garbage collection for AI team history
        if (simmed.history.length > 25) simmed.history = simmed.history.slice(-25);
        return simmed;
      }),
      abl: lt.abl.map(t => {
        if (pf.some(p => p.id === t.id)) return t;
        const simmed = simAITeam({ ...t }, season);
        if (simmed.history.length > 25) simmed.history = simmed.history.slice(-25);
        return simmed;
      }),
    };
  } else {
    ul = lt; // AI already simmed
  }

  // Player franchises: simQuarter each quarter
  const uf = pf.map(f => simQuarter({ ...f }, season, quarter));

  // After Q4, sync player standings into league teams & apply standings/championships/rev share
  if (quarter === 4) {
    uf.forEach(p => {
      const arr = ul[p.league];
      if (!arr) return;
      const i = arr.findIndex(t => t.id === p.id);
      if (i >= 0) arr[i] = { ...arr[i], wins: p.wins, losses: p.losses, rosterQuality: p.rosterQuality, fanRating: p.fanRating };
    });

    const ns = applyLeagueStandings([...ul.ngl].sort(sortTeamsByStanding), 12);
    const as2 = applyLeagueStandings([...ul.abl].sort(sortTeamsByStanding), 16);

    uf.forEach(p => {
      const s = (p.league === 'ngl' ? ns : as2).find(t => t.id === p.id);
      if (s) {
        p.leagueRank = s.leagueRank;
        p.playoffTeam = s.playoffTeam;
        if (s.leagueRank === 1 && p.league === 'abl') {
          p.championships = (p.championships || 0) + 1;
          p.trophies = [...(p.trophies || []), { season, wins: p.wins, losses: p.losses }];
        }
      }
    });

    // Revenue sharing
    const all = [...ul.ngl, ...ul.abl];
    const totalRev = all.reduce((s, t) => s + (t.finances?.revenue || 0), 0);
    const pool = totalRev * REVENUE_SHARE_PCT;
    const perTeam = all.length > 0 ? pool / all.length : 0;
    uf.forEach(p => {
      const share = r1(perTeam - p.finances.revenue * REVENUE_SHARE_PCT);
      p.cash = r1(p.cash + share);
      p.revShareReceived = share;
    });

    const leagueTeams = { ngl: ns, abl: as2 };
    return { leagueTeams, franchises: uf, standings: { ngl: ns, abl: as2 } };
  }

  return { leagueTeams: ul, franchises: uf };
}

// ============================================================
// HALF-SEASON SIMULATION (LEGACY — kept for backward compat)
// ============================================================

/**
 * Simulates only the first half of the season for a player franchise.
 * Applies economy cycle and injuries, runs games/2 game simulations.
 * Sets halfWins, halfLosses, _halfGames, and _halfWinProb on the returned franchise.
 * Does NOT apply end-of-season effects (revenue, player dev, retirements, etc.).
 * @param {Object} f - Player franchise state
 * @param {number} season - Season number
 * @returns {Object} Franchise with half-season fields populated
 */
export function simPlayerSeasonFirstHalf(f, season) {
  const lg = f.league;
  const games = getSeasonGames(lg);
  const halfGames = Math.floor(games / 2);

  // Phase 3: Roll deferred dead cap into current season cap dead money
  if (f.deferredDeadCap > 0) {
    f = { ...f, capDeadMoney: r1((f.capDeadMoney || 0) + f.deferredDeadCap), deferredDeadCap: 0 };
  }

  // Economy cycle
  f = updateCityEconomy(f);
  const econMod = f.economyCycle === 'boom' ? 1.10 : f.economyCycle === 'recession' ? 0.85 : 1.0;
  // A1: Advance stadium project if one is in progress
  if (f.stadiumProject) f = advanceStadiumProject(f, season);

  let wp = calcWinProb(f, { isAI: false });

  // Injuries (works on f.players = slot players for 3-slot model)
  f.players.forEach(p => {
    const risk = predictInjury(p.age, p.seasonsPlayed, f.medicalStaff, p.trait, p.rating);
    if (Math.random() < risk) {
      p.injured = true;
      const sr = Math.random();
      if (sr < 0.5) { p.injurySeverity = 'minor'; p.gamesOut = rand(2, 4); }
      else if (sr < 0.85) { p.injurySeverity = 'moderate'; p.gamesOut = rand(6, 10); }
      else { p.injurySeverity = 'severe'; p.gamesOut = games; }
    } else {
      p.injured = false;
      p.injurySeverity = null;
      p.gamesOut = 0;
    }
  });
  // Phase 2: injury WP impact by severity
  f.players.forEach(p => {
    if (!p.injured) return;
    if (p.injurySeverity === 'minor') wp -= 0.02;
    else if (p.injurySeverity === 'moderate') wp -= 0.04;
    else if (p.injurySeverity === 'severe') wp -= 0.07;
  });
  wp = clamp(wp, 0.05, 0.80);

  let w = 0;
  for (let g = 0; g < halfGames; g++) if (Math.random() < wp) w++;

  f.halfWins = w;
  f.halfLosses = halfGames - w;
  f._halfGames = halfGames;
  f._halfWinProb = wp;
  f._halfEconMod = econMod;
  f.season = season;

  return f;
}

/**
 * Completes the season from a half-season state.
 * Simulates remaining games using stored win probability, then applies all
 * end-of-season effects: revenue, fan rating, player dev, retirements,
 * stadium age, coach update, and history push.
 * Cleans up halfWins, halfLosses, _halfGames, _halfWinProb fields when done.
 * @param {Object} f - Franchise state with half-season fields set
 * @param {number} season - Season number
 * @returns {Object} Fully updated franchise state after complete season
 */
export function simPlayerSeasonSecondHalf(f, season) {
  const lg = f.league;
  const games = getSeasonGames(lg);
  const halfGames = f._halfGames || Math.floor(games / 2);
  const remainingGames = games - halfGames;
  const wp = f._halfWinProb || calcWinProb(f, { isAI: false });
  const econMod = f._halfEconMod || 1.0;

  // Simulate remaining games from half-season starting point
  let w = f.halfWins || 0;
  for (let g = 0; g < remainingGames; g++) if (Math.random() < wp) w++;
  const totalLosses = games - w;

  f.wins = w;
  f.losses = totalLosses;
  f.season = season;
  const winPct = w / games;

  // Revenue & expenses
  f = calculateEndSeasonFinances(f, winPct, games, econMod);

  // Naming rights countdown
  if (f.namingRightsActive && f.namingRightsYears) {
    f.namingRightsYears--;
    if (f.namingRightsYears <= 0) {
      f.namingRightsActive = false;
      f.namingRightsDeal = null;
      f.namingRightsName = null;
    }
  }
  // A1: Honeymoon countdown
  if ((f.newStadiumHoneymoon || 0) > 0) f.newStadiumHoneymoon--;

  // Fan rating
  let fd = 0;
  if (winPct > 0.7) fd = rand(3, 6);
  else if (winPct > 0.55) fd = rand(1, 3);
  else if (winPct < 0.3) fd = -rand(3, 7);
  else if (winPct < 0.4) fd = -rand(1, 3);
  fd += f.marketingStaff * 0.5;
  // A1: Construction fan penalty
  if (f.stadiumUnderConstruction) fd -= 8;
  f.fanRating = clamp(Math.round(f.fanRating + fd), 0, 100);

  // Phase 3: naming rights sponsor pull-out if fans drop below 45
  if (f.namingRightsActive && f.fanRating < 45) {
    f.namingRightsActive = false;
    f.namingRightsDeal = null;
    f.namingRightsName = null;
    f.namingRightsYears = 0;
  }

  // Demographics
  if (winPct > 0.6) {
    f.fanDemographics.dieHard = clamp(f.fanDemographics.dieHard + rand(1, 3), 10, 70);
    f.fanDemographics.casual = 100 - f.fanDemographics.dieHard;
  } else if (winPct < 0.35) {
    f.fanDemographics.casual = clamp(f.fanDemographics.casual + rand(2, 5), 30, 90);
    f.fanDemographics.dieHard = 100 - f.fanDemographics.casual;
  }

  // Chemistry
  let cd = 0;
  f.players.forEach(p => {
    if (p.trait === 'leader' && p.morale > 60) cd += 2;
    if (p.trait === 'volatile') cd -= rand(2, 5);
    if (p.trait === 'showman') cd += winPct > 0.5 ? 2 : -3;
  });
  // mediaRep influence: high mediaRep slows chemistry decay, low accelerates it
  if (f.mediaRep > 70) cd += 1;
  else if (f.mediaRep < 40) cd -= 1;
  f.lockerRoomChemistry = clamp(Math.round(f.lockerRoomChemistry + cd / Math.max(1, f.players.length) * 3), 0, 100);

  // Unified end-of-season aging — 1.1
  f = endOfSeasonAging(f, winPct);

  // Stadium & coach
  f.stadiumAge++;
  if (f.stadiumAge > 12) f.stadiumCondition = clamp(f.stadiumCondition - rand(1, 3), 20, 100);
  f.coach.seasonsWithTeam++;
  f.coach.age++;
  if (winPct > 0.65) f.mediaRep = clamp(f.mediaRep + rand(1, 4), 0, 100);
  else if (winPct < 0.3) f.mediaRep = clamp(f.mediaRep - rand(1, 3), 0, 100);
  if (f.communityRating > 55) f.communityRating--;
  else if (f.communityRating < 45) f.communityRating++;

  if (f.star1 !== undefined) {
    f.depthQuality = calcDepthQuality(f);
    f.rosterQuality = calcSlotQuality(f);
  } else {
    f.rosterQuality = Math.round(f.players.reduce((s, p) => s + p.rating, 0) / Math.max(1, f.players.length));
  }
  f.totalSalary = r1(f.players.reduce((s, p) => s + p.salary, 0));
  // A2: Update staff chemistry and scheme fit at end of season
  f = updateStaffChemistry(f);
  f.schemeFit = calculateSchemeFit(f);

  f.history.push({
    season,
    wins: w,
    losses: totalLosses,
    winPct: r1(winPct),
    rosterQuality: f.rosterQuality,
    revenue: f.finances.revenue,
    expenses: f.finances.expenses,
    profit: f.finances.profit,
    fanRating: f.fanRating,
    cash: r1(f.cash),
    chemistry: f.lockerRoomChemistry,
    mediaRep: f.mediaRep,
    economy: f.economyCycle,
    injuries: f.players.filter(p => p.injured).map(p => ({ name: p.name, severity: p.injurySeverity })),
  });

  // Clean up half-season fields
  delete f.halfWins;
  delete f.halfLosses;
  delete f._halfGames;
  delete f._halfWinProb;
  delete f._halfEconMod;

  return f;
}

// ============================================================
// FULL LEAGUE SIM + REVENUE SHARING + CHAMPIONSHIPS
// ============================================================

/**
 * Simulates a complete season for the entire league — AI teams get full sims,
 * player franchises get full sims via simPlayerSeason.
 * Calculates standings, championships, and revenue sharing.
 * @param {Object} lt - League teams state { ngl, abl }
 * @param {Object[]} pf - Array of player franchise states
 * @param {number} season - Season number
 * @returns {{ leagueTeams: Object, franchises: Object[], standings: Object }}
 */
export function simulateFullSeason(lt, pf, season) {
  const ul = {
    ngl: lt.ngl.map(t => pf.some(p => p.id === t.id) ? t : simAITeam({ ...t }, season)),
    abl: lt.abl.map(t => pf.some(p => p.id === t.id) ? t : simAITeam({ ...t }, season)),
  };
  const uf = pf.map(f => simPlayerSeason({ ...f }, season));
  uf.forEach(p => {
    const arr = ul[p.league];
    const i = arr.findIndex(t => t.id === p.id);
    if (i >= 0) arr[i] = { ...arr[i], wins: p.wins, losses: p.losses, rosterQuality: p.rosterQuality, fanRating: p.fanRating };
  });
  const ns = applyLeagueStandings([...ul.ngl].sort(sortTeamsByStanding), 12); // Bugfix: NGL standings now match the 12-team playoff field instead of over-qualifying teams.
  const as2 = applyLeagueStandings([...ul.abl].sort(sortTeamsByStanding), 16);

  // Championships & rankings
  // NGL championships awarded via simulatePlayoffs. ABL keeps rank-1 logic.
  uf.forEach(p => {
    const s = (p.league === 'ngl' ? ns : as2).find(t => t.id === p.id);
    if (s) {
      p.leagueRank = s.leagueRank;
      p.playoffTeam = s.playoffTeam;
      if (s.leagueRank === 1 && p.league === 'abl') {
        p.championships = (p.championships || 0) + 1;
        p.trophies = [...(p.trophies || []), { season, wins: p.wins, losses: p.losses }];
      }
    }
  });

  // Revenue sharing
  const all = [...ul.ngl, ...ul.abl];
  const totalRev = all.reduce((s, t) => s + (t.finances?.revenue || 0), 0);
  const pool = totalRev * REVENUE_SHARE_PCT;
  const perTeam = all.length > 0 ? pool / all.length : 0;
  uf.forEach(p => {
    const share = r1(perTeam - p.finances.revenue * REVENUE_SHARE_PCT);
    p.cash = r1(p.cash + share);
    p.revShareReceived = share;
  });

  return { leagueTeams: ul, franchises: uf, standings: { ngl: ns, abl: as2 } };
}

// ============================================================
// SPLIT-SEASON FULL LEAGUE SIMS
// ============================================================

/**
 * Runs the first half of the season for the full league.
 * AI teams receive full season simulations. Player franchises receive
 * first-half simulations via simPlayerSeasonFirstHalf.
 * @param {Object} lt - League teams state { ngl, abl }
 * @param {Object[]} pf - Array of player franchise states
 * @param {number} season - Season number
 * @returns {{ leagueTeams: Object, franchises: Object[] }}
 */
export function simulateFullSeasonFirstHalf(lt, pf, season) {
  const ul = {
    ngl: lt.ngl.map(t => pf.some(p => p.id === t.id) ? t : simAITeam({ ...t }, season)),
    abl: lt.abl.map(t => pf.some(p => p.id === t.id) ? t : simAITeam({ ...t }, season)),
  };
  const uf = pf.map(f => simPlayerSeasonFirstHalf({ ...f }, season));
  return { leagueTeams: ul, franchises: uf };
}

/**
 * Completes the second half of the season for player franchises and finalizes
 * league standings, championships, and revenue sharing.
 * @param {Object} lt - League teams state { ngl, abl } (already has AI sims from first half call)
 * @param {Object[]} pf - Array of player franchises with half-season fields set
 * @param {number} season - Season number
 * @returns {{ leagueTeams: Object, franchises: Object[], standings: Object }}
 */
export function simulateFullSeasonSecondHalf(lt, pf, season) {
  const uf = pf.map(f => simPlayerSeasonSecondHalf({ ...f }, season));
  uf.forEach(p => {
    const arr = lt[p.league];
    if (!arr) return;
    const i = arr.findIndex(t => t.id === p.id);
    if (i >= 0) arr[i] = { ...arr[i], wins: p.wins, losses: p.losses, rosterQuality: p.rosterQuality, fanRating: p.fanRating };
  });

  const ns = applyLeagueStandings([...lt.ngl].sort(sortTeamsByStanding), 12); // Bugfix: second-half standings reuse the same playoff cutoffs as the full-season path.
  const as2 = applyLeagueStandings([...lt.abl].sort(sortTeamsByStanding), 16);

  // Championships & rankings
  // NGL championships are awarded via simulatePlayoffs — not here.
  // ABL keeps the rank-1 championship logic (ABL is gated in UI).
  uf.forEach(p => {
    const s = (p.league === 'ngl' ? ns : as2).find(t => t.id === p.id);
    if (s) {
      p.leagueRank = s.leagueRank;
      p.playoffTeam = s.playoffTeam;
      if (s.leagueRank === 1 && p.league === 'abl') {
        p.championships = (p.championships || 0) + 1;
        p.trophies = [...(p.trophies || []), { season, wins: p.wins, losses: p.losses }];
      }
    }
  });

  // Revenue sharing
  const all = [...lt.ngl, ...lt.abl];
  const totalRev = all.reduce((s, t) => s + (t.finances?.revenue || 0), 0);
  const pool = totalRev * REVENUE_SHARE_PCT;
  const perTeam = all.length > 0 ? pool / all.length : 0;
  uf.forEach(p => {
    const share = r1(perTeam - p.finances.revenue * REVENUE_SHARE_PCT);
    p.cash = r1(p.cash + share);
    p.revShareReceived = share;
  });

  const leagueTeams = { ngl: ns, abl: as2 };
  return { leagueTeams, franchises: uf, standings: { ngl: ns, abl: as2 } };
}

// ============================================================
// NGL PLAYOFF BRACKET — 12-TEAM, 2-CONFERENCE
// ============================================================

/**
 * Simulates the full NGL 12-team playoff bracket (2 conferences of 6).
 * Seeds 1-2 per conference get a bye. Includes upset variance and home
 * field advantage (+0.05 WP) through conference championships; neutral site
 * for the championship game.
 *
 * @param {Object[]} nglTeams - All NGL teams with wins/losses/rosterQuality/seed
 * @param {Object|null} playerFranchise - The player's franchise (or null)
 * @returns {Object} { eastSeeds, westSeeds, rounds, champion, playerMadePlayoffs, playerEliminated, playerWonChampionship }
 */
export function simulatePlayoffs(nglTeams, playerFranchise) {
  const eastIds = new Set(NGL_CONFERENCES.East);
  const westIds = new Set(NGL_CONFERENCES.West);
  const eastAll = nglTeams.filter(t => eastIds.has(t.id)).sort(sortTeamsByStanding);
  const westAll = nglTeams.filter(t => westIds.has(t.id)).sort(sortTeamsByStanding);

  const eastSeeds = eastAll.slice(0, 6).map((t, i) => ({ ...t, seed: i + 1, conf: 'East' })); // Bugfix: conference seeds now stay ordered best-to-worst so seed #1 is always the top team.
  const westSeeds = westAll.slice(0, 6).map((t, i) => ({ ...t, seed: i + 1, conf: 'West' })); // Bugfix: west seeding mirrors the east path so seed numbers stay aligned with team quality.
  const seededTeamIds = new Set([...eastSeeds, ...westSeeds].map(t => t.id));
  // Graceful fallback instead of crashing if bracket data is incomplete
  if (seededTeamIds.size !== eastSeeds.length + westSeeds.length || eastSeeds.length < 6 || westSeeds.length < 6) {
    console.warn('Playoff bracket issue: duplicates or insufficient teams. Returning fallback.');
    const fallbackChamp = eastSeeds[0] || westSeeds[0] || nglTeams[0];
    return {
      eastSeeds, westSeeds, rounds: [],
      champion: fallbackChamp,
      playerMadePlayoffs: false, playerEliminated: true, playerWonChampionship: false,
    };
  }

  const playerMadePlayoffs = playerFranchise
    ? seededTeamIds.has(playerFranchise.id)
    : false;

  /** Simulate a single playoff game with upset variance & optional home advantage */
  function simGame(teamA, teamB, neutralSite = false) {
    const qA = teamA.rosterQuality || 70;
    const qB = teamB.rosterQuality || 70;

    // Base WP from quality difference
    const rosterDiff = (qA - qB) / 40;
    let wpA = 0.50 + rosterDiff * 0.35;

    // Upset variance: underdog (higher seed #) gets +0.08 per seed gap, max +0.20
    const seedDiff = Math.abs(teamA.seed - teamB.seed);
    const upsetBonus = Math.min(0.20, seedDiff * 0.08);
    if (teamA.seed > teamB.seed) wpA += upsetBonus;   // A is underdog
    else if (teamB.seed > teamA.seed) wpA -= upsetBonus; // B is underdog

    // Home field: top seed (lower #) hosts through conference championships
    if (!neutralSite) {
      if (teamA.seed < teamB.seed) wpA += 0.05;
      else if (teamB.seed < teamA.seed) wpA -= 0.05;
    }

    wpA = clamp(wpA, 0.10, 0.90);
    const winner = Math.random() < wpA ? teamA : teamB;
    const loser = winner.id === teamA.id ? teamB : teamA;
    const isUpset = winner.seed > loser.seed;
    const narrative = isUpset
      ? `${winner.city} ${winner.name} pull off the upset over #${loser.seed} ${loser.city} ${loser.name}.`
      : `#${winner.seed} ${winner.city} ${winner.name} advance past ${loser.city} ${loser.name}.`;
    return { teamA, teamB, winner, loser, wpA, narrative, isUpset };
  }

  const rounds = [];

  // ── Wild Card Round: 3v6, 4v5 per conference ──────────────────────
  const ewc1 = simGame(eastSeeds[2], eastSeeds[5]);
  const ewc2 = simGame(eastSeeds[3], eastSeeds[4]);
  const wwc1 = simGame(westSeeds[2], westSeeds[5]);
  const wwc2 = simGame(westSeeds[3], westSeeds[4]);
  rounds.push({
    name: 'Wild Card',
    games: [
      { conf: 'East', label: `#3 vs #6`, ...ewc1 },
      { conf: 'East', label: `#4 vs #5`, ...ewc2 },
      { conf: 'West', label: `#3 vs #6`, ...wwc1 },
      { conf: 'West', label: `#4 vs #5`, ...wwc2 },
    ],
  });

  // ── Divisional Round: 1 vs worst WC winner, 2 vs best WC winner ───
  const eWC = [ewc1.winner, ewc2.winner].sort((a, b) => b.seed - a.seed); // Bugfix: wild-card winners now sort weakest-to-strongest so the #1 seed gets the weaker remaining opponent.
  const wWC = [wwc1.winner, wwc2.winner].sort((a, b) => b.seed - a.seed); // Bugfix: west wild-card reassignment now matches the east bracket logic.
  const ediv1 = simGame(eastSeeds[0], eWC[0]);
  const ediv2 = simGame(eastSeeds[1], eWC[1]);
  const wdiv1 = simGame(westSeeds[0], wWC[0]);
  const wdiv2 = simGame(westSeeds[1], wWC[1]);
  rounds.push({
    name: 'Divisional',
    games: [
      { conf: 'East', label: `#1 vs #${eWC[0].seed}`, ...ediv1 },
      { conf: 'East', label: `#2 vs #${eWC[1].seed}`, ...ediv2 },
      { conf: 'West', label: `#1 vs #${wWC[0].seed}`, ...wdiv1 },
      { conf: 'West', label: `#2 vs #${wWC[1].seed}`, ...wdiv2 },
    ],
  });

  // ── Conference Championships ──────────────────────────────────────
  const eDivW = [ediv1.winner, ediv2.winner].sort((a, b) => a.seed - b.seed);
  const wDivW = [wdiv1.winner, wdiv2.winner].sort((a, b) => a.seed - b.seed);
  const eConf = simGame(eDivW[0], eDivW[1]);
  const wConf = simGame(wDivW[0], wDivW[1]);
  rounds.push({
    name: 'Conference Championship',
    games: [
      { conf: 'East', label: 'East Championship', ...eConf },
      { conf: 'West', label: 'West Championship', ...wConf },
    ],
  });

  // ── NGL Championship (neutral site) ──────────────────────────────
  const champ = simGame(eConf.winner, wConf.winner, true);
  rounds.push({
    name: 'NGL Championship',
    games: [{ conf: 'Neutral', label: 'NGL Championship', ...champ }],
  });

  const champion = champ.winner;

  // Track player journey
  let playerEliminated = null;
  let playerWonChampionship = false;
  if (playerFranchise && playerMadePlayoffs) {
    outer: for (const round of rounds) {
      for (const game of round.games) {
        if (game.loser?.id === playerFranchise.id) {
          playerEliminated = { roundName: round.name, opponent: game.winner };
          break outer;
        }
      }
    }
    if (champion.id === playerFranchise.id) playerWonChampionship = true;
  } else if (playerFranchise && !playerMadePlayoffs) {
    playerEliminated = { roundName: 'Regular Season', opponent: null };
  }

  return { eastSeeds, westSeeds, rounds, champion, playerMadePlayoffs, playerEliminated, playerWonChampionship };
}

// ============================================================
// AI FREE AGENCY COMPETITION
// ============================================================

/**
 * Simulates AI teams bidding on the free agent pool before the player acts.
 * Removes signed players from the pool. Returns signed log and remaining pool.
 * Target: ~40-60% of top-tier (75+) FAs signed by AI.
 *
 * @param {Object[]} pool - Full FA pool sorted by rating desc
 * @param {Object} leagueTeams - { ngl, abl }
 * @param {string} league - 'ngl' or 'abl'
 * @returns {{ signed: Object[], remaining: Object[] }}
 */
export function simulateAIFreeAgency(pool, leagueTeams, league) {
  const aiTeams = (leagueTeams[league] || [])
    .filter(t => !t.isPlayerOwned)
    .sort(() => Math.random() - 0.5)
    .slice(0, 12); // 12 most active bidders this cycle

  const signed = [];
  const remaining = [...pool].sort((a, b) => b.rating - a.rating);

  for (const team of aiTeams) {
    if (remaining.length === 0) break;
    const needScore = clamp(1 - (team.rosterQuality || 70) / 100, 0.05, 0.9);
    const marketFactor = clamp(team.market / 95, 0.4, 1.0);
    const target = remaining[0];
    const isTopTier = target.rating >= 75;
    // Calibrated to sign ~50% of top-tier FAs
    const basePr = isTopTier ? 0.52 : 0.30;
    const signPr = clamp(basePr + needScore * 0.18 + (marketFactor - 0.7) * 0.12, 0.10, 0.82);
    if (Math.random() < signPr) {
      signed.push({
        id: generateId(),
        player: { ...target },
        teamName: `${team.city} ${team.name}`,
        teamId: team.id,
        league: team.league,
      });
      remaining.shift();
    }
  }

  return { signed, remaining };
}

// ============================================================
// TEAM & LEAGUE INIT
// ============================================================

function initTeam(td, lg) {
  const roster = generateRoster(lg);
  const rq = Math.round(roster.reduce((s, p) => s + p.rating, 0) / roster.length);
  const cap = lg === 'ngl' ? NGL_SALARY_CAP : ABL_SALARY_CAP;
  const ts = roster.reduce((s, p) => s + p.salary, 0);
  // Market-based stadium capacity
  const marketTier = getMarketTier(td.market);
  const capRange = MARKET_STADIUM_CAPACITY[marketTier] || [45000, 55000];
  const stadiumCapacity = rand(capRange[0], capRange[1]);
  const stadiumTier = getStadiumTierFromCapacity(stadiumCapacity);
  const stadiumName = `${td.city} ${pick(STADIUM_SUFFIXES)}`;
  return {
    ...td,
    league: lg,
    wins: 0,
    losses: 0,
    championships: 0,
    fanRating: rand(45, 80),
    rosterQuality: rq,
    totalSalary: r1(ts),
    capSpace: r1(cap - ts),
    finances: {
      revenue: r1(td.market * randFloat(1.5, 2.5)),
      expenses: r1(td.market * randFloat(1.2, 1.8)),
      profit: 0,
    },
    stadiumCapacity,
    stadiumTier,
    stadiumName,
    stadiumDisplayName: stadiumName,
    stadiumCondition: rand(60, 95),
    stadiumAge: rand(1, 25),
    coach: generateCoach(),
    players: roster,
    season: 0,
    history: [],
    rivalIds: [],
    rivalryIntensity: 50,
    playoffTeam: false,
    cityEconomy: CITY_ECONOMY[td.city] || 65,
  };
}

/**
 * Initializes the full NGL and ABL leagues with teams, rosters, and rivalries.
 * @returns {{ ngl: Object[], abl: Object[] }} Initialized league teams
 */
export function initializeLeague() {
  const ngl = NGL_TEAMS.map(t => initTeam(t, 'ngl'));
  const abl = ABL_TEAMS.map(t => initTeam(t, 'abl'));
  RIVALRIES.ngl.forEach(([a, b]) => {
    const A = ngl.find(t => t.id === a);
    const B = ngl.find(t => t.id === b);
    if (A && B) {
      A.rivalIds = [...(A.rivalIds || []), b];
      B.rivalIds = [...(B.rivalIds || []), a];
    }
  });
  RIVALRIES.abl.forEach(([a, b]) => {
    const A = abl.find(t => t.id === a);
    const B = abl.find(t => t.id === b);
    if (A && B) {
      A.rivalIds = [...(A.rivalIds || []), b];
      B.rivalIds = [...(B.rivalIds || []), a];
    }
  });
  [...ngl, ...abl].forEach(t => {
    t.finances.profit = t.finances.revenue - t.finances.expenses;
  });
  return { ngl, abl };
}

// ============================================================
// CREATE PLAYER FRANCHISE
// ============================================================

/**
 * Creates a player-controlled franchise from a team template.
 * @param {Object} tmpl - Team template object
 * @param {string} lg - League identifier
 * @returns {Object} Full player franchise state
 */
export function createPlayerFranchise(tmpl, lg) {
  const base = initTeam(tmpl, lg);
  const askingPrice = getFranchiseAskingPrice(tmpl);
  const startingCapital = 30; // always $30M starting capital
  const startingDebt = Math.max(0, askingPrice - startingCapital);
  const startingCash = Math.max(0, startingCapital - askingPrice);

  // Generate 3 initial slot players
  const { star1, star2, corePiece } = generateInitialSlots(lg, tmpl.market, 50);
  const slotPlayers = [star1, star2, corePiece].filter(Boolean);
  const budget = SLOT_BUDGET[lg] || 80;
  const usedSalary = slotPlayers.reduce((s, p) => s + p.salary, 0);
  const remaining = Math.max(0, budget - usedSalary);
  const depth = Math.round(clamp(remaining / budget * 100, 1, 100));

  return {
    ...base,
    isPlayerOwned: true,
    ownershipPct: 100,
    cash: startingCash,
    debt: startingDebt,
    debtInterestRate: DEBT_INTEREST,
    askingPrice,

    // 3-slot roster model
    star1,
    star2,
    corePiece,
    depthQuality: depth,
    slotBudget: budget,
    players: slotPlayers,
    totalSalary: r1(usedSalary),
    rosterQuality: Math.round(
      (star1?.rating || 0) * 0.40 + (star2?.rating || 0) * 0.30 +
      (corePiece?.rating || 0) * 0.20 + depth * 0.10
    ),

    mediaRep: 50,
    communityRating: 65,
    lockerRoomChemistry: 65,
    namingRightsActive: false,
    namingRightsDeal: null,
    namingRightsName: null,
    localLegends: [],
    retiredNumbers: [],
    trophies: [],
    fanDemographics: { casual: 70, dieHard: 30 },
    dynastyEra: null,
    leagueRank: null,
    capDeadMoney: 0,
    deferredDeadCap: 0,
    deadCapLog: [],
    scoutingStaff: 1,
    developmentStaff: 1,
    medicalStaff: 1,
    marketingStaff: 1,
    gmInvestments: {},
    ticketPrice: TICKET_BASE_PRICE,
    merchMultiplier: 1.0,
    sponsorLevel: 1,
    tvTier: 1,
    trainingFacility: 1,
    weightRoom: 1,
    filmRoom: 1,
    cityEconomy: CITY_ECONOMY[tmpl.city] || 65,
    economyCycle: 'stable',

    // Stadium system (Phase A1)
    luxuryBoxes: 0,
    clubSeatSections: 0,
    stadiumProject: null,
    newStadiumHoneymoon: 0,
    publicFundingCommitment: null,
    stadiumUnderConstruction: false,
    pendingStadiumEvent: null,

    // Coaching staff (Phase A2)
    offensiveCoordinator: generateOC(),
    defensiveCoordinator: generateDC(),
    playerDevCoach: generatePDC(),
    schemeFit: 50,
    staffChemistry: 65,
    staffChemistryStreakYears: 0,
    dynastyCohesionBonus: false,

    // Phase B2: franchise records
    franchiseRecords: initFranchiseRecords(),

    // Phase B3: rivalry
    headToHead: initHeadToHead(),
    rivalry: initRivalry(),

    // Phase B4: draft pick inventory + rookie slots
    draftPickInventory: initDraftPickInventory(1, tmpl.id),
    rookieSlots: [],  // up to 3 rookies separate from main roster

    // Phase 1.5-taxi: taxi squad (max 4 players, develop but don't count against cap)
    taxiSquad: [],
  };
}
