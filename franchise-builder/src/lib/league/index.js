// src/lib/league/index.js — AI teams, AI trade logic, standings, league-wide sim
//
// Re-exports league-wide functions from existing engine and trade modules.

// League initialization and AI team simulation
export {
  initializeLeague,
  createPlayerFranchise,
  simAITeam,
  simulateLeagueQuarter,
  simulateFullSeason,
  simulateFullSeasonFirstHalf,
  simulateFullSeasonSecondHalf,
  simulatePlayoffs,
  simulateAIFreeAgency,
} from '@/lib/engine/simulation';

// AI trade logic and waiver wire
export {
  generateTradeOffers,
  generateWaiverWire,
  generateDraftTradeUpOffers,
} from '@/lib/tradeAI';
