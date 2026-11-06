import { PORTS, type PortId } from '../../rules/world';
import { project } from './projection';

/** A rectangle in map units. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The part of the map the view shows (the svg's viewBox). */
export const MAP_VIEW: Box = { x: 0, y: 30, w: 1000, h: 360 };
/** Labels keep this far inside the view's edges. */
const EDGE = 2;

/**
 * Where the "Ships at sea" tag and the legend sit over the map, for before the page is laid out. The map measures
 * the real ones once it is. On a laptop they're in the top left and bottom right corners; on the phone both sit at
 * the bottom, and the strip scrolls under them, so together they cover one band across the whole map.
 */
export const DEFAULT_OBSTACLES: Record<'laptop' | 'compact', readonly Box[]> = {
  laptop: [
    { x: 0, y: 30, w: 165, h: 36 },
    { x: 700, y: 352, w: 300, h: 38 },
  ],
  compact: [{ x: 0, y: 350, w: 1000, h: 40 }],
};

/** A pin's label bubble to place: its port and the bubble's size. */
export interface PinLabel {
  port: PortId;
  kind: 'office' | 'agent';
  w: number;
  h: number;
}

/** A plain port's name to place; `labelled: false` keeps only its dot, as an obstacle. */
export interface PortLabel {
  port: PortId;
  w: number;
  h: number;
  labelled?: boolean;
}

export interface PlaceOptions {
  /** The phone strip: a pin label that fits nowhere is hidden instead of overlapping. */
  compact: boolean;
  /** Size multiplier of pins and labels: 1 on a laptop, bigger on the phone. */
  k: number;
  /** What floats over the map; defaults to `DEFAULT_OBSTACLES`. */
  obstacles?: readonly Box[];
}

export interface Placement {
  port: PortId;
  kind: 'office' | 'agent' | 'port';
  /** Where the label goes, or null when it's hidden (or a plain port that has no label). */
  box: Box | null;
  /** A thin line from the pin head to a bubble placed away from it: [x1, y1, x2, y2]. */
  leader: [number, number, number, number] | null;
}

/** A rough text width for before the font has loaded (CJK glyphs are about 1em, Latin about 0.56em). */
export function estimateWidth(text: string, size: number): number {
  let em = 0;
  for (const ch of text) em += ch.codePointAt(0)! >= 0x2e80 ? 1 : 0.56;
  return em * size;
}

/** A pin bubble's size from its text widths: the city line, and the small second line when there is one. */
export function pinBubbleSize(cityW: number, subW: number, hasSub: boolean, k: number): { w: number; h: number } {
  return { w: Math.max(cityW, hasSub ? subW : 0) + 14 * k, h: (hasSub ? 22 : 14) * k };
}

/** A plain port name's box from its text width and font size. */
export function portLabelSize(textW: number, fontSize: number): { w: number; h: number } {
  return { w: textW + 2, h: fontSize * 1.1 };
}

/** A pin head's box, from the port it stands on. */
export function headBox(x: number, y: number, k: number): Box {
  return { x: x - 9 * k, y: y - 28 * k, w: 18 * k, h: 28 * k };
}

