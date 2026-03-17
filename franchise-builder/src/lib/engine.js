// ============================================================
// BUSINESS OF BALL — GAME ENGINE (Phase 3+4 Combined)
// ============================================================
import {
  NGL_TEAMS, ABL_TEAMS, RIVALRIES, NGL_POSITIONS, ABL_POSITIONS,
  NGL_ROSTER_SIZE, ABL_ROSTER_SIZE, NGL_SALARY_CAP, ABL_SALARY_CAP,
  CAP_INFLATION_RATE, PEAK_AGES, PLAYER_TRAITS, TRAIT_WEIGHTS,
  COACH_PERSONALITIES, CITY_ECONOMY, MARKET_TIERS, getMarketTier,
  UPGRADE_COSTS, TICKET_BASE_PRICE, TICKET_ELASTICITY, STARTING_CASH,
  REVENUE_SHARE_PCT, MAX_DEBT_RATIO, DEBT_INTEREST, NGL_CONFERENCES,
} from '@/data/leagues';
import { generatePlayerName, generateCoachName } from '@/data/names';

// ============================================================
// UTILS
// ============================================================

/**
 * Returns a random integer between a and b (inclusive).
 * @param {number} a - Lower bound
 * @param {number} b - Upper bound
 * @returns {number}
 */
export function rand(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

/**
 * Returns a random float between a and b.
 * @param {number} a - Lower bound
 * @param {number} b - Upper bound
 * @returns {number}
 */
export function randFloat(a, b) {
  return Math.random() * (b - a) + a;
}

/**
 * Returns a random element from an array.
 * @param {Array} arr
 * @returns {*}
 */
export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Clamps value v between lo and hi.
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Generates a random alphanumeric ID string.
 * @returns {string}
 */
export function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function r1(n) {
  return Math.round(n * 10) / 10;
}

// ============================================================
// TRAITS
// ============================================================

/**
 * Randomly generates a player trait based on weighted probabilities.
 * @returns {string|null}
 */
export function generateTrait() {
  const r = Math.random();
  let c = 0;
  for (let i = 0; i < PLAYER_TRAITS.length; i++) {
    c += TRAIT_WEIGHTS[i];
    if (r < c) return PLAYER_TRAITS[i];
  }
  return null;
}

// ============================================================
// TICKET DEMAND CURVE
// ============================================================

/**
 * Calculates attendance fill rate (0–1) based on pricing and team factors.
 * Includes a value perception modifier based on roster quality vs ticket price.
 * @param {number} price - Ticket price
 * @param {number} fan - Fan rating (0–100)
 * @param {number} wp - Win percentage (0–1)
 * @param {number} market - Market size score
 * @param {number} cond - Stadium condition (0–100)
 * @param {number} [teamQuality=70] - Average roster rating (0–100)
 * @returns {number} Attendance fill rate clamped to [0.25, 0.99]
 */
export function calcAttendance(price, fan, wp, market, cond, teamQuality = 70) {
  const base = fan / 100 * 0.28 + wp * 0.24 + market / 100 * 0.18 + cond / 100 * 0.10 + 0.18;
  const elMod = 1.0 - wp * 0.3 - market / 100 * 0.2 - fan / 100 * 0.15;
  const eff = TICKET_ELASTICITY * Math.max(0.3, elMod);
  const delta = price - TICKET_BASE_PRICE;
  const impact = delta > 0 ? -delta * eff : delta * eff * 0.25;

  const valuePerception = (teamQuality / 100) * 200 - price;
  let valueMod = 0;
  if (valuePerception < -40) {
    valueMod = -clamp(Math.abs(valuePerception + 40) / 200, 0.05, 0.20);
  } else if (valuePerception > 60) {
    valueMod = clamp((valuePerception - 60) / 400, 0.03, 0.10);
  }

  return clamp(base + impact + valueMod + randFloat(-0.02, 0.02), 0.25, 0.99);
}

/**
 * Projects a franchise's revenue and expenses for the upcoming season.
 * @param {Object} f - Franchise state object
 * @returns {Object} Revenue breakdown and projected profit
 */
export function projectRevenue(f) {
  const games = f.league === 'ngl' ? 17 : 82;
  const wp = f.wins / Math.max(1, f.wins + f.losses);
  const att = calcAttendance(
    f.ticketPrice, f.fanRating, wp, f.market, f.stadiumCondition,
    f.rosterQuality || 70
  );
  const gate = att * f.stadiumCapacity * f.ticketPrice * games / 1e6;
  const tv = f.market * (0.5 + (f.tvTier || 1) * 0.3);
  const merch = f.market * (f.merchMultiplier || 1) * Math.max(0.3, wp) * 0.4;
  const spon = (f.sponsorLevel || 1) * f.market * 0.08;
  const naming = f.namingRightsActive ? (f.namingRightsDeal || 3) : 0;
  const rev = gate + tv + merch + spon + naming;
  const staff = (f.scoutingStaff + f.developmentStaff + f.medicalStaff + f.marketingStaff) * 2;
  const fac = (f.trainingFacility + f.weightRoom + f.filmRoom) * 1.5;
  const maint = f.stadiumAge > 15 ? f.stadiumAge * 0.3 : 1;
  const interest = (f.debt || 0) * DEBT_INTEREST;
  const exp = f.totalSalary + staff + fac + maint + interest + (f.capDeadMoney || 0);
  return {
    attendance: Math.round(att * 100),
    gateRevenue: r1(gate),
    tvRevenue: r1(tv),
    merchRevenue: r1(merch),
    totalRevenue: r1(rev),
    totalExpenses: r1(exp),
    projectedProfit: r1(rev - exp),
  };
}

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

// ============================================================
// GENERATION
// ============================================================

/**
 * Generates a single player object for the given position and league.
 * @param {string} pos - Position string
 * @param {string} lg - League identifier
 * @param {Object} [opts={}] - Optional overrides (age, rating, trait, yearsLeft, seasonsPlayed, seasonsWithTeam)
 * @returns {Object} Player object
 */
export function generatePlayer(pos, lg, opts = {}) {
  const age = opts.age || rand(22, 32);
  const rating = opts.rating || rand(55, 88);
  const trait = opts.trait !== undefined ? opts.trait : generateTrait();
  const yrs = opts.yearsLeft || rand(1, 4);
  const sp = opts.seasonsPlayed || Math.max(1, age - 21);
  const cap = lg === 'ngl' ? NGL_SALARY_CAP : ABL_SALARY_CAP;
  const rs = lg === 'ngl' ? NGL_ROSTER_SIZE : ABL_ROSTER_SIZE;
  let sal = cap / rs * (rating / 72) * randFloat(0.7, 1.3);
  if (trait === 'mercenary') sal *= 1.4;
  if (trait === 'hometown') sal *= 0.8;
  return {
    id: generateId(),
    name: generatePlayerName(),
    position: pos,
    age,
    rating: clamp(rating, 40, 99),
    morale: rand(55, 85),
    trait,
    salary: r1(sal),
    yearsLeft: yrs,
    seasonsPlayed: sp,
    injured: false,
    injurySeverity: null,
    gamesOut: 0,
    isLocalLegend: false,
    seasonsWithTeam: opts.seasonsWithTeam || 1,
    careerStats: { seasons: sp, bestRating: rating },
  };
}

/**
 * Generates a full roster for the given league.
 * @param {string} lg - League identifier
 * @returns {Object[]} Array of player objects
 */
export function generateRoster(lg) {
  return (lg === 'ngl' ? NGL_POSITIONS : ABL_POSITIONS).map(p => generatePlayer(p, lg));
}

/**
 * Generates a random coach object.
 * @returns {Object} Coach object
 */
export function generateCoach() {
  return {
    name: generateCoachName(),
    personality: pick(COACH_PERSONALITIES),
    level: rand(1, 3),
    age: rand(40, 65),
    seasonsWithTeam: 0,
  };
}

// ============================================================
// COACHING CAROUSEL
// ============================================================

const BS = {
  'Players Coach': [
    'Deep player relationships.',
    'Family atmosphere.',
    'Gets best from underperformers.',
  ],
  'Disciplinarian': [
    'Zero tolerance for mistakes.',
    'Military-style structure.',
    'Old-school, wins titles.',
  ],
  'Tactician': [
    'Analytics innovator.',
    'Film room genius.',
    'Halftime adjustment master.',
  ],
  'Showman': [
    'Media darling, brings energy.',
    'Fills stadiums with excitement.',
    'Players love the spotlight.',
  ],
};

/**
 * Generates a list of hireable coach candidates sorted by level.
 * @param {number} [n=3] - Number of candidates to generate
 * @returns {Object[]} Sorted array of coach candidate objects
 */
export function generateCoachCandidates(n = 3) {
  return Array.from({ length: n }, () => {
    const lv = rand(1, 4);
    const p = pick(COACH_PERSONALITIES);
    return {
      name: generateCoachName(),
      personality: p,
      level: lv,
      age: rand(38, 62),
      seasonsWithTeam: 0,
      buyout: lv * 3,
      backstory: pick(BS[p]),
    };
  }).sort((a, b) => b.level - a.level);
}

/**
 * Fires the current coach and returns updated franchise state with dead money.
 * @param {Object} f - Franchise state
 * @returns {Object} Updated franchise with interim coach and cap dead money
 */
export function fireCoach(f) {
  return {
    ...f,
    coach: { name: 'Interim Coach', level: 1, personality: 'Tactician', seasonsWithTeam: 0, age: 50 },
    capDeadMoney: (f.capDeadMoney || 0) + f.coach.level * 2,
  };
}

/**
 * Hires a new coach and attaches them to the franchise.
 * @param {Object} f - Franchise state
 * @param {Object} c - Coach candidate object
 * @returns {Object} Updated franchise with new coach
 */
export function hireCoach(f, c) {
  return { ...f, coach: { ...c, seasonsWithTeam: 0 } };
}

// ============================================================
// TEAM & LEAGUE INIT
// ============================================================

function initTeam(td, lg) {
  const roster = generateRoster(lg);
  const rq = Math.round(roster.reduce((s, p) => s + p.rating, 0) / roster.length);
  const cap = lg === 'ngl' ? NGL_SALARY_CAP : ABL_SALARY_CAP;
  const ts = roster.reduce((s, p) => s + p.salary, 0);
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
    stadiumCapacity: rand(35000, 82000),
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
    scoutingStaff: 1,
    developmentStaff: 1,
    medicalStaff: 1,
    marketingStaff: 1,
    ticketPrice: TICKET_BASE_PRICE,
    merchMultiplier: 1.0,
    sponsorLevel: 1,
    tvTier: 1,
    trainingFacility: 1,
    weightRoom: 1,
    filmRoom: 1,
    cityEconomy: CITY_ECONOMY[tmpl.city] || 65,
    economyCycle: 'stable',
  };
}

