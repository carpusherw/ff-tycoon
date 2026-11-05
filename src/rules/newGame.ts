import { B } from './balance';
import { newId } from './ids';
import type { GameState, Mode } from './types';
import { PORTS, STARTER_AGENT_PRIORITY, type HomePortId } from './world';

export function createGame(opts: { seed: number; homePortId: HomePortId; mode: Mode }): GameState {
  const { seed, homePortId, mode } = opts;
  const s: GameState = {
    version: 1,
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
    stats: { quotesWon: 0, quotesLost: 0, deliveredDays: [], revenue: [] },
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

  for (const portId of STARTER_AGENT_PRIORITY[homePortId].slice(0, B.starterAgents[mode])) {
    s.agents.push({ id: newId(s, 'a'), portId, regionId: PORTS[portId].regionId });
  }

  return s;
}
