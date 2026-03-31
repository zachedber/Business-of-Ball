// src/lib/economy/index.js — Finances, debt, valuation, sponsorships, naming rights, CBA
//
// Re-exports economy/finance functions from existing engine modules.

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
