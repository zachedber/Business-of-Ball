// src/lib/simulation/index.js — Season engine, game resolution, standings, score outcomes
//
// Re-exports simulation functions from the existing engine modules.
// Does NOT rewrite logic — just provides a domain-specific entry point.

export {
  predictDev,
  simAITeam,
  simPlayerSeason,
  simQuarter,
  simulateLeagueQuarter,
  simulateFullSeason,
  simulateFullSeasonFirstHalf,
  simulateFullSeasonSecondHalf,
  simPlayerSeasonFirstHalf,
  simPlayerSeasonSecondHalf,
  simulatePlayoffs,
  simulateAIFreeAgency,
  initializeLeague,
  createPlayerFranchise,
} from '@/lib/engine/simulation';