// ============================================================
// GM REPUTATION TIERS
// ============================================================

export const GM_TIERS = [
  { min: 0, label: 'Unknown GM', badge: '👤' },
  { min: 30, label: 'Respected GM', badge: '📋' },
  { min: 60, label: 'Elite GM', badge: '⭐' },
  { min: 85, label: 'Hall of Fame GM', badge: '🏆' },
];

/**
 * Returns the GM reputation tier object for a given reputation score.
 * @param {number} rep - GM reputation score (0–100)
 * @returns {Object} Tier object with min, label, and badge
 */
export function getGMTier(rep) {
  for (let i = GM_TIERS.length - 1; i >= 0; i--) {
    if (rep >= GM_TIERS[i].min) return GM_TIERS[i];
  }
  return GM_TIERS[0];
}

// ============================================================
// LOCAL ECONOMY CYCLES
// ============================================================

/**
 * Randomly evolves the city economy cycle and adjusts cityEconomy score.
 * @param {Object} f - Franchise state
 * @returns {Object} Updated franchise state with new economy cycle/score
 */
export function updateCityEconomy(f) {
  const roll = Math.random();
  if (f.economyCycle === 'stable') {
    if (roll < 0.15) return { ...f, economyCycle: 'boom', cityEconomy: clamp((f.cityEconomy || 65) + rand(5, 12), 40, 100) };
    if (roll < 0.25) return { ...f, economyCycle: 'recession', cityEconomy: clamp((f.cityEconomy || 65) - rand(8, 15), 30, 100) };
  } else if (f.economyCycle === 'boom') {
    if (roll < 0.3) return { ...f, economyCycle: 'stable' };
  } else if (f.economyCycle === 'recession') {
    if (roll < 0.35) return { ...f, economyCycle: 'stable', cityEconomy: clamp((f.cityEconomy || 65) + rand(3, 8), 30, 100) };
  }
  return f;
}

// ============================================================
// NAMING RIGHTS
// ============================================================

/**
 * Generates a naming rights offer if the franchise does not already have one active.
 * @param {Object} f - Franchise state
 * @returns {Object|null} Offer object or null if already active
 */
export function generateNamingRightsOffer(f) {
  if (f.namingRightsActive) return null;
  const baseValue = Math.round(f.market * 0.12 + f.fanRating * 0.05 + f.mediaRep * 0.03);
  const corps = [
    'Apex Industries', 'Meridian Corp', 'Quantum Holdings', 'Vanguard Systems',
    'Pinnacle Group', 'Atlas Financial', 'Sovereign Energy', 'Nexus Global',
    'Titan Industries', 'Zenith Corp',
  ];
  return { company: pick(corps), annualPay: clamp(baseValue, 2, 8), years: rand(5, 15) };
}

/**
 * Accepts a naming rights offer and applies it to the franchise.
 * @param {Object} f - Franchise state
 * @param {Object} offer - Naming rights offer object
 * @returns {Object} Updated franchise with naming rights active
 */
export function acceptNamingRights(f, offer) {
  return {
    ...f,
    namingRightsActive: true,
    namingRightsDeal: offer.annualPay,
    namingRightsName: offer.company,
    namingRightsYears: offer.years,
  };
}

// ============================================================
// CBA EVENTS (every 5 seasons)
// ============================================================

/**
 * Generates a CBA event object every 5 seasons, or null otherwise.
 * @param {number} season - Current season number
 * @returns {Object|null} CBA event object or null
 */
