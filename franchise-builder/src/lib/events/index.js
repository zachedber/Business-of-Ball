// src/lib/events/index.js — Press conferences, rivalry events, media moments, newspaper
//
// Re-exports event-related functions from existing engine modules.

// Player events (random quarter events — charity, drama, criminal, breakout)
export { rollPlayerEvents } from './playerEvents';

// GM reputation system
export {
  GM_TIERS,
  getGMTier,
  updateGMReputation,
} from '@/lib/engine/events';

// Press conferences
export {
  genPressConference,
} from '@/lib/engine/events';

// Rivalry system
export {
  genRivalryEvent,
  initHeadToHead,
  updateHeadToHead,
  initRivalry,
  updateRivalry,
  getRivalryTier,
  getRivalryPlayoffNarrative,
} from '@/lib/engine/events';

// Newspaper and notifications
export {
  generateNewspaper,
  generateNotifications,
} from '@/lib/engine/events';

// Owner/media pressure
export {
  checkPressureEvent,
} from '@/lib/engine/events';

// Event resolution
export {
  resolveEventChoice,
} from '@/lib/engine/events';

// Stadium system
export {
  applyStadiumUpgrade,
  generateConstructionEvent,
  startStadiumProject,
  calculatePublicFundingApproval,
  advanceStadiumProject,
  purchasePremiumSeating,
} from '@/lib/engine/events';

// City economy
export {
  updateCityEconomy,
} from '@/lib/engine/events';

// League history, franchise records, Hall of Fame
export {
  initLeagueHistory,
  addChampion,
  checkNotableSeasons,
  initFranchiseRecords,
  updateFranchiseRecords,
  evaluateHallOfFame,
} from '@/lib/engine/events';

// Naming rights, CBA (also available from economy/)
export {
  generateNamingRightsOffer,
  acceptNamingRights,
  generateNewStadiumNamingRightsOffer,
  generateCBAEvent,
  generateSponsorDeal,
} from '@/lib/engine/events';
