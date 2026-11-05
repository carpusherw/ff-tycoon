/** A Pacific-centred equirectangular map: x runs east from the seam at `seamLon`, y runs south from the pole. */
export const MAP = { width: 1000, height: 500, seamLon: -25 } as const;

export type LonLat = [lon: number, lat: number];
export type XY = [x: number, y: number];

export function project(lon: number, lat: number): XY {
  const x = (((((lon - MAP.seamLon) % 360) + 360) % 360) / 360) * MAP.width;
  const y = ((90 - lat) / 180) * MAP.height;
  return [x, y];
}

/**
 * Projects a path and cuts it wherever it crosses the seam, so a line never streaks across the
 * whole map. Each cut ends one piece on the map edge and starts the next on the opposite edge.
 */
export function projectPath(points: LonLat[]): XY[][] {
  const pieces: XY[][] = [];
  let piece: XY[] = [];
  for (const [lon, lat] of points) {
    const next = project(lon, lat);
    const prev = piece[piece.length - 1];
    if (prev) {
      const dx = next[0] - prev[0];
      if (Math.abs(dx) > MAP.width / 2) {
        // Heading west across the seam (dx > 0) leaves at x = 0; heading east leaves at x = width.
        const leaveX = dx > 0 ? 0 : MAP.width;
        const enterX = MAP.width - leaveX;
        const unwrapped = dx > 0 ? next[0] - MAP.width : next[0] + MAP.width;
        const k = (leaveX - prev[0]) / (unwrapped - prev[0]);
        const edgeY = prev[1] + (next[1] - prev[1]) * k;
        piece.push([leaveX, edgeY]);
        pieces.push(piece);
        piece = [[enterX, edgeY]];
      }
    }
    piece.push(next);
  }
  if (piece.length > 0) pieces.push(piece);
  return pieces;
}

export interface Pose {
  x: number;
  y: number;
  /** Heading in degrees: 0 points east (right), 90 points south (down). */
  angle: number;
}

/** The point a share `t` (clamped to 0..1) of the way along all pieces, measured by length. */
export function pointAlong(polylines: XY[][], t: number): Pose {
  const segments: { a: XY; b: XY; len: number }[] = [];
  let total = 0;
  for (const line of polylines) {
    for (let i = 1; i < line.length; i++) {
      const len = Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
      segments.push({ a: line[i - 1], b: line[i], len });
      total += len;
    }
  }
  if (segments.length === 0 || total === 0) {
    const only = polylines.find((l) => l.length > 0)?.[0] ?? [0, 0];
    return { x: only[0], y: only[1], angle: 0 };
  }
  const share = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  let left = share * total;
  let seg = segments[segments.length - 1];
  for (const s of segments) {
    if (s.len > 0 && left <= s.len) {
      seg = s;
      break;
    }
    left -= s.len;
  }
  const k = share === 1 || seg.len === 0 ? 1 : Math.min(1, Math.max(0, left / seg.len));
  const angle = (Math.atan2(seg.b[1] - seg.a[1], seg.b[0] - seg.a[0]) * 180) / Math.PI;
  return { x: seg.a[0] + (seg.b[0] - seg.a[0]) * k, y: seg.a[1] + (seg.b[1] - seg.a[1]) * k, angle };
}
