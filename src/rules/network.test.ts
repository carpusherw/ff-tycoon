import { B } from './balance';
import { AGENT_NAMES } from './names';
import { addAgent, canOpen, canSign, coveredRegions, farEndFor, lanesFor, openOffice, signAgent } from './network';
import { createGame } from './newGame';
import { companyValue } from './score';
import type { GameState } from './types';
import { PORTS, REGIONS, type PortId } from './world';

/** A Taipei game with no agents, so tests choose every region's coverage themselves. */
function bareGame(cash = 1_000_000): GameState {
  const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
  s.agents = [];
  s.cash = cash;
  return s;
}

const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s)) as GameState;

describe('signAgent', () => {
  it('signing costs 5000, opens the region and names the agent', () => {
    const s = bareGame(20000);
    s.day = 42;
    expect(coveredRegions(s).has('US-W')).toBe(false);

    expect(signAgent(s, 'LAX')).toEqual({ ok: true });

    expect(s.cash).toBe(15000);
    expect(s.yearTotals.expansion).toBe(5000);
    expect(coveredRegions(s).has('US-W')).toBe(true);
    expect(s.agents).toHaveLength(1);
    const agent = s.agents[0];
    expect(agent).toMatchObject({ portId: 'LAX', regionId: 'US-W', signedDay: 42 });
    expect(agent.name).not.toBe('');
    expect(s.log[0]).toEqual({
      day: 42,
      tone: 'good',
      msg: { key: 'log.agentSigned', params: { name: agent.name, city: 'LAX' } },
    });
  });

  it('cannot sign where an agent or own office already covers the region', () => {
    const s = bareGame();
    signAgent(s, 'LAX');
    expect(canSign(s, 'LAX')).toEqual({ ok: false, reason: 'error.alreadyCovered' });
    expect(canSign(s, 'TPE')).toEqual({ ok: false, reason: 'error.alreadyCovered' });

    const before = clone(s);
    expect(signAgent(s, 'LAX')).toEqual({ ok: false, reason: 'error.alreadyCovered' });
    expect(signAgent(s, 'TPE')).toEqual({ ok: false, reason: 'error.alreadyCovered' });
    expect(s).toEqual(before);
  });

  it('cash exactly the cost is enough; one dollar short is refused and changes nothing', () => {
    const short = bareGame(B.agents.signCost - 1);
    const before = clone(short);
    expect(canSign(short, 'LAX')).toEqual({ ok: false, reason: 'error.cannotAfford' });
    expect(signAgent(short, 'LAX')).toEqual({ ok: false, reason: 'error.cannotAfford' });
    expect(short).toEqual(before);

    const exact = bareGame(B.agents.signCost);
    expect(canSign(exact, 'LAX')).toEqual({ ok: true });
    expect(signAgent(exact, 'LAX')).toEqual({ ok: true });
    expect(exact.cash).toBe(0);
  });

  it('agent names are unique within a run', () => {
    const s = createGame({ seed: 3, homePortId: 'TPE', mode: 'easy' });
    s.cash = 1_000_000;
    for (const portId of Object.keys(PORTS) as PortId[]) {
      if (canSign(s, portId).ok) signAgent(s, portId);
    }
    const regions = new Set(Object.values(PORTS).map((p) => p.regionId));
    expect(s.agents).toHaveLength(regions.size - 1);
    expect(new Set(s.agents.map((a) => a.name)).size).toBe(s.agents.length);
  });
});

describe('addAgent', () => {
  it('names an agent with a coined name nobody in the run has yet', () => {
    const s = bareGame();
    s.day = 7;
    const taken = AGENT_NAMES.slice(0, -1);
    taken.forEach((name, i) => s.agents.push({ id: `x${i}`, portId: 'LAX', regionId: 'US-W', name, signedDay: 0 }));
    const agent = addAgent(s, 'RTM');
    expect(agent).toEqual({ id: expect.stringMatching(/^a\d+$/), portId: 'RTM', regionId: 'NL', name: AGENT_NAMES.at(-1), signedDay: 7 });
    expect(s.agents.at(-1)).toBe(agent);
  });

  it('numbers a name once every coined name is taken', () => {
    const s = bareGame();
    AGENT_NAMES.forEach((name, i) => s.agents.push({ id: `x${i}`, portId: 'LAX', regionId: 'US-W', name, signedDay: 0 }));
    const first = addAgent(s, 'RTM');
    expect(first.name).toMatch(/ 2$/);
    expect(AGENT_NAMES).toContain(first.name.replace(/ 2$/, ''));
    s.agents.push(...AGENT_NAMES.map((name, i) => ({ id: `y${i}`, portId: 'LAX', regionId: 'US-W', name: `${name} 2`, signedDay: 0 })));
    expect(addAgent(s, 'HAM').name).toMatch(/ 3$/);
  });
});

