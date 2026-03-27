// src/lib/events.ts — Random player events
import type { Franchise, PlayerEvent, Quarter } from './types';
// @ts-ignore — JS module without types
import { charityEvents, dramaEvents, criminalEvents, breakoutHeadlines } from '@/data/eventFlavor';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function rand(a: number, b: number): number {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

/**
 * Rolls random player events for the given quarter.
 * Each player rolls once based on their trait.
 * Effects are applied immediately to the franchise and clamped 0-100.
 */
export function rollPlayerEvents(
  franchise: Franchise,
  season: number,
  quarter: Quarter
): PlayerEvent[] {
  const events: PlayerEvent[] = [];
  const players = franchise.players || [];

  for (const player of players) {
    const trait = player.trait;

    // Determine probabilities based on trait
    let charityProb = 0.03; // base
    let dramaProb = 0.02;   // base
    let criminalProb = 0.01; // base

    switch (trait) {
      case 'volatile':
        charityProb = 0.03;
        dramaProb = 0.15;
        criminalProb = 0.05;
        break;
      case 'showman':
        charityProb = 0.10;
        dramaProb = 0.08;
        criminalProb = 0.01;
        break;
      case 'leader':
        charityProb = 0.12;
        dramaProb = 0.02;
        criminalProb = 0.01;
        break;
      case 'clutch':
      case 'mentor':
      case 'iron_man':
        charityProb = 0.03;
        dramaProb = 0.02;
        criminalProb = 0.01;
        break;
      default:
        // null trait or unrecognized
        charityProb = 0.03;
        dramaProb = 0.02;
        criminalProb = 0.01;
        break;
    }

    // Roll for each event type independently
    if (Math.random() < charityProb) {
      const desc = pick(charityEvents as string[]).replace('[PLAYER_NAME]', player.name);
      const effects = {
        communityRating: rand(3, 5),
        lockerRoomChemistry: 2,
        mediaRep: 1,
        fanRating: 1,
      };
      // Apply effects to franchise, clamped 0-100
      franchise.communityRating = clamp((franchise.communityRating || 50) + effects.communityRating, 0, 100);
      franchise.lockerRoomChemistry = clamp((franchise.lockerRoomChemistry || 65) + effects.lockerRoomChemistry, 0, 100);
      franchise.mediaRep = clamp((franchise.mediaRep || 50) + effects.mediaRep, 0, 100);
      franchise.fanRating = clamp((franchise.fanRating || 50) + effects.fanRating, 0, 100);

      events.push({
        type: 'charity',
        playerName: player.name,
        playerId: player.id,
        trait: player.trait,
        description: desc,
        effects,
      });
    }

    if (Math.random() < dramaProb) {
      const desc = pick(dramaEvents as string[]).replace('[PLAYER_NAME]', player.name);
      const effects = {
        communityRating: 0,
        lockerRoomChemistry: -1,
        mediaRep: -4,
        fanRating: -2,
      };
      franchise.lockerRoomChemistry = clamp((franchise.lockerRoomChemistry || 65) + effects.lockerRoomChemistry, 0, 100);
      franchise.mediaRep = clamp((franchise.mediaRep || 50) + effects.mediaRep, 0, 100);
      franchise.fanRating = clamp((franchise.fanRating || 50) + effects.fanRating, 0, 100);

      events.push({
        type: 'social_media_drama',
        playerName: player.name,
        playerId: player.id,
        trait: player.trait,
        description: desc,
        effects,
      });
    }

    if (Math.random() < criminalProb) {
      const desc = pick(criminalEvents as string[]).replace('[PLAYER_NAME]', player.name);
      const effects = {
        communityRating: -5,
        lockerRoomChemistry: -3,
        mediaRep: -15,
        fanRating: -10,
      };
      franchise.communityRating = clamp((franchise.communityRating || 50) + effects.communityRating, 0, 100);
      franchise.lockerRoomChemistry = clamp((franchise.lockerRoomChemistry || 65) + effects.lockerRoomChemistry, 0, 100);
      franchise.mediaRep = clamp((franchise.mediaRep || 50) + effects.mediaRep, 0, 100);
      franchise.fanRating = clamp((franchise.fanRating || 50) + effects.fanRating, 0, 100);

      events.push({
        type: 'criminal',
        playerName: player.name,
        playerId: player.id,
        trait: player.trait,
        description: desc,
        effects,
      });
    }
  }

  // ── Breakout events: only for 'Rising' players in active roster slots ──
  const activeSlotPlayers: any[] = [];
  for (const key of ['star1', 'star2', 'corePiece'] as const) {
    const p = (franchise as any)[key];
    if (p) activeSlotPlayers.push(p);
  }

  for (const player of activeSlotPlayers) {
    if (player.developmentPhase !== 'Rising') continue;

    const potential = player.hiddenPotential || 99;
    const currentRating = player.rating || 50;
    // No room to break out if already at or near ceiling
    if (currentRating >= potential) continue;

    // ~12% chance per eligible player per event roll
    if (Math.random() >= 0.12) continue;

    const maxBoost = potential - currentRating;
    const boost = clamp(rand(2, 4), 1, maxBoost);
    player.rating = clamp(currentRating + boost, 40, potential);

    const headline = pick(breakoutHeadlines as string[]).replace('[PLAYER_NAME]', player.name);
    const desc = `${headline} (+${boost} OVR to ${player.rating})`;

    events.push({
      type: 'breakout' as any,
      severity: 'success' as any,
      playerName: player.name,
      playerId: player.id,
      trait: player.trait,
      description: desc,
      effects: {
        ratingBoost: boost,
        fanRating: 2,
        lockerRoomChemistry: 1,
      },
    });

    // Apply franchise-level effects
    franchise.fanRating = clamp((franchise.fanRating || 50) + 2, 0, 100);
    franchise.lockerRoomChemistry = clamp((franchise.lockerRoomChemistry || 65) + 1, 0, 100);
  }

  return events;
}
