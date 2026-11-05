import { fireEvent, render, screen, within } from '@testing-library/react';
import { getStorage, loadGame, saveGame } from '../app/persistence';
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

  it('hire adds the employee and closes only once the last candidate is hired', () => {
    const store = storeHiring('ops');
    const first = store.getState().hiring!.candidates[0];
    mount(store);
    expect(screen.getAllByRole('button', { name: 'Hire' })).toHaveLength(3);

    fireEvent.click(screen.getAllByRole('button', { name: 'Hire' })[0]);
    const s = store.getState();
    expect(s.employees).toHaveLength(2);
    expect(s.employees[1]).toMatchObject({ name: first.name, dept: 'ops', salary: first.salary });
    expect(s.hiring?.candidates).toHaveLength(2);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Hire' })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'Hire' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Hire' })[0]);
    expect(store.getState().employees).toHaveLength(4);
    expect(store.getState().hiring).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('after a hire it confirms the name, keeps focus inside, and Re-roll still works', () => {
    const store = storeHiring('sales');
    const first = store.getState().hiring!.candidates[0];
    mount(store);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(screen.getAllByRole('button', { name: 'Hire' })[0]);
    expect(within(dialog).getByRole('status')).toHaveTextContent(`Hired ${first.name}!`);
    expect(document.activeElement).toBe(screen.getAllByRole('button', { name: 'Hire' })[0]);

    const cash = store.getState().cash;
    fireEvent.click(screen.getByRole('button', { name: /Re-roll/ }));
    expect(store.getState().cash).toBe(cash - 400);
    expect(screen.getAllByRole('button', { name: 'Hire' })).toHaveLength(3);
    expect(within(dialog).getByRole('status')).toHaveTextContent('3 people answered your job ad!');
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

  it('Tab wraps around inside the dialog, and Escape closes it wherever focus is', () => {
    const store = storeHiring('sales');
    mount(store);
    const dialog = screen.getByRole('dialog');
    const close = within(dialog).getByRole('button', { name: 'Close' });
    const reroll = within(dialog).getByRole('button', { name: /Re-roll/ });

    reroll.focus();
    fireEvent.keyDown(reroll, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(reroll);

    // Focus can still end up on the page body (a click on the backdrop); Tab brings it back in.
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(document.body, { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(store.getState().hiring).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a hired candidate leaves a placeholder in its slot, so the others keep their places', () => {
    const store = storeHiring('ops');
    const [a, b, c] = store.getState().hiring!.candidates;
    mount(store);
    const slots = () => within(screen.getByRole('dialog')).getAllByRole('listitem');
    const cardName = (li: HTMLElement) => within(li).queryByRole('heading')?.textContent;

    fireEvent.click(within(slots()[0]).getByRole('button', { name: 'Hire' }));
    expect(slots()).toHaveLength(3);
    expect(slots()[0]).toHaveTextContent(`Hired ✓ ${a.name}`);
    expect(within(slots()[0]).queryByRole('button')).not.toBeInTheDocument();
    expect(slots().map(cardName)).toEqual([undefined, b.name, c.name]);

    // Keys go by slot: 1 is the hired slot now and does nothing; 3 hires the third candidate.
    const hiredSoFar = store.getState().employees.length;
    fireEvent.keyDown(document.body, { key: '1', code: 'Digit1' });
    expect(store.getState().employees).toHaveLength(hiredSoFar);
    fireEvent.keyDown(document.body, { key: '3', code: 'Digit3' });
    expect(store.getState().employees.at(-1)?.name).toBe(c.name);
    expect(slots().map(cardName)).toEqual([undefined, b.name, undefined]);
    expect(slots()[2]).toHaveTextContent(`Hired ✓ ${c.name}`);
    expect(within(slots()[1]).getByRole('button', { name: 'Hire' })).toHaveAttribute('aria-keyshortcuts', '2');
  });

  it('a partly hired session keeps its slots across a save and reload', () => {
    const first = storeHiring('sales');
    const [a, b, c] = first.getState().hiring!.candidates;
    const view = mount(first);
    fireEvent.keyDown(document.body, { key: '2', code: 'Digit2' });
    expect(first.getState().employees.at(-1)?.name).toBe(b.name);
    expect(saveGame(getStorage(), first.getState())).toBe(true);
    view.unmount();

    const loaded = loadGame(getStorage());
    expect(loaded).not.toBeNull();
    const store = createGameStore(loaded!);
    mount(store);
    const slots = () => within(screen.getByRole('dialog')).getAllByRole('listitem');
    const cardName = (li: HTMLElement) => within(li).queryByRole('heading')?.textContent;
    expect(slots().map(cardName)).toEqual([a.name, undefined, c.name]);
    expect(slots()[1]).toHaveTextContent(`Hired ✓ ${b.name}`);

    const staff = store.getState().employees.length;
    fireEvent.keyDown(document.body, { key: '2', code: 'Digit2' });
    expect(store.getState().employees).toHaveLength(staff);
    fireEvent.keyDown(document.body, { key: '3', code: 'Digit3' });
    expect(store.getState().employees.at(-1)?.name).toBe(c.name);
    fireEvent.keyDown(document.body, { key: '1', code: 'Digit1' });
    expect(store.getState().employees.at(-1)?.name).toBe(a.name);
    expect(store.getState().hiring).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    localStorage.clear();
  });

  it('re-roll fills every slot with a fresh roll', () => {
    const store = storeHiring('sales');
    mount(store);
    fireEvent.click(screen.getAllByRole('button', { name: 'Hire' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Re-roll/ }));
    const names = store.getState().hiring!.candidates.map((c) => c.name);
    const slots = within(screen.getByRole('dialog')).getAllByRole('listitem');
    expect(slots.map((li) => within(li).getByRole('heading').textContent)).toEqual(names);
    expect(screen.queryByText(/Hired ✓/)).not.toBeInTheDocument();
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
