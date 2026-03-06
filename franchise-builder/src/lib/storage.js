// ============================================================
// FRANCHISE BUILDER V2 — PERSISTENCE LAYER
// Supabase (optional) + localStorage fallback
// ============================================================

const SAVE_KEY = 'franchise_builder_v2_save';
const SETTINGS_KEY = 'franchise_builder_v2_settings';

// ============================================================
// SUPABASE (optional — user provides credentials)
// ============================================================
let supabase = null;

export function initSupabase(url, anonKey) {
  if (!url || !anonKey || anonKey === 'YOUR_ANON_KEY') return false;
  try {
    // Dynamic import would happen here in production
    // For now, Supabase is opt-in via env vars
    return false;
  } catch (e) {
    console.warn('Supabase init failed, using local storage:', e);
    return false;
  }
}

// ============================================================
// LOCAL STORAGE (primary persistence)
// ============================================================
function getLocalStorage() {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export async function saveGame(state) {
  try {
    const storage = getLocalStorage();
    if (!storage) return { success: false, method: 'none' };

    const saveData = {
      portfolio: state.portfolio,
      gmReputation: state.gmReputation,
      dynastyHistory: state.dynastyHistory,
      franchises: state.franchises,
      leagueTeams: state.leagueTeams,
      stakes: state.stakes,
      season: state.season,
      notifications: state.notifications,
      freeAgents: state.freeAgents,
      updatedAt: new Date().toISOString(),
      version: '2.0.0',
    };

    storage.setItem(SAVE_KEY, JSON.stringify(saveData));
    return { success: true, method: 'local' };
  } catch (e) {
    console.error('Save failed:', e);
    return { success: false, method: 'none', error: e.message };
  }
}

export async function loadGame() {
  try {
    const storage = getLocalStorage();
    if (!storage) return null;

    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);
    if (!data || !data.version) return null;

    return data;
  } catch (e) {
    console.error('Load failed:', e);
    return null;
  }
}

export async function deleteSave() {
  try {
    const storage = getLocalStorage();
    if (storage) storage.removeItem(SAVE_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

export function hasSave() {
  try {
    const storage = getLocalStorage();
    if (!storage) return false;
    return !!storage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

// ============================================================
// SETTINGS (separate from game save)
// ============================================================
export function saveSettings(settings) {
  try {
    const storage = getLocalStorage();
    if (storage) storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

export function loadSettings() {
  try {
    const storage = getLocalStorage();
    if (!storage) return null;
    const raw = storage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