export function generateCBAEvent(season) {
  if (season % 5 !== 0 || season === 0) return null;
  return {
    id: 'cba_' + season,
    title: 'Collective Bargaining Agreement',
    description: `The players' union is demanding a new CBA. Revenue sharing, salary caps, and roster rules are all on the table. The league faces a potential ${rand(10, 30)}-game lockout if negotiations fail.`,
    choices: [
      { label: 'Accept player demands', capChange: 5, moraleBonus: 8, revenuePenalty: -3, desc: 'Higher cap, happier players, lower owner revenue' },
      { label: 'Negotiate compromise', capChange: 2, moraleBonus: 2, revenuePenalty: -1, desc: 'Moderate changes, minimal disruption' },
      { label: 'Hardline stance', capChange: -3, moraleBonus: -10, revenuePenalty: 0, strikeRisk: 0.4, desc: 'Risk a lockout but protect owner revenue' },
    ],
  };
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
  const games = lg === 'ngl' ? 17 : 82;
  let wp = (team.rosterQuality - 40) / 60 + team.coach.level * 0.03 + (team.fanRating - 50) * 0.001 + randFloat(-0.08, 0.08);
  wp = clamp(wp, 0.1, 0.92);
  let w = 0;
  for (let g = 0; g < games; g++) if (Math.random() < wp) w++;
  team.wins = w;
  team.losses = games - w;
  team.season = season;
  const att = calcAttendance(80, team.fanRating, w / games, team.market, team.stadiumCondition, team.rosterQuality || 70);
  team.finances.revenue = r1(
    att * team.stadiumCapacity * 80 * games / 1e6 +
    team.market * randFloat(0.8, 1.2) +
    team.market * (w / games) * randFloat(0.3, 0.6)
  );
  team.finances.expenses = r1(team.totalSalary + team.market * randFloat(0.3, 0.6));
  team.finances.profit = r1(team.finances.revenue - team.finances.expenses);
  if (w / games > 0.6) team.fanRating = clamp(team.fanRating + rand(1, 4), 0, 100);
  else if (w / games < 0.35) team.fanRating = clamp(team.fanRating - rand(1, 5), 0, 100);
  team.stadiumAge++;
  if (team.stadiumAge > 15) team.stadiumCondition = clamp(team.stadiumCondition - rand(1, 3), 20, 100);
  team.players.forEach(p => {
    p.age++;
    p.seasonsPlayed++;
    const d = predictDev(p.age, p.rating, 65, 1, p.trait, lg);
    p.rating = clamp(p.rating + d, 40, 99);
  });
  team.players = team.players.filter(p => !(p.age >= 35 && Math.random() < 0.3) && p.age < 38);
  const pos = lg === 'ngl' ? NGL_POSITIONS : ABL_POSITIONS;
  const tgt = lg === 'ngl' ? NGL_ROSTER_SIZE : ABL_ROSTER_SIZE;
  while (team.players.length < tgt) {
    team.players.push(generatePlayer(pos[team.players.length % pos.length], lg, { age: rand(22, 24), rating: rand(55, 72) }));
  }
  team.rosterQuality = Math.round(team.players.reduce((s, p) => s + p.rating, 0) / team.players.length);
  team.coach.seasonsWithTeam++;
  if (w / games < 0.35 && team.coach.seasonsWithTeam >= 2 && Math.random() < 0.5) team.coach = generateCoach();
  team.history.push({ season, wins: w, losses: games - w, rosterQuality: team.rosterQuality, revenue: team.finances.revenue, fanRating: team.fanRating });
  return team;
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
  const games = lg === 'ngl' ? 17 : 82;

  // Economy cycle
  f = updateCityEconomy(f);
  const econMod = f.economyCycle === 'boom' ? 1.10 : f.economyCycle === 'recession' ? 0.85 : 1.0;

  // Win prob — coaching staff is the biggest multiplier
  const slotQ = f.star1 !== undefined ? calcSlotQuality(f) : (f.rosterQuality || 70);
  const playerFactor = (slotQ - 65) / 35;
  const coachFactor = f.coach.level * 0.10; // 0.10–0.40, dominant factor
  const facilityFactor = ((f.trainingFacility || 1) + (f.filmRoom || 1)) * 0.01;
  const chemFactor = ((f.lockerRoomChemistry || 65) - 50) * 0.002;
  let wp = 0.25 + playerFactor * 0.30 + coachFactor + facilityFactor + chemFactor;
  wp = clamp(wp + randFloat(-0.06, 0.06), 0.05, 0.94);

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
  wp -= f.players.filter(p => p.injured && p.rating >= 80).length * 0.04;
  wp = clamp(wp, 0.05, 0.94);

  let w = 0;
  for (let g = 0; g < games; g++) if (Math.random() < wp) w++;
  f.wins = w;
  f.losses = games - w;
  f.season = season;
  const winPct = w / games;

  // Revenue with economy modifier
  const att = calcAttendance(f.ticketPrice, f.fanRating, winPct, f.market, f.stadiumCondition, f.rosterQuality || 70);
  const gate = att * f.stadiumCapacity * f.ticketPrice * games / 1e6 * econMod;
  const tv = f.market * (0.5 + (f.tvTier || 1) * 0.3) * randFloat(0.9, 1.1);
  const merch = f.market * (f.merchMultiplier || 1) * winPct * randFloat(0.3, 0.5) * econMod;
  const spon = (f.sponsorLevel || 1) * f.market * 0.08 * randFloat(0.9, 1.1);
  const naming = f.namingRightsActive ? (f.namingRightsDeal || 3) : 0;
  const totalRev = gate + tv + merch + spon + naming;
  const staff = (f.scoutingStaff + f.developmentStaff + f.medicalStaff + f.marketingStaff) * 2;
  const fac = (f.trainingFacility + f.weightRoom + f.filmRoom) * 1.5;
  const maint = f.stadiumAge > 15 ? f.stadiumAge * 0.3 : 1;
  const interest = (f.debt || 0) * DEBT_INTEREST;
  const totalExp = f.totalSalary + staff + fac + maint + interest + (f.capDeadMoney || 0);
  const profit = totalRev - totalExp;
  f.finances = { revenue: r1(totalRev), expenses: r1(totalExp), profit: r1(profit) };
  f.cash = r1((f.cash || 0) + profit);

  // Naming rights countdown
  if (f.namingRightsActive && f.namingRightsYears) {
    f.namingRightsYears--;
    if (f.namingRightsYears <= 0) {
      f.namingRightsActive = false;
      f.namingRightsDeal = null;
      f.namingRightsName = null;
    }
  }

  // Fan rating
  let fd = 0;
  if (winPct > 0.7) fd = rand(3, 6);
  else if (winPct > 0.55) fd = rand(1, 3);
  else if (winPct < 0.3) fd = -rand(3, 7);
  else if (winPct < 0.4) fd = -rand(1, 3);
  fd += f.marketingStaff * 0.5;
  f.fanRating = clamp(Math.round(f.fanRating + fd), 0, 100);

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
  f.lockerRoomChemistry = clamp(Math.round(f.lockerRoomChemistry + cd / f.players.length * 3), 0, 100);

  // Player dev
  f.players.forEach(p => {
    p.age++;
    p.seasonsPlayed++;
    p.seasonsWithTeam++;
    if (!p.injured || p.injurySeverity !== 'severe') {
      const d = predictDev(p.age, p.rating, p.morale, f.developmentStaff, p.trait, lg);
      p.rating = clamp(p.rating + d, 40, 99);
      if (p.rating > p.careerStats.bestRating) p.careerStats.bestRating = p.rating;
    }
    p.careerStats.seasons++;
    p.yearsLeft--;
    if (winPct > 0.6) p.morale = clamp(p.morale + rand(2, 5), 0, 100);
    else if (winPct < 0.35) p.morale = clamp(p.morale - rand(2, 6), 0, 100);
    if (p.trait === 'volatile') p.morale = clamp(p.morale + rand(-10, 10), 0, 100);
  });

  // Check for local legends & retirements
  const retiring = f.players.filter(p => p.age >= 35 && Math.random() < 0.3);
  retiring.forEach(p => {
    if (p.seasonsWithTeam >= 5 && p.rating >= 70) {
      f.localLegends = [...(f.localLegends || []), { name: p.name, rating: p.careerStats.bestRating, seasons: p.seasonsWithTeam }];
      f.fanRating = clamp(f.fanRating + 3, 0, 100);
    }
  });

  // 3-slot model: handle contract expiry and sync slot references
  if (f.star1 !== undefined) {
    // Contract expiry — expired players leave (60–70% chance)
    if (f.star1 && f.star1.yearsLeft <= 0) { if (Math.random() < 0.6) f.star1 = null; }
    if (f.star2 && f.star2.yearsLeft <= 0) { if (Math.random() < 0.6) f.star2 = null; }
    if (f.corePiece && f.corePiece.yearsLeft <= 0) { if (Math.random() < 0.7) f.corePiece = null; }
    // Age-out retirement (35+ slot players)
    if (f.star1 && f.star1.age >= 36 && Math.random() < 0.4) f.star1 = null;
    if (f.star2 && f.star2.age >= 36 && Math.random() < 0.4) f.star2 = null;
    if (f.corePiece && f.corePiece.age >= 37 && Math.random() < 0.5) f.corePiece = null;
    f.players = [f.star1, f.star2, f.corePiece].filter(Boolean);
    f.players.forEach(p => { if (p.seasonsWithTeam >= 5 && p.rating >= 75) p.isLocalLegend = true; });
  } else {
    f.players = f.players.filter(p => !(p.age >= 35 && Math.random() < 0.5) && p.age < 39);
    f.players.forEach(p => { if (p.seasonsWithTeam >= 5 && p.rating >= 75) p.isLocalLegend = true; });
  }

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
// HALF-SEASON SIMULATION
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
  const games = lg === 'ngl' ? 17 : 82;
  const halfGames = Math.floor(games / 2);

  // Economy cycle
  f = updateCityEconomy(f);
  const econMod = f.economyCycle === 'boom' ? 1.10 : f.economyCycle === 'recession' ? 0.85 : 1.0;

  // Win prob — coaching staff is the biggest multiplier
  const slotQ = f.star1 !== undefined ? calcSlotQuality(f) : (f.rosterQuality || 70);
  const playerFactor = (slotQ - 65) / 35;
  const coachFactor = f.coach.level * 0.10; // 0.10–0.40, dominant factor
  const facilityFactor = ((f.trainingFacility || 1) + (f.filmRoom || 1)) * 0.01;
  const chemFactor = ((f.lockerRoomChemistry || 65) - 50) * 0.002;
  let wp = 0.25 + playerFactor * 0.30 + coachFactor + facilityFactor + chemFactor;
  wp = clamp(wp + randFloat(-0.06, 0.06), 0.05, 0.94);

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
  wp -= f.players.filter(p => p.injured && p.rating >= 80).length * 0.04;
  wp = clamp(wp, 0.05, 0.94);

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
  const games = lg === 'ngl' ? 17 : 82;
  const halfGames = f._halfGames || Math.floor(games / 2);
  const remainingGames = games - halfGames;
  const wp = f._halfWinProb || clamp((f.rosterQuality - 40) / 60, 0.05, 0.94);
  const econMod = f._halfEconMod || 1.0;

  // Simulate remaining games from half-season starting point
  let w = f.halfWins || 0;
  for (let g = 0; g < remainingGames; g++) if (Math.random() < wp) w++;
  const totalLosses = games - w;

  f.wins = w;
  f.losses = totalLosses;
  f.season = season;
  const winPct = w / games;

  // Revenue with economy modifier
  const att = calcAttendance(f.ticketPrice, f.fanRating, winPct, f.market, f.stadiumCondition, f.rosterQuality || 70);
  const gate = att * f.stadiumCapacity * f.ticketPrice * games / 1e6 * econMod;
  const tv = f.market * (0.5 + (f.tvTier || 1) * 0.3) * randFloat(0.9, 1.1);
  const merch = f.market * (f.merchMultiplier || 1) * winPct * randFloat(0.3, 0.5) * econMod;
  const spon = (f.sponsorLevel || 1) * f.market * 0.08 * randFloat(0.9, 1.1);
  const naming = f.namingRightsActive ? (f.namingRightsDeal || 3) : 0;
  const totalRev = gate + tv + merch + spon + naming;
  const staff = (f.scoutingStaff + f.developmentStaff + f.medicalStaff + f.marketingStaff) * 2;
  const fac = (f.trainingFacility + f.weightRoom + f.filmRoom) * 1.5;
  const maint = f.stadiumAge > 15 ? f.stadiumAge * 0.3 : 1;
  const interest = (f.debt || 0) * DEBT_INTEREST;
  const totalExp = f.totalSalary + staff + fac + maint + interest + (f.capDeadMoney || 0);
  const profit = totalRev - totalExp;
  f.finances = { revenue: r1(totalRev), expenses: r1(totalExp), profit: r1(profit) };
  f.cash = r1((f.cash || 0) + profit);

  // Naming rights countdown
  if (f.namingRightsActive && f.namingRightsYears) {
    f.namingRightsYears--;
    if (f.namingRightsYears <= 0) {
      f.namingRightsActive = false;
      f.namingRightsDeal = null;
      f.namingRightsName = null;
    }
  }

  // Fan rating
  let fd = 0;
  if (winPct > 0.7) fd = rand(3, 6);
  else if (winPct > 0.55) fd = rand(1, 3);
  else if (winPct < 0.3) fd = -rand(3, 7);
  else if (winPct < 0.4) fd = -rand(1, 3);
  fd += f.marketingStaff * 0.5;
  f.fanRating = clamp(Math.round(f.fanRating + fd), 0, 100);

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
  f.lockerRoomChemistry = clamp(Math.round(f.lockerRoomChemistry + cd / f.players.length * 3), 0, 100);

  // Player dev
  f.players.forEach(p => {
    p.age++;
    p.seasonsPlayed++;
    p.seasonsWithTeam++;
    if (!p.injured || p.injurySeverity !== 'severe') {
      const d = predictDev(p.age, p.rating, p.morale, f.developmentStaff, p.trait, lg);
      p.rating = clamp(p.rating + d, 40, 99);
      if (p.rating > p.careerStats.bestRating) p.careerStats.bestRating = p.rating;
    }
    p.careerStats.seasons++;
    p.yearsLeft--;
    if (winPct > 0.6) p.morale = clamp(p.morale + rand(2, 5), 0, 100);
    else if (winPct < 0.35) p.morale = clamp(p.morale - rand(2, 6), 0, 100);
    if (p.trait === 'volatile') p.morale = clamp(p.morale + rand(-10, 10), 0, 100);
  });

  // Check for local legends & retirements
  const retiring = f.players.filter(p => p.age >= 35 && Math.random() < 0.3);
  retiring.forEach(p => {
    if (p.seasonsWithTeam >= 5 && p.rating >= 70) {
      f.localLegends = [...(f.localLegends || []), { name: p.name, rating: p.careerStats.bestRating, seasons: p.seasonsWithTeam }];
      f.fanRating = clamp(f.fanRating + 3, 0, 100);
    }
  });

  // 3-slot model: contract expiry and slot sync
  if (f.star1 !== undefined) {
    if (f.star1 && f.star1.yearsLeft <= 0) { if (Math.random() < 0.6) f.star1 = null; }
    if (f.star2 && f.star2.yearsLeft <= 0) { if (Math.random() < 0.6) f.star2 = null; }
    if (f.corePiece && f.corePiece.yearsLeft <= 0) { if (Math.random() < 0.7) f.corePiece = null; }
    if (f.star1 && f.star1.age >= 36 && Math.random() < 0.4) f.star1 = null;
    if (f.star2 && f.star2.age >= 36 && Math.random() < 0.4) f.star2 = null;
    if (f.corePiece && f.corePiece.age >= 37 && Math.random() < 0.5) f.corePiece = null;
    f.players = [f.star1, f.star2, f.corePiece].filter(Boolean);
    f.players.forEach(p => { if (p.seasonsWithTeam >= 5 && p.rating >= 75) p.isLocalLegend = true; });
  } else {
    f.players = f.players.filter(p => !(p.age >= 35 && Math.random() < 0.5) && p.age < 39);
    f.players.forEach(p => { if (p.seasonsWithTeam >= 5 && p.rating >= 75) p.isLocalLegend = true; });
  }

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
  const ns = [...ul.ngl].sort((a, b) => b.wins - a.wins);
  const as2 = [...ul.abl].sort((a, b) => b.wins - a.wins);
  ns.forEach((t, i) => { t.playoffTeam = i < 14; t.leagueRank = i + 1; });
  as2.forEach((t, i) => { t.playoffTeam = i < 16; t.leagueRank = i + 1; });

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
  const perTeam = pool / all.length;
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

  const ns = [...lt.ngl].sort((a, b) => b.wins - a.wins);
  const as2 = [...lt.abl].sort((a, b) => b.wins - a.wins);
  ns.forEach((t, i) => { t.playoffTeam = i < 14; t.leagueRank = i + 1; });
  as2.forEach((t, i) => { t.playoffTeam = i < 16; t.leagueRank = i + 1; });

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
  const perTeam = pool / all.length;
  uf.forEach(p => {
    const share = r1(perTeam - p.finances.revenue * REVENUE_SHARE_PCT);
    p.cash = r1(p.cash + share);
    p.revShareReceived = share;
  });

  const leagueTeams = { ngl: ns, abl: as2 };
  return { leagueTeams, franchises: uf, standings: { ngl: ns, abl: as2 } };
}

