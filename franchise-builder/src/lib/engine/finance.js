import {
  NGL_SALARY_CAP, ABL_SALARY_CAP, CAP_INFLATION_RATE, CITY_ECONOMY,
  MARKET_TIERS, getMarketTier, TICKET_BASE_PRICE, TICKET_ELASTICITY,
  REVENUE_SHARE_PCT, MAX_DEBT_RATIO, DEBT_INTEREST,
  STADIUM_TIERS, STAFF_SALARIES,
} from '@/data/leagues';
import { rand, randFloat, pick, clamp, r1, generateId } from './roster';

/**
 * Calculates a dynamic interest rate from GM reputation and current cash risk.
 * Formula:
 * baseRate = 0.08
 * repModifier = (50 - gmRep) * 0.001
 * riskModifier = cash < (principal * 0.2) ? 0.03 : 0
 * finalRate = clamp(baseRate + repModifier + riskModifier, 0.04, 0.15)
 * @param {number} gmRep
 * @param {number} cash
 * @param {number} principal
 * @returns {number}
 */
export function calculateDynamicInterestRate(gmRep, cash, principal) {
  const baseRate = 0.08;
  const repModifier = (50 - (Number(gmRep) || 0)) * 0.001;
  const normalizedPrincipal = Math.max(0, Number(principal) || 0);
  const riskModifier = (Number(cash) || 0) < normalizedPrincipal * 0.2 ? 0.03 : 0;
  return clamp(baseRate + repModifier + riskModifier, 0.04, 0.15);
}

/**
 * Calculates seasonal debt payment using an amortizing loan formula.
 * seasonalPayment = (Principal * InterestRate) / (1 - Math.pow(1 + InterestRate, -TermSeasons))
 * @param {Object} debtObject
 * @returns {number}
 */
export function calculateDebtPayment(debtObject) {
  const principal = Math.max(0, Number(debtObject?.principal) || 0);
  const interestRate = Math.max(0, Number(debtObject?.interestRate) || 0);
  const termSeasons = Math.max(1, Number(debtObject?.termSeasons) || 1);
  if (interestRate === 0) return r1(principal / termSeasons);
  return r1((principal * interestRate) / (1 - Math.pow(1 + interestRate, -termSeasons)));
}

/**
 * Applies missed-payment debt penalty logic.
 * If cash is less than seasonal payment:
 * - deduct all available cash
 * - add unpaid remainder to principal
 * - set interestRate to dynamicRate + 0.05 penalty
 * - increment consecutiveMissedPayments
 * @param {Object} debtObject
 * @param {number} cash
 * @returns {{ debt: Object, cash: number, paymentMade: number, unpaidRemainder: number }}
 */


export function buildMandatoryDebt(askingPrice, market) {
  const tier = getMarketTier(Number(market) || 0);
  const baseCapital = 30;
  const isBottomTier = tier >= 5;
  const principal = isBottomTier ? Math.max(0, askingPrice - baseCapital) : Math.max(1, askingPrice - baseCapital);
  const debtObject = principal > 0 ? {
    principal,
    interestRate: DEBT_INTEREST,
    termSeasons: 10,
    seasonsRemaining: 10,
    seasonalPayment: 0,
    consecutiveMissedPayments: 0,
  } : null;

  return {
    debt: principal,
    debtObject,
    cash: Math.max(0, baseCapital - askingPrice),
  };
}
/**
 * Returns a debt pressure level for a franchise, used to surface
 * warnings in the UI and gate the board pressure check.
 *
 * Levels:
 *   'none'     — debt/valuation ratio <= 0.20
 *   'watch'    — ratio 0.21–0.30
 *   'warning'  — ratio 0.31–0.38
 *   'critical' — ratio > 0.38 (approaching MAX_DEBT_RATIO of 0.40)
 *
 * @param {Object} f - Franchise state with debt and history/valuation fields
 * @returns {'none' | 'watch' | 'warning' | 'critical'}
 */
