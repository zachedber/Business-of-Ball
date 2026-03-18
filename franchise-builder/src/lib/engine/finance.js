import {
  NGL_SALARY_CAP, ABL_SALARY_CAP, CAP_INFLATION_RATE, CITY_ECONOMY,
  MARKET_TIERS, getMarketTier, TICKET_BASE_PRICE, TICKET_ELASTICITY,
  REVENUE_SHARE_PCT, MAX_DEBT_RATIO, DEBT_INTEREST,
} from '@/data/leagues';
import { rand, randFloat, pick, clamp, r1, generateId } from './roster';

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
  const cap = f.league === 'ngl' ? NGL_SALARY_CAP : ABL_SALARY_CAP;
  const inf = Math.pow(1 + CAP_INFLATION_RATE, f.season || 0);
  const adj = r1(cap * inf);
  const ts = f.players.reduce((s, p) => s + p.salary, 0);
  const dm = f.capDeadMoney || 0;
  return { cap: adj, used: r1(ts + dm), space: r1(adj - ts - dm), deadMoney: dm };
}

/**
 * Calculate the adjusted salary cap for a given season, including
 * base inflation and event-driven modifiers.
 * @param {Object} f - Franchise state
 * @param {number} [capModifier=0] - One-time modifier from events
 * @returns {number} Adjusted cap
 */
export function calculateAdjustedCap(f, capModifier = 0) {
  const baseCap = f.league === 'ngl' ? NGL_SALARY_CAP : ABL_SALARY_CAP;
  const inf = Math.pow(1 + CAP_INFLATION_RATE, f.season || 0);
  return r1(baseCap * inf + (capModifier || 0));
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
