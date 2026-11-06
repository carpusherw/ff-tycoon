import { t, type Lang } from '../../i18n';
import { AGENT_NAMES } from '../../rules/names';
import { PORTS, type PortId } from '../../rules/world';
import {
  COMPACT_MAX_LEADER,
  DEFAULT_OBSTACLES,
  estimateWidth,
  headBox,
  MAP_VIEW,
  pinBubbleSize,
  placeLabels,
  portLabelSize,
  type Box,
  type PinLabel,
} from './labels';
import { project } from './projection';

const ALL = Object.keys(PORTS) as PortId[];
const LONGEST_AGENT = AGENT_NAMES.reduce((a, b) => (b.length > a.length ? b : a));

const overlap = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const inside = (a: Box) =>
  a.x >= MAP_VIEW.x && a.y >= MAP_VIEW.y && a.x + a.w <= MAP_VIEW.x + MAP_VIEW.w && a.y + a.h <= MAP_VIEW.y + MAP_VIEW.h;

/** Every port pinned: the first `offices` as offices, the rest as agents with the longest agent name. */
function allPinned(lang: Lang, k: number, compact: boolean, offices = 1): PinLabel[] {
  return ALL.map((port, i) => {
    const kind = i < offices ? 'office' : 'agent';
    const city = t(lang, PORTS[port].cityKey);
    const sub = compact ? null : kind === 'office' ? t(lang, 'map.office') : LONGEST_AGENT;
    return { port, kind, ...pinBubbleSize(estimateWidth(city, 10 * k), sub ? estimateWidth(sub, 7.5 * k) : 0, sub !== null, k) };
  });
}

/** The obstacles every label must clear: pin heads and the map's corner tags. */
function obstaclesFor(pins: PinLabel[], k: number, compact: boolean): Box[] {
  return [
    ...pins.map((p) => headBox(...project(PORTS[p.port].lon, PORTS[p.port].lat), k)),
    ...(compact ? DEFAULT_OBSTACLES.compact : DEFAULT_OBSTACLES.laptop),
  ];
}

