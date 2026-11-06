import type { MsgKey } from '../i18n/en';
import { B } from './balance';

/**
 * Per country: the hiring pool (how salaries and candidate stats compare with the baseline)
 * and rentMult, which scales an office's rent from B.offices.baseRent.
 */
export const COUNTRIES: Record<string, { pool: { salaryMult: number; skillMult: number }; rentMult: number }> = {
  TW: { pool: { salaryMult: 1, skillMult: 1 }, rentMult: 1 },
  CN: { pool: { salaryMult: 0.9, skillMult: 0.95 }, rentMult: 0.9 },
  SG: { pool: { salaryMult: 1.4, skillMult: 1.1 }, rentMult: 1.6 },
  KR: { pool: { salaryMult: 1.1, skillMult: 1 }, rentMult: 1.1 },
  JP: { pool: { salaryMult: 1.3, skillMult: 1.05 }, rentMult: 1.4 },
  US: { pool: { salaryMult: 1.6, skillMult: 1.1 }, rentMult: 1.8 },
  NL: { pool: { salaryMult: 1.5, skillMult: 1.1 }, rentMult: 1.6 },
  DE: { pool: { salaryMult: 1.5, skillMult: 1.1 }, rentMult: 1.5 },
  AU: { pool: { salaryMult: 1.4, skillMult: 1.05 }, rentMult: 1.5 },
  AE: { pool: { salaryMult: 1.2, skillMult: 1 }, rentMult: 1.3 },
  CA: { pool: { salaryMult: 1.5, skillMult: 1.05 }, rentMult: 1.6 },
  MX: { pool: { salaryMult: 0.8, skillMult: 0.9 }, rentMult: 0.8 },
  BR: { pool: { salaryMult: 0.85, skillMult: 0.9 }, rentMult: 0.9 },
  GB: { pool: { salaryMult: 1.5, skillMult: 1.1 }, rentMult: 1.7 },
  IT: { pool: { salaryMult: 1.3, skillMult: 1 }, rentMult: 1.3 },
  ZA: { pool: { salaryMult: 0.8, skillMult: 0.9 }, rentMult: 0.8 },
};

/** Coverage regions (spec §10): one per country, with big countries split. */
export const REGIONS: Record<string, { country: string }> = {
  TW: { country: 'TW' },
  'CN-N': { country: 'CN' },
  'CN-S': { country: 'CN' },
  SG: { country: 'SG' },
  KR: { country: 'KR' },
  JP: { country: 'JP' },
  'US-W': { country: 'US' },
  'US-E': { country: 'US' },
  'US-G': { country: 'US' },
  CA: { country: 'CA' },
  MX: { country: 'MX' },
  BR: { country: 'BR' },
  NL: { country: 'NL' },
  DE: { country: 'DE' },
  GB: { country: 'GB' },
  IT: { country: 'IT' },
  ZA: { country: 'ZA' },
  AU: { country: 'AU' },
  AE: { country: 'AE' },
};

export type PortId =
  | 'TPE'
  | 'SHA'
  | 'SZX'
  | 'SIN'
  | 'PUS'
  | 'TYO'
  | 'LAX'
  | 'NYC'
  | 'RTM'
  | 'HAM'
  | 'SYD'
  | 'DXB'
  | 'HOU'
  | 'VAN'
  | 'ZLO'
  | 'SSZ'
  | 'FXT'
  | 'GOA'
  | 'DUR';

