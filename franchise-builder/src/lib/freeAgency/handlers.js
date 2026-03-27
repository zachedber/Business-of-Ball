// src/lib/freeAgency/handlers.js — Extracted business logic from page.js
//
// Handles the post-draft → free agency transition logic that was
// previously inlined in handleDraftDone.

import { generateOffseasonFAPool } from '@/lib/engine/roster';
import { simulateAIFreeAgency } from '@/lib/engine/simulation';

/**
 * Prepares the offseason free agent pool after the draft.
 * If a pool already exists (from a previous call), reuses it.
 * Otherwise generates a fresh pool and simulates AI bidding.
 * Extracted from handleDraftDone in page.js.
 *
 * @param {Object} params
 * @param {string} params.league - 'ngl' or 'abl'
 * @param {number} params.gmRep - Current GM reputation
 * @param {Object[]} params.existingPool - Previously generated FA pool (or empty)
 * @param {Object[]} params.existingAILog - Previous AI signings log (or empty)
 * @param {Object} params.leagueTeams - { ngl: [], abl: [] }
 * @returns {{ playerPool: Object[], aiSigned: Object[] }}
 */
export function prepareOffseasonFAPool({ league, gmRep, existingPool, existingAILog, leagueTeams }) {
  if (existingPool && existingPool.length > 0) {
    return { playerPool: existingPool, aiSigned: existingAILog || [] };
  }
  const fullPool = generateOffseasonFAPool(league, gmRep, 18);
  const result = simulateAIFreeAgency(fullPool, leagueTeams || { ngl: [], abl: [] }, league);
  return { playerPool: result.remaining, aiSigned: result.signed };
}

/**
 * Checks whether a franchise needs the slot decision screen
 * (vacant slots with available candidates from taxi/rookie pools).
 * Extracted from handleDraftDone in page.js.
 *
 * @param {Object} franchise - Active franchise
 * @returns {boolean} True if slot decision screen should show
 */
export function needsSlotDecision(franchise) {
  const hasCandidates = (franchise.taxiSquad || []).length > 0 ||
    (franchise.rookieSlots || []).length > 0 ||
    franchise.players.length > 0;
  const hasVacantSlot = !franchise.star1 || !franchise.star2 || !franchise.corePiece;
  return hasVacantSlot && hasCandidates;
}
