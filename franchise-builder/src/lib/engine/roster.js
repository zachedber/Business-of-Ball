import {
  NGL_POSITIONS, ABL_POSITIONS, NGL_ROSTER_SIZE, ABL_ROSTER_SIZE,
  NGL_SALARY_CAP, ABL_SALARY_CAP, PLAYER_TRAITS, TRAIT_WEIGHTS,
  PEAK_AGES, COACH_PERSONALITIES, HEAD_COACH_PERSONALITIES,
  OC_SCHEMES, DC_SCHEMES, PDC_SPECIALTIES, DEVELOPMENT_FOCUSES,
  LOCKER_ROOM_STYLES, STAFF_SALARIES, getMarketTier,
  MARKET_STADIUM_CAPACITY,
} from '@/data/leagues';
import { generatePlayerName, generateCoachName } from '@/data/names';
export { generatePlayerName, generateCoachName } from '@/data/names';

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

export function r1(n) {
  return Math.round(n * 10) / 10;
}

export const PLAYER_RATING_RANGES = Object.freeze({
  cornerstone: [91, 95],
  star: [83, 90],
  solidStarter: [78, 82],
  averageStarter: [74, 76],
  taxiProspect: [55, 65],
});

function gaussianRandom(mean = 0, stdDev = 1) {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdDev + mean;
}

