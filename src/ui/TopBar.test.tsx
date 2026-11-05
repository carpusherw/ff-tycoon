import { fireEvent, render, screen } from '@testing-library/react';
import type { Speed } from '../app/clock';
import type { Lang } from '../i18n';
import { I18nProvider } from '../i18n/I18nProvider';
import { createGame } from '../rules/newGame';
import type { GameState } from '../rules/types';
import { TopBar } from './TopBar';

const game = () => createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });

function mount(state: GameState, opts: { lang?: Lang; speed?: Speed; locked?: boolean } = {}) {
  const onSpeed = vi.fn();
  const view = render(
    <I18nProvider lang={opts.lang ?? 'en'}>
      <TopBar state={state} speed={opts.speed ?? 1} onSpeed={onSpeed} locked={opts.locked} />
    </I18nProvider>,
  );
  return { ...view, onSpeed };
}

describe('TopBar', () => {
  it('formats positive and negative cash flow', () => {
    // The owner draws no salary and Taipei's rent is $2,000, so $3,100 of revenue nets +$1,100.
    const s = game();
    s.day = 40;
    s.stats.revenue = [{ day: 30, amount: 3100 }];
    const first = mount(s);
    expect(screen.getByText('+$1,100 / mo')).toHaveClass('is-good');
    first.unmount();

    s.stats.revenue = [{ day: 30, amount: 1500 }];
    mount(s);
    expect(screen.getByText('−$500 / mo')).toHaveClass('is-bad');
  });

  it('year counter', () => {
    const s = game();
    s.day = 361;
    mount(s);
    expect(screen.getByText('Year 2 of 10 · Day 361')).toBeInTheDocument();
  });

  it('day 360 is still year 1, and day 0 shows year 1', () => {
    const s = game();
    s.day = 360;
    const first = mount(s);
    expect(screen.getByText('Year 1 of 10 · Day 360')).toBeInTheDocument();
    first.unmount();

    s.day = 0;
    mount(s);
    expect(screen.getByText('Year 1 of 10 · Day 0')).toBeInTheDocument();
  });

  it('win rate shows a dash before any quote, then a percentage', () => {
    const s = game();
    const first = mount(s);
    expect(screen.getByText('—')).toBeInTheDocument();
    first.unmount();

    s.stats.quotesWon = 3;
    s.stats.quotesLost = 1;
    mount(s);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('shipments per operator count deliveries in the last 30 days', () => {
    const s = game();
    s.day = 100;
    s.stats.deliveredDays = [60, 71, 80, 100];
    s.employees.push({ ...s.employees[0], id: 'e90', name: 'Mei', isOwner: false, dept: 'ops' });
    s.employees.push({ ...s.employees[0], id: 'e91', name: 'Bo', isOwner: false, dept: 'ops' });
    mount(s);
    // Days 71, 80 and 100 fall in the window; 3 ÷ 2 operators = 1.5.
    expect(screen.getByText('1.5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // staff count
  });

  it('speed buttons show which speed is on and report clicks', () => {
    const { onSpeed } = mount(game(), { speed: 3 });
    expect(screen.getByRole('button', { name: 'Pause' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '1×' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '3×' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(onSpeed).toHaveBeenCalledExactlyOnceWith(0);
  });

  it('offers pause / 1× / 3× / 5×, and only Pause while locked', () => {
    const { onSpeed, unmount } = mount(game(), { speed: 5 });
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(names).toEqual(['Pause', '1×', '3×', '5×']);
    expect(screen.getByRole('button', { name: '5×' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '1×' }));
    expect(onSpeed).toHaveBeenCalledWith(1);
    unmount();

    mount(game(), { speed: 0, locked: true });
    expect(screen.getByRole('button', { name: '5×' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();
  });
});
