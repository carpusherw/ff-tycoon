import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../i18n/I18nProvider';
import { customerName } from '../../rules/chain';
import type { GameState } from '../../rules/types';
import { PORTS, route, type PortId } from '../../rules/world';
import { BoatIcon } from '../Icons';
import { useMediaQuery } from '../useMediaQuery';
import { CLOUDS, LAND, MOUNTAINS, TREES } from './land';
import { MAP, pointAlong, project, projectPath, type Pose, type XY } from './projection';

export interface WorldMapProps {
  state: GameState;
  /** How far the current in-game day has run (0 to 1), read every frame for smooth sailing. */
  fraction: () => number;
  /** Phone layout: bigger pins, ships and labels, one-line pin labels, and only ports with a ship at sea are named. */
  compact?: boolean;
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const COMPACT_SCALE = 1.8;

/**
 * Where each port's labels go, so East Asia's crowd of ports doesn't collide: `pin` is the side and
 * top offset of a pin's label bubble, `label` the side of a plain port's city name.
 */
const LABEL_AT: Record<PortId, { pin: { side: 'left' | 'right'; dy: number }; label: 'left' | 'right' | 'aboveRight' }> = {
  TPE: { pin: { side: 'right', dy: 1 }, label: 'right' },
  SHA: { pin: { side: 'left', dy: -24 }, label: 'left' },
  SZX: { pin: { side: 'left', dy: 2 }, label: 'left' },
  SIN: { pin: { side: 'right', dy: 1 }, label: 'right' },
  PUS: { pin: { side: 'right', dy: -24 }, label: 'aboveRight' },
  TYO: { pin: { side: 'right', dy: 1 }, label: 'right' },
  LAX: { pin: { side: 'right', dy: -2 }, label: 'right' },
  NYC: { pin: { side: 'right', dy: -2 }, label: 'right' },
  RTM: { pin: { side: 'left', dy: -2 }, label: 'left' },
  HAM: { pin: { side: 'right', dy: -12 }, label: 'right' },
  SYD: { pin: { side: 'right', dy: -2 }, label: 'right' },
  DXB: { pin: { side: 'left', dy: 0 }, label: 'left' },
  HOU: { pin: { side: 'right', dy: -2 }, label: 'right' },
  VAN: { pin: { side: 'right', dy: -24 }, label: 'right' },
  ZLO: { pin: { side: 'left', dy: 0 }, label: 'left' },
  SSZ: { pin: { side: 'left', dy: -24 }, label: 'left' },
};
const LABEL_SPOT = {
  left: { dx: -5, dy: 3, anchor: 'end' },
  right: { dx: 5, dy: 3, anchor: 'start' },
  // Up and to the right, clear of a Shanghai pin on the left and the Tokyo dot below.
  aboveRight: { dx: 2, dy: -6, anchor: 'start' },
} as const;

/** One cloud: four overlapping puffs as [dx, dy, r]. */
const CLOUD_PUFFS = [
  [0, 0, 9],
  [10, -4, 11],
  [21, 0, 8],
  [10, 3, 9],
] as const;

const isPort = (id: string): id is PortId => Object.hasOwn(PORTS, id);
const at = (id: PortId): XY => project(PORTS[id].lon, PORTS[id].lat);
const lineD = (pts: XY[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
const LAND_D = LAND.map((poly) => `${lineD(poly.map(([lon, lat]) => project(lon, lat)))}Z`);

const pathCache = new Map<string, XY[][]>();
function seaPath(from: PortId, to: PortId): XY[][] {
  const key = `${from}>${to}`;
  let path = pathCache.get(key);
  if (!path) {
    path = projectPath(route(from, to).waypoints);
    pathCache.set(key, path);
  }
  return path;
}

interface Voyage {
  id: string;
  from: PortId;
  to: PortId;
  departDay: number;
  arriveDay: number;
  customer: string;
  path: XY[][];
}

function poseOf(v: Voyage, day: number, fraction: number): Pose {
  const span = v.arriveDay - v.departDay;
  const t = span > 0 ? (day + fraction - v.departDay) / span : 1;
  return pointAlong(v.path, t);
}

/** Ships stay upright: they face left or right and only tilt a little with the route. */
function shipTransforms(pose: Pose, k: number): { move: string; turn: string } {
  const left = Math.abs(pose.angle) > 90;
  const norm = (deg: number) => ((((deg + 540) % 360) + 360) % 360) - 180;
  const tilt = Math.max(-20, Math.min(20, norm(left ? 180 - pose.angle : pose.angle)));
  return {
    move: `translate(${pose.x.toFixed(2)},${pose.y.toFixed(2)})`,
    turn: `scale(${left ? -k : k},${k}) rotate(${tilt.toFixed(1)})`,
  };
}

/** A rough text width for before the font has loaded (CJK glyphs are about 1em, Latin about 0.56em). */
function estimateWidth(text: string, size: number): number {
  let em = 0;
  for (const ch of text) em += ch.codePointAt(0)! >= 0x2e80 ? 1 : 0.56;
  return em * size;
}

export function WorldMap({ state, fraction, compact = false }: WorldMapProps) {
  const { t, tn } = useT();
  const reducedMotion = useMediaQuery(REDUCED_MOTION);
  const k = compact ? COMPACT_SCALE : 1;
  const wavesId = `waves-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const shipEls = useRef(new Map<string, { move: SVGGElement; turn: SVGGElement }>());
  const day = state.day;

  const voyages = useMemo<Voyage[]>(
    () =>
      state.shipments.flatMap((s) => {
        if (s.status !== 'atSea' || s.departDay === null || s.arriveDay === null) return [];
        if (!isPort(s.fromPortId) || !isPort(s.toPortId)) return [];
        return [
          {
            id: s.id,
            from: s.fromPortId,
            to: s.toPortId,
            departDay: s.departDay,
            arriveDay: s.arriveDay,
            customer: customerName(state, s),
            path: seaPath(s.fromPortId, s.toPortId),
          },
        ];
      }),
    [state],
  );

  // Between days the ships glide on every animation frame; React only redraws them when the day changes.
  useEffect(() => {
    if (reducedMotion || voyages.length === 0) return;
    let lastFraction = -1;
    let frame = 0;
    const tick = () => {
      const f = fraction();
      if (f !== lastFraction) {
        lastFraction = f;
        for (const v of voyages) {
          const el = shipEls.current.get(v.id);
          if (!el) continue;
          const { move, turn } = shipTransforms(poseOf(v, day, f), k);
          el.move.setAttribute('transform', move);
          el.turn.setAttribute('transform', turn);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [voyages, day, fraction, reducedMotion, k]);

  const office = state.offices[0];
  const officePort = office && isPort(office.portId) ? office.portId : null;
  const agentPorts = [...new Set(state.agents.map((a) => a.portId).filter(isPort))].filter((p) => p !== officePort);
  const pinned = new Set<PortId>([...(officePort ? [officePort] : []), ...agentPorts]);
  const plainPorts = (Object.keys(PORTS) as PortId[]).filter((p) => !pinned.has(p));
  const activePorts = new Set<PortId>(voyages.flatMap((v) => [v.from, v.to]));
  // Under reduced motion ships still move, but a day at a time.
  const nowFraction = reducedMotion ? 0 : fraction();

  return (
    <section className={compact ? 'card map-card is-compact' : 'card map-card'}>
      <svg
        className="world-map"
        viewBox="0 30 1000 360"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={t('map.label')}
      >
        <defs>
          <pattern id={wavesId} width="34" height="22" patternUnits="userSpaceOnUse">
            <path className="map-wave" d="M3 7q3-3 6 0t6 0M20 18q3-3 6 0t6 0" />
          </pattern>
        </defs>
        <rect className="map-sea" x="0" y="0" width={MAP.width} height={MAP.height} />
        <rect x="0" y="0" width={MAP.width} height={MAP.height} fill={`url(#${wavesId})`} />

        <g className="map-land">
          {LAND_D.map((d, i) => (
            <path key={`shadow-${i}`} className="land-shadow" d={d} />
          ))}
          {LAND_D.map((d, i) => (
            <path key={`sand-${i}`} className="land-sand" d={d} />
          ))}
          {LAND_D.map((d, i) => (
            <path key={`land-${i}`} className="land-main" d={d} />
          ))}
          {MOUNTAINS.map(([lon, lat], i) => {
            const [x, y] = project(lon, lat);
            return (
              <g key={`mtn-${i}`}>
                <path className="mtn" d={`M${x - 9},${y + 5}L${x},${y - 8}L${x + 9},${y + 5}Z`} />
                <path
                  className="mtn-snow"
                  d={`M${x - 3.5},${y - 3}L${x},${y - 8}L${x + 3.5},${y - 3}L${x + 1},${y - 4}L${x - 1},${y - 2.5}Z`}
                />
              </g>
            );
          })}
          {TREES.map(([lon, lat], i) => {
            const [x, y] = project(lon, lat);
            return (
              <g key={`tree-${i}`}>
                <rect className="tree-trunk" x={x - 0.9} y={y} width="1.8" height="4" />
                <circle className={i % 2 ? 'tree-top' : 'tree-top-2'} cx={x} cy={y - 1} r="3.6" />
              </g>
            );
          })}
        </g>

        <g className="map-routes">
          {voyages.map((v) => (
            <g key={v.id} data-route={v.id}>
              {v.path.map((piece, i) => (
                <path key={`halo-${i}`} className="route-halo" d={lineD(piece)} />
              ))}
              {v.path.map((piece, i) => (
                <path key={`dots-${i}`} className="route-dots" d={lineD(piece)} />
              ))}
            </g>
          ))}
        </g>

        {/* Clouds drift over the sea and routes but under ports, pins and ships, so they never hide a ship. */}
        <g className="map-clouds">
          {CLOUDS.map((c, i) => (
            <g key={i} className={c.reverse ? 'cloud is-reverse' : 'cloud'}>
              {CLOUD_PUFFS.map(([dx, dy, r], j) => (
                <circle key={j} cx={c.x + dx} cy={c.y + dy} r={r} />
              ))}
            </g>
          ))}
        </g>

        <g className="map-ports">
          {plainPorts.map((id) => {
            const [x, y] = at(id);
            const spot = LABEL_SPOT[LABEL_AT[id].label];
            // The phone map only names the ports in play, at the pins' size, so it stays readable.
            const labelled = !compact || activePorts.has(id);
            return (
              <g key={id} data-port={id}>
                <circle className="port" cx={x} cy={y} r={2.6 * k} />
                {labelled && (
                  <text
                    className="port-label"
                    x={x + spot.dx * k}
                    y={y + (compact ? spot.dy * 1.2 : spot.dy) * k}
                    textAnchor={spot.anchor}
                    style={compact ? { fontSize: 10 * k, strokeWidth: 2.4 * k } : undefined}
                  >
                    {t(PORTS[id].cityKey)}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        <g className="map-pins">
          {agentPorts.map((id) => (
            <Pin key={id} port={id} kind="agent" k={k} city={t(PORTS[id].cityKey)} sub={compact ? null : t('map.agent')} />
          ))}
          {officePort && (
            <Pin port={officePort} kind="office" k={k} city={t(PORTS[officePort].cityKey)} sub={compact ? null : t('map.office')} />
          )}
        </g>

        <g className="map-ships">
          {voyages.map((v) => {
            const { move, turn } = shipTransforms(poseOf(v, day, nowFraction), k);
            return (
              <g
                key={v.id}
                data-testid="ship"
                className="ship"
                transform={move}
                ref={(el) => {
                  const turnEl = el?.querySelector<SVGGElement>('.ship-turn');
                  if (el && turnEl) shipEls.current.set(v.id, { move: el, turn: turnEl });
                  else shipEls.current.delete(v.id);
                }}
              >
                <title>
                  {t('map.ship', { customer: v.customer, from: t(PORTS[v.from].cityKey), to: t(PORTS[v.to].cityKey) })}
                </title>
                <g className="ship-turn" transform={turn}>
                  <g className="ship-bob">
                    <path className="ship-wake" d="M-12,3 q2,-2 4,0 M-15,1 q2,-2 4,0" />
                    <rect className="ship-cargo-1" x="-5.5" y="-4.6" width="3.2" height="3.2" rx="0.6" />
                    <rect className="ship-cargo-2" x="-2" y="-4.6" width="3.2" height="3.2" rx="0.6" />
                    <rect className="ship-cabin" x="2" y="-6.5" width="4" height="5" rx="1" />
                    <path className="ship-hull" d="M-8,-1.4 L9,-1.4 L6,3.6 L-6.5,3.6Z" />
                  </g>
                </g>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="map-tag">
        <span className="map-tag-icon">
          <BoatIcon size={compact ? 14 : 16} />
        </span>
        {tn('map.shipsAtSea', voyages.length)}
      </div>
      <div className="map-legend">
        <span>
          <i className="is-office" />
          {t('map.office')}
        </span>
        <span>
          <i className="is-agent" />
          {t('map.agent')}
        </span>
      </div>
    </section>
  );
}

interface PinProps {
  port: PortId;
  kind: 'office' | 'agent';
  /** Size multiplier: 1 on laptop, bigger on phone. */
  k: number;
  city: string;
  /** The small second line ("Your office", "Agent"); null drops it. */
  sub: string | null;
}

function Pin({ port, kind, k, city, sub }: PinProps) {
  const [x, y] = at(port);
  const { side, dy } = LABEL_AT[port].pin;
  const cityRef = useRef<SVGTextElement>(null);
  const subRef = useRef<SVGTextElement>(null);
  const citySize = 10 * k;
  const subSize = 7.5 * k;
  const [measured, setMeasured] = useState<number | null>(null);

  // Size the label bubble to the text once it's laid out, and again when the web font arrives.
  useLayoutEffect(() => {
    let alive = true;
    const measure = () => {
      const a = cityRef.current;
      if (!alive || !a || typeof a.getComputedTextLength !== 'function') return;
      const b = subRef.current;
      const w = Math.max(a.getComputedTextLength(), b ? b.getComputedTextLength() : 0);
      if (w > 0) setMeasured(w);
    };
    measure();
    document.fonts?.ready.then(measure, () => {});
    return () => {
      alive = false;
    };
  }, [city, sub, k]);

  const textW = measured ?? Math.max(estimateWidth(city, citySize), sub ? estimateWidth(sub, subSize) : 0);
  const pad = 7 * k;
  const w = textW + pad * 2;
  const h = (sub ? 22 : 14) * k;
  const gap = 11 * k;
  const bx = side === 'right' ? x + gap : x - gap - w;
  const by = y + dy * k;
  const fill = kind === 'office' ? 'var(--office)' : 'var(--agent)';

  return (
    <g className="pin" data-testid={`pin-${kind}`} data-port={port}>
      <g transform={`translate(${x},${y}) scale(${0.85 * k})`}>
        <path className="pin-shape" style={{ fill }} d="M0,0 C-5,-7 -10,-11 -10,-18 A10,10 0 1 1 10,-18 C10,-11 5,-7 0,0Z" />
        {kind === 'office' ? (
          <path className="pin-house" d="M-5,-16 L0,-22 L5,-16 L5,-12 L-5,-12Z" />
        ) : (
          <path className="pin-flag" d="M-3,-11 L-3,-24 M-3,-24 L5,-21 L-3,-18" />
        )}
      </g>
      <rect className="pin-bubble" x={bx} y={by - k} width={w} height={h} rx={8 * k} />
      <text ref={cityRef} className="pin-city" x={bx + pad} y={by + (sub ? 9.5 : 9.3) * k} style={{ fontSize: citySize }}>
        {city}
      </text>
      {sub && (
        <text ref={subRef} className="pin-sub" x={bx + pad} y={by + 17.5 * k} style={{ fontSize: subSize }}>
          {sub}
        </text>
      )}
    </g>
  );
}
