import { fireEvent, render, screen, within } from '@testing-library/react';
import { createGameStore, useGameState, type GameStore } from '../../app/store';
import { t, type Lang } from '../../i18n';
import { I18nProvider } from '../../i18n/I18nProvider';
import { openOffice, signAgent } from '../../rules/network';
import { createGame } from '../../rules/newGame';
import type { GameState, Shipment, ShipmentStatus } from '../../rules/types';
import { HOME_PORTS, PORTS, route, type PortId } from '../../rules/world';
import { useHotkeys } from '../useHotkeys';
import { DOT_RADIUS, HEAD_RISE, hitTargets } from './hits';
import { pointAlong, project, projectPath } from './projection';
import { WorldMap, type WorldMapProps } from './WorldMap';

function shipment(id: string, status: ShipmentStatus, fromPortId: string, toPortId: string): Shipment {
  const atSea = status === 'atSea';
  return {
    id,
    kind: 'sale',
    customerId: 'c1',
    sellingOfficeId: 'o1',
    direction: 'export',
    fromPortId,
    toPortId,
    origin: { kind: 'office', officeId: 'o1' },
    destination: { kind: 'agent', agentId: 'a1' },
    status,
    margin: 500,
    agentShare: 0,
    localCharges: 0,
    chargesPaid: false,
    departDay: atSea ? 10 : null,
    arriveDay: atSea ? 30 : null,
    agentReadyDay: null,
    arrived: false,
    paid: false,
    arrivalDone: false,
  };
}

function gameWithShipments(): GameState {
  const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
  s.day = 15;
  s.shipments.push(
    shipment('s1', 'atSea', 'TPE', 'LAX'),
    shipment('s2', 'atSea', 'RTM', 'NYC'),
    shipment('s3', 'origin', 'TPE', 'SHA'),
  );
  return s;
}

function mount(state: GameState, lang: Lang = 'en', fraction = 0, compact = false) {
  return render(
    <I18nProvider lang={lang}>
      <WorldMap
        state={state}
        fraction={() => fraction}
        compact={compact}
        store={createGameStore(state)}
        viewedOfficeId={state.offices[0].id}
        onSelectOffice={() => {}}
        onOfficeOpened={() => {}}
        popupVariant={compact ? 'sheet' : 'anchored'}
      />
    </I18nProvider>,
  );
}

/** The text a port is named with on the map (pin bubble or plain label), or null when it has none. */
function portLabel(container: HTMLElement, port: string): string | null {
  return container.querySelector(`[data-port="${port}"] .pin-city, [data-port="${port}"] .port-label`)?.textContent ?? null;
}

