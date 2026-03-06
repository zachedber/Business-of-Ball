// ============================================================
// FRANCHISE BUILDER V2 — NARRATIVE ENGINE
// Claude API (optional) + procedural fallback
// ============================================================

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

// User provides API key via settings (optional)
let apiKey = null;
export function setNarrativeApiKey(key) { apiKey = key; }
export function hasNarrativeApi() { return !!apiKey; }

// ============================================================
// CLAUDE API CALL WRAPPER
// ============================================================
async function callClaude(prompt, maxTokens = 800) {
  if (!apiKey) return null;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      console.warn('Claude API error:', res.status);
      return null;
    }

    const data = await res.json();
    return data.content?.[0]?.text || null;
  } catch (e) {
    console.warn('Claude API call failed:', e);
    return null;
  }
}

// ============================================================
// PROCEDURAL FALLBACK GENERATORS
// ============================================================
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function proceduralSeasonRecap(franchise) {
  const winPct = franchise.wins / (franchise.wins + franchise.losses);
  const record = `${franchise.wins}-${franchise.losses}`;
  const city = franchise.city;
  const name = franchise.name;

  if (winPct > 0.7) {
    return pick([
      `The ${city} ${name} dominated the league this season, posting a commanding ${record} record. The front office's roster moves paid off in spectacular fashion, and championship aspirations are at an all-time high.`,
      `A season for the ages in ${city}. The ${name} went ${record}, cementing themselves as the team to beat. The fans are electric, and the locker room chemistry is palpable.`,
      `${city} witnessed greatness. The ${name}'s ${record} campaign was built on elite talent and cohesive coaching. The franchise is entering a golden era.`,
    ]);
  } else if (winPct > 0.5) {
    return pick([
      `The ${city} ${name} had a solid ${record} season, showing promise but leaving fans wanting more. The core is there — the question is whether the front office can add the missing pieces.`,
      `A competitive ${record} record puts the ${name} in the conversation, though not at the top. ${city} sees a team on the cusp, needing one more push to contend.`,
      `The ${name} went ${record} in a season of close games and building momentum. The future looks bright in ${city}, but patience will be key.`,
    ]);
  } else if (winPct > 0.35) {
    return pick([
      `A disappointing ${record} record for the ${city} ${name}. Injuries and inconsistency plagued the season, and tough decisions loom in the offseason.`,
      `The ${name} stumbled to ${record}, a frustrating campaign that tested the resolve of ${city}'s faithful fans. The rebuild conversation is getting louder.`,
    ]);
  } else {
    return pick([
      `Rock bottom in ${city}. The ${name}'s ${record} record is the worst in recent memory. The silver lining? A high draft pick and nowhere to go but up.`,
      `The ${city} ${name} endured a brutal ${record} season. Attendance dropped, morale cratered, and the front office faces enormous pressure to turn things around.`,
      `A ${record} nightmare in ${city}. The ${name} were outmatched all season, and sweeping changes are expected. The fanbase demands answers.`,
    ]);
  }
}

function proceduralGMForecast(franchise) {
  const quality = franchise.rosterQuality;
  const cap = franchise.capSpace || 0;

  if (quality > 78) {
    return `Your roster grades out as elite this preseason. With a quality rating of ${quality}, you're projected to compete for a championship. Key risk: injuries to your top talent could derail the campaign.`;
  } else if (quality > 65) {
    return `A competitive roster with a ${quality} quality rating. You should be in the playoff picture, but don't expect a deep run without upgrades. Watch the cap situation — you have $${Math.round(cap)}M in space.`;
  } else {
    return `This is a rebuilding year. Your ${quality}-rated roster will struggle against top competition. Focus on developing young talent and positioning for a high draft pick.`;
  }
}

function proceduralGMGrade(franchise) {
  const winPct = franchise.wins / (franchise.wins + franchise.losses);
  const profit = franchise.finances.profit;

  if (winPct > 0.65 && profit > 0) return { grade: 'A', analysis: 'Outstanding season. Winning and profitable — the holy grail of franchise management. Your decisions are paying dividends.' };
  if (winPct > 0.55 && profit > -5) return { grade: 'B', analysis: 'Solid management. The team is competitive and the books are balanced. A few more pieces could push this to elite territory.' };
  if (winPct > 0.4) return { grade: 'C', analysis: 'Middling results. Not bad enough to tank, not good enough to contend. You need a clearer strategic direction.' };
  if (profit > 0) return { grade: 'C-', analysis: 'The bank account is healthy but the product on the field is suffering. Fans want wins, not profit margins.' };
  return { grade: 'D', analysis: 'A rough season by any measure. Losing games, losing money, and losing faith from the fanbase. Major changes needed.' };
}

