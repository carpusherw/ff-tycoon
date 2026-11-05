import { route } from '../../rules/world';
import { MAP, pointAlong, project, projectPath } from './projection';

describe('map projection', () => {
  it('project maps the seam to x = 0', () => {
    expect(project(MAP.seamLon, 0)).toEqual([0, MAP.height / 2]);
    expect(project(MAP.seamLon + 180, 90)).toEqual([MAP.width / 2, 0]);
  });

  it("a Pacific path isn't split", () => {
    const { waypoints } = route('SHA', 'LAX');
    const pieces = projectPath(waypoints);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]).toHaveLength(waypoints.length);
  });

  it('an Atlantic path is split at the seam', () => {
    const pieces = projectPath([
      [4.5, 51.9],
      [-74, 40.7],
    ]);
    expect(pieces).toHaveLength(2);
    const [first, second] = pieces;
    expect(first[first.length - 1][0]).toBe(0);
    expect(second[0][0]).toBe(MAP.width);
    // Both edge points sit at the same height, on the straight line between the ends.
    expect(first[first.length - 1][1]).toBeCloseTo(second[0][1], 6);
    expect(second[second.length - 1]).toEqual(project(-74, 40.7));
  });

  it('a path crossing the seam eastward is split the other way', () => {
    const pieces = projectPath([
      [-74, 40.7],
      [4.5, 51.9],
    ]);
    expect(pieces).toHaveLength(2);
    expect(pieces[0][pieces[0].length - 1][0]).toBe(MAP.width);
    expect(pieces[1][0][0]).toBe(0);
  });

  it('pointAlong endpoints', () => {
    const pieces = projectPath(route('RTM', 'NYC').waypoints);
    const first = pieces[0][0];
    const lastPiece = pieces[pieces.length - 1];
    const last = lastPiece[lastPiece.length - 1];
    expect(pointAlong(pieces, 0)).toMatchObject({ x: first[0], y: first[1] });
    expect(pointAlong(pieces, 1)).toMatchObject({ x: last[0], y: last[1] });
    expect(pointAlong(pieces, -2)).toMatchObject({ x: first[0], y: first[1] });
    expect(pointAlong(pieces, 5)).toMatchObject({ x: last[0], y: last[1] });
  });

  it('pointAlong measures distance and heading', () => {
    const line: [number, number][][] = [
      [
        [0, 0],
        [10, 0],
        [10, 30],
      ],
    ];
    expect(pointAlong(line, 0.125)).toEqual({ x: 5, y: 0, angle: 0 });
    expect(pointAlong(line, 0.625)).toEqual({ x: 10, y: 15, angle: 90 });
  });
});
