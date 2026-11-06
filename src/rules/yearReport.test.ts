import { B } from './balance';
import { createTask, onTaskCompleted } from './chain';
import { handleMissedDeadlines } from './deadlines';
import { newId } from './ids';
import { monthEnd } from './money';
import { canSign, openOffice, signAgent } from './network';
import { createGame } from './newGame';
import { hireCandidate, rerollCandidates, startHiring } from './staff';
import type { GameState, Task, TaskKind } from './types';
import { PORTS, type PortId } from './world';
import { recordYearReport } from './yearReport';

function gameWithHire(salary: number): GameState {
  const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
  s.employees.push({
    id: newId(s, 'e'),
    name: 'Test Hire',
    officeId: 'o1',
    dept: 'ops',
    isOwner: false,
    salary,
    hiredDay: 0,
    speed: 1,
    capacity: 3,
    winRate: 0,
  });
  return s;
}

function lateTask(s: GameState, kind: TaskKind): Task {
  const task: Task = {
    id: newId(s, 't'),
    kind,
    officeId: 'o1',
    dept: kind === 'invoice' ? 'accounting' : 'ops',
    shipmentId: 'none',
    workload: 1,
    progress: 0,
    minDuration: 1,
    createdDay: s.day - 20,
    deadline: s.day - 1,
    assigneeId: null,
    late: false,
  };
  s.tasks.push(task);
  return task;
}

function collect(s: GameState, day: number, amount: number): void {
  s.cash += amount;
  s.stats.revenue.push({ day, invoices: amount, charges: 0 });
}

/** Plays every month end of `year` (1-based) and leaves the day on the year's last day. */
function payYear(s: GameState, year: number): void {
  for (let m = 1; m <= 12; m++) {
    s.day = (year - 1) * B.daysPerYear + m * B.daysPerMonth;
    monthEnd(s);
  }
}