function proceduralDynastyNarrative(franchise, seasons) {
  const totalWins = franchise.history.slice(-3).reduce((s, h) => s + h.wins, 0);
  const totalLosses = franchise.history.slice(-3).reduce((s, h) => s + h.losses, 0);
  const avgWinPct = totalWins / (totalWins + totalLosses);

  if (avgWinPct > 0.65) {
    return { era: 'The Golden Dynasty', narrative: `The ${franchise.city} ${franchise.name} have established dominance over the past three seasons. With a combined ${totalWins}-${totalLosses} record, this era will be remembered as one of the greatest in franchise history.` };
  } else if (avgWinPct > 0.5) {
    return { era: 'The Contention Years', narrative: `Three seasons of competitive football in ${franchise.city}. The ${franchise.name} have been in the mix every year, posting a ${totalWins}-${totalLosses} combined record. The window is open, but greatness remains elusive.` };
  } else if (avgWinPct > 0.35) {
    return { era: 'The Turbulent Years', narrative: `A challenging stretch for the ${franchise.name}. At ${totalWins}-${totalLosses} over three seasons, the franchise has faced adversity. The front office must decide: reload or rebuild.` };
  } else {
    return { era: 'The Rebuild Era', narrative: `Dark times in ${franchise.city}. The ${franchise.name} have gone ${totalWins}-${totalLosses} over three painful seasons. But every dynasty starts from the bottom. The seeds are being planted.` };
  }
}

function proceduralLeagueNewspaper(leagueStandings, playerFranchises, season) {
  const topTeam = leagueStandings[0];
  const playerTeam = playerFranchises[0];

  return {
    headline: `${topTeam.city} ${topTeam.name} Finish Atop Standings with ${topTeam.wins}-${topTeam.losses} Record`,
    subheadline: playerTeam
      ? `${playerTeam.city} ${playerTeam.name} Post ${playerTeam.wins}-${playerTeam.losses} Season`
      : 'League Sees Dramatic Shakeup in Power Rankings',
    stories: [
      `The ${topTeam.city} ${topTeam.name} capped off a dominant campaign, leading the league with ${topTeam.wins} victories. Their consistency throughout the season was remarkable.`,
      playerTeam ? `In ${playerTeam.city}, the ${playerTeam.name} finished the season at ${playerTeam.wins}-${playerTeam.losses}. ${playerTeam.wins > playerTeam.losses ? 'A winning record keeps playoff hopes alive.' : 'The front office faces tough decisions this offseason.'}` : '',
      `Around the league, several franchises are eyeing major offseason moves. The draft class is deep, and the free agent market promises to be active.`,
    ].filter(Boolean),
    season,
  };
}

function proceduralOffseasonEvents(franchise) {
  const events = [];
  const quality = franchise.rosterQuality;
  const winPct = franchise.wins / (franchise.wins + franchise.losses || 1);
  const profit = franchise.finances.profit;

  // Always generate 2-4 events
  const eventPool = [
    {
      id: 'community_gala',
      title: 'Community Awards Gala',
      description: `The ${franchise.city} ${franchise.name} have been invited to host the annual community awards gala. This is an opportunity to boost community relations.`,
      choices: [
        { label: 'Host a lavish event', cost: 3, communityBonus: 8, mediaBonus: 3 },
        { label: 'Modest gathering', cost: 1, communityBonus: 3, mediaBonus: 1 },
        { label: 'Skip the event', cost: 0, communityBonus: -5, mediaBonus: -3 },
      ],
    },
    {
      id: 'stadium_issue',
      title: 'Stadium Maintenance Report',
      description: `The annual facilities inspection found issues. Your stadium is at ${franchise.stadiumCondition}% condition.`,
      choices: [
        { label: 'Major renovation', cost: 15, stadiumBonus: 20 },
        { label: 'Patch repairs', cost: 5, stadiumBonus: 8 },
        { label: 'Defer maintenance', cost: 0, stadiumBonus: -5 },
      ],
    },
    {
      id: 'free_agent_pitch',
      title: 'Star Free Agent Interest',
      description: `A top free agent is considering ${franchise.city}. Your reputation and facilities could seal the deal.`,
      choices: [
        { label: 'Full court press', cost: 2, signingBonus: true },
        { label: 'Standard pitch', cost: 0, signingBonus: false },
      ],
    },
    {
      id: 'sponsorship_offer',
      title: 'New Sponsorship Opportunity',
      description: `A major corporation wants to partner with the ${franchise.name}. The deal is worth $${Math.round(franchise.market * 0.08)}M.`,
      choices: [
        { label: 'Accept the deal', revenue: Math.round(franchise.market * 0.08), mediaBonus: 2 },
        { label: 'Negotiate harder', revenue: Math.round(franchise.market * 0.12), risk: 0.4 },
        { label: 'Decline', revenue: 0, mediaBonus: 0 },
      ],
    },
    {
      id: 'youth_academy',
      title: 'Youth Development Program',
      description: `The city wants to establish a youth sports academy in partnership with the ${franchise.name}.`,
      choices: [
        { label: 'Fund the academy', cost: 5, communityBonus: 12, scoutingBonus: 1 },
        { label: 'Partial support', cost: 2, communityBonus: 5 },
        { label: 'Pass', cost: 0, communityBonus: -2 },
      ],
    },
    {
      id: 'coaching_clinic',
      title: 'Coaching Staff Development',
      description: `Coach ${franchise.coach.name} is requesting additional resources for staff development.`,
      choices: [
        { label: 'Invest in coaching', cost: 4, coachBonus: true },
        { label: 'Maintain current level', cost: 0 },
      ],
    },
  ];

  // Select 2-4 events based on context
  const shuffled = eventPool.sort(() => Math.random() - 0.5);
  const count = 2 + Math.floor(Math.random() * 2);
  return shuffled.slice(0, count);
}

