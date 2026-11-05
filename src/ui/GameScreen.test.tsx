import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { Settings } from '../app/persistence';
import { createGameStore, type GameStore } from '../app/store';
import { I18nProvider } from '../i18n/I18nProvider';
import { B } from '../rules/balance';
import { createGame } from '../rules/newGame';
import { startHiring } from '../rules/staff';
import type { YearReport } from '../rules/types';
import { GameScreen } from './GameScreen';

const NARROW = '(max-width: 768px)';
const baseSettings: Settings = { lang: 'en', theme: 'system', autoPause: true };

function gameOnDay(day: number) {
  const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
  s.day = day;
  return s;
}

function mount(store: GameStore, settings: Settings = baseSettings) {
  const onSettingsChange = vi.fn();
  const onNewGame = vi.fn();
  const view = render(
    <I18nProvider lang={settings.lang}>
      <GameScreen store={store} settings={settings} onSettingsChange={onSettingsChange} onNewGame={onNewGame} />
    </I18nProvider>,
  );
  return { ...view, onSettingsChange, onNewGame };
}

function stubWidth(narrow: boolean) {
  vi.stubGlobal('innerWidth', narrow ? 375 : 1280);
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: narrow && q === NARROW,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

/** A narrow/wide matchMedia stand-in whose answer the test can flip, firing `change` listeners. */
function resizableWidth(narrow: boolean) {
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (q: string) => ({
    get matches() {
      return narrow && q === NARROW;
    },
    media: q,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }));
  return {
    set(next: boolean) {
      narrow = next;
      act(() => listeners.forEach((fn) => fn()));
    },
  };
}

const REPORT: YearReport = {
  year: 1,
  revenue: 52000,
  salaries: 18000,
  rent: 12000,
  fees: 1500,
  hiring: 1200,
  profit: 19300,
  cashStart: 20000,
  cashEnd: 39300,
  quotesWon: 30,
  quotesLost: 10,
  shipmentsDelivered: 25,
  staffEnd: 4,
};

/** A game stopped on the last day of year 1, with that year's report recorded. */
function pausedAtYearEnd(report: YearReport) {
  const s = gameOnDay(360);
  s.pauseReasons = ['yearEnd'];
  s.yearReports = [report];
  return s;
}

const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

