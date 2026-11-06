import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { Settings } from '../app/persistence';
import { createGameStore, type GameStore } from '../app/store';
import { I18nProvider } from '../i18n/I18nProvider';
import { B } from '../rules/balance';
import { createGame } from '../rules/newGame';
import { startHiring } from '../rules/staff';
import type { DeptKey, GameState, TaskKind, YearReport } from '../rules/types';
import { PORTS, type PortId } from '../rules/world';
import css from './styles.css?raw';
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
  expansion: 0,
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

/** The Hire button in a department's header ("Sales", "Operations" or "Accounting"). */
const hireButton = (dept: string) =>
  within(screen.getByRole('region', { name: dept })).getByRole('button', { name: 'Hire · $800' });

const DEPT_OF: Record<TaskKind, DeptKey> = {
  quote: 'sales', booking: 'ops', arrival: 'ops', invoice: 'accounting', charges: 'accounting',
};

let seq = 0;
/** Adds a sale from `officeId`'s port with one task for it in that office. */
function addTaskAt(s: GameState, officeId: string, kind: TaskKind, deadline = s.day + 5) {
  seq += 1;
  const office = s.offices.find((o) => o.id === officeId)!;
  s.customers.push({ id: `c9${seq}`, name: 'Glimfrondle Crafts', officeId, status: 'prospect' });
  s.shipments.push({
    id: `s9${seq}`, kind: 'sale', customerId: `c9${seq}`, sellingOfficeId: officeId, direction: 'export',
    fromPortId: office.portId, toPortId: 'LAX', origin: { kind: 'office', officeId },
    destination: { kind: 'agent', agentId: s.agents[0].id }, status: 'quoting', margin: 1000, agentShare: 250,
    localCharges: 0, chargesPaid: false, departDay: null, arriveDay: null, agentReadyDay: null, arrived: false,
    paid: false, arrivalDone: false,
  });
  s.tasks.push({
    id: `t9${seq}`, kind, officeId, dept: DEPT_OF[kind], shipmentId: `s9${seq}`, workload: 2, progress: 0,
    minDuration: 1, createdDay: s.day, deadline, assigneeId: null, late: false,
  });
}

/** Adds an office at `portId`, with one Ops employee unless `staffed` is false. */
function addOffice(s: GameState, id: string, portId: PortId, staffed = true) {
  s.offices.push({ id, portId, regionId: PORTS[portId].regionId, rent: 3000 });
  if (staffed) {
    s.employees.push({
      id: `e-${id}`, name: 'Ravi', officeId: id, dept: 'ops', isOwner: false, salary: 2400, hiredDay: 1,
      speed: 0.8, capacity: 2, winRate: 0.3,
    });
  }
}

/**
 * Taipei (the owner in Sales, one booking), Singapore (Ravi in Ops, two bookings, one of them late) and,
 * with `empty`, Houston with nobody in it. Cash for many job ads.
 */
function threeOffices(empty = true) {
  const s = gameOnDay(10);
  s.cash = 1_000_000;
  addOffice(s, 'o90', 'SIN');
  if (empty) addOffice(s, 'o91', 'HOU', false);
  addTaskAt(s, 'o1', 'booking');
  addTaskAt(s, 'o90', 'booking');
  addTaskAt(s, 'o90', 'arrival', 8);
  return s;
}

const switcher = () => screen.getByRole('group', { name: 'Offices' });
const officeButton = (city: string) => within(switcher()).getByRole('button', { name: new RegExp(`^${city}`) });
const opsTasks = () => screen.getByRole('region', { name: 'Operations' }).querySelectorAll('li.task').length;

/** A tap on the dimmed area around a dialog: pressed and released on the backdrop itself. */
function tapBackdrop(dialog: HTMLElement) {
  const backdrop = dialog.parentElement!;
  fireEvent.pointerDown(backdrop);
  fireEvent.click(backdrop);
}

