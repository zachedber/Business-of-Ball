// ============================================================
// FRANCHISE BUILDER V2 — GAME ENGINE
// Core simulation, generation, and game logic
// ============================================================

import {
  NGL_TEAMS, ABL_TEAMS, RIVALRIES, NGL_POSITIONS, ABL_POSITIONS,
  NGL_ROSTER_SIZE, ABL_ROSTER_SIZE, NGL_SALARY_CAP, ABL_SALARY_CAP,
  NGL_DRAFT_ROUNDS, ABL_DRAFT_ROUNDS, CAP_INFLATION_RATE,
  PEAK_AGES, PLAYER_TRAITS, TRAIT_WEIGHTS,
  COACH_PERSONALITIES, CITY_ECONOMY_BASE,
  FIRST_NAMES, LAST_NAMES, COACH_FIRST_NAMES, COACH_LAST_NAMES,
  MARKET_TIERS, getMarketTier, getMarketTierInfo,
} from '@/data/leagues';

// ============================================================
// SEEDED RANDOM (deterministic when needed)
// ============================================================
let _seed = Date.now();
export function setSeed(s) { _seed = s; }
export function seededRandom() {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed & 0x7fffffff) / 2147483647;
}

export function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

// ============================================================
// NAME GENERATION
// ============================================================
export function generatePlayerName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

export function generateCoachName() {
  return `${pick(COACH_FIRST_NAMES)} ${pick(COACH_LAST_NAMES)}`;
}

// ============================================================
// TRAIT GENERATION
// ============================================================
export function generateTrait() {
  const r = Math.random();
  let cumulative = 0;
  for (let i = 0; i < PLAYER_TRAITS.length; i++) {
    cumulative += TRAIT_WEIGHTS[i];
    if (r < cumulative) return PLAYER_TRAITS[i];
  }
  return null; // ~18% chance no trait
}

// ============================================================
// ML-EQUIVALENT MODELS (Pure math, no TensorFlow dependency)
// Implements the same logic as the TF.js spec with baked-in weights
// ============================================================

// Sigmoid activation
function sigmoid(x) { return 1 / (1 + Math.exp(-clamp(x, -10, 10))); }
function relu(x) { return Math.max(0, x); }
function tanh_(x) { return Math.tanh(x); }

// Simple 2-layer network forward pass
function forwardPass(inputs, w1, b1, w2, b2, w3, b3, activations) {
  // Layer 1
  const h1 = [];
  for (let i = 0; i < b1.length; i++) {
    let sum = b1[i];
    for (let j = 0; j < inputs.length; j++) sum += inputs[j] * w1[j][i];
    h1.push(activations[0](sum));
  }
  // Layer 2
  const h2 = [];
  for (let i = 0; i < b2.length; i++) {
    let sum = b2[i];
    for (let j = 0; j < h1.length; j++) sum += h1[j] * w2[j][i];
    h2.push(activations[1](sum));
  }
  // Output
  let out = b3[0];
  for (let j = 0; j < h2.length; j++) out += h2[j] * w3[j][0];
  return activations[2](out);
}

// --- MODEL 1: Attendance Predictor ---
// Inputs: [fanRating/100, winPct, avgPrice/150, stadiumCondition/100, market/100, rivalryFactor]
// Output: attendance fraction (0-1)
export function predictAttendance(fanRating, winPct, avgPrice, stadiumCondition, market, rivalryFactor) {
  const inputs = [fanRating/100, winPct, avgPrice/150, stadiumCondition/100, market/100, rivalryFactor];
  // Weights calibrated for realistic attendance curves
  // High fan rating + winning + good stadium + big market = high attendance
  // High prices dampen attendance
  const base = (
    inputs[0] * 0.25 +   // fan rating
    inputs[1] * 0.22 +   // win pct
    inputs[2] * -0.08 +  // price (negative effect)
    inputs[3] * 0.15 +   // stadium condition
    inputs[4] * 0.18 +   // market size
    inputs[5] * 0.05 +   // rivalry factor
    0.15                  // baseline
  );
  // Add some non-linearity: winning + good fans = synergy bonus
  const synergy = inputs[0] * inputs[1] * 0.12;
  return clamp(base + synergy + randFloat(-0.03, 0.03), 0.35, 1.0);
}

