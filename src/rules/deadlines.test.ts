import { B } from './balance';
import { createTask } from './chain';
import { handleMissedDeadlines } from './deadlines';
import { newId } from './ids';
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
    const task = createTask(s, 'quote', shipment, shipment.sellingOfficeId);
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
    const task = createTask(s, 'booking', shipment, shipment.sellingOfficeId);
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
    const task = createTask(s, 'invoice', shipment, shipment.sellingOfficeId);
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
});
