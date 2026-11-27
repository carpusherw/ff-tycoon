import { PORTS, route, SEA_NODES, type PortId } from '../../rules/world';
import { LAND } from './land';
import { project, projectPath, type XY } from './projection';

function inside([x, y]: XY, poly: XY[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const PANAMA_CANAL = { minLon: -81, maxLon: -77, minLat: 6, maxLat: 10.5 };

function unproject([x, y]: XY): [number, number] {
  const lon = (x / 1000) * 360 - 25;
  return [lon > 180 ? lon - 360 : lon, 90 - (y / 500) * 180];
}

describe('land', () => {
  it('sea routes stay off the drawn land, apart from the Panama Canal', () => {
    const polys = LAND.map((poly) => poly.map(([lon, lat]) => project(lon, lat)));
    const ids = Object.keys(PORTS) as PortId[];
    const onLand: string[] = [];
    for (const a of ids) {
      for (const b of ids) {
        if (a >= b) continue;
        // Port pins sit on the coast, and some (Hamburg) a little inland, so skip a small circle around each end.
        const ends = [a, b].map((id) => project(PORTS[id].lon, PORTS[id].lat));
        for (const piece of projectPath(route(a, b).waypoints)) {
          for (let i = 1; i < piece.length; i++) {
            for (let k = 0; k <= 40; k++) {
              const p: XY = [
                piece[i - 1][0] + ((piece[i][0] - piece[i - 1][0]) * k) / 40,
                piece[i - 1][1] + ((piece[i][1] - piece[i - 1][1]) * k) / 40,
              ];
              if (ends.some((e) => Math.hypot(e[0] - p[0], e[1] - p[1]) < 6)) continue;
              const [lon, lat] = unproject(p);
              const c = PANAMA_CANAL;
              if (lon >= c.minLon && lon <= c.maxLon && lat >= c.minLat && lat <= c.maxLat) continue;
              if (polys.some((poly) => inside(p, poly))) onLand.push(`${a}-${b} at ${lon.toFixed(1)},${lat.toFixed(1)}`);
            }
          }
        }
      }
    }
    expect(onLand).toEqual([]);
  });

  it('Laem Chabang sits on the coast of the carved gulf', () => {
    const polys = LAND.map((poly) => poly.map(([lon, lat]) => project(lon, lat)));
    for (const id of ['lchOff', 'gulfThailandMouth']) {
      const [lon, lat] = SEA_NODES[id];
      expect(polys.some((poly) => inside(project(lon, lat), poly))).toBe(false);
    }
  });
});
