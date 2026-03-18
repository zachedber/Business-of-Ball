// ============================================================
// BUSINESS OF BALL — LEAGUE DATA & CONSTANTS
// All team names fictional — no real league names used
// ============================================================

// --- MARKET TIERS ---
export const MARKET_TIERS = {
  1: { label: 'Elite', min: 85, color: '#D4A843', desc: 'Top media markets, massive revenue' },
  2: { label: 'Major', min: 72, color: '#2A5FA0', desc: 'Large markets with strong fan bases' },
  3: { label: 'Mid-Market', min: 62, color: '#1A6B3A', desc: 'Competitive cities, solid support' },
  4: { label: 'Small', min: 59, color: '#C47B18', desc: 'Scrappy markets — lower revenue, loyal fans' },
  5: { label: 'Budget', min: 0, color: '#C8202A', desc: 'Underdog — cheapest entry, maximum challenge' },
};
// Tier 5 (Budget) captures the 4 smallest-market teams (market < 59):
//   NGL — Green Bay Frost (55), Jacksonville Gators (56)
//   ABL — Oklahoma City Drillers (58), Detroit Motors (58)
export function getMarketTier(m) { return m >= 85 ? 1 : m >= 72 ? 2 : m >= 62 ? 3 : m >= 59 ? 4 : 5; }
export function getMarketTierInfo(m) { return MARKET_TIERS[getMarketTier(m)]; }

// --- ECONOMICS ---
export const NGL_SALARY_CAP = 285;
export const ABL_SALARY_CAP = 140;
export const CAP_INFLATION_RATE = 0.025;
export const NGL_ROSTER_SIZE = 22;
export const ABL_ROSTER_SIZE = 15;
export const NGL_DRAFT_ROUNDS = 7;
export const ABL_DRAFT_ROUNDS = 2;
export const STARTING_CASH = { 3: 30, 4: 20, 5: 12 };
export const UPGRADE_COSTS = { 0: 4, 1: 8, 2: 15 };
export const TICKET_BASE_PRICE = 65;
export const TICKET_ELASTICITY = 0.006;
export const REVENUE_SHARE_PCT = 0.30;
export const MAX_DEBT_RATIO = 0.40;
export const DEBT_INTEREST = 0.08;

// --- POSITIONS ---
export const NGL_POSITIONS = ['QB','RB','WR','WR','TE','OT','OT','OG','OG','C','DE','DE','DT','DT','LB','LB','LB','CB','CB','S','S','K'];
export const ABL_POSITIONS = ['PG','SG','SF','PF','C','PG','SG','SF','PF','C','SG','SF','PF','PG','C'];
export const PEAK_AGES = { ngl: [26, 30], abl: [25, 29] };
export const PLAYER_TRAITS = ['mercenary','volatile','hometown','leader','showman','ironman','injury_prone','clutch'];
export const TRAIT_WEIGHTS = [0.12, 0.1, 0.12, 0.12, 0.1, 0.08, 0.08, 0.1];
export const COACH_PERSONALITIES = ['Players Coach', 'Disciplinarian', 'Tactician', 'Showman'];

// --- STADIUM SYSTEM ---
export const STADIUM_TIERS = {
  small: { label: 'Small',  capacityRange: [38000, 54000], upgradeCost: 0,   minSeason: 0,  gateMultiplier: 1.00, maintMultiplier: 1.00 },
  mid:   { label: 'Mid',    capacityRange: [55000, 62000], upgradeCost: 45,  minSeason: 3,  gateMultiplier: 1.18, maintMultiplier: 1.15 },
  large: { label: 'Large',  capacityRange: [63000, 70000], upgradeCost: 80,  minSeason: 6,  gateMultiplier: 1.38, maintMultiplier: 1.30 },
  mega:  { label: 'Mega',   capacityRange: [71000, 85000], upgradeCost: 130, minSeason: 10, gateMultiplier: 1.60, maintMultiplier: 1.45 },
};
export const STADIUM_TIER_ORDER = ['small', 'mid', 'large', 'mega'];
export const STADIUM_SUFFIXES = ['Memorial Stadium', 'Municipal Stadium', 'Community Stadium', 'Athletic Stadium', 'Civic Stadium'];
export const STADIUM_NAMING_FLAVORS = ['Stadium', 'Field', 'Arena', 'Park', 'Center'];
export const STADIUM_BUILD_TIMELINE = {
  mid:   { seasons: 2, baseCost: 120 },
  large: { seasons: 2, baseCost: 200 },
  mega:  { seasons: 3, baseCost: 280 },
};
export function getStadiumTierFromCapacity(cap) {
  if (cap >= 71000) return 'mega';
  if (cap >= 63000) return 'large';
  if (cap >= 55000) return 'mid';
  return 'small';
}

