import { B } from './balance';
import { advanceShipments, onTaskCompleted } from './chain';
import { handleMissedDeadlines } from './deadlines';
import { generateRequests, prospectRate, prospectsToday } from './demand';
import { newId } from './ids';
import { addAgent, farEndFor, lanesFor, openOffice } from './network';
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

/** Hires one Ops employee at an office, so it works shipments for the rest of the network. */
function staff(s: GameState, officeId: string): void {
  s.employees.push({ id: newId(s, 'e'), name: 'Test Hire', officeId, dept: 'ops', isOwner: false, salary: 3000,
    hiredDay: s.day, speed: 1, capacity: 3, winRate: 0.4 });
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
    // 22 is the most lanes this world has (23 regions, one of them home).
    expect(FOREIGN_PORTS).toHaveLength(22);
    for (const lanes of [1, 2, 8, 22]) {
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
      expect(prospectRate(lanes)).toBeCloseTo(expected, 10);
      expect(Math.abs(prospects / days - expected) / expected).toBeLessThan(0.1);
    }
  });

  it('a rate above one a day still averages out: 22 lanes', () => {
    const rate = prospectRate(22);
    const expected = 0.35 * Math.sqrt(22 / 2);
    expect(rate).toBeCloseTo(expected, 10);
    expect(rate).toBeGreaterThan(1);
    const rng = { rngState: 2022 };
    const days = 20000;
    const counts = Array.from({ length: days }, () => prospectsToday(rng, rate));
    expect(new Set(counts)).toEqual(new Set([1, 2]));
    const mean = counts.reduce((a, b) => a + b, 0) / days;
    expect(Math.abs(mean - expected) / expected).toBeLessThan(0.1);
  });

  it('a far end with an own office uses it', () => {
    const s = bareGame();
    const agent = addAgent(s, 'LAX');
    expect(openOffice(s, 'LAX')).toEqual({ ok: true });
    const lax = s.offices[1];
    staff(s, lax.id);
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

  it('an office with no staff is no far end: its agent is, and nobody pays late fees there', () => {
    const s = bareGame();
    const owner = s.employees.find((e) => e.isOwner)!;
    owner.winRate = 2;
    const agent = addAgent(s, 'LAX');
    expect(openOffice(s, 'LAX')).toEqual({ ok: true });
    const lax = s.offices[1];
    const cash = s.cash;
    for (let day = 1; day <= 120; day++) {
      s.day = day;
      advanceShipments(s);
      generateRequests(s);
      // The home office finishes its own work the same day; the empty office works nothing.
      for (const task of s.tasks.filter((t) => t.officeId === 'o1')) {
        task.assigneeId = owner.id;
        s.tasks = s.tasks.filter((t) => t !== task);
        onTaskCompleted(s, task);
      }
      handleMissedDeadlines(s);
    }

    const home = s.shipments.filter((sh) => sh.sellingOfficeId === 'o1');
    expect(home.some((sh) => sh.status === 'done')).toBe(true);
    for (const sh of home) {
      expect(farEnd(sh)).toEqual({ kind: 'agent', agentId: agent.id });
      expect(sh.localCharges).toBe(0);
    }
    expect(s.yearTotals.fees).toBe(0);
    const keys = new Set(s.log.map((e) => e.msg.key));
    expect(keys.has('log.opsLate') || keys.has('log.chargesLate') || keys.has('log.invoiceLate')).toBe(false);
    // The empty office still gets its own prospects; their quotes expire quietly.
    expect(s.shipments.some((sh) => sh.sellingOfficeId === lax.id)).toBe(true);
    expect(keys.has('log.quoteExpired')).toBe(true);
    expect(s.cash).toBe(cash + s.stats.revenue.reduce((sum, r) => sum + r.amount, 0));

    staff(s, lax.id);
    expect(farEndFor(s, 'US-W')).toEqual({ end: { kind: 'office', officeId: lax.id }, portId: 'LAX' });
    const before = s.shipments.length;
    for (let day = 121; day <= 160; day++) {
      s.day = day;
      generateRequests(s);
    }
    const later = s.shipments.slice(before).filter((sh) => sh.sellingOfficeId === 'o1');
    expect(later.length).toBeGreaterThan(0);
    for (const sh of later) {
      expect(farEnd(sh)).toEqual({ kind: 'office', officeId: lax.id });
      expect(sh.localCharges).toBeGreaterThan(0);
    }
  });
});
