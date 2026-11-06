import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import type { GameStore } from '../../app/store';
import { useT } from '../../i18n/I18nProvider';
import { customerName } from '../../rules/chain';
import type { GameState } from '../../rules/types';
import { PORTS, route, type PortId } from '../../rules/world';
import { BoatIcon } from '../Icons';
import { useMediaQuery } from '../useMediaQuery';
import { HEAD_RISE, hitRadius, hitTargets, nearestTarget, toMapPoint, viewScale, type ViewScale } from './hits';
import { CLOUDS, LAND, MOUNTAINS, TREES } from './land';
import {
  DEFAULT_OBSTACLES,
  estimateWidth,
  MAP_VIEW,
  pinBubbleSize,
  placeLabels,
  portLabelSize,
  type Box,
  type Placement,
} from './labels';
import { PinPopup, type PopupVariant } from './PinPopup';
import { MAP, pointAlong, project, projectPath, type Pose, type XY } from './projection';

export interface WorldMapProps {
  state: GameState;
  /** How far the current in-game day has run (0 to 1), read every frame for smooth sailing. */
  fraction: () => number;
  /**
   * Phone layout: the map is drawn wider than the screen in a strip that scrolls sideways, centred on the office on
   * screen, with bigger pins, ships and labels, and only ports with a ship at sea are named.
   */
  compact?: boolean;
  /** The store the pin popup signs agents and opens offices through. */
  store: GameStore;
  /** The office on screen; its pin gets a dashed ring. */
  viewedOfficeId: string;
  /** An own-office pin was pressed: switch to that office. */
  onSelectOffice: (officeId: string) => void;
  /** An office was just opened from the popup: switch to it. */
  onOfficeOpened: (officeId: string) => void;
  /** How the pin popup shows: anchored to the pin on a laptop, or a bottom sheet on the phone. */
  popupVariant: PopupVariant;
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const COMPACT_SCALE = 1.8;

/** One cloud: four overlapping puffs as [dx, dy, r]. */
const CLOUD_PUFFS = [
  [0, 0, 9],
  [10, -4, 11],
  [21, 0, 8],
  [10, 3, 9],
] as const;

const isPort = (id: string | null | undefined): id is PortId => !!id && Object.hasOwn(PORTS, id);
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

/** One text the map measures: its class and font size decide its width. */
interface Measure {
  text: string;
  cls: 'pin-city' | 'pin-sub' | 'port-label';
  size: number;
}
const measureKey = (m: Measure) => `${m.cls}|${m.size}|${m.text}`;

/** A box on the page (an element over the map) in map units, a little padded. */
function toMapBox(rect: DOMRect, view: ViewScale): Box | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const pad = 4;
  const [x, y] = toMapPoint(view, rect.left, rect.top);
  return { x: x - pad, y: y - pad, w: rect.width / view.s + pad * 2, h: rect.height / view.s + pad * 2 };
}

interface PinSpec {
  port: PortId;
  kind: 'office' | 'agent';
  officeId: string | null;
  city: string;
  sub: string | null;
  label: string;
}