export const PORTS: Record<PortId, { cityKey: MsgKey; lon: number; lat: number; regionId: string }> = {
  TPE: { cityKey: 'city.TPE', lon: 121.74, lat: 25.13, regionId: 'TW' },
  SHA: { cityKey: 'city.SHA', lon: 121.5, lat: 31.2, regionId: 'CN-N' },
  SZX: { cityKey: 'city.SZX', lon: 114.1, lat: 22.5, regionId: 'CN-S' },
  SIN: { cityKey: 'city.SIN', lon: 103.8, lat: 1.3, regionId: 'SG' },
  PUS: { cityKey: 'city.PUS', lon: 129.0, lat: 35.1, regionId: 'KR' },
  TYO: { cityKey: 'city.TYO', lon: 139.8, lat: 35.6, regionId: 'JP' },
  LAX: { cityKey: 'city.LAX', lon: -118.2, lat: 33.7, regionId: 'US-W' },
  NYC: { cityKey: 'city.NYC', lon: -74.0, lat: 40.7, regionId: 'US-E' },
  RTM: { cityKey: 'city.RTM', lon: 4.5, lat: 51.9, regionId: 'NL' },
  HAM: { cityKey: 'city.HAM', lon: 9.9, lat: 53.5, regionId: 'DE' },
  SYD: { cityKey: 'city.SYD', lon: 151.2, lat: -33.9, regionId: 'AU' },
  DXB: { cityKey: 'city.DXB', lon: 55.0, lat: 25.0, regionId: 'AE' },
  HOU: { cityKey: 'city.HOU', lon: -95.0, lat: 29.6, regionId: 'US-G' },
  VAN: { cityKey: 'city.VAN', lon: -123.1, lat: 49.3, regionId: 'CA' },
  ZLO: { cityKey: 'city.ZLO', lon: -104.3, lat: 19.05, regionId: 'MX' },
  SSZ: { cityKey: 'city.SSZ', lon: -46.3, lat: -23.95, regionId: 'BR' },
  FXT: { cityKey: 'city.FXT', lon: 1.35, lat: 51.95, regionId: 'GB' },
  GOA: { cityKey: 'city.GOA', lon: 8.9, lat: 44.4, regionId: 'IT' },
  DUR: { cityKey: 'city.DUR', lon: 30.9, lat: -29.9, regionId: 'ZA' },
};

export type HomePortId = 'TPE' | 'SHA' | 'SIN' | 'LAX' | 'RTM';
export const HOME_PORTS: readonly HomePortId[] = ['TPE', 'SHA', 'SIN', 'LAX', 'RTM'];

/**
 * Sea waypoints as [lon, lat]. Each edge in SEA_EDGES is short enough that the straight
 * line between its ends stays at sea, so a route drawn through them avoids land.
 */