function dotBox(x: number, y: number, k: number): Box {
  return { x: x - 3 * k, y: y - 3 * k, w: 6 * k, h: 6 * k };
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const inView = (a: Box) =>
  a.x >= MAP_VIEW.x + EDGE &&
  a.x + a.w <= MAP_VIEW.x + MAP_VIEW.w - EDGE &&
  a.y >= MAP_VIEW.y + EDGE &&
  a.y + a.h <= MAP_VIEW.y + MAP_VIEW.h - EDGE;

/** Spots for a pin bubble, best first: beside the head, then above and below, then farther out (with a leader line). */
function pinSpots(x: number, y: number, w: number, h: number, k: number): [number, number][] {
  const gap = 11 * k;
  const right = x + gap;
  const left = x - gap - w;
  const spots: [number, number][] = [
    [right, y - h / 2 - 12 * k],
    [left, y - h / 2 - 12 * k],
    [right, y - h - 18 * k],
    [left, y - h - 18 * k],
    [right, y - 4 * k],
    [left, y - 4 * k],
    [x - w / 2, y - 30 * k - h],
    [x - w / 2, y + 4 * k],
    [right, y - h - 34 * k],
    [left, y - h - 34 * k],
    [right, y + 10 * k],
    [left, y + 10 * k],
  ];
  for (const far of [20, 40, 60, 80, 110, 140]) {
    for (const dy of [-12, -36, 12, -60, 36, 60]) {
      spots.push([right + far * k, y - h / 2 + dy * k], [left - far * k, y - h / 2 + dy * k]);
    }
    spots.push([x - w / 2, y - 30 * k - h - far * k], [x - w / 2, y + 4 * k + far * k]);
  }
  return spots;
}

/** Spots for a plain port's name, best first: right, left, above and below, at one height and then the next, farther out. */
function portSpots(x: number, y: number, w: number, h: number, k: number): [number, number][] {
  const spots: [number, number][] = [];
  for (const d of [5, 10, 16, 24]) {
    const near = d * k;
    spots.push(
      [x + near, y - h / 2],
      [x - near - w, y - h / 2],
      [x - w / 2, y - near - h],
      [x - w / 2, y + near],
      [x + near, y - h * 1.5],
      [x - near - w, y - h * 1.5],
      [x + near, y + h / 2],
      [x - near - w, y + h / 2],
    );
  }
  return spots;
}

/** How far a bubble may sit from its pin head before it gets a leader line. */
const LEADER_AT = 24;

/**
 * Greedy label placement. Offices go first, then agents, then plain ports; each label takes the first spot on its
 * list that stays inside the map and clears every label placed so far, every pin head and port dot, and whatever
 * floats over the map. On a laptop every label gets a spot (the first one, if nothing fits); on the phone strip a
 * pin label that fits nowhere is hidden, and plain ports go unnamed.
 */
export function placeLabels(pins: readonly PinLabel[], plainPorts: readonly PortLabel[], opts: PlaceOptions): Placement[] {
  const { compact, k } = opts;
  const at = (port: PortId) => project(PORTS[port].lon, PORTS[port].lat);
  const taken: Box[] = [
    ...pins.map((p) => headBox(...at(p.port), k)),
    ...plainPorts.map((p) => dotBox(...at(p.port), k)),
    ...(opts.obstacles ?? DEFAULT_OBSTACLES[compact ? 'compact' : 'laptop']),
  ];
  const free = (b: Box) => inView(b) && !taken.some((t) => overlaps(b, t));
  const firstFree = (spots: [number, number][], w: number, h: number) => {
    for (const [x, y] of spots) {
      const b = { x, y, w, h };
      if (free(b)) return b;
    }
    return null;
  };

  const out: Placement[] = [];
  const ordered = [...pins.filter((p) => p.kind === 'office'), ...pins.filter((p) => p.kind === 'agent')];
  for (const p of ordered) {
    const [x, y] = at(p.port);
    const spots = pinSpots(x, y, p.w, p.h, k);
    let box = firstFree(spots, p.w, p.h);
    if (!box && !compact) box = { x: spots[0][0], y: spots[0][1], w: p.w, h: p.h };
    if (box) taken.push(box);
    out.push({ port: p.port, kind: p.kind, box, leader: box ? leaderTo(x, y - 15.3 * k, box, LEADER_AT * k) : null });
  }
  for (const p of plainPorts) {
    if (p.labelled === false) {
      out.push({ port: p.port, kind: 'port', box: null, leader: null });
      continue;
    }
    const [x, y] = at(p.port);
    const spots = portSpots(x, y, p.w, p.h, k);
    let box = firstFree(spots, p.w, p.h);
    if (!box && !compact) box = { x: spots[0][0], y: spots[0][1], w: p.w, h: p.h };
    if (box) taken.push(box);
    out.push({ port: p.port, kind: 'port', box, leader: null });
  }
  return out;
}

/** A line from the head (hx, hy) to the nearest edge of `box`, when that's farther than `min`. */
function leaderTo(hx: number, hy: number, box: Box, min: number): Placement['leader'] {
  const nx = Math.max(box.x, Math.min(hx, box.x + box.w));
  const ny = Math.max(box.y, Math.min(hy, box.y + box.h));
  return Math.hypot(nx - hx, ny - hy) > min ? [hx, hy, nx, ny] : null;
}
