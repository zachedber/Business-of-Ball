// src/lib/types.js — Canonical JSDoc type definitions for Business of Ball
//
// These shapes are the single source of truth for the game's data model.
// Every reducer action, selector, and screen component should conform to these.

/**
 * @typedef {'ngl' | 'abl'} LeagueId
 */

/**
 * @typedef {'Rising' | 'Peak' | 'Declining'} DevelopmentPhase
 */

/**
 * @typedef {'mercenary' | 'volatile' | 'hometown' | 'leader' | 'showman' | 'ironman' | 'injury_prone' | 'clutch'} PlayerTrait
 */

/**
 * @typedef {Object} CareerStats
 * @property {number} seasons
 * @property {number} bestRating
 */

/**
 * Single player — star, core piece, depth, taxi, or rookie slot.
 *
 * @typedef {Object} Player
 * @property {string} id
 * @property {string} name
 * @property {string} position
 * @property {number} age
 * @property {number} rating          — 0-99 overall
 * @property {number} morale          — 0-100
 * @property {PlayerTrait|null} trait
 * @property {number} salary          — $M per year
 * @property {number} yearsLeft       — contract years remaining
 * @property {number} seasonsPlayed
 * @property {boolean} injured
 * @property {string|null} injurySeverity
 * @property {number} gamesOut
 * @property {boolean} isLocalLegend
 * @property {number} seasonsWithTeam
 * @property {CareerStats} careerStats
 * @property {DevelopmentPhase} [developmentPhase]
 * @property {number} [hiddenPotential]
 * @property {string} [slotType]      — 'star1' | 'star2' | 'corePiece' if in a slot
 * @property {boolean} [isRookie]
 */

/**
 * @typedef {'Motivator' | 'Tactician' | 'Disciplinarian' | 'Players Coach'} CoachPersonality
 */

/**
 * Head coach or coordinator.
 *
 * @typedef {Object} Coach
 * @property {string} name
 * @property {CoachPersonality|string} personality
 * @property {number} level            — 1-4
 * @property {number} [seasonsWithTeam]
 * @property {string} [developmentFocus]
 * @property {string} [lockerRoomStyle]
 * @property {string} [backstory]
 * @property {string} [scheme]         — coordinator scheme (OC/DC)
 * @property {string} [specialty]      — PDC specialty
 * @property {number} [salary]         — $M per year
 */

/**
 * Front-office investment levels.
 *
 * @typedef {Object} Investments
 * @property {number} sportsScienceDept   — 0-3
 * @property {number} advancedScouting    — 0-3 (mapped to scoutingNetwork)
 * @property {number} globalMarketing     — 0-3
 * @property {boolean} recoveryCenter
 * @property {boolean} privateJetFleet
 * @property {boolean} nutritionStaff
 * @property {number} stadiumDistrict     — 0-3
 * @property {number} overseasStakes      — stackable count
 */

/**
 * Pricing configuration.
 *
 * @typedef {Object} Pricing
 * @property {number} ticketPrice
 * @property {number} concessionsPrice
 * @property {number} merchPrice
 * @property {number} parkingPrice
 */

/**
 * Debt details for leveraged purchases.
 *
 * @typedef {Object} DebtObject
 * @property {number} principal
 * @property {number} interestRate
 * @property {number} termSeasons
 * @property {number} seasonalPayment
 * @property {number} gmRep
 * @property {number} consecutiveMissedPayments
 */

/**
 * Stadium construction project (in-progress).
 *
 * @typedef {Object} StadiumProject
 * @property {string} targetTier
 * @property {number} totalCost
 * @property {number} paidSoFar
 * @property {number} publicFundingPct
 * @property {number} seasonStarted
 * @property {string} currentPhase
 */

/**
 * Franchise records tracking.
 *
 * @typedef {Object} FranchiseRecords
 * @property {number} [bestWins]
 * @property {number} [bestRating]
 * @property {number} [championships]
 */