// ============================================================
// DRAFT & FREE AGENTS
// ============================================================

/**
 * Generates a list of draft prospects with scouting-accuracy-adjusted ratings.
 * @param {string} lg - League identifier
 * @param {number} count - Number of prospects to generate
 * @param {number} [scoutLvl=1] - Scouting staff level (affects rating accuracy)
 * @returns {Object[]} Sorted array of prospect objects by projected rating
 */
export function generateDraftProspects(lg, count, scoutLvl = 1) {
  const pos = lg === 'ngl' ? NGL_POSITIONS : ABL_POSITIONS;
  return Array.from({ length: count }, () => {
    const p = pick(pos);
    const br = rand(50, 78);
    const acc = scoutLvl * 5;
    return {
      id: generateId(),
      name: generatePlayerName(),
      position: p,
      age: rand(21, 23),
      projectedRating: clamp(br + rand(-acc, acc), 45, 85),
      trueRating: clamp(br, 45, 85),
      upside: pick(['low', 'mid', 'high']),
      trait: generateTrait(),
    };
  }).sort((a, b) => b.projectedRating - a.projectedRating);
}

/**
 * Converts a draft prospect into a fully-formed player on a rookie contract.
 * @param {Object} p - Draft prospect object
 * @param {string} lg - League identifier
 * @returns {Object} Player object on a rookie deal
 */
