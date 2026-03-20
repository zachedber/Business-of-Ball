import { initFranchiseRecords, initHeadToHead, initRivalry } from '@/lib/engine';

const SAVE_KEY = 'bob_v3_save';

const FRANCHISE_DEFAULTS = {
  cash: 0,
  debt: 0,
  debtInterestRate: 0,
  askingPrice: 0,
  mediaRep: 50,
  communityRating: 65,
  lockerRoomChemistry: 65,
  staffChemistry: 65,
  staffChemistryStreakYears: 0,
  dynastyCohesionBonus: false,
  fanDemographics: { casual: 70, dieHard: 30 },
  retiredNumbers: [],
  dynastyEra: null,
  deadCapLog: [],
  scoutingStaff: 1,
  developmentStaff: 1,
  medicalStaff: 1,
  marketingStaff: 1,
  schemeFit: 50,
  franchiseRecords: initFranchiseRecords(),
  headToHead: initHeadToHead(),
  rivalry: initRivalry(),
  draftPickInventory: [],
  gmInvestments: {},
  stadiumCondition: 80,
  stadiumAge: 0,
  stadiumCapacity: 50000,
  stadiumTier: 'small',
  stadiumProject: null,
  stadiumUnderConstruction: false,
  pendingStadiumEvent: null,
  newStadiumHoneymoon: 0,
  publicFundingCommitment: null,
  luxuryBoxes: 0,
  clubSeatSections: 0,
  namingRightsActive: false,
  namingRightsDeal: null,
  namingRightsName: null,
  namingRightsYears: 0,
  capDeadMoney: 0,
  deferredDeadCap: 0,
  accentColor: '#888888',
  consecutiveLosingSeason: 0,
  localLegends: [],
  trophies: [],
  history: [],
  notifications: [],
  offseasonFAPoolLocked: false,
  economyCycle: 'stable',
  leagueRank: 8,
  playoffTeam: false,
  wins: 0,
  losses: 0,
  taxiSquad: [],
  rookieSlots: [],
};

const TOP_LEVEL_DEFAULTS = {
  leagueHistory: { champions: [], notableSeasons: [] },
  stakes: [],
  notifications: [],
  season: 1,
  gmReputation: 50,
  dynastyHistory: [],
};

function ls() { return typeof window !== 'undefined' ? window.localStorage : null; }

function cloneDefault(defaultValue) {
  return Array.isArray(defaultValue) ? [...defaultValue] : (defaultValue && typeof defaultValue === 'object' ? { ...defaultValue } : defaultValue);
}

function withDefault(obj, field, defaultValue) {
  if (obj[field] == null) {
    obj[field] = cloneDefault(defaultValue); // Bugfix: migrations now clone array/object defaults so older saves never share mutable fallback state.
  }

  return obj;
}

export function migrateState(raw) {
  const state = raw && typeof raw === 'object' ? { ...raw } : {};

  Object.entries(TOP_LEVEL_DEFAULTS).forEach(([field, defaultValue]) => {
    withDefault(state, field, defaultValue);
  });

  const franchises = Array.isArray(state.franchises) ? state.franchises : [];
  state.franchises = franchises.map((franchise) => {
    const safeFranchise = franchise && typeof franchise === 'object' ? { ...franchise } : {};

    Object.entries(FRANCHISE_DEFAULTS).forEach(([field, defaultValue]) => {
      withDefault(safeFranchise, field, defaultValue);
    });

    return safeFranchise;
  });

  return state;
}

export async function saveGame(state) {
  try {
    const s = ls(); if (!s) return { success: false };
    s.setItem(SAVE_KEY, JSON.stringify({
      ...state, updatedAt: new Date().toISOString(), version: '3.0.0',
    }));
    return { success: true };
  } catch (e) { console.error('Save failed:', e); return { success: false }; }
}

export async function loadGame() {
  try {
    const s = ls(); if (!s) return null;
    const raw = s.getItem(SAVE_KEY); if (!raw) return null;
    return migrateState(JSON.parse(raw));
  } catch { return null; }
}

export async function deleteSave() {
  try { const s = ls(); if (s) s.removeItem(SAVE_KEY); return true; } catch { return false; }
}

export function hasSave() {
  try { return !!ls()?.getItem(SAVE_KEY); } catch { return false; }
}