export const SEA_NODES: Record<string, [lon: number, lat: number]> = {
  // East Asia
  yangtzeMouth: [123.2, 31.0],
  eastChinaSea: [125, 30],
  zhejiangOff: [123.3, 28.5],
  keelungOff: [121.8, 25.6],
  taiwanStraitNorth: [121.0, 25.4],
  taiwanStrait: [119.9, 24.2],
  hkApproach: [114.5, 21.8],
  okinawaSouth: [128.5, 25.8],
  koreaStrait: [128.9, 34.2],
  gotoWest: [128.2, 32.3],
  tokaraStrait: [130.0, 30.2],
  ryukyuEast: [131.5, 29.8],
  shikokuSouth: [134, 32.6],
  izuSouth: [139, 33.3],
  bosoSouth: [140.3, 34.3],
  tokyoBay: [139.7, 34.95],
  // Pacific
  northPacificMid: [180, 46],
  northPacificEast: [-150, 44],
  vancouverOff: [-126.5, 48.3],
  oregonOff: [-126, 42],
  californiaOff: [-121.5, 33.4],
  bajaOff: [-116.8, 29.0],
  manzanilloOff: [-105.5, 18.0],
  mexicoOff: [-105, 15],
  centralAmericaOff: [-90, 11],
  costaRicaOff: [-84, 7.3],
  panamaPacific: [-79.7, 6.9],
  panamaW: [-79.4, 8.7],
  panamaE: [-79.9, 9.5],
  pacificEquator: [-165, 2],
  newCaledoniaSouth: [167.5, -24],
  // Caribbean and Atlantic
  caribbeanSW: [-78, 12.5],
  windwardPassage: [-73.85, 20.0],
  inaguaEast: [-72.7, 20.6],
  caicosPassage: [-72.55, 22.05],
  bahamasNE: [-70, 28],
  nycApproach: [-73.6, 40.2],
  atlanticMid: [-40, 47],
  lesserAntilles: [-60, 13.5],
  // Gulf of Mexico
  houstonOff: [-94.5, 27.8],
  gulfMid: [-90, 25.5],
  yucatanChannel: [-85.8, 21.9],
  floridaStraits: [-80.0, 24.0],
  floridaEast: [-79.3, 26.8],
  // Brazil
  santosOff: [-44, -25.5],
  caboFrioOff: [-39, -24],
  bahiaOff: [-36, -16],
  brazilEast: [-32, -8],
  amazonOff: [-44, 4],
  // East Atlantic
  capeVerdeOff: [-26, 14],
  canariesOff: [-19, 28],
  // West Africa
  liberiaOff: [-13, 4.5],
  gulfGuinea: [3, 1],
  angolaOff: [9, -12],
  namibiaOff: [11, -26],
  // South Africa
  capeAgulhas: [20, -36.5],
  portElizabethOff: [27, -35],
  durbanOff: [32.5, -30.5],
  // Europe
  ushant: [-6, 48.6],
  channelMid: [-3, 49.95],
  channelEast: [0.5, 50.3],
  doverStrait: [1.45, 51.0],
  northSeaSouth: [3.3, 52.0],
  texelWest: [4.0, 53.2],
  frisianNorth: [6.5, 53.9],
  elbeMouth: [8.3, 54.05],
  felixstoweOff: [2.4, 51.9],
  finisterre: [-10.5, 43.2],
  capeStVincent: [-9.8, 36.6],
  gibraltar: [-6, 35.95],
  // Mediterranean, Suez and Red Sea
  alboran: [-3.5, 36.05],
  westernMed: [-1.5, 36.6],
  tunisNorth: [8, 38],
  ligurianSea: [8.5, 43.3],
  sicilyChannel: [11.7, 37.3],
  maltaSouth: [14.5, 35.5],
  easternMed: [25, 33.5],
  suezNorth: [32.4, 31.6],
  suezSouth: [32.55, 29.85],
  suezGulf: [32.9, 29.05],
  suezGulfSouth: [33.75, 27.85],
  redSeaNorth: [35.5, 26],
  redSeaMid: [38.5, 20],
  redSeaSouth: [42, 14.5],
  babElMandeb: [43.35, 12.6],
  adenWest: [45.5, 12.2],
  adenEast: [52, 13.6],
  // Indian Ocean and Gulf
  omanSouth: [59.5, 18],
  omanEast: [60.5, 22.5],
  gulfOfOman: [58, 24.9],
  hormuz: [56.5, 26.6],
  persianGulfEast: [55.6, 26.2],
  sriLankaSouth: [81, 5.2],
  somaliaOff: [52, 2],
  madagascarEast: [53, -21],
  madagascarSouth: [46, -28.5],
  acehNorth: [95.5, 6.4],
  malacca: [99, 4.5],
  malaccaSouth: [102.2, 1.9],
  singaporeStrait: [103.75, 1.2],
  singaporeEast: [104.8, 1.35],
  // South China Sea
  scsSouth: [106.5, 5],
  scsMid: [110, 11],
  scsNorth: [113.3, 16.5],
  // Indonesia, Torres Strait and eastern Australia
  karimata: [108.6, -2.6],
  javaSea: [112, -5],
  javaSeaEast: [117, -6],
  floresSea: [121, -6.6],
  bandaSea: [127, -6],
  timorSea: [130.5, -9.2],
  arafuraSea: [138, -10],
  torresWest: [141.5, -10.6],
  torresEast: [143.5, -10.0],
  coralSea: [147, -13],
  coralSeaSouth: [154.3, -24.5],
  nswNorth: [154, -29.5],
  nswMid: [153.4, -32],
};

