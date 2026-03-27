import {
  CITY_ECONOMY, STADIUM_TIERS, STADIUM_TIER_ORDER, STADIUM_SUFFIXES,
  STADIUM_NAMING_FLAVORS, STADIUM_BUILD_TIMELINE,
  getStadiumTierFromCapacity,
} from '@/data/leagues';
import { rand, randFloat, pick, clamp, r1, generateId } from './roster';
import { calculateCapSpace, calculateValuation } from './finance';

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

/** Generate a naming rights offer for a new stadium (40% higher value) */
export function generateNewStadiumNamingRightsOffer(f) {
  const baseValue = Math.round(f.market * 0.12 + f.fanRating * 0.05 + f.mediaRep * 0.03);
  const corps = [
    'Apex Industries', 'Meridian Corp', 'Quantum Holdings', 'Vanguard Systems',
    'Pinnacle Group', 'Atlas Financial', 'Sovereign Energy', 'Nexus Global',
    'Titan Industries', 'Zenith Corp',
  ];
  const flavor = pick(STADIUM_NAMING_FLAVORS);
  return {
    company: pick(corps),
    annualPay: clamp(Math.round(baseValue * 1.4), 3, 12),
    years: rand(8, 20),
    flavor,
    isNewStadium: true,
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
// PRESS CONFERENCE
// ============================================================

/**
 * Formats effect labels for a press conference option.
 * @param {Object} opt - Option with bonus fields
 * @returns {string[]} Array of effect label strings like "Fan +5"
 */
function formatEffects(opt) {
  const effects = [];
  if (opt.fanBonus) effects.push(`Fan ${opt.fanBonus > 0 ? '+' : ''}${opt.fanBonus}`);
  if (opt.mediaBonus) effects.push(`Media ${opt.mediaBonus > 0 ? '+' : ''}${opt.mediaBonus}`);
  if (opt.communityBonus) effects.push(`Community ${opt.communityBonus > 0 ? '+' : ''}${opt.communityBonus}`);
  if (opt.moraleBonus) effects.push(`Chemistry ${opt.moraleBonus > 0 ? '+' : ''}${opt.moraleBonus}`);
  return effects;
}

/**
 * Generates press conference questions from a pool of 12 situational templates.
 * Selects 2-3 questions based on current franchise state.
 * Each option includes visible effect labels.
 * @param {Object} f - Franchise state (must have current-season wins/losses)
 * @returns {Object[]} Array of press conference prompt objects with options
 */
export function genPressConference(f) {
  const totalGames = Math.max(1, (f.wins || 0) + (f.losses || 0));
  const wp = (f.wins || 0) / totalGames;
  const pool = [];

  // 1. Winning streak (3+ wins in a row or high win%)
  if (wp > 0.65) {
    pool.push({
      id: 'pc_win_streak',
      prompt: `Reporter: "The ${f.name} are on fire. Can you keep this run going?"`,
      options: [
        { label: '"We\'re bringing it home."', fanBonus: 5, mediaBonus: 3, moraleBonus: 2, effectLabels: null },
        { label: '"One game at a time."', fanBonus: 1, mediaBonus: 1, moraleBonus: 1, effectLabels: null },
        { label: '"No comment."', mediaBonus: -3, effectLabels: null },
      ],
    });
  }

  // 2. Losing streak (3+ losses or low win%)
  if (wp < 0.35 && totalGames > 3) {
    pool.push({
      id: 'pc_lose_streak',
      prompt: `Reporter: "The losses keep piling up. How do you respond to the skid?"`,
      options: [
        { label: '"We\'re making changes."', fanBonus: 3, mediaBonus: 4, moraleBonus: -3, effectLabels: null },
        { label: '"Stay the course."', fanBonus: -2, mediaBonus: -1, moraleBonus: 5, effectLabels: null },
        { label: '"I take full responsibility."', fanBonus: 4, mediaBonus: 6, moraleBonus: 1, effectLabels: null },
      ],
    });
  }

  // 3. Rivalry game
  if (f.rivalry?.active && f.rivalry?.teamName) {
    pool.push({
      id: 'pc_rivalry',
      prompt: `Reporter: "What's your message to ${f.rivalry.teamName}?"`,
      options: [
        { label: '"They know who we are."', fanBonus: 6, mediaBonus: 2, moraleBonus: 3, effectLabels: null },
        { label: '"We respect the competition."', fanBonus: 1, mediaBonus: 4, moraleBonus: 1, effectLabels: null },
        { label: '"Let the scoreboard talk."', fanBonus: 3, mediaBonus: 3, moraleBonus: 2, effectLabels: null },
      ],
    });
  }

  // 4. Star player injury
  const injuredStar = [f.star1, f.star2, f.corePiece].find(p => p?.injured);
  if (injuredStar) {
    pool.push({
      id: 'pc_injury',
      prompt: `Reporter: "With ${injuredStar.name} out, how do you plan to compete?"`,
      options: [
        { label: '"Next man up."', fanBonus: 2, mediaBonus: 3, moraleBonus: 4, effectLabels: null },
        { label: '"It\'s a devastating blow."', fanBonus: -1, mediaBonus: 5, moraleBonus: -2, effectLabels: null },
        { label: '"We have depth for a reason."', fanBonus: 3, mediaBonus: 2, moraleBonus: 3, effectLabels: null },
      ],
    });
  }

  // 5. Rookie breakout (taxi squad or rookie slots have players)
  if ((f.taxiSquad?.length > 0 || f.rookieSlots?.length > 0)) {
    const rookie = f.taxiSquad?.[0] || f.rookieSlots?.[0];
    if (rookie) {
      pool.push({
        id: 'pc_rookie',
        prompt: `Reporter: "${rookie.name} has been impressive. Talk about the young talent."`,
        options: [
          { label: '"Sky\'s the limit."', fanBonus: 4, mediaBonus: 4, moraleBonus: 2, effectLabels: null },
          { label: '"Still a lot to learn."', fanBonus: 0, mediaBonus: 2, moraleBonus: -1, effectLabels: null },
          { label: '"Our scouting deserves credit."', fanBonus: 2, mediaBonus: 3, moraleBonus: 1, effectLabels: null },
        ],
      });
    }
  }

  // 6. Trade deadline (used after Q2)
  if (f.quarterWins !== undefined || f._quarterGamesPlayed !== undefined) {
    pool.push({
      id: 'pc_deadline',
      prompt: `Reporter: "Trade deadline is approaching. Are you buyers or sellers?"`,
      options: [
        { label: '"We\'re all in."', fanBonus: 5, mediaBonus: 3, moraleBonus: 3, effectLabels: null },
        { label: '"We\'re open to offers."', fanBonus: -2, mediaBonus: 4, moraleBonus: -3, effectLabels: null },
        { label: '"We\'re evaluating."', fanBonus: 0, mediaBonus: 1, moraleBonus: 0, effectLabels: null },
      ],
    });
  }

  // 7. Playoff push (win% > 0.550)
  if (wp > 0.55) {
    pool.push({
      id: 'pc_playoff_push',
      prompt: `Reporter: "Is this a championship roster?"`,
      options: [
        { label: '"Absolutely."', fanBonus: 6, mediaBonus: -2, moraleBonus: 5, effectLabels: null },
        { label: '"We need to prove it on the field."', fanBonus: 2, mediaBonus: 4, moraleBonus: 2, effectLabels: null },
        { label: '"We\'re close, but not there yet."', fanBonus: 1, mediaBonus: 3, moraleBonus: -1, effectLabels: null },
      ],
    });
  }

  // 8. Tanking (win% < 0.300)
  if (wp < 0.3 && totalGames > 5) {
    pool.push({
      id: 'pc_tanking',
      prompt: `Reporter: "Are you building for the future?"`,
      options: [
        { label: '"We\'re investing in tomorrow."', fanBonus: -3, mediaBonus: 6, moraleBonus: -5, effectLabels: null },
        { label: '"We compete every day."', fanBonus: 4, mediaBonus: -2, moraleBonus: 6, effectLabels: null },
      ],
    });
  }

  // 9. Financial pressure (low cash)
  if ((f.cash || 0) < 10) {
    pool.push({
      id: 'pc_finance',
      prompt: `Reporter: "Budget constraints are real. How do you manage with tight finances?"`,
      options: [
        { label: '"Smart money wins."', fanBonus: 2, mediaBonus: 4, moraleBonus: 1, effectLabels: null },
        { label: '"We need ownership to step up."', fanBonus: 3, mediaBonus: -3, moraleBonus: -2, effectLabels: null },
        { label: '"We develop, not overspend."', fanBonus: 1, mediaBonus: 3, moraleBonus: 3, effectLabels: null },
      ],
    });
  }

  // 10. Fan unrest (fanRating < 40)
  if ((f.fanRating || 50) < 40) {
    pool.push({
      id: 'pc_fans',
      prompt: `Reporter: "The fans are frustrated. Your response?"`,
      options: [
        { label: '"We hear them. Changes are coming."', fanBonus: 6, mediaBonus: 3, moraleBonus: -2, effectLabels: null },
        { label: '"Fans should trust the process."', fanBonus: -3, mediaBonus: -2, moraleBonus: 3, effectLabels: null },
        { label: '"We owe them better."', fanBonus: 4, mediaBonus: 5, moraleBonus: 1, effectLabels: null },
      ],
    });
  }

  // 11. Championship defense (previous champion)
  if ((f.championships || 0) > 0 && (f.season || 1) > 1) {
    pool.push({
      id: 'pc_defend',
      prompt: `Reporter: "Can you repeat as champions?"`,
      options: [
        { label: '"We\'re hungrier than ever."', fanBonus: 5, mediaBonus: 4, moraleBonus: 4, effectLabels: null },
        { label: '"The target is on our back."', fanBonus: 2, mediaBonus: 3, moraleBonus: 2, effectLabels: null },
        { label: '"History is hard to repeat."', fanBonus: -1, mediaBonus: 2, moraleBonus: -1, effectLabels: null },
      ],
    });
  }

  // 12. New GM (first season)
  if ((f.season || 1) === 1) {
    pool.push({
      id: 'pc_new_gm',
      prompt: `Reporter: "What's your vision for this franchise?"`,
      options: [
        { label: '"Win now."', fanBonus: 5, mediaBonus: 2, moraleBonus: 4, effectLabels: null },
        { label: '"Build a dynasty."', fanBonus: 3, mediaBonus: 5, moraleBonus: 2, effectLabels: null },
        { label: '"Sustainable excellence."', fanBonus: 2, mediaBonus: 4, moraleBonus: 3, effectLabels: null },
      ],
    });
  }

  // Always include a community question as fallback
  pool.push({
    id: 'pc_community',
    prompt: `Reporter: "What are the ${f.name} doing for ${f.city}?"`,
    options: [
      { label: 'Highlight charity', communityBonus: 5, mediaBonus: 4, fanBonus: 2, effectLabels: null },
      { label: 'Deflect to sport', communityBonus: -3, mediaBonus: -2, fanBonus: 1, effectLabels: null },
    ],
  });

  // Add effect labels to all options
  pool.forEach(pc => {
    pc.options = pc.options.map(opt => ({
      ...opt,
      effectLabels: formatEffects(opt),
    }));
  });

  // Select 2-3 questions: shuffle and pick, always including at least one situational
  const shuffled = pool.sort(() => Math.random() - 0.5);
  const count = Math.min(shuffled.length, rand(2, 3));
  return shuffled.slice(0, count);
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
  const top = standings?.[0];
  const pf = playerFr?.[0];
  const allTeams = [...(lt?.ngl || []), ...(lt?.abl || [])];
  const mvpTeam = allTeams.sort((a, b) => (b.rosterQuality || 0) - (a.rosterQuality || 0))[0];
  return {
    season,
    headline: top
      ? `${top.city} ${top.name} Claim Top Spot with ${top.wins}-${top.losses} Record`
      : `Season ${season} Concludes`,
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
// OWNER / MEDIA PRESSURE SYSTEM
// ============================================================

/**
 * Checks if a losing-season pressure event should trigger and returns it.
 * @param {Object} f - Franchise state (must have consecutiveLosingSeason field)
 * @param {number} season - Current season number
 * @returns {Object|null} Pressure event or null
 */
export function checkPressureEvent(f, season) {
  const games = f.league === 'ngl' ? 17 : 82;
  const wp = f.wins / Math.max(1, games);
  const consecutive = f.consecutiveLosingSeason || 0;

  if (wp >= 0.400) return null; // No pressure

  const newConsecutive = consecutive + 1;
  if (newConsecutive === 1) {
    return {
      id: 'pressure_1_' + season,
      type: 'pressure',
      title: 'Media Heat Rising',
      description: `The ${f.city} media is starting to ask hard questions. Another season below .400 win rate has not gone unnoticed. Critics are calling for changes.`,
      severity: 'warning',
      gmRepDelta: -3,
      fanRatingDelta: -2,
      choices: [{ label: 'Hold firm', action: 'dismiss' }],
    };
  } else if (newConsecutive === 2) {
    return {
      id: 'pressure_2_' + season,
      type: 'pressure',
      title: 'Sponsorship Fallout',
      description: `Two consecutive losing seasons have damaged the franchise's appeal. Sponsors are pulling back — sponsorship revenue will be reduced by 15% next season, and your naming rights deal has come under threat.`,
      severity: 'warning',
      gmRepDelta: -7,
      sponsorPenalty: 0.85, // multiplier
      choices: [{ label: 'Accept consequences', action: 'dismiss' }],
    };
  } else if (newConsecutive === 3) {
    return {
      id: 'pressure_3_' + season,
      type: 'pressure',
      title: 'League Intervention',
      description: `The league has taken notice of three consecutive losing seasons. An intervention is required.`,
      severity: 'critical',
      gmRepDelta: -12,
      choices: [
        { label: 'Accept roster audit (release lowest-morale non-star)', action: 'audit' },
        { label: 'Pay $10M league fine', action: 'fine', cost: 10 },
      ],
    };
  } else if (newConsecutive >= 4) {
    return {
      id: 'pressure_4_' + season,
      type: 'pressure',
      title: 'Ownership Ultimatum',
      description: `The ownership group has had enough. Win at least 40% of games next season or the franchise will be forced into a sale. Your GM tenure hangs in the balance.`,
      severity: 'critical',
      gmRepDelta: -15,
      ultimatum: true,
      choices: [{ label: 'Accept the challenge', action: 'dismiss' }],
    };
  }
  return null;
}

// ============================================================
// STADIUM SYSTEM (Phase A1)
// ============================================================

/** Upgrade a stadium to the next tier (one tier at a time) */
export function applyStadiumUpgrade(f, season) {
  const currentIdx = STADIUM_TIER_ORDER.indexOf(f.stadiumTier || 'small');
  const nextTier = STADIUM_TIER_ORDER[currentIdx + 1];
  if (!nextTier) return null; // already at max
  const tierData = STADIUM_TIERS[nextTier];
  if (season < tierData.minSeason) return null; // too early
  if ((f.cash || 0) < tierData.upgradeCost) return null; // can't afford
  const capRange = tierData.capacityRange;
  const newCap = rand(capRange[0], capRange[1]);
  return {
    ...f,
    stadiumTier: nextTier,
    stadiumCapacity: newCap,
    stadiumCondition: 95,
    stadiumAge: 0,
    cash: r1((f.cash || 0) - tierData.upgradeCost),
    stadiumUnderConstruction: true,   // disruption this season
    pendingStadiumEvent: { type: 'upgrade_started', tier: nextTier, cost: tierData.upgradeCost },
  };
}

/** Generate a random construction event */
export function generateConstructionEvent() {
  const roll = Math.random();
  if (roll < 0.15) return { type: 'cost_overrun',        headline: 'Cost Overrun',          desc: 'Unexpected material costs have increased the project budget.', additionalCost: rand(8, 15) };
  if (roll < 0.28) return { type: 'labor_dispute',       headline: 'Labor Dispute',          desc: 'Workers have walked off the job. Construction is delayed.', delay: 1, sunkCost: 3 };
  if (roll < 0.40) return { type: 'favorable_weather',   headline: 'Favorable Weather',      desc: 'Perfect conditions kept construction ahead of schedule. $5M returned from contingency.', cashback: 5 };
  if (roll < 0.55) return { type: 'community_protest',   headline: 'Community Protest',      desc: 'Local residents are pushing back on the project.', communityDelta: -10 };
  return { type: 'no_event', headline: 'Smooth Construction', desc: 'Construction proceeding on schedule with no major incidents.' };
}

/** Start a new stadium construction project */
export function startStadiumProject(f, targetTier, publicFundingPct, season) {
  const timeline = STADIUM_BUILD_TIMELINE[targetTier];
  if (!timeline) return f;
  const privateCostFraction = (100 - (publicFundingPct || 0)) / 100;
  const totalCost = r1(timeline.baseCost * privateCostFraction);
  // First-season down payment (30% of private cost)
  const downPayment = r1(totalCost * 0.3);
  if ((f.cash || 0) < downPayment) return f; // can't afford down payment
  return {
    ...f,
    cash: r1((f.cash || 0) - downPayment),
    stadiumProject: {
      active: true,
      targetTier,
      totalCost,
      paidSoFar: downPayment,
      seasonStarted: season,
      currentPhase: 'planning',
      seasonsRemaining: timeline.seasons,
      publicFundingPct: publicFundingPct || 0,
      publicFundingStatus: publicFundingPct > 0 ? 'approved' : 'not_applied',
    },
  };
}

/** Calculate probability of public funding approval */
export function calculatePublicFundingApproval(f, fundingTier) {
  // fundingTier: 1=15%, 2=30%, 3=50%
  const baseProbabilities = { 1: 0.75, 2: 0.45, 3: 0.20 };
  let prob = baseProbabilities[fundingTier] || 0.45;
  if ((f.communityRating || 50) >= 70) prob += 0.10;
  if ((f.mediaRep || 50) >= 65) prob += 0.10;
  if ((f.consecutiveLosingSeason || 0) >= 2) prob -= 0.15;
  prob += Math.min(0.15, (f.championships || 0) * 0.05);
  return clamp(prob, 0.05, 0.95);
}

/** Advance stadium project by one season. Returns updated franchise. */
export function advanceStadiumProject(f, season) {
  if (!f.stadiumProject?.active) return f;
  let proj = { ...f.stadiumProject };
  let updated = { ...f };

  // Determine current phase
  const elapsed = season - proj.seasonStarted;
  const totalSeasons = STADIUM_BUILD_TIMELINE[proj.targetTier]?.seasons || 2;
  if (totalSeasons === 2) {
    proj.currentPhase = elapsed === 0 ? 'planning' : elapsed === 1 ? 'construction' : 'complete';
  } else {
    proj.currentPhase = elapsed === 0 ? 'planning' : elapsed === 1 ? 'construction' : elapsed === 2 ? 'final' : 'complete';
  }

  if (proj.currentPhase === 'complete') {
    // Apply new stadium completion
    const capRange = STADIUM_TIERS[proj.targetTier].capacityRange;
    const newCap = rand(capRange[0], capRange[1]);
    const namingFlavor = pick(STADIUM_NAMING_FLAVORS);
    const newStadiumName = `New ${updated.city} ${namingFlavor}`;
    // Terminate old naming rights with 50% buyout
    let buyout = 0;
    if (updated.namingRightsActive && updated.namingRightsDeal && updated.namingRightsYears > 0) {
      buyout = r1(updated.namingRightsDeal * updated.namingRightsYears * 0.5);
    }
    updated = {
      ...updated,
      stadiumTier: proj.targetTier,
      stadiumCapacity: newCap,
      stadiumCondition: 100,
      stadiumAge: 0,
      stadiumName: newStadiumName,
      stadiumDisplayName: newStadiumName,
      namingRightsActive: false,
      namingRightsDeal: null,
      namingRightsName: null,
      namingRightsYears: 0,
      cash: r1((updated.cash || 0) + buyout),
      fanRating: clamp((updated.fanRating || 50) + 15, 0, 100),
      newStadiumHoneymoon: 2,
      stadiumProject: null,
      stadiumUnderConstruction: false,
      pendingStadiumEvent: {
        type: 'stadium_complete',
        headline: 'New Stadium Opens!',
        desc: `The new ${newStadiumName} has opened. Fans are electrified! Fan rating +15, gate revenue bonus for 2 seasons.${buyout > 0 ? ` Old naming rights deal bought out for $${buyout}M.` : ''}`,
        newNamingOffer: true, // signal to generate new naming rights offer
      },
    };
    return updated;
  }

  // Apply construction disruption for active build phases
  if (['construction', 'final'].includes(proj.currentPhase)) {
    const evt = generateConstructionEvent();
    if (evt.type === 'cost_overrun') {
      proj.totalCost = r1(proj.totalCost + evt.additionalCost);
    } else if (evt.type === 'labor_dispute') {
      proj.seasonStarted = (proj.seasonStarted || season) - 1; // delay by 1 season
      updated.cash = r1((updated.cash || 0) - evt.sunkCost);
    } else if (evt.type === 'favorable_weather') {
      updated.cash = r1((updated.cash || 0) + (evt.cashback || 5));
    } else if (evt.type === 'community_protest') {
      updated.communityRating = clamp((updated.communityRating || 50) + evt.communityDelta, 0, 100);
    }
    // Annual construction payment (35% of remaining cost per construction season)
    const remainingCost = proj.totalCost - proj.paidSoFar;
    const payment = r1(remainingCost * 0.5);
    proj.paidSoFar = r1(proj.paidSoFar + Math.min(payment, remainingCost));
    updated.cash = r1((updated.cash || 0) - payment);
    updated.pendingStadiumEvent = { ...evt };
    updated.stadiumUnderConstruction = true;
  }

  updated.stadiumProject = proj;
  return updated;
}

/** Purchase premium seating (luxury boxes or club seat sections) */
export function purchasePremiumSeating(f, type, count) {
  // type: 'luxury_box' or 'club_section'
  const maxBoxes = { small: 0, mid: 20, large: 40, mega: 80 }[f.stadiumTier || 'small'] || 0;
  const maxClub = { small: 0, mid: 5, large: 15, mega: 40 }[f.stadiumTier || 'small'] || 0;
  if (type === 'luxury_box') {
    const current = f.luxuryBoxes || 0;
    const canAdd = Math.min(count, maxBoxes - current);
    if (canAdd <= 0) return f;
    const cost = r1(canAdd * 2); // $2M per box
    if ((f.cash || 0) < cost) return f;
    return { ...f, luxuryBoxes: current + canAdd, cash: r1((f.cash || 0) - cost) };
  } else {
    const current = f.clubSeatSections || 0;
    const canAdd = Math.min(count, maxClub - current);
    if (canAdd <= 0) return f;
    const cost = r1(canAdd * 0.5); // $0.5M per 100-seat section
    if ((f.cash || 0) < cost) return f;
    return { ...f, clubSeatSections: current + canAdd, cash: r1((f.cash || 0) - cost) };
  }
}

// ============================================================
// PHASE B2: LEAGUE HISTORY, FRANCHISE RECORDS, HALL OF FAME
// ============================================================

/**
 * Initialize leagueHistory object with defaults.
 * @returns {Object}
 */
export function initLeagueHistory() {
  return {
    champions: [],
    notableSeasons: [],
    hallOfFame: [],
  };
}

/**
 * Push a champion entry to league history.
 * @param {Object} history - leagueHistory object
 * @param {Object} entry - { season, teamName, city, isPlayerTeam, record, coachName, starPlayer }
 * @returns {Object} Updated history
 */
export function addChampion(history, entry) {
  return { ...history, champions: [...(history.champions || []), entry] };
}

/**
 * Check for notable season events and push them.
 * @param {Object} history - leagueHistory object
 * @param {Object[]} allTeams - All teams (NGL+ABL) with wins/losses
 * @param {Object[]} playerFranchises - Player's franchises
 * @param {number} season - Current season
 * @returns {Object} Updated history
 */
export function checkNotableSeasons(history, allTeams, playerFranchises, season) {
  const notable = [...(history.notableSeasons || [])];
  const lg = 'ngl'; // default
  const games = 17;

  for (const t of allTeams) {
    const g = t.league === 'ngl' ? 17 : 82;
    const isPlayer = playerFranchises.some(pf => pf.id === t.id);
    if (t.wins >= g - 2) {
      notable.push({ season, type: 'Historic Season', description: `${t.city} ${t.name} posted a historic ${t.wins}-${t.losses} record.`, isPlayerTeam: isPlayer });
    }
    if (t.losses >= g - 2) {
      notable.push({ season, type: 'Historic Collapse', description: `${t.city} ${t.name} suffered a historic ${t.wins}-${t.losses} collapse.`, isPlayerTeam: isPlayer });
    }
  }

  for (const pf of playerFranchises) {
    // Dynasty declared: 3+ consecutive championships
    if ((pf.championships || 0) >= 3) {
      const trophies = pf.trophies || [];
      const last3 = trophies.slice(-3);
      if (last3.length >= 3) {
        const consecutive = last3.every((t, i) => i === 0 || t.season === last3[i - 1].season + 1);
        if (consecutive && !notable.some(n => n.type === 'Dynasty Declared' && n.season === season)) {
          notable.push({ season, type: 'Dynasty Declared', description: `The ${pf.city} ${pf.name} have won 3 consecutive championships. A dynasty is declared!`, isPlayerTeam: true });
        }
      }
    }

    // Greatest Turnaround: bottom-5 to champion in consecutive seasons
    if (pf.history && pf.history.length >= 2) {
      const prev = pf.history[pf.history.length - 2];
      const curr = pf.history[pf.history.length - 1];
      const g = pf.league === 'ngl' ? 17 : 82;
      const prevWP = prev.wins / g;
      const wonChamp = (pf.trophies || []).some(t => t.season === season);
      if (prevWP < 0.30 && wonChamp) {
        notable.push({ season, type: 'Greatest Turnaround', description: `The ${pf.city} ${pf.name} went from ${prev.wins}-${prev.losses} to champions!`, isPlayerTeam: true });
      }
    }

    // All-Time Great: player hits 95+ rating
    for (const p of (pf.players || [])) {
      if (p.rating >= 95) {
        if (!notable.some(n => n.type === 'All-Time Great Emerges' && n.description.includes(p.name))) {
          notable.push({ season, type: 'All-Time Great Emerges', description: `${p.name} of the ${pf.city} ${pf.name} has reached a ${p.rating} rating — an all-time great.`, isPlayerTeam: true });
        }
      }
    }
  }

  return { ...history, notableSeasons: notable };
}

/**
 * Initialize franchise records with defaults.
 * @returns {Object}
 */
export function initFranchiseRecords() {
  return {
    mostWinsInSeason: { value: 0, season: null },
    bestWinPct: { value: 0, season: null },
    mostRevenue: { value: 0, season: null },
    highestValuation: { value: 0, season: null },
    longestWinStreak: { value: 0, season: null },
    championships: 0,
    playoffAppearances: 0,
    hallOfFamers: 0,
  };
}

/**
 * Update franchise records at end of season.
 * @param {Object} records - Current franchise records
 * @param {Object} f - Franchise state (post-season)
 * @param {number} season - Current season
 * @returns {{ records: Object, newRecords: string[] }} Updated records and list of broken records
 */
export function updateFranchiseRecords(records, f, season) {
  const r = { ...(records || initFranchiseRecords()) };
  const newRecords = [];
  const games = f.league === 'ngl' ? 17 : 82;
  const winPct = f.wins / Math.max(1, games);

  if (f.wins > (r.mostWinsInSeason?.value || 0)) {
    r.mostWinsInSeason = { value: f.wins, season };
    newRecords.push('Most Wins in Season');
  }
  if (winPct > (r.bestWinPct?.value || 0)) {
    r.bestWinPct = { value: Math.round(winPct * 1000) / 1000, season };
    newRecords.push('Best Win %');
  }
  if ((f.finances?.revenue || 0) > (r.mostRevenue?.value || 0)) {
    r.mostRevenue = { value: f.finances.revenue, season };
    newRecords.push('Most Revenue');
  }
  const val = calculateValuation(f);
  if (val > (r.highestValuation?.value || 0)) {
    r.highestValuation = { value: val, season };
    newRecords.push('Highest Valuation');
  }
  r.championships = f.championships || 0;
  if (f.playoffTeam) r.playoffAppearances = (r.playoffAppearances || 0) + 1;

  return { records: r, newRecords };
}

/**
 * Evaluate a retiring player for Hall of Fame induction.
 * @param {Object} player - Player object
 * @param {Object} f - Franchise state
 * @returns {Object|null} Induction candidate or null
 */
export function evaluateHallOfFame(player, f) {
  const criteria = [];
  const peakRating = player.careerStats?.bestRating || player.rating;
  const seasonsWithTeam = player.seasonsWithTeam || 0;
  const championships = (f.trophies || []).length;

  if (seasonsWithTeam >= 5 && peakRating >= 88) criteria.push('5+ seasons with franchise AND peak rating ≥ 88');
  if (championships >= 2) criteria.push('2+ championships with franchise');
  if (peakRating >= 92) criteria.push('Peak rating 92+');
  if (seasonsWithTeam >= 7 && peakRating >= 82) criteria.push('7+ seasons AND peak rating ≥ 82');

  if (criteria.length === 0) return null;

  return {
    name: player.name,
    position: player.position,
    trait: player.trait,
    peakRating,
    seasons: seasonsWithTeam,
    championships,
    criteria,
    rating: player.rating,
    careerStats: player.careerStats,
  };
}

// ============================================================
// PHASE B3: RIVALRY INTENSITY
// ============================================================

/**
 * Initialize head-to-head tracking object.
 * @returns {Object}
 */
export function initHeadToHead() {
  return {};
}

/**
 * Update head-to-head record after a playoff meeting.
 * @param {Object} h2h - Current H2H object
 * @param {Object} opponent - Opponent team
 * @param {boolean} won - Whether the player's team won
 * @param {number} season - Current season
 * @param {string} round - Playoff round name
 * @returns {Object} Updated H2H
 */
export function updateHeadToHead(h2h, opponent, won, season, round) {
  const prev = h2h[opponent.id] || { teamName: `${opponent.city} ${opponent.name}`, wins: 0, losses: 0, playoffMeetings: 0, lastMeeting: null };
  return {
    ...h2h,
    [opponent.id]: {
      ...prev,
      teamName: `${opponent.city} ${opponent.name}`,
      wins: prev.wins + (won ? 1 : 0),
      losses: prev.losses + (won ? 0 : 1),
      playoffMeetings: prev.playoffMeetings + 1,
      lastMeeting: { season, result: won ? 'W' : 'L', round },
    },
  };
}

/**
 * Initialize rivalry state.
 * @returns {Object}
 */
export function initRivalry() {
  return { teamId: null, teamName: null, intensityScore: 0, h2hRecord: { wins: 0, losses: 0 }, lastResult: null, active: false };
}

/**
 * Assign or update rivalry at end of season.
 * @param {Object} rivalry - Current rivalry state
 * @param {Object} f - Franchise state
 * @param {Object[]} leagueTeams - All teams in the franchise's league
 * @param {number} season - Current season
 * @param {Object} h2h - Head-to-head records
 * @param {boolean} metInPlayoffs - Whether they met in playoffs this season
 * @returns {Object} Updated rivalry state
 */
export function updateRivalry(rivalry, f, leagueTeams, season, h2h, metInPlayoffs) {
  // Don't assign until season 2
  if (season < 2) return rivalry || initRivalry();

  let r = { ...(rivalry || initRivalry()) };
  const teams = leagueTeams || [];

  // Assign rival if not yet active (season 2+)
  if (!r.active || !r.teamId) {
    // Find same-conference team with closest win% that isn't the player
    const candidates = teams
      .filter(t => t.id !== f.id && !t.isPlayerOwned)
      .map(t => ({ ...t, winDiff: Math.abs((t.wins / Math.max(1, t.wins + t.losses)) - (f.wins / Math.max(1, f.wins + f.losses))) }))
      .sort((a, b) => a.winDiff - b.winDiff);

    // Prefer playoff opponents
    const playoffOpponent = candidates.find(c => h2h && h2h[c.id]?.playoffMeetings > 0);
    const rival = playoffOpponent || candidates[0];

    if (rival) {
      const h2hRec = h2h?.[rival.id] || { wins: 0, losses: 0 };
      r = {
        teamId: rival.id,
        teamName: `${rival.city} ${rival.name}`,
        intensityScore: 15,
        h2hRecord: { wins: h2hRec.wins || 0, losses: h2hRec.losses || 0 },
        lastResult: null,
        active: true,
      };
    }
    return r;
  }

  // Update intensity
  let delta = 3; // natural growth
  if (metInPlayoffs) delta += 8;
  // Check standings proximity
  const rivalTeam = teams.find(t => t.id === r.teamId);
  if (rivalTeam) {
    const winDiff = Math.abs(f.wins - rivalTeam.wins);
    if (winDiff <= 2) delta += 5;
    if (rivalTeam.wins / Math.max(1, rivalTeam.wins + rivalTeam.losses) < 0.35) delta -= 5;
  }

  const h2hRec = h2h?.[r.teamId] || r.h2hRecord;
  r.intensityScore = clamp((r.intensityScore || 0) + delta, 0, 100);
  r.h2hRecord = { wins: h2hRec.wins || 0, losses: h2hRec.losses || 0 };

  return r;
}

/**
 * Get rivalry tier label from intensity score.
 * @param {number} intensity - 0-100
 * @returns {string}
 */
export function getRivalryTier(intensity) {
  if (intensity >= 76) return 'Legendary';
  if (intensity >= 51) return 'Heated';
  if (intensity >= 26) return 'Conference Rivals';
  return 'Emerging';
}

/**
 * Get rivalry narrative for playoff matchup.
 * @param {number} intensity - 0-100
 * @param {string} teamName - Rival team name
 * @returns {string}
 */
export function getRivalryPlayoffNarrative(intensity, teamName) {
  if (intensity >= 76) return `A legendary rivalry reaches its peak. The entire league stops to watch this playoff showdown against ${teamName}.`;
  if (intensity >= 51) return `The heated rivalry with ${teamName} spills into the playoffs. The intensity is palpable.`;
  if (intensity >= 26) return `Conference rivals meet again in the playoffs. The ${teamName} matchup is circled on every calendar.`;
  return `An emerging rivalry takes shape as ${teamName} stands in the way of a playoff run.`;
}

// ============================================================
// SPONSOR DEAL EVENT
// ============================================================

/**
 * Generates a Sponsor Deal event with a random corporate sponsor.
 * @returns {Object} Sponsor deal event with base payout, playoff bonus, and sponsor name
 */
export function generateSponsorDeal() {
  const sponsors = [
    'OmniCorp Financial', 'Apex Dynamics', 'Horizon Airlines', 'Titan Energy',
    'Pinnacle Health', 'Velocity Automotive', 'Quantum Tech', 'Vertex Telecommunications',
    'Aegis Insurance', 'Nova Brewing Co', 'Zenith Logistics', 'Vanguard Holdings',
  ];
  return {
    id: 'sponsor_' + generateId(),
    type: 'sponsor_deal',
    sponsor: pick(sponsors),
    basePayout: 5,
    playoffBonus: 2,
    title: 'Sponsorship Offer',
    description: `${pick(sponsors)} wants to become the official team sponsor. Base payout of $5M per season with a $2M playoff bonus.`,
  };
}

import { applyExtension } from './roster';

export function resolveEventChoice(franchise, event, choice) {
  let updated = { ...franchise };

  if (event.type === 'extension_demand') {
    if (choice.action === 'sign') {
      return applyExtension(updated, event.slotKey, event.extSalary, event.extYears);
    } else if (choice.action === 'release') {
      updated[event.slotKey] = null;
      updated.players = [updated.star1, updated.star2, updated.corePiece].filter(Boolean);
      updated.totalSalary = r1(updated.players.reduce((s, p) => s + p.salary, 0));
      return updated;
    }
    return updated;
  }

  if (event.type === 'pressure') {
    if (event.fanRatingDelta) updated.fanRating = clamp(updated.fanRating + event.fanRatingDelta, 0, 100);
    if (event.sponsorPenalty) updated.sponsorLevel = Math.max(0, (updated.sponsorLevel || 1) * event.sponsorPenalty);
    if (choice.action === 'fine') updated.cash = r1((updated.cash || 0) - (choice.cost || 10));
    if (choice.action === 'audit') {
      const slots = ['corePiece'];
      for (const slot of slots) {
        if (updated[slot]) { updated = { ...updated, [slot]: null }; break; }
      }
      updated.players = [updated.star1, updated.star2, updated.corePiece].filter(Boolean);
      updated.totalSalary = r1(updated.players.reduce((s, p) => s + p.salary, 0));
    }
    return updated;
  }

  if (choice.cost) updated.cash = r1((updated.cash || 0) - choice.cost);
  if (choice.revenue) updated.cash = r1((updated.cash || 0) + choice.revenue);
  if (choice.communityBonus) updated.communityRating = clamp((updated.communityRating || 50) + choice.communityBonus, 0, 100);
  if (choice.mediaBonus) updated.mediaRep = clamp((updated.mediaRep || 50) + choice.mediaBonus, 0, 100);
  if (choice.stadiumBonus) updated.stadiumCondition = clamp(updated.stadiumCondition + choice.stadiumBonus, 0, 100);
  if (choice.coachBonus && updated.coach.level < 4) updated.coach = { ...updated.coach, level: updated.coach.level + 1 };

  return updated;
}