/**
 * Season history entry.
 *
 * @typedef {Object} SeasonHistoryEntry
 * @property {number} [cash]
 * @property {number} [profit]
 * @property {number} [revenue]
 * @property {number} [valuation]
 */

/**
 * Financial breakdown attached to a franchise after simulation.
 *
 * @typedef {Object} Finances
 * @property {number} revenue
 * @property {number} expenses
 * @property {number} profit
 */

/**
 * Single franchise object — the player's owned team.
 * This is NEVER an array. The fr[] array in state holds one or more of these.
 *
 * @typedef {Object} Franchise
 * @property {string} id
 * @property {string} name
 * @property {string} city
 * @property {LeagueId} league
 * @property {string} primaryColor
 * @property {string} [secondaryColor]
 * @property {number} market               — market score 0-100
 *
 * @property {Player|null} star1
 * @property {Player|null} star2
 * @property {Player|null} corePiece
 * @property {Player[]} players            — derived: [star1, star2, corePiece].filter(Boolean)
 * @property {Player[]} [taxiSquad]
 * @property {Player[]} [rookieSlots]
 *
 * @property {Coach} coach
 * @property {Coach|null} [offensiveCoordinator]
 * @property {Coach|null} [defensiveCoordinator]
 * @property {Coach|null} [playerDevCoach]
 *
 * @property {number} cash                 — liquid capital $M
 * @property {number} totalSalary
 * @property {number} debt                 — total debt principal
 * @property {DebtObject|null} debtObject
 * @property {number} debtInterestRate
 * @property {number} [capDeadMoney]
 * @property {number} [deferredDeadCap]
 * @property {Object[]} [deadCapLog]
 *
 * @property {Pricing} pricing
 * @property {number} [ticketPrice]        — legacy / shortcut
 * @property {Investments} investments
 * @property {number} facilityMaintenance
 *
 * @property {number} wins
 * @property {number} losses
 * @property {number} [quarterWins]
 * @property {number} [quarterLosses]
 * @property {number} [halfWins]
 * @property {number} [halfLosses]
 * @property {number} rosterQuality
 * @property {number} [depthQuality]
 * @property {number} [schemeFit]
 * @property {number} [staffChemistry]
 *
 * @property {number} fanRating            — 0-100
 * @property {number} [mediaRep]           — 0-100
 * @property {number} [communityRating]    — 0-100
 *
 * @property {number} [scoutingStaff]      — 0-3
 * @property {number} [developmentStaff]   — 0-3
 * @property {number} [medicalStaff]       — 0-3
 * @property {number} [marketingStaff]     — 0-3
 * @property {number} [trainingFacility]   — 0-3
 * @property {number} [weightRoom]         — 0-3
 * @property {number} [filmRoom]           — 0-3
 *
 * @property {string} [stadiumName]
 * @property {string} [stadiumDisplayName]
 * @property {string} [stadiumTier]
 * @property {number} [stadiumCapacity]
 * @property {number} [stadiumCondition]
 * @property {number} [stadiumAge]
 * @property {boolean} [stadiumUnderConstruction]
 * @property {number} [newStadiumHoneymoon]
 * @property {StadiumProject|null} [stadiumProject]
 * @property {number} [luxuryBoxes]
 * @property {number} [clubSeatSections]
 *
 * @property {boolean} [namingRightsActive]
 * @property {string} [trainingCampAllocation]
 * @property {boolean} [dynastyCohesionBonus]
 * @property {string} [dynastyEra]
 * @property {FranchiseRecords} [franchiseRecords]
 * @property {Object[]} [draftPickInventory]
 * @property {Finances} [finances]
 * @property {SeasonHistoryEntry[]} [history]
 * @property {number} [season]             — franchise-local season mirror
 */

/**
 * AI-controlled league team (non-player).
 *
 * @typedef {Object} LeagueTeam
 * @property {string} id
 * @property {string} name
 * @property {string} city
 * @property {LeagueId} league
 * @property {number} market
 * @property {number} wins
 * @property {number} losses
 * @property {number} rosterQuality
 * @property {boolean} [isPlayerOwned]
 * @property {number} [leagueRank]
 * @property {string} [primaryColor]
 */

