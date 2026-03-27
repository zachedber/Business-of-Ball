// src/lib/freeAgency/index.js — Bidding logic, FA pool generation, preference scoring
//
// Re-exports free agency functions from existing engine modules.

export {
  generateFreeAgents,
  generateDeadlineFreeAgents,
  generateOffseasonFAPool,
} from '@/lib/engine/roster';

export {
  simulateAIFreeAgency,
} from '@/lib/engine/simulation';
