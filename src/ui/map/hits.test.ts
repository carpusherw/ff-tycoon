import { PORTS, type PortId } from '../../rules/world';
import { dotsUnderHeads, HIT_RADIUS, hitRadius, hitTargets, nearestTarget } from './hits';
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

describe('dotsUnderHeads', () => {
  it.each([1, 1.8])("finds Shanghai's dot under the Taipei pin's head, and no dot far from a head (k %s)", (k) => {
    expect(dotsUnderHeads(['TPE'], ['SHA', 'SYD', 'RTM'], k)).toEqual(['SHA']);
    expect(dotsUnderHeads(['SYD'], ['SHA', 'RTM'], k)).toEqual([]);
  });
});

describe('hitRadius', () => {
  it('keeps 56 units on a phone strip drawn big enough, and before layout', () => {
    expect(hitRadius(true, 0.6)).toBe(28);
    expect(hitRadius(true, null)).toBe(28);
  });

  it('grows on a smaller phone strip so a hit circle stays at least 32 px across', () => {
    for (const s of [0.546, 0.5, 0.341]) {
      const r = hitRadius(true, s);
      expect(r).toBeGreaterThan(28);
      expect(r * 2 * s, `s ${s}`).toBeGreaterThanOrEqual(32);
      expect(r * 2 * s, `s ${s}`).toBeLessThan(32.2);
    }
  });

  it('keeps 36 units on a laptop map drawn big enough, and before layout', () => {
    expect(hitRadius(false, 1)).toBe(18);
    expect(hitRadius(false, null)).toBe(18);
  });

  it('grows on a smaller laptop map so a hit circle stays at least 32 px across', () => {
    // About how the map is drawn at 1024 px and at 800 px, just above the phone layout.
    for (const s of [0.652, 0.428]) {
      const r = hitRadius(false, s);
      expect(r).toBeGreaterThan(18);
      expect(r * 2 * s, `s ${s}`).toBeGreaterThanOrEqual(32);
      expect(r * 2 * s, `s ${s}`).toBeLessThan(32.2);
    }
  });
});
