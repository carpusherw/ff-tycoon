import { fireEvent, render, screen, within } from '@testing-library/react';
import { createGameStore, type GameStore } from '../app/store';
import { I18nProvider } from '../i18n/I18nProvider';
import { createGame } from '../rules/newGame';
import { startHiring } from '../rules/staff';
import type { DeptKey } from '../rules/types';
import { HiringDialog } from './HiringDialog';

function storeHiring(dept: DeptKey, cash?: number): GameStore {
  const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
  startHiring(s, 'o1', dept);
  if (cash !== undefined) s.cash = cash;
  return createGameStore(s);
}

function mount(store: GameStore) {
  return render(
    <I18nProvider lang="en">
      <HiringDialog store={store} />
    </I18nProvider>,
  );
}

describe('HiringDialog', () => {
  it('re-roll disabled with a reason when cash is short', () => {
    mount(storeHiring('sales', 100));
    const dialog = screen.getByRole('dialog', { name: 'Hiring · Sales' });
    expect(within(dialog).getByRole('button', { name: /Re-roll · \$400/ })).toBeDisabled();
    expect(within(dialog).getByText("You can't afford that.")).toBeInTheDocument();
  });

  it('re-roll replaces the candidates and charges the cost', () => {
    const store = storeHiring('sales');
    const before = store.getState();
    mount(store);
    fireEvent.click(screen.getByRole('button', { name: /Re-roll/ }));

    const after = store.getState();
    expect(after.cash).toBe(before.cash - 400);
    expect(after.hiring?.candidates.map((c) => c.candidateId)).not.toEqual(
      before.hiring?.candidates.map((c) => c.candidateId),
    );
  });

  it('hire adds the employee and closes', () => {
    const store = storeHiring('ops');
    const first = store.getState().hiring!.candidates[0];
    mount(store);
    expect(screen.getAllByRole('button', { name: 'Hire' })).toHaveLength(3);

    fireEvent.click(screen.getAllByRole('button', { name: 'Hire' })[0]);
    const s = store.getState();
    expect(s.employees).toHaveLength(2);
    expect(s.employees[1]).toMatchObject({ name: first.name, dept: 'ops', salary: first.salary });
    expect(s.hiring).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sales candidates show win rate, ops candidates don\'t', () => {
    const sales = mount(storeHiring('sales'));
    expect(screen.getAllByText('Win rate')).toHaveLength(3);
    expect(screen.getAllByText('Speed')).toHaveLength(3);
    sales.unmount();

    mount(storeHiring('ops'));
    expect(screen.queryByText('Win rate')).not.toBeInTheDocument();
    expect(screen.getAllByText('Capacity')).toHaveLength(3);
  });

  it('shows each salary and a cash-flow preview for the candidate in focus', () => {
    const store = storeHiring('sales');
    const [a, b] = store.getState().hiring!.candidates;
    mount(store);
    const money = (n: number) => `$${n.toLocaleString('en-US')}`;
    expect(screen.getByText(`Hiring ${a.name}: −${money(a.salary)} / mo`)).toBeInTheDocument();

    fireEvent.focus(screen.getAllByRole('button', { name: 'Hire' })[1]);
    expect(screen.getByText(`Hiring ${b.name}: −${money(b.salary)} / mo`)).toBeInTheDocument();
    expect(screen.getAllByText(`${money(b.salary)} / mo`).length).toBeGreaterThanOrEqual(1);
  });

  it('Close ends the session without a refund', () => {
    const store = storeHiring('accounting');
    const cash = store.getState().cash;
    mount(store);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(store.getState().hiring).toBeNull();
    expect(store.getState().cash).toBe(cash);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
