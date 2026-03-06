// ============================================================
// FRANCHISE BUILDER V2 — LEAGUE DATA & CONSTANTS
// ============================================================

// --- SALARY CAPS ---
export const NGL_SALARY_CAP = 285; // millions
export const ABL_SALARY_CAP = 140; // millions
export const CAP_INFLATION_RATE = 0.03; // 3% per season

// --- ROSTER SIZES ---
export const NGL_ROSTER_SIZE = 22;
export const ABL_ROSTER_SIZE = 15;

// --- DRAFT ---
export const NGL_DRAFT_ROUNDS = 7;
export const ABL_DRAFT_ROUNDS = 2;

// --- POSITIONS ---
export const NGL_POSITIONS = ['QB','RB','WR','WR','TE','OT','OT','OG','OG','C','DE','DE','DT','DT','LB','LB','LB','CB','CB','S','S','K'];
export const ABL_POSITIONS = ['PG','SG','SF','PF','C','PG','SG','SF','PF','C','SG','SF','PF','PG','C'];

// --- PEAK AGES ---
export const PEAK_AGES = { ngl: [26, 30], abl: [25, 29] };

// --- TRAITS ---
export const PLAYER_TRAITS = ['mercenary','volatile','hometown','leader','showman','ironman','injury_prone','clutch'];
export const TRAIT_WEIGHTS = [0.12, 0.1, 0.12, 0.12, 0.1, 0.08, 0.08, 0.1]; // remaining ~18% = no trait

// --- COACH PERSONALITIES ---
export const COACH_PERSONALITIES = ['Players Coach', 'Disciplinarian', 'Tactician', 'Showman'];

// --- CITY ECONOMIES ---
export const CITY_ECONOMY_BASE = {
  'New York': 92, 'Los Angeles': 90, 'Chicago': 82, 'Dallas': 80, 'Houston': 78,
  'Philadelphia': 75, 'Boston': 85, 'Miami': 78, 'Atlanta': 76, 'Bay City': 88,
  'Seattle': 80, 'Denver': 74, 'Las Vegas': 77, 'Nashville': 72, 'Baltimore': 68,
  'Tampa Bay': 70, 'Cleveland': 62, 'Pittsburgh': 66, 'Indianapolis': 65,
  'Kansas City': 68, 'New Orleans': 64, 'Green Bay': 55, 'Minnesota': 72,
  'Detroit': 60, 'Buffalo': 58, 'Carolina': 68, 'Portland': 72, 'Salt Lake': 65,
  'Sacramento': 66, 'Desert City': 60, 'San Diego': 74,
  'Brooklyn': 88, 'Milwaukee': 62, 'Toronto': 82, 'San Antonio': 65,
  'Orlando': 68, 'Memphis': 60, 'Oklahoma City': 58, 'Charlotte': 70,
  'Washington DC': 85, 'Phoenix': 72,
};

// ============================================================
// NGL TEAMS — 32 Teams
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
  { id:'ngl-jax', name:'Gators', city:'Jacksonville', division:'Southeast', market:58 },
  { id:'ngl-orl', name:'Storms', city:'Orlando', division:'Southeast', market:65 },
  // Midwest
  { id:'ngl-chi', name:'Wolves', city:'Chicago', division:'Midwest', market:82 },
  { id:'ngl-grb', name:'Frost', city:'Green Bay', division:'Midwest', market:55 },
  { id:'ngl-min', name:'North', city:'Minnesota', division:'Midwest', market:72 },
  { id:'ngl-det', name:'Iron', city:'Detroit', division:'Midwest', market:60 },
  { id:'ngl-cle', name:'Lakeshore', city:'Cleveland', division:'Midwest', market:62 },
  { id:'ngl-ind', name:'Speedway', city:'Indianapolis', division:'Midwest', market:65 },
  { id:'ngl-cin', name:'Flames', city:'Cincinnati', division:'Midwest', market:60 },
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
// ABL TEAMS — 30 Teams
// ============================================================
export const ABL_TEAMS = [
  // Eastern
  { id:'abl-bos', name:'Minutemen', city:'Boston', division:'Atlantic', market:84 },
  { id:'abl-bkn', name:'Borough', city:'Brooklyn', division:'Atlantic', market:88 },
  { id:'abl-nyk', name:'Skyline', city:'New York', division:'Atlantic', market:95 },
  { id:'abl-phi', name:'Founders', city:'Philadelphia', division:'Atlantic', market:76 },
  { id:'abl-tor', name:'Mounties', city:'Toronto', division:'Atlantic', market:82 },
  { id:'abl-chi', name:'Windbreakers', city:'Chicago', division:'Central', market:80 },
  { id:'abl-cle', name:'Guardians', city:'Cleveland', division:'Central', market:60 },
  { id:'abl-det', name:'Pistons', city:'Detroit', division:'Central', market:58 },
  { id:'abl-ind', name:'Racers', city:'Indianapolis', division:'Central', market:62 },
  { id:'abl-mil', name:'Bucks', city:'Milwaukee', division:'Central', market:60 },
  { id:'abl-atl', name:'Hawks', city:'Atlanta', division:'Southeast', market:74 },
  { id:'abl-cha', name:'Hornets', city:'Charlotte', division:'Southeast', market:65 },
  { id:'abl-mia', name:'Tide', city:'Miami', division:'Southeast', market:78 },
  { id:'abl-orl', name:'Solar', city:'Orlando', division:'Southeast', market:66 },
  { id:'abl-wdc', name:'Capitals', city:'Washington DC', division:'Southeast', market:78 },
  // Western
  { id:'abl-dal', name:'Mustangs', city:'Dallas', division:'Southwest', market:82 },
  { id:'abl-hou', name:'Rockets', city:'Houston', division:'Southwest', market:76 },
  { id:'abl-mem', name:'Blues', city:'Memphis', division:'Southwest', market:60 },
  { id:'abl-nol', name:'Brass', city:'New Orleans', division:'Southwest', market:62 },
  { id:'abl-san', name:'Spurs', city:'San Antonio', division:'Southwest', market:64 },
  { id:'abl-den', name:'Altitude', city:'Denver', division:'Northwest', market:72 },
  { id:'abl-min', name:'Timberwolves', city:'Minnesota', division:'Northwest', market:68 },
  { id:'abl-okc', name:'Thunder', city:'Oklahoma City', division:'Northwest', market:58 },
  { id:'abl-por', name:'Trailblazers', city:'Portland', division:'Northwest', market:70 },
  { id:'abl-uta', name:'Summit', city:'Salt Lake', division:'Northwest', market:62 },
  { id:'abl-bay', name:'Dynasty', city:'Bay City', division:'Pacific', market:90 },
  { id:'abl-lac', name:'Stars', city:'Los Angeles', division:'Pacific', market:88 },
  { id:'abl-lal', name:'Legends', city:'Los Angeles', division:'Pacific', market:92 },
  { id:'abl-phx', name:'Suns', city:'Phoenix', division:'Pacific', market:72 },
  { id:'abl-sac', name:'Kings', city:'Sacramento', division:'Pacific', market:64 },
];