describe('WorldMap', () => {
  it('one ship per shipment at sea', () => {
    const { container } = mount(gameWithShipments());
    expect(screen.getAllByTestId('ship')).toHaveLength(2);
    const svg = container.querySelector('svg.world-map');
    expect(svg).toHaveAttribute('viewBox', '0 30 1000 360');
    expect(svg).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
    // A dashed route for each ship at sea (the Atlantic one is drawn in two pieces).
    expect(container.querySelectorAll('[data-route="s1"] .route-dots')).toHaveLength(1);
    expect(container.querySelectorAll('[data-route="s2"] .route-dots')).toHaveLength(2);
    expect(container.querySelectorAll('[data-route="s3"]')).toHaveLength(0);
  });

  it('places each ship along its route by day and fraction', () => {
    mount(gameWithShipments(), 'en', 0.5);
    const ship = screen.getAllByTestId('ship')[0];
    // Day 15.5 of a day-10 to day-30 voyage is 27.5% of the way.
    const at = pointAlong(projectPath(route('TPE', 'LAX').waypoints), 5.5 / 20);
    expect(ship).toHaveAttribute('transform', `translate(${at.x.toFixed(2)},${at.y.toFixed(2)})`);
  });

  it('labels follow the language', () => {
    mount(gameWithShipments(), 'zh-Hant');
    const office = screen.getByTestId('pin-office');
    expect(within(office).getByText('台北')).toBeInTheDocument();
    expect(screen.queryByText('Taipei')).not.toBeInTheDocument();
  });

  it('on the phone, a plain port with a ship at sea is named in the language', () => {
    const s = gameWithShipments();
    s.shipments.push(shipment('s4', 'atSea', 'TPE', 'SZX'));
    const { container } = mount(s, 'zh-Hant', 0, true);
    expect(portLabel(container, 'SZX')).toBe('深圳');
    // RTM and NYC are plain ports too, both with the Atlantic ship.
    expect(portLabel(container, 'RTM')).toBe('鹿特丹');
    expect(portLabel(container, 'NYC')).toBe('紐約');
  });

  it('on the phone, a quiet plain port has no label', () => {
    const { container } = mount(gameWithShipments(), 'en', 0, true);
    expect(container.querySelector('[data-port="SYD"] circle.port')).toBeInTheDocument();
    expect(portLabel(container, 'SYD')).toBeNull();
    // Office and agents are always named.
    expect(portLabel(container, 'TPE')).toBe('Taipei');
    expect(portLabel(container, 'LAX')).toBe('Los Angeles');
  });

  it('on a laptop, every port has its label', () => {
    const { container } = mount(gameWithShipments());
    for (const [id, port] of Object.entries(PORTS)) {
      expect(portLabel(container, id)).toBe(t('en', port.cityKey));
    }
  });

  it('shows the office and every agent as pins', () => {
    const s = gameWithShipments();
    mount(s);
    expect(screen.getAllByTestId('pin-office')).toHaveLength(1);
    expect(screen.getAllByTestId('pin-agent')).toHaveLength(s.agents.length);
    expect(screen.getByText('Ships at sea: 2')).toBeInTheDocument();
  });
});

/** The map over a live store, the way the game screen shows it. */
function LiveMap({ store, ...props }: { store: GameStore } & Partial<WorldMapProps>) {
  const state = useGameState(store, (x) => x);
  return (
    <WorldMap
      state={state}
      store={store}
      fraction={() => 0}
      viewedOfficeId={state.offices[0].id}
      onSelectOffice={() => {}}
      onOfficeOpened={() => {}}
      popupVariant={props.compact ? 'sheet' : 'anchored'}
      {...props}
    />
  );
}

function mountLive(store: GameStore, props: Partial<WorldMapProps> = {}, lang: Lang = 'en') {
  return render(
    <I18nProvider lang={lang}>
      <LiveMap store={store} {...props} />
    </I18nProvider>,
  );
}

function richGame(): GameState {
  const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
  s.cash = 1_000_000;
  return s;
}

/** Draws the map at 1 CSS px per map unit, so a click's clientX / clientY are map coordinates (the view starts at y = 30). */
function unitScale(container: HTMLElement) {
  const svg = container.querySelector('svg.world-map')!;
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1000, bottom: 360, width: 1000, height: 360, x: 0, y: 0, toJSON: () => ({}) });
}

const pinButton = (container: HTMLElement, port: string) =>
  container.querySelector<SVGGElement>(`[role="button"][data-port="${port}"]`)!;

const uncovered = (s: GameState) =>
  (Object.keys(PORTS) as PortId[]).find((p) => !s.offices.some((o) => o.portId === p) && !s.agents.some((a) => a.portId === p))!;

