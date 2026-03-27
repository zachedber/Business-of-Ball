// src/lib/league/handlers.js — Extracted business logic from page.js
//
// Pure functions for trade acceptance, waiver wire signing, and
// draft trade-up processing that were previously inlined in JSX callbacks.

import { r1 } from '@/lib/engine/roster';

/**
 * Processes a trade deadline trade acceptance (buy or sell).
 * Extracted from onAcceptTrade in the TradeDeadlineScreen render of page.js.
 *
 * @param {Object} franchise - Current franchise state
 * @param {Object} offer - Trade offer object
 * @returns {Object} Updated franchise state
 */
export function processTradeAcceptance(franchise, offer) {
  let updated = { ...franchise };

  // Handle Buy Offers (AI wants your player)
  if (offer.type === 'buy' && offer.playerWanted) {
    if (updated.star1?.id === offer.playerWanted.id) updated.star1 = null;
    else if (updated.star2?.id === offer.playerWanted.id) updated.star2 = null;
    else if (updated.corePiece?.id === offer.playerWanted.id) updated.corePiece = null;

    // Handle salary retention dead cap
    if (offer.salaryRetention > 0) {
      const retainedAmount = r1(offer.playerWanted.salary * 0.5);
      updated.deferredDeadCap = (updated.deferredDeadCap || 0) + retainedAmount;
    }
  }

  // Handle Sell Offers (AI offers you a player)
  if (offer.type === 'sell' && offer.playerOffered) {
    const emptySlot = !updated.star1 ? 'star1' : !updated.star2 ? 'star2' : !updated.corePiece ? 'corePiece' : null;
    if (emptySlot) updated[emptySlot] = offer.playerOffered;
  }

  // Add draft picks to inventory
  if (offer.draftCompensation?.length > 0) {
    updated.draftPickInventory = [...(updated.draftPickInventory || []), ...offer.draftCompensation];
  }

  // Update derived roster stats
  updated.players = [updated.star1, updated.star2, updated.corePiece].filter(Boolean);
  updated.totalSalary = r1(updated.players.reduce((s, p) => s + p.salary, 0));
  return updated;
}

/**
 * Signs a waiver wire player to the first empty roster slot.
 * Extracted from onSignWaiver in page.js.
 *
 * @param {Object} franchise - Current franchise state
 * @param {Object} player - Waiver wire player to sign
 * @returns {Object|null} Updated franchise, or null if no empty slot
 */
export function processWaiverSigning(franchise, player) {
  const slotKey = !franchise.star1 ? 'star1' : !franchise.star2 ? 'star2' : !franchise.corePiece ? 'corePiece' : null;
  if (!slotKey) return null;
  const updated = { ...franchise, [slotKey]: player };
  updated.players = [updated.star1, updated.star2, updated.corePiece].filter(Boolean);
  updated.totalSalary = r1(updated.players.reduce((s, p) => s + p.salary, 0));
  return updated;
}

/**
 * Processes a draft trade-up acceptance — adds draft compensation to franchise.
 * Extracted from onAcceptTradeUp in page.js.
 *
 * @param {Object} franchise - Current franchise state
 * @param {Object} offer - Trade-up offer
 * @returns {Object} Updated franchise with new draft picks
 */
export function processDraftTradeUp(franchise, offer) {
  if (!offer.draftCompensation?.length) return franchise;
  return {
    ...franchise,
    draftPickInventory: [...(franchise.draftPickInventory || []), ...offer.draftCompensation],
  };
}