export function getDebtPressureLevel(f) {
  if (!f.debt || f.debt <= 0) return 'none';
  const val = calculateValuation(f);
  if (val <= 0) return 'critical';
  const ratio = f.debt / val;
  if (ratio <= 0.20) return 'none';
  if (ratio <= 0.30) return 'watch';
  if (ratio <= 0.38) return 'warning';
  return 'critical';
}

export function applyDebtPenalty(debtObject, cash) {
  const debt = { ...(debtObject || {}) };
  const availableCash = Math.max(0, Number(cash) || 0);
  const seasonalPayment = Math.max(0, Number(debt.seasonalPayment) || 0);

  if (availableCash >= seasonalPayment) {
    return {
      debt,
      cash: r1(availableCash - seasonalPayment),
      paymentMade: seasonalPayment,
      unpaidRemainder: 0,
    };
  }

  const unpaidRemainder = r1(seasonalPayment - availableCash);
  const newPrincipal = r1(Math.max(0, Number(debt.principal) || 0) + unpaidRemainder);
  const dynamicRate = calculateDynamicInterestRate(
    Number(debt.gmRep) || 50,
    0,
    newPrincipal
  );

  const updatedDebt = {
    ...debt,
    principal: newPrincipal,
    interestRate: r1(dynamicRate + 0.05),
    consecutiveMissedPayments: (Number(debt.consecutiveMissedPayments) || 0) + 1,
  };

  return {
    debt: updatedDebt,
    cash: 0,
    paymentMade: r1(availableCash),
    unpaidRemainder,
  };
}

/**
 * Calculates matchday revenue from non-ticket pricing plus fan-rating penalty.
 * Base revenue = attendance * (concessions + merch + parking)
 * Sweet spots: concessions 15, merch 40, parking 25
 * For any price above sweet spot, fan penalty += (difference * 0.5)
 * @param {Object} franchise
 * @param {number} fanRating
 * @param {number} attendance
 * @returns {{ revenue: number, fanRatingPenalty: number, adjustedFanRating: number }}
 */
export function calculateMatchdayRevenue(franchise, fanRating, attendance) {
  const pricing = franchise?.pricing || {};
  const concessionsPrice = Number(pricing.concessionsPrice) || 0;
  const merchPrice = Number(pricing.merchPrice) || 0;
  const parkingPrice = Number(pricing.parkingPrice) || 0;

  const revenue = r1((Number(attendance) || 0) * (concessionsPrice + merchPrice + parkingPrice));

  const concessionsPenalty = concessionsPrice > 15 ? (concessionsPrice - 15) * 0.5 : 0;
  const merchPenalty = merchPrice > 40 ? (merchPrice - 40) * 0.5 : 0;
  const parkingPenalty = parkingPrice > 25 ? (parkingPrice - 25) * 0.5 : 0;
  const fanRatingPenalty = r1(concessionsPenalty + merchPenalty + parkingPenalty);

  return {
    revenue,
    fanRatingPenalty,
    adjustedFanRating: r1(clamp((Number(fanRating) || 0) - fanRatingPenalty, 0, 100)),
  };
}

/**
 * Deducts seasonal practice facility maintenance.
 * Cost = stadiumTier * 2,000,000
 * @param {Object} franchise
 * @returns {{ maintenanceCost: number, updatedCash: number }}
 */
export function calculateFacilityUpkeep(franchise) {
  const rawTier = franchise?.stadiumTier;
  const numericTier = typeof rawTier === 'number'
    ? rawTier
    : Number(String(rawTier || '').replace(/[^\d.]/g, '')) || 0;
  const maintenanceCost = numericTier * 2000000;
  const currentCash = Number(franchise?.cash) || 0;
  return {
    maintenanceCost: r1(maintenanceCost),
    updatedCash: r1(currentCash - maintenanceCost),
  };
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
  // Gate: boosted base (1.6x multiplier for NGL to hit $40-60M mid-market; 1.1x ABL for $55-80M)
  const gateMultiplier = f.league === 'ngl' ? 1.6 : 1.1;
  const gate = att * f.stadiumCapacity * f.ticketPrice * games / 1e6 * gateMultiplier;
  // TV: base $15M floor + market scaling to hit $30-50M mid-market
  const tv = 15 + f.market * (0.25 + (f.tvTier || 1) * 0.18);
  // Merch: raised floor and multiplier to hit $15-25M mid-market
  const merch = f.market * (f.merchMultiplier || 1) * (0.15 + Math.max(0.3, wp) * 0.25);
  // Sponsorship: increased to be proportional
  const spon = (f.sponsorLevel || 1) * f.market * 0.14;
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
    sponsorRevenue: r1(spon),
    namingRevenue: r1(naming),
    totalRevenue: r1(rev),
    totalExpenses: r1(exp),
    projectedProfit: r1(rev - exp),
  };
}

