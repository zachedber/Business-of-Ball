import { initLeagueHistory } from '@/lib/engine';

const DEFAULT_FEATURES = {
  debt: 0,
  debtInterestRate: 0.08,
  debtObject: null,
  pricing: {
    ticketPrice: 80,
    concessionsPrice: 15,
    merchPrice: 40,
    parkingPrice: 25,
  },
  investments: {
    sportsScienceDept: 0,
    advancedScouting: 0,
    globalMarketing: 0,
    recoveryCenter: false,
    privateJetFleet: false,
    nutritionStaff: false,
    stadiumDistrict: 0,
    overseasStakes: 0,
  },
  facilityMaintenance: 1,
};

function normalizeFranchiseState(franchise) {
  const safe = franchise && typeof franchise === 'object' ? { ...franchise } : {};
  const basePricing = { ...DEFAULT_FEATURES.pricing, ...(safe.pricing || {}) };
  const investments = safe.investments || {};
  return {
    ...DEFAULT_FEATURES,
    ...safe,
    pricing: basePricing,
    investments: {
      ...DEFAULT_FEATURES.investments,
      ...investments,
      overseasStakes: Array.isArray(investments.overseasStakes)
        ? investments.overseasStakes.length
        : Math.max(0, Number(investments.overseasStakes) || 0),
    },
    debtObject: safe.debtObject ?? safe.debtDetails ?? null,
  };
}

// ─────────────────────────────────────────────────────────────
// INITIAL STATE
// Mirrors every useState initial value from App().
// ─────────────────────────────────────────────────────────────
export const initialState = {
  // Routing
  screen: 'intro',
  loading: true,

  // Financial & identity
  cash: 0,
  gmRep: 50,
  dynasty: [],

  // Core game
  lt: null,
  fr: [],
  stakes: [],
  season: 1,
  freeAg: { ngl: [], abl: [] },
  activeIdx: 0,

  // Simulation
  simming: false,
  tradeDeadlineActive: false,
  tradeDeadlineLeague: null,

  // Playoff
  playoffActive: false,
  playoffResult: null,
  aiSigningsLog: [],

  // Draft & free agency flow
  draftActive: false,
  draftPicks: [],
  draftProspects: [],
  draftDone: false,
  freeAgencyActive: false,
  offseasonFAPool: [],
  slotDecisionActive: false,

  // UI / events
  notifications: [],
  recap: null,
  grade: null,
  events: [],
  pressConf: null,
  newspaper: null,
  newspaperDismissed: true,
  cbaEvent: null,
  namingOffer: null,
  saveStatus: 'saved',
  helpOpen: false,
  leagueHistory: initLeagueHistory(),
  rosterFullAlert: null,

  // V4 quarterly flow
  trainingCampActive: false,
  quarterPhase: 0, // 0 = not simming, 1-4 = quarter completed
  q1PauseActive: false, // Pause after Q1 for mid-quarter review
  q3PauseActive: false, // Pause after Q3 for waiver/roster adjustments
  playerEvents: [],
  waiverWireActive: false,
  waiverPool: [],
  tradeOffers: [],
  gameOverForced: false,
};

// ─────────────────────────────────────────────────────────────
// REDUCER
// ─────────────────────────────────────────────────────────────

