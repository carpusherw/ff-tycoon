import { PORTS, type PortId } from '../../rules/world';
import { HIT_RADIUS, hitTargets, nearestTarget } from './hits';
import { project } from './projection';

const CLUSTER: PortId[] = ['SIN', 'SGN', 'LCH', 'JKT'];

describe('nearestTarget', () => {
  it.each([
    ['laptop', false],
    ['phone', true],
  ])('each overlapping Southeast Asia pin wins a tap on its own head (%s)', (_name, compact) => {
    const k = compact ? 1.8 : 1;
    const r = HIT_RADIUS[compact ? 'compact' : 'laptop'];
    const targets = hitTargets(CLUSTER, [], k);
    // The hit areas really do overlap: some pair of heads is closer than one hit circle's diameter.
    const close = targets.some((a, i) => targets.slice(i + 1).some((b) => Math.hypot(a.x - b.x, a.y - b.y) < 2 * r));
    expect(close).toBe(true);
    for (const t of targets) expect(nearestTarget(targets, t.x, t.y, r)).toBe(t.port);
  });

  it('a tap between two heads goes to the nearer one', () => {
    const targets = hitTargets(['SGN', 'LCH'], [], 1);
    const [a, b] = targets;
    const nearA = { x: a.x + (b.x - a.x) * 0.4, y: a.y + (b.y - a.y) * 0.4 };
    expect(nearestTarget(targets, nearA.x, nearA.y, HIT_RADIUS.laptop)).toBe(a.port);
    const nearB = { x: a.x + (b.x - a.x) * 0.6, y: a.y + (b.y - a.y) * 0.6 };
    expect(nearestTarget(targets, nearB.x, nearB.y, HIT_RADIUS.laptop)).toBe(b.port);
  });

  it('a tap outside every hit circle hits nothing', () => {
    const targets = hitTargets(['SYD'], ['DUR'], 1);
    expect(nearestTarget(targets, 10, 40, HIT_RADIUS.laptop)).toBeNull();
  });

  it('a plain port is hit at its dot, a pin at its head', () => {
    const [pin, port] = hitTargets(['SYD'], ['DUR'], 1);
    const [sx, sy] = project(PORTS.SYD.lon, PORTS.SYD.lat);
    const [dx, dy] = project(PORTS.DUR.lon, PORTS.DUR.lat);
    expect(pin.x).toBeCloseTo(sx);
    expect(pin.y).toBeLessThan(sy);
    expect(port).toMatchObject({ port: 'DUR', x: dx, y: dy });
  });

  it('hit circles are 36 map units across on a laptop and 56 on the phone', () => {
    expect(HIT_RADIUS.laptop * 2).toBe(36);
    expect(HIT_RADIUS.compact * 2).toBe(56);
  });
});
