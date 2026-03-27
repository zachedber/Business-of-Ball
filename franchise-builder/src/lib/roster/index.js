// src/lib/roster/index.js — Player contracts, chemistry, morale, injury, waiver wire
//
// Re-exports roster, coaching, and injury functions from existing engine modules.

// Utils (shared across the codebase)
export {
  rand,
  randFloat,
  pick,
  clamp,
  generateId,
  r1,
} from '@/lib/engine/roster';

// Player generation and rating systems
export {
  PLAYER_RATING_RANGES,
  generateTieredRating,
  determineDevelopmentPhase,
  generateHiddenPotential,
  generateTrait,
  formatLabel,
  generatePlayer,
  generateRoster,
  generatePlayerName,
  generateCoachName,
} from '@/lib/engine/roster';

// 3-slot roster system
export {
  SLOT_BUDGET,
  repCostMultiplier,
  calcSlotQuality,
  calcDepthQuality,
  generateSlotPlayer,
  generateInitialSlots,
  signToSlot,
  releaseSlot,
} from '@/lib/engine/roster';

// Coaching carousel and staff
export {
  generateCoach,
  generateCoachCandidates,
  fireCoach,
  hireCoach,
  generateOC,
  generateDC,
  generatePDC,
  generateStaffCandidates,
  fireCoordinator,
  hireCoordinator,
  calculateSchemeFit,
  updateStaffChemistry,
} from '@/lib/engine/roster';

// Aging, extensions, and contracts
export {
  endOfSeasonAging,
  applyExtension,
  processDraftSelection,
  generateExtensionDemands,
} from '@/lib/engine/roster';

// Injuries
export {
  predictInjury,
  rollForInjuries,
  processQuarterInjuries,
  rollSeasonInjuries,
} from '@/lib/engine/injuries';

// Player events (random quarter events)
export { rollPlayerEvents } from '@/lib/events/playerEvents';