/**
 * Calculates the approximate franchise valuation based on market, performance, and assets.
 * @param {Object} f - Franchise or team state
 * @returns {number} Valuation in millions
 */
export function calculateValuation(f) {
  const wins = Number(f?.wins) || 0;
  const losses = Number(f?.losses) || 0;
  const totalGames = Math.max(1, wins + losses);
  // Clamp undefined inputs to safe numeric defaults so valuation math cannot emit NaN or divide by zero.
  return Math.round(
    (Number(f?.market) || 0) * 3 +
    (wins / totalGames) * 50 +
    (Number(f?.fanRating) || 0) * 0.5 +
    (Number(f?.stadiumCondition) || 70) * 0.2 +
    (Number(f?.championships) || 0) * 15 +
    (CITY_ECONOMY[f?.city] || 65) * 0.3
  );
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

/**
 * Calculates current cap space and dead money breakdown for a franchise.
 * @param {Object} f - Franchise state
 * @returns {{ cap: number, used: number, space: number, deadMoney: number }}
 */
export function calculateCapSpace(f) {
  const cap = f?.league === 'ngl' ? NGL_SALARY_CAP : ABL_SALARY_CAP;
  const season = Math.max(0, Number(f?.season) || 0);
  const inf = Math.pow(1 + CAP_INFLATION_RATE, season);
  const adj = r1(cap * inf);
  const ts = r1((f?.players || []).reduce((s, p) => s + (Number(p?.salary) || 0), 0));
  // Include both current and deferred dead money with clamps so cap space cannot drift negative from bad state.
  const dm = r1(Math.max(0, Number(f?.capDeadMoney) || 0) + Math.max(0, Number(f?.deferredDeadCap) || 0));
  return { cap: adj, used: r1(ts + dm), space: r1(adj - (ts + dm)), deadMoney: dm };
}

/**
 * Calculate the adjusted salary cap for a given season, including
 * base inflation and event-driven modifiers.
 * @param {Object} f - Franchise state
 * @param {number} [capModifier=0] - One-time modifier from events
 * @returns {number} Adjusted cap
 */
export function calculateAdjustedCap(f, capModifier = 0) {
  const baseCap = f?.league === 'ngl' ? NGL_SALARY_CAP : ABL_SALARY_CAP;
  const season = Math.max(0, Number(f?.season) || 0);
  const inf = Math.pow(1 + CAP_INFLATION_RATE, season);
  // Normalize cap modifiers to numbers so undefined event payloads cannot poison cap calculations.
  return r1(baseCap * inf + (Number(capModifier) || 0));
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
  const mx = Math.max(0, maxLoan(f) - (Number(f?.debt) || 0));
  const a = Math.max(0, Math.min(Number(amt) || 0, mx));
  return { ...f, cash: r1((Number(f?.cash) || 0) + a), debt: r1((Number(f?.debt) || 0) + a) };
}

/**
 * Repays as much debt as possible given the available cash.
 * @param {Object} f - Franchise state
 * @param {number} amt - Amount to repay
 * @returns {Object} Updated franchise state
 */
export function repayDebt(f, amt) {
  const cashOnHand = Math.max(0, Number(f?.cash) || 0);
  const outstandingDebt = Math.max(0, Number(f?.debt) || 0);
  // Clamp the repayment to positive available cash and debt so one click cannot overdraw cash or overpay debt.
  const a = Math.max(0, Math.min(Number(amt) || 0, outstandingDebt, cashOnHand));
  return { ...f, cash: r1(Math.max(0, cashOnHand - a)), debt: r1(Math.max(0, outstandingDebt - a)) };
}

/**
 * Generates available minority stake purchase offers in AI-controlled teams.
 * @param {Object} lt - League teams state
 * @param {number} cash - Player's available cash
 * @param {number} season - Current season number
 * @returns {Object[]} Array of stake offer objects
 */
export function generateStakeOffers(lt, cash, season, playerLeague, existingStakes) {
  if (cash < 15 || season < 3) return [];
  const stakes = existingStakes || [];
  const all = [...lt.ngl, ...lt.abl]
    .filter(t => !t.isPlayerOwned && t.league !== playerLeague)
    .sort(() => Math.random() - 0.5)
    .slice(0, rand(1, 3));
  const offers = all.map(t => {
    const v = calculateValuation(t);
    const existingPct = stakes.filter(s => s.teamId === t.id).reduce((sum, s) => sum + s.stakePct, 0);
    // If already at 49%, skip this team for new offers
    if (existingPct >= 49) return null;
    // If player already has a stake in this team, offer a smaller increase
    const pct = existingPct > 0 ? pick([5, 10]) : pick([10, 15, 20, 25]);
    const cappedPct = Math.min(pct, 49 - existingPct);
    if (cappedPct <= 0) return null;
    return {
      id: generateId(),
      teamId: t.id,
      teamName: `${t.city} ${t.name}`,
      league: t.league,
      stakePct: cappedPct,
      price: Math.round(v * (cappedPct / 100) * randFloat(0.85, 1.15)),
      valuation: v,
      record: `${t.wins}-${t.losses}`,
      market: t.market,
      isIncrease: existingPct > 0,
    };
  }).filter(Boolean);
  return offers;
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
    // Phase 3: volatile dividends — ±20% random variance
    const base = (t.finances.profit || 0) * (s.stakePct / 100);
    const volatility = base * randFloat(-0.20, 0.20);
    return tot + r1(base + volatility);
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

/**
 * Generate a TV deal event every 8 seasons.
 * @param {number} season - Current season
 * @returns {Object|null} TV deal event or null
 */
export function generateTVDealEvent(season) {
  if (season < 8 || season % 8 !== 0) return null;
  return {
    id: 'tv_deal_' + season,
    title: 'New TV Deal',
    description: 'The NGL signs a landmark new television deal. The salary cap will spike next season as revenue sharing increases.',
    capModifier: 8,
    type: 'tv_deal',
  };
}

/**
 * Returns true if liquid cash is sufficient to cover cost.
 * @param {number} cash - Current liquid cash
 * @param {number} cost - Cost to check
 * @returns {boolean}
 */
export function canAfford(cash, cost) {
  return (cash ?? 0) >= cost;
}

/**
 * Format millions as abbreviated: $42.5M
 * @param {number} millions - Amount in millions
 * @returns {string}
 */
export function formatMoney(millions) {
  if (millions == null || isNaN(millions)) return '$0M';
  return `$${Math.round(millions * 10) / 10}M`;
}

/**
 * Format millions as full dollar string: $42,500,000
 * @param {number} millions - Amount in millions
 * @returns {string}
 */
export function formatFullDollars(millions) {
  if (millions == null || isNaN(millions)) return '$0';
  const full = Math.round(millions * 1_000_000);
  return '$' + full.toLocaleString('en-US');
}

/**
 * Calculates end-of-season financial results for a player franchise.
 * Computes revenue (gate, TV, merch, sponsorship, naming, premium seating),
 * expenses (salary, staff, facilities, maintenance, interest, dead cap, coordinators),
 * and updates franchise finances and cash.
 * @param {Object} f - Franchise state
 * @param {number} winPct - Season win percentage (0–1)
 * @param {number} totalGames - Total games in the season
 * @param {number} [econMod=1.0] - Economy cycle modifier
 * @returns {Object} Updated franchise with finances and cash recalculated
 */
export function calculateEndSeasonFinances(f, winPct, totalGames, econMod = 1.0) {
  const lg = f.league;
  const attRaw = calcAttendance(f.ticketPrice, f.fanRating, winPct, f.market, f.stadiumCondition, f.rosterQuality || 70);
  const att = f.namingRightsActive ? Math.max(0.25, attRaw - 0.03) : attRaw;
  const _stadTier = STADIUM_TIERS[f.stadiumTier || 'small'];
  const tierGateMult = _stadTier ? _stadTier.gateMultiplier : 1.0;
  const constructionPenalty = f.stadiumUnderConstruction ? 0.80 : 1.0;
  const honeymoonBonus = (f.newStadiumHoneymoon || 0) > 0 ? 1.25 : 1.0;
  const leagueGateMult = lg === 'ngl' ? 1.6 : 1.1;
  const gate = att * f.stadiumCapacity * f.ticketPrice * totalGames / 1e6 * econMod * tierGateMult * constructionPenalty * honeymoonBonus * leagueGateMult;
  const tv = (15 + f.market * (0.25 + (f.tvTier || 1) * 0.18)) * randFloat(0.9, 1.1);
  const merch = f.market * (f.merchMultiplier || 1) * (0.15 + winPct * 0.25) * econMod * randFloat(0.9, 1.1);
  const spon = (f.sponsorLevel || 1) * f.market * 0.14 * randFloat(0.9, 1.1);
  const naming = f.namingRightsActive ? (f.namingRightsDeal || 3) : 0;
  const luxuryBoxRev = (f.luxuryBoxes || 0) * 0.8;
  const clubSeatRev = (f.clubSeatSections || 0) * 0.15 * clamp(0.8 + winPct * 0.4, 0.8, 1.2);
  const totalRev = gate + tv + merch + spon + naming + luxuryBoxRev + clubSeatRev;
  const staff = (f.scoutingStaff + f.developmentStaff + f.medicalStaff + f.marketingStaff) * 2;
  const fac = (f.trainingFacility + f.weightRoom + f.filmRoom) * 1.5;
  const maintBase = f.stadiumAge > 15 ? f.stadiumAge * 0.3 : 1;
  const maintMult = _stadTier ? _stadTier.maintMultiplier : 1.0;
  const maint = maintBase * maintMult;
  let interest = (f.debt || 0) * DEBT_INTEREST;

  // Phase 4: Debt recovery escape hatch — if franchise is in critical debt,
  // cap annual interest accrual at 5% of current valuation to prevent
  // irrecoverable spirals. This is a soft safety net, not forgiveness.
  const debtPressure = getDebtPressureLevel(f);
  if (debtPressure === 'critical') {
    const maxInterestThisSeason = r1(calculateValuation(f) * 0.05);
    if (interest > maxInterestThisSeason) {
      const saved = r1(interest - maxInterestThisSeason);
      f = { ...f, debt: Math.max(0, r1((f.debt || 0) - saved)) };
      interest = maxInterestThisSeason;
    }
  }

  // Coordinator salaries
  let coordSalaries = 0;
  if (f.offensiveCoordinator) coordSalaries += STAFF_SALARIES.oc[f.offensiveCoordinator.level] || 1;
  if (f.defensiveCoordinator) coordSalaries += STAFF_SALARIES.dc[f.defensiveCoordinator.level] || 1;
  if (f.playerDevCoach) coordSalaries += STAFF_SALARIES.pdc[f.playerDevCoach.level] || 0.8;
  const totalExp = f.totalSalary + staff + fac + maint + interest + (f.capDeadMoney || 0) + coordSalaries;
  const profit = totalRev - totalExp;
  return {
    ...f,
    finances: { revenue: r1(totalRev), expenses: r1(totalExp), profit: r1(profit) },
    cash: r1((f.cash || 0) + profit),
  };
}