// Market-tier to stadium capacity range
export const MARKET_STADIUM_CAPACITY = {
  1: [68000, 72000],
  2: [62000, 67000],
  3: [54000, 61000],
  4: [45000, 53000],
  5: [38000, 44000],
};

// --- COACHING STAFF ---
export const HEAD_COACH_PERSONALITIES = ['demanding','cerebral','fiery','composed','motivator','tactician','old-school','innovative','defensive-minded','offensive-guru','player-dev','culture-builder'];
export const OC_SCHEMES = ['run_heavy', 'pass_heavy', 'balanced'];
export const DC_SCHEMES = ['aggressive', 'zone', 'bend_dont_break'];
export const PDC_SPECIALTIES = ['skill_positions', 'linemen', 'all_around'];
export const DEVELOPMENT_FOCUSES = ['youth', 'veterans', 'stars'];
export const LOCKER_ROOM_STYLES = ['disciplinarian', 'players_coach', 'analytics'];
export const STAFF_SALARIES = {
  oc:  { 1: 1.0, 2: 2.5, 3: 4.5 },
  dc:  { 1: 1.0, 2: 2.5, 3: 4.5 },
  pdc: { 1: 0.8, 2: 1.8, 3: 3.0 },
};

export const CITY_ECONOMY = {
  'New York':92,'Los Angeles':90,'Chicago':82,'Dallas':80,'Houston':78,'Philadelphia':75,
  'Boston':85,'Miami':78,'Atlanta':76,'Bay City':88,'Seattle':80,'Denver':74,'Las Vegas':77,
  'Nashville':72,'Baltimore':68,'Tampa Bay':70,'Cleveland':62,'Pittsburgh':66,'Indianapolis':65,
  'Kansas City':68,'New Orleans':64,'Green Bay':55,'Minnesota':72,'Detroit':60,'Buffalo':58,
  'Carolina':68,'Portland':72,'Salt Lake':65,'Sacramento':66,'San Diego':74,'Brooklyn':88,
  'Milwaukee':62,'Toronto':82,'San Antonio':65,'Orlando':68,'Memphis':60,'Oklahoma City':58,
  'Charlotte':70,'Washington DC':85,'Phoenix':72,'Jacksonville':56,'Cincinnati':62,
};