// --- MODEL 2: Player Development ---
// Inputs: age, currentRating, morale/100, devStaffLevel(0-3), trait
// Output: rating delta for next season
export function predictDevelopment(age, currentRating, morale, devStaffLevel, trait, league) {
  const [peakStart, peakEnd] = PEAK_AGES[league] || [26, 30];
  
  let ageFactor = 0;
  if (age < peakStart) {
    // Young: positive growth
    ageFactor = (peakStart - age) * 0.6;
  } else if (age <= peakEnd) {
    // Peak: slight growth or stable
    ageFactor = 0.3;
  } else {
    // Decline: negative
    ageFactor = -(age - peakEnd) * 0.8;
  }

  // Development staff bonus
  const devBonus = devStaffLevel * 0.5;

  // Morale factor
  const moraleFactor = (morale - 50) * 0.015;

  // Trait effects
  let traitBonus = 0;
  if (trait === 'hometown') traitBonus = 0.3;
  if (trait === 'volatile') traitBonus = randFloat(-1.0, 1.5);
  if (trait === 'leader') traitBonus = 0.2;

  // Rating ceiling effect: harder to grow when already high
  const ceilingPenalty = currentRating > 85 ? -(currentRating - 85) * 0.15 : 0;

  const delta = ageFactor + devBonus + moraleFactor + traitBonus + ceilingPenalty + randFloat(-1.5, 1.5);
  return Math.round(clamp(delta, -5, 8));
}

// --- MODEL 3: Injury Probability ---
// Inputs: age, seasonsPlayed, medicalStaffLevel(0-3), isInjuryProne, currentRating
// Output: injury probability (0-1)
export function predictInjuryRisk(age, seasonsPlayed, medStaffLevel, trait, currentRating) {
  let baseRisk = 0.08; // 8% base injury chance

  // Age increases risk
  if (age > 30) baseRisk += (age - 30) * 0.02;
  if (age > 34) baseRisk += (age - 34) * 0.03;

  // Experience (more seasons = more wear)
  baseRisk += seasonsPlayed * 0.005;

  // Medical staff reduces risk
  baseRisk -= medStaffLevel * 0.025;

  // Trait effects
  if (trait === 'injury_prone') baseRisk *= 2.0;
  if (trait === 'ironman') baseRisk *= 0.4;

  // Stars slightly more protected (better conditioning)
  if (currentRating > 85) baseRisk *= 0.85;

  return clamp(baseRisk + randFloat(-0.02, 0.02), 0.02, 0.65);
}

// ============================================================
// PLAYER GENERATION
// ============================================================
export function generatePlayer(position, league, options = {}) {
  const age = options.age || rand(22, 32);
  const rating = options.rating || rand(55, 88);
  const trait = options.trait !== undefined ? options.trait : generateTrait();
  const yearsLeft = options.yearsLeft || rand(1, 4);
  const seasonsPlayed = options.seasonsPlayed || Math.max(1, age - 21);

  // Salary based on rating (in millions)
  const cap = league === 'ngl' ? NGL_SALARY_CAP : ABL_SALARY_CAP;
  const rosterSize = league === 'ngl' ? NGL_ROSTER_SIZE : ABL_ROSTER_SIZE;
  const avgSalary = cap / rosterSize;
  let salary = avgSalary * (rating / 72) * randFloat(0.7, 1.3);
  if (trait === 'mercenary') salary *= 1.4;
  if (trait === 'hometown') salary *= 0.8;
  salary = Math.round(salary * 10) / 10; // round to 0.1M

  return {
    id: generateId(),
    name: generatePlayerName(),
    position,
    age,
    rating: clamp(rating, 40, 99),
    morale: rand(55, 85),
    trait,
    salary,
    yearsLeft,
    seasonsPlayed,
    injured: false,
    injurySeverity: null, // 'minor','moderate','severe'
    gamesOut: 0,
    isLocalLegend: false,
    seasonsWithTeam: options.seasonsWithTeam || 1,
    careerStats: { seasons: seasonsPlayed, bestRating: rating },
  };
}

export function generateRoster(league) {
  const positions = league === 'ngl' ? NGL_POSITIONS : ABL_POSITIONS;
  return positions.map(pos => generatePlayer(pos, league));
}

// ============================================================
// COACH GENERATION
// ============================================================
export function generateCoach() {
  return {
    name: generateCoachName(),
    personality: pick(COACH_PERSONALITIES),
    level: rand(1, 3), // 1-4 scale
    age: rand(40, 65),
    seasonsWithTeam: 0,
  };
}

// ============================================================
// TEAM INITIALIZATION
// ============================================================
function initTeam(teamData, league) {
  const roster = generateRoster(league);
  const rosterQuality = Math.round(roster.reduce((s, p) => s + p.rating, 0) / roster.length);
  const cap = league === 'ngl' ? NGL_SALARY_CAP : ABL_SALARY_CAP;
  const totalSalary = roster.reduce((s, p) => s + p.salary, 0);

  return {
    ...teamData,
    league,
    wins: 0,
    losses: 0,
    championships: 0,
    fanRating: rand(45, 80),
    rosterQuality,
    totalSalary: Math.round(totalSalary * 10) / 10,
    capSpace: Math.round((cap - totalSalary) * 10) / 10,
    finances: {
      revenue: Math.round(teamData.market * randFloat(1.5, 2.5)),
      expenses: Math.round(teamData.market * randFloat(1.2, 1.8)),
      profit: 0,
    },
    stadiumCapacity: rand(35000, 82000),
    stadiumCondition: rand(60, 95),
    stadiumAge: rand(1, 25),
    coach: generateCoach(),
    players: roster,
    season: 0,
    history: [],
    rivalIds: [],
    rivalryIntensity: 50,
    // Will be set by AI team sim
    playoffTeam: false,
    divisionWinner: false,
  };
}