export function draftPlayer(p, lg) {
  const cap = lg === 'ngl' ? NGL_SALARY_CAP : ABL_SALARY_CAP;
  const rs = lg === 'ngl' ? NGL_ROSTER_SIZE : ABL_ROSTER_SIZE;
  return {
    ...generatePlayer(p.position, lg, { age: p.age, rating: p.trueRating, trait: p.trait, yearsLeft: 4, seasonsPlayed: 0, seasonsWithTeam: 0 }),
    name: p.name,
    salary: r1(cap / rs * 0.4),
    isDrafted: true,
  };
}

/**
 * Generates a list of offseason free agent players available for signing.
 * @param {string} lg - League identifier
 * @param {number} [n=20] - Number of free agents to generate
 * @returns {Object[]} Sorted array of players by rating
 */
export function generateFreeAgents(lg, n = 20) {
  const pos = lg === 'ngl' ? NGL_POSITIONS : ABL_POSITIONS;
  return Array.from({ length: n }, () =>
    generatePlayer(pick(pos), lg, { age: rand(25, 34), rating: rand(55, 82), yearsLeft: 0 })
  ).sort((a, b) => b.rating - a.rating);
}

/**
 * Generates mid-season deadline free agents at lower quality than offseason free agents.
 * @param {string} lg - League identifier
 * @param {number} [n=5] - Number of deadline free agents to generate
 * @returns {Object[]} Sorted array of players by rating
 */
export function generateDeadlineFreeAgents(lg, n = 5) {
  const pos = lg === 'ngl' ? NGL_POSITIONS : ABL_POSITIONS;
  return Array.from({ length: n }, () =>
    generatePlayer(pick(pos), lg, { age: rand(26, 33), rating: rand(52, 70), yearsLeft: rand(1, 2) })
  ).sort((a, b) => b.rating - a.rating);
}

// ============================================================
// CAP, VALUATION, DEBT
// ============================================================

/**
 * Calculates current cap space and dead money breakdown for a franchise.
 * @param {Object} f - Franchise state
 * @returns {{ cap: number, used: number, space: number, deadMoney: number }}
 */
export function calculateCapSpace(f) {
  const cap = f.league === 'ngl' ? NGL_SALARY_CAP : ABL_SALARY_CAP;
  const inf = Math.pow(1 + CAP_INFLATION_RATE, f.season || 0);
  const adj = r1(cap * inf);
  const ts = f.players.reduce((s, p) => s + p.salary, 0);
  const dm = f.capDeadMoney || 0;
  return { cap: adj, used: r1(ts + dm), space: r1(adj - ts - dm), deadMoney: dm };
}

/**
 * Calculates the approximate franchise valuation based on market, performance, and assets.
 * @param {Object} f - Franchise or team state
 * @returns {number} Valuation in millions
 */
export function calculateValuation(f) {
  return Math.round(
    f.market * 3 +
    (f.wins / (f.wins + f.losses + 0.01)) * 50 +
    f.fanRating * 0.5 +
    (f.stadiumCondition || 70) * 0.2 +
    (f.championships || 0) * 15 +
    (CITY_ECONOMY[f.city] || 65) * 0.3
  );
}

/**
 * Returns the maximum loan amount available based on franchise valuation and existing debt.
 * @param {Object} f - Franchise state
 * @returns {number} Maximum loan amount in millions
 */
export function maxLoan(f) {
  return Math.round(calculateValuation(f) * MAX_DEBT_RATIO);
}

/**
 * Takes a loan up to the maximum allowed, adds cash and debt to franchise.
 * @param {Object} f - Franchise state
 * @param {number} amt - Requested loan amount
 * @returns {Object} Updated franchise state
 */
export function takeLoan(f, amt) {
  const mx = maxLoan(f) - (f.debt || 0);
  const a = Math.min(amt, mx);
  return { ...f, cash: r1((f.cash || 0) + a), debt: r1((f.debt || 0) + a) };
}

/**
 * Repays as much debt as possible given the available cash.
 * @param {Object} f - Franchise state
 * @param {number} amt - Amount to repay
 * @returns {Object} Updated franchise state
 */
export function repayDebt(f, amt) {
  const a = Math.min(amt, f.debt || 0, f.cash || 0);
  return { ...f, cash: r1(f.cash - a), debt: r1((f.debt || 0) - a) };
}

// ============================================================
// STAKES
// ============================================================

/**
 * Generates available minority stake purchase offers in AI-controlled teams.
 * @param {Object} lt - League teams state
 * @param {number} cash - Player's available cash
 * @param {number} season - Current season number
 * @returns {Object[]} Array of stake offer objects
 */
