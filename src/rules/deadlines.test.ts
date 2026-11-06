import { B } from './balance';
import { createTask } from './chain';
import { dueSoonDays, handleMissedDeadlines, isDueSoon } from './deadlines';
import { newId } from './ids';
import { openOffice } from './network';
import { createGame } from './newGame';
import type { Customer, GameState, Shipment } from './types';

function setup(): { s: GameState; customer: Customer; shipment: Shipment } {
  const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
  const home = s.offices[0];
  const agent = s.agents[0];
  const customer: Customer = { id: newId(s, 'c'), name: 'Test Co', officeId: home.id, status: 'prospect', payments: [] };
  s.customers.push(customer);
  const shipment: Shipment = {
    id: newId(s, 'sh'),
    kind: 'sale',
    customerId: customer.id,
    sellingOfficeId: home.id,
    direction: 'export',
    fromPortId: home.portId,
    toPortId: agent.portId,
    origin: { kind: 'office', officeId: home.id },
    destination: { kind: 'agent', agentId: agent.id },
    status: 'quoting',
    margin: 2000,
    agentShare: 500,
    localCharges: 0,
    chargesPaid: false,
    departDay: null,
    arriveDay: null,
    agentReadyDay: null,
    arrived: false,
    paid: false,
    arrivalDone: false,
  };
  s.shipments.push(shipment);
  return { s, customer, shipment };
}

describe('missed deadlines', () => {
  it('an expired quote is lost', () => {
    const { s, customer, shipment } = setup();
    const task = createTask(s, 'quote', shipment, shipment.sellingOfficeId!);
    const cash = s.cash;

    s.day = task.deadline;
    handleMissedDeadlines(s);
    expect(s.tasks).toContain(task);

    s.day = task.deadline + 1;
    handleMissedDeadlines(s);
    expect(s.tasks).not.toContain(task);
    expect(shipment.status).toBe('lost');
    expect(s.stats.quotesLost).toBe(1);
    expect(s.customers).not.toContain(customer);
    expect(s.cash).toBe(cash);
    expect(s.log[0].msg).toEqual({ key: 'log.quoteExpired', params: { customer: 'Test Co' } });
  });

  it('a late booking costs 600 once', () => {
    const { s, customer, shipment } = setup();
    customer.status = 'active';
    shipment.status = 'origin';
    const task = createTask(s, 'booking', shipment, shipment.sellingOfficeId!);
    const cash = s.cash;

    s.day = task.deadline + 1;
    handleMissedDeadlines(s);
    expect(s.cash).toBe(cash - 600);
    expect(B.penalties.opsMissFee).toBe(600);
    expect(task.late).toBe(true);
    expect(s.tasks).toContain(task);
    expect(s.log[0].msg).toEqual({ key: 'log.opsLate', params: { customer: 'Test Co', fee: 600 } });

    s.day += 1;
    handleMissedDeadlines(s);
    expect(s.cash).toBe(cash - 600);
    expect(s.log.filter((e) => e.msg.key === 'log.opsLate')).toHaveLength(1);
  });

  it('a late invoice costs 150 and the task stays', () => {
    const { s, customer, shipment } = setup();
    customer.status = 'active';
    shipment.status = 'atSea';
    const task = createTask(s, 'invoice', shipment, shipment.sellingOfficeId!);
    const cash = s.cash;

    s.day = task.deadline + 1;
    handleMissedDeadlines(s);
    expect(s.cash).toBe(cash - 150);
    expect(task.late).toBe(true);
    expect(s.tasks).toContain(task);
    expect(shipment.status).toBe('atSea');
    expect(s.customers).toContain(customer);
    expect(s.log[0].msg).toEqual({ key: 'log.invoiceLate', params: { customer: 'Test Co', fee: 150 } });
  });

  it('late charges cost the invoice late fee once', () => {
    const { s, customer, shipment } = setup();
    s.cash = 100000;
    expect(openOffice(s, 'LAX')).toEqual({ ok: true });
    const lax = s.offices[1];
    customer.status = 'active';
    Object.assign(shipment, {
      toPortId: lax.portId,
      destination: { kind: 'office', officeId: lax.id },
      status: 'destination',
      agentShare: 0,
      localCharges: 300,
    });
    const task = createTask(s, 'charges', shipment, lax.id);
    const cash = s.cash;

    s.day = task.deadline;
    handleMissedDeadlines(s);
    expect(s.cash).toBe(cash);

    s.day = task.deadline + 1;
    handleMissedDeadlines(s);
    expect(s.cash).toBe(cash - B.penalties.invoiceLateFee);
    expect(s.yearTotals.fees).toBe(B.penalties.invoiceLateFee);
    expect(task.late).toBe(true);
    expect(s.tasks).toContain(task);
    expect(s.log[0].msg).toEqual({ key: 'log.chargesLate', params: { city: 'LAX', fee: 150 } });

    s.day += 1;
    handleMissedDeadlines(s);
    expect(s.cash).toBe(cash - B.penalties.invoiceLateFee);
    expect(s.log.filter((e) => e.msg.key === 'log.chargesLate')).toHaveLength(1);
  });
});

describe('due soon', () => {
  it("flags the last 40% of each task kind's own deadline window, at least one day", () => {
    expect(B.dueSoonShare).toBe(0.4);
    expect(dueSoonDays(B.tasks.quote.deadlineDays)).toBe(2);
    expect(dueSoonDays(B.tasks.booking.deadlineDays)).toBe(4);
    expect(dueSoonDays(B.tasks.arrival.deadlineDays)).toBe(3);
    expect(dueSoonDays(B.tasks.invoice.deadlineDays)).toBe(2);
    expect(dueSoonDays(1)).toBe(1);
    expect(dueSoonDays(0)).toBe(1);
  });

  it('a 5-day quote turns due soon after 3 days, not 2', () => {
    const task = { createdDay: 10, deadline: 15 };
    expect(isDueSoon(task, 12)).toBe(false); // 3 days left
    expect(isDueSoon(task, 13)).toBe(true); // 2 days left
    expect(isDueSoon(task, 15)).toBe(true); // due today
    expect(isDueSoon(task, 16)).toBe(true); // overdue still counts
  });

  it('a 10-day booking turns due soon with 4 days left', () => {
    const task = { createdDay: 0, deadline: 10 };
    expect(isDueSoon(task, 5)).toBe(false);
    expect(isDueSoon(task, 6)).toBe(true);
  });
});
