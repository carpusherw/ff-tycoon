import { B } from './balance';
import { newId } from './ids';
import { addAgent } from './network';
import type { GameState, Mode } from './types';
import { randInt } from './rng';
import { PORTS, REGIONS, type HomePortId, type PortId } from './world';
import { emptyYearTotals } from './yearReport';

export function createGame(opts: { seed: number; homePortId: HomePortId; mode: Mode }): GameState {
  const { seed, homePortId, mode } = opts;
  const s: GameState = {
    version: 2,
    seed,
    rngState: seed,
    mode,
    day: 0,
    cash: B.startCash,
    nextId: 1,
    offices: [],
    agents: [],
    employees: [],
    customers: [],
    shipments: [],
    tasks: [],
    hiring: null,
    log: [],
    pauseReasons: [],
    ended: null,
    stats: { quotesWon: 0, quotesLost: 0, delivered: [], revenue: [] },
    yearReports: [],
    yearStart: { cash: B.startCash, quotesWon: 0, quotesLost: 0 },
    yearTotals: emptyYearTotals(),
  };

  // The office is created first so its id is always `o1`.
  const officeId = newId(s, 'o');
  s.offices.push({ id: officeId, portId: homePortId, regionId: PORTS[homePortId].regionId, rent: B.homeRent });

  // The UI shows the owner with a translated label, so the name stays empty.
  s.employees.push({
    id: newId(s, 'e'),
    name: '',
    officeId,
    dept: 'sales',
    isOwner: true,
    salary: 0,
    hiredDay: 0,
    ...B.owner,
  });

  // Their names come from the main random stream, so it no longer starts at the seed.
  for (const portId of pickStarterPorts(seed, homePortId, B.starterAgents[mode])) addAgent(s, portId);

  return s;
}

const countryOf = (portId: PortId) => REGIONS[PORTS[portId].regionId].country;

/**
 * Picks `count` different ports outside the home country for the starter agents. The pick
 * uses its own stream derived from the seed, so the run's main random stream starts the same.
 */
function pickStarterPorts(seed: number, homePortId: HomePortId, count: number): PortId[] {
  const rng = { rngState: (seed ^ 0x5eed5eed) | 0 };
  const pool = (Object.keys(PORTS) as PortId[]).filter((p) => countryOf(p) !== countryOf(homePortId));
  for (let i = 0; i < count && i < pool.length; i++) {
    const j = randInt(rng, i, pool.length - 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
