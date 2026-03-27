// src/lib/economy/handlers.js — Extracted business logic from page.js event handlers
//
// Pure functions that were previously inlined in page.js.
// These handle CBA resolution and leveraged purchase application.

import { clamp, r1 } from '@/lib/engine/roster';

/**
 * Applies leveraged purchase options to a newly created franchise.
 * Extracted from handleCreate in page.js.
 * @param {Object} franchise - Newly created franchise
 * @param {Object} leverageOptions - { leveraged, loanAmount, interestRate, termSeasons, seasonalPayment }
 * @returns {Object} Updated franchise with debt applied
 */
export function applyLeveragedPurchase(franchise, leverageOptions) {
  if (!leverageOptions?.leveraged) return franchise;
  return {
    ...franchise,
    debt: leverageOptions.loanAmount,
    debtObject: {
      principal: leverageOptions.loanAmount,
      interestRate: leverageOptions.interestRate,
      termSeasons: leverageOptions.termSeasons,
      seasonalPayment: leverageOptions.seasonalPayment,
      gmRep: 50,
      consecutiveMissedPayments: 0,
    },
  };
}

/**
 * Resolves a CBA event choice and returns the updated franchise.
 * Extracted from handleCBA in page.js.
 * @param {Object} franchise - Current franchise state
 * @param {Object} choice - The selected CBA choice
 * @returns {Object} Updated franchise
 */
export function applyCBAChoice(franchise, choice) {
  let updated = { ...franchise };
  if (choice.moraleBonus) {
    updated.players = (updated.players || []).map(p => ({
      ...p,
      morale: clamp(p.morale + choice.moraleBonus, 0, 100),
    }));
  }
  if (choice.revenuePenalty) {
    updated.cash = r1((updated.cash || 0) + (choice.revenuePenalty || 0));
  }
  return updated;
}

/**
 * Checks if a CBA strike occurs based on choice risk.
 * @param {Object} choice - CBA choice with optional strikeRisk
 * @returns {boolean} True if a strike occurs
 */
export function rollCBAStrike(choice) {
  return choice.strikeRisk && Math.random() < choice.strikeRisk;
}
