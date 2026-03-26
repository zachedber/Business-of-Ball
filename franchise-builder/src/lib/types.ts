// src/lib/types.ts

export type PlayerTrait = 'leader' | 'volatile' | 'showman' | 'clutch' | 'mentor' | 'iron_man';
export type League = 'ngl' | 'abl';
export type EconomyCycle = 'stable' | 'boom' | 'recession';
export type Quarter = 1 | 2 | 3 | 4;

export interface Player {
  id: string;
  name: string;
  position: string;
  age: number;
  rating: number;
  salary: number;
  yearsLeft: number;
  seasonsPlayed: number;
  seasonsWithTeam: number;
  morale: number;
  trait: PlayerTrait | null;
  injured: boolean;
  injurySeverity: 'minor' | 'moderate' | 'severe' | null;
  gamesOut: number;
  isLocalLegend: boolean;
  isRookie: boolean;
  isDrafted: boolean;
  draftRound?: number;
  draftPick?: number;
}

export interface Coach {
  level: number;
  personality: string;
  scheme: string;
  age: number;
  seasonsWithTeam: number;
}

export interface Coordinator {
  id: string;
  name: string;
  scheme: string;
  personality: string;
  level: number;
  age: number;
  seasonsWithTeam: number;
}

export interface Finances {
  revenue: number;
  expenses: number;
  profit: number;
}

export interface MathBreakdown {
  baseValue: number;
  factors: MathFactor[];
  finalValue: number;
}

export interface MathFactor {
  label: string;
  impact: number;
}

export interface SeasonHistory {
  season: number;
  wins: number;
  losses: number;
  winPct: number;
  rosterQuality: number;
  revenue: number;
  expenses: number;
  profit: number;
  fanRating: number;
  cash: number;
  chemistry: number;
  mediaRep: number;
  economy: EconomyCycle;
  injuries: { name: string; severity: string }[];
}

export interface DraftPick {
  id: string;
  round: number;
  season: number;
  originalTeam: string;
  isFuture: boolean;
  pickPos?: number;
}

export interface DraftProspect {
  id: string;
  name: string;
  position: string;
  age: number;
  trueRating: number;                              // NEVER sent to UI
  projectedRange: { low: number; high: number };    // replaces single projectedRating
  upside: 'low' | 'mid' | 'high';
  trait: PlayerTrait | null;
  scoutReport: string;
}

export interface TradeOffer {
  id: string;
  type: 'buy' | 'sell';
  aiTeam: { id: string; city: string; name: string; wins: number; losses: number };
  playerOffered: Player | null;
  playerWanted: Player | null;
  draftCompensation: DraftPick[];
  pickSwap?: {
    fromPick: DraftPick;
    toPick: DraftPick;
  } | null;
  cashComponent: number;
  salaryRetention: number;
  retentionBoost: number;
}

export interface PlayerEvent {
  type: 'charity' | 'social_media_drama' | 'criminal';
  playerName: string;
  playerId: string;
  trait: PlayerTrait | null;
  description: string;
  effects: {
    communityRating?: number;
    lockerRoomChemistry?: number;
    mediaRep?: number;
    fanRating?: number;
  };
}

export interface Trophy {
  season: number;
  wins: number;
  losses: number;
}

export interface Franchise {
  // Identity
  id: string;
  city: string;
  name: string;
  league: League;
  market: number;
  isPlayerOwned: boolean;

  // Finance — cash is the SINGLE SOURCE OF TRUTH for liquid capital
  cash: number;
  debt: number;
  debtInterestRate: number;
  finances: Finances;

  // Roster (3-slot model — do NOT change to 6 slots)
  star1: Player | null;
  star2: Player | null;
  corePiece: Player | null;
  players: Player[];            // always [star1, star2, corePiece].filter(Boolean)
  depthQuality: number;
  rosterQuality: number;
  totalSalary: number;
  slotBudget: number;
  rookieSlots: Player[];

  // Cap / dead money
  capDeadMoney: number;
  deferredDeadCap: number;

  // Ratings (all 0–100)
  fanRating: number;
  mediaRep: number;
  communityRating: number;
  lockerRoomChemistry: number;

  // Staff levels (1–3 each)
  scoutingStaff: number;
  developmentStaff: number;
  medicalStaff: number;
  marketingStaff: number;

  // Facilities (1–3 each)
  trainingFacility: number;
  weightRoom: number;
  filmRoom: number;

  // Stadium
  stadiumCapacity: number;
  stadiumCondition: number;
  stadiumAge: number;
  stadiumTier: string;
  luxuryBoxes: number;
  clubSeatSections: number;
  stadiumProject: object | null;
  stadiumUnderConstruction: boolean;
  newStadiumHoneymoon: number;

  // Coach & staff
  coach: Coach;
  offensiveCoordinator: Coordinator | null;
  defensiveCoordinator: Coordinator | null;
  schemeFit: number;
  staffChemistry: number;

  // Season tracking
  season: number;
  wins: number;
  losses: number;
  history: SeasonHistory[];
  economyCycle: EconomyCycle;

  // Quarter tracking (internal — cleaned up after Q4)
  quarterWins?: number;
  quarterLosses?: number;
  _quarterWinProb?: number;
  _quarterEconMod?: number;
  _quarterGamesPlayed?: number;

  // Preseason training camp
  trainingCampFocus?: 'offense' | 'defense' | 'conditioning' | null; // legacy — kept for save compat
  trainingCampAllocation?: { offense: number; defense: number; conditioning: number };

  // Draft
  draftPickInventory: DraftPick[];

  // Naming rights
  namingRightsActive: boolean;
  namingRightsDeal: number | null;
  namingRightsName: string | null;
  namingRightsYears: number;

  // Misc
  championships: number;
  trophies: Trophy[];
  leagueRank: number | null;
  playoffTeam: boolean;
  fanDemographics: { casual: number; dieHard: number };
  consecutiveLosingSeason: number;
  tvTier: number;
  merchMultiplier: number;
  sponsorLevel: number;
  ticketPrice: number;
  ownershipPct: number;
  revShareReceived: number;

  // Math breakdowns (overwritten each season, not accumulated)
  mathBreakdowns: Record<string, MathBreakdown>;

  // League history & records
  leagueHistory: { champions: any[]; notableSeasons: any[] };
  franchiseRecords: Record<string, any>;
  headToHead: Record<string, any>;
  rivalry: Record<string, any>;

  // Dead cap log
  deadCapLog?: { season: number; amount: number; reason: string }[];
}
