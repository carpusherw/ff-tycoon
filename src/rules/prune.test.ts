import { B } from './balance';
import { createGame } from './newGame';
import { pruneState } from './prune';
import { stepDay } from './step';
import type { Customer, GameState, Shipment, ShipmentStatus, Task } from './types';

function newGame(): GameState {
  return createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
}

function shipment(id: string, status: ShipmentStatus, customerId = 'c1'): Shipment {
  return {
    id, kind: 'sale', customerId, sellingOfficeId: 'o1', direction: 'export', fromPortId: 'TPE', toPortId: 'RTM',
    origin: { kind: 'office', officeId: 'o1' }, destination: { kind: 'agent', agentId: 'a1' }, status,
    margin: 1000, agentShare: 250, localCharges: 0, chargesPaid: false, departDay: null, arriveDay: null, agentReadyDay: null,
    arrived: false, paid: false, arrivalDone: false,
  };
}

function customer(id: string, status: Customer['status']): Customer {
  return { id, name: id, officeId: 'o1', status };
}

function task(shipmentId: string): Task {
  return {
    id: `t-${shipmentId}`, kind: 'invoice', officeId: 'o1', dept: 'accounting', shipmentId, workload: 1,
    progress: 0, minDuration: 1, createdDay: 0, deadline: 5, assigneeId: null, late: true,
  };
}

describe('pruneState', () => {
  it('drops finished shipments (done or lost) and keeps the ones still under way', () => {
    const s = newGame();
    const statuses: ShipmentStatus[] = ['quoting', 'lost', 'origin', 'atSea', 'destination', 'done'];
    s.customers = [customer('c1', 'active')];
    s.shipments = statuses.map((st) => shipment(`sh-${st}`, st));
    pruneState(s);
    expect(s.shipments.map((sh) => sh.status)).toEqual(['quoting', 'origin', 'atSea', 'destination']);
  });

  it('keeps a finished shipment that a task still points at', () => {
    const s = newGame();
    s.customers = [customer('c1', 'active')];
    s.shipments = [shipment('sh1', 'done'), shipment('sh2', 'lost'), shipment('sh3', 'done')];
    s.tasks = [task('sh1'), task('sh2')];
    pruneState(s);
    expect(s.shipments.map((sh) => sh.id)).toEqual(['sh1', 'sh2']);
  });

  it('keeps only the last 360 days of revenue and deliveries', () => {
    const s = newGame();
    s.day = 1000;
    // Day 640 is 360 days back: the oldest day any reader still counts is 641.
    const days = [10, 640, 641, 900, 1000];
    s.stats.revenue = days.map((day) => ({ day, invoices: day, charges: 1 }));
    s.stats.delivered = days.map((day) => ({ day, count: 2 }));
    pruneState(s);
    expect(s.stats.revenue.map((r) => r.day)).toEqual([641, 900, 1000]);
    expect(s.stats.delivered.map((d) => d.day)).toEqual([641, 900, 1000]);
  });

  it('drops prospects no shipment points at, and keeps active customers and prospects with a quote open', () => {
    const s = newGame();
    s.customers = [customer('c1', 'active'), customer('c2', 'prospect'), customer('c3', 'prospect')];
    s.shipments = [shipment('sh1', 'quoting', 'c2')];
    pruneState(s);
    expect(s.customers.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it("leaves the quote counters, cash, year reports and log alone", () => {
    const s = newGame();
    s.cash = 1_000_000;
    for (let i = 0; i < 400; i++) stepDay(s);
    const before = structuredClone(s);
    pruneState(s);
    expect(s.stats.quotesWon).toBe(before.stats.quotesWon);
    expect(s.stats.quotesLost).toBe(before.stats.quotesLost);
    expect(s.cash).toBe(before.cash);
    expect(s.yearReports).toEqual(before.yearReports);
    expect(s.log).toEqual(before.log);
    expect(s.tasks).toEqual(before.tasks);
  });
});

describe('stepDay prunes at each month end', () => {
  it('leaves no finished shipment and no history older than a year after a month end', () => {
    const s = newGame();
    s.cash = 1_000_000;
    let sawFinished = false;
    for (let i = 0; i < 2 * B.daysPerYear; i++) {
      stepDay(s);
      if (s.shipments.some((sh) => sh.status === 'done' || sh.status === 'lost')) sawFinished = true;
      if (s.day % B.daysPerMonth !== 0) continue;
      expect(s.shipments.filter((sh) => sh.status === 'done' || sh.status === 'lost')).toEqual([]);
      const since = s.day - B.daysPerYear;
      expect(s.stats.revenue.every((r) => r.day > since)).toBe(true);
      expect(s.stats.delivered.every((d) => d.day > since)).toBe(true);
    }
    // Between month ends, finished shipments are still there until the next prune.
    expect(sawFinished).toBe(true);
    expect(s.stats.quotesLost).toBeGreaterThan(0);
  });
});
