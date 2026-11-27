import { act, fireEvent, render, screen, within } from '@testing-library/react';
import css from '../styles.css?raw';
import { createGameStore, useGameState, type GameStore } from '../../app/store';
import { t, type Lang } from '../../i18n';
import { I18nProvider } from '../../i18n/I18nProvider';
import { B } from '../../rules/balance';
import { AGENT_NAMES } from '../../rules/names';
import { addAgent } from '../../rules/network';
import { createGame } from '../../rules/newGame';
import type { GameState } from '../../rules/types';
import { COUNTRIES, PORTS, REGIONS, type PortId } from '../../rules/world';
import { WorldMap, type WorldMapProps } from './WorldMap';

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

function mount(store: GameStore, props: Partial<WorldMapProps> = {}, lang: Lang = 'en') {
  return render(
    <I18nProvider lang={lang}>
      <LiveMap store={store} {...props} />
    </I18nProvider>,
  );
}

function game(cash = 200_000): GameState {
  const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
  s.cash = cash;
  return s;
}

/** A port with no office and no agent; Durban unless the starter agents took it. */
function uncovered(s: GameState): PortId {
  const free = (p: PortId) => !s.offices.some((o) => o.portId === p) && !s.agents.some((a) => a.portId === p);
  return (['DUR', 'GOA', 'VAN', ...(Object.keys(PORTS) as PortId[])] as PortId[]).find(free)!;
}

const rentOf = (port: PortId) => Math.round(B.offices.baseRent * COUNTRIES[REGIONS[PORTS[port].regionId].country].rentMult);
const money = (n: number) => `$${n.toLocaleString('en-US')}`;
const pin = (container: HTMLElement, port: string) => container.querySelector<SVGGElement>(`[role="button"][data-port="${port}"]`)!;
const city = (port: PortId) => t('en', PORTS[port].cityKey);

function openPopup(container: HTMLElement, port: PortId) {
  fireEvent.click(pin(container, port));
  return screen.getByRole('dialog');
}

/** Text shown in the popup, not the hidden sizer that only sets its width. */
const shown = (pop: HTMLElement, text: string) => within(pop).getByText(text, { ignore: '.pop-sizer > *' });

/** Updates the store as the clock or another control would, outside the popup. */
const update = (store: GameStore, fn: (s: GameState) => void) => act(() => store.update(fn));

/** The tooltip text a control is described by. */
const tooltipOf = (el: HTMLElement) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id))
    .find((tip) => tip?.getAttribute('role') === 'tooltip')!;