// ============================================================
// LEAGUE INITIALIZATION
// ============================================================
export function initializeLeague() {
  const nglTeams = NGL_TEAMS.map(t => initTeam(t, 'ngl'));
  const ablTeams = ABL_TEAMS.map(t => initTeam(t, 'abl'));

  // Assign rivalries
  RIVALRIES.ngl.forEach(([a, b]) => {
    const teamA = nglTeams.find(t => t.id === a);
    const teamB = nglTeams.find(t => t.id === b);
    if (teamA && teamB) {
      teamA.rivalIds = [...(teamA.rivalIds || []), b];
      teamB.rivalIds = [...(teamB.rivalIds || []), a];
    }
  });
  RIVALRIES.abl.forEach(([a, b]) => {
    const teamA = ablTeams.find(t => t.id === a);
    const teamB = ablTeams.find(t => t.id === b);
    if (teamA && teamB) {
      teamA.rivalIds = [...(teamA.rivalIds || []), b];
      teamB.rivalIds = [...(teamB.rivalIds || []), a];
    }
  });

  // Calculate initial finances
  [...nglTeams, ...ablTeams].forEach(t => {
    t.finances.profit = t.finances.revenue - t.finances.expenses;
  });

  return { ngl: nglTeams, abl: ablTeams };
}

// ============================================================
// FRANCHISE CREATION (Player-owned)
// ============================================================
export function createPlayerFranchise(teamTemplate, league) {
  const base = initTeam(teamTemplate, league);
  return {
    ...base,
    isPlayerOwned: true,
    ownershipPct: 100,
    // Extended player-owned fields
    mediaRep: 50,
    communityRating: 65,
    lockerRoomChemistry: 65,
    debt: 0,
    debtInterestRate: 0.08,
    namingRightsActive: false,
    namingRightsDeal: null,
    localLegends: [],
    retiredNumbers: [],
    fanDemographics: { casual: 70, dieHard: 30 },
    insurancePolicies: [],
    dynastyEra: null,
    seasonNewspapers: [],
    leagueRank: null,
    capDeadMoney: 0,
    // Staff levels (0-3)
    scoutingStaff: 1,
    developmentStaff: 1,
    medicalStaff: 1,
    marketingStaff: 1,
    // Business
    ticketPrice: 75,
    merchMultiplier: 1.0,
    sponsorLevel: 1,
    tvTier: 1,
    // Facilities
    trainingFacility: 1,
    weightRoom: 1,
    filmRoom: 1,
  };
}