/** Undirected edges among sea nodes and ports. Each port has its own approach edges. */
export const SEA_EDGES: [string, string][] = [
  // Port approaches
  ['TPE', 'keelungOff'],
  ['SHA', 'yangtzeMouth'],
  ['SZX', 'hkApproach'],
  ['SIN', 'singaporeStrait'],
  ['PUS', 'koreaStrait'],
  ['TYO', 'tokyoBay'],
  ['LAX', 'californiaOff'],
  ['LAX', 'bajaOff'],
  ['NYC', 'nycApproach'],
  ['RTM', 'northSeaSouth'],
  ['HAM', 'elbeMouth'],
  ['SYD', 'nswMid'],
  ['DXB', 'persianGulfEast'],
  ['HOU', 'houstonOff'],
  ['VAN', 'vancouverOff'],
  ['ZLO', 'manzanilloOff'],
  ['SSZ', 'santosOff'],
  ['FXT', 'felixstoweOff'],
  ['GOA', 'ligurianSea'],
  ['DUR', 'durbanOff'],
  // East Asia
  ['yangtzeMouth', 'eastChinaSea'],
  ['yangtzeMouth', 'zhejiangOff'],
  ['zhejiangOff', 'eastChinaSea'],
  ['zhejiangOff', 'keelungOff'],
  ['zhejiangOff', 'taiwanStraitNorth'],
  ['keelungOff', 'taiwanStraitNorth'],
  ['keelungOff', 'okinawaSouth'],
  ['taiwanStraitNorth', 'taiwanStrait'],
  ['taiwanStrait', 'hkApproach'],
  ['okinawaSouth', 'ryukyuEast'],
  ['eastChinaSea', 'koreaStrait'],
  ['eastChinaSea', 'tokaraStrait'],
  ['koreaStrait', 'gotoWest'],
  ['gotoWest', 'tokaraStrait'],
  ['tokaraStrait', 'ryukyuEast'],
  ['ryukyuEast', 'shikokuSouth'],
  ['shikokuSouth', 'izuSouth'],
  ['izuSouth', 'bosoSouth'],
  ['bosoSouth', 'tokyoBay'],
  // Pacific
  ['ryukyuEast', 'northPacificMid'],
  ['bosoSouth', 'northPacificMid'],
  ['northPacificMid', 'northPacificEast'],
  ['northPacificEast', 'californiaOff'],
  ['californiaOff', 'bajaOff'],
  ['bajaOff', 'mexicoOff'],
  ['mexicoOff', 'centralAmericaOff'],
  ['centralAmericaOff', 'costaRicaOff'],
  ['costaRicaOff', 'panamaPacific'],
  ['panamaPacific', 'panamaW'],
  ['panamaW', 'panamaE'],
  ['californiaOff', 'pacificEquator'],
  ['pacificEquator', 'newCaledoniaSouth'],
  ['newCaledoniaSouth', 'nswNorth'],
  ['vancouverOff', 'northPacificEast'],
  ['vancouverOff', 'oregonOff'],
  ['oregonOff', 'californiaOff'],
  ['manzanilloOff', 'mexicoOff'],
  ['manzanilloOff', 'bajaOff'],
  // Caribbean and Atlantic
  ['panamaE', 'caribbeanSW'],
  ['caribbeanSW', 'windwardPassage'],
  ['windwardPassage', 'inaguaEast'],
  ['inaguaEast', 'caicosPassage'],
  ['caicosPassage', 'bahamasNE'],
  ['bahamasNE', 'nycApproach'],
  ['bahamasNE', 'atlanticMid'],
  ['nycApproach', 'atlanticMid'],
  ['atlanticMid', 'ushant'],
  ['atlanticMid', 'capeStVincent'],
  // Gulf of Mexico
  ['houstonOff', 'gulfMid'],
  ['gulfMid', 'yucatanChannel'],
  ['yucatanChannel', 'caribbeanSW'],
  ['gulfMid', 'floridaStraits'],
  ['floridaStraits', 'floridaEast'],
  ['floridaEast', 'bahamasNE'],
  // Brazil and the Lesser Antilles
  ['santosOff', 'caboFrioOff'],
  ['caboFrioOff', 'bahiaOff'],
  ['bahiaOff', 'brazilEast'],
  ['brazilEast', 'amazonOff'],
  ['amazonOff', 'lesserAntilles'],
  ['lesserAntilles', 'caribbeanSW'],
  ['lesserAntilles', 'bahamasNE'],
  // East Atlantic
  ['brazilEast', 'capeVerdeOff'],
  ['capeVerdeOff', 'canariesOff'],
  ['canariesOff', 'capeStVincent'],
  // West Africa, the Cape and the South Atlantic
  ['liberiaOff', 'capeVerdeOff'],
  ['gulfGuinea', 'liberiaOff'],
  ['angolaOff', 'gulfGuinea'],
  ['namibiaOff', 'angolaOff'],
  ['capeAgulhas', 'namibiaOff'],
  ['capeAgulhas', 'santosOff'],
  ['portElizabethOff', 'capeAgulhas'],
  ['durbanOff', 'portElizabethOff'],
  ['portElizabethOff', 'madagascarSouth'],
  ['durbanOff', 'madagascarSouth'],
  // Europe
  ['ushant', 'channelMid'],
  ['channelMid', 'channelEast'],
  ['channelEast', 'doverStrait'],
  ['doverStrait', 'northSeaSouth'],
  ['northSeaSouth', 'texelWest'],
  ['texelWest', 'frisianNorth'],
  ['frisianNorth', 'elbeMouth'],
  ['felixstoweOff', 'northSeaSouth'],
  ['felixstoweOff', 'doverStrait'],
  ['ushant', 'finisterre'],
  ['finisterre', 'capeStVincent'],
  ['capeStVincent', 'gibraltar'],
  // Mediterranean, Suez and Red Sea
  ['gibraltar', 'alboran'],
  ['alboran', 'westernMed'],
  ['westernMed', 'tunisNorth'],
  ['tunisNorth', 'sicilyChannel'],
  ['ligurianSea', 'tunisNorth'],
  ['sicilyChannel', 'maltaSouth'],
  ['maltaSouth', 'easternMed'],
  ['easternMed', 'suezNorth'],
  ['suezNorth', 'suezSouth'],
  ['suezSouth', 'suezGulf'],
  ['suezGulf', 'suezGulfSouth'],
  ['suezGulfSouth', 'redSeaNorth'],
  ['redSeaNorth', 'redSeaMid'],
  ['redSeaMid', 'redSeaSouth'],
  ['redSeaSouth', 'babElMandeb'],
  ['babElMandeb', 'adenWest'],
  ['adenWest', 'adenEast'],
  // Indian Ocean and Gulf
  ['adenEast', 'omanSouth'],
  ['adenEast', 'sriLankaSouth'],
  ['omanSouth', 'omanEast'],
  ['omanEast', 'sriLankaSouth'],
  ['omanEast', 'gulfOfOman'],
  ['gulfOfOman', 'hormuz'],
  ['hormuz', 'persianGulfEast'],
  ['sriLankaSouth', 'acehNorth'],
  ['acehNorth', 'malacca'],
  ['madagascarSouth', 'madagascarEast'],
  ['madagascarEast', 'somaliaOff'],
  ['somaliaOff', 'adenEast'],
  ['madagascarEast', 'sriLankaSouth'],
  ['malacca', 'malaccaSouth'],
  ['malaccaSouth', 'singaporeStrait'],
  ['singaporeStrait', 'singaporeEast'],
  // South China Sea
  ['singaporeEast', 'scsSouth'],
  ['scsSouth', 'scsMid'],
  ['scsMid', 'scsNorth'],
  ['scsNorth', 'hkApproach'],
  // Indonesia, Torres Strait and eastern Australia
  ['singaporeEast', 'karimata'],
  ['scsSouth', 'karimata'],
  ['karimata', 'javaSea'],
  ['javaSea', 'javaSeaEast'],
  ['javaSeaEast', 'floresSea'],
  ['floresSea', 'bandaSea'],
  ['bandaSea', 'timorSea'],
  ['timorSea', 'arafuraSea'],
  ['arafuraSea', 'torresWest'],
  ['torresWest', 'torresEast'],
  ['torresEast', 'coralSea'],
  ['coralSea', 'coralSeaSouth'],
  ['coralSeaSouth', 'nswNorth'],
  ['nswNorth', 'nswMid'],
];

