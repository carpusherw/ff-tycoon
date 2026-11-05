import { fireEvent, render, screen } from '@testing-library/react';
import type { Speed } from '../app/clock';
import type { Lang } from '../i18n';
import { I18nProvider } from '../i18n/I18nProvider';
import { createGame } from '../rules/newGame';
import type { GameState } from '../rules/types';
import { TopBar } from './TopBar';

/** The top bar's date as read: its year and day sit in boxes of their own, so it spans several elements. */
const dateText = () => document.querySelector('.pill-date b')?.textContent;

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

  it('numbers that tick during play use tabular figures, so the pills keep their width', () => {
    const s = game();
    s.day = 40;
    s.stats.quotesWon = 3;
    s.stats.quotesLost = 1;
    mount(s);
    for (const text of ['$60,000', '75%', '0.0', '1']) {
      expect(screen.getByText(text, { selector: '.pill b' })).toHaveClass('num');
    }
    expect(dateText()).toBe('Year 1 of 10 · Day 40');
    expect(document.querySelector('.pill-date b')).toHaveClass('num');
    expect(screen.getByText(/^[+−]\$[\d,]+ \/ mo$/)).toHaveClass('num');
  });

  it('each constantly changing number reserves the width of its widest value, so nothing moves as digits come and go', () => {
    const s = game();
    s.day = 40;
    s.stats.quotesWon = 3;
    s.stats.quotesLost = 1;
    mount(s);
    const pillValue = (text: string) => screen.getByText(text, { selector: '.pill b' });
    expect(pillValue('$60,000')).toHaveClass('num-cash');
    expect(screen.getByText(/^[+−]\$[\d,]+ \/ mo$/)).toHaveClass('num-flow');
    expect(pillValue('75%')).toHaveClass('num-rate');
    // Shipments per operator always has one decimal, so 0.5 → 1.0 keeps four characters.
    expect(pillValue('0.0')).toHaveClass('num-perop');
    // The staff count changes only when someone is hired, so it hugs its digits.
    expect(pillValue('1')).toHaveClass('num');
    expect(pillValue('1')).not.toHaveClass('num-staff');
    // The date keeps its words; the year and the day each sit in a box of their own.
    expect(dateText()).toBe('Year 1 of 10 · Day 40');
    const date = document.querySelector('.pill-date b')!;
    expect(date.querySelector('.num-year')).toHaveTextContent(/^1$/);
    expect(date.querySelector('.num-day')).toHaveTextContent(/^40$/);
    expect(date.querySelector('.steady-sizer')).toBeNull();
  });

  it('year counter', () => {
    const s = game();
    s.day = 361;
    mount(s);
    expect(dateText()).toBe('Year 2 of 10 · Day 361');
  });

  it('day 360 is still year 1, and day 0 shows year 1', () => {
    const s = game();
    s.day = 360;
    const first = mount(s);
    expect(dateText()).toBe('Year 1 of 10 · Day 360');
    first.unmount();

    s.day = 0;
    mount(s);
    expect(dateText()).toBe('Year 1 of 10 · Day 0');
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
    expect(screen.getByText('3', { selector: '.pill b' })).toBeInTheDocument(); // staff count
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
