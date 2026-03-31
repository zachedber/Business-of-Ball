// src/lib/economy/index.js — Finances, debt, valuation, sponsorships, naming rights, CBA
//
// Re-exports economy/finance functions from existing engine modules.

/**
 * Prepends a log entry to franchise.frontOfficeLog, capping at 200 entries.
 * Auto-generates entry.id if not provided.
 * @param {Object} franchise - Current franchise state
 * @param {import('@/lib/engine/events').LogEntry} entry - Log entry (id optional)
 * @returns {Object} Updated franchise with new frontOfficeLog
 */
export function appendLogEntry(franchise, entry) {
  const id = entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const full = { ...entry, id };
  const prev = Array.isArray(franchise.frontOfficeLog) ? franchise.frontOfficeLog : [];
  return { ...franchise, frontOfficeLog: [full, ...prev].slice(0, 200) };
}

// Finance module — debt, revenue, valuation, cap space, stakes
export {
  calculateDynamicInterestRate,
  calculateDebtPayment,
  buildMandatoryDebt,
  applyDebtPenalty,
  calculateMatchdayRevenue,
  calculateFacilityUpkeep,
  calcAttendance,
  projectRevenue,
  calculateValuation,
  getFranchiseAskingPrice,
  getFranchiseFlavor,
  calculateCapSpace,
  calculateAdjustedCap,
  maxLoan,
  takeLoan,
  repayDebt,
  generateStakeOffers,
  calcStakeIncome,
  calcStakeValue,
  generateTVDealEvent,
  canAfford,
  formatMoney,
  formatFullDollars,
  calculateEndSeasonFinances,
} from '@/lib/engine/finance';

// Owner Report — post-season analysis
export { buildOwnerReport } from './ownerReport';

// Naming rights and CBA events from events module
export {
  generateNamingRightsOffer,
  acceptNamingRights,
  generateNewStadiumNamingRightsOffer,
  generateCBAEvent,
  generateSponsorDeal,
} from '@/lib/engine/events';
