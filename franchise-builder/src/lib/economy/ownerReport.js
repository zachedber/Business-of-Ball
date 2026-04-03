// src/lib/economy/ownerReport.js — Pure function that builds the post-season Owner Report
//
// Derives five analysis sections from franchise state and previous season history.
// No new simulation data needed — all inputs come from existing franchise fields.

import { calculateValuation } from '@/lib/engine/finance';

/**
 * Builds a structured Owner Report from the current franchise state
 * and the previous season's history entry.
 *
 * @param {Object} franchise - Current franchise state (after season sim)
 * @param {Object|null} prevSeasonHistory - The history entry from the prior season (or null if season 1)
 * @returns {Object} Report object with five sections
 */
export function buildOwnerReport(franchise, prevSeasonHistory) {
  const f = franchise;
  const prev = prevSeasonHistory;
  const currentHistory = f.history?.[f.history.length - 1];

  const onField = buildOnFieldResults(f, currentHistory, prev);
  const fanSentiment = buildFanSentiment(f, currentHistory, prev);
  const finances = buildFinancialPerformance(f, currentHistory, prev);
  const valuation = buildValuation(f, prev);
  const verdict = buildVerdict(f, currentHistory, prev, onField, fanSentiment, finances, valuation);
  const pendingConsequences = buildPendingConsequences(f);

  const boardMeeting = franchise.lastBoardMeeting
    ? { ...franchise.lastBoardMeeting, boardTrust: franchise.boardTrust ?? null }
    : null;

  return { onField, fanSentiment, finances, valuation, verdict, pendingConsequences, boardMeeting };
}

// ── Section 1: On-Field Results ──────────────────────────────────────

function buildOnFieldResults(f, current, prev) {
  const wins = f.wins ?? current?.wins ?? 0;
  const losses = f.losses ?? current?.losses ?? 0;
  const record = `${wins}-${losses}`;
  const winPct = (wins + losses) > 0 ? wins / (wins + losses) : 0;
  const rosterQuality = f.rosterQuality ?? current?.rosterQuality ?? 70;

  // Expected win % based on roster quality (scaled 0-100 → 0.25-0.75)
  const expectedWinPct = 0.25 + (rosterQuality / 100) * 0.5;
  const diff = winPct - expectedWinPct;
  let expectation;
  if (diff > 0.08) expectation = 'above';
  else if (diff < -0.08) expectation = 'below';
  else expectation = 'met';

  // Determine primary driver
  const coachLevel = f.coach?.level ?? 1;
  const chemistry = f.lockerRoomChemistry ?? 50;
  const schemeFit = f.schemeFit ?? 50;

  const drivers = [
    { name: 'roster quality', weight: rosterQuality },
    { name: 'coaching', weight: coachLevel * 25 },
    { name: 'chemistry', weight: chemistry },
    { name: 'scheme fit', weight: schemeFit },
  ];
  drivers.sort((a, b) => b.weight - a.weight);
  const primaryDriver = drivers[0].name;

  // Injury impact
  const injuredPlayers = current?.injuries ?? f.players?.filter(p => p.injured) ?? [];
  const severeInjuries = injuredPlayers.filter(i =>
    (i.severity === 'major' || i.severity === 'season-ending' || (typeof i.severity === 'number' && i.severity >= 3))
  );
  let injuryNote;
  if (severeInjuries.length >= 3) {
    injuryNote = `Severe injury crisis — ${severeInjuries.length} major injuries significantly impacted the season.`;
  } else if (injuredPlayers.length >= 4) {
    injuryNote = `Injuries were a factor with ${injuredPlayers.length} players affected.`;
  } else if (injuredPlayers.length > 0) {
    injuryNote = `Minor injury impact — ${injuredPlayers.length} player(s) missed time.`;
  } else {
    injuryNote = 'The team stayed mostly healthy.';
  }

  return { record, expectation, primaryDriver, injuryNote };
}

// ── Section 2: Fan Sentiment ─────────────────────────────────────────

