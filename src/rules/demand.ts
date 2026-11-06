import { B } from './balance';
import { createTask } from './chain';
import { newId } from './ids';
import { COMPANY_NAMES } from './names';
import { farEndFor, lanesFor } from './network';
import { chance, pick, randInt, randRange } from './rng';
import type { Customer, EndRef, GameState, Office, Shipment } from './types';
import { transitDays, type PortId } from './world';

/** A quote request from one of an office's customers, to or from one of its lanes picked at random. */
function createRequest(s: GameState, customer: Customer, office: Office, lanes: string[]): void {
  const direction: Shipment['direction'] = chance(s, B.demand.exportShare) ? 'export' : 'import';
  const far = farEndFor(s, pick(s, lanes));
  const officeEnd: EndRef = { kind: 'office', officeId: office.id };
  const isExport = direction === 'export';
  const fromPortId = isExport ? office.portId : far.portId;
  const toPortId = isExport ? far.portId : office.portId;
  const days = transitDays(fromPortId as PortId, toPortId as PortId);
  const jitter = randRange(s, B.margin.jitter[0], B.margin.jitter[1]);
  const margin = Math.round((B.margin.base + B.margin.perTransitDay * days) * jitter);
  // An own office at the far end takes no profit share; it bills local charges instead.
  const farIsOffice = far.end.kind === 'office';
  const shipment: Shipment = {
    id: newId(s, 'sh'),
    kind: 'sale',
    customerId: customer.id,
    sellingOfficeId: office.id,
    direction,
    fromPortId,
    toPortId,
    origin: isExport ? officeEnd : far.end,
    destination: isExport ? far.end : officeEnd,
    status: 'quoting',
    margin,
    agentShare: farIsOffice ? 0 : Math.round(margin * B.agents.profitShare),
    localCharges: farIsOffice ? randInt(s, B.localCharges[0], B.localCharges[1]) : 0,
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

/** A whole number of new prospects that averages `rate` a day: the whole part for sure, the rest by chance. */
function prospectsToday(s: GameState, rate: number): number {
  return Math.floor(rate) + (chance(s, rate % 1) ? 1 : 0);
}

/**
 * Rolls today's quote requests. Each office with lanes may get new prospects, more the more lanes it has, plus
 * repeat business from its active customers. An office with no lanes gets nothing.
 */
export function generateRequests(s: GameState): void {
  const regulars = s.customers.filter((c) => c.status === 'active');
  const tradingOffices = new Map<string, { office: Office; lanes: string[] }>();
  for (const office of s.offices) {
    const lanes = lanesFor(s, office.id);
    if (lanes.length === 0) continue;
    tradingOffices.set(office.id, { office, lanes });
    const rate = B.demand.newProspectPerDay * Math.sqrt(lanes.length / B.demand.referenceLanes);
    for (let n = prospectsToday(s, rate); n > 0; n--) {
      const prospect: Customer = {
        id: newId(s, 'c'),
        name: pick(s, COMPANY_NAMES),
        officeId: office.id,
        status: 'prospect',
        payments: [],
      };
      s.customers.push(prospect);
      createRequest(s, prospect, office, lanes);
    }
  }
  for (const customer of regulars) {
    const trading = tradingOffices.get(customer.officeId);
    if (!trading) continue;
    if (chance(s, B.demand.repeatPerCustomerPerDay)) createRequest(s, customer, trading.office, trading.lanes);
  }
}
