import { initLeagueHistory, addPendingEffect, flushPendingEffects, computeTradePosture } from '@/lib/engine';
import { resolveOffseasonEvent, getGMRepAfterEvent, resolvePressConference } from '@/lib/events/handlers';
import { applyCBAChoice } from '@/lib/economy/handlers';
import { acceptNamingRights, appendLogEntry } from '@/lib/economy';
import { processTradeAcceptance, processWaiverSigning, processDraftTradeUp } from '@/lib/league/handlers';
import { processDraftSelection, r1 } from '@/lib/engine/roster';
import { selectCurrentFranchise } from '@/lib/types';

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
    frontOfficeLog: Array.isArray(safe.frontOfficeLog) ? safe.frontOfficeLog : [],
  };
}

// ─── Helper: update active franchise in fr array ───────────
function updateActiveFr(state, updater) {
  const next = state.fr.map((f, i) =>
    i === state.activeIdx ? (typeof updater === 'function' ? updater(f) : updater) : f
  );
  const af = next[state.activeIdx];
  const newCash = af?.cash !== undefined ? af.cash : state.cash;
  return { ...state, fr: next, cash: newCash };
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
 * ── UI Navigation & App Lifecycle ──────────────────────────
 * LOAD_SAVE            — Restores full saved state from localStorage.
 * FINISH_LOADING       — Marks loading complete when no save is found.
 * SET_SCREEN           — Changes the active screen.
 * RESET                — Clears all state back to initialState.
 *
 * ── Franchise Creation ─────────────────────────────────────
 * CREATE_FRANCHISE     — Initialises lt, fr, stakes, season.
 *
 * ── Core State Setters (low-level) ─────────────────────────
 * SET_FRANCHISE        — Replaces entire fr array, syncs cash.
 * SET_LEAGUE_TEAMS     — Replaces lt object.
 * SET_CASH             — Updates cash AND syncs fr[activeIdx].cash.
 * SET_GM_REP           — Updates gmRep.
 * SET_SEASON           — Sets season number.
 * SET_STAKES           — Replaces stakes array.
 * SET_FREE_AG          — Replaces freeAg pool.
 * SET_DYNASTY          — Replaces dynasty history.
 * SET_LEAGUE_HISTORY   — Replaces leagueHistory.
 *
 * ── Game Logic Actions (high-level) ────────────────────────
 * RESOLVE_EVENT        — Resolves an offseason event choice.
 * RESOLVE_PRESS_CONF   — Resolves a press conference option.
 * RESOLVE_CBA          — Resolves a CBA event choice.
 * ACCEPT_NAMING_RIGHTS — Accepts naming rights offer.
 * DECLINE_NAMING_RIGHTS — Declines naming rights offer.
 * SIGN_PLAYER          — Signs a player to the active franchise.
 * RELEASE_PLAYER       — Releases a player from the active franchise.
 * EXECUTE_TRADE        — Accepts a trade offer at the trade deadline.
 * RESOLVE_TRADE_OFFER  — Removes a declined trade offer.
 * SIGN_WAIVER          — Signs a waiver wire player.
 * ADVANCE_DRAFT_PICK   — Processes a draft trade-up.
 * SIMULATE_SEASON      — Placeholder for end-of-season batch update.
 * UPGRADE_FACILITY     — Upgrades a facility level on active franchise.
 * BUY_STAKE            — Buys a stake in another team.
 * HIRE_COACH           — Hires a new head coach.
 * FIRE_COACH           — Fires the current head coach.
 * SET_TICKET_PRICE     — Sets ticket price on active franchise.
 * ACCEPT_FA_OFFER      — Signs a free agent during offseason FA.
 * DECLINE_FA_OFFER     — Passes on a free agent (no-op placeholder).
 * PAY_OFF_DEBT         — Pays off franchise debt.
 *
 * ── Simulation Sequencing ──────────────────────────────────
 * BEGIN_SIM / END_SIM
 * TRADE_DEADLINE_OPEN / TRADE_DEADLINE_CLOSE
 * PLAYOFF_OPEN / PLAYOFF_CLOSE
 * DRAFT_OPEN / DRAFT_CLOSE
 * FA_OPEN / FA_CLOSE
 * SLOT_DECISION_OPEN / SLOT_DECISION_CLOSE
 * TRAINING_CAMP_OPEN / TRAINING_CAMP_CLOSE
 * Q1_PAUSE_OPEN / Q1_PAUSE_CLOSE
 * Q3_PAUSE_OPEN / Q3_PAUSE_CLOSE
 * WAIVER_WIRE_OPEN / WAIVER_WIRE_CLOSE
 * SET_QUARTER_PHASE / SET_PLAYER_EVENTS
 * SET_DRAFT_PICKS / SET_DRAFT_PROSPECTS / SET_TRADE_OFFERS
 *
 * ── UI / Event State ───────────────────────────────────────
 * SET_EVENTS / SET_RECAP / SET_NEWSPAPER / SET_PRESS_CONF
 * SET_NOTIFICATIONS / DISMISS_NOTIF
 * SET_CBA / SET_NAMING
 * SET_SAVE_STATUS / SET_HELP / SET_ROSTER_FULL_ALERT
 * GAME_OVER_FORCED
 */
export function gameReducer(state, action) {
  switch (action.type) {
    // ── UI Navigation & App Lifecycle ───────────────────────────

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

    // ── Core State Setters ─────────────────────────────────────

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

    // ── Game Logic Actions ─────────────────────────────────────

    /**
     * Resolves an offseason event choice.
     * payload: { eventId, choiceIdx }
     */
    case 'RESOLVE_EVENT': {
      const { eventId, choiceIdx } = action.payload;
      const event = state.events.find(e => e.id === eventId);
      if (!event) return state;
      const choice = event.choices[choiceIdx];
      const updated = updateActiveFr(state, f => resolveOffseasonEvent(f, event, choice));
      return {
        ...updated,
        gmRep: getGMRepAfterEvent(state.gmRep, event),
        events: state.events.map(e => e.id === eventId ? { ...e, resolved: true } : e),
      };
    }

    /**
     * Resolves a press conference option.
     * payload: { pcId, optionIdx }
     */
    case 'RESOLVE_PRESS_CONF': {
      const { pcId, optionIdx } = action.payload;
      const pc = (state.pressConf || []).find(x => x.id === pcId);
      let next = state;
      if (pc) {
        const option = pc.options[optionIdx];
        next = updateActiveFr(state, f => resolvePressConference(f, option));
      }
      return {
        ...next,
        pressConf: (state.pressConf || []).filter(x => x.id !== pcId),
      };
    }

    /**
     * Resolves a CBA event choice.
     * payload: { choiceIdx, strikeOccurred }
     */
    case 'RESOLVE_CBA': {
      const { choiceIdx, strikeOccurred } = action.payload;
      if (!state.cbaEvent?.choices?.[choiceIdx]) return state;
      const choice = state.cbaEvent.choices[choiceIdx];
      const cbaHelpful = (choice.moraleBonus || 0) > 0 || (choice.revenuePenalty || 0) >= 0;
      let next = updateActiveFr(state, f => appendLogEntry(applyCBAChoice(f, choice), {
        season: f.season || state.season,
        quarter: null,
        type: 'cba',
        headline: `CBA: ${choice.label}${strikeOccurred ? ' — strike occurred' : ''}`.slice(0, 80),
        detail: choice.desc || null,
        impact: strikeOccurred ? 'negative' : cbaHelpful ? 'positive' : 'negative',
      }));
      if (strikeOccurred) {
        next = {
          ...next,
          recap: (state.recap || '') + ' A labour strike shortened the season, devastating gate revenue.',
        };
      }
      return { ...next, cbaEvent: null };
    }

    /**
     * Accepts a naming rights offer.
     * payload: namingOffer object
     */
    case 'ACCEPT_NAMING_RIGHTS': {
      const offer = action.payload;
      if (!offer) return { ...state, namingOffer: null };
      return {
        ...updateActiveFr(state, f => appendLogEntry(acceptNamingRights(f, offer), {
          season: f.season || state.season,
          quarter: null,
          type: 'naming',
          headline: `Naming rights deal signed: $${offer.annualPay}M/yr`.slice(0, 80),
          detail: `${offer.company}, ${offer.years}yr deal`,
          impact: 'positive',
        })),
        namingOffer: null,
      };
    }

    /** Declines a naming rights offer. */
    case 'DECLINE_NAMING_RIGHTS': {
      return { ...state, namingOffer: null };
    }

    /**
     * Signs a draft pick to the active franchise.
     * payload: { player, usedPick }
     */
    case 'SIGN_PLAYER': {
      const { player, usedPick } = action.payload;
      if (!player) return state;
      let alertToSet = null;
      const next = updateActiveFr(state, f => {
        const { updated, alert } = processDraftSelection(f, player, usedPick);
        if (alert) alertToSet = alert;
        return updated;
      });
      // Alert is set via a deferred SET_ROSTER_FULL_ALERT dispatch from caller
      // since reducers must be synchronous. We store it so caller can check.
      return alertToSet ? { ...next, rosterFullAlert: alertToSet } : next;
    }

    /**
     * Releases a player from the active franchise.
     * payload: { playerId } — placeholder for future screen migration.
     */
    case 'RELEASE_PLAYER': {
      return state; // Screen components use setFr for now
    }

    /**
     * Executes a trade deadline trade.
     * payload: { offer, tradeOffers }
     */
    case 'EXECUTE_TRADE': {
      const { offer, tradeOffers } = action.payload;
      const isSell = offer.type === 'sell';
      const playerName = isSell ? offer.playerOffered?.name : offer.playerWanted?.name;
      let next = updateActiveFr(state, f => {
        let updated = processTradeAcceptance(f, offer);
        const detailParts = [];
        if (offer.cashComponent && offer.cashComponent !== 0) detailParts.push(`$${Math.abs(offer.cashComponent)}M cash`);
        if (offer.draftCompensation?.length > 0) detailParts.push(`${offer.draftCompensation.length} draft pick(s)`);
        return appendLogEntry(updated, {
          season: f.season || state.season,
          quarter: null,
          type: 'trade',
          headline: `Trade: ${isSell ? 'acquired' : 'sent away'} ${playerName || 'player'}`.slice(0, 80),
          detail: detailParts.length > 0 ? detailParts.join(', ') : null,
          impact: offer.type === 'buy' ? 'positive' : 'neutral',
        });
      });
      if (offer.cashComponent && offer.cashComponent !== 0) {
        const af = next.fr[next.activeIdx];
        const currentCash = af?.cash ?? next.cash;
        const newCash = r1(currentCash + offer.cashComponent);
        const newFr = next.fr.map((f, i) =>
          i === next.activeIdx ? { ...f, cash: newCash } : f
        );
        next = { ...next, fr: newFr, cash: newCash };
      }
      return { ...next, tradeOffers: tradeOffers.filter(o => o.id !== offer.id) };
    }

    /**
     * Removes a declined trade offer.
     * payload: { offerId, tradeOffers }
     */
    case 'RESOLVE_TRADE_OFFER': {
      const { offerId, tradeOffers } = action.payload;
      return { ...state, tradeOffers: tradeOffers.filter(o => o.id !== offerId) };
    }

    /**
     * Signs a waiver wire player.
     * payload: { player, waiverPool }
     */
    case 'SIGN_WAIVER': {
      const { player, waiverPool } = action.payload;
      const af = selectCurrentFranchise(state);
      if (!af) return state;
      const result = processWaiverSigning(af, player);
      if (!result) return state;
      const next = updateActiveFr(state, () => result);
      return {
        ...next,
        waiverWireActive: true,
        waiverPool: waiverPool.filter(p => p.id !== player.id),
      };
    }

    /**
     * Processes a draft trade-up.
     * payload: { offer, currentPick, incomingPick, draftPicks, tradeOffers }
     */
    case 'ADVANCE_DRAFT_PICK': {
      const { offer, currentPick, incomingPick, draftPicks, tradeOffers } = action.payload;
      let next = state;
      if (offer.cashComponent) {
        const newCash = state.cash + (offer.cashComponent || 0);
        const newFr = state.fr.map((f, i) =>
          i === state.activeIdx ? { ...f, cash: newCash } : f
        );
        next = { ...next, fr: newFr, cash: newCash };
      }
      if (currentPick && incomingPick) {
        next = {
          ...next,
          draftPicks: draftPicks.map(p =>
            p.id === currentPick.id
              ? { ...incomingPick, pick: incomingPick.pickPos ?? incomingPick.pick }
              : p
          ),
        };
      }
      if (offer.draftCompensation?.length > 0) {
        next = updateActiveFr(next, f => processDraftTradeUp(f, offer));
      }
      return { ...next, tradeOffers: tradeOffers.filter(o => o.id !== offer.id) };
    }

    /**
     * Placeholder for future end-of-season batch update.
     * Currently the useSimulation hook dispatches multiple atomic actions.
     */
    case 'SIMULATE_SEASON': {
      return state;
    }

    /**
     * Upgrades a facility on the active franchise.
     * payload: { field, cost }
     */
    case 'UPGRADE_FACILITY': {
      const { field, cost } = action.payload;
      return updateActiveFr(state, f => {
        const current = f[field] || 0;
        if (current >= 3) return f;
        if ((f.cash || 0) < cost) return f;
        const upgraded = { ...f, [field]: current + 1, cash: r1((f.cash || 0) - cost) };
        const facilityLabel = field.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
        return appendLogEntry(upgraded, {
          season: f.season || state.season,
          quarter: null,
          type: 'facility',
          headline: `${facilityLabel} upgraded to Tier ${current + 1}`.slice(0, 80),
          detail: null,
          impact: 'positive',
        });
      });
    }

    /**
     * Buys a stake in another team.
     * payload: { stake, cost } — currently handled in MarketScreen via SET_STAKES + SET_CASH.
     * Placeholder for future migration.
     */
    case 'BUY_STAKE': {
      return state;
    }

    /**
     * Hires a new head coach.
     * payload: { candidate } — currently handled via setFr prop in StaffTab.
     * Placeholder for future migration.
     */
    case 'HIRE_COACH': {
      return state;
    }

    /**
     * Fires the current head coach.
     * Currently handled via setFr prop in StaffTab.
     * Placeholder for future migration.
     */
    case 'FIRE_COACH': {
      return state;
    }

    /**
     * Queues a delayed consequence on the active franchise.
     * payload: Omit<PendingEffect, 'resolved'>
     * Used by UI screens (e.g. coaching hire, FA signing, cut player)
     * to attach second-order effects at the moment of decision.
     */
    case 'ADD_PENDING_EFFECT': {
      return updateActiveFr(state, f => addPendingEffect(f, action.payload));
    }

    /**
     * Sets ticket price on the active franchise.
     * payload: newPrice
     */
    case 'SET_TICKET_PRICE': {
      return updateActiveFr(state, f =>
        f.ticketPrice === action.payload ? f : { ...f, ticketPrice: action.payload }
      );
    }

    /**
     * Signs a free agent during offseason FA.
     * Currently handled via setFr prop in FreeAgencyScreen.
     * Placeholder for future migration.
     */
    case 'ACCEPT_FA_OFFER': {
      return state;
    }

    /**
     * Passes on a free agent (no-op).
     * Placeholder for future migration.
     */
    case 'DECLINE_FA_OFFER': {
      return state;
    }

    /**
     * Pays off franchise debt.
     * payload: { amount }
     */
    case 'PAY_OFF_DEBT': {
      const { amount } = action.payload;
      return updateActiveFr(state, f => {
        if ((f.cash || 0) < amount) return f;
        return {
          ...f,
          cash: r1((f.cash || 0) - amount),
          debt: 0,
          debtObject: null,
        };
      });
    }

    // ── Simulation Sequencing ─────────────────────────────────

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

    // ── UI / Event State ───────────────────────────────────────

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

    // ── Simulation Sequencing ─────────────────────────────────

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

// ── Re-export selector for convenience ─────────────────────
export { selectCurrentFranchise } from '@/lib/types';