/**
 * All valid game phases / screen values.
 *
 * @typedef {'intro' | 'setup' | 'dashboard' | 'league' | 'market'
 *   | 'portfolio' | 'finances' | 'settings' | 'analytics'} GamePhase
 */

/**
 * Investment stake in another team.
 *
 * @typedef {Object} Stake
 * @property {string} id
 * @property {string} teamId
 * @property {string} teamName
 * @property {LeagueId} league
 * @property {number} stakePct
 * @property {number} purchasePrice
 * @property {number} purchaseSeason
 */

/**
 * Trade offer (deadline or draft trade-up).
 *
 * @typedef {Object} TradeOffer
 * @property {string} id
 * @property {'buy' | 'sell'} type
 * @property {LeagueTeam} [aiTeam]
 * @property {Player} [playerWanted]
 * @property {Player} [playerOffered]
 * @property {number} [cashComponent]
 * @property {number} [salaryRetention]
 * @property {Object[]} [draftCompensation]
 */

/**
 * Draft pick.
 *
 * @typedef {Object} DraftPick
 * @property {string} id
 * @property {number} round
 * @property {number} pick
 * @property {number} [pickPos]
 */

/**
 * Full application state managed by gameReducer.
 *
 * @typedef {Object} AppState
 * @property {GamePhase} screen
 * @property {boolean} loading
 *
 * @property {number} cash                    — synced with currentFranchise.cash
 * @property {number} gmRep                   — 0-100
 * @property {Object[]} dynasty
 *
 * @property {{ ngl: LeagueTeam[], abl: LeagueTeam[] }|null} lt
 * @property {Franchise[]} fr                 — array of all player franchises
 * @property {Stake[]} stakes
 * @property {number} season
 * @property {{ ngl: Player[], abl: Player[] }} freeAg
 * @property {number} activeIdx               — index into fr[] for current franchise
 *
 * @property {boolean} simming
 * @property {boolean} tradeDeadlineActive
 * @property {{ ngl: LeagueTeam[], abl: LeagueTeam[] }|null} tradeDeadlineLeague
 *
 * @property {boolean} playoffActive
 * @property {Object|null} playoffResult
 * @property {Object[]} aiSigningsLog
 *
 * @property {boolean} draftActive
 * @property {DraftPick[]} draftPicks
 * @property {Player[]} draftProspects
 * @property {boolean} draftDone
 * @property {boolean} freeAgencyActive
 * @property {Player[]} offseasonFAPool
 * @property {boolean} slotDecisionActive
 *
 * @property {Object[]} notifications
 * @property {string|null} recap
 * @property {string|null} grade
 * @property {Object[]} events
 * @property {Object[]|null} pressConf
 * @property {Object|null} newspaper
 * @property {boolean} newspaperDismissed
 * @property {Object|null} cbaEvent
 * @property {Object|null} namingOffer
 * @property {'saving' | 'saved'} saveStatus
 * @property {boolean} helpOpen
 * @property {Object} leagueHistory
 * @property {Object|null} rosterFullAlert
 *
 * @property {boolean} trainingCampActive
 * @property {number} quarterPhase            — 0 = not simming, 1-4 = quarter completed
 * @property {boolean} q1PauseActive
 * @property {boolean} q3PauseActive
 * @property {Object[]} playerEvents
 * @property {boolean} waiverWireActive
 * @property {Player[]} waiverPool
 * @property {TradeOffer[]} tradeOffers
 * @property {boolean} gameOverForced
 */

// ─── Selector ──────────────────────────────────────────────
/**
 * Derives the current franchise from state.
 * Returns the franchise at state.activeIdx, or null if none exists.
 *
 * @param {AppState} state
 * @returns {Franchise|null}
 */
export function selectCurrentFranchise(state) {
  return state.fr[state.activeIdx] ?? null;
}