function weightedPick(weightMap) {
  const entries = Object.entries(weightMap);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

function ratingFromBand([lo, hi]) {
  return rand(lo, hi);
}

export function generateTieredRating(weightMap) {
  const key = weightedPick(weightMap);
  return ratingFromBand(PLAYER_RATING_RANGES[key]);
}

export function determineDevelopmentPhase(age) {
  if (age < 27) return 'Rising';
  if (age <= 31) return 'Peak';
  return 'Declining';
}

export function generateHiddenPotential(age, rating) {
  const phase = determineDevelopmentPhase(age);
  if (phase !== 'Rising') return clamp(Math.round(rating), 40, 99);
  const youthBoost = clamp(Math.round(gaussianRandom(8, 3)), 3, 15);
  return clamp(Math.round(rating + youthBoost), Math.round(rating + 3), 99);
}

function generateRosterRating() {
  // Bell-curve approximation centered near average starter quality (75 OVR)
  return generateTieredRating({
    taxiProspect: 0.20,
    averageStarter: 0.30,
    solidStarter: 0.28,
    star: 0.18,
    cornerstone: 0.04,
  });
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
// STRING FORMATTING
// ============================================================

const LABEL_MAP = {
  'injury_prone': 'injury prone',
  'players_coach': "player's coach",
  'bend_dont_break': "bend don't break",
  'run_heavy': 'run heavy',
  'pass_heavy': 'pass heavy',
  'all_around': 'all around',
  'skill_positions': 'skill positions',
  'hometown': 'hometown hero',
  'volatile': 'volatile',
  'mercenary': 'mercenary',
  'boom': '🟢 Boom',
  'recession': '🔴 Recession',
  'stable': '⚪ Stable',
  'youth': 'youth development',
  'veterans': 'veteran development',
  'stars': 'star development',
  'disciplinarian': 'disciplinarian',
  'analytics': 'analytics-driven',
  'leader': 'leader',
  'showman': 'showman',
  'ironman': 'ironman',
  'clutch': 'clutch',
  'aggressive': 'aggressive',
  'zone': 'zone',
  'balanced': 'balanced',
  'linemen': 'linemen',
};

/**
 * Convert raw enum/code strings to display-friendly labels.
 * @param {string} str - Raw string
 * @returns {string} Display string
 */
export function formatLabel(str) {
  if (!str) return '—';
  if (LABEL_MAP[str]) return LABEL_MAP[str];
  return str.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
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
  const rating = opts.rating || generateRosterRating();
  const clampedRating = clamp(rating, 40, 99);
  const developmentPhase = determineDevelopmentPhase(age);
  const hiddenPotential = opts.hiddenPotential != null
    ? clamp(Math.round(opts.hiddenPotential), 40, 99)
    : generateHiddenPotential(age, clampedRating);
  const trait = opts.trait !== undefined ? opts.trait : generateTrait();
  const yrs = opts.yearsLeft || rand(1, 4);
  const sp = opts.seasonsPlayed || Math.max(1, age - 21);
  const cap = lg === 'ngl' ? NGL_SALARY_CAP : ABL_SALARY_CAP;
  const rs = lg === 'ngl' ? NGL_ROSTER_SIZE : ABL_ROSTER_SIZE;
  let sal = cap / rs * (clampedRating / 72) * randFloat(0.7, 1.3);
  if (trait === 'mercenary') sal *= 1.4;
  if (trait === 'hometown') sal *= 0.8;
  return {
    id: generateId(),
    name: generatePlayerName(),
    position: pos,
    age,
    rating: clampedRating,
    developmentPhase,
    hiddenPotential,
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
    careerStats: { seasons: sp, bestRating: clampedRating },
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
    personality: pick(HEAD_COACH_PERSONALITIES),
    level: rand(1, 3),
    age: rand(40, 65),
    seasonsWithTeam: 0,
    developmentFocus: pick(DEVELOPMENT_FOCUSES),
    lockerRoomStyle: pick(LOCKER_ROOM_STYLES),
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
  const deadAmount = r1((f.coach?.level || 0) * 2);
  return {
    ...f,
    coach: { name: 'Interim Coach', level: 1, personality: 'Tactician', seasonsWithTeam: 0, age: 50 },
    // Round dead cap into franchise state immediately so coach buyouts stay in sync with cap math.
    capDeadMoney: r1((f.capDeadMoney || 0) + deadAmount),
    deadCapLog: [
      ...(f.deadCapLog || []),
      { name: f.coach.name, reason: 'Coach Fired', amount: deadAmount, season: f.season || 1 },
    ],
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

/** Generate an Offensive Coordinator */
export function generateOC() {
  const level = rand(1, 2);
  return {
    name: generateCoachName(),
    role: 'OC',
    scheme: pick(OC_SCHEMES),
    level,
    age: rand(35, 55),
    seasonsWithTeam: 0,
    salary: STAFF_SALARIES.oc[level] || 1,
  };
}

/** Generate a Defensive Coordinator */
export function generateDC() {
  const level = rand(1, 2);
  return {
    name: generateCoachName(),
    role: 'DC',
    scheme: pick(DC_SCHEMES),
    level,
    age: rand(35, 55),
    seasonsWithTeam: 0,
    salary: STAFF_SALARIES.dc[level] || 1,
  };
}

/** Generate a Player Development Coach */
export function generatePDC() {
  const level = rand(1, 2);
  return {
    name: generateCoachName(),
    role: 'PDC',
    specialty: pick(PDC_SPECIALTIES),
    level,
    age: rand(35, 55),
    seasonsWithTeam: 0,
    salary: STAFF_SALARIES.pdc[level] || 0.8,
  };
}

/** Generate a pool of staff candidates for a role */
export function generateStaffCandidates(role, gmRep = 50, n = 4) {
  const maxLevel = gmRep > 60 ? 3 : gmRep > 35 ? 2 : 2;
  return Array.from({ length: n }, () => {
    const level = gmRep > 60 && Math.random() < 0.4 ? 3 : rand(1, Math.min(maxLevel, 2));
    let candidate = { level, age: rand(35, 60), seasonsWithTeam: 0, salary: 0 };
    if (role === 'OC') {
      candidate = { ...candidate, name: generateCoachName(), role: 'OC', scheme: pick(OC_SCHEMES), salary: STAFF_SALARIES.oc[level] || 1 };
    } else if (role === 'DC') {
      candidate = { ...candidate, name: generateCoachName(), role: 'DC', scheme: pick(DC_SCHEMES), salary: STAFF_SALARIES.dc[level] || 1 };
    } else {
      candidate = { ...candidate, name: generateCoachName(), role: 'PDC', specialty: pick(PDC_SPECIALTIES), salary: STAFF_SALARIES.pdc[level] || 0.8 };
    }
    return candidate;
  });
}

/** Fire a coordinator (offseason). Returns updated franchise or null if mid-season. */
export function fireCoordinator(f, role) {
  const fieldMap = { OC: 'offensiveCoordinator', DC: 'defensiveCoordinator', PDC: 'playerDevCoach' };
  const field = fieldMap[role];
  if (!field || !f[field]) return f;
  const severance = f[field].salary || 1;
  const wasLvl3 = f[field].level >= 3;
  return {
    ...f,
    [field]: null,
    cash: r1((f.cash || 0) - severance),
    staffChemistry: clamp((f.staffChemistry || 65) - 10, 0, 100),
    // If fired head-level staff, note instability
    pendingStadiumEvent: wasLvl3 ? { type: 'staff_fired', headline: 'Elite Coordinator Released', desc: `Releasing a Level 3 coordinator draws scrutiny. GM Rep may be affected.` } : null,
  };
}

/** Hire a coordinator candidate. Returns updated franchise. */
export function hireCoordinator(f, role, candidate) {
  const fieldMap = { OC: 'offensiveCoordinator', DC: 'defensiveCoordinator', PDC: 'playerDevCoach' };
  const field = fieldMap[role];
  if (!field) return f;
  const firstSeasonSalary = candidate.salary || 1;
  if ((f.cash || 0) < firstSeasonSalary) return f;
  return {
    ...f,
    [field]: { ...candidate, seasonsWithTeam: 0 },
    cash: r1((f.cash || 0) - firstSeasonSalary),
  };
}

/** Calculate scheme fit (0-100) for a franchise */
export function calculateSchemeFit(f) {
  let fit = 50;
  const players = [f.star1, f.star2, f.corePiece].filter(Boolean);
  const avgAge = players.length > 0 ? players.reduce((s, p) => s + (p.age || 26), 0) / players.length : 26;
  const maxRating = players.length > 0 ? Math.max(...players.map(p => p.rating || 0)) : 0;
  const hc = f.coach;

  // Head coach development focus fit
  if (hc?.developmentFocus) {
    if (hc.developmentFocus === 'youth' && avgAge < 26) fit += 10;
    if (hc.developmentFocus === 'youth' && avgAge > 30) fit -= 8;
    if (hc.developmentFocus === 'veterans' && avgAge > 28) fit += 10;
    if (hc.developmentFocus === 'veterans' && avgAge < 25) fit -= 8;
    if (hc.developmentFocus === 'stars' && maxRating >= 82) fit += 10;
    if (hc.developmentFocus === 'stars' && maxRating < 78) fit -= 10;
  }

  // OC scheme fit
  const oc = f.offensiveCoordinator;
  if (oc) {
    const skillPositions = ['QB','WR','RB','TE','PG','SG','SF'];
    const runPositions = ['RB','FB','OL','C','OG','OT'];
    const passPositions = ['QB','WR','TE'];
    if (oc.scheme === 'run_heavy' && players.some(p => runPositions.includes(p.position))) fit += 8;
    if (oc.scheme === 'pass_heavy' && players.some(p => passPositions.includes(p.position))) fit += 8;
    if (oc.scheme === 'balanced') fit += 4;
  }

  // DC scheme fit
  const dc = f.defensiveCoordinator;
  if (dc) {
    const hasEnforcer = players.some(p => p.trait === 'leader' || p.trait === 'clutch');
    if (dc.scheme === 'aggressive' && hasEnforcer) fit += 6;
    if (dc.scheme === 'zone' && hc?.lockerRoomStyle === 'analytics') fit += 6;
    if (dc.scheme === 'bend_dont_break' && (f.fanRating || 50) > 65) fit += 4;
  }

  return clamp(fit, 0, 100);
}

/** Update staff chemistry at end of season */
export function updateStaffChemistry(f) {
  const hc = f.coach;
  const oc = f.offensiveCoordinator;
  const dc = f.defensiveCoordinator;
  const pdc = f.playerDevCoach;
  let delta = 0;

  if (hc && oc && hc.lockerRoomStyle && hc.lockerRoomStyle === oc.scheme?.includes?.('analytics') ? 'analytics' : hc.lockerRoomStyle) {
    // same philosophy: small bonus
    delta += 1;
  }
  if (hc?.lockerRoomStyle === 'disciplinarian' && dc?.scheme === 'aggressive') delta += 4;
  if (hc?.lockerRoomStyle === 'players_coach' && dc?.scheme === 'bend_dont_break') delta += 4;
  if (hc?.lockerRoomStyle === 'analytics' && pdc?.level >= 3) delta += 5;

  // New hires adjustment period
  let newHires = 0;
  if ((oc?.seasonsWithTeam || 0) === 0) newHires++;
  if ((dc?.seasonsWithTeam || 0) === 0) newHires++;
  if ((pdc?.seasonsWithTeam || 0) === 0) newHires++;
  if ((hc?.seasonsWithTeam || 0) === 0) newHires++;
  delta -= newHires * 3;

  const newChem = clamp((f.staffChemistry || 65) + delta, 0, 100);

  // Dynasty cohesion bonus check
  let streakYears = f.staffChemistryStreakYears || 0;
  let dynastyCohesionBonus = f.dynastyCohesionBonus || false;
  if (newChem > 75) {
    streakYears++;
    if (streakYears >= 3 && !dynastyCohesionBonus) {
      dynastyCohesionBonus = true;
      delta += 5; // one-time bonus
    }
  } else {
    streakYears = 0;
  }

  // Age coordinators
  const aged = (coord) => coord ? { ...coord, age: (coord.age || 45) + 1, seasonsWithTeam: (coord.seasonsWithTeam || 0) + 1 } : null;

  return {
    ...f,
    staffChemistry: clamp(newChem + (dynastyCohesionBonus && streakYears === 3 ? 5 : 0), 0, 100),
    staffChemistryStreakYears: streakYears,
    dynastyCohesionBonus,
    offensiveCoordinator: aged(oc),
    defensiveCoordinator: aged(dc),
    playerDevCoach: aged(pdc),
  };
}

/** Weighted slot quality score (0–100) used for win probability */
export function calcSlotQuality(franchise) {
  let weighted = 0, denom = 0;
  if (franchise.star1) { weighted += franchise.star1.rating * 40; denom += 40; }
  if (franchise.star2) { weighted += franchise.star2.rating * 30; denom += 30; }
  if (franchise.corePiece) { weighted += franchise.corePiece.rating * 20; denom += 20; }
  weighted += (franchise.depthQuality || 50) * 10; denom += 10;
  const raw = denom > 0 ? Math.round(weighted / denom) : 50;
  // If no star players are present, cap quality — depth alone can't carry a team
  const hasStars = franchise.star1 || franchise.star2 || franchise.corePiece;
  return hasStars ? raw : Math.min(raw, 35);
}

/** Depth quality 1–100: remaining slot budget after star salaries */
export function calcDepthQuality(franchise) {
  const budget = SLOT_BUDGET[franchise.league] || 80;
  const stars = [franchise.star1, franchise.star2, franchise.corePiece].filter(Boolean);
  const used = stars.reduce((s, p) => s + (p.salary || 0), 0);
  const remaining = Math.max(0, budget - used);
  // If no star players at all, depth quality is minimal — no roster backbone
  if (stars.length === 0) return 1;
  return Math.round(clamp(remaining / budget * 100, 1, 100));
}

/** Generate a named player for a specific slot type */
export function generateSlotPlayer(slotType, league, gmRep = 50) {
  const ratingRanges = {
    star1: PLAYER_RATING_RANGES.cornerstone,
    star2: PLAYER_RATING_RANGES.star,
    corePiece: [PLAYER_RATING_RANGES.averageStarter[0], PLAYER_RATING_RANGES.solidStarter[1]],
  };
  const [lo, hi] = ratingRanges[slotType] || [PLAYER_RATING_RANGES.taxiProspect[0], PLAYER_RATING_RANGES.solidStarter[1]];
  const repBonus = gmRep > 70 ? 3 : gmRep < 35 ? -3 : 0;
  const rating = clamp(rand(lo, hi) + repBonus, lo - 2, hi + 3);
  const age = rand(22, 31);
  const developmentPhase = determineDevelopmentPhase(age);
  const hiddenPotential = generateHiddenPotential(age, rating);
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
    age,
    rating: clamp(rating, 40, 99),
    developmentPhase,
    hiddenPotential,
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

/** Put a player in a slot (returns updated franchise or null if over budget) */
export function signToSlot(franchise, slotName, player) {
  if (!franchise || !player || !slotName) return null; // Bugfix: invalid free-agency calls now fail closed instead of writing partial slot state.
  if (franchise[slotName]) return null; // Bugfix: the same free-agency slot can no longer be filled twice in one signing window.
  if ((franchise.cash || 0) < (player.salary || 0)) return null; // Bugfix: cash-poor franchises can no longer sign players they cannot afford.
  if (['star1', 'star2', 'corePiece'].some((slot) => franchise[slot]?.id === player.id)) return null; // Bugfix: a player already rostered in a slot cannot be signed twice.
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

/** Release a player from a slot (Phase 3: 60/40 dead cap split across 2 seasons) */
export function releaseSlot(franchise, slotName) {
  const p = franchise[slotName];
  // Dead cap: derive the deferred slice from the rounded current-year slice so both pieces always sum to the full remaining value.
  const remainingValue = p && p.yearsLeft > 0 ? r1((p.salary || 0) * p.yearsLeft) : 0;
  const dead60 = r1(remainingValue * 0.6);
  const dead40 = r1(remainingValue - dead60);
  const updated = {
    ...franchise,
    [slotName]: null,
    capDeadMoney: r1(Math.max(0, (franchise.capDeadMoney || 0) + dead60)),
    deferredDeadCap: r1(Math.max(0, (franchise.deferredDeadCap || 0) + dead40)),
    deadCapLog: [
      ...(franchise.deadCapLog || []),
      ...(p ? [{ name: p.name, reason: 'Released', amount: r1(dead60 + dead40), season: franchise.season || 1 }] : []),
    ],
  };
  updated.players = [updated.star1, updated.star2, updated.corePiece].filter(Boolean);
  updated.depthQuality = calcDepthQuality(updated);
  updated.rosterQuality = calcSlotQuality(updated);
  updated.totalSalary = r1(updated.players.reduce((s, p) => s + p.salary, 0));
  return updated;
}

/**
 * Generates a list of draft prospects with scouting-accuracy-adjusted ratings.
 * @param {string} lg - League identifier
 * @param {number} count - Number of prospects to generate
 * @param {number} [scoutLvl=1] - Scouting staff level (affects rating accuracy)
 * @param {number} [round=1] - Draft round used to tier talent and upside odds
 * @returns {Object[]} Sorted array of prospect objects by projected rating
 */
export function generateDraftProspects(lg, count, scoutLvl = 1, round = 1) {
  if (!count || count <= 0) return []; // Bugfix: draft generation now returns an empty board when no pick inventory remains.
  const pos = lg === 'ngl' ? NGL_POSITIONS : ABL_POSITIONS;
  const roundProfile = round === 1
    ? {
      tierWeights: { cornerstone: 0.10, star: 0.38, solidStarter: 0.34, averageStarter: 0.16, taxiProspect: 0.02 },
      upsideWeights: ['high', 'high', 'high', 'mid', 'mid', 'low'],
    }
    : round === 2
      ? {
        tierWeights: { cornerstone: 0.02, star: 0.14, solidStarter: 0.34, averageStarter: 0.32, taxiProspect: 0.18 },
        upsideWeights: ['high', 'high', 'mid', 'mid', 'mid', 'low', 'low'],
      }
      : round === 3
        ? {
          tierWeights: { cornerstone: 0.0, star: 0.04, solidStarter: 0.20, averageStarter: 0.36, taxiProspect: 0.40 },
          upsideWeights: ['high', 'mid', 'mid', 'mid', 'low', 'low', 'low'],
        }
        : {
          tierWeights: { cornerstone: 0.0, star: 0.0, solidStarter: 0.08, averageStarter: 0.20, taxiProspect: 0.72 },
          upsideWeights: ['mid', 'mid', 'low', 'low', 'low', 'low'],
        };

  return Array.from({ length: count }, () => {
    const p = pick(pos);
    const br = generateTieredRating(roundProfile.tierWeights);
    const acc = scoutLvl * 5;
    const projMid = clamp(br + rand(-acc, acc), 50, 95);
    const spread = Math.max(3, 12 - scoutLvl * 2);
    return {
      id: generateId(),
      name: generatePlayerName(),
      position: p,
      age: rand(21, 23),
      projectedRange: { low: clamp(projMid - spread, 50, 92), high: clamp(projMid + spread, 55, 95) },
      trueRating: clamp(br, 55, 95),
      upside: pick(roundProfile.upsideWeights),
      trait: generateTrait(),
      scoutReport: scoutLvl >= 3 ? 'Detailed' : scoutLvl >= 2 ? 'Standard' : 'Basic',
    };
  }).sort((a, b) => {
    const aMid = (a.projectedRange.high + a.projectedRange.low) / 2;
    const bMid = (b.projectedRange.high + b.projectedRange.low) / 2;
    return bMid - aMid;
  });
}

/**
 * Converts a draft prospect into a fully-formed player on a rookie contract.
 * @param {Object} p - Draft prospect object
 * @param {string} lg - League identifier
 * @returns {Object} Player object on a rookie deal
 */
export function draftPlayer(p, lg) {
  if (!p) return null; // Bugfix: empty draft clicks now resolve safely instead of crashing player creation.
  const cap = lg === 'ngl' ? NGL_SALARY_CAP : ABL_SALARY_CAP;
  const rs = lg === 'ngl' ? NGL_ROSTER_SIZE : ABL_ROSTER_SIZE;
  // trueRating available internally; from UI (stripped) use projectedRange reveal
  const rating = p.trueRating != null
    ? p.trueRating
    : p.projectedRange
      ? rand(p.projectedRange.low, p.projectedRange.high)
      : 65;
  return {
    ...generatePlayer(p.position, lg, { age: p.age, rating, trait: p.trait, yearsLeft: 4, seasonsPlayed: 0, seasonsWithTeam: 0 }),
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
    generatePlayer(pick(pos), lg, {
      age: rand(25, 34),
      rating: generateTieredRating({ star: 0.14, solidStarter: 0.30, averageStarter: 0.30, taxiProspect: 0.26 }),
      yearsLeft: 0,
    })
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
    generatePlayer(pick(pos), lg, {
      age: rand(26, 33),
      rating: generateTieredRating({ solidStarter: 0.12, averageStarter: 0.28, taxiProspect: 0.60 }),
      yearsLeft: rand(1, 2),
    })
  ).sort((a, b) => b.rating - a.rating);
}

/** Generate offseason free agent pool gated by GM rep */
export function generateOffseasonFAPool(league, gmRep = 50, n = 10) {
  const pos = league === 'ngl' ? NGL_POSITIONS : ABL_POSITIONS;
  const ratingWeights = gmRep < 35
    ? { star: 0.03, solidStarter: 0.15, averageStarter: 0.28, taxiProspect: 0.54 }
    : gmRep < 60
      ? { star: 0.10, solidStarter: 0.26, averageStarter: 0.30, taxiProspect: 0.34 }
      : { cornerstone: 0.03, star: 0.20, solidStarter: 0.32, averageStarter: 0.25, taxiProspect: 0.20 };
  const costMult = repCostMultiplier(gmRep);
  return Array.from({ length: n }, () => {
    const rating = generateTieredRating(ratingWeights);
    const p = generatePlayer(pick(pos), league, { age: rand(23, 33), rating, yearsLeft: rand(1, 3) });
    p.salary = r1(p.salary * costMult);
    return p;
  }).sort((a, b) => b.rating - a.rating);
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

/**
 * Initialize draft pick inventory for a new season.
 * @param {number} season - Season number
 * @param {string} teamId - Team ID
 * @returns {Object[]} Array of pick objects
 */
export function initDraftPickInventory(season, teamId) {
  return [
    { id: generateId(), round: 1, season, originalTeam: teamId, isFuture: false },
    { id: generateId(), round: 2, season, originalTeam: teamId, isFuture: false },
  ];
}

/** Generate an AI trade offer for one of the player's draft picks */
export function generatePickTradeOffer(draftPick) {
  const earlyBonus = Math.max(0, 8 - draftPick.pickPos);
  const cashVal = Math.round((3 + earlyBonus * 1.5) * randFloat(0.85, 1.25));
  const offerType = Math.random() < 0.55 ? 'cash' : 'swap_cash';
  const aiTeamNames = [
    'Dallas Lone Stars', 'Bay City Gold', 'Boston Ironclad', 'New York Titans',
    'Los Angeles Crown', 'Chicago Wolves', 'Miami Surge', 'Atlanta Phoenix',
    'Seattle Rain', 'Miami Tide', 'New York Skyline', 'Los Angeles Legends',
  ];
  const offeringTeam = pick(aiTeamNames);
  if (offerType === 'cash') {
    return { id: generateId(), pickRef: draftPick, offeringTeam, type: 'cash', cashValue: cashVal, label: `$${cashVal}M cash` };
  }
  const cashComp = Math.round(cashVal * 0.45);
  return { id: generateId(), pickRef: draftPick, offeringTeam, type: 'swap_cash', cashValue: cashComp, nextPickSeason: draftPick.season + 1, label: `Next season R1 + $${cashComp}M` };
}

/**
 * Evaluate an AI trade offer for draft picks.
 * @param {Object} offer - { playerPicks, playerCash, aiPick }
 * @param {number} gmRep - GM reputation
 * @returns {{ accepted: boolean, reason: string }}
 */
export function evaluatePickTrade(offer, gmRep) {
  // Value picks linearly: pick 1 = 10pts, pick 32 = 1pt
  function pickValue(round, pickPos) {
    if (round === 1) return Math.max(1, 11 - (pickPos || 16) * 10 / 32);
    return Math.max(0.5, 5 - (pickPos || 16) * 4 / 32);
  }

  let playerValue = 0;
  for (const p of (offer.playerPicks || [])) {
    playerValue += pickValue(p.round, p.pickPos);
  }
  playerValue += (offer.playerCash || 0) * 0.5; // $1M = 0.5 points

  const aiValue = pickValue(offer.aiPick?.round || 1, offer.aiPick?.pickPos || 1);
  const repDiscount = gmRep > 60 ? 0.90 : 1.0;
  const variance = randFloat(0.85, 1.15);
  const askValue = aiValue * repDiscount * variance;

  if (playerValue >= askValue) {
    return { accepted: true, reason: 'Trade accepted!' };
  }
  return { accepted: false, reason: 'Not enough value. Sweeten the deal.' };
}

/**
 * Generate AI trade partners for draft day.
 * @param {Object} lt - League teams
 * @param {string} league - 'ngl' or 'abl'
 * @param {number} season - Current season
 * @returns {Object[]} Array of 3 trade partner objects
 */
export function generateDraftTradePartners(lt, league, season) {
  const teams = (lt[league] || []).filter(t => !t.isPlayerOwned).sort(() => Math.random() - 0.5).slice(0, 3);
  return teams.map(t => {
    const pickPos = rand(1, 32);
    const askCash = rand(3, 12);
    return {
      id: generateId(),
      teamId: t.id,
      teamName: `${t.city} ${t.name}`,
      availablePick: { id: generateId(), round: 1, pickPos, season, originalTeam: t.id, isFuture: false },
      askingPrice: `R1 Pick #${pickPos} — asking $${askCash}M or equivalent pick value`,
      askCash,
      askPickPos: pickPos,
    };
  });
}

/**
 * Generates extension demand events for any slot player entering their final year.
 * @param {Object} f - Franchise state
 * @param {number} gmRep - GM reputation (0-100)
 * @returns {Object[]} Array of extension demand events
 */
export function generateExtensionDemands(f, gmRep) {
  const events = [];
  const slots = [
    { key: 'star1', label: 'Star 1' },
    { key: 'star2', label: 'Star 2' },
    { key: 'corePiece', label: 'Core Piece' },
  ];
  for (const { key, label } of slots) {
    const p = f[key];
    // Check yearsLeft <= 1: after endOfSeasonAging has decremented yearsLeft,
    // yearsLeft === 1 means entering their final contract year, and
    // yearsLeft === 0 means contract just expired (player may leave).
    if (!p || p.yearsLeft > 1) continue;

    // Extension cost: 10-25% salary increase
    let extMult = 1.10 + (p.rating / 100) * 0.15; // 10-25% increase
    if (p.trait === 'mercenary') extMult *= 1.20;
    if (p.trait === 'leader') extMult *= 1.05;
    if (p.trait === 'hometown') extMult *= 0.90;
    // GM rep discount (max 10%)
    const repDiscount = Math.min(0.10, (gmRep - 50) / 500);
    extMult = Math.max(1.05, extMult - repDiscount);
    const extSalary = r1(p.salary * extMult);
    const extYears = rand(2, 3);

    events.push({
      id: `ext_${p.id}`,
      type: 'extension_demand',
      title: `${p.name} Extension Demand`,
      description: `${p.name} (${label}, ${p.rating} rtg) is entering the final year of their contract and wants to discuss an extension. They are seeking $${extSalary}M/yr for ${extYears} years — a ${Math.round((extMult - 1) * 100)}% raise.`,
      playerId: p.id,
      slotKey: key,
      extSalary,
      extYears,
      player: p,
      choices: [
        {
          label: `Sign Extension — $${extSalary}M/yr × ${extYears}yr`,
          action: 'sign',
          moraleBonus: 10,
          chemBonus: 5,
          cost: 0,
        },
        {
          label: 'Let them play out the year',
          action: 'play_out',
          moraleBonus: 0,
          chemBonus: 0,
          cost: 0,
        },
        {
          label: 'Release now',
          action: 'release',
          moraleBonus: 0,
          chemBonus: 0,
          cost: 0,
        },
      ],
      resolved: false,
    });
  }
  return events;
}

// ============================================================
// END-OF-SEASON UNIFIED AGING — 1.1
// ============================================================

/**
 * Shared aging/development logic for a single player.
 * Applies rating development and morale shift based on win percentage.
 * @param {Object} player - Shallow-copied player object to update in place
 * @param {number} devStaff - Development staff level
 * @param {number} winPct - Season win percentage (0–1)
 * @param {number} ps - Peak age start
 * @param {number} pe - Peak age end
 */
function processPlayerAging(player, devStaff, winPct, ps, pe) {
  const rating = player.rating || 50;
  const morale = player.morale || 60;

  // Development rating change
  if (!player.injured || player.injurySeverity !== 'severe') {
    const ageFactor = player.age < ps
      ? (ps - player.age) * 0.6
      : player.age <= pe ? 0.3 : -(player.age - pe) * 0.8;
    let traitBonus = 0;
    if (player.trait === 'hometown') traitBonus = 0.3;
    else if (player.trait === 'volatile') traitBonus = randFloat(-1, 1.5);
    else if (player.trait === 'leader') traitBonus = 0.2;
    const ceilingPenalty = rating > 85 ? -(rating - 85) * 0.15 : 0;
    const delta = Math.round(clamp(
      ageFactor + devStaff * 0.5 + (morale - 50) * 0.015 + traitBonus + ceilingPenalty + randFloat(-1.5, 1.5),
      -5, 8
    ));
    player.rating = clamp(rating + delta, 40, 99);
    player.careerStats = {
      ...player.careerStats,
      seasons: (player.careerStats?.seasons || 0) + 1,
      bestRating: Math.max(player.rating, player.careerStats?.bestRating || 0),
    };
  } else {
    player.careerStats = { ...player.careerStats, seasons: (player.careerStats?.seasons || 0) + 1 };
  }

  // Morale shift
  if (winPct > 0.6) player.morale = clamp(morale + rand(1, 3), 0, 100);
  else if (winPct < 0.35) player.morale = clamp(morale - rand(1, 3), 0, 100);
  if (player.trait === 'volatile') player.morale = clamp((player.morale || 60) + rand(-10, 10), 0, 100);
}

/**
 * Applies end-of-season aging to ALL players in a single pass, covering both
 * slot players (star1, star2, corePiece) and any additional players in
 * fr.players[]. Deduplicates by player id so no player is processed twice.
 *
 * Handles: age increment, contract year decrement, predictDev math (inlined),
 * morale shifts, retirement flagging, local legend marking, contract expiry,
 * age-out retirement, and slot field sync.
 *
 * NOTE: The development calculation here uses the same formula as predictDev()
 * in simulation.js (PEAK_AGES, trait bonuses, ceiling penalty, random variance).
 * It is intentionally inlined to avoid a circular import between roster.js and
 * simulation.js (simulation.js already imports from roster.js).
 *
 * @param {Object} franchise - Franchise state
 * @param {number} winPct - Season win percentage (0–1)
 * @returns {Object} Updated franchise state
 */
export function endOfSeasonAging(franchise, winPct) {
  let fr = { ...franchise };
  const lg = fr.league;
  const devStaff = fr.developmentStaff || 1;

  // ── Step 1: Collect all unique players from slots AND fr.players[] ──────
  const seen = new Set();
  const allPlayers = [];
  for (const key of ['star1', 'star2', 'corePiece']) {
    const p = fr[key];
    if (p && !seen.has(p.id)) { seen.add(p.id); allPlayers.push(p); }
  }
  for (const p of (fr.players || [])) {
    if (p && !seen.has(p.id)) { seen.add(p.id); allPlayers.push(p); }
  }

  // ── Step 2: Age each unique player ─────────────────────────────────────
  const [ps, pe] = PEAK_AGES[lg] || [26, 30];
  const localLegendsToAdd = [];

  const agedPlayers = allPlayers.map(p => {
    const aged = { ...p };
    aged.age = p.age + 1;
    aged.yearsLeft = Math.max(0, p.yearsLeft - 1);
    aged.seasonsPlayed = (p.seasonsPlayed || 0) + 1;
    aged.seasonsWithTeam = (p.seasonsWithTeam || 0) + 1;

    // Development rating change + morale shift
    processPlayerAging(aged, devStaff, winPct, ps, pe);

    // Retirement flag
    if (aged.age >= 35 && Math.random() < 0.3) {
      aged.retired = true;
      if (aged.seasonsWithTeam >= 5 && aged.rating >= 70) {
        localLegendsToAdd.push({
          name: aged.name,
          rating: aged.careerStats?.bestRating || aged.rating,
          seasons: aged.seasonsWithTeam,
        });
      }
    }

    // Local legend
    if (aged.seasonsWithTeam >= 5 && aged.rating >= 70) aged.isLocalLegend = true;

    return aged;
  });

  // Apply local legends and fan rating bumps to franchise
  if (localLegendsToAdd.length > 0) {
    fr = {
      ...fr,
      localLegends: [...(fr.localLegends || []), ...localLegendsToAdd],
      fanRating: clamp((fr.fanRating || 50) + localLegendsToAdd.length * 3, 0, 100),
    };
  }

  // Build id → aged player lookup
  const agedMap = new Map(agedPlayers.map(p => [p.id, p]));

  // ── Step 3: Contract expiry & age-out for slot fields ─────────────────
  let star1 = fr.star1 ? (agedMap.get(fr.star1.id) ?? fr.star1) : null;
  let star2 = fr.star2 ? (agedMap.get(fr.star2.id) ?? fr.star2) : null;
  let corePiece = fr.corePiece ? (agedMap.get(fr.corePiece.id) ?? fr.corePiece) : null;

  // Retired players leave
  if (star1?.retired) star1 = null;
  if (star2?.retired) star2 = null;
  if (corePiece?.retired) corePiece = null;

  // Contract expiry: yearsLeft <= 0 → 65% chance leave
  if (star1 && star1.yearsLeft <= 0 && Math.random() < 0.65) star1 = null;
  if (star2 && star2.yearsLeft <= 0 && Math.random() < 0.65) star2 = null;
  if (corePiece && corePiece.yearsLeft <= 0 && Math.random() < 0.65) corePiece = null;

  // Age-out: star1/star2 age >= 36 → 40%; corePiece age >= 37 → 50%
  if (star1 && star1.age >= 36 && Math.random() < 0.4) star1 = null;
  if (star2 && star2.age >= 36 && Math.random() < 0.4) star2 = null;
  if (corePiece && corePiece.age >= 37 && Math.random() < 0.5) corePiece = null;

  // ── Step 4: Sync slot fields and rebuild players[] ────────────────────
  fr = { ...fr, star1, star2, corePiece };
  fr.players = [fr.star1, fr.star2, fr.corePiece].filter(Boolean);

  // ── Step 5: Taxi squad aging + auto-release at 2 seasons ────────────
  const taxiSquad = (fr.taxiSquad || []).map(p => {
    if (!p) return null;
    const aged = { ...p };
    aged.age = (p.age || 22) + 1;
    aged.seasonsOnTaxi = (p.seasonsOnTaxi || 0) + 1;
    aged.seasonsPlayed = (p.seasonsPlayed || 0) + 1;

    // Development + morale shift
    processPlayerAging(aged, devStaff, winPct, ps, pe);

    return aged;
  }).filter(Boolean);

  // Auto-release taxi squad players at 2+ seasons
  const taxiNotifications = [];
  const keptTaxi = [];
  for (const p of taxiSquad) {
    if ((p.seasonsOnTaxi || 0) >= 2) {
      taxiNotifications.push({
        id: 'taxi_release_' + p.id,
        severity: 'info',
        message: `${p.name} has been auto-released from the taxi squad after 2 seasons.`,
        type: 'player',
      });
    } else {
      keptTaxi.push(p);
    }
  }

  fr = { ...fr, taxiSquad: keptTaxi };
  if (taxiNotifications.length > 0) {
    fr.taxiNotifications = taxiNotifications;
  }

  // ── Step 6: Rookie slots aging ───────────────────────────────────────
  const rookieSlots = (fr.rookieSlots || []).map(p => {
    if (!p) return null;
    const aged = { ...p };
    aged.age = (p.age || 22) + 1;
    aged.yearsLeft = Math.max(0, (p.yearsLeft || 1) - 1);
    aged.seasonsPlayed = (p.seasonsPlayed || 0) + 1;
    aged.seasonsWithTeam = (p.seasonsWithTeam || 0) + 1;

    // Development + morale shift
    processPlayerAging(aged, devStaff, winPct, ps, pe);

    return aged;
  }).filter(Boolean);

  fr = { ...fr, rookieSlots };

  return fr;
}

/**
 * Applies a contract extension to a franchise slot player.
 * @param {Object} f - Franchise state
 * @param {string} slotKey - 'star1' | 'star2' | 'corePiece'
 * @param {number} extSalary - New salary
 * @param {number} extYears - Years added
 * @returns {Object} Updated franchise state
 */
export function applyExtension(f, slotKey, extSalary, extYears) {
  const p = f[slotKey];
  if (!p) return f;
  const updated = {
    ...f,
    [slotKey]: { ...p, salary: extSalary, yearsLeft: extYears },
    lockerRoomChemistry: clamp((f.lockerRoomChemistry || 65) + 5, 0, 100),
  };
  updated.players = [updated.star1, updated.star2, updated.corePiece].filter(Boolean);
  updated.totalSalary = r1(updated.players.reduce((s, p) => s + p.salary, 0));
  return updated;
}