describe('WorldMap pins and ports', () => {
  it("agent pin shows the agent's name", () => {
    for (const compact of [false, true]) {
      const s = richGame();
      const { unmount } = mount(s, 'en', 0, compact);
      const pins = screen.getAllByTestId('pin-agent');
      expect(pins).toHaveLength(s.agents.length);
      for (const agent of s.agents) {
        const pin = pins.find((p) => p.getAttribute('data-port') === agent.portId)!;
        expect(pin.querySelector('.pin-city'), `compact ${compact}`).toHaveTextContent(t('en', PORTS[agent.portId as PortId].cityKey));
        expect(pin.querySelector('.pin-sub'), `compact ${compact}`).toHaveTextContent(agent.name);
      }
      unmount();
    }
  });

  it('on a crowded phone strip an agent label shows the city and the name together, or not at all', () => {
    const s = richGame();
    s.cash = 10_000_000;
    for (const p of Object.keys(PORTS) as PortId[]) signAgent(s, p);
    mount(s, 'en', 0, true);
    const pins = screen.getAllByTestId('pin-agent');
    expect(pins).toHaveLength(Object.keys(PORTS).length - 1);
    for (const pin of pins) {
      const agent = s.agents.find((a) => a.portId === pin.getAttribute('data-port'))!;
      const city = pin.querySelector('.pin-city');
      const sub = pin.querySelector('.pin-sub');
      expect(Boolean(city), agent.portId).toBe(Boolean(sub));
      if (sub) expect(sub).toHaveTextContent(agent.name);
      // A hidden label leaves the pin a named button.
      expect(pin).toHaveAccessibleName(t('en', 'map.agentPin', { city: t('en', PORTS[agent.portId as PortId].cityKey), name: agent.name }));
    }
  });

  it('Space on a focused pin pauses the game and opens no popup; Enter opens it', () => {
    const store = createGameStore(richGame());
    const onSpace = vi.fn();
    function PauseKey() {
      useHotkeys(true, { space: onSpace });
      return null;
    }
    const { container } = render(
      <I18nProvider lang="en">
        <PauseKey />
        <LiveMap store={store} />
      </I18nProvider>,
    );
    const plain = uncovered(store.getState());
    const agent = store.getState().agents[0].portId;
    for (const port of [plain, agent]) {
      pinButton(container, port).focus();
      fireEvent.keyDown(pinButton(container, port), { key: ' ', code: 'Space' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    }
    expect(onSpace).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(pinButton(container, plain), { key: 'Enter', code: 'Enter' });
    expect(screen.getByRole('dialog', { name: t('en', PORTS[plain].cityKey) })).toBeInTheDocument();
    expect(onSpace).toHaveBeenCalledTimes(2);
  });

  it('an own-office pin switches office without a popup', () => {
    const store = createGameStore(richGame());
    const second = uncovered(store.getState());
    store.update((s) => {
      openOffice(s, second);
    });
    const [home, opened] = store.getState().offices;
    const onSelectOffice = vi.fn();
    const { container } = mountLive(store, { onSelectOffice, viewedOfficeId: home.id });
    expect(screen.getAllByTestId('pin-office')).toHaveLength(2);
    expect(pinButton(container, home.portId)).toHaveClass('is-viewed');
    expect(pinButton(container, opened.portId)).not.toHaveClass('is-viewed');

    fireEvent.click(pinButton(container, opened.portId));
    expect(onSelectOffice).toHaveBeenCalledWith(opened.id);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.keyDown(pinButton(container, home.portId), { key: 'Enter' });
    expect(onSelectOffice).toHaveBeenLastCalledWith(home.id);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each([
    ['laptop', false],
    ['phone', true],
  ])('pins and ports are focusable buttons with a hit area of at least 32 px (%s)', (_name, compact) => {
    const store = createGameStore(richGame());
    const { container } = mountLive(store, { compact });
    for (const port of Object.keys(PORTS)) {
      const buttons = container.querySelectorAll(`[role="button"][data-port="${port}"]`);
      expect(buttons, port).toHaveLength(1);
      expect(buttons[0]).toHaveAttribute('tabindex', '0');
      expect(buttons[0]).toHaveAccessibleName();
      // At least 36 map units on a laptop and 56 on the phone strip; both grow where the map is drawn too small for 32 px.
      const hit = container.querySelector(`.pin-hit[data-hit="${port}"]`);
      expect(Number(hit?.getAttribute('r')) * 2, port).toBeGreaterThanOrEqual(compact ? 56 : 36);
    }
    // Enter opens a plain port's popup.
    const plain = uncovered(store.getState());
    fireEvent.keyDown(pinButton(container, plain), { key: 'Enter' });
    expect(screen.getByRole('dialog', { name: t('en', PORTS[plain].cityKey) })).toBeInTheDocument();
  });

  it('the legend shows the office and agent counts and no region count', () => {
    const store = createGameStore(richGame());
    const { container } = mountLive(store);
    const legend = container.querySelector('.map-legend')!;
    expect(legend).toHaveTextContent('Your offices · 1');
    expect(legend).toHaveTextContent(`Agents · ${store.getState().agents.length}`);
    expect(legend.textContent).not.toMatch(/region/i);
    expect(legend.querySelectorAll(':scope > span')).toHaveLength(2);
  });

  it('the legend follows the language', () => {
    const store = createGameStore(richGame());
    const { container } = mountLive(store, {}, 'zh-Hant');
    expect(container.querySelector('.map-legend')).toHaveTextContent(`你的辦公室 · 1國外代理 · ${store.getState().agents.length}`);
  });

  it.each([
    ['laptop', false],
    ['phone', true],
  ])('each of the four overlapping Southeast Asia pins opens its own popup (%s)', (_name, compact) => {
    const store = createGameStore(richGame());
    const cluster: PortId[] = ['SIN', 'SGN', 'LCH', 'JKT'];
    store.update((s) => {
      for (const p of cluster) if (!s.agents.some((a) => a.portId === p)) signAgent(s, p);
    });
    const { container } = mountLive(store, { compact });
    unitScale(container);
    const targets = hitTargets(cluster, [], compact ? 1.8 : 1);
    // Where the four hit circles overlap, the last one drawn is on top and takes every click there.
    const top = [...container.querySelectorAll('.pin-hit')]
      .filter((c) => cluster.includes(c.getAttribute('data-hit') as PortId))
      .at(-1)!;
    for (const target of targets) {
      fireEvent.click(top, { clientX: target.x, clientY: target.y - 30 });
      expect(screen.getByRole('dialog', { name: t('en', PORTS[target.port].cityKey) })).toBeInTheDocument();
    }
  });

  it.each([
    ['laptop', false],
    ['phone', true],
  ])("from every home port, a tap at each other port's own centre opens that port (%s)", (_name, compact) => {
    for (const home of HOME_PORTS) {
      const s = createGame({ seed: 1, homePortId: home, mode: 'normal' });
      s.cash = 1_000_000;
      const { container, unmount } = mountLive(createGameStore(s), { compact });
      unitScale(container);
      const svg = container.querySelector('svg.world-map')!;
      // Pins and plain ports alike are tapped where the port is (the view starts at y = 30).
      for (const port of (Object.keys(PORTS) as PortId[]).filter((p) => p !== home)) {
        const [x, y] = project(PORTS[port].lon, PORTS[port].lat);
        fireEvent.click(svg, { clientX: x, clientY: y - 30 });
        expect(screen.getByRole('dialog', { name: t('en', PORTS[port].cityKey) }), `${home} game, ${port}`).toBeInTheDocument();
      }
      unmount();
    }
  });

  it.each([
    ['laptop', false],
    ['phone', true],
  ])('a port dot inside a pin head is drawn above the pin, and a tap on it opens that port (%s)', (_name, compact) => {
    // In a Taipei game Shanghai's dot falls inside the Taipei pin's head.
    const { container } = mountLive(createGameStore(richGame()), { compact });
    unitScale(container);
    const pin = pinButton(container, 'TPE');
    const over = container.querySelectorAll('.map-dots-over circle.port');
    const sha = container.querySelector('.map-dots-over circle.port[data-dot-for="SHA"]');
    expect(sha).toBeInTheDocument();
    expect(pin.compareDocumentPosition(sha!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const [x, y] = project(PORTS.SHA.lon, PORTS.SHA.lat);
    expect(sha).toHaveAttribute('cx', String(x));
    expect(sha).toHaveAttribute('cy', String(y));
    // Only dots a head covers are drawn again; the rest stay under the pins.
    expect(over.length).toBeLessThan(5);
    fireEvent.click(sha!, { clientX: x, clientY: y - 30 });
    expect(screen.getByRole('dialog', { name: 'Shanghai' })).toBeInTheDocument();
  });

  it.each([
    ['laptop', false],
    ['phone', true],
  ])("from every home port, a tap on a pin's head opens that pin (%s)", (_name, compact) => {
    const k = compact ? 1.8 : 1;
    let tapped = 0;
    for (const home of HOME_PORTS) {
      const s = createGame({ seed: 1, homePortId: home, mode: 'normal' });
      s.cash = 1_000_000;
      const onSelectOffice = vi.fn();
      const { container, unmount } = mountLive(createGameStore(s), { compact, onSelectOffice });
      unitScale(container);
      const svg = container.querySelector('svg.world-map')!;
      const pins: [PortId, string | null][] = [
        [home, s.offices[0].id],
        ...s.agents.map((a): [PortId, null] => [a.portId as PortId, null]),
      ];
      for (const [port, officeId] of pins) {
        const [x, y] = project(PORTS[port].lon, PORTS[port].lat);
        const head: [number, number] = [x, y - HEAD_RISE * k];
        // A head right on another port's dot gives that spot to the dot.
        const onADot = (Object.keys(PORTS) as PortId[]).some((p) => {
          const [px, py] = project(PORTS[p].lon, PORTS[p].lat);
          return Math.hypot(px - head[0], py - head[1]) <= DOT_RADIUS * k;
        });
        if (onADot) continue;
        fireEvent.click(svg, { clientX: head[0], clientY: head[1] - 30 });
        const where = `${home} game, ${port}`;
        if (officeId) expect(onSelectOffice, where).toHaveBeenLastCalledWith(officeId);
        else expect(screen.getByRole('dialog', { name: t('en', PORTS[port].cityKey) }), where).toBeInTheDocument();
        tapped++;
      }
      unmount();
    }
    // Only a head sitting right on another dot is skipped.
    expect(tapped).toBeGreaterThanOrEqual(HOME_PORTS.length * 3 - 1);
  });

  it('a touch on a port dot under a pin head opens the port, though the browser nudges the click toward the pin', () => {
    // In a Taipei game Shanghai's dot sits just under the Taipei pin's head.
    const store = createGameStore(richGame());
    const onSelectOffice = vi.fn();
    const { container } = mountLive(store, { compact: true, onSelectOffice });
    unitScale(container);
    const svg = container.querySelector('svg.world-map')!;
    const [x, y] = project(PORTS.SHA.lon, PORTS.SHA.lat);
    // Chrome's touch adjustment moved a real tap like this 9 map units up, onto the pin.
    fireEvent.pointerDown(svg, { pointerType: 'touch', clientX: x, clientY: y - 30 });
    fireEvent.click(svg, { clientX: x, clientY: y - 30 - 9 });
    expect(screen.getByRole('dialog', { name: 'Shanghai' })).toBeInTheDocument();
    expect(onSelectOffice).not.toHaveBeenCalled();
    // A mouse click is taken where it lands.
    fireEvent.pointerDown(svg, { pointerType: 'mouse', clientX: x, clientY: y - 30 - 9 });
    fireEvent.click(svg, { clientX: x, clientY: y - 30 - 9 });
    expect(onSelectOffice).toHaveBeenCalledWith(store.getState().offices[0].id);
  });

  it('clicking the open pin again or empty map closes the popup and focus goes back to the pin', () => {
    const store = createGameStore(richGame());
    const { container } = mountLive(store);
    const agent = store.getState().agents[0];
    fireEvent.click(pinButton(container, agent.portId));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(pinButton(container, agent.portId));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pinButton(container, agent.portId)).toHaveFocus();

    fireEvent.click(pinButton(container, agent.portId));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(container.querySelector('.map-sea')!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pinButton(container, agent.portId)).toHaveFocus();
  });
});

describe('WorldMap phone strip', () => {
  /** The strip's layout as a 375 px phone draws it: a 340 px window onto a 600 px map. */
  function phoneStrip() {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(340);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(600);
    return vi.spyOn(Element.prototype, 'scrollTo');
  }
  /** A port's x on the 600 px map. */
  const xOnStrip = (port: PortId) => (project(PORTS[port].lon, PORTS[port].lat)[0] / 1000) * 600;
  /** Where the strip scrolls to centre a port, kept to the strip's scroll range [0, 600 − 340]. */
  const centred = (port: PortId) => Math.max(0, Math.min(xOnStrip(port) - 170, 260));

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  /** A Taipei company with offices in Singapore (mid-map), Rotterdam (left edge) and New York (right edge). */
  function fourOffices() {
    const store = createGameStore(richGame());
    store.update((s) => {
      for (const p of ['SIN', 'RTM', 'NYC'] as PortId[]) openOffice(s, p);
    });
    return store;
  }

  it('compact map scrolls to the viewed office: at once on first mount, smoothly on each switch', () => {
    const scrollTo = phoneStrip();
    const store = fourOffices();
    const offices = store.getState().offices;
    const { container, rerender } = mountLive(store, { compact: true, viewedOfficeId: offices[0].id });
    const strip = container.querySelector<HTMLElement>('.map-strip')!;
    expect(strip).toContainElement(container.querySelector('svg.world-map'));
    // Taipei is mid-map, so it sits right in the middle; the first draw doesn't animate.
    expect(strip.scrollLeft).toBeCloseTo(xOnStrip('TPE') - 170);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: strip.scrollLeft, behavior: 'instant' });

    for (const office of offices.slice(1)) {
      const port = office.portId as PortId;
      rerender(
        <I18nProvider lang="en">
          <LiveMap store={store} compact viewedOfficeId={office.id} />
        </I18nProvider>,
      );
      expect(scrollTo, port).toHaveBeenLastCalledWith({ left: centred(port), behavior: 'smooth' });
      expect(strip.scrollLeft, port).toBeCloseTo(centred(port));
      // As close to the middle as the map allows, and the whole pin in view.
      expect(xOnStrip(port) - 16, port).toBeGreaterThanOrEqual(strip.scrollLeft);
      expect(xOnStrip(port) + 16, port).toBeLessThanOrEqual(strip.scrollLeft + 340);
    }
    // Singapore is centred; Rotterdam pins the strip to its left end and New York to its right end.
    expect(centred('SIN')).toBeCloseTo(xOnStrip('SIN') - 170);
    expect(centred('RTM')).toBe(0);
    expect(centred('NYC')).toBe(260);
  });

  it('switching office under reduced motion jumps instead of gliding', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q === '(prefers-reduced-motion: reduce)',
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const scrollTo = phoneStrip();
    const store = fourOffices();
    const offices = store.getState().offices;
    const { rerender } = mountLive(store, { compact: true, viewedOfficeId: offices[0].id });
    rerender(
      <I18nProvider lang="en">
        <LiveMap store={store} compact viewedOfficeId={offices[3].id} />
      </I18nProvider>,
    );
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 260, behavior: 'instant' });
  });

  it('laptop map has no strip', () => {
    const scrollTo = phoneStrip();
    const { container } = mountLive(createGameStore(richGame()));
    expect(container.querySelector('.map-strip')).not.toBeInTheDocument();
    expect(container.querySelector('svg.world-map')?.parentElement).toHaveClass('map-card');
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('every hit circle is at least 32 px across at the size the map is drawn', () => {
    // A 546 px wide map (160% of a 341 px card): 56 map units would be only 30.6 px there.
    const drawn = { left: 0, top: 0, right: 546, bottom: 196.56, width: 546, height: 196.56, x: 0, y: 0, toJSON: () => ({}) };
    vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue(drawn as DOMRect);
    const { container } = mountLive(createGameStore(richGame()), { compact: true });
    const hits = container.querySelectorAll('.pin-hit');
    expect(hits).toHaveLength(Object.keys(PORTS).length);
    for (const hit of hits) {
      expect(Number(hit.getAttribute('r')) * 2 * (546 / 1000), hit.getAttribute('data-hit')!).toBeGreaterThanOrEqual(32);
    }
  });
});
