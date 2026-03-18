const SAVE_KEY = 'bob_v3_save';

const FRANCHISE_DEFAULTS = {
  staffChemistry: 65,
  staffChemistryStreakYears: 0,
  dynastyCohesionBonus: false,
  stadiumCondition: 80,
  stadiumAge: 0,
  stadiumCapacity: 50000,
  stadiumTier: 'small',
  stadiumUnderConstruction: false,
  newStadiumHoneymoon: 0,
  luxuryBoxes: 0,
  clubSeatSections: 0,
  namingRightsActive: false,
  namingRightsDeal: 0,
  capDeadMoney: 0,
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

function withDefault(obj, field, defaultValue) {
  if (obj[field] == null) {
    obj[field] = defaultValue;
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
