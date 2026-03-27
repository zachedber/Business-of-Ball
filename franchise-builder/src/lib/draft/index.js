// src/lib/draft/index.js — Prospect generation, scouting, combine, selection logic
//
// Re-exports draft-related functions from existing engine modules.

export {
  generateDraftProspects,
  draftPlayer,
  generateDraftPickPositions,
  initDraftPickInventory,
  generatePickTradeOffer,
  evaluatePickTrade,
  generateDraftTradePartners,
  processDraftSelection,
} from '@/lib/engine/roster';