export function generateStakeOffers(lt, cash, season) {
  if (cash < 15 || season < 3) return [];
  const all = [...lt.ngl, ...lt.abl]
    .filter(t => !t.isPlayerOwned)
    .sort(() => Math.random() - 0.5)
    .slice(0, rand(1, 3));
  return all.map(t => {
    const v = calculateValuation(t);
    const pct = pick([10, 15, 20, 25]);
    return {
      id: generateId(),
      teamId: t.id,
      teamName: `${t.city} ${t.name}`,
      league: t.league,
      stakePct: pct,
      price: Math.round(v * (pct / 100) * randFloat(0.85, 1.15)),
      valuation: v,
      record: `${t.wins}-${t.losses}`,
      market: t.market,
    };
  });
}

/**
 * Calculates total stake income from all held stakes based on team profits.
 * @param {Object[]} stakes - Array of owned stake objects
 * @param {Object} lt - League teams state
 * @returns {number} Total income from stakes in millions
 */
export function calcStakeIncome(stakes, lt) {
  return stakes.reduce((tot, s) => {
    const all = [...(lt.ngl || []), ...(lt.abl || [])];
    const t = all.find(x => x.id === s.teamId);
    if (!t) return tot;
    return tot + r1((t.finances.profit || 0) * (s.stakePct / 100));
  }, 0);
}

/**
 * Calculates the current sell value of a stake holding with a 15% liquidity discount.
 * @param {Object} stake - Stake object with teamId, stakePct, and purchasePrice
 * @param {Object} lt - League teams state
 * @returns {number} Current sell value rounded to nearest integer
 */
export function calcStakeValue(stake, lt) {
  const all = [...(lt.ngl || []), ...(lt.abl || [])];
  const team = all.find(t => t.id === stake.teamId);
  if (!team) return stake.purchasePrice;
  const currentValuation = calculateValuation(team);
  return Math.round(currentValuation * (stake.stakePct / 100) * 0.85);
}

// ============================================================
// NOTIFICATIONS
// ============================================================

/**
 * Generates notification objects for important franchise events by comparing
 * current and previous franchise state.
 * @param {Object} f - Current franchise state
 * @param {Object} prevF - Previous franchise state (from last season or action)
 * @returns {Array<{id: string, severity: string, message: string, type: string}>}
 */
export function generateNotifications(f, prevF) {
  const notifications = [];

  // Players with expiring contracts
  f.players.forEach(p => {
    if (p.yearsLeft <= 1) {
      notifications.push({
        id: generateId(),
        severity: 'warning',
        message: `${p.name} has ${p.yearsLeft <= 0 ? 'an expiring' : '1 year remaining on their'} contract and may leave in free agency.`,
        type: 'contract_expiring',
      });
    }
  });

  // Stadium condition
  if (f.stadiumCondition < 30) {
    notifications.push({
      id: generateId(),
      severity: 'critical',
      message: `Stadium condition is critically low (${f.stadiumCondition}). Urgent renovations needed.`,
      type: 'stadium_condition',
    });
  } else if (f.stadiumCondition < 50) {
    notifications.push({
      id: generateId(),
      severity: 'warning',
      message: `Stadium condition is deteriorating (${f.stadiumCondition}). Consider scheduling repairs.`,
      type: 'stadium_condition',
    });
  }

  // Cap space
  const capInfo = calculateCapSpace(f);
  if (capInfo.space < 0) {
    notifications.push({
      id: generateId(),
      severity: 'critical',
      message: `You are over the salary cap by $${Math.abs(capInfo.space).toFixed(1)}M. Roster moves required.`,
      type: 'cap_space',
    });
  } else if (capInfo.space < 2) {
    notifications.push({
      id: generateId(),
      severity: 'warning',
      message: `Cap space is critically tight ($${capInfo.space.toFixed(1)}M remaining). Limited roster flexibility.`,
      type: 'cap_space',
    });
  }

  // Fan rating drop
  if (prevF && (prevF.fanRating - f.fanRating) > 10) {
    notifications.push({
      id: generateId(),
      severity: 'warning',
      message: `Fan rating has dropped ${prevF.fanRating - f.fanRating} points to ${f.fanRating}. Fan engagement needs attention.`,
      type: 'fan_rating',
    });
  }

  // Volatile trait players with low morale
  f.players.forEach(p => {
    if (p.trait === 'volatile' && p.morale < 40) {
      notifications.push({
        id: generateId(),
        severity: 'warning',
        message: `${p.name} (volatile) has very low morale (${p.morale}). Locker room disruption risk is high.`,
        type: 'player_morale',
      });
    }
  });

  return notifications;
}

// ============================================================
// GM REPUTATION
// ============================================================

/**
 * Calculates a new GM reputation score based on season performance and decisions.
 * Awards points for winning seasons, profitability, championships, and hometown signings.
 * Deducts points for losing seasons and releasing hometown players.
 * @param {number} rep - Current GM reputation score (0–100)
 * @param {Object} f - Current franchise state (after the season)
 * @param {Object} prevF - Previous franchise state (before the season)
 * @returns {number} New reputation score clamped to [0, 100]
 */
export function updateGMReputation(rep, f, prevF) {
  const games = f.league === 'ngl' ? 17 : 82;
  const wp = f.wins / Math.max(1, games);
  let delta = 0;

  // Winning/losing season
  if (wp > 0.6) delta += rand(2, 5);
  else if (wp < 0.35) delta -= rand(2, 5);

  // Profitability
  if (f.finances && f.finances.profit > 0) delta += rand(1, 3);

  // Championship
  const prevChamps = prevF ? (prevF.championships || 0) : 0;
  if ((f.championships || 0) > prevChamps) delta += 3;

  // Hometown player released (was in prevF, not in f)
  if (prevF) {
    const prevHometown = (prevF.players || []).filter(p => p.trait === 'hometown').map(p => p.id);
    const currIds = new Set((f.players || []).map(p => p.id));
    const released = prevHometown.filter(id => !currIds.has(id));
    if (released.length > 0) delta -= 1;

    // Hometown player signed (in f, not in prevF)
    const prevIds = new Set((prevF.players || []).map(p => p.id));
    const newHometown = (f.players || []).filter(p => p.trait === 'hometown' && !prevIds.has(p.id));
    if (newHometown.length > 0) delta += 1;
  }

  return clamp(rep + delta, 0, 100);
}

// ============================================================
// PRESS CONFERENCE
// ============================================================

/**
 * Generates press conference question/answer options based on current win percentage.
 * @param {Object} f - Franchise state
 * @returns {Object[]} Array of press conference prompt objects with options
 */
export function genPressConference(f) {
  const wp = f.wins / (f.wins + f.losses || 1);
  const out = [];
  if (wp > 0.6) {
    out.push({
      id: 'pc1',
      prompt: 'Reporter: "Can you guarantee a championship?"',
      options: [
        { label: 'Guarantee it', text: '"We\'re bringing the trophy home."', fanBonus: 8, mediaBonus: -5, moraleBonus: 10, risk: 'guarantee' },
        { label: 'Stay humble', text: '"Results will follow hard work."', fanBonus: 2, mediaBonus: 5, moraleBonus: 3 },
        { label: 'Deflect with humor', text: '"I guarantee the postgame spread."', fanBonus: 3, mediaBonus: 8, moraleBonus: 1 },
      ],
    });
  } else if (wp < 0.35) {
    out.push({
      id: 'pc1',
      prompt: 'Reporter: "Is it time for a full rebuild?"',
      options: [
        { label: 'Admit it', text: '"We\'re building for the future."', fanBonus: -3, mediaBonus: 6, moraleBonus: -5 },
        { label: 'Stay defiant', text: '"We\'re closer than people think."', fanBonus: 4, mediaBonus: -2, moraleBonus: 6 },
      ],
    });
  } else {
    out.push({
      id: 'pc1',
      prompt: 'Reporter: "What\'s the plan to contend?"',
      options: [
        { label: 'Bold moves', text: '"Expect upgrades soon."', fanBonus: 5, mediaBonus: 3, moraleBonus: -2 },
        { label: 'Trust process', text: '"Our core is developing."', fanBonus: 1, mediaBonus: 2, moraleBonus: 4 },
      ],
    });
  }
  out.push({
    id: 'pc2',
    prompt: `Reporter: "What are the ${f.name} doing for ${f.city}?"`,
    options: [
      { label: 'Highlight charity', communityBonus: 5, mediaBonus: 4, fanBonus: 2 },
      { label: 'Deflect to sport', communityBonus: -3, mediaBonus: -2, fanBonus: 1 },
    ],
  });
  return out;
}

