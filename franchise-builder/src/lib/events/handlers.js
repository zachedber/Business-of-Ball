// src/lib/events/handlers.js — Extracted business logic from page.js event handlers
//
// Pure functions that were previously inlined in page.js for event resolution.

import { clamp } from '@/lib/engine/roster';
import { resolveEventChoice } from '@/lib/engine/events';

/**
 * Resolves an offseason event choice and returns the updated franchise.
 * Handles both the franchise mutation via resolveEventChoice and the
 * GM rep delta for pressure events.
 * Extracted from handleResolve in page.js.
 * @param {Object} franchise - Current franchise state
 * @param {Object} event - The event being resolved
 * @param {Object} choice - The selected choice
 * @returns {Object} Updated franchise
 */
export function resolveOffseasonEvent(franchise, event, choice) {
  return resolveEventChoice(franchise, event, choice);
}

/**
 * Calculates new GM reputation after resolving a pressure event.
 * @param {number} gmRep - Current GM reputation
 * @param {Object} event - The event with optional gmRepDelta
 * @returns {number} New GM reputation
 */
export function getGMRepAfterEvent(gmRep, event) {
  if (event.type === 'pressure' && event.gmRepDelta) {
    return clamp(gmRep + event.gmRepDelta, 0, 100);
  }
  return gmRep;
}

/**
 * Resolves a press conference option and returns the updated franchise.
 * Extracted from handlePressConf in page.js.
 * @param {Object} franchise - Current franchise state
 * @param {Object} option - The selected press conference option
 * @returns {Object} Updated franchise
 */
export function resolvePressConference(franchise, option) {
  let updated = { ...franchise };

  // Phase 3A: mediaPressureIndex scales fan and media impact (1–10 scale → 0.5–1.5x multiplier)
  const mpi = updated.franchiseIdentity?.mediaPressureIndex ?? 5;
  const pressureScale = 0.5 + (mpi / 10); // mpi=1 → 0.6x, mpi=5 → 1.0x, mpi=10 → 1.5x

  if (option.fanBonus) {
    const scaled = Math.round(option.fanBonus * pressureScale);
    updated.fanRating = clamp(updated.fanRating + scaled, 0, 100);
  }
  if (option.mediaBonus) {
    const scaled = Math.round(option.mediaBonus * pressureScale);
    updated.mediaRep = clamp((updated.mediaRep || 50) + scaled, 0, 100);
  }
  if (option.communityBonus) {
    updated.communityRating = clamp(
      (updated.communityRating || 50) + option.communityBonus, 0, 100
    );
    // communityBonus is NOT scaled by mediaPressureIndex — community impact is independent of media
  }
  if (option.moraleBonus) {
    updated.players = (updated.players || []).map(p => ({
      ...p,
      morale: clamp(p.morale + option.moraleBonus, 0, 100),
    }));
    // moraleBonus is NOT scaled — locker room dynamics are independent of media pressure
  }
  return updated;
}