export function WorldMap({
  state,
  fraction,
  compact = false,
  store,
  viewedOfficeId,
  onSelectOffice,
  onOfficeOpened,
  popupVariant,
}: WorldMapProps) {
  const { t, tn } = useT();
  const reducedMotion = useMediaQuery(REDUCED_MOTION);
  const k = compact ? COMPACT_SCALE : 1;
  const wavesId = `waves-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const shipEls = useRef(new Map<string, { move: SVGGElement; turn: SVGGElement }>());
  const cardRef = useRef<HTMLElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const measureRef = useRef<SVGTextElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
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

  // Every office is a pin; an agent is a pin where there's no office of the player's own.
  const officePins: PinSpec[] = [];
  const officeAt = new Map<PortId, string>();
  for (const o of state.offices) {
    if (!isPort(o.portId) || officeAt.has(o.portId)) continue;
    officeAt.set(o.portId, o.id);
    const city = t(PORTS[o.portId].cityKey);
    officePins.push({
      port: o.portId,
      kind: 'office',
      officeId: o.id,
      city,
      sub: compact ? null : t('map.office'),
      label: t('map.officePin', { city }),
    });
  }
  const agentPins: PinSpec[] = [];
  for (const a of state.agents) {
    if (!isPort(a.portId) || officeAt.has(a.portId) || agentPins.some((p) => p.port === a.portId)) continue;
    const city = t(PORTS[a.portId].cityKey);
    agentPins.push({
      port: a.portId,
      kind: 'agent',
      officeId: null,
      city,
      // The agent's name shows on the phone too; when the bubble can't fit, the whole label is hidden.
      sub: a.name,
      label: t('map.agentPin', { city, name: a.name }),
    });
  }
  const pins = [...agentPins, ...officePins];
  const pinned = new Set(pins.map((p) => p.port));
  const plainPorts = (Object.keys(PORTS) as PortId[]).filter((p) => !pinned.has(p));
  const activePorts = new Set<PortId>(voyages.flatMap((v) => [v.from, v.to]));
  // The phone map only names the ports in play, at the pins' size, so it stays readable.
  const portFont = compact ? 10 * k : 8;

  // Label widths come from the real text once it's laid out (and again once the web font arrives); until then, an estimate.
  const measures: Measure[] = [
    ...pins.flatMap((p): Measure[] => [
      { text: p.city, cls: 'pin-city', size: 10 * k },
      ...(p.sub ? [{ text: p.sub, cls: 'pin-sub' as const, size: 7.5 * k }] : []),
    ]),
    ...plainPorts.map((p): Measure => ({ text: t(PORTS[p].cityKey), cls: 'port-label', size: portFont })),
  ];
  const signature = `${compact}\n${measures.map(measureKey).join('\n')}`;
  const [widths, setWidths] = useState<Map<string, number>>(() => new Map());
  const [overlays, setOverlays] = useState<Box[] | null>(null);
  const [scale, setScale] = useState<number | null>(null);
  const widthOf = (m: Measure) => widths.get(measureKey(m)) ?? estimateWidth(m.text, m.size);

  const measureOverlays = useCallback(() => {
    const view = viewScale(svgRef.current);
    const tag = tagRef.current?.getBoundingClientRect();
    const legend = legendRef.current?.getBoundingClientRect();
    let boxes = view && tag && legend ? [toMapBox(tag, view), toMapBox(legend, view)].filter((b): b is Box => b !== null) : [];
    // The phone strip scrolls under the tag and legend, so each covers its whole band across the map.
    if (compact) boxes = boxes.map((b) => ({ x: MAP_VIEW.x, y: b.y, w: MAP_VIEW.w, h: b.h }));
    setOverlays(boxes.length === 2 ? boxes : null);
    setScale(view?.s ?? null);
  }, [compact]);

  useLayoutEffect(() => {
    let alive = true;
    const run = () => {
      if (!alive) return;
      const el = measureRef.current;
      const next = new Map<string, number>();
      if (el && typeof el.getComputedTextLength === 'function') {
        for (const m of measures) {
          el.setAttribute('class', m.cls);
          el.style.fontSize = `${m.size}px`;
          el.textContent = m.text;
          const w = el.getComputedTextLength();
          if (w > 0) next.set(measureKey(m), w);
        }
        el.textContent = '';
      }
      setWidths(next);
      measureOverlays();
    };
    run();
    document.fonts?.ready.then(run, () => {});
    return () => {
      alive = false;
    };
    // `measures` is fully described by `signature`, so a new array with the same texts doesn't measure again.
  }, [signature, measureOverlays]);

  // The tag and legend keep their CSS size as the map scales, so their footprint in map units changes with it.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measureOverlays());
    ro.observe(svg);
    return () => ro.disconnect();
  }, [measureOverlays]);

  const pinLabels = pins.map((p) => {
    const cityW = widthOf({ text: p.city, cls: 'pin-city', size: 10 * k });
    const subW = p.sub ? widthOf({ text: p.sub, cls: 'pin-sub', size: 7.5 * k }) : 0;
    return { port: p.port, kind: p.kind, ...pinBubbleSize(cityW, subW, p.sub !== null, k) };
  });
  const portLabels = plainPorts.map((port) => {
    const w = widthOf({ text: t(PORTS[port].cityKey), cls: 'port-label', size: portFont });
    return { port, ...portLabelSize(w, portFont), labelled: !compact || activePorts.has(port) };
  });
  const placements = new Map<PortId, Placement>(
    placeLabels(pinLabels, portLabels, {
      compact,
      k,
      obstacles: overlays ?? DEFAULT_OBSTACLES[compact ? 'compact' : 'laptop'],
    }).map((p) => [p.port, p]),
  );

  // ---------- Pins, ports and the popup ----------
  const [popPort, setPopPort] = useState<PortId | null>(null);
  // Once its port has an office of the player's own, a popup has nothing left to offer.
  const shownPort = popPort && !officeAt.has(popPort) ? popPort : null;
  const focusNext = useRef<PortId | null>(null);
  const hitR = hitRadius(compact, scale);
  const targets = hitTargets(
    pins.map((p) => p.port),
    plainPorts,
    k,
  );

  // Focus goes back to a pin after its popup closes, once the pin is drawn (an office just opened redraws it).
  useEffect(() => {
    const port = focusNext.current;
    if (!port) return;
    focusNext.current = null;
    svgRef.current?.querySelector<SVGGElement>(`[role="button"][data-port="${port}"]`)?.focus();
  });

  const close = useCallback((returnFocus: boolean) => {
    setPopPort((port) => {
      if (returnFocus) focusNext.current = port;
      return null;
    });
  }, []);

  const activate = (port: PortId) => {
    const officeId = officeAt.get(port);
    if (officeId) {
      setPopPort(null);
      onSelectOffice(officeId);
    } else if (shownPort === port) {
      close(true);
    } else {
      setPopPort(port);
    }
  };

  // A click on a label goes to its pin or port; anywhere else, to the nearest pin head or port dot within reach,
  // so where hit areas overlap the one you aimed at wins. Off every target, it closes the popup.
  const onMapClick = (e: MouseEvent<SVGSVGElement>) => {
    const target = e.target as Element;
    let port: PortId | null = null;
    const label = target.closest('[data-label-for]')?.getAttribute('data-label-for');
    if (isPort(label)) port = label;
    else {
      const view = viewScale(svgRef.current);
      if (view) {
        port = nearestTarget(targets, ...toMapPoint(view, e.clientX, e.clientY), hitR);
      } else {
        const el = target.closest('[data-port], [data-hit]');
        const id = el?.getAttribute('data-port') ?? el?.getAttribute('data-hit');
        port = isPort(id) ? id : null;
      }
    }
    if (port) activate(port);
    else if (shownPort) close(true);
  };

  const onPinKey = (port: PortId) => (e: KeyboardEvent) => {
    // Enter only: Space stays the game's pause key, even on a pin.
    if (e.key !== 'Enter') return;
    e.preventDefault();
    activate(port);
  };

  // Esc closes the popup, and a press outside the map closes it too; neither holds the game's other keys.
  useEffect(() => {
    if (!shownPort) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || cardRef.current?.closest('[inert]')) return;
      close(true);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.target instanceof Node && cardRef.current?.contains(e.target)) return;
      close(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [shownPort, close]);

  const officeOpened = (officeId: string) => {
    close(true);
    onOfficeOpened(officeId);
  };

  // The anchored popup sits beside the pin's head, or the port's dot.
  let popAt: XY | null = null;
  if (shownPort) {
    const [x, y] = at(shownPort);
    popAt = pinned.has(shownPort) ? [x, y - HEAD_RISE * k] : [x, y];
  }

  // The phone strip centres the office on screen: at once when the map is first drawn, then gliding to each office
  // switched to (a jump under reduced motion).
  const viewedPort = state.offices.find((o) => o.id === viewedOfficeId)?.portId;
  const centred = useRef(false);
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip || !isPort(viewedPort)) return;
    const [x] = at(viewedPort);
    const left = ((x - MAP_VIEW.x) / MAP_VIEW.w) * strip.scrollWidth - strip.clientWidth / 2;
    const behavior = centred.current && !reducedMotionRef.current ? 'smooth' : 'instant';
    centred.current = true;
    strip.scrollTo({ left, behavior });
  }, [viewedOfficeId, viewedPort]);

  // Under reduced motion ships still move, but a day at a time.
  const nowFraction = reducedMotion ? 0 : fraction();

  return (
    <section ref={cardRef} className={compact ? 'card map-card is-compact' : 'card map-card'}>
      <MapStrip on={compact} stripRef={stripRef}>
        <svg
          ref={svgRef}
          className="world-map"
          viewBox="0 30 1000 360"
          preserveAspectRatio="xMidYMid meet"
          role="group"
          aria-label={t('map.label')}
          onClick={onMapClick}
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

          {/* Transparent hit circles keep every pin and port at least 32 px across. They sit under everything; which
              one a click is for is worked out from where it landed (see onMapClick). */}
          <g className="map-hits">
            {targets.map((h) => (
              <circle key={h.port} className="pin-hit" data-hit={h.port} cx={h.x} cy={h.y} r={hitR} />
            ))}
          </g>

          <g className="map-ports">
            {plainPorts.map((id) => {
              const [x, y] = at(id);
              const box = placements.get(id)?.box ?? null;
              return (
                <g
                  key={id}
                  className="port-btn"
                  data-port={id}
                  role="button"
                  tabIndex={0}
                  aria-label={t('map.portPin', { city: t(PORTS[id].cityKey) })}
                  aria-expanded={shownPort === id}
                  onKeyDown={onPinKey(id)}
                >
                  <circle className="port-focus" cx={x} cy={y} r={7 * k} />
                  <circle className="port" cx={x} cy={y} r={2.6 * k} />
                  {box && (
                    <text
                      className="port-label"
                      data-label-for={id}
                      x={box.x + 1}
                      y={box.y + portFont * 0.85}
                      style={compact ? { fontSize: portFont, strokeWidth: 2.4 * k } : undefined}
                    >
                      {t(PORTS[id].cityKey)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          <g className="map-pins">
            {pins.map((p) => (
              <Pin
                key={p.port}
                spec={p}
                k={k}
                placement={placements.get(p.port) ?? null}
                viewed={p.officeId !== null && p.officeId === viewedOfficeId}
                expanded={p.kind === 'agent' ? shownPort === p.port : undefined}
                onKeyDown={onPinKey(p.port)}
              />
            ))}
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

          {/* Measures label text in the label's own font; never shown. */}
          <text ref={measureRef} className="label-measure" aria-hidden="true" x="0" y="0" />
        </svg>
      </MapStrip>

      <div ref={tagRef} className="map-tag">
        <span className="map-tag-icon">
          <BoatIcon size={compact ? 14 : 16} />
        </span>
        {tn('map.shipsAtSea', voyages.length)}
      </div>
      <div ref={legendRef} className="map-legend">
        <span>
          <i className="is-office" />
          {t('map.offices', { n: state.offices.length })}
        </span>
        <span>
          <i className="is-agent" />
          {t('map.agents', { n: state.agents.length })}
        </span>
      </div>

      {shownPort && (
        <PinPopup
          key={shownPort}
          state={state}
          portId={shownPort}
          variant={popupVariant}
          store={store}
          onClose={() => close(true)}
          onOfficeOpened={officeOpened}
          cardRef={cardRef}
          svgRef={svgRef}
          at={popAt}
        />
      )}
    </section>
  );
}

/** On the phone, the map sits in a strip that scrolls sideways; on a laptop it's drawn straight into the card. */
function MapStrip({ on, stripRef, children }: { on: boolean; stripRef: RefObject<HTMLDivElement | null>; children: ReactNode }) {
  if (!on) return children;
  return (
    <div ref={stripRef} className="map-strip">
      {children}
    </div>
  );
}

interface PinProps {
  spec: PinSpec;
  /** Size multiplier: 1 on laptop, bigger on phone. */
  k: number;
  /** Where its label bubble goes; null hides it (a crowded phone strip). */
  placement: Placement | null;
  /** The office on screen. */
  viewed: boolean;
  /** For a pin that opens the popup: whether its popup is open. */
  expanded: boolean | undefined;
  onKeyDown: (e: KeyboardEvent) => void;
}

function Pin({ spec, k, placement, viewed, expanded, onKeyDown }: PinProps) {
  const { port, kind, city, sub, label } = spec;
  const [x, y] = at(port);
  const box = placement?.box ?? null;
  const leader = placement?.leader ?? null;
  const fill = kind === 'office' ? 'var(--office)' : 'var(--agent)';

  return (
    <g
      className={viewed ? 'pin is-viewed' : 'pin'}
      data-testid={`pin-${kind}`}
      data-port={port}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-expanded={expanded}
      aria-current={viewed ? 'true' : undefined}
      onKeyDown={onKeyDown}
    >
      {leader && <path className="pin-leader" d={`M${leader[0].toFixed(1)},${leader[1].toFixed(1)}L${leader[2].toFixed(1)},${leader[3].toFixed(1)}`} />}
      <g transform={`translate(${x},${y}) scale(${0.85 * k})`}>
        {viewed && <circle className="pin-ring" cx="0" cy="-18" r="15" />}
        <circle className="pin-focus" cx="0" cy="-18" r="15" />
        <path className="pin-shape" style={{ fill }} d="M0,0 C-5,-7 -10,-11 -10,-18 A10,10 0 1 1 10,-18 C10,-11 5,-7 0,0Z" />
        {kind === 'office' ? (
          <path className="pin-house" d="M-5,-16 L0,-22 L5,-16 L5,-12 L-5,-12Z" />
        ) : (
          <path className="pin-flag" d="M-3,-11 L-3,-24 M-3,-24 L5,-21 L-3,-18" />
        )}
      </g>
      {box && (
        <g data-label-for={port}>
          <rect className="pin-bubble" x={box.x} y={box.y} width={box.w} height={box.h} rx={8 * k} />
          <text className="pin-city" x={box.x + 7 * k} y={box.y + (sub ? 10 : 10.3) * k} style={{ fontSize: 10 * k }}>
            {city}
          </text>
          {sub && (
            <text className="pin-sub" x={box.x + 7 * k} y={box.y + 18.5 * k} style={{ fontSize: 7.5 * k }}>
              {sub}
            </text>
          )}
        </g>
      )}
    </g>
  );
}