// ============================================================
// RIVALRY EVENT
// ============================================================

/**
 * Generates a rivalry event if a rival team is outperforming the franchise.
 * @param {Object} f - Franchise state
 * @param {Object} lt - League teams state
 * @returns {Object|null} Rivalry event object or null
 */
export function genRivalryEvent(f, lt) {
  if (!f.rivalIds?.length) return null;
  const all = [...(lt.ngl || []), ...(lt.abl || [])];
  const rival = all.find(t => f.rivalIds.includes(t.id));
  if (!rival || rival.wins <= f.wins) return null;
  return {
    id: 'rivalry',
    title: `${rival.city} ${rival.name} Rivalry`,
    description: `The ${rival.city} ${rival.name} (${rival.wins}-${rival.losses}) are outperforming you.`,
    choices: [
      { label: 'Attack ads', cost: 2, fanBonus: 3, mediaBonus: -4 },
      { label: 'Focus inward', fanBonus: -1, moraleBonus: 3 },
      { label: 'Fan rally', cost: 1, fanBonus: 5, communityBonus: 3 },
    ],
  };
}

// ============================================================
// NEWSPAPER GENERATION
// ============================================================

/**
 * Generates a newspaper recap object summarizing the season's notable events.
 * @param {Object[]} standings - Sorted array of teams (first = league leader)
 * @param {Object[]} playerFr - Array of player franchise states
 * @param {number} season - Season number
 * @param {Object} lt - League teams state
 * @returns {Object} Newspaper object with headline, stories, and GM of Year
 */
export function generateNewspaper(standings, playerFr, season, lt) {
  const top = standings[0];
  const pf = playerFr[0];
  const allTeams = [...(lt.ngl || []), ...(lt.abl || [])];
  const mvpTeam = allTeams.sort((a, b) => b.rosterQuality - a.rosterQuality)[0];
  return {
    season,
    headline: `${top.city} ${top.name} Claim Top Spot with ${top.wins}-${top.losses} Record`,
    stories: [
      pf ? `The ${pf.city} ${pf.name} finished the season at ${pf.wins}-${pf.losses}${pf.playoffTeam ? ' and earned a playoff berth' : '. The offseason will be critical'}.` : '',
      `Around the league, ${mvpTeam?.city || 'several'} ${mvpTeam?.name || 'franchises'} boasted the highest roster quality at ${mvpTeam?.rosterQuality || '—'}.`,
      `The free agent market is expected to be active this offseason with several high-profile players hitting the market.`,
      `Stadium projects across the league continue to reshape the competitive landscape as cities invest in their franchises.`,
    ].filter(Boolean),
    gmOfYear: pf && pf.leagueRank <= 3 ? `${pf.city} ${pf.name} GM` : null,
  };
}

// ============================================================
// 3-SLOT ROSTER SYSTEM
// ============================================================

export const SLOT_BUDGET = { ngl: 80, abl: 42 };

/** Rep cost multiplier: low rep = pay premium for talent */
export function repCostMultiplier(gmRep) {
  if (gmRep < 35) return 1.35;
  if (gmRep < 55) return 1.15;
  if (gmRep < 70) return 1.0;
  return 0.90;
}

/** Weighted slot quality score (0–100) used for win probability */
export function calcSlotQuality(franchise) {
  let weighted = 0, denom = 0;
  if (franchise.star1) { weighted += franchise.star1.rating * 40; denom += 40; }
  if (franchise.star2) { weighted += franchise.star2.rating * 30; denom += 30; }
  if (franchise.corePiece) { weighted += franchise.corePiece.rating * 20; denom += 20; }
  weighted += (franchise.depthQuality || 50) * 10; denom += 10;
  return denom > 0 ? Math.round(weighted / denom) : 50;
}

/** Depth quality 1–100: remaining slot budget after star salaries */
export function calcDepthQuality(franchise) {
  const budget = SLOT_BUDGET[franchise.league] || 80;
  const used = [franchise.star1, franchise.star2, franchise.corePiece]
    .filter(Boolean)
    .reduce((s, p) => s + (p.salary || 0), 0);
  const remaining = Math.max(0, budget - used);
  return Math.round(clamp(remaining / budget * 100, 1, 100));
}

/** Generate a named player for a specific slot type */
export function generateSlotPlayer(slotType, league, gmRep = 50) {
  const ratingRanges = { star1: [70, 90], star2: [64, 84], corePiece: [55, 78] };
  const [lo, hi] = ratingRanges[slotType] || [55, 78];
  const repBonus = gmRep > 70 ? 3 : gmRep < 35 ? -3 : 0;
  const rating = clamp(rand(lo, hi) + repBonus, lo - 2, hi + 3);
  const pos = pick(league === 'ngl' ? NGL_POSITIONS : ABL_POSITIONS);
  const budget = SLOT_BUDGET[league] || 80;
  const budgetShare = slotType === 'star1' ? 0.37 : slotType === 'star2' ? 0.25 : 0.14;
  const trait = generateTrait();
  let baseSal = budget * budgetShare * (rating / 80) * randFloat(0.85, 1.15);
  if (trait === 'mercenary') baseSal *= 1.35;
  if (trait === 'hometown') baseSal *= 0.8;
  const maxSal = slotType === 'star1' ? 40 : slotType === 'star2' ? 28 : 16;
  return {
    id: generateId(),
    name: generatePlayerName(),
    position: pos,
    age: rand(22, 31),
    rating: clamp(rating, 40, 99),
    morale: rand(60, 85),
    trait,
    salary: r1(clamp(baseSal * repCostMultiplier(gmRep), 2, maxSal)),
    yearsLeft: rand(1, 4),
    seasonsPlayed: rand(1, 8),
    injured: false,
    injurySeverity: null,
    gamesOut: 0,
    isLocalLegend: false,
    seasonsWithTeam: 1,
    careerStats: { seasons: rand(1, 8), bestRating: rating },
    slotType,
  };
}

/** Generate the 3 initial named slots for a new franchise */
export function generateInitialSlots(league, market, gmRep = 50) {
  const tier = getMarketTier(market);
  const tierBonus = { 1: 7, 2: 4, 3: 1, 4: -2, 5: -5 }[tier] || 0;
  const effectiveRep = clamp(gmRep + tierBonus, 20, 85);
  return {
    star1: generateSlotPlayer('star1', league, effectiveRep),
    star2: generateSlotPlayer('star2', league, effectiveRep),
    corePiece: generateSlotPlayer('corePiece', league, effectiveRep),
  };
}