describe('year reports', () => {
  it('a new game starts with no reports and a snapshot of day 0', () => {
    const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
    expect(s.yearReports).toEqual([]);
    expect(s.yearStart).toEqual({ cash: B.startCash, quotesWon: 0, quotesLost: 0 });
    expect(s.yearTotals).toEqual({ salaries: 0, rent: 0, fees: 0, hiring: 0, expansion: 0 });
  });

  it('a scripted year yields the exact numbers', () => {
    const s = gameWithHire(3000);
    collect(s, 100, 5000);
    collect(s, 360, 2000);
    s.stats.quotesWon = 4;
    s.stats.quotesLost = 2;
    s.stats.delivered.push({ day: 50, count: 1 }, { day: 360, count: 1 });
    payYear(s, 1);
    lateTask(s, 'booking');
    lateTask(s, 'invoice');
    handleMissedDeadlines(s);

    recordYearReport(s);

    expect(s.yearReports).toEqual([
      {
        year: 1,
        revenue: 7000,
        salaries: 36000,
        rent: 24000,
        fees: 750,
        hiring: 0,
        expansion: 0,
        profit: 7000 - 36000 - 24000 - 750,
        cashStart: B.startCash,
        cashEnd: B.startCash + 7000 - 60000 - 750,
        quotesWon: 4,
        quotesLost: 2,
        shipmentsDelivered: 2,
        staffEnd: 2,
      },
    ]);
  });

  it("two consecutive years don't double count", () => {
    const s = gameWithHire(3000);
    collect(s, 200, 8000);
    s.stats.quotesWon = 3;
    s.stats.quotesLost = 1;
    s.stats.delivered.push({ day: 300, count: 1 });
    payYear(s, 1);
    lateTask(s, 'invoice');
    handleMissedDeadlines(s);
    recordYearReport(s);
    const year1 = s.yearReports[0];
    expect(year1).toMatchObject({ revenue: 8000, fees: 150, quotesWon: 3, quotesLost: 1, shipmentsDelivered: 1 });

    collect(s, 361, 70000);
    s.stats.quotesWon += 1;
    s.stats.delivered.push({ day: 400, count: 1 });
    payYear(s, 2);
    recordYearReport(s);

    expect(s.yearReports).toHaveLength(2);
    expect(s.yearReports[0]).toEqual(year1);
    expect(s.yearReports[1]).toEqual({
      year: 2,
      revenue: 70000,
      salaries: 36000,
      rent: 24000,
      fees: 0,
      hiring: 0,
      expansion: 0,
      profit: 70000 - 60000,
      cashStart: year1.cashEnd,
      cashEnd: year1.cashEnd + 70000 - 60000,
      quotesWon: 1,
      quotesLost: 0,
      shipmentsDelivered: 1,
      staffEnd: 2,
    });
    expect(s.yearStart).toEqual({ cash: s.cash, quotesWon: 4, quotesLost: 1 });
    expect(s.yearTotals).toEqual({ salaries: 0, rent: 0, fees: 0, hiring: 0, expansion: 0 });
  });

  it("a year's hiring costs count against profit, so profit equals the cash change", () => {
    const s = gameWithHire(3000);
    collect(s, 90, 80000);
    s.day = 100;
    expect(startHiring(s, 'o1', 'sales')).toEqual({ ok: true });
    expect(rerollCandidates(s)).toEqual({ ok: true });
    expect(hireCandidate(s, s.hiring!.candidates[0].candidateId)).toEqual({ ok: true });
    payYear(s, 1);

    recordYearReport(s);

    const [r] = s.yearReports;
    const hiring = B.hiring.jobAdCost + B.hiring.rerollCost;
    expect(r.hiring).toBe(hiring);
    expect(r.profit).toBe(r.revenue - r.salaries - r.rent - r.fees - hiring);
    expect(r.profit).toBe(r.cashEnd - r.cashStart);
    expect(r.staffEnd).toBe(3);
    expect(s.yearTotals.hiring).toBe(0);
  });

  it('profit equals the change in cash with expansion and local charges', () => {
    const s = gameWithHire(3000);
    collect(s, 20, 150000);
    s.day = 30;
    const uncovered = (Object.keys(PORTS) as PortId[]).find((p) => p !== 'LAX' && canSign(s, p).ok)!;
    expect(signAgent(s, uncovered)).toEqual({ ok: true });
    expect(openOffice(s, 'LAX')).toEqual({ ok: true });
    const lax = s.offices[1];
    const home = s.offices[0];
    const customer = { id: newId(s, 'c'), name: 'Test Co', officeId: home.id, status: 'active' as const };
    s.customers.push(customer);
    s.shipments.push({
      id: newId(s, 'sh'),
      kind: 'sale',
      customerId: customer.id,
      sellingOfficeId: home.id,
      direction: 'export',
      fromPortId: home.portId,
      toPortId: lax.portId,
      origin: { kind: 'office', officeId: home.id },
      destination: { kind: 'office', officeId: lax.id },
      status: 'destination',
      margin: 2000,
      agentShare: 0,
      localCharges: 400,
      chargesPaid: false,
      departDay: 10,
      arriveDay: 30,
      agentReadyDay: null,
      arrived: true,
      paid: true,
      arrivalDone: true,
    });
    s.day = 40;
    const charges = createTask(s, 'charges', s.shipments[0], lax.id);
    s.tasks = s.tasks.filter((t) => t !== charges);
    onTaskCompleted(s, charges);
    payYear(s, 1);

    recordYearReport(s);

    const [r] = s.yearReports;
    expect(r.expansion).toBe(55000);
    expect(r.revenue).toBe(150000 + 400);
    expect(s.ended).toBeNull();
    expect(r.rent).toBe(12 * (B.homeRent + lax.rent));
    expect(r.profit).toBe(r.revenue - r.salaries - r.rent - r.fees - r.hiring - r.expansion);
    expect(r.profit).toBe(r.cashEnd - r.cashStart);
    expect(s.yearTotals.expansion).toBe(0);
  });
});
