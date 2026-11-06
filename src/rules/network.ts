import { B } from './balance';
import { newId } from './ids';
import { addLog } from './log';
import { AGENT_NAMES } from './names';
import { pick } from './rng';
import type { Agent, EndRef, GameState, Result } from './types';
import { COUNTRIES, PORTS, REGIONS, type PortId } from './world';

/**
 * Signs an agent at a port and adds it to the network, with a coined name nobody in the run has yet. Every agent is
 * created here, the starter agents included. Once every coined name is taken, a name gets the lowest free number.
 */
export function addAgent(s: GameState, portId: PortId): Agent {
  const taken = new Set(s.agents.map((a) => a.name));
  const free = AGENT_NAMES.filter((n) => !taken.has(n));
  let name: string;
  if (free.length > 0) {
    name = pick(s, free);
  } else {
    const base = pick(s, AGENT_NAMES);
    let n = 2;
    while (taken.has(`${base} ${n}`)) n += 1;
    name = `${base} ${n}`;
  }
  const agent: Agent = { id: newId(s, 'a'), portId, regionId: PORTS[portId].regionId, name, signedDay: s.day };
  s.agents.push(agent);
  return agent;
}

/** Regions with a player office or an agent. */
export function coveredRegions(s: GameState): Set<string> {
  return new Set([...s.offices.map((o) => o.regionId), ...s.agents.map((a) => a.regionId)]);
}

/** The covered regions an office can trade with: every covered region but its own, sorted. */
export function lanesFor(s: GameState, officeId: string): string[] {
  const office = s.offices.find((o) => o.id === officeId);
  if (!office) throw new Error(`No office ${officeId}`);
  return [...coveredRegions(s)].filter((r) => r !== office.regionId).sort();
}

/** Who works a shipment's far end in a covered region: the player's own office there if any, otherwise its agent. */
export function farEndFor(s: GameState, regionId: string): { end: EndRef; portId: PortId } {
  const office = s.offices.find((o) => o.regionId === regionId);
  if (office) return { end: { kind: 'office', officeId: office.id }, portId: office.portId as PortId };
  const agent = s.agents.find((a) => a.regionId === regionId);
  if (agent) return { end: { kind: 'agent', agentId: agent.id }, portId: agent.portId as PortId };
  throw new Error(`Region ${regionId} is not covered`);
}

export function canSign(s: GameState, portId: PortId): Result {
  if (coveredRegions(s).has(PORTS[portId].regionId)) return { ok: false, reason: 'error.alreadyCovered' };
  if (s.cash < B.agents.signCost) return { ok: false, reason: 'error.cannotAfford' };
  return { ok: true };
}

export function canOpen(s: GameState, portId: PortId): Result {
  const regionId = PORTS[portId].regionId;
  if (s.offices.some((o) => o.regionId === regionId)) return { ok: false, reason: 'error.officeExists' };
  if (s.cash < B.offices.openCost) return { ok: false, reason: 'error.cannotAfford' };
  return { ok: true };
}

export function signAgent(s: GameState, portId: PortId): Result {
  const check = canSign(s, portId);
  if (!check.ok) return check;
  s.cash -= B.agents.signCost;
  s.yearTotals.expansion += B.agents.signCost;
  const agent = addAgent(s, portId);
  addLog(s, 'good', { key: 'log.agentSigned', params: { name: agent.name, city: portId } });
  return { ok: true };
}

/** Opens an office with no staff yet. An agent already working in the region stays. */
export function openOffice(s: GameState, portId: PortId): Result {
  const check = canOpen(s, portId);
  if (!check.ok) return check;
  s.cash -= B.offices.openCost;
  s.yearTotals.expansion += B.offices.openCost;
  const regionId = PORTS[portId].regionId;
  const rent = Math.round(B.offices.baseRent * COUNTRIES[REGIONS[regionId].country].rentMult);
  s.offices.push({ id: newId(s, 'o'), portId, regionId, rent });
  addLog(s, 'good', { key: 'log.officeOpened', params: { city: portId, rent } });
  return { ok: true };
}
