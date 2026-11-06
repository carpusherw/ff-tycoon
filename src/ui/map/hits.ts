import { PORTS, type PortId } from '../../rules/world';
import { MAP_VIEW } from './labels';
import { project } from './projection';

/** How the map is drawn on the page: CSS px per map unit, and where the view's top left corner is. */
export interface ViewScale {
  left: number;
  top: number;
  s: number;
}

/** The svg's scale on the page, or null before it's laid out. */
export function viewScale(svg: SVGSVGElement | null): ViewScale | null {
  const r = svg?.getBoundingClientRect();
  if (!r || r.width <= 0 || r.height <= 0) return null;
  // preserveAspectRatio="xMidYMid meet": the view is scaled to fit and centred.
  const s = Math.min(r.width / MAP_VIEW.w, r.height / MAP_VIEW.h);
  return { left: r.left + (r.width - MAP_VIEW.w * s) / 2, top: r.top + (r.height - MAP_VIEW.h * s) / 2, s };
}

/** A point on the page in map units. */
export function toMapPoint(view: ViewScale, clientX: number, clientY: number): [number, number] {
  return [MAP_VIEW.x + (clientX - view.left) / view.s, MAP_VIEW.y + (clientY - view.top) / view.s];
}

/** A point in map units on the page. */
export function toPagePoint(view: ViewScale, x: number, y: number): [number, number] {
  return [view.left + (x - MAP_VIEW.x) * view.s, view.top + (y - MAP_VIEW.y) * view.s];
}

/**
 * Hit circle radius in map units: 36 across on a laptop and 56 on the phone strip, each at least 32 CSS px at the
 * size the map is drawn there.
 */
export const HIT_RADIUS = { laptop: 18, compact: 28 } as const;

/** The smallest a hit circle may be across on the page, in CSS px. */
export const MIN_HIT_PX = 32;

/**
 * The hit circle radius in map units for the map as drawn (`s` CSS px per map unit, null before layout). On the
 * phone strip it grows where 56 units would come out under 32 px; a laptop keeps its 36.
 */
export function hitRadius(compact: boolean, s: number | null): number {
  const r = HIT_RADIUS[compact ? 'compact' : 'laptop'];
  // Rounded up to a tenth of a unit, so the drawn size never falls a hair under the minimum.
  return compact && s ? Math.max(r, Math.ceil((MIN_HIT_PX / 2 / s) * 10) / 10) : r;
}

/** A port dot's radius, per unit of pin size. A tap this close to where a port is goes to that port first. */
export const DOT_RADIUS = 2.6;

/** How far a pin's head centre sits above its port, per unit of pin size. */
export const HEAD_RISE = 15.3;
/** A pin head's radius, per unit of pin size. */
export const HEAD_RADIUS = 8.5;

/** The plain ports whose dot a pin's head covers, even in part (Shanghai's under Taipei's, in a Taipei game). */
export function dotsUnderHeads(pins: readonly PortId[], plainPorts: readonly PortId[], k: number): PortId[] {
  const at = (port: PortId) => project(PORTS[port].lon, PORTS[port].lat);
  const heads = pins.map((port) => {
    const [x, y] = at(port);
    return [x, y - HEAD_RISE * k] as const;
  });
  return plainPorts.filter((port) => {
    const [x, y] = at(port);
    return heads.some(([hx, hy]) => Math.hypot(x - hx, y - hy) < (HEAD_RADIUS + DOT_RADIUS) * k);
  });
}

export interface HitTarget {
  port: PortId;
  x: number;
  y: number;
}

/** The point each pin (its head) and each plain port (its dot) is tapped at. */
export function hitTargets(pins: readonly PortId[], plainPorts: readonly PortId[], k: number): HitTarget[] {
  const at = (port: PortId) => project(PORTS[port].lon, PORTS[port].lat);
  return [
    ...pins.map((port) => {
      const [x, y] = at(port);
      return { port, x, y: y - HEAD_RISE * k };
    }),
    ...plainPorts.map((port) => {
      const [x, y] = at(port);
      return { port, x, y };
    }),
  ];
}

/**
 * The port whose own spot on the map a tap at (x, y) lands on: the nearest port within `r` of where it is (its dot,
 * or its pin's tip), or null. This comes before the pin heads, so a port next to another's pin stays tappable.
 */
export function portAtCentre(ports: readonly PortId[], x: number, y: number, r: number): PortId | null {
  let best: PortId | null = null;
  let bestD = r;
  for (const port of ports) {
    const [px, py] = project(PORTS[port].lon, PORTS[port].lat);
    const d = Math.hypot(px - x, py - y);
    if (d <= bestD) {
      best = port;
      bestD = d;
    }
  }
  return best;
}

/**
 * Which pin or port a tap at (x, y) is for. Hit circles overlap where pins crowd (Singapore, Ho Chi Minh City,
 * Laem Chabang and Jakarta), so the nearest centre within `r` wins, whichever circle is drawn on top.
 */
export function nearestTarget(targets: readonly HitTarget[], x: number, y: number, r: number): PortId | null {
  let best: PortId | null = null;
  let bestD = r;
  for (const t of targets) {
    const d = Math.hypot(t.x - x, t.y - y);
    if (d <= bestD) {
      best = t.port;
      bestD = d;
    }
  }
  return best;
}