// ============================================================
// RIVALRIES (predefined heated matchups)
// ============================================================
export const RIVALRIES = {
  ngl: [
    ['ngl-nyt','ngl-nye'], ['ngl-bos','ngl-nyt'], ['ngl-phi','ngl-nye'],
    ['ngl-pit','ngl-cle'], ['ngl-chi','ngl-grb'], ['ngl-dal','ngl-hou'],
    ['ngl-lac','ngl-las'], ['ngl-sea','ngl-bay'], ['ngl-mia','ngl-tbb'],
    ['ngl-bal','ngl-pit'], ['ngl-min','ngl-det'], ['ngl-den','ngl-kc'],
  ],
  abl: [
    ['abl-nyk','abl-bkn'], ['abl-bos','abl-nyk'], ['abl-lac','abl-lal'],
    ['abl-chi','abl-det'], ['abl-mia','abl-atl'], ['abl-dal','abl-hou'],
    ['abl-bay','abl-lac'], ['abl-phi','abl-bos'], ['abl-mil','abl-chi'],
  ],
};

// ============================================================
// NAME GENERATION DATA
// ============================================================
export const FIRST_NAMES = [
  'Marcus','James','DeShawn','Tyler','Brandon','Michael','Chris','Andre','Justin','Jaylen',
  'Malik','Cameron','Darius','Isaiah','Tre','Devon','Lamar','CJ','Darnell','Terrance',
  'Xavier','Khalil','Jamal','Aaron','Derek','Tavon','Reggie','LaMarcus','Donovan','Jace',
  'Kyler','Zach','Patrick','Russell','Jordan','Trey','Devin','Quincy','Avery','Marquis',
  'Caleb','Elijah','Miles','Vincent','Ray','Keith','Damian','Nate','Tyrell','Bryce',
  'Aidan','Connor','Blake','Hunter','Jake','Kyle','Liam','Noah','Mason','Ethan',
  'Logan','Jackson','Carson','Cole','Chase','Ryan','Sean','Matt','Cooper','Brock',
  'Grant','Travis','Austin','Cody','Weston','Reed','Tucker','Hayes','Colton','Pierce',
  'Antonio','Diego','Carlos','Rafael','Luis','Jorge','Santos','Miguel','Alejandro','Eduardo',
];

export const LAST_NAMES = [
  'Johnson','Williams','Brown','Jones','Davis','Miller','Wilson','Anderson','Thomas','Jackson',
  'White','Harris','Martin','Thompson','Robinson','Clark','Lewis','Walker','Hall','Allen',
  'Young','King','Wright','Scott','Green','Baker','Adams','Nelson','Hill','Campbell',
  'Mitchell','Roberts','Carter','Phillips','Evans','Turner','Torres','Parker','Collins','Edwards',
  'Stewart','Morris','Rogers','Reed','Cook','Morgan','Bell','Murphy','Bailey','Rivera',
  'Cooper','Richardson','Cox','Howard','Ward','Brooks','Gray','Watson','Price','Bennett',
  'Wood','Barnes','Ross','Henderson','Coleman','Jenkins','Perry','Powell','Long','Patterson',
  'Washington','Butler','Simmons','Foster','Bryant','Russell','Griffin','Hayes','Diaz','Marshall',
  'Owens','Hamilton','Graham','Sullivan','Wallace','Freeman','Hunt','Stone','Crawford','Mason',
];

export const COACH_FIRST_NAMES = [
  'Bill','Mike','Tony','Steve','Jim','Bob','Greg','Tom','Dan','Ron',
  'Pete','Kevin','Sean','Frank','Rick','Gary','Doug','Ray','Jeff','Mark',
];

export const COACH_LAST_NAMES = [
  'Callahan','Moretti','Chen','Okafor','Sullivan','Peterson','Rivera','Kowalski',
  'Nakamura','Blackwell','Drummond','Ashworth','Patel','O\'Brien','Vasquez','Thornton',
  'Gustafson','Hamilton','Fitzpatrick','Reeves','Whitfield','Lombardi','Harbaugh','Shanahan',
];