function buildFanSentiment(f, current, prev) {
  const currentFan = f.fanRating ?? current?.fanRating ?? 50;
  const prevFan = prev?.fanRating ?? currentFan;
  const delta = Math.round((currentFan - prevFan) * 10) / 10;

  const winPct = (f.wins + f.losses) > 0 ? f.wins / (f.wins + f.losses) : 0;
  const ticketPrice = f.ticketPrice ?? f.pricing?.ticketPrice ?? 80;
  const stadiumCond = f.stadiumCondition ?? 70;
  const mediaRep = f.mediaRep ?? 50;

  // Estimate which factor had the strongest pull on fan sentiment
  const factors = [
    { name: 'winning', impact: Math.abs((winPct - 0.5) * 40) },
    { name: 'ticket pricing', impact: ticketPrice > 120 ? (ticketPrice - 120) * 0.3 : ticketPrice < 50 ? (50 - ticketPrice) * 0.2 : 0 },
    { name: 'stadium condition', impact: stadiumCond < 50 ? (50 - stadiumCond) * 0.4 : 0 },
    { name: 'media reputation', impact: Math.abs(mediaRep - 50) * 0.3 },
  ];
  factors.sort((a, b) => b.impact - a.impact);

  return {
    current: Math.round(currentFan),
    delta,
    primaryDriver: factors[0].name,
  };
}

// ── Section 3: Financial Performance ─────────────────────────────────

function buildFinancialPerformance(f, current, prev) {
  const revenue = current?.revenue ?? f.finances?.revenue ?? 0;
  const expenses = current?.expenses ?? f.finances?.expenses ?? 0;
  const profit = current?.profit ?? f.finances?.profit ?? 0;

  const prevRevenue = prev?.revenue ?? revenue;
  const prevExpenses = prev?.expenses ?? expenses;
  const prevProfit = prev?.profit ?? profit;
  const delta = {
    revenue: round1(revenue - prevRevenue),
    expenses: round1(expenses - prevExpenses),
    profit: round1(profit - prevProfit),
  };

  // Determine primary financial driver
  const fanRating = f.fanRating ?? 50;
  const totalSalary = f.totalSalary ?? 0;
  const sponsorLevel = f.sponsorLevel ?? 1;

  const drivers = [
    { name: 'attendance', impact: Math.abs(fanRating - 50) + Math.abs((f.stadiumCondition ?? 70) - 70) },
    { name: 'sponsorships', impact: sponsorLevel * 10 },
    { name: 'salary burden', impact: totalSalary > 0 ? totalSalary / 5 : 0 },
  ];
  drivers.sort((a, b) => b.impact - a.impact);

  const cash = f.cash ?? current?.cash ?? 0;
  const cashWarning = cash < 20;

  return {
    revenue: round1(revenue),
    expenses: round1(expenses),
    profit: round1(profit),
    delta,
    primaryDriver: drivers[0].name,
    cashWarning,
  };
}

// ── Section 4: Valuation Movement ────────────────────────────────────

function buildValuation(f, prev) {
  const currentVal = calculateValuation(f);

  // Estimate previous valuation using prev season data if available
  let prevVal = currentVal;
  if (prev) {
    // Build a lightweight object with prev-season fields for valuation calc
    const prevProxy = {
      market: f.market,
      wins: prev.wins ?? f.wins,
      losses: prev.losses ?? f.losses,
      fanRating: prev.fanRating ?? f.fanRating,
      stadiumCondition: f.stadiumCondition,
      championships: Math.max(0, (f.championships ?? 0) - ((f.wins / Math.max(1, f.wins + f.losses)) > 0.85 ? 1 : 0)),
      city: f.city,
    };
    prevVal = calculateValuation(prevProxy);
  }

  const delta = currentVal - prevVal;

  // Determine primary factor
  const winPct = (f.wins + f.losses) > 0 ? f.wins / (f.wins + f.losses) : 0;
  const factors = [
    { name: 'market size', impact: (f.market ?? 70) * 0.3 },
    { name: 'on-field success', impact: winPct * 50 },
    { name: 'financial health', impact: (f.finances?.profit ?? 0) > 0 ? 15 : -10 },
    { name: 'fan support', impact: (f.fanRating ?? 50) * 0.3 },
  ];
  factors.sort((a, b) => b.impact - a.impact);

  return {
    current: currentVal,
    delta: Math.round(delta),
    primaryDriver: factors[0].name,
  };
}

// ── Section 5: Front Office Verdict ──────────────────────────────────