// ============================================================
// SEASON SIMULATION — AI TEAMS
// Fast deterministic sim for all 62 AI teams
// ============================================================
export function simulateAITeamSeason(team, season, leagueTeams) {
  const league = team.league;
  const totalGames = league === 'ngl' ? 17 : 82;

  // Base win probability from roster quality
  let winProb = (team.rosterQuality - 40) / 60; // 40 rating = 0%, 100 = 1.0
  winProb = clamp(winProb, 0.15, 0.85);

  // Coaching modifier
  winProb += team.coach.level * 0.03;

  // Fan/morale modifier
  winProb += (team.fanRating - 50) * 0.001;

  // Slight randomness for season variance
  winProb += randFloat(-0.08, 0.08);
  winProb = clamp(winProb, 0.1, 0.92);

  // Simulate wins
  let wins = 0;
  for (let g = 0; g < totalGames; g++) {
    if (Math.random() < winProb) wins++;
  }
  const losses = totalGames - wins;

  // Update team
  team.wins = wins;
  team.losses = losses;
  team.season = season;

  // Financial sim
  const attendance = predictAttendance(
    team.fanRating, wins / totalGames, 80,
    team.stadiumCondition, team.market, team.rivalIds.length > 0 ? 0.5 : 0
  );
  const ticketRevenue = attendance * team.stadiumCapacity * 80 * totalGames / 1_000_000; // in millions
  const tvRevenue = team.market * randFloat(0.8, 1.2);
  const merchRevenue = team.market * (wins / totalGames) * randFloat(0.3, 0.6);
  team.finances.revenue = Math.round((ticketRevenue + tvRevenue + merchRevenue) * 10) / 10;
  team.finances.expenses = Math.round(team.totalSalary + team.market * randFloat(0.3, 0.6));
  team.finances.profit = Math.round((team.finances.revenue - team.finances.expenses) * 10) / 10;

  // Fan rating adjustment
  const winPct = wins / totalGames;
  if (winPct > 0.6) team.fanRating = clamp(team.fanRating + rand(1, 4), 0, 100);
  else if (winPct < 0.35) team.fanRating = clamp(team.fanRating - rand(1, 5), 0, 100);

  // Stadium aging
  team.stadiumAge++;
  if (team.stadiumAge > 15) {
    team.stadiumCondition = clamp(team.stadiumCondition - rand(1, 3), 20, 100);
  }

  // Player development (simplified for AI)
  team.players.forEach(p => {
    p.age++;
    p.seasonsPlayed++;
    const delta = predictDevelopment(p.age, p.rating, 65, 1, p.trait, league);
    p.rating = clamp(p.rating + delta, 40, 99);
  });

  // Retirements
  team.players = team.players.filter(p => {
    if (p.age >= 35 && Math.random() < 0.3) return false;
    if (p.age >= 38) return false;
    return true;
  });

  // Fill roster back up with rookies
  const positions = league === 'ngl' ? NGL_POSITIONS : ABL_POSITIONS;
  const targetSize = league === 'ngl' ? NGL_ROSTER_SIZE : ABL_ROSTER_SIZE;
  while (team.players.length < targetSize) {
    const pos = positions[team.players.length % positions.length];
    team.players.push(generatePlayer(pos, league, { age: rand(22, 24), rating: rand(55, 72) }));
  }

  // Recalculate roster quality
  team.rosterQuality = Math.round(team.players.reduce((s, p) => s + p.rating, 0) / team.players.length);

  // Coach changes (random)
  team.coach.seasonsWithTeam++;
  if (winPct < 0.35 && team.coach.seasonsWithTeam >= 2 && Math.random() < 0.5) {
    team.coach = generateCoach();
  }

  // Save history
  team.history.push({
    season,
    wins,
    losses,
    rosterQuality: team.rosterQuality,
    revenue: team.finances.revenue,
    fanRating: team.fanRating,
  });

  return team;
}