export interface Route {
  nodeIds: string[];
  waypoints: [number, number][];
  distanceKm: number;
}

const EARTH_RADIUS_KM = 6371;

function haversineKm([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function isPort(id: string): id is PortId {
  return id in PORTS;
}

function coords(id: string): [number, number] {
  if (isPort(id)) return [PORTS[id].lon, PORTS[id].lat];
  const node = SEA_NODES[id];
  if (!node) throw new Error(`Unknown sea node: ${id}`);
  return node;
}

let graph: Map<string, { to: string; km: number }[]> | null = null;

function getGraph(): Map<string, { to: string; km: number }[]> {
  if (graph) return graph;
  const g = new Map<string, { to: string; km: number }[]>();
  const link = (from: string, to: string, km: number) => {
    const list = g.get(from) ?? [];
    list.push({ to, km });
    g.set(from, list);
  };
  for (const [a, b] of SEA_EDGES) {
    const km = haversineKm(coords(a), coords(b));
    link(a, b, km);
    link(b, a, km);
  }
  graph = g;
  return g;
}

/** Dijkstra over the sea graph. Other ports are never passed through, only departed from or arrived at. */
function shortestPath(from: PortId, to: PortId): string[] {
  const g = getGraph();
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string>();
  const done = new Set<string>();
  for (;;) {
    let current: string | null = null;
    let best = Infinity;
    for (const [id, d] of dist) {
      if (!done.has(id) && d < best) {
        best = d;
        current = id;
      }
    }
    if (current === null) throw new Error(`No sea route from ${from} to ${to}`);
    if (current === to) break;
    done.add(current);
    if (current !== from && isPort(current)) continue;
    for (const { to: next, km } of g.get(current) ?? []) {
      const d = best + km;
      if (d < (dist.get(next) ?? Infinity)) {
        dist.set(next, d);
        prev.set(next, current);
      }
    }
  }
  const path: string[] = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0])!);
  return path;
}

const routeCache = new Map<string, Route>();

/** Shortest sea route between two ports, memoized. A→B and B→A share one path, reversed. */
export function route(from: PortId, to: PortId): Route {
  const key = `${from}>${to}`;
  const cached = routeCache.get(key);
  if (cached) return cached;
  let nodeIds: string[];
  if (from > to) {
    nodeIds = [...route(to, from).nodeIds].reverse();
  } else {
    nodeIds = shortestPath(from, to);
  }
  const waypoints = nodeIds.map(coords);
  let km = 0;
  for (let i = 1; i < waypoints.length; i++) km += haversineKm(waypoints[i - 1], waypoints[i]);
  const result: Route = { nodeIds, waypoints, distanceKm: Math.round(km) };
  routeCache.set(key, result);
  return result;
}

export function transitDays(from: PortId, to: PortId): number {
  return Math.max(B.ship.minTransitDays, Math.round(route(from, to).distanceKm / B.ship.kmPerDay));
}
