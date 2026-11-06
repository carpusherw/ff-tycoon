import { B } from './balance';
import { startOrigin } from './chain';
import { newId } from './ids';
import { addLog } from './log';
import { chance, pick, randInt } from './rng';
import type { EndRef, GameState, Office, Shipment } from './types';

/** Offices with someone in Ops, the owner included while they work there. */
function opsOffices(s: GameState): Office[] {
  const staffed = new Set(s.employees.filter((e) => e.dept === 'ops').map((e) => e.officeId));
  return s.offices.filter((o) => staffed.has(o.id));
}

/**
 * Rolls today's agent jobs. Each agent may send one to a player office outside its own region that has Ops staff.
 * The job goes straight to Ops with no quote and no invoice; the office earns its local charges (Task 6's charges
 * task, since a handling shipment has no selling office).
 */
export function generateHandling(s: GameState): void {
  const withOps = opsOffices(s);
  for (const agent of s.agents) {
    if (!chance(s, B.handling.requestPerAgentPerDay)) continue;
    const targets = withOps.filter((o) => o.regionId !== agent.regionId);
    if (targets.length === 0) continue;
    const office = pick(s, targets);
    const isExport = chance(s, B.handling.exportShare);
    const officeEnd: EndRef = { kind: 'office', officeId: office.id };
    const agentEnd: EndRef = { kind: 'agent', agentId: agent.id };
    const shipment: Shipment = {
      id: newId(s, 'sh'),
      kind: 'handling',
      customerId: null,
      sellingOfficeId: null,
      direction: isExport ? 'export' : 'import',
      fromPortId: isExport ? office.portId : agent.portId,
      toPortId: isExport ? agent.portId : office.portId,
      origin: isExport ? officeEnd : agentEnd,
      destination: isExport ? agentEnd : officeEnd,
      status: 'origin',
      margin: 0,
      agentShare: 0,
      localCharges: randInt(s, B.handling.fee[0], B.handling.fee[1]),
      chargesPaid: false,
      departDay: null,
      arriveDay: null,
      agentReadyDay: null,
      arrived: false,
      paid: false,
      arrivalDone: false,
    };
    s.shipments.push(shipment);
    startOrigin(s, shipment);
    addLog(s, 'info', { key: 'log.agentJob', params: { name: agent.name, city: office.portId, amount: shipment.localCharges } });
  }
}