// ============================================================
// PLAYER FRANCHISE SEASON SIMULATION
// ============================================================
export function simulatePlayerSeason(franchise, season) {
  const league = franchise.league;
  const totalGames = league === 'ngl' ? 17 : 82;

  // --- Win probability calculation ---
  let winProb = (franchise.rosterQuality - 40) / 60;

  // Coaching
  winProb += franchise.coach.level * 0.035;
  // Chemistry
  winProb += (franchise.lockerRoomChemistry - 50) * 0.002;
  // Training facilities
  winProb += franchise.trainingFacility * 0.015;
  // Film room
  winProb += franchise.filmRoom * 0.01;

  winProb = clamp(winProb + randFloat(-0.06, 0.06), 0.08, 0.94);

  // --- Injuries ---
  franchise.players.forEach(p => {
    const risk = predictInjuryRisk(p.age, p.seasonsPlayed, franchise.medicalStaff, p.trait, p.rating);
    if (Math.random() < risk) {
      p.injured = true;
      const severityRoll = Math.random();
      if (severityRoll < 0.5) {
        p.injurySeverity = 'minor';
        p.gamesOut = rand(2, 4);
      } else if (severityRoll < 0.85) {
        p.injurySeverity = 'moderate';
        p.gamesOut = rand(6, 10);
      } else {
        p.injurySeverity = 'severe';
        p.gamesOut = totalGames;
      }
    } else {
      p.injured = false;
      p.injurySeverity = null;
      p.gamesOut = 0;
    }
  });

  // Injury impact on win probability
  const injuredStars = franchise.players.filter(p => p.injured && p.rating >= 80).length;
  winProb -= injuredStars * 0.04;
  winProb = clamp(winProb, 0.05, 0.94);

  // --- Simulate games ---
  let wins = 0;
  for (let g = 0; g < totalGames; g++) {
    if (Math.random() < winProb) wins++;
  }
  const losses = totalGames - wins;

  franchise.wins = wins;
  franchise.losses = losses;
  franchise.season = season;

  // --- Attendance & Revenue ---
  const attendancePct = predictAttendance(
    franchise.fanRating, wins / totalGames, franchise.ticketPrice,
    franchise.stadiumCondition, franchise.market,
    franchise.rivalIds.length > 0 ? franchise.rivalryIntensity / 100 : 0
  );
  const gateRevenue = attendancePct * franchise.stadiumCapacity * franchise.ticketPrice * totalGames / 1_000_000;
  const tvRevenue = franchise.market * (0.5 + franchise.tvTier * 0.3) * randFloat(0.9, 1.1);
  const merchRevenue = franchise.market * franchise.merchMultiplier * (wins / totalGames) * randFloat(0.3, 0.5);
  const sponsorRevenue = franchise.sponsorLevel * franchise.market * 0.08 * randFloat(0.9, 1.1);
  const namingRevenue = franchise.namingRightsActive ? (franchise.namingRightsDeal || 3) : 0;

  const totalRevenue = gateRevenue + tvRevenue + merchRevenue + sponsorRevenue + namingRevenue;
  const staffCosts = (franchise.scoutingStaff + franchise.developmentStaff + franchise.medicalStaff + franchise.marketingStaff) * 2;
  const facilityCosts = (franchise.trainingFacility + franchise.weightRoom + franchise.filmRoom) * 1.5;
  const stadiumMaintenance = franchise.stadiumAge > 15 ? franchise.stadiumAge * 0.3 : 1;
  const debtInterest = franchise.debt * franchise.debtInterestRate;
  const totalExpenses = franchise.totalSalary + staffCosts + facilityCosts + stadiumMaintenance + debtInterest + franchise.capDeadMoney;

  franchise.finances.revenue = Math.round(totalRevenue * 10) / 10;
  franchise.finances.expenses = Math.round(totalExpenses * 10) / 10;
  franchise.finances.profit = Math.round((totalRevenue - totalExpenses) * 10) / 10;

  // --- Fan Rating ---
  const winPct = wins / totalGames;
  let fanDelta = 0;
  if (winPct > 0.7) fanDelta = rand(3, 6);
  else if (winPct > 0.55) fanDelta = rand(1, 3);
  else if (winPct < 0.3) fanDelta = -rand(3, 7);
  else if (winPct < 0.4) fanDelta = -rand(1, 3);
  // Marketing staff helps
  fanDelta += franchise.marketingStaff * 0.5;
  franchise.fanRating = clamp(Math.round(franchise.fanRating + fanDelta), 0, 100);

  // --- Fan Demographics ---
  if (winPct > 0.6) {
    franchise.fanDemographics.dieHard = clamp(franchise.fanDemographics.dieHard + rand(1, 3), 10, 70);
    franchise.fanDemographics.casual = 100 - franchise.fanDemographics.dieHard;
  } else if (winPct < 0.35) {
    franchise.fanDemographics.casual = clamp(franchise.fanDemographics.casual + rand(2, 5), 30, 90);
    franchise.fanDemographics.dieHard = 100 - franchise.fanDemographics.casual;
  }

  // --- Locker Room Chemistry ---
  let chemDelta = 0;
  franchise.players.forEach(p => {
    if (p.trait === 'leader' && p.morale > 60) chemDelta += 2;
    if (p.trait === 'volatile') chemDelta -= rand(2, 5);
    if (p.trait === 'showman') chemDelta += winPct > 0.5 ? 2 : -3;
  });
  franchise.lockerRoomChemistry = clamp(Math.round(franchise.lockerRoomChemistry + chemDelta / franchise.players.length * 3), 0, 100);

  // --- Player Development ---
  franchise.players.forEach(p => {
    p.age++;
    p.seasonsPlayed++;
    p.seasonsWithTeam++;
    if (!p.injured || p.injurySeverity !== 'severe') {
      const delta = predictDevelopment(p.age, p.rating, p.morale, franchise.developmentStaff, p.trait, league);
      p.rating = clamp(p.rating + delta, 40, 99);
      if (p.rating > p.careerStats.bestRating) p.careerStats.bestRating = p.rating;
    }
    p.careerStats.seasons++;

    // Contract countdown
    p.yearsLeft--;

    // Morale adjustments
    if (winPct > 0.6) p.morale = clamp(p.morale + rand(2, 5), 0, 100);
    else if (winPct < 0.35) p.morale = clamp(p.morale - rand(2, 6), 0, 100);
    if (p.trait === 'volatile') p.morale = clamp(p.morale + rand(-10, 10), 0, 100);
  });

  // --- Stadium Aging ---
  franchise.stadiumAge++;
  if (franchise.stadiumAge > 12) {
    franchise.stadiumCondition = clamp(franchise.stadiumCondition - rand(1, 3), 20, 100);
  }

  // --- Coach tenure ---
  franchise.coach.seasonsWithTeam++;
  franchise.coach.age++;

  // --- Media Rep ---
  if (winPct > 0.65) franchise.mediaRep = clamp(franchise.mediaRep + rand(1, 4), 0, 100);
  else if (winPct < 0.3) franchise.mediaRep = clamp(franchise.mediaRep - rand(1, 3), 0, 100);

  // --- Community Rating (passive drift toward 50) ---
  if (franchise.communityRating > 55) franchise.communityRating -= 1;
  else if (franchise.communityRating < 45) franchise.communityRating += 1;

  // --- Local Legends check ---
  franchise.players.forEach(p => {
    if (p.seasonsWithTeam >= 5 && p.rating >= 75 && !p.isLocalLegend) {
      p.isLocalLegend = true;
    }
  });

  // --- Save season history ---
  franchise.history.push({
    season,
    wins,
    losses,
    winPct: Math.round(winPct * 1000) / 1000,
    rosterQuality: franchise.rosterQuality,
    revenue: franchise.finances.revenue,
    expenses: franchise.finances.expenses,
    profit: franchise.finances.profit,
    fanRating: franchise.fanRating,
    chemistry: franchise.lockerRoomChemistry,
    mediaRep: franchise.mediaRep,
    injuries: franchise.players.filter(p => p.injured).map(p => ({
      name: p.name, severity: p.injurySeverity
    })),
  });

  return franchise;
}