/**
 * gameReducer(state, action)
 *
 * Action types:
 *
 * LOAD_SAVE            — Restores full saved state from localStorage.
 *                        payload: the saved state object from loadGame()
 *
 * FINISH_LOADING       — Marks loading complete when no save is found.
 *                        payload: (none)
 *
 * SET_SCREEN           — Changes the active screen.
 *                        payload: screen name string
 *
 * CREATE_FRANCHISE     — Initialises lt, fr, stakes, season after
 *                        the player picks a franchise.
 *                        payload: { lt, frArray, cash, events, freeAg }
 *
 * SET_FRANCHISE        — Replaces the entire fr array (covers all
 *                        franchise mutations). Also auto-syncs cash
 *                        from fr[activeIdx].cash.
 *                        payload: new fr array  OR  updater function (fr => fr)
 *
 * SET_LEAGUE_TEAMS     — Replaces the lt object.
 *                        payload: new lt object
 *
 * SET_CASH             — Updates cash AND syncs fr[activeIdx].cash
 *                        atomically — the single source of truth for cash.
 *                        payload: new cash number
 *
 * SET_GM_REP           — Updates gmRep.
 *                        payload: new gmRep number
 *
 * SET_SEASON           — Sets season to a specific value.
 *                        payload: new season number
 *
 * SET_STAKES           — Replaces the stakes array.
 *                        payload: new stakes array
 *
 * SET_FREE_AG          — Replaces the freeAg pool.
 *                        payload: { ngl, abl } object
 *
 * SET_DYNASTY          — Replaces the dynasty history array.
 *                        payload: new dynasty array
 *
 * SET_LEAGUE_HISTORY   — Replaces leagueHistory.
 *                        payload: new leagueHistory object
 *
 * BEGIN_SIM            — Sets simming = true.
 *                        payload: (none)
 *
 * END_SIM              — Sets simming = false.
 *                        payload: (none)
 *
 * TRADE_DEADLINE_OPEN  — Opens trade deadline, stores league snapshot,
 *                        clears simming.
 *                        payload: leagueTeams snapshot
 *
 * TRADE_DEADLINE_CLOSE — Closes trade deadline UI.
 *                        payload: (none)
 *
 * PLAYOFF_OPEN         — Opens playoff bracket UI, clears simming.
 *                        payload: { playoffResult, tradeDeadlineLeague }
 *
 * PLAYOFF_CLOSE        — Closes playoff bracket UI.
 *                        payload: (none)
 *
 * DRAFT_OPEN           — Opens draft UI with picks and prospects.
 *                        payload: { draftPicks, draftProspects }
 *
 * DRAFT_CLOSE          — Closes draft UI and marks draftDone = true.
 *                        payload: (none)
 *
 * FA_OPEN              — Opens free agency UI with pool and AI log.
 *                        payload: { offseasonFAPool, aiSigningsLog }
 *
 * FA_CLOSE             — Closes free agency UI and resets draftDone.
 *                        payload: (none)
 *
 * SET_EVENTS           — Replaces the events array.
 *                        payload: new events array
 *
 * SET_RECAP            — Sets recap narrative and grade together.
 *                        payload: { recap, grade }
 *
 * SET_NEWSPAPER        — Sets newspaper content and dismissed flag.
 *                        payload: { newspaper, newspaperDismissed }
 *
 * SET_PRESS_CONF       — Sets or clears the press conference array.
 *                        payload: pressConf array or null
 *
 * SET_NOTIFICATIONS    — Replaces the notifications array.
 *                        payload: new notifications array
 *
 * DISMISS_NOTIF        — Removes a single notification by id.
 *                        payload: notification id string
 *
 * SET_CBA              — Sets or clears the CBA event.
 *                        payload: cbaEvent object or null
 *
 * SET_NAMING           — Sets or clears the naming rights offer.
 *                        payload: namingOffer object or null
 *
 * SET_SAVE_STATUS      — Updates the save status indicator.
 *                        payload: 'saving' | 'saved'
 *
 * SET_HELP             — Sets helpOpen flag.
 *                        payload: boolean
 *
 * RESET                — Clears all state back to initialState with
 *                        loading: false (used on delete save).
 *                        payload: (none)
 */