describe('PinPopup', () => {
  it('an uncovered port offers Sign agent and Open office, each on one line, with the rent below', () => {
    const store = createGameStore(game());
    const port = uncovered(store.getState());
    const { container } = mount(store);
    const pop = openPopup(container, port);
    expect(pop).toHaveAccessibleName(city(port));
    expect(shown(pop, 'Not part of your network yet.')).toBeInTheDocument();

    const sign = within(pop).getByRole('button', { name: 'Sign agent · $5,000' });
    const open = within(pop).getByRole('button', { name: 'Open office · $50,000' });
    expect(sign).toHaveClass('btn', 'btn-agent', 'pop-btn');
    expect(open).toHaveClass('btn', 'pop-btn');
    expect(open).not.toHaveClass('btn-agent');
    // Each label is one line: no break inside, and the button class never wraps.
    expect(css).toMatch(/\.pop-btn\s*\{[^}]*white-space:\s*nowrap/);
    const rent = shown(pop, `+${money(rentOf(port))} / mo rent`);
    // The rent sits on its own line just below the Open office button.
    expect(open.compareDocumentPosition(rent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(open.contains(rent)).toBe(false);
  });

  it('signing adds a named agent pin and the popup shows the agent', () => {
    const store = createGameStore(game());
    const port = uncovered(store.getState());
    const { container } = mount(store);
    const pop = openPopup(container, port);
    fireEvent.click(within(pop).getByRole('button', { name: 'Sign agent · $5,000' }));

    const agent = store.getState().agents.find((a) => a.portId === port)!;
    expect(agent).toBeDefined();
    expect(store.getState().cash).toBe(200_000 - B.agents.signCost);
    const agentPin = screen.getAllByTestId('pin-agent').find((p) => p.getAttribute('data-port') === port)!;
    expect(agentPin.querySelector('.pin-sub')).toHaveTextContent(agent.name);

    const after = screen.getByRole('dialog', { name: city(port) });
    expect(shown(after, `Agent: ${agent.name}`)).toBeInTheDocument();
    expect(shown(after, `Signed ${agent.name} ✓`)).toBeInTheDocument();
    expect(within(after).queryByRole('button', { name: /Sign agent/ })).not.toBeInTheDocument();
    expect(within(after).getByRole('button', { name: 'Open office · $50,000' })).toBeEnabled();
  });

  // jsdom lays nothing out, so this checks what keeps the size stable; the rendered sizes are compared in a browser.
  it.each<[Lang, string, string]>([
    ['en', 'Sign agent · $5,000', 'Signed {name} ✓'],
    ['zh-Hant', '簽約國外代理 · $5,000', '已簽約 {name} ✓'],
  ])(
    'signing keeps the fixed rows and the sizer of widest labels, with "Signed" in the Sign slot (%s)',
    (lang, signLabel, signedLine) => {
      const store = createGameStore(game());
      const port = uncovered(store.getState());
      const { container } = mount(store, {}, lang);
      const pop = openPopup(container, port);
      const rows = (el: HTMLElement) => [...el.querySelectorAll('[data-row]')].map((r) => r.getAttribute('data-row'));
      const sizerItems = (el: HTMLElement) => [...el.querySelectorAll('.pop-sizer > *')].map((s) => s.textContent);
      expect(rows(pop)).toEqual(['action', 'open', 'message']);
      // The message row is there while empty.
      expect(pop.querySelector('[data-row="message"]')).toHaveTextContent('');

      // The hidden sizer holds every label the popup can show in this language, so the widest sets the width.
      const before = sizerItems(pop);
      const sizer = pop.querySelector('.pop-sizer')!;
      expect(sizer).toHaveAttribute('aria-hidden', 'true');
      expect(before).toEqual(
        expect.arrayContaining([
          signLabel,
          t(lang, 'pop.open', { cost: '$50,000' }),
          t(lang, 'pop.rent', { rent: money(rentOf(port)) }),
          t(lang, 'pop.notCovered'),
          t(lang, 'pop.cantAfford', { cash: '−$88,888' }),
          ...AGENT_NAMES.map((name) => signedLine.replace('{name}', name)),
          ...AGENT_NAMES.map((name) => t(lang, 'pop.agentShort', { name })),
        ]),
      );
      // The real rows never widen the box past the sizer: the sub line and the message only fill it.
      expect(pop.querySelector('.pop-sub')).toHaveClass('pop-fill');
      expect(pop.querySelector('[data-row="message"]')).toHaveClass('pop-fill');

      fireEvent.click(within(pop).getByRole('button', { name: signLabel }));
      const after = screen.getByRole('dialog');
      const name = store.getState().agents.find((a) => a.portId === port)!.name;
      // The same rows and the same sizer; the Signed line takes the Sign button's slot, with the button's box class.
      expect(rows(after)).toEqual(['action', 'open', 'message']);
      expect(sizerItems(after)).toEqual(before);
      const slot = after.querySelector('[data-row="action"]')!;
      expect(within(slot as HTMLElement).queryByRole('button')).toBeNull();
      expect(slot.querySelector('.pop-signed')).toHaveTextContent(signedLine.replace('{name}', name));
      expect(slot.querySelector('.pop-signed')).toHaveClass('pop-btn');
      expect(css).toMatch(/\.pop-signed\s*\{[^}]*border:\s*var\(--border\) solid transparent[^}]*padding:\s*var\(--space-2\) var\(--space-4\)/);
    },
  );

  it('on phone the popup is a bottom sheet below the map, and a backdrop tap closes it', () => {
    const s = game();
    expect(s.agents.some((a) => a.portId === 'SYD')).toBe(false);
    addAgent(s, 'SYD');
    const store = createGameStore(s);
    const port = uncovered(store.getState());
    const { container } = mount(store, { compact: true });
    const card = container.querySelector<HTMLElement>('.map-card')!;
    card.getBoundingClientRect = () => ({ left: 0, top: 60, right: 375, bottom: 260, width: 375, height: 200, x: 0, y: 60, toJSON: () => ({}) });
    const pop = openPopup(container, port);
    expect(pop).toHaveClass('is-sheet');
    // Below the map, never over it: the backdrop starts at the map's bottom edge and so does the sheet's room.
    const backdrop = container.querySelector<HTMLElement>('.pop-backdrop')!;
    expect(backdrop.style.top).toBe('260px');
    expect(pop.style.maxHeight).toBe(`${window.innerHeight - 260}px`);
    expect(pop).toHaveFocus();

    // Another pin switches the sheet to that port.
    const agent = store.getState().agents.find((a) => a.portId === 'SYD')!;
    fireEvent.click(pin(container, agent.portId));
    expect(screen.getByRole('dialog')).toHaveTextContent(`Agent: ${agent.name}. Handles your shipments here.`);

    const switched = container.querySelector<HTMLElement>('.pop-backdrop')!;
    fireEvent.pointerDown(switched);
    fireEvent.click(switched);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pin(container, agent.portId)).toHaveFocus();
  });

  it('on a laptop the popup is a small card on the map, not a modal', () => {
    const store = createGameStore(game());
    const { container } = mount(store);
    const pop = openPopup(container, uncovered(store.getState()));
    expect(pop).toHaveClass('is-anchored');
    expect(pop).not.toHaveAttribute('aria-modal');
    expect(container.querySelector('.map-card')!.contains(pop)).toBe(true);
    expect(container.querySelector('.pop-backdrop')).toBeNull();
  });

  it("a button the player can't afford is disabled, and the popup shows the cash on hand", () => {
    const store = createGameStore(game(4_000));
    const port = uncovered(store.getState());
    const { container } = mount(store);
    const pop = openPopup(container, port);
    expect(within(pop).getByRole('button', { name: /Sign agent/ })).toBeDisabled();
    expect(within(pop).getByRole('button', { name: /Open office/ })).toBeDisabled();
    expect(shown(pop, 'Not enough cash: you have $4,000.')).toBeInTheDocument();

    // Exactly the price is enough: signing leaves $0, and the office stays out of reach.
    update(store, (s) => {
      s.cash = B.agents.signCost;
    });
    const sign = within(pop).getByRole('button', { name: /Sign agent/ });
    expect(sign).toBeEnabled();
    expect(shown(pop, 'Not enough cash: you have $5,000.')).toBeInTheDocument();
    fireEvent.click(sign);
    expect(store.getState().cash).toBe(0);
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /Open office/ })).toBeDisabled();
    expect(screen.getByRole('dialog')).toHaveTextContent('Not enough cash: you have $0.');

    update(store, (s) => {
      s.cash = B.offices.openCost;
    });
    const open = within(screen.getByRole('dialog')).getByRole('button', { name: /Open office/ });
    expect(open).toBeEnabled();
    expect(screen.getByRole('dialog').querySelector('[data-row="message"]')).toHaveTextContent('');
    fireEvent.click(open);
    expect(store.getState().cash).toBe(0);
    expect(store.getState().offices.some((o) => o.portId === port)).toBe(true);
  });

  it("each button's tooltip is one short line on what it does, with no company-value text", () => {
    const store = createGameStore(game());
    const port = uncovered(store.getState());
    const { container } = mount(store);
    const pop = openPopup(container, port);
    const sign = tooltipOf(within(pop).getByRole('button', { name: /Sign agent/ }));
    const open = tooltipOf(within(pop).getByRole('button', { name: /Open office/ }));
    expect(sign).toHaveTextContent(
      `Handles your shipments to and from ${city(port)} for 25% of the profit, and sends you its own`,
      { normalizeWhitespace: true },
    );
    expect(open.textContent).toBe('Your own staff win local customers and bill local charges');
    for (const tip of [sign, open]) {
      expect(tip.querySelector('.tooltip-hint')).toBeNull();
      expect(tip.textContent).not.toMatch(/company value|\$/i);
    }
  });

  it('Esc closes the popup and focus returns to the pin', () => {
    const store = createGameStore(game());
    const port = uncovered(store.getState());
    const { container } = mount(store);
    pin(container, port).focus();
    fireEvent.keyDown(pin(container, port), { key: 'Enter' });
    const pop = screen.getByRole('dialog');
    expect(pop).toHaveFocus();
    fireEvent.keyDown(pop, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pin(container, port)).toHaveFocus();
  });

  it('opening an office closes the popup and reports the new office', () => {
    const store = createGameStore(game());
    const port = uncovered(store.getState());
    const onOfficeOpened = vi.fn();
    const { container } = mount(store, { onOfficeOpened });
    const pop = openPopup(container, port);
    fireEvent.click(within(pop).getByRole('button', { name: 'Open office · $50,000' }));
    const office = store.getState().offices.find((o) => o.portId === port)!;
    expect(office).toBeDefined();
    expect(onOfficeOpened).toHaveBeenCalledWith(office.id);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('pin-office').map((p) => p.getAttribute('data-port'))).toContain(port);
  });

  it('the popup follows the language', () => {
    const store = createGameStore(game(4_000));
    const port = uncovered(store.getState());
    const { container } = mount(store, {}, 'zh-Hant');
    const pop = openPopup(container, port);
    expect(pop).toHaveTextContent('尚未納入版圖');
    expect(within(pop).getByRole('button', { name: '簽約國外代理 · $5,000' })).toBeDisabled();
    expect(within(pop).getByRole('button', { name: '開設辦公室 · $50,000' })).toBeDisabled();
    expect(pop).toHaveTextContent('現金不足：你只有 $4,000。');
    // Local charges use the glossary's wording: the English term, then the Chinese in brackets.
    expect(tooltipOf(within(pop).getByRole('button', { name: '開設辦公室 · $50,000' })).textContent).toBe(
      '自己的員工能接當地客戶，並收 Local Charge（本地費用）',
    );
  });
});