// ============================================================
// FULL LEAGUE SEASON SIMULATION
// ============================================================
export function simulateFullSeason(leagueTeams, playerFranchises, season) {
  // Simulate all AI teams
  const updatedLeague = {
    ngl: leagueTeams.ngl.map(t => {
      // Skip if player owns this team
      if (playerFranchises.some(pf => pf.id === t.id)) return t;
      return simulateAITeamSeason({ ...t }, season, leagueTeams);
    }),
    abl: leagueTeams.abl.map(t => {
      if (playerFranchises.some(pf => pf.id === t.id)) return t;
      return simulateAITeamSeason({ ...t }, season, leagueTeams);
    }),
  };

  // Simulate player franchises
  const updatedFranchises = playerFranchises.map(f => simulatePlayerSeason({ ...f }, season));

  // Merge player results into league standings
  updatedFranchises.forEach(pf => {
    const leagueArr = updatedLeague[pf.league];
    const idx = leagueArr.findIndex(t => t.id === pf.id);
    if (idx >= 0) {
      leagueArr[idx] = { ...leagueArr[idx], wins: pf.wins, losses: pf.losses, rosterQuality: pf.rosterQuality, fanRating: pf.fanRating };
    }
  });

  // Calculate standings and rankings
  const nglStandings = [...updatedLeague.ngl].sort((a, b) => b.wins - a.wins);
  const ablStandings = [...updatedLeague.abl].sort((a, b) => b.wins - a.wins);

  // Tag playoff teams (top 14 NGL, top 16 ABL)
  nglStandings.forEach((t, i) => { t.playoffTeam = i < 14; t.leagueRank = i + 1; });
  ablStandings.forEach((t, i) => { t.playoffTeam = i < 16; t.leagueRank = i + 1; });

  // Update player franchise rankings
  updatedFranchises.forEach(pf => {
    const standings = pf.league === 'ngl' ? nglStandings : ablStandings;
    const entry = standings.find(t => t.id === pf.id);
    if (entry) {
      pf.leagueRank = entry.leagueRank;
      pf.playoffTeam = entry.playoffTeam;
    }
  });

  return {
    leagueTeams: updatedLeague,
    franchises: updatedFranchises,
    standings: { ngl: nglStandings, abl: ablStandings },
  };
}

// ============================================================
// DRAFT SYSTEM
// ============================================================
export function generateDraftProspects(league, count, scoutingLevel = 1) {
  const positions = league === 'ngl' ? NGL_POSITIONS : ABL_POSITIONS;
  const prospects = [];

  for (let i = 0; i < count; i++) {
    const pos = pick(positions);
    const baseRating = rand(50, 78);
    // Better scouting reveals more accurate projections
    const accuracy = scoutingLevel * 5; // 5-15 point accuracy window
    const projectedRating = baseRating + rand(-accuracy, accuracy);
    const upside = pick(['low', 'mid', 'high']);
    const trueUpside = upside === 'high' ? rand(5, 15) : upside === 'mid' ? rand(0, 8) : rand(-2, 4);

    prospects.push({
      id: generateId(),
      name: generatePlayerName(),
      position: pos,
      age: rand(21, 23),
      projectedRating: clamp(projectedRating, 45, 85),
      trueRating: clamp(baseRating, 45, 85),
      upside,
      trueUpside,
      trait: generateTrait(),
      scouted: false,
    });
  }

  // Sort by projected rating
  return prospects.sort((a, b) => b.projectedRating - a.projectedRating);
}

export function draftPlayer(prospect, league) {
  const cap = league === 'ngl' ? NGL_SALARY_CAP : ABL_SALARY_CAP;
  const rosterSize = league === 'ngl' ? NGL_ROSTER_SIZE : ABL_ROSTER_SIZE;
  // Rookie contract scale (cheap)
  const rookieSalary = Math.round((cap / rosterSize) * 0.4 * 10) / 10;

  return {
    ...generatePlayer(prospect.position, league, {
      age: prospect.age,
      rating: prospect.trueRating,
      trait: prospect.trait,
      yearsLeft: 4, // rookie contract
      seasonsPlayed: 0,
      seasonsWithTeam: 0,
    }),
    name: prospect.name,
    salary: rookieSalary,
    isDrafted: true,
    draftUpside: prospect.trueUpside,
  };
}

