import { B } from './balance';
import { generateRequests } from './demand';
import { createGame } from './newGame';

describe('generateRequests', () => {
  it('no agents means no requests', () => {
    const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
    s.agents = [];
    s.customers.push({ id: 'c99', name: 'Test Co', officeId: 'o1', status: 'active', payments: [] });
    for (let day = 1; day <= 100; day++) {
      s.day = day;
      generateRequests(s);
    }
    expect(s.shipments).toEqual([]);
    expect(s.tasks).toEqual([]);
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
      expect(sh.agentShare).toBe(Math.round(sh.margin * B.agentProfitShare));
      expect(s.tasks.filter((t) => t.shipmentId === sh.id && t.kind === 'quote').length).toBe(1);
    }
  });
});