describe('placeLabels', () => {
  it.each<[Lang, number]>([
    ['en', 1],
    ['en', 4],
    ['zh-Hant', 1],
    ['zh-Hans', 4],
  ])('with every port pinned at laptop size, no two labels overlap and all stay inside the map (%s, %i offices)', (lang, offices) => {
    const pins = allPinned(lang, 1, false, offices);
    const placed = placeLabels(pins, [], { compact: false, k: 1 });
    expect(placed).toHaveLength(ALL.length);
    const boxes = placed.map((p) => {
      expect(p.box, p.port).not.toBeNull();
      return p.box!;
    });
    for (const [i, b] of boxes.entries()) {
      expect(inside(b), placed[i].port).toBe(true);
      for (const other of boxes.slice(i + 1)) expect(overlap(b, other), `${placed[i].port} overlaps a label`).toBe(false);
      for (const o of obstaclesFor(pins, 1, false)) expect(overlap(b, o), `${placed[i].port} covers a pin or tag`).toBe(false);
    }
  });

  it('places offices first, then agents, then plain ports', () => {
    const office: PinLabel = { port: 'SIN', kind: 'office', w: 60, h: 22 };
    const agent: PinLabel = { port: 'SGN', kind: 'agent', w: 60, h: 22 };
    const placed = placeLabels([agent, office], [{ port: 'LCH', ...portLabelSize(40, 8) }], { compact: false, k: 1 });
    expect(placed.map((p) => p.port)).toEqual(['SIN', 'SGN', 'LCH']);
    // The office got the first spot, to the right of its pin.
    const [x] = project(PORTS.SIN.lon, PORTS.SIN.lat);
    expect(placed[0].box!.x).toBeGreaterThan(x);
  });

  it('a label placed away from its pin gets a leader line; a close one does not', () => {
    const placed = placeLabels(allPinned('en', 1, false), [], { compact: false, k: 1 });
    expect(placed.some((p) => p.leader !== null)).toBe(true);
    expect(placed.find((p) => p.port === 'SYD')!.leader).toBeNull();
  });

  it('compact placement hides what doesn’t fit instead of overlapping', () => {
    const k = 1.8;
    // Every port pinned, with bubbles far wider than any city name, so the crowds can't all fit.
    const pins = ALL.map((port, i): PinLabel => ({ port, kind: i === 0 ? 'office' : 'agent', w: 220, h: 14 * k }));
    const placed = placeLabels(pins, [], { compact: true, k });
    const shown = placed.filter((p) => p.box !== null);
    expect(shown.length).toBeLessThan(placed.length);
    expect(shown.length).toBeGreaterThan(0);
    // A laptop would place every one of them, even overlapping.
    expect(placeLabels(pins, [], { compact: false, k }).every((p) => p.box !== null)).toBe(true);
    for (const [i, p] of shown.entries()) {
      expect(inside(p.box!), p.port).toBe(true);
      for (const other of shown.slice(i + 1)) expect(overlap(p.box!, other.box!), `${p.port} / ${other.port}`).toBe(false);
      for (const o of obstaclesFor(pins, k, true)) expect(overlap(p.box!, o), `${p.port} covers a pin or tag`).toBe(false);
    }
  });

  it.each<Lang>(['en', 'zh-Hant', 'zh-Hans'])(
    'on the phone strip no label sits farther from its pin than the longest leader (%s, every port pinned, 4 offices)',
    (lang) => {
      const k = 1.8;
      // Agents with the longest agent name: the crowd that once pushed Mumbai's label out past Tokyo.
      const pins = allPinned(lang, k, false, 4);
      const placed = placeLabels(pins, [], { compact: true, k });
      const shown = placed.filter((p) => p.box !== null);
      expect(shown.length).toBeGreaterThan(0);
      expect(shown.length).toBeLessThan(placed.length);
      for (const p of shown) {
        const [x, y] = project(PORTS[p.port].lon, PORTS[p.port].lat);
        const [hx, hy] = [x, y - 15.3 * k];
        const b = p.box!;
        const gap = Math.hypot(Math.max(b.x, Math.min(hx, b.x + b.w)) - hx, Math.max(b.y, Math.min(hy, b.y + b.h)) - hy);
        expect(gap, p.port).toBeLessThanOrEqual(COMPACT_MAX_LEADER);
        if (p.leader) expect(Math.hypot(p.leader[2] - p.leader[0], p.leader[3] - p.leader[1]), p.port).toBeLessThanOrEqual(COMPACT_MAX_LEADER);
      }
    },
  );

  it('a laptop label may still sit farther out than the phone allows', () => {
    const placed = placeLabels(allPinned('en', 1, false, 4), [], { compact: false, k: 1 });
    const longest = Math.max(...placed.map((p) => (p.leader ? Math.hypot(p.leader[2] - p.leader[0], p.leader[3] - p.leader[1]) : 0)));
    expect(longest).toBeGreaterThan(COMPACT_MAX_LEADER);
  });

  it('plain port names clear pins and each other, and keep a spot on a laptop', () => {
    const pins: PinLabel[] = [{ port: 'TPE', kind: 'office', w: 70, h: 22 }];
    const plain = ALL.filter((p) => p !== 'TPE').map((port) => ({ port, ...portLabelSize(estimateWidth(t('en', PORTS[port].cityKey), 8), 8) }));
    const placed = placeLabels(pins, plain, { compact: false, k: 1 });
    const boxes = placed.map((p) => p.box!);
    expect(boxes.every(Boolean)).toBe(true);
    for (const [i, b] of boxes.entries()) {
      for (const other of boxes.slice(i + 1)) expect(overlap(b, other), `${placed[i].port}`).toBe(false);
    }
  });
});