// ============================================================
// FREE AGENT POOL
// ============================================================
export function generateFreeAgents(league, count = 20) {
  const positions = league === 'ngl' ? NGL_POSITIONS : ABL_POSITIONS;
  return Array.from({ length: count }, () => {
    const pos = pick(positions);
    return generatePlayer(pos, league, {
      age: rand(25, 34),
      rating: rand(55, 82),
      yearsLeft: 0, // needs new contract
    });
  }).sort((a, b) => b.rating - a.rating);
}

// ============================================================
// SALARY CAP HELPERS
// ============================================================
export function calculateCapSpace(franchise) {
  const cap = franchise.league === 'ngl' ? NGL_SALARY_CAP : ABL_SALARY_CAP;
  const seasonInflation = Math.pow(1 + CAP_INFLATION_RATE, franchise.season || 0);
  const adjustedCap = Math.round(cap * seasonInflation * 10) / 10;
  const totalSalary = franchise.players.reduce((s, p) => s + p.salary, 0);
  const deadMoney = franchise.capDeadMoney || 0;
  return {
    cap: adjustedCap,
    used: Math.round((totalSalary + deadMoney) * 10) / 10,
    space: Math.round((adjustedCap - totalSalary - deadMoney) * 10) / 10,
    deadMoney,
  };
}

// ============================================================
// COACHING CAROUSEL
// ============================================================
export function generateCoachCandidates(count = 3) {
  return Array.from({ length: count }, () => {
    const level = rand(1, 4);
    const personality = pick(COACH_PERSONALITIES);
    return {
      name: generateCoachName(),
      personality,
      level,
      age: rand(38, 62),
      seasonsWithTeam: 0,
      buyout: level * 3, // millions
      backstory: getCoachBackstory(personality, level),
    };
  }).sort((a, b) => b.level - a.level);
}

function getCoachBackstory(personality, level) {
  const stories = {
    'Players Coach': [
      'Known for building deep player relationships and getting the most out of underperforming rosters.',
      'A former player who transitioned to coaching with a reputation for loyalty and trust.',
      'Beloved by players league-wide, this coach creates a family atmosphere wherever they go.',
    ],
    'Disciplinarian': [
      'Runs a tight ship with no tolerance for missed assignments or off-field drama.',
      'Former military background who brings structure and accountability to every program.',
      'Old-school approach that rubs some players wrong but wins championships.',
    ],
    'Tactician': [
      'An analytics-driven innovator who pioneered several modern offensive concepts.',
      'Film room obsessive who outschemes opponents with creative game plans.',
      'Known for making brilliant halftime adjustments that swing games.',
    ],
    'Showman': [
      'A media darling who brings energy and attention to any franchise.',
      'Flamboyant and quotable, this coach fills stadiums and dominates headlines.',
      'Players love the spotlight this coach creates, but critics question the substance.',
    ],
  };
  return pick(stories[personality] || stories['Tactician']);
}

export function fireCoach(franchise) {
  const buyout = franchise.coach.level * 2;
  return {
    ...franchise,
    coach: { ...franchise.coach, name: 'Interim Coach', level: 1, personality: 'Tactician', seasonsWithTeam: 0 },
    capDeadMoney: franchise.capDeadMoney + buyout,
  };
}

export function hireCoach(franchise, candidate) {
  return {
    ...franchise,
    coach: { ...candidate, seasonsWithTeam: 0 },
  };
}