export function gameReducer(state, action) {
  switch (action.type) {

    /** Restores full saved state from localStorage. */
    case 'LOAD_SAVE': {
      const saved = action.payload;
      const migratedFranchises = (saved.franchises || []).map(normalizeFranchiseState);
      return {
        ...state,
        cash: saved.cash ?? 0,
        gmRep: saved.gmReputation || 50,
        dynasty: saved.dynastyHistory || [],
        lt: saved.leagueTeams || { ngl: [], abl: [] },
        fr: migratedFranchises,
        stakes: saved.stakes || [],
        season: saved.season || 1,
        freeAg: saved.freeAgents || { ngl: [], abl: [] },
        notifications: saved.notifications || [],
        leagueHistory: saved.leagueHistory || initLeagueHistory(),
        loading: false,
        // Reset V4 quarterly flow to clean state on load
        screen: (saved.franchises?.length > 0) ? 'dashboard' : 'intro',
        simming: false,
        quarterPhase: 0,
        trainingCampActive: false,
        q1PauseActive: false,
        q3PauseActive: false,
        tradeDeadlineActive: false,
        playoffActive: false,
        draftActive: false,
        freeAgencyActive: false,
        slotDecisionActive: false,
        waiverWireActive: false,
        playerEvents: [],
      };
    }

    /** Marks initial load complete when no save exists. */
    case 'FINISH_LOADING': {
      return { ...state, loading: false };
    }

    /** Changes the active screen. */
    case 'SET_SCREEN': {
      return { ...state, screen: action.payload };
    }

    /**
     * Initialises state for a new game (after player picks franchise).
     * payload: { lt, frArray, cash, events, freeAg }
     */
    case 'CREATE_FRANCHISE': {
      const { lt, frArray, cash, events, freeAg } = action.payload;
      return {
        ...state,
        lt,
        fr: (frArray || []).map(normalizeFranchiseState),
        cash,
        stakes: [],
        season: 1,
        freeAg,
        events,
        gmRep: 50,
        dynasty: [],
        recap: null,
        grade: null,
        pressConf: null,
        newspaper: null,
        newspaperDismissed: true,
        cbaEvent: null,
        namingOffer: null,
        notifications: [],
        tradeDeadlineActive: false,
        tradeDeadlineLeague: null,
        draftActive: false,
        draftDone: false,
        freeAgencyActive: false,
        playoffActive: false,
        playoffResult: null,
        aiSigningsLog: [],
        leagueHistory: initLeagueHistory(),
        // V4 quarterly flow resets
        simming: false,
        quarterPhase: 0,
        trainingCampActive: false,
        q1PauseActive: false,
        q3PauseActive: false,
        waiverWireActive: false,
        waiverPool: [],
        tradeOffers: [],
        playerEvents: [],
        slotDecisionActive: false,
      };
    }

    /**
     * Replaces the entire fr array.
     * Accepts either a new array or an updater function (fr => fr[]).
     * Auto-syncs state.cash from fr[activeIdx].cash after update.
     */
    case 'SET_FRANCHISE': {
      const next = typeof action.payload === 'function'
        ? action.payload(state.fr)
        : action.payload;
      const af = next[state.activeIdx];
      const newCash = af?.cash !== undefined ? af.cash : state.cash;
      return { ...state, fr: next, cash: newCash };
    }

    /** Replaces the lt object. */
    case 'SET_LEAGUE_TEAMS': {
      return { ...state, lt: action.payload };
    }

    /**
     * Updates cash AND syncs fr[activeIdx].cash atomically.
     * This is the single place cash is written — no more dual updates.
     */
    case 'SET_CASH': {
      const newCash = action.payload;
      const newFr = state.fr.map((f, i) =>
        i === state.activeIdx ? { ...f, cash: newCash } : f
      );
      return { ...state, cash: newCash, fr: newFr };
    }

    /** Updates gmRep. */
    case 'SET_GM_REP': {
      return { ...state, gmRep: action.payload };
    }

    /** Sets season to an explicit value. */
    case 'SET_SEASON': {
      return { ...state, season: action.payload };
    }

    /** Replaces the stakes array. Safety net: resolves functional updaters. */
    case 'SET_STAKES': {
      const next = typeof action.payload === 'function'
        ? action.payload(state.stakes)
        : action.payload;
      return { ...state, stakes: Array.isArray(next) ? next : state.stakes };
    }

    /** Replaces the freeAg pool. */
    case 'SET_FREE_AG': {
      return { ...state, freeAg: action.payload };
    }

    /** Replaces the dynasty history array. */
    case 'SET_DYNASTY': {
      return { ...state, dynasty: action.payload };
    }

    /** Replaces leagueHistory. */
    case 'SET_LEAGUE_HISTORY': {
      return { ...state, leagueHistory: action.payload };
    }

    /** Sets simming = true. */
    case 'BEGIN_SIM': {
      return { ...state, simming: true };
    }

    /** Sets simming = false. */
    case 'END_SIM': {
      return { ...state, simming: false };
    }

    /** Opens trade deadline, stores league snapshot, clears simming. */
    case 'TRADE_DEADLINE_OPEN': {
      return {
        ...state,
        tradeDeadlineLeague: action.payload,
        tradeDeadlineActive: true,
        simming: false,
      };
    }

    /** Closes trade deadline UI. */
    case 'TRADE_DEADLINE_CLOSE': {
      return { ...state, tradeDeadlineActive: false };
    }

    /** Opens playoff bracket UI, clears simming. */
    case 'PLAYOFF_OPEN': {
      return {
        ...state,
        playoffResult: action.payload.playoffResult,
        tradeDeadlineLeague: action.payload.tradeDeadlineLeague,
        playoffActive: true,
        simming: false,
      };
    }

    /** Closes playoff bracket UI. */
    case 'PLAYOFF_CLOSE': {
      return { ...state, playoffActive: false };
    }

    /** Opens draft UI with picks and prospects. */
    case 'DRAFT_OPEN': {
      return {
        ...state,
        draftPicks: action.payload.draftPicks,
        draftProspects: action.payload.draftProspects,
        draftActive: true,
      };
    }

    /** Closes draft UI and marks draftDone = true. */
    case 'DRAFT_CLOSE': {
      return { ...state, draftActive: false, draftDone: true };
    }

    /** Opens free agency UI with pool and AI signings log. */
    case 'FA_OPEN': {
      return {
        ...state,
        offseasonFAPool: action.payload.offseasonFAPool,
        aiSigningsLog: action.payload.aiSigningsLog,
        freeAgencyActive: true,
        slotDecisionActive: false,
      };
    }

    /** Closes free agency UI and clears all offseason flow state for next season. */
    case 'FA_CLOSE': {
      return {
        ...state,
        freeAgencyActive: false,
        draftDone: false,
        draftActive: false,
        draftPicks: [],
        draftProspects: [],
        slotDecisionActive: false,
        offseasonFAPool: [],
        aiSigningsLog: [],
      };
    }

    /** Opens slot decision screen, stores FA pool for use after decisions. */
    case 'SLOT_DECISION_OPEN': {
      return {
        ...state,
        slotDecisionActive: true,
        draftActive: false,
        draftDone: true,
        offseasonFAPool: action.payload.offseasonFAPool,
        aiSigningsLog: action.payload.aiSigningsLog,
      };
    }

    /** Closes slot decision screen (FA_OPEN follows immediately). */
    case 'SLOT_DECISION_CLOSE': {
      return { ...state, slotDecisionActive: false };
    }

    /** Replaces the events array. */
    case 'SET_EVENTS': {
      return { ...state, events: action.payload };
    }

    /** Sets recap narrative and grade together. */
    case 'SET_RECAP': {
      return {
        ...state,
        recap: action.payload.recap,
        grade: action.payload.grade,
      };
    }

    /** Sets newspaper content and dismissed flag. */
    case 'SET_NEWSPAPER': {
      return {
        ...state,
        newspaper: action.payload.newspaper,
        newspaperDismissed: action.payload.newspaperDismissed,
      };
    }

    /** Sets or clears the press conference array. */
    case 'SET_PRESS_CONF': {
      return { ...state, pressConf: action.payload };
    }

    /** Replaces the notifications array. */
    case 'SET_NOTIFICATIONS': {
      return { ...state, notifications: action.payload };
    }

    /** Removes a single notification by id. */
    case 'DISMISS_NOTIF': {
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
      };
    }

    /** Sets or clears the CBA event. */
    case 'SET_CBA': {
      return { ...state, cbaEvent: action.payload };
    }

    /** Sets or clears the naming rights offer. */
    case 'SET_NAMING': {
      return { ...state, namingOffer: action.payload };
    }

    /** Updates the save status indicator. */
    case 'SET_SAVE_STATUS': {
      return { ...state, saveStatus: action.payload };
    }

    /** Sets helpOpen flag. */
    case 'SET_HELP': {
      return { ...state, helpOpen: action.payload };
    }

    /** Sets or clears the roster full alert (drafted player with no room). */
    case 'SET_ROSTER_FULL_ALERT': {
      return { ...state, rosterFullAlert: action.payload };
    }

    // ── V4 Quarterly Flow Actions ─────────────────────────────────

    /** Opens training camp screen before Q1. */
    case 'TRAINING_CAMP_OPEN': {
      return { ...state, trainingCampActive: true, simming: false };
    }

    /** Closes training camp screen after focus is selected. */
    case 'TRAINING_CAMP_CLOSE': {
      return { ...state, trainingCampActive: false };
    }

    /** Sets the current quarter phase (0-4). */
    case 'SET_QUARTER_PHASE': {
      return { ...state, quarterPhase: action.payload };
    }

    /** Sets player events from rollPlayerEvents(). */
    case 'SET_PLAYER_EVENTS': {
      return { ...state, playerEvents: action.payload };
    }

    /** Opens waiver wire screen. */
    case 'WAIVER_WIRE_OPEN': {
      return { ...state, waiverWireActive: true, waiverPool: action.payload || [], simming: false };
    }

    /** Closes waiver wire screen. */
    case 'WAIVER_WIRE_CLOSE': {
      return { ...state, waiverWireActive: false, waiverPool: [] };
    }

    /** Replaces the draftProspects array (safety net — not called during active draft flow). */
    case 'SET_DRAFT_PROSPECTS': {
      return { ...state, draftProspects: Array.isArray(action.payload) ? action.payload : state.draftProspects };
    }

    /** Replaces the draftPicks array (used for draft pick swaps/trades). */
    case 'SET_DRAFT_PICKS': {
      return { ...state, draftPicks: Array.isArray(action.payload) ? action.payload : state.draftPicks };
    }

    /** Sets trade offers for the trade deadline. */
    case 'SET_TRADE_OFFERS': {
      return { ...state, tradeOffers: action.payload || [] };
    }

    /** Pauses after Q1 simulation for mid-quarter review. */
    case 'Q1_PAUSE_OPEN': {
      return { ...state, q1PauseActive: true, simming: false };
    }
    case 'Q1_PAUSE_CLOSE': {
      return { ...state, q1PauseActive: false };
    }

    /** Pauses after Q3 simulation for waiver/roster adjustments. */
    case 'Q3_PAUSE_OPEN': {
      return { ...state, q3PauseActive: true, simming: false };
    }
    case 'Q3_PAUSE_CLOSE': {
      return { ...state, q3PauseActive: false };
    }

    case 'GAME_OVER_FORCED': {
      return { ...state, gameOverForced: true, simming: false };
    }

    /**
     * Resets all state to initialState with loading: false.
     * Used when the player deletes their save.
     */
    case 'RESET': {
      return { ...initialState, loading: false };
    }

    default:
      return state;
  }
}