function buildVerdict(f, current, prev, onField, fanSentiment, finances, valuation) {
  const winPct = (f.wins + f.losses) > 0 ? f.wins / (f.wins + f.losses) : 0;
  const profit = finances.profit;

  // Determine biggest success
  let success;
  if (winPct > 0.65 && profit > 0) {
    success = 'Delivered a winning season while staying profitable — the gold standard of franchise management.';
  } else if (winPct > 0.6) {
    success = 'Built a genuinely competitive roster that exceeded expectations on the field.';
  } else if (profit > 15) {
    success = 'Generated strong financial returns, building a war chest for future moves.';
  } else if (fanSentiment.delta > 5) {
    success = 'Significantly improved fan sentiment, strengthening the franchise\'s long-term foundation.';
  } else if (valuation.delta > 5) {
    success = 'Franchise valuation climbed meaningfully, rewarding ownership patience.';
  } else {
    success = 'Kept the franchise stable through a transitional season.';
  }

  // Determine biggest failure/missed opportunity
  let failure;
  if (winPct < 0.3 && finances.profit < 0) {
    failure = 'Lost on the field and the balance sheet — a season to forget across the board.';
  } else if (winPct < 0.35) {
    failure = 'The on-field product was not competitive. Fans and sponsors noticed.';
  } else if (finances.profit < -10) {
    failure = 'Financial losses mounted. The current spending trajectory is unsustainable.';
  } else if (fanSentiment.delta < -5) {
    failure = 'Fan sentiment dropped significantly — pricing, performance, or facilities need attention.';
  } else if (finances.cashWarning) {
    failure = 'Cash reserves fell dangerously low. One bad break could force desperate moves.';
  } else {
    failure = 'No catastrophic failures, but the franchise didn\'t take a meaningful step forward.';
  }

  // GM Grade with reasoning
  let grade, gradeReason;
  if (winPct > 0.65 && profit > 0 && fanSentiment.delta >= 0) {
    grade = 'A';
    gradeReason = 'Elite season — winning, profitable, and fans are engaged. This is what ownership demands.';
  } else if (winPct > 0.65 && profit > 0) {
    grade = 'A-';
    gradeReason = 'Winning and profitable, though fan engagement could be stronger.';
  } else if (winPct > 0.55 && profit >= 0) {
    grade = 'B+';
    gradeReason = 'Competitive and financially responsible. A solid foundation to build on.';
  } else if (winPct > 0.55) {
    grade = 'B';
    gradeReason = 'Competitive roster, but finances need tighter management.';
  } else if (winPct > 0.45 && profit >= 0) {
    grade = 'B-';
    gradeReason = 'Middling results on the field but kept the books balanced.';
  } else if (winPct > 0.4) {
    grade = 'C+';
    gradeReason = 'Below average wins. Need clearer direction for the roster.';
  } else if (winPct > 0.3) {
    grade = 'C';
    gradeReason = 'Disappointing season. The front office needs to pick a lane — compete or rebuild.';
  } else if (profit >= 0) {
    grade = 'C-';
    gradeReason = 'Poor record, but at least the finances aren\'t bleeding. Cold comfort.';
  } else {
    grade = 'D';
    gradeReason = 'Losing games and losing money. Ownership is running out of patience.';
  }

  return { success, failure, grade, gradeReason };
}

// ── Section 6: Pending Consequences ──────────────────────────────────

/**
 * Summarizes pending effects that will fire in the next 1–2 seasons.
 * Returns an array of consequence descriptors for the Owner Report.
 */
function buildPendingConsequences(f) {
  const pending = (f.pendingEffects || []).filter(e => !e.resolved);
  if (pending.length === 0) return { items: [], boardTrust: f.boardTrust ?? null };

  const nextSeason = (f.season || 1) + 1;

  // Group into "fires next season" vs "fires later"
  const nextSeasonItems = pending.filter(e => e.triggerSeason === nextSeason);
  const futureItems = pending.filter(e => e.triggerSeason > nextSeason);

  // Build display items
  const items = [
    ...nextSeasonItems.map(e => ({
      timing: 'next',
      type: e.type,
      delta: e.delta,
      source: e.source,
      label: formatPendingEffectLabel(e),
    })),
    ...futureItems.map(e => ({
      timing: 'future',
      type: e.type,
      delta: e.delta,
      source: e.source,
      label: formatPendingEffectLabel(e),
    })),
  ];

  return {
    items,
    boardTrust: f.boardTrust ?? null,
    boardTrustFloor: f.franchiseIdentity?.boardTrustFloor ?? 0,
  };
}

function formatPendingEffectLabel(effect) {
  const fieldLabels = {
    fanRating: 'Fan Rating',
    mediaRep: 'Media Rep',
    lockerRoomChemistry: 'Locker Room Chemistry',
    boardTrust: 'Board Trust',
    sponsorInterest: 'Sponsor Level',
    fanExpectations: 'Fan Expectations',
  };
  const field = fieldLabels[effect.type] || effect.type;
  if (effect.type === 'fanExpectations') return `Fan expectations elevated — below-.500 next season will hit harder`;
  const sign = effect.delta > 0 ? '+' : '';
  return `${field} ${sign}${effect.delta}`;
}

// ── Helpers ──────────────────────────────────────────────────────────

function round1(n) {
  return Math.round((n ?? 0) * 10) / 10;
}