/** Get asking price for a franchise based on market size */
export function getFranchiseAskingPrice(team) {
  const m = team.market;
  const base = m >= 88 ? 68 : m >= 82 ? 54 : m >= 75 ? 42 : m >= 68 ? 32 : m >= 62 ? 24 : m >= 58 ? 18 : 13;
  return Math.round(base * randFloat(0.88, 1.18));
}

/** One-line flavor description for a franchise card */
export function getFranchiseFlavor(team, askingPrice) {
  const tier = getMarketTier(team.market);
  const debt = Math.max(0, askingPrice - 30);
  const flavors = {
    1: ['Large-market powerhouse — expectations are sky-high', 'Premium franchise in a media giant city', 'Big-city titan — resources to win, pressure to perform'],
    2: ['Established major-market franchise with a hungry fanbase', 'Storied team ready for the right GM to unlock its potential', 'Strong market foundation — ready to build a winner'],
    3: ['Mid-market contender with a proven, loyal fan base', 'Competitive city franchise — solid bones, room to grow', 'A franchise with history — and a chip on its shoulder'],
    4: ['Small-market team with a passionate, devoted fanbase', 'Scrappy underdog — low ceiling, maximum heart', 'Tight budgets, loyal fans, draft lottery upside'],
    5: ['Struggling basement franchise — maximum rebuild potential', 'Every dynasty starts somewhere — yours starts here', 'Rock bottom. The only direction is up.'],
  };
  const base = pick(flavors[tier] || flavors[4]);
  if (debt > 0) return `${base} — starts $${debt}M in debt`;
  return base;
}

/** Generate 2 draft pick positions for a franchise based on standings */
export function generateDraftPickPositions(franchise, leagueTeams) {
  const teams = leagueTeams[franchise.league] || [];
  const sorted = [...teams].sort((a, b) => a.wins - b.wins); // worst → best
  const rank = sorted.findIndex(t => t.id === franchise.id);
  const pickPos1 = rank >= 0 ? rank + 1 : Math.round(teams.length / 2);
  const offset = Math.round(teams.length / 2);
  const pickPos2 = Math.min(teams.length, pickPos1 + offset);
  return [
    { id: generateId(), round: 1, pickPos: pickPos1, season: franchise.season },
    { id: generateId(), round: 2, pickPos: pickPos2, season: franchise.season },
  ];
}

/** Generate an AI trade offer for one of the player's draft picks */
export function generatePickTradeOffer(pick) {
  const earlyBonus = Math.max(0, 8 - pick.pickPos);
  const cashVal = Math.round((3 + earlyBonus * 1.5) * randFloat(0.85, 1.25));
  const offerType = Math.random() < 0.55 ? 'cash' : 'swap_cash';
  const aiTeamNames = [
    'Dallas Lone Stars', 'Bay City Gold', 'Boston Ironclad', 'New York Titans',
    'Los Angeles Crown', 'Chicago Wolves', 'Miami Surge', 'Atlanta Phoenix',
    'Seattle Rain', 'Miami Tide', 'New York Skyline', 'Los Angeles Legends',
  ];
  const offeringTeam = pick(aiTeamNames);
  if (offerType === 'cash') {
    return { id: generateId(), pickRef: pick, offeringTeam, type: 'cash', cashValue: cashVal, label: `$${cashVal}M cash` };
  }
  const cashComp = Math.round(cashVal * 0.45);
  return { id: generateId(), pickRef: pick, offeringTeam, type: 'swap_cash', cashValue: cashComp, nextPickSeason: pick.season + 1, label: `Next season R1 + $${cashComp}M` };
}

/** Generate offseason free agent pool gated by GM rep */
export function generateOffseasonFAPool(league, gmRep = 50, n = 10) {
  const pos = league === 'ngl' ? NGL_POSITIONS : ABL_POSITIONS;
  const maxRating = gmRep < 35 ? 72 : gmRep < 60 ? 80 : 87;
  const minRating = gmRep < 35 ? 55 : 57;
  const costMult = repCostMultiplier(gmRep);
  return Array.from({ length: n }, () => {
    const rating = rand(minRating, maxRating);
    const p = generatePlayer(pick(pos), league, { age: rand(23, 33), rating, yearsLeft: rand(1, 3) });
    p.salary = r1(p.salary * costMult);
    return p;
  }).sort((a, b) => b.rating - a.rating);
}

/** Put a player in a slot (returns updated franchise or null if over budget) */
export function signToSlot(franchise, slotName, player) {
  const budget = SLOT_BUDGET[franchise.league] || 80;
  const others = ['star1', 'star2', 'corePiece'].filter(s => s !== slotName);
  const otherSalary = others.reduce((s, sl) => s + (franchise[sl]?.salary || 0), 0);
  if (otherSalary + player.salary > budget) return null;
  const updated = { ...franchise, [slotName]: { ...player, slotType: slotName } };
  updated.players = [updated.star1, updated.star2, updated.corePiece].filter(Boolean);
  updated.depthQuality = calcDepthQuality(updated);
  updated.rosterQuality = calcSlotQuality(updated);
  updated.totalSalary = r1(updated.players.reduce((s, p) => s + p.salary, 0));
  return updated;
}

/** Release a player from a slot */
export function releaseSlot(franchise, slotName) {
  const updated = { ...franchise, [slotName]: null };
  updated.players = [updated.star1, updated.star2, updated.corePiece].filter(Boolean);
  updated.depthQuality = calcDepthQuality(updated);
  updated.rosterQuality = calcSlotQuality(updated);
  updated.totalSalary = r1(updated.players.reduce((s, p) => s + p.salary, 0));
  return updated;
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

  const eastAll = nglTeams.filter(t => eastIds.has(t.id)).sort((a, b) => b.wins - a.wins);
  const westAll = nglTeams.filter(t => westIds.has(t.id)).sort((a, b) => b.wins - a.wins);

  const eastSeeds = eastAll.slice(0, 6).map((t, i) => ({ ...t, seed: i + 1, conf: 'East' }));
  const westSeeds = westAll.slice(0, 6).map((t, i) => ({ ...t, seed: i + 1, conf: 'West' }));

  const playerMadePlayoffs = playerFranchise
    ? [...eastSeeds, ...westSeeds].some(t => t.id === playerFranchise.id)
    : false;

  /** Simulate a single playoff game with upset variance & optional home advantage */
  function simGame(teamA, teamB, neutralSite = false) {
    const qA = teamA.rosterQuality || 70;
    const qB = teamB.rosterQuality || 70;
    // Base WP from quality difference (compressed — quality alone never decides)
    let wpA = 0.5 + (qA - qB) / 200;

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

    wpA = clamp(wpA, 0.05, 0.95);
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
  const eWC = [ewc1.winner, ewc2.winner].sort((a, b) => a.seed - b.seed);
  const wWC = [wwc1.winner, wwc2.winner].sort((a, b) => a.seed - b.seed);
  const ediv1 = simGame(eastSeeds[0], eWC[1]); // 1 vs higher-seeded WC winner
  const ediv2 = simGame(eastSeeds[1], eWC[0]); // 2 vs lower-seeded WC winner
  const wdiv1 = simGame(westSeeds[0], wWC[1]);
  const wdiv2 = simGame(westSeeds[1], wWC[0]);
  rounds.push({
    name: 'Divisional',
    games: [
      { conf: 'East', label: `#1 vs #${eWC[1].seed}`, ...ediv1 },
      { conf: 'East', label: `#2 vs #${eWC[0].seed}`, ...ediv2 },
      { conf: 'West', label: `#1 vs #${wWC[1].seed}`, ...wdiv1 },
      { conf: 'West', label: `#2 vs #${wWC[0].seed}`, ...wdiv2 },
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