// ============================================================
// NGL — NATIONAL GRIDIRON LEAGUE (Football) — 32 Teams
// ALL NAMES FICTIONAL
// ============================================================
export const NGL_TEAMS = [
  // Northeast
  { id:'ngl-bos', name:'Ironclad', city:'Boston', division:'Northeast', market:85 },
  { id:'ngl-nyt', name:'Titans', city:'New York', division:'Northeast', market:95 },
  { id:'ngl-nye', name:'Empire', city:'New York', division:'Northeast', market:92 },
  { id:'ngl-phi', name:'Steel', city:'Philadelphia', division:'Northeast', market:78 },
  { id:'ngl-bal', name:'Raptors', city:'Baltimore', division:'Northeast', market:68 },
  { id:'ngl-buf', name:'Blizzard', city:'Buffalo', division:'Northeast', market:58 },
  { id:'ngl-pit', name:'Forge', city:'Pittsburgh', division:'Northeast', market:66 },
  { id:'ngl-wdc', name:'Sentinels', city:'Washington DC', division:'Northeast', market:80 },
  // Southeast
  { id:'ngl-mia', name:'Surge', city:'Miami', division:'Southeast', market:78 },
  { id:'ngl-atl', name:'Phoenix', city:'Atlanta', division:'Southeast', market:76 },
  { id:'ngl-car', name:'Pines', city:'Carolina', division:'Southeast', market:68 },
  { id:'ngl-tbb', name:'Thunder', city:'Tampa Bay', division:'Southeast', market:70 },
  { id:'ngl-nol', name:'Jazz Kings', city:'New Orleans', division:'Southeast', market:64 },
  { id:'ngl-nas', name:'Ridge', city:'Nashville', division:'Southeast', market:72 },
  { id:'ngl-jax', name:'Gators', city:'Jacksonville', division:'Southeast', market:56 },
  { id:'ngl-orl', name:'Storms', city:'Orlando', division:'Southeast', market:65 },
  // Midwest
  { id:'ngl-chi', name:'Wolves', city:'Chicago', division:'Midwest', market:82 },
  { id:'ngl-grb', name:'Frost', city:'Green Bay', division:'Midwest', market:55 },
  { id:'ngl-min', name:'North', city:'Minnesota', division:'Midwest', market:72 },
  { id:'ngl-det', name:'Iron', city:'Detroit', division:'Midwest', market:60 },
  { id:'ngl-cle', name:'Lakeshore', city:'Cleveland', division:'Midwest', market:62 },
  { id:'ngl-ind', name:'Speedway', city:'Indianapolis', division:'Midwest', market:65 },
  { id:'ngl-cin', name:'Flames', city:'Cincinnati', division:'Midwest', market:62 },
  { id:'ngl-kc', name:'Current', city:'Kansas City', division:'Midwest', market:68 },
  // West
  { id:'ngl-dal', name:'Lone Stars', city:'Dallas', division:'West', market:85 },
  { id:'ngl-hou', name:'Oilmen', city:'Houston', division:'West', market:78 },
  { id:'ngl-den', name:'Summit', city:'Denver', division:'West', market:74 },
  { id:'ngl-sea', name:'Rain', city:'Seattle', division:'West', market:80 },
  { id:'ngl-bay', name:'Gold', city:'Bay City', division:'West', market:88 },
  { id:'ngl-lac', name:'Crown', city:'Los Angeles', division:'West', market:90 },
  { id:'ngl-las', name:'Surf', city:'Los Angeles', division:'West', market:85 },
  { id:'ngl-lvg', name:'Aces', city:'Las Vegas', division:'West', market:77 },
];

