import { render, screen, within } from '@testing-library/react';
import { t, type Lang } from '../../i18n';
import { I18nProvider } from '../../i18n/I18nProvider';
import { createGame } from '../../rules/newGame';
import type { GameState, Shipment, ShipmentStatus } from '../../rules/types';
import { PORTS, route } from '../../rules/world';
import { pointAlong, projectPath } from './projection';
import { WorldMap } from './WorldMap';

function shipment(id: string, status: ShipmentStatus, fromPortId: string, toPortId: string): Shipment {
  const atSea = status === 'atSea';
  return {
    id,
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
      <WorldMap state={state} fraction={() => fraction} compact={compact} />
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