describe('GameScreen', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('narrow layout shows tabs', () => {
    stubWidth(true);
    mount(createGameStore(gameOnDay(1)));

    const tabs = within(screen.getByRole('tablist', { name: 'Sections' })).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Departments', 'Hiring', 'Money', 'Log']);
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Sales' })).toBeInTheDocument();

    fireEvent.click(tabs[1]);
    expect(screen.queryByRole('region', { name: 'Sales' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hire' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Where you work' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Money this month' })).not.toBeInTheDocument();
  });

  it('wide layout shows every section and no tabs', () => {
    stubWidth(false);
    mount(createGameStore(gameOnDay(1)));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    for (const name of ['Hire', 'Money this month', 'What happened']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    // Settings live behind the top bar's gear now, and the owner moves from the department columns.
    for (const name of ['Where you work', 'Settings']) {
      expect(screen.queryByRole('heading', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByLabelText('Language')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Operations' })).toBeInTheDocument();
  });

  it('the laptop screen has a fixed height: task lists and the log scroll inside their cards', () => {
    stubWidth(false);
    const s = gameOnDay(1);
    s.log = [{ day: 1, tone: 'good', msg: { key: 'log.hired', params: { name: 'Mei' } } }];
    const { container } = mount(createGameStore(s));
    expect(container.querySelector('.game')).toHaveClass('is-fixed-height');

    for (const dept of ['Sales', 'Operations', 'Accounting']) {
      const column = screen.getByRole('region', { name: dept });
      const tasks = within(column).getByRole('region', { name: `${dept} tasks` });
      // Focusable, so the keyboard can scroll it; the header with Work here stays outside it.
      expect(tasks).toHaveClass('scroll');
      expect(tasks).toHaveAttribute('tabindex', '0');
      expect(within(tasks).queryByText('Work here')).not.toBeInTheDocument();
    }
    const log = screen.getByRole('list', { name: 'What happened' });
    expect(log).toHaveClass('scroll');
    expect(log).toHaveAttribute('tabindex', '0');
    for (const name of ['Hire', 'Money this month']) {
      expect(screen.getByRole('heading', { name }).closest('.scroll')).toBeNull();
    }
  });

  it('on the phone the board keeps its tabs and header fixed; only one area scrolls per tab', () => {
    stubWidth(true);
    const s = gameOnDay(1);
    s.log = [{ day: 1, tone: 'good', msg: { key: 'log.hired', params: { name: 'Mei' } } }];
    const { container } = mount(createGameStore(s));
    const root = container.querySelector('.game');
    expect(root).toHaveClass('is-fixed-height');
    expect(root).toHaveClass('is-narrow');

    // Departments: the selected department's task list is the scroll area, not the panel.
    const board = container.querySelector('.tab-panel')!;
    expect(board).not.toHaveClass('scroll');
    expect(screen.getByRole('tablist', { name: 'Departments' }).closest('.scroll')).toBeNull();
    const tasks = screen.getByRole('region', { name: 'Sales tasks' });
    expect(tasks).toHaveClass('scroll');
    expect(board.querySelectorAll('.scroll')).toHaveLength(1);

    // Other tabs: the panel scrolls, with no scroll box inside it.
    fireEvent.click(screen.getByRole('tab', { name: 'Log' }));
    const panel = container.querySelector('.tab-panel')!;
    expect(panel).toHaveClass('scroll');
    expect(panel).toHaveAttribute('tabindex', '0');
    expect(panel.querySelectorAll('.scroll')).toHaveLength(0);
  });

  it('on the phone the departments sit behind three tabs, opening on the owner\'s', () => {
    stubWidth(true);
    const s = gameOnDay(1);
    s.employees[0].dept = 'accounting';
    mount(createGameStore(s));
    const deptTabs = within(screen.getByRole('tablist', { name: 'Departments' })).getAllByRole('tab');
    expect(deptTabs.map((tab) => tab.textContent?.replace(/\d+ tasks.*$/, ''))).toEqual(['Sales', 'Operations', 'Accounting']);
    expect(deptTabs[2]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Accounting' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Sales' })).not.toBeInTheDocument();
    fireEvent.click(deptTabs[1]);
    expect(screen.getByRole('region', { name: 'Operations' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Accounting' })).not.toBeInTheDocument();
  });

  it('an ended run freezes the board: inert, no year report or hiring dialog, no hotkeys', () => {
    const s = pausedAtYearEnd(REPORT);
    startHiring(s, s.offices[0].id, 'sales');
    s.ended = { reason: 'completed', day: 360 };
    s.pauseReasons.push('runEnded');
    const store = createGameStore(s);
    mount(store);

    expect(document.querySelector('.game-body')).toHaveAttribute('inert');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: '?', code: 'Slash', shiftKey: true });
    fireEvent.keyDown(document.body, { key: ' ', code: 'Space' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(store.getState().pauseReasons).toContain('runEnded');
  });

  it('a run reaching a year end opens the year report, and Continue restarts the clock', () => {
    vi.useFakeTimers();
    const store = createGameStore(gameOnDay(359));
    mount(store);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(B.dayMs * 3);
    });
    expect(store.getState().day).toBe(360);
    expect(screen.getByRole('dialog', { name: 'Year 1 report' })).toBeInTheDocument();
    // The modal replaces the year-end banner line.
    expect(screen.queryByText('The year is over. Check your numbers, then play on.')).not.toBeInTheDocument();
    expect(pressed('Pause')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(pressed('1×')).toBe('true');
    act(() => {
      vi.advanceTimersByTime(B.dayMs * 3);
    });
    expect(store.getState().day).toBeGreaterThan(360);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each<[Settings['lang'], string]>([
    ['en', "Couldn't save your progress — storage is full or blocked."],
    ['zh-Hant', '無法儲存進度：瀏覽器的儲存空間已滿或遭到封鎖。'],
    ['zh-Hans', '无法保存进度：浏览器的存储空间已满或被阻止。'],
  ])('warns (%s) when saving fails, keeps playing, and clears the warning once a save works', (lang, text) => {
    vi.useFakeTimers();
    const store = createGameStore(gameOnDay(29));
    // The app owns the save status; this stands in for it.
    function WithSaveStatus() {
      const [saveFailed, setSaveFailed] = useState(false);
      return (
        <GameScreen
          store={store}
          settings={{ ...baseSettings, lang }}
          onSettingsChange={() => {}}
          onNewGame={() => {}}
          saveFailed={saveFailed}
          onSaved={(ok) => setSaveFailed(!ok)}
        />
      );
    }
    render(
      <I18nProvider lang={lang}>
        <WithSaveStatus />
      </I18nProvider>,
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    act(() => {
      vi.advanceTimersByTime(B.dayMs + B.clock.tickMs);
    });
    expect(store.getState().day).toBe(30);
    expect(screen.getByRole('alert')).toHaveTextContent(text);
    act(() => {
      vi.advanceTimersByTime(B.dayMs);
    });
    expect(store.getState().day).toBe(31);

    vi.restoreAllMocks();
    // Pausing saves, and this time it works.
    fireEvent.keyDown(document.body, { key: ' ', code: 'Space' });
    expect(store.getState().day).toBe(31);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('opening the hiring dialog pauses the clock and closing it restores the speed', () => {
    const store = createGameStore(gameOnDay(1));
    mount(store);
    fireEvent.click(screen.getByRole('button', { name: '3×' }));

    fireEvent.click(screen.getByRole('button', { name: /^Sales · \$800/ }));
    expect(screen.getByRole('dialog', { name: 'Hiring · Sales' })).toBeInTheDocument();
    expect(store.getState().cash).toBe(B.startCash - B.hiring.jobAdCost);
    expect(pressed('Pause')).toBe('true');
    // A second job ad would charge again, so the buttons are off while a session is open.
    expect(screen.getByRole('button', { name: /^Operations · \$800/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pressed('3×')).toBe('true');
  });

  it('1×, 3× and 5× do nothing during a year-end pause; Continue is the way out', () => {
    vi.useFakeTimers();
    const store = createGameStore(gameOnDay(359));
    mount(store);
    act(() => {
      vi.advanceTimersByTime(B.dayMs * 3);
    });
    expect(store.getState().day).toBe(360);

    for (const name of ['1×', '3×', '5×']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name }));
    }
    act(() => {
      vi.advanceTimersByTime(B.dayMs * 3);
    });
    expect(pressed('Pause')).toBe('true');
    expect(store.getState().day).toBe(360);

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('button', { name: '3×' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '5×' })).toBeEnabled();
  });

  it('1×, 3× and 5× do nothing while the hiring dialog is open', () => {
    vi.useFakeTimers();
    const store = createGameStore(gameOnDay(1));
    mount(store);
    fireEvent.click(screen.getByRole('button', { name: /^Sales · \$800/ }));
    const day = store.getState().day;

    for (const name of ['1×', '3×', '5×']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name }));
    }
    act(() => {
      vi.advanceTimersByTime(B.dayMs * 3);
    });
    expect(pressed('Pause')).toBe('true');
    expect(store.getState().day).toBe(day);
  });

  it('the hiring dialog is modal: the background is inert and focus moves in and back', () => {
    mount(createGameStore(gameOnDay(1)));
    const opener = screen.getByRole('button', { name: /^Sales · \$800/ });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(dialog.closest('[inert]')).toBeNull();
    for (const name of ['1×', 'Pause', /^Operations · \$800/, 'Settings']) {
      expect(screen.getByRole('button', { name }).closest('[inert]')).not.toBeNull();
    }

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('[inert]')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Sales · \$800/ }));
  });

  it('crossing to the phone layout while hiring still returns focus somewhere sensible on close', () => {
    const width = resizableWidth(false);
    mount(createGameStore(gameOnDay(1)));
    fireEvent.click(screen.getByRole('button', { name: /^Sales · \$800/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    width.set(true); // the laptop opener is gone; the phone layout opens on Departments
    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Hiring' }));
  });

  it('back on the Hiring tab, focus goes to the matching job-ad button', () => {
    const width = resizableWidth(true);
    mount(createGameStore(gameOnDay(1)));
    fireEvent.click(screen.getByRole('tab', { name: 'Hiring' }));
    fireEvent.click(screen.getByRole('button', { name: /^Operations · \$800/ }));

    width.set(false);
    width.set(true); // a fresh phone layout, now showing Departments
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Hiring' }));

    fireEvent.click(screen.getByRole('tab', { name: 'Hiring' }));
    fireEvent.click(screen.getByRole('button', { name: /^Operations · \$800/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Operations · \$800/ }));
  });

  it('a hiring session restored from a save returns focus to its job-ad button on close', () => {
    const s = gameOnDay(1);
    startHiring(s, 'o1', 'accounting');
    mount(createGameStore(s));
    expect(screen.getByRole('dialog', { name: 'Hiring · Accounting' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Accounting · \$800/ }));
  });

  it('a restored session on the phone layout falls back to the Hiring tab', () => {
    resizableWidth(true);
    const s = gameOnDay(1);
    startHiring(s, 'o1', 'sales');
    mount(createGameStore(s));

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Hiring' }));
  });

  it('with auto-pause off the hiring dialog leaves the clock running', () => {
    const store = createGameStore(gameOnDay(1));
    mount(store, { ...baseSettings, autoPause: false });
    fireEvent.click(screen.getByRole('button', { name: /^Sales · \$800/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(pressed('1×')).toBe('true');
  });

  it('a job ad you cannot afford shows the reason', () => {
    const s = gameOnDay(1);
    s.cash = 100;
    const store = createGameStore(s);
    mount(store);
    fireEvent.click(screen.getByRole('button', { name: /^Sales · \$800/ }));
    expect(screen.getByText("You can't afford that.")).toBeInTheDocument();
    expect(store.getState().hiring).toBeNull();
  });

  it('"Work here" in Operations moves the owner there and updates the chips', () => {
    const store = createGameStore(gameOnDay(1));
    mount(store);
    const sales = screen.getByRole('region', { name: 'Sales' });
    const ops = screen.getByRole('region', { name: 'Operations' });
    expect(within(sales).getByRole('button', { name: /^You,/ })).toBeInTheDocument();

    fireEvent.click(within(ops).getByRole('button', { name: 'Work here' }));
    expect(store.getState().employees[0].dept).toBe('ops');
    expect(within(ops).getByRole('button', { name: /^You,/ })).toBeInTheDocument();
    expect(within(sales).queryByRole('button', { name: /^You,/ })).not.toBeInTheDocument();
    expect(within(ops).queryByRole('button', { name: 'Work here' })).not.toBeInTheDocument();
    // Focus follows to the new "You work here" state instead of falling to the page.
    expect(document.activeElement).toBe(within(ops).getByText('You work here').closest('[tabindex]'));
    expect(within(sales).getByRole('button', { name: 'Work here' })).toBeInTheDocument();
  });

  it('on the phone, the Hiring tab has no "Where you work" section; Work here is on the board', () => {
    stubWidth(true);
    const store = createGameStore(gameOnDay(1));
    mount(store);
    fireEvent.click(screen.getByRole('tab', { name: /^Accounting/ }));
    fireEvent.click(within(screen.getByRole('region', { name: 'Accounting' })).getByRole('button', { name: 'Work here' }));
    expect(store.getState().employees[0].dept).toBe('accounting');
    fireEvent.click(screen.getByRole('tab', { name: 'Hiring' }));
    expect(screen.queryByRole('group', { name: 'Where you work' })).not.toBeInTheDocument();
  });

  it('a year-end pause with a report shows the exact numbers in a modal', () => {
    mount(createGameStore(pausedAtYearEnd(REPORT)));
    const dialog = screen.getByRole('dialog', { name: 'Year 1 report' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(dialog.closest('[inert]')).toBeNull();
    expect(screen.getByRole('button', { name: '1×' }).closest('[inert]')).not.toBeNull();

    const value = (label: string) => within(dialog).getByText(label).nextElementSibling;
    expect(value('Invoices paid')).toHaveTextContent('+$52,000');
    expect(value('Salaries')).toHaveTextContent('−$18,000');
    expect(value('Office rent')).toHaveTextContent('−$12,000');
    expect(value('Late fees')).toHaveTextContent('−$1,500');
    expect(value('Hiring (job ads and re-rolls)')).toHaveTextContent('−$1,200');
    expect(value('Profit')).toHaveTextContent('+$19,300');
    expect(value('Profit')!.closest('.money-row')).toHaveClass('is-good');
    expect(value('Cash (start → end)')).toHaveTextContent('$20,000 → $39,300');
    expect(value('Quotes won / lost')).toHaveTextContent('30 / 10');
    expect(value('Win rate')).toHaveTextContent('75%');
    expect(value('Shipments delivered')).toHaveTextContent('25');
    expect(value('Staff at year end')).toHaveTextContent('4');
  });

  it('a losing year shows the profit as a bad number', () => {
    const report = { ...REPORT, revenue: 10000, profit: -22700, cashEnd: -2700, quotesWon: 0, quotesLost: 0 };
    mount(createGameStore(pausedAtYearEnd(report)));
    const dialog = screen.getByRole('dialog', { name: 'Year 1 report' });
    const profit = within(dialog).getByText('Profit').nextElementSibling!;
    expect(profit).toHaveTextContent('−$22,700');
    expect(profit.closest('.money-row')).toHaveClass('is-bad');
    expect(within(dialog).getByText('Win rate').nextElementSibling).toHaveTextContent('—');
  });

  it('a year end reached at 5× continues at 5×, by Continue or by Space', () => {
    vi.useFakeTimers();
    const s = gameOnDay(359);
    s.cash = 1_000_000; // enough to last another year
    const store = createGameStore(s);
    mount(store);
    fireEvent.click(screen.getByRole('button', { name: '5×' }));
    act(() => {
      vi.advanceTimersByTime(B.dayMs);
    });
    expect(store.getState().day).toBe(360);
    expect(pressed('Pause')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(pressed('5×')).toBe('true');

    // The next year end, closed with Space instead.
    act(() => {
      vi.advanceTimersByTime(B.dayMs * 80);
    });
    expect(store.getState().day).toBe(720);
    expect(screen.getByRole('dialog', { name: 'Year 2 report' })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: ' ', code: 'Space' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pressed('5×')).toBe('true');
  });

  it('a year end reached while the help is open hands focus to the report once the help closes', () => {
    vi.useFakeTimers();
    const store = createGameStore(gameOnDay(359));
    mount(store);
    fireEvent.keyDown(document.body, { key: '?', code: 'Slash', shiftKey: true });
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(B.dayMs * 2);
    });
    expect(store.getState().day).toBe(360);
    // The report waits for the help.
    expect(screen.queryByRole('dialog', { name: 'Year 1 report' })).not.toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: 'Escape' });
    const report = screen.getByRole('dialog', { name: 'Year 1 report' });
    expect(report.contains(document.activeElement)).toBe(true);
  });

  it('Continue on a freshly loaded year report resumes at 1×', () => {
    vi.useFakeTimers();
    const store = createGameStore(pausedAtYearEnd(REPORT));
    mount(store);
    expect(pressed('Pause')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(store.getState().pauseReasons).toEqual([]);
    expect(pressed('1×')).toBe('true');
    expect(document.querySelector('[inert]')).toBeNull();
    expect(document.activeElement).not.toBe(document.body);
    act(() => {
      vi.advanceTimersByTime(B.dayMs * 2);
    });
    expect(store.getState().day).toBeGreaterThan(360);
  });

  it('Escape on the year report also resumes', () => {
    const store = createGameStore(pausedAtYearEnd(REPORT));
    mount(store);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(store.getState().pauseReasons).toEqual([]);
    expect(pressed('1×')).toBe('true');
  });

  it('with auto-pause off no year report pops up', () => {
    mount(createGameStore(pausedAtYearEnd(REPORT)), { ...baseSettings, autoPause: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pressed('1×')).toBe('true');
  });

  it('other pause reasons keep the plain banner', () => {
    const s = pausedAtYearEnd(REPORT);
    s.pauseReasons = ['bankrupt'];
    mount(createGameStore(s));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Cash fell below zero. The company is bankrupt.')).toBeInTheDocument();
  });

  it('hiring two from one roll puts both in the department; the dialog closes on Close', () => {
    const store = createGameStore(gameOnDay(1));
    mount(store);
    fireEvent.click(screen.getByRole('button', { name: /^Operations · \$800/ }));
    const [a, b] = store.getState().hiring!.candidates;
    const dialog = screen.getByRole('dialog', { name: 'Hiring · Operations' });

    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Hire' })[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(dialog).getByText(`Hired ${a.name}!`)).toBeInTheDocument();
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Hire' })[0]);
    expect(within(dialog).getByText(`Hired ${b.name}!`)).toBeInTheDocument();
    expect(within(dialog).getAllByRole('button', { name: 'Hire' })).toHaveLength(1);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const ops = screen.getByRole('region', { name: 'Operations' });
    for (const name of [a.name, b.name]) {
      expect(within(ops).getByRole('button', { name: new RegExp(`^${name},`) })).toBeInTheDocument();
    }
  });

  it('the hiring dialog stays open after the last candidate is hired, until Close', () => {
    const store = createGameStore(gameOnDay(1));
    mount(store);
    fireEvent.click(screen.getByRole('button', { name: /^Sales · \$800/ }));
    for (let i = 0; i < B.hiring.candidatesPerRoll; i++) {
      fireEvent.click(screen.getAllByRole('button', { name: 'Hire' })[0]);
    }
    expect(store.getState().employees.filter((e) => e.dept === 'sales')).toHaveLength(1 + B.hiring.candidatesPerRoll);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByText(/^Hired ✓/)).toHaveLength(3);
    expect(within(dialog).getByRole('button', { name: /^Re-roll/ })).toBeEnabled();
    // The hiring hold keeps the clock paused while the dialog is open.
    expect(pressed('Pause')).toBe('true');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pressed('1×')).toBe('true');
  });

  it('5× runs five times as fast as 1×', () => {
    vi.useFakeTimers();
    const store = createGameStore(gameOnDay(1));
    mount(store);
    act(() => {
      vi.advanceTimersByTime(B.dayMs * 4);
    });
    const at1 = store.getState().day - 1;

    fireEvent.click(screen.getByRole('button', { name: '5×' }));
    expect(pressed('5×')).toBe('true');
    const start = store.getState().day;
    act(() => {
      vi.advanceTimersByTime(B.dayMs * 4);
    });
    expect(store.getState().day - start).toBe(5 * at1);
  });

  it('log entries follow the language and format money params', () => {
    const s = gameOnDay(30);
    s.log = [{ day: 30, tone: 'info', msg: { key: 'log.payroll', params: { amount: 2000 } } }];
    const store = createGameStore(s);
    const view = mount(store);
    expect(screen.getByText('Paid $2,000 in salaries and rent.')).toBeInTheDocument();

    view.unmount();
    mount(store, { ...baseSettings, lang: 'zh-Hant' });
    expect(screen.getByText('支付薪資和房租 $2,000。')).toBeInTheDocument();
  });

  it('settings changes are reported', () => {
    const { onSettingsChange } = mount(createGameStore(gameOnDay(1)));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'zh-Hans' } });
    expect(onSettingsChange).toHaveBeenLastCalledWith({ ...baseSettings, lang: 'zh-Hans' });
    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'dark' } });
    expect(onSettingsChange).toHaveBeenLastCalledWith({ ...baseSettings, theme: 'dark' });
    fireEvent.click(screen.getByLabelText('Pause at each year end'));
    expect(onSettingsChange).toHaveBeenLastCalledWith({ ...baseSettings, autoPause: false });
  });

  it('New game asks first', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { onNewGame } = mount(createGameStore(gameOnDay(1)));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'New game' }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(onNewGame).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'New game' }));
    expect(onNewGame).toHaveBeenCalledOnce();
  });

  it('the gear opens a modal settings panel; Escape closes it and focus returns to the gear', () => {
    mount(createGameStore(gameOnDay(1)));
    expect(screen.queryByLabelText('Language')).not.toBeInTheDocument();
    const gear = screen.getByRole('button', { name: 'Settings' });
    gear.focus();
    fireEvent.click(gear);

    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(gear.closest('[inert]')).not.toBeNull();
    expect(within(dialog).getByLabelText('Language')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Theme')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Pause at each year end')).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('[inert]')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Settings' }));
  });

  it('a year end reached while Settings is open hands focus to the report once Settings closes', () => {
    vi.useFakeTimers();
    const store = createGameStore(gameOnDay(359));
    const { container } = mount(store);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    act(() => {
      vi.advanceTimersByTime(B.dayMs * 3);
    });
    expect(store.getState().day).toBe(360);
    // Only one dialog at a time: the report waits for Settings.
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: 'Escape' });
    const report = screen.getByRole('dialog', { name: 'Year 1 report' });
    expect(report.contains(document.activeElement)).toBe(true);
    expect(screen.getByRole('button', { name: 'Settings' }).closest('[inert]')).not.toBeNull();

    fireEvent.click(within(report).getByRole('button', { name: 'Continue' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pressed('1×')).toBe('true');
    const active = document.activeElement as HTMLElement;
    expect(active).not.toBe(document.body);
    expect(container.contains(active)).toBe(true);
    expect(active.closest('[inert]')).toBeNull();
  });

  it('changing the language in the settings panel updates the game', () => {
    const store = createGameStore(gameOnDay(1));
    let settings = baseSettings;
    const view = render(<Harness store={store} initial={baseSettings} onChange={(s) => (settings = s)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'zh-Hant' } });
    expect(settings.lang).toBe('zh-Hant');
    expect(screen.getByRole('dialog', { name: '設定' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '業務' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '關閉' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '設定' }));
    view.unmount();
  });
});

/** A GameScreen whose settings live in state, as the app keeps them. */
function Harness({ store, initial, onChange }: { store: GameStore; initial: Settings; onChange: (s: Settings) => void }) {
  const [settings, setSettings] = useState(initial);
  return (
    <I18nProvider lang={settings.lang}>
      <GameScreen
        store={store}
        settings={settings}
        onSettingsChange={(next) => {
          setSettings(next);
          onChange(next);
        }}
        onNewGame={() => {}}
      />
    </I18nProvider>
  );
}