describe('openOffice', () => {
  it('opening an office costs 50000 and adds an empty office in that region', () => {
    const s = bareGame(60000);
    s.day = 90;
    expect(openOffice(s, 'LAX')).toEqual({ ok: true });

    expect(s.cash).toBe(10000);
    expect(s.yearTotals.expansion).toBe(50000);
    expect(s.offices).toHaveLength(2);
    const office = s.offices[1];
    expect(office).toEqual({ id: expect.stringMatching(/^o\d+$/), portId: 'LAX', regionId: 'US-W', rent: 3600 });
    expect(s.employees.filter((e) => e.officeId === office.id)).toEqual([]);
    expect(coveredRegions(s).has('US-W')).toBe(true);
    expect(s.log[0]).toEqual({
      day: 90,
      tone: 'good',
      msg: { key: 'log.officeOpened', params: { city: 'LAX', rent: 3600 } },
    });
  });

  it('cannot open a second office in a region', () => {
    const s = bareGame();
    expect(canOpen(s, 'TPE')).toEqual({ ok: false, reason: 'error.officeExists' });
    openOffice(s, 'LAX');
    const before = clone(s);
    expect(openOffice(s, 'LAX')).toEqual({ ok: false, reason: 'error.officeExists' });
    expect(s).toEqual(before);
  });

  it('cash exactly the cost is enough; one dollar short is refused and changes nothing', () => {
    const short = bareGame(B.offices.openCost - 1);
    const before = clone(short);
    expect(canOpen(short, 'LAX')).toEqual({ ok: false, reason: 'error.cannotAfford' });
    expect(openOffice(short, 'LAX')).toEqual({ ok: false, reason: 'error.cannotAfford' });
    expect(short).toEqual(before);

    const exact = bareGame(B.offices.openCost);
    expect(canOpen(exact, 'LAX')).toEqual({ ok: true });
    expect(openOffice(exact, 'LAX')).toEqual({ ok: true });
    expect(exact.cash).toBe(0);
  });

  it('opening an office where an agent works keeps the agent', () => {
    const s = bareGame();
    signAgent(s, 'LAX');
    signAgent(s, 'RTM');
    const agent = s.agents[0];
    expect(farEndFor(s, 'US-W')).toEqual({ end: { kind: 'agent', agentId: agent.id }, portId: 'LAX' });

    expect(canOpen(s, 'LAX')).toEqual({ ok: true });
    expect(openOffice(s, 'LAX')).toEqual({ ok: true });

    const office = s.offices[1];
    expect(s.agents.map((a) => a.id)).toContain(agent.id);
    expect(lanesFor(s, 'o1')).toEqual(['NL', 'US-W']);
    expect(farEndFor(s, 'US-W')).toEqual({ end: { kind: 'office', officeId: office.id }, portId: 'LAX' });
  });

  it('new office rent follows the country', () => {
    const s = bareGame();
    openOffice(s, 'LAX');
    openOffice(s, 'SSZ');
    expect(s.offices.map((o) => [o.portId, o.rent])).toEqual([
      ['TPE', 2000],
      ['LAX', 3600],
      ['SSZ', 1800],
    ]);
  });

  it('the home office keeps 2000', () => {
    // Los Angeles would cost 3600 as a later office; the first office pays the flat home rent.
    const s = createGame({ seed: 1, homePortId: 'LAX', mode: 'normal' });
    expect(s.offices[0].rent).toBe(2000);
  });
});

describe('coverage', () => {
  it("lanes are the covered regions other than the office's own, sorted", () => {
    const s = bareGame();
    signAgent(s, 'SYD');
    signAgent(s, 'HAM');
    openOffice(s, 'LAX');
    expect([...coveredRegions(s)].sort()).toEqual(['AU', 'DE', 'TW', 'US-W']);
    expect(lanesFor(s, 'o1')).toEqual(['AU', 'DE', 'US-W']);
    expect(lanesFor(s, s.offices[1].id)).toEqual(['AU', 'DE', 'TW']);
  });

  it('the far end of an own-office region is that office', () => {
    const s = bareGame();
    expect(farEndFor(s, 'TW')).toEqual({ end: { kind: 'office', officeId: 'o1' }, portId: 'TPE' });
  });

  it('company value is unchanged by signing or opening', () => {
    const s = bareGame(100000);
    const start = companyValue(s).total;
    signAgent(s, 'LAX');
    expect(companyValue(s).total).toBe(start);
    openOffice(s, 'RTM');
    expect(companyValue(s).total).toBe(start);
    expect(companyValue(s).network).toBe(2 * B.score.officeValue + B.score.agentContractValue);
  });
});

describe('starter agents', () => {
  it('createGame gives Normal two agents outside the home region', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = createGame({ seed, homePortId: 'TPE', mode: 'normal' });
      expect(s.agents).toHaveLength(2);
      for (const a of s.agents) {
        expect(a.regionId).not.toBe(s.offices[0].regionId);
        expect(REGIONS[a.regionId]).toBeDefined();
        expect(a.signedDay).toBe(0);
      }
      expect(new Set(s.agents.map((a) => a.name)).size).toBe(2);
    }
  });

  it('starter agents get drawn names, not the first names on the list', () => {
    const firstNames = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) firstNames.add(createGame({ seed, homePortId: 'TPE', mode: 'normal' }).agents[0].name);
    expect(firstNames.size).toBeGreaterThan(1);
  });
});
