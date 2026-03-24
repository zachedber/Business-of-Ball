// src/lib/tradeAI.ts — AI Trade Logic and Waiver Wire
import type { Franchise, TradeOffer, Player, DraftPick, League } from './types';

function rand(a: number, b: number): number {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// @ts-ignore
import { generatePlayerName } from '@/data/names';
// @ts-ignore
import { NGL_POSITIONS, ABL_POSITIONS, NGL_SALARY_CAP, ABL_SALARY_CAP, NGL_ROSTER_SIZE, ABL_ROSTER_SIZE } from '@/data/leagues';

function playerValue(p: Player): number {
  return (p.rating - 60) * 0.5 + (p.age < 28 ? 3 : p.age < 32 ? 0 : -3);
}

function pickValue(round: number): number {
  return round === 1 ? 10 : round === 2 ? 5 : 2;
}

/**
 * Generates 2-4 trade offers from AI teams at the trade deadline.
 */
export function generateTradeOffers(
  franchise: Franchise,
  leagueTeams: { ngl: any[]; abl: any[] },
  season: number
): TradeOffer[] {
  const league = franchise.league;
  const allTeams = (leagueTeams[league] || []).filter((t: any) => !t.isPlayerOwned && t.id !== franchise.id);
  const offers: TradeOffer[] = [];

  // Get player's tradeable players (slots with rating >= 0)
  const playerSlots: { key: string; player: Player }[] = [];
  for (const key of ['star1', 'star2', 'corePiece'] as const) {
    const p = (franchise as any)[key];
    if (p) playerSlots.push({ key, player: p });
  }

  for (const team of allTeams) {
    if (offers.length >= 4) break;

    const totalGames = Math.max(1, (team.wins || 0) + (team.losses || 0));
    const teamWP = (team.wins || 0) / totalGames;

    // Buyers (win% > 0.600): want player's high-rated veterans
    if (teamWP > 0.600) {
      const targets = playerSlots.filter(s => s.player.rating >= 75);
      if (targets.length === 0) continue;
      const target = pick(targets);
      const pVal = playerValue(target.player);
      const draftRound = pVal > 8 ? 1 : pVal > 5 ? 2 : 3;
      const draftPick: DraftPick = {
        id: generateId(),
        round: draftRound,
        season: season + 1,
        originalTeam: team.id,
        isFuture: true,
      };

      offers.push({
        id: generateId(),
        type: 'buy',
        aiTeam: { id: team.id, city: team.city, name: team.name, wins: team.wins, losses: team.losses },
        playerOffered: null,
        playerWanted: target.player,
        draftCompensation: [draftPick],
        cashComponent: rand(2, 6),
        salaryRetention: 0,
        retentionBoost: 0,
      });
    }

    // Sellers (win% < 0.400): offer their veterans to the player
    if (teamWP < 0.400) {
      const teamPlayers: any[] = (team.players || []).filter((p: any) => p.rating >= 65);
      if (teamPlayers.length === 0) continue;
      const offered: any = pick(teamPlayers);
      const emptySlots = ['star1', 'star2', 'corePiece'].filter(k => !(franchise as any)[k]);
      if (emptySlots.length === 0) continue;

      offers.push({
        id: generateId(),
        type: 'sell',
        aiTeam: { id: team.id, city: team.city, name: team.name, wins: team.wins, losses: team.losses },
        playerOffered: {
          id: offered.id,
          name: offered.name,
          position: offered.position,
          age: offered.age,
          rating: offered.rating,
          salary: offered.salary,
          yearsLeft: offered.yearsLeft || 2,
          seasonsPlayed: offered.seasonsPlayed || 3,
          seasonsWithTeam: 0,
          morale: offered.morale || 70,
          trait: offered.trait || null,
          injured: false,
          injurySeverity: null,
          gamesOut: 0,
          isLocalLegend: false,
          isRookie: false,
          isDrafted: false,
        },
        playerWanted: null,
        draftCompensation: [],
        cashComponent: -rand(1, 3), // Player pays cash
        salaryRetention: 0,
        retentionBoost: 0,
      });
    }
  }

  // Ensure at least 2 offers
  while (offers.length < 2 && allTeams.length > 0) {
    const team = pick(allTeams);
    offers.push({
      id: generateId(),
      type: 'sell',
      aiTeam: { id: team.id, city: team.city, name: team.name, wins: team.wins || 0, losses: team.losses || 0 },
      playerOffered: null,
      playerWanted: null,
      draftCompensation: [{
        id: generateId(),
        round: rand(2, 4),
        season: season + 1,
        originalTeam: team.id,
        isFuture: true,
      }],
      cashComponent: rand(1, 4),
      salaryRetention: 0,
      retentionBoost: 0,
    });
  }

  return offers.slice(0, 4);
}

/**
 * Generates a waiver wire pool of 8-10 players.
 */
export function generateWaiverWire(league: League): Player[] {
  const pos = league === 'ngl' ? NGL_POSITIONS : ABL_POSITIONS;
  const cap = league === 'ngl' ? NGL_SALARY_CAP : ABL_SALARY_CAP;
  const rosterSize = league === 'ngl' ? NGL_ROSTER_SIZE : ABL_ROSTER_SIZE;
  const minSalary = r1(cap / rosterSize * 0.3);
  const count = rand(8, 10);

  return Array.from({ length: count }, () => {
    const position = pick(pos);
    const rating = rand(60, 70);
    const age = rand(24, 32);
    return {
      id: generateId(),
      name: generatePlayerName(),
      position,
      age,
      rating,
      salary: minSalary,
      yearsLeft: rand(1, 2),
      seasonsPlayed: Math.max(1, age - 22),
      seasonsWithTeam: 0,
      morale: rand(55, 75),
      trait: null,
      injured: false,
      injurySeverity: null,
      gamesOut: 0,
      isLocalLegend: false,
      isRookie: false,
      isDrafted: false,
    } as Player;
  }).sort((a, b) => b.rating - a.rating);
}

/**
 * Generates 0-2 draft trade-up offers during the draft.
 */
export function generateDraftTradeUpOffers(
  franchise: Franchise,
  leagueTeams: { ngl: any[]; abl: any[] },
  remainingProspects: any[],
  currentPick: any
): TradeOffer[] {
  if (!remainingProspects || remainingProspects.length === 0) return [];

  const league = franchise.league;
  const allTeams = (leagueTeams[league] || []).filter((t: any) => !t.isPlayerOwned);
  if (allTeams.length === 0) return [];

  const offers: TradeOffer[] = [];
  const bestProspect = remainingProspects[0];
  const midpoint = bestProspect.projectedRange
    ? (bestProspect.projectedRange.low + bestProspect.projectedRange.high) / 2
    : bestProspect.projectedRating || 70;

  const numOffers = midpoint >= 75 ? rand(1, 2) : midpoint >= 65 ? rand(0, 1) : 0;

  for (let i = 0; i < numOffers && i < allTeams.length; i++) {
    const team = allTeams[i];
    const cashOffer = midpoint >= 75 ? rand(3, 8) : rand(1, 4);
    const draftRound = midpoint >= 75 ? 1 : 2;

    offers.push({
      id: generateId(),
      type: 'buy',
      aiTeam: { id: team.id, city: team.city, name: team.name, wins: team.wins || 0, losses: team.losses || 0 },
      playerOffered: null,
      playerWanted: null,
      draftCompensation: [{
        id: generateId(),
        round: draftRound,
        season: (franchise.season || 1) + 1,
        originalTeam: team.id,
        isFuture: true,
      }],
      cashComponent: cashOffer,
      salaryRetention: 0,
      retentionBoost: 0,
    });
  }

  return offers;
}