// ============================================================
// ABL — AMERICAN BASKETBALL LEAGUE (Basketball) — 30 Teams
// ALL NAMES FICTIONAL
// ============================================================
export const ABL_TEAMS = [
  // Atlantic
  { id:'abl-bos', name:'Minutemen', city:'Boston', division:'Atlantic', market:84 },
  { id:'abl-bkn', name:'Borough', city:'Brooklyn', division:'Atlantic', market:88 },
  { id:'abl-nyk', name:'Skyline', city:'New York', division:'Atlantic', market:95 },
  { id:'abl-phi', name:'Founders', city:'Philadelphia', division:'Atlantic', market:76 },
  { id:'abl-tor', name:'Mounties', city:'Toronto', division:'Atlantic', market:82 },
  // Central
  { id:'abl-chi', name:'Windbreakers', city:'Chicago', division:'Central', market:80 },
  { id:'abl-cle', name:'Guardians', city:'Cleveland', division:'Central', market:60 },
  { id:'abl-det', name:'Motors', city:'Detroit', division:'Central', market:58 },
  { id:'abl-ind', name:'Racers', city:'Indianapolis', division:'Central', market:62 },
  { id:'abl-mil', name:'Stags', city:'Milwaukee', division:'Central', market:60 },
  // Southeast
  { id:'abl-atl', name:'Firebirds', city:'Atlanta', division:'Southeast', market:74 },
  { id:'abl-cha', name:'Vipers', city:'Charlotte', division:'Southeast', market:65 },
  { id:'abl-mia', name:'Tide', city:'Miami', division:'Southeast', market:78 },
  { id:'abl-orl', name:'Solar', city:'Orlando', division:'Southeast', market:66 },
  { id:'abl-wdc', name:'Capitals', city:'Washington DC', division:'Southeast', market:78 },
  // Southwest
  { id:'abl-dal', name:'Mustangs', city:'Dallas', division:'Southwest', market:82 },
  { id:'abl-hou', name:'Comets', city:'Houston', division:'Southwest', market:76 },
  { id:'abl-mem', name:'Blues', city:'Memphis', division:'Southwest', market:60 },
  { id:'abl-nol', name:'Brass', city:'New Orleans', division:'Southwest', market:62 },
  { id:'abl-san', name:'Coyotes', city:'San Antonio', division:'Southwest', market:64 },
  // Northwest
  { id:'abl-den', name:'Altitude', city:'Denver', division:'Northwest', market:72 },
  { id:'abl-min', name:'Timberwings', city:'Minnesota', division:'Northwest', market:68 },
  { id:'abl-okc', name:'Drillers', city:'Oklahoma City', division:'Northwest', market:58 },
  { id:'abl-por', name:'Cascades', city:'Portland', division:'Northwest', market:70 },
  { id:'abl-uta', name:'Peaks', city:'Salt Lake', division:'Northwest', market:62 },
  // Pacific
  { id:'abl-bay', name:'Dynasty', city:'Bay City', division:'Pacific', market:90 },
  { id:'abl-lac', name:'Stars', city:'Los Angeles', division:'Pacific', market:88 },
  { id:'abl-lal', name:'Legends', city:'Los Angeles', division:'Pacific', market:92 },
  { id:'abl-phx', name:'Scorchers', city:'Phoenix', division:'Pacific', market:72 },
  { id:'abl-sac', name:'Monarchs', city:'Sacramento', division:'Pacific', market:64 },
];

// NGL Conference assignments: East = Northeast + Southeast, West = Midwest + West
export const NGL_CONFERENCES = {
  East: [
    'ngl-bos','ngl-nyt','ngl-nye','ngl-phi','ngl-bal','ngl-buf','ngl-pit','ngl-wdc',
    'ngl-mia','ngl-atl','ngl-car','ngl-tbb','ngl-nol','ngl-nas','ngl-jax','ngl-orl',
  ],
  West: [
    'ngl-chi','ngl-grb','ngl-min','ngl-det','ngl-cle','ngl-ind','ngl-cin','ngl-kc',
    'ngl-dal','ngl-hou','ngl-den','ngl-sea','ngl-bay','ngl-lac','ngl-las','ngl-lvg',
  ],
};

export const RIVALRIES = {
  ngl: [
    ['ngl-nyt','ngl-nye'],['ngl-bos','ngl-nyt'],['ngl-phi','ngl-nye'],
    ['ngl-pit','ngl-cle'],['ngl-chi','ngl-grb'],['ngl-dal','ngl-hou'],
    ['ngl-lac','ngl-las'],['ngl-sea','ngl-bay'],['ngl-mia','ngl-tbb'],
    ['ngl-bal','ngl-pit'],['ngl-min','ngl-det'],['ngl-den','ngl-kc'],
  ],
  abl: [
    ['abl-nyk','abl-bkn'],['abl-bos','abl-nyk'],['abl-lac','abl-lal'],
    ['abl-chi','abl-det'],['abl-mia','abl-atl'],['abl-dal','abl-hou'],
    ['abl-bay','abl-lac'],['abl-phi','abl-bos'],['abl-mil','abl-chi'],
  ],
};
