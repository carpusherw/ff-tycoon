import { B } from './balance';
import { createTask } from './chain';
import { newId } from './ids';
import { COMPANY_NAMES } from './names';
import { chance, pick, randRange } from './rng';
import type { Customer, EndRef, GameState, Shipment } from './types';
import { transitDays, type PortId } from './world';

function createRequest(s: GameState, customer: Customer): void {
  const office = s.offices.find((o) => o.id === customer.officeId);
  if (!office) return;
  const direction: Shipment['direction'] = chance(s, B.demand.exportShare) ? 'export' : 'import';
  const agent = pick(s, s.agents);
  const officeEnd: EndRef = { kind: 'office', officeId: office.id };
  const agentEnd: EndRef = { kind: 'agent', agentId: agent.id };
  const isExport = direction === 'export';
  const fromPortId = isExport ? office.portId : agent.portId;
  const toPortId = isExport ? agent.portId : office.portId;
  const days = transitDays(fromPortId as PortId, toPortId as PortId);
  const jitter = randRange(s, B.margin.jitter[0], B.margin.jitter[1]);
  const margin = Math.round((B.margin.base + B.margin.perTransitDay * days) * jitter);
  const shipment: Shipment = {
    id: newId(s, 'sh'),
    kind: 'sale',
    customerId: customer.id,
    sellingOfficeId: office.id,
    direction,
    fromPortId,
    toPortId,
    origin: isExport ? officeEnd : agentEnd,
    destination: isExport ? agentEnd : officeEnd,
    status: 'quoting',
    margin,
    agentShare: Math.round(margin * B.agentProfitShare),
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
  createTask(s, 'quote', shipment, office.id);
}

/** Rolls today's quote requests: maybe a new prospect, plus repeat business from active customers. */
export function generateRequests(s: GameState): void {
  if (s.agents.length === 0) return;
  const regulars = s.customers.filter((c) => c.status === 'active');
  if (chance(s, B.demand.newProspectPerDay)) {
    const prospect: Customer = {
      id: newId(s, 'c'),
      name: pick(s, COMPANY_NAMES),
      officeId: 'o1',
      status: 'prospect',
      payments: [],
    };
    s.customers.push(prospect);
    createRequest(s, prospect);
  }
  for (const customer of regulars) {
    if (chance(s, B.demand.repeatPerCustomerPerDay)) createRequest(s, customer);
  }
}
