// BUSINESS OF BALL — UNIFIED NAME DATABASE
// All names fictional — no real athlete or coach names
function pick(a){return a[Math.floor(Math.random()*a.length)];}

const FIRST_NAMES=[
'Kaelan','Javonte','Tyrese','Marquell','Deshon','Braylon','Kendrik','Alonzo','Terrell','Jaleel',
'Rashaun','Dakari','Zephyr','Montez','Tavius','Devante','Alaric','Kamren','Jaylon','Quintel',
'Broderick','Cedwin','Damarcus','Evanston','Fenwick','Garson','Harlowe','Inman','Jentry','Kelwyn',
'Landric','Maxfield','Norvel','Orland','Prescott','Quintero','Rashford','Severin','Tobin','Ulric',
'Vander','Warrick','Xavian','Yardley','Zander','Ashwin','Braylen','Camrin','Dallin','Emmeric',
'Florian','Garrison','Hawken','Ilan','Jarek','Kolten','Leandro','Mateo','Niko','Ozias',
'Paulsen','Quade','Ronan','Stellan','Theron','Upton','Viktor','Wynton','Xander','Yosef',
'Zarian','Adler','Beckett','Caelum','Dashiel','Elio','Fenn','Griffon','Hadrian','Idris',
'Jorvik','Kade','Lucero','Magnus','Nestor','Orin','Pike','Quillan','Ryland','Soren',
'Tavio','Udo','Vesper','Wystan','Xerxes','Yannick','Zenith','Amaro','Bowen','Calloway',
];
const LAST_NAMES=[
'Ashford','Blackstone','Calloway','Draven','Everhart','Foxworth','Greyson','Hollister','Irvington','Jenner',
'Kingsley','Langford','Mercer','Northcott','Overstreet','Pennington','Quartermaine','Radcliffe','Stonebridge','Thornwell',
'Underhill','Vickers','Whitmore','Yarbrough','Zellner','Aldridge','Barksdale','Crestwood','Donavan','Eastwick',
'Fairbanks','Grantham','Hartwell','Isley','Jarrett','Kensington','Lockwood','Montague','Newbury','Oakridge',
'Pemberton','Quinlan','Rutherford','Sheridan','Townsend','Upton','Vandermeer','Windham','Yarmouth','Ziegler',
'Alvarado','Bautista','Cordero','Delgado','Escobar','Fuentes','Galindo','Herrera','Ibarra','Jurado',
'Kaelin','Linares','Machado','Navarro','Orozco','Padilla','Quesada','Romero','Salazar','Tejada',
'Uribe','Valentin','Weston','Ximenez','Yanez','Zavala','Ankov','Borislav','Chernov','Demidov',
'Fedorov','Grigoriev','Haruki','Ishikawa','Johansson','Kruger','Lindgren','Matsuda','Nishimura','Ostrowski',
'Petrova','Richter','Svensson','Takahashi','Volkov','Werner','Yamashita','Afolabi','Mensah','Okonkwo',
];
const COACH_FIRST=[
'Aldric','Burke','Carsten','Darnell','Elton','Fletcher','Graham','Horace','Irving','Jerome',
'Kendall','Layton','Merrick','Norman','Otis','Palmer','Quentin','Roland','Sterling','Thaddeus',
'Wallace','Virgil','Desmond','Franklin','Leroy','Marvin','Clarence','Sheldon','Vernon','Winston',
];
const COACH_LAST=[
'Ashworth','Blackwell','Callister','Drummond','Enwright','Fairchild','Goodwin','Harbaugh','Ingersoll','Kessler',
'Lombard','McElroy','Nordstrom','Osbourne','Prescott','Redmond','Stallworth','Travers','Underwood','Wainwright',
'Yarborough','Zimmerman','Castellano','DeLuca','Espinoza','Fujimoto','Gustafson','Heidecker','Johanssen','Kowalczyk',
];
export function generatePlayerName(){return pick(FIRST_NAMES)+' '+pick(LAST_NAMES);}
export function generateCoachName(){return pick(COACH_FIRST)+' '+pick(COACH_LAST);}