describe('GameScreen', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('the side panel has no Hire card, and the phone tabs are Offices, Money and Log', () => {
    stubWidth(true);
    const { unmount } = mount(createGameStore(threeOffices()));

    const tabs = within(screen.getByRole('tablist', { name: 'Sections' })).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Offices', 'Money', 'Log']);
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    // The Offices tab holds the office switcher, then the department tabs, which are still "Departments".
    const panel = document.getElementById(tabs[0].getAttribute('aria-controls')!)!;
    const deptTabs = screen.getByRole('tablist', { name: 'Departments' });
    expect(panel.contains(switcher())).toBe(true);
    expect(switcher().compareDocumentPosition(deptTabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Sales' })).toBeInTheDocument();
    expect(hireButton('Sales')).toBeInTheDocument();

    fireEvent.click(tabs[1]);
    expect(screen.queryByRole('region', { name: 'Sales' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Offices' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Money this month' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Hire' })).not.toBeInTheDocument();
    unmount();

    stubWidth(false);
    mount(createGameStore(threeOffices()));
    const side = document.querySelector('aside.side')!;
    expect([...side.querySelectorAll('h2')].map((h) => h.textContent)).toEqual(['Money this month', 'What happened']);
    expect(side.querySelector('[data-hire-dept]')).toBeNull();
  });

  it.each([
    ['zh-Hant', ['辦公室', '財務', '紀錄'], '部門'],
    ['zh-Hans', ['办公室', '财务', '记录'], '部门'],
  ] as const)('the phone tabs are translated (%s)', (lang, names, depts) => {
    stubWidth(true);
    mount(createGameStore(gameOnDay(1)), { ...baseSettings, lang });
    expect(screen.getAllByRole('tab').slice(0, 3).map((t) => t.textContent)).toEqual(names);
    expect(screen.getByRole('tablist', { name: depts })).toBeInTheDocument();
  });

  it('wide layout shows every section and no tabs', () => {
    stubWidth(false);
    mount(createGameStore(gameOnDay(1)));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    for (const name of ['Money this month', 'What happened']) {
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
    expect(screen.getByRole('heading', { name: 'Money this month' }).closest('.scroll')).toBeNull();
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
    expect(deptTabs.map((tab) => tab.querySelector('.dept-tab-name')?.textContent)).toEqual(['Sales', 'Operations', 'Accounting']);
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

    fireEvent.click(hireButton('Sales'));
    expect(screen.getByRole('dialog', { name: 'Hiring · Sales' })).toBeInTheDocument();
    expect(store.getState().cash).toBe(B.startCash - B.hiring.jobAdCost);
    expect(pressed('Pause')).toBe('true');
    // A second job ad would charge again, so the buttons are off while a session is open.
    expect(hireButton('Operations')).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pressed('3×')).toBe('true');
  });

  it.each([
    ['settings', true],
    ['settings', false],
    ['keyboard shortcuts', true],
    ['keyboard shortcuts', false],
  ] as const)('the %s dialog holds the clock (auto-pause %s) and closing it restores the speed', (which, autoPause) => {
    vi.useFakeTimers();
    const store = createGameStore(gameOnDay(1));
    mount(store, { ...baseSettings, autoPause });
    fireEvent.click(screen.getByRole('button', { name: '3×' }));
    if (which === 'settings') fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    else fireEvent.keyDown(document.body, { key: '?' });
    const name = which === 'settings' ? 'Settings' : 'Keyboard shortcuts';
    expect(screen.getByRole('dialog', { name })).toBeInTheDocument();
    expect(pressed('Pause')).toBe('true');
    const day = store.getState().day;
    act(() => {
      vi.advanceTimersByTime(B.dayMs * 3);
    });
    expect(store.getState().day).toBe(day);

    fireEvent.keyDown(screen.getByRole('dialog', { name }), { key: 'Escape' });
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
    fireEvent.click(hireButton('Sales'));
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
    const opener = hireButton('Sales');
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(dialog.closest('[inert]')).toBeNull();
    for (const name of ['1×', 'Pause', 'Settings']) {
      expect(screen.getByRole('button', { name }).closest('[inert]')).not.toBeNull();
    }
    expect(hireButton('Operations').closest('[inert]')).not.toBeNull();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('[inert]')).toBeNull();
    expect(document.activeElement).toBe(hireButton('Sales'));
  });

  it('crossing to the phone layout while hiring still returns focus somewhere sensible on close', () => {
    const width = resizableWidth(false);
    mount(createGameStore(gameOnDay(1)));
    fireEvent.click(hireButton('Sales'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    width.set(true); // the laptop opener is gone; the phone layout opens on the owner's department, Sales
    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.activeElement).toBe(hireButton('Sales'));
  });

  it("on the phone, focus returns to the Hire button that opened the session, across a layout change", () => {
    const width = resizableWidth(true);
    mount(createGameStore(gameOnDay(1)));
    fireEvent.click(screen.getByRole('tab', { name: /^Operations/ }));
    fireEvent.click(hireButton('Operations'));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.activeElement).toBe(hireButton('Operations'));

    fireEvent.click(hireButton('Operations'));
    width.set(false);
    width.set(true); // a fresh phone layout
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.activeElement).toBe(hireButton('Operations'));
  });

  it("on the phone, H from the Money tab or another department brings the owner's department back with focus on its Hire button", () => {
    stubWidth(true);
    const store = createGameStore(gameOnDay(1));
    mount(store);
    fireEvent.click(screen.getByRole('tab', { name: /^Accounting/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Money' }));
    fireEvent.keyDown(document.body, { key: 'h', code: 'KeyH' });
    expect(store.getState().hiring).toMatchObject({ officeId: 'o1', dept: 'sales' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('tab', { name: 'Offices' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /^Sales/ })).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(hireButton('Sales'));
  });

  it("H while another office is on screen returns focus to the owner's office and department", () => {
    stubWidth(true);
    const store = createGameStore(threeOffices());
    mount(store);
    fireEvent.click(officeButton('Singapore'));
    fireEvent.click(screen.getByRole('tab', { name: /^Operations/ }));
    fireEvent.keyDown(document.body, { key: 'h', code: 'KeyH' });
    expect(store.getState().hiring).toMatchObject({ officeId: 'o1', dept: 'sales' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(officeButton('Taipei')).toHaveAttribute('aria-pressed', 'true');
    expect(document.activeElement).toBe(hireButton('Sales'));
  });

  it('a hiring session restored from a save returns focus to its job-ad button on close', () => {
    const s = gameOnDay(1);
    startHiring(s, 'o1', 'accounting');
    mount(createGameStore(s));
    expect(screen.getByRole('dialog', { name: 'Hiring · Accounting' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.activeElement).toBe(hireButton('Accounting'));
  });

  it("a restored session on the phone layout, for another office and department, shows them and focuses its Hire button", () => {
    resizableWidth(true);
    const s = threeOffices();
    startHiring(s, 'o90', 'accounting');
    mount(createGameStore(s));
    expect(screen.getByRole('tab', { name: /^Sales/ })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(officeButton('Singapore')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('tab', { name: /^Accounting/ })).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(hireButton('Accounting'));
  });

  it('with auto-pause off the hiring dialog leaves the clock running', () => {
    const store = createGameStore(gameOnDay(1));
    mount(store, { ...baseSettings, autoPause: false });
    fireEvent.click(hireButton('Sales'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(pressed('1×')).toBe('true');
  });

  it('a job ad you cannot afford shows the reason', () => {
    const s = gameOnDay(1);
    s.cash = 100;
    const store = createGameStore(s);
    mount(store);
    fireEvent.click(hireButton('Sales'));
    expect(within(screen.getByRole('region', { name: 'Sales' })).getByRole('alert')).toHaveTextContent("You can't afford that.");
    expect(store.getState().hiring).toBeNull();
  });

  it('on the phone, a refused H for a department not on screen brings that department up with the reason', () => {
    stubWidth(true);
    const s = gameOnDay(1);
    s.cash = 100;
    mount(createGameStore(s));
    fireEvent.click(screen.getByRole('tab', { name: /^Operations/ }));
    fireEvent.keyDown(document.body, { key: 'h', code: 'KeyH' }); // the owner works in Sales
    expect(screen.getByRole('tab', { name: /^Sales/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(screen.getByRole('region', { name: 'Sales' })).getByRole('alert')).toHaveTextContent("You can't afford that.");

    // From the Money tab too.
    fireEvent.click(screen.getByRole('tab', { name: 'Money' }));
    fireEvent.keyDown(document.body, { key: 'A', code: 'KeyA', shiftKey: true });
    expect(screen.getByRole('tab', { name: 'Offices' })).toHaveAttribute('aria-selected', 'true');
    expect(within(screen.getByRole('region', { name: 'Accounting' })).getByRole('alert')).toHaveTextContent("You can't afford that.");
  });

  it("a refused job ad stays with its office: H for the owner's office shows it there, and it doesn't follow to another office", () => {
    stubWidth(false);
    const s = threeOffices();
    s.cash = 100;
    mount(createGameStore(s));
    fireEvent.click(officeButton('Singapore'));
    fireEvent.keyDown(document.body, { key: 'h', code: 'KeyH' }); // the owner works in Taipei Sales
    expect(officeButton('Taipei')).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByRole('region', { name: 'Sales' })).getByRole('alert')).toHaveTextContent("You can't afford that.");

    fireEvent.click(officeButton('Singapore'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(hireButton('Operations'));
    expect(within(screen.getByRole('region', { name: 'Operations' })).getByRole('alert')).toBeInTheDocument();
    fireEvent.click(officeButton('Taipei'));
    expect(within(screen.getByRole('region', { name: 'Operations' })).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('on the phone, a double-tap on the Operations tab moves the owner there', () => {
    stubWidth(true);
    const store = createGameStore(gameOnDay(1));
    mount(store);
    const opsTab = within(screen.getByRole('tablist', { name: 'Departments' })).getByRole('tab', { name: /^Operations/ });
    fireEvent.click(opsTab, { detail: 1 });
    expect(store.getState().employees[0].dept).toBe('sales');
    fireEvent.click(opsTab, { detail: 1 });
    expect(store.getState().employees[0].dept).toBe('ops');
    expect(within(screen.getByRole('region', { name: 'Operations' })).getByText('You work here')).toBeInTheDocument();
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

  it("switching office shows that office's tasks and staff only", () => {
    stubWidth(false);
    mount(createGameStore(threeOffices()));
    // The owner's office is on screen at first, with a star where the owner works.
    expect(officeButton('Taipei')).toHaveAttribute('aria-pressed', 'true');
    expect(officeButton('Singapore')).toHaveAttribute('aria-pressed', 'false');
    expect(officeButton('Taipei').querySelector('.star')).not.toBeNull();
    expect(officeButton('Singapore').querySelector('.star')).toBeNull();
    expect(opsTasks()).toBe(1);
    expect(within(screen.getByRole('region', { name: 'Sales' })).getByText('You work here')).toBeInTheDocument();

    fireEvent.click(officeButton('Singapore'));
    expect(officeButton('Singapore')).toHaveAttribute('aria-pressed', 'true');
    expect(officeButton('Taipei')).toHaveAttribute('aria-pressed', 'false');
    expect(opsTasks()).toBe(2);
    const ops = screen.getByRole('region', { name: 'Operations' });
    expect(within(ops).getByRole('button', { name: /^Ravi/ })).toBeInTheDocument();
    const sales = screen.getByRole('region', { name: 'Sales' });
    expect(within(sales).queryByRole('button', { name: /^You,/ })).not.toBeInTheDocument();
    expect(within(sales).getByRole('button', { name: 'Work here' })).toBeInTheDocument();

    // A new office with nobody in it: empty columns, each with Work here.
    fireEvent.click(officeButton('Houston'));
    expect(opsTasks()).toBe(0);
    for (const name of ['Sales', 'Operations', 'Accounting']) {
      const column = screen.getByRole('region', { name });
      expect(within(column).getByText('Nobody works here yet. Hire someone, or move yourself here.')).toBeInTheDocument();
      expect(within(column).getByRole('button', { name: 'Work here' })).toBeInTheDocument();
    }
  });

  it('the switcher flags late tasks and offices with no staff', () => {
    stubWidth(false);
    const s = threeOffices();
    s.day = 7; // nothing late yet
    const store = createGameStore(s);
    mount(store);
    expect(officeButton('Singapore').querySelector('.badge-late')).toBeNull();
    expect(within(officeButton('Houston')).getByText('No staff yet')).toHaveClass('badge-warn');
    expect(officeButton('Taipei').querySelector('.badge-warn')).toBeNull();

    act(() => store.update((d) => void (d.day = 16)));
    expect(within(officeButton('Singapore')).getByText('2 late')).toHaveClass('badge-late');
    expect(within(officeButton('Taipei')).getByText('1 late')).toHaveClass('badge-late');
  });

  it('Work here in the second office moves the owner there', () => {
    stubWidth(false);
    const store = createGameStore(threeOffices());
    mount(store);
    fireEvent.click(officeButton('Singapore'));
    fireEvent.click(within(screen.getByRole('region', { name: 'Operations' })).getByRole('button', { name: 'Work here' }));

    const owner = store.getState().employees.find((e) => e.isOwner)!;
    expect(owner.officeId).toBe('o90');
    expect(owner.dept).toBe('ops');
    expect(officeButton('Singapore')).toHaveAttribute('aria-pressed', 'true');
    expect(officeButton('Singapore').querySelector('.star')).not.toBeNull();
    expect(officeButton('Taipei').querySelector('.star')).toBeNull();
    // The owner was Taipei's only staff, so it's flagged now.
    expect(within(officeButton('Taipei')).getByText('No staff yet')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Operations' })).getByText('You work here')).toBeInTheDocument();

    // S moves the owner within the office on screen.
    fireEvent.keyDown(document.body, { key: 's', code: 'KeyS' });
    expect(store.getState().employees.find((e) => e.isOwner)).toMatchObject({ officeId: 'o90', dept: 'sales' });
  });

  it('on the phone, a double-tap on a department of the office on screen moves the owner there', () => {
    stubWidth(true);
    const store = createGameStore(threeOffices());
    mount(store);
    fireEvent.click(officeButton('Singapore'));
    const opsTab = within(screen.getByRole('tablist', { name: 'Departments' })).getByRole('tab', { name: /^Operations/ });
    // Singapore's tab counts its own staff: Ravi.
    expect(opsTab.querySelector('.dept-tab-staff .num')).toHaveTextContent('1');
    fireEvent.click(opsTab, { detail: 1 });
    fireEvent.click(opsTab, { detail: 1 });
    expect(store.getState().employees.find((e) => e.isOwner)).toMatchObject({ officeId: 'o90', dept: 'ops' });
    expect(opsTab.querySelector('.dept-tab-staff .num')).toHaveTextContent('2');
  });

  it("the department's Hire button posts a job ad for the office on screen", () => {
    stubWidth(false);
    const store = createGameStore(threeOffices());
    mount(store);
    fireEvent.click(officeButton('Singapore'));
    fireEvent.click(hireButton('Accounting'));
    expect(store.getState().hiring).toMatchObject({ officeId: 'o90', dept: 'accounting' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.activeElement).toBe(hireButton('Accounting'));

    // Shift+S posts for the office on screen; H for the owner's own office and department.
    fireEvent.keyDown(document.body, { key: 'S', code: 'KeyS', shiftKey: true });
    expect(store.getState().hiring).toMatchObject({ officeId: 'o90', dept: 'sales' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(document.body, { key: 'h', code: 'KeyH' });
    expect(store.getState().hiring).toMatchObject({ officeId: 'o1', dept: 'sales' });
    expect(officeButton('Singapore')).toHaveAttribute('aria-pressed', 'true');
  });

  it('the Hire button keeps its x position when the owner moves in or out of the department and when a late badge appears', () => {
    stubWidth(false);
    const store = createGameStore(threeOffices(false));
    mount(store);
    const ops = () => screen.getByRole('region', { name: 'Operations' });
    const tools = () => ops().querySelector('.dept-tools')!;
    const hireTip = hireButton('Operations').closest('.tip')!;
    // Right-aligned at the end of the row, whatever sits on its left.
    expect(css).toMatch(/\.dept-hire \{[^}]*margin-left: auto;/);
    expect(css).not.toMatch(/\.dept-late \{[^}]*margin-left: auto;/);
    const check = () => {
      expect(tools().lastElementChild).toBe(hireTip);
      expect(hireButton('Operations').closest('.tip')).toBe(hireTip);
    };
    check();
    fireEvent.click(within(ops()).getByRole('button', { name: 'Work here' }));
    expect(within(ops()).getByText('You work here')).toBeInTheDocument();
    check();
    act(() => store.update((d) => void (d.day = 16)));
    expect(within(ops()).getByText('1 late')).toBeInTheDocument();
    check();
    fireEvent.keyDown(document.body, { key: 's', code: 'KeyS' });
    expect(within(ops()).getByRole('button', { name: 'Work here' })).toBeInTheDocument();
    check();
  });

  it('] and [ cycle offices', () => {
    stubWidth(false);
    mount(createGameStore(threeOffices()));
    const viewed = () => within(switcher()).getAllByRole('button', { pressed: true }).map((b) => b.textContent);
    expect(viewed()).toEqual([expect.stringContaining('Taipei')]);
    fireEvent.keyDown(document.body, { key: ']', code: 'BracketRight' });
    expect(viewed()).toEqual([expect.stringContaining('Singapore')]);
    fireEvent.keyDown(document.body, { key: ']', code: 'BracketRight' });
    expect(viewed()).toEqual([expect.stringContaining('Houston')]);
    fireEvent.keyDown(document.body, { key: ']', code: 'BracketRight' });
    expect(viewed()).toEqual([expect.stringContaining('Taipei')]);
    fireEvent.keyDown(document.body, { key: '[', code: 'BracketLeft' });
    expect(viewed()).toEqual([expect.stringContaining('Houston')]);

    // The arrows beside the offices do the same, and show their keys.
    const prev = within(switcher()).getByRole('button', { name: 'Previous office' });
    const next = within(switcher()).getByRole('button', { name: 'Next office' });
    expect(prev).toHaveAttribute('aria-keyshortcuts', '[');
    expect(next).toHaveAttribute('aria-keyshortcuts', ']');
    const tip = (b: HTMLElement) => document.getElementById(b.getAttribute('aria-describedby')!.split(' ').at(-1)!)!;
    expect(tip(prev)).toHaveTextContent('Previous office ([)');
    expect(tip(next)).toHaveTextContent('Next office (])');
    fireEvent.click(next);
    expect(viewed()).toEqual([expect.stringContaining('Taipei')]);
    fireEvent.click(prev);
    expect(viewed()).toEqual([expect.stringContaining('Houston')]);
  });

  it('the switcher is hidden with one office', () => {
    stubWidth(false);
    const store = createGameStore(gameOnDay(1));
    mount(store);
    expect(screen.queryByRole('group', { name: 'Offices' })).not.toBeInTheDocument();
    // [ and ] have nowhere to go.
    fireEvent.keyDown(document.body, { key: ']', code: 'BracketRight' });
    expect(screen.getByRole('region', { name: 'Sales' })).toBeInTheDocument();
  });

  it("an office that disappears falls back to the owner's office", () => {
    stubWidth(false);
    const store = createGameStore(threeOffices());
    mount(store);
    fireEvent.click(officeButton('Houston'));
    expect(opsTasks()).toBe(0);
    act(() => store.update((d) => void d.offices.pop()));
    expect(officeButton('Taipei')).toHaveAttribute('aria-pressed', 'true');
    expect(opsTasks()).toBe(1);
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

  it('the year end waits while the help is open; once it closes the clock plays on and the report takes focus', () => {
    vi.useFakeTimers();
    const store = createGameStore(gameOnDay(359));
    mount(store);
    fireEvent.keyDown(document.body, { key: '?', code: 'Slash', shiftKey: true });
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(B.dayMs * 2);
    });
    expect(store.getState().day).toBe(359);

    fireEvent.keyDown(document.body, { key: 'Escape' });
    act(() => {
      vi.advanceTimersByTime(B.dayMs * 2);
    });
    expect(store.getState().day).toBe(360);
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
    fireEvent.click(hireButton('Operations'));
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
    fireEvent.click(hireButton('Sales'));
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

  it('log entries name cities in the language and format rent as money', () => {
    const s = gameOnDay(30);
    s.log = [{ day: 30, tone: 'good', msg: { key: 'log.officeOpened', params: { city: 'LAX', rent: 3600 } } }];
    const store = createGameStore(s);
    const view = mount(store);
    expect(screen.getByText('Opened an office in Los Angeles. Rent is $3,600 a month.')).toBeInTheDocument();

    view.unmount();
    mount(store, { ...baseSettings, lang: 'zh-Hant' });
    expect(screen.getByText('在洛杉磯開了辦公室，月租 $3,600。')).toBeInTheDocument();
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

  it('the year end waits while Settings is open; once it closes the report takes focus', () => {
    vi.useFakeTimers();
    const store = createGameStore(gameOnDay(359));
    const { container } = mount(store);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    act(() => {
      vi.advanceTimersByTime(B.dayMs * 3);
    });
    expect(store.getState().day).toBe(359);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    fireEvent.keyDown(document.body, { key: 'Escape' });
    act(() => {
      vi.advanceTimersByTime(B.dayMs * 2);
    });
    expect(store.getState().day).toBe(360);
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
  /** A matchMedia stand-in where exactly `matching` queries match. */
  function stubMedia(...matching: string[]) {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: matching.includes(q),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  }
  const COARSE = '(any-pointer: coarse)';
  const FINE = '(any-pointer: fine)';
  const HOVER = '(any-hover: hover)';
  const shortcutsButton = () => screen.queryByRole('button', { name: 'Keyboard shortcuts' });

  it('the keyboard-shortcuts button is left out on a touch-only device; the keys still work', () => {
    stubMedia(COARSE);
    mount(createGameStore(gameOnDay(1)));
    expect(shortcutsButton()).not.toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: '?' });
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
  });

  it.each([
    ['a mouse', [FINE, HOVER]],
    ['touch with a mouse or trackpad too', [COARSE, FINE, HOVER]],
    ['touch with a pen that cannot hover', [COARSE, FINE]],
    ['touch with some other input that hovers', [COARSE, HOVER]],
    ['no pointer reported at all', []],
  ])('the keyboard-shortcuts button shows with %s', (_, matching) => {
    stubMedia(...matching);
    mount(createGameStore(gameOnDay(1)));
    expect(shortcutsButton()).toBeInTheDocument();
  });

  describe('tapping the backdrop', () => {
    it('closes the hiring dialog and restores the speed, like Close', () => {
      const store = createGameStore(gameOnDay(1));
      mount(store);
      fireEvent.click(screen.getByRole('button', { name: '3×' }));
      fireEvent.click(hireButton('Sales'));
      const dialog = screen.getByRole('dialog', { name: 'Hiring · Sales' });
      expect(pressed('Pause')).toBe('true');

      // Presses inside the dialog, or starting inside and released outside, leave it open.
      fireEvent.pointerDown(dialog);
      fireEvent.click(dialog);
      fireEvent.pointerDown(within(dialog).getByRole('heading', { name: 'Hiring · Sales' }));
      fireEvent.click(dialog.parentElement!);
      expect(screen.getByRole('dialog', { name: 'Hiring · Sales' })).toBeInTheDocument();

      tapBackdrop(dialog);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(store.getState().hiring).toBeNull();
      expect(pressed('3×')).toBe('true');
    });

    it('continues from the year report, like Continue', () => {
      const store = createGameStore(pausedAtYearEnd(REPORT));
      mount(store);
      tapBackdrop(screen.getByRole('dialog', { name: 'Year 1 report' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(store.getState().pauseReasons).toEqual([]);
      expect(pressed('1×')).toBe('true');
    });

    it('closes the settings panel and the shortcut list', () => {
      mount(createGameStore(gameOnDay(1)));
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      tapBackdrop(screen.getByRole('dialog', { name: 'Settings' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Settings' }));

      fireEvent.keyDown(document.body, { key: '?' });
      tapBackdrop(screen.getByRole('dialog', { name: 'Keyboard shortcuts' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
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