// ============================================================
// PUBLIC API — Uses Claude when available, falls back to procedural
// ============================================================
export async function generateSeasonRecap(franchise) {
  if (hasNarrativeApi()) {
    const prompt = `You are a sports journalist. Write a 3-sentence season recap for the ${franchise.city} ${franchise.name} who went ${franchise.wins}-${franchise.losses} this season. Their roster quality is ${franchise.rosterQuality}/100, fan rating is ${franchise.fanRating}/100, and they made $${franchise.finances.profit}M profit. Keep it punchy and broadcast-style. No preamble — just the recap.`;
    const result = await callClaude(prompt, 300);
    if (result) return result;
  }
  return proceduralSeasonRecap(franchise);
}

export async function generateGMForecast(franchise) {
  if (hasNarrativeApi()) {
    const prompt = `You are a GM advisor for a sports franchise. The ${franchise.city} ${franchise.name} have a roster quality of ${franchise.rosterQuality}/100, fan rating ${franchise.fanRating}/100, cap space $${Math.round(franchise.capSpace || 0)}M, and chemistry ${franchise.lockerRoomChemistry}/100. Give a 2-sentence preseason forecast: projected finish and key risk. Be direct and specific.`;
    const result = await callClaude(prompt, 200);
    if (result) return result;
  }
  return proceduralGMForecast(franchise);
}

export async function generateGMGrade(franchise) {
  if (hasNarrativeApi()) {
    const prompt = `Grade this GM's season (A through F) for the ${franchise.city} ${franchise.name}: Record ${franchise.wins}-${franchise.losses}, profit $${franchise.finances.profit}M, fan rating ${franchise.fanRating}/100, chemistry ${franchise.lockerRoomChemistry}/100. Return ONLY a JSON object: {"grade":"X","analysis":"one sentence"}`;
    const result = await callClaude(prompt, 200);
    if (result) {
      try {
        return JSON.parse(result.replace(/```json|```/g, '').trim());
      } catch { /* fall through */ }
    }
  }
  return proceduralGMGrade(franchise);
}

export async function generateDynastyNarrative(franchise) {
  if (hasNarrativeApi() && franchise.history.length >= 3) {
    const recentHistory = franchise.history.slice(-3).map(h => `Season ${h.season}: ${h.wins}-${h.losses}`).join(', ');
    const prompt = `Name a 3-season era for the ${franchise.city} ${franchise.name}. Recent results: ${recentHistory}. Championships: ${franchise.championships}. Return ONLY JSON: {"era":"The [Name] Era","narrative":"3-4 sentences describing this period"}`;
    const result = await callClaude(prompt, 300);
    if (result) {
      try {
        return JSON.parse(result.replace(/```json|```/g, '').trim());
      } catch { /* fall through */ }
    }
  }
  return proceduralDynastyNarrative(franchise);
}

export async function generateLeagueNewspaper(standings, playerFranchises, season) {
  // Always use procedural for now — newspaper is complex
  // Claude enhancement can be added layer
  return proceduralLeagueNewspaper(standings, playerFranchises, season);
}

export async function generateOffseasonEvents(franchise) {
  if (hasNarrativeApi()) {
    const prompt = `Generate 3 offseason events for the ${franchise.city} ${franchise.name} (${franchise.wins}-${franchise.losses}, $${franchise.finances.profit}M profit, fan rating ${franchise.fanRating}/100). Return ONLY a JSON array of objects, each with: id (string), title (string), description (string), choices (array of {label, cost?, communityBonus?, mediaBonus?, stadiumBonus?, revenue?}). Make events contextually appropriate to the team's situation. No markdown or preamble.`;
    const result = await callClaude(prompt, 800);
    if (result) {
      try {
        const events = JSON.parse(result.replace(/```json|```/g, '').trim());
        if (Array.isArray(events) && events.length > 0) return events;
      } catch { /* fall through */ }
    }
  }
  return proceduralOffseasonEvents(franchise);
}