// ============================================================
// PRESS CONFERENCE SYSTEM
// ============================================================
export function generatePressConferenceOptions(franchise) {
  const winPct = franchise.wins / (franchise.wins + franchise.losses || 1);
  const scenarios = [];

  if (winPct > 0.6) {
    scenarios.push({
      id: 'pc_championship',
      prompt: 'Reporter: "Your team is on a tear. Can you guarantee a championship?"',
      options: [
        { label: 'Guarantee it', text: '"I guarantee we\'re bringing home a title this year."', fanBonus: 8, mediaBonus: -5, moraleBonus: 10, risk: 'championship_guarantee' },
        { label: 'Stay humble', text: '"We\'re focused on getting better every day. Results will follow."', fanBonus: 2, mediaBonus: 5, moraleBonus: 3 },
        { label: 'Deflect with humor', text: '"I guarantee my postgame meal will be excellent tonight."', fanBonus: 3, mediaBonus: 8, moraleBonus: 1 },
      ],
    });
  } else if (winPct < 0.35) {
    scenarios.push({
      id: 'pc_rebuild',
      prompt: 'Reporter: "The losses are piling up. Is it time for a full rebuild?"',
      options: [
        { label: 'Admit the rebuild', text: '"We\'re building for the future. This season is about development."', fanBonus: -3, mediaBonus: 6, moraleBonus: -5 },
        { label: 'Stay defiant', text: '"We believe in this group. We\'re closer than people think."', fanBonus: 4, mediaBonus: -2, moraleBonus: 6 },
        { label: 'Blame injuries', text: '"When we get healthy, you\'ll see a different team."', fanBonus: 0, mediaBonus: -3, moraleBonus: 2 },
      ],
    });
  } else {
    scenarios.push({
      id: 'pc_midseason',
      prompt: 'Reporter: "You\'re in the middle of the pack. What\'s the plan to push into contention?"',
      options: [
        { label: 'Bold trades coming', text: '"We\'re actively looking to upgrade. Expect moves soon."', fanBonus: 5, mediaBonus: 3, moraleBonus: -2 },
        { label: 'Trust the process', text: '"Our young core is developing. Patience will pay off."', fanBonus: 1, mediaBonus: 2, moraleBonus: 4 },
        { label: 'Fire up the team', text: '"Nobody in that locker room is satisfied. We\'re coming for the top."', fanBonus: 4, mediaBonus: 1, moraleBonus: 7 },
      ],
    });
  }

  // Always add a community question
  scenarios.push({
    id: 'pc_community',
    prompt: `Reporter: "What are the ${franchise.name} doing for the ${franchise.city} community?"`,
    options: [
      { label: 'Highlight charity work', text: '"We\'re deeply committed to this city. Our youth programs have reached over 5,000 kids."', communityBonus: 5, mediaBonus: 4, fanBonus: 2 },
      { label: 'Deflect to basketball', text: '"Our focus right now is winning games. That\'s what the fans want."', communityBonus: -3, mediaBonus: -2, fanBonus: 1 },
    ],
  });

  return scenarios;
}

// ============================================================
// STAKE SYSTEM
// ============================================================
export function generateStakeOffers(leagueTeams, portfolio, season) {
  if (portfolio < 20 || season < 3) return [];
  const allTeams = [...leagueTeams.ngl, ...leagueTeams.abl].filter(t => !t.isPlayerOwned);
  const shuffled = allTeams.sort(() => Math.random() - 0.5).slice(0, rand(1, 3));

  return shuffled.map(team => {
    const valuation = calculateValuation(team);
    const stakePct = pick([10, 15, 20, 25]);
    const price = Math.round(valuation * (stakePct / 100) * randFloat(0.85, 1.15));
    return {
      id: generateId(),
      teamId: team.id,
      teamName: `${team.city} ${team.name}`,
      league: team.league,
      stakePct,
      price,
      valuation,
      record: `${team.wins}-${team.losses}`,
      market: team.market,
    };
  });
}

export function calculateStakeIncome(stakes, leagueTeams) {
  return stakes.reduce((total, stake) => {
    const allTeams = [...(leagueTeams.ngl || []), ...(leagueTeams.abl || [])];
    const team = allTeams.find(t => t.id === stake.teamId);
    if (!team) return total;
    const income = (team.finances.profit || 0) * (stake.stakePct / 100);
    return total + Math.round(income * 10) / 10;
  }, 0);
}

// ============================================================
// RIVALRY EVENTS
// ============================================================
export function generateRivalryEvent(franchise, leagueTeams) {
  if (!franchise.rivalIds || franchise.rivalIds.length === 0) return null;
  const allTeams = [...(leagueTeams.ngl || []), ...(leagueTeams.abl || [])];
  const rival = allTeams.find(t => franchise.rivalIds.includes(t.id));
  if (!rival) return null;

  const rivalWinning = rival.wins > franchise.wins;
  if (rivalWinning) {
    return {
      id: 'rivalry_heat',
      title: `${rival.city} ${rival.name} Rivalry Heats Up`,
      description: `The ${rival.city} ${rival.name} are outperforming you this season (${rival.wins}-${rival.losses} vs your ${franchise.wins}-${franchise.losses}). Casual fans are starting to drift.`,
      choices: [
        { label: 'Run attack ads', cost: 2, fanBonus: 3, mediaBonus: -4, rivalryBonus: 10 },
        { label: 'Focus on your product', cost: 0, fanBonus: -1, moraleBonus: 3 },
        { label: 'Organize fan rally', cost: 1, fanBonus: 5, communityBonus: 3, rivalryBonus: 5 },
      ],
    };
  }
  return null;
}

// ============================================================
// FRANCHISE VALUATION
// ============================================================
export function calculateValuation(franchise) {
  const base = franchise.market * 3;
  const winBonus = (franchise.wins / (franchise.wins + franchise.losses + 0.01)) * 50;
  const fanBonus = franchise.fanRating * 0.5;
  const stadiumFactor = franchise.stadiumCondition * 0.2;
  const champBonus = franchise.championships * 15;
  const economyFactor = (CITY_ECONOMY_BASE[franchise.city] || 65) * 0.3;
  return Math.round(base + winBonus + fanBonus + stadiumFactor + champBonus + economyFactor);
}
