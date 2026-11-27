import { B } from './balance';
import { createGame } from './newGame';
import { nextFloat } from './rng';
import { HOME_PORTS, PORTS, REGIONS, type PortId } from './world';

/** The main stream after `draws` draws from the seed: one per starter agent's name. */
function mainStreamAfter(seed: number, draws: number): number {
  const rng = { rngState: seed };
  for (let i = 0; i < draws; i++) nextFloat(rng);
  return rng.rngState;
}

describe('createGame', () => {
  it('starts with the owner only', () => {
    const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
    expect(s.employees.length).toBe(1);
    expect(s.employees[0].isOwner).toBe(true);
    expect(s.employees[0].salary).toBe(0);
    expect(s.employees[0].dept).toBe('sales');
    expect(s.employees[0].officeId).toBe('o1');
    expect(s.offices).toEqual([{ id: 'o1', portId: 'TPE', regionId: 'TW', rent: B.homeRent }]);
    expect(s.day).toBe(0);
    expect(s.cash).toBe(B.startCash);
    expect(s.rngState).toBe(mainStreamAfter(1, B.starterAgents.normal));
  });

  it('signs one starter agent per port, none in the home country', () => {
    for (const homePortId of HOME_PORTS) {
      for (const mode of ['easy', 'normal', 'hardcore'] as const) {
        for (let seed = 1; seed <= 40; seed++) {
          const s = createGame({ seed, homePortId, mode });
          const ports = s.agents.map((a) => a.portId);
          expect(ports.length).toBe(B.starterAgents[mode]);
          expect(new Set(ports).size).toBe(ports.length);
          for (const a of s.agents) {
            expect(REGIONS[PORTS[a.portId as PortId].regionId].country).not.toBe(REGIONS[PORTS[homePortId].regionId].country);
            expect(a.regionId).toBe(PORTS[a.portId as PortId].regionId);
          }
        }
      }
    }
  });

  it('the starter agents depend on the seed', () => {
    const picks = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      picks.add(createGame({ seed, homePortId: 'TPE', mode: 'normal' }).agents.map((a) => a.portId).join(','));
    }
    expect(picks.size).toBeGreaterThan(1);
  });

  it('picking the starter ports uses its own stream; only their names draw from the main one', () => {
    expect(createGame({ seed: 7, homePortId: 'SHA', mode: 'easy' }).rngState).toBe(mainStreamAfter(7, B.starterAgents.easy));
  });

  it('is reproducible', () => {
    const opts = { seed: 1, homePortId: 'TPE', mode: 'normal' } as const;
    expect(createGame(opts)).toEqual(createGame(opts));
  });
});
