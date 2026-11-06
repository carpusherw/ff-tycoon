import { B } from './balance';
import { generateRequests } from './demand';
import { addAgent, lanesFor, openOffice } from './network';
import { createGame } from './newGame';
import type { GameState } from './types';
import { PORTS, type PortId } from './world';

/** A Taipei game with no agents, so tests choose every region's coverage themselves. */
function bareGame(seed = 1): GameState {
  const s = createGame({ seed, homePortId: 'TPE', mode: 'normal' });
  s.agents = [];
  s.cash = 1_000_000;
  return s;
}

/** Every port outside Taiwan, one per region, so each agent there adds one lane. */
const FOREIGN_PORTS = (Object.keys(PORTS) as PortId[]).filter((p) => PORTS[p].regionId !== 'TW');

/** The shipment's far end: the destination of an export, the origin of an import. */
const farEnd = (sh: GameState['shipments'][number]) => (sh.direction === 'export' ? sh.destination : sh.origin);

describe('generateRequests', () => {
  it('an office with no lanes gets no requests', () => {
    const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
    s.agents = [];
    expect(lanesFor(s, 'o1')).toEqual([]);
    s.customers.push({ id: 'c99', name: 'Test Co', officeId: 'o1', status: 'active', payments: [] });
    for (let day = 1; day <= 100; day++) {
      s.day = day;
      generateRequests(s);
    }
    expect(s.shipments).toEqual([]);
    expect(s.tasks).toEqual([]);
    expect(s.customers.map((c) => c.id)).toEqual(['c99']);
  });

  it('requests only use covered ports', () => {
    const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
    const home = s.offices[0];
    const agentPorts = new Set(s.agents.map((a) => a.portId));
    for (let day = 1; day <= 200; day++) {
      s.day = day;
      generateRequests(s);
      // Turn prospects into regulars so repeat requests are exercised too.
      if (day === 100) for (const c of s.customers) c.status = 'active';
    }

    expect(s.shipments.length).toBeGreaterThan(0);
    expect(new Set(s.shipments.map((sh) => sh.direction))).toEqual(new Set(['export', 'import']));
    for (const sh of s.shipments) {
      const exporting = sh.direction === 'export';
      const homeEnd = exporting ? sh.fromPortId : sh.toPortId;
      const partnerEnd = exporting ? sh.toPortId : sh.fromPortId;
      const officeEnd = exporting ? sh.origin : sh.destination;
      const agentEnd = exporting ? sh.destination : sh.origin;
      expect(homeEnd).toBe(home.portId);
      expect(agentPorts).toContain(partnerEnd);
      expect(officeEnd).toEqual({ kind: 'office', officeId: home.id });
      expect(agentEnd.kind).toBe('agent');
      const agent = s.agents.find((a) => agentEnd.kind === 'agent' && a.id === agentEnd.agentId);
      expect(agent?.portId).toBe(partnerEnd);
      expect(sh.status).toBe('quoting');
      expect(sh.agentShare).toBe(Math.round(sh.margin * B.agents.profitShare));
      expect(sh.localCharges).toBe(0);
      expect(s.tasks.filter((t) => t.shipmentId === sh.id && t.kind === 'quote').length).toBe(1);
    }
  });

  it('each office sells for itself', () => {
    const s = bareGame();
    addAgent(s, 'LAX');
    addAgent(s, 'RTM');
    expect(openOffice(s, 'SIN')).toEqual({ ok: true });
    const sin = s.offices[1];
    for (let day = 1; day <= 200; day++) {
      s.day = day;
      generateRequests(s);
      if (day === 100) for (const c of s.customers) c.status = 'active';
    }

    const officeOf = new Map(s.customers.map((c) => [c.id, c.officeId]));
    expect(new Set(s.customers.map((c) => c.officeId))).toEqual(new Set(['o1', sin.id]));
    for (const sh of s.shipments) {
      const office = s.offices.find((o) => o.id === sh.sellingOfficeId)!;
      expect(sh.kind).toBe('sale');
      expect(officeOf.get(sh.customerId!)).toBe(office.id);
      expect(sh.direction === 'export' ? sh.fromPortId : sh.toPortId).toBe(office.portId);
      const quote = s.tasks.find((t) => t.shipmentId === sh.id && t.kind === 'quote')!;
      expect(quote.officeId).toBe(office.id);
    }
  });

  it('prospect rate grows with lanes, not linearly', () => {
    // 15 is the most lanes this world has (16 regions). TODO(merge): add 22 once every port is in.
    expect(FOREIGN_PORTS).toHaveLength(15);
    for (const lanes of [1, 2, 8, 15]) {
      const s = bareGame(1000 + lanes);
      for (const portId of FOREIGN_PORTS.slice(0, lanes)) addAgent(s, portId);
      expect(lanesFor(s, 'o1')).toHaveLength(lanes);
      const days = 20000;
      let prospects = 0;
      for (let day = 1; day <= days; day++) {
        s.day = day;
        generateRequests(s);
        prospects += s.customers.length;
        s.customers = [];
        s.shipments = [];
        s.tasks = [];
      }
      const expected = 0.35 * Math.sqrt(lanes / 2);
      expect(Math.abs(prospects / days - expected) / expected).toBeLessThan(0.1);
    }
  });

  it('a far end with an own office uses it', () => {
    const s = bareGame();
    const agent = addAgent(s, 'LAX');
    expect(openOffice(s, 'LAX')).toEqual({ ok: true });
    const lax = s.offices[1];
    expect(s.agents).toEqual([agent]);
    for (let day = 1; day <= 200; day++) {
      s.day = day;
      generateRequests(s);
    }

    expect(new Set(s.shipments.map((sh) => sh.sellingOfficeId))).toEqual(new Set(['o1', lax.id]));
    for (const sh of s.shipments) {
      const far = sh.sellingOfficeId === 'o1' ? lax : s.offices[0];
      expect(farEnd(sh)).toEqual({ kind: 'office', officeId: far.id });
      expect(sh.direction === 'export' ? sh.toPortId : sh.fromPortId).toBe(far.portId);
      expect(sh.agentShare).toBe(0);
      expect(sh.localCharges).toBeGreaterThanOrEqual(B.localCharges[0]);
      expect(sh.localCharges).toBeLessThanOrEqual(B.localCharges[1]);
      expect(Number.isInteger(sh.localCharges)).toBe(true);
    }
  });
});
