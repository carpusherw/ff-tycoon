import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Settings } from '../app/persistence';
import { createGameStore, type GameStore } from '../app/store';
import { I18nProvider } from '../i18n/I18nProvider';
import type { Lang } from '../i18n';
import { B } from '../rules/balance';
import { createGame } from '../rules/newGame';
import type { YearReport } from '../rules/types';
import { GameScreen } from './GameScreen';
import { hotkeyOf } from './useHotkeys';

const baseSettings: Settings = { lang: 'en', theme: 'system', autoPause: true };

function gameOnDay(day: number) {
  const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
  s.day = day;
  return s;
}

function mount(store: GameStore, settings: Settings = baseSettings) {
  const user = userEvent.setup();
  render(
    <I18nProvider lang={settings.lang}>
      <GameScreen store={store} settings={settings} onSettingsChange={vi.fn()} onNewGame={vi.fn()} />
    </I18nProvider>,
  );
  return user;
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

function pausedAtYearEnd(report: YearReport | null) {
  const s = gameOnDay(360);
  s.pauseReasons = ['yearEnd'];
  s.yearReports = report ? [report] : [];
  return s;
}

/** The pressed speed button's name: Pause, 1×, 3× or 5×. */
const pressedSpeed = () => {
  const buttons = within(screen.getByRole('group', { name: 'Game speed' })).getAllByRole('button');
  const on = buttons.find((b) => b.getAttribute('aria-pressed') === 'true');
  return on?.getAttribute('aria-label') ?? on?.textContent;
};
const ownerDept = (store: GameStore) => store.getState().employees.find((e) => e.isOwner)?.dept;

describe('keyboard hotkeys', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Space pauses, and Space again resumes at the speed from before', async () => {
    const user = mount(createGameStore(gameOnDay(1)));
    await user.keyboard('3');
    expect(pressedSpeed()).toBe('3×');
    await user.keyboard(' ');
    expect(pressedSpeed()).toBe('Pause');
    await user.keyboard(' ');
    expect(pressedSpeed()).toBe('3×');
  });

  it('1, 3 and 5 set the speed', async () => {
    const user = mount(createGameStore(gameOnDay(1)));
    await user.keyboard('3');
    expect(pressedSpeed()).toBe('3×');
    await user.keyboard('5');
    expect(pressedSpeed()).toBe('5×');
    await user.keyboard('1');
    expect(pressedSpeed()).toBe('1×');
  });

  it('5 is ignored during a year-end pause; Space acts as Continue on the report', async () => {
    const store = createGameStore(pausedAtYearEnd(REPORT));
    const user = mount(store);
    expect(screen.getByRole('dialog', { name: 'Year 1 report' })).toBeInTheDocument();
    await user.keyboard('5');
    expect(pressedSpeed()).toBe('Pause');
    expect(store.getState().pauseReasons).toEqual(['yearEnd']);

    await user.keyboard(' ');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(store.getState().pauseReasons).toEqual([]);
    expect(pressedSpeed()).toBe('1×');
  });

  it('Enter on the year report is its Continue button', async () => {
    const store = createGameStore(pausedAtYearEnd(REPORT));
    const user = mount(store);
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pressedSpeed()).toBe('1×');
  });

  it('with only the banner, 5 is ignored and Space is the banner Resume', async () => {
    // An old save stopped at a year end without a report keeps the plain banner.
    const store = createGameStore(pausedAtYearEnd(null));
    const user = mount(store);
    expect(screen.getByRole('button', { name: 'Resume' })).toHaveAttribute('aria-keyshortcuts', 'Space');
    await user.keyboard('5');
    expect(pressedSpeed()).toBe('Pause');
    await user.keyboard(' ');
    expect(store.getState().pauseReasons).toEqual([]);
    expect(pressedSpeed()).toBe('1×');
  });

  it('O, A and S move the owner; the key for where you already work changes nothing', async () => {
    const store = createGameStore(gameOnDay(1));
    const user = mount(store);
    await user.keyboard('o');
    expect(ownerDept(store)).toBe('ops');
    expect(within(screen.getByRole('region', { name: 'Operations' })).getByText('You work here')).toBeInTheDocument();
    await user.keyboard('a');
    expect(ownerDept(store)).toBe('accounting');
    await user.keyboard('s');
    expect(ownerDept(store)).toBe('sales');

    // Moving would send the owner's open tasks back to the queue, so staying put must not touch the state.
    const before = store.getState();
    await user.keyboard('s');
    expect(store.getState()).toBe(before);
  });

  it('H posts a job ad for where the owner works, and a second H does not charge again', async () => {
    const store = createGameStore(gameOnDay(1));
    const user = mount(store);
    await user.keyboard('o');
    await user.keyboard('h');
    expect(screen.getByRole('dialog', { name: 'Hiring · Operations' })).toBeInTheDocument();
    expect(store.getState().cash).toBe(B.startCash - B.hiring.jobAdCost);

    await user.keyboard('h');
    expect(store.getState().cash).toBe(B.startCash - B.hiring.jobAdCost);
    expect(store.getState().hiring?.dept).toBe('ops');
  });

  it('H you cannot afford shows the reason and opens nothing', async () => {
    const s = gameOnDay(1);
    s.cash = 100;
    const store = createGameStore(s);
    const user = mount(store);
    await user.keyboard('h');
    expect(store.getState().hiring).toBeNull();
    expect(store.getState().cash).toBe(100);
    expect(screen.getByText("You can't afford that.")).toBeInTheDocument();
  });

  it('in the hiring dialog 2 hires the second candidate and does not change the speed', async () => {
    const store = createGameStore(gameOnDay(1));
    const user = mount(store);
    await user.keyboard('3');
    await user.keyboard('h');
    expect(pressedSpeed()).toBe('Pause');
    const second = store.getState().hiring!.candidates[1];

    await user.keyboard('2');
    expect(store.getState().employees.map((e) => e.name)).toContain(second.name);
    expect(store.getState().hiring?.candidates.map((c) => c.candidateId)).not.toContain(second.candidateId);
    expect(pressedSpeed()).toBe('Pause');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pressedSpeed()).toBe('3×');
  });

  it('in the hiring dialog R re-rolls, and owner and speed keys do nothing', async () => {
    const store = createGameStore(gameOnDay(1));
    const user = mount(store);
    await user.keyboard('h');
    const first = store.getState().hiring!.candidates.map((c) => c.candidateId);
    await user.keyboard('r');
    expect(store.getState().cash).toBe(B.startCash - B.hiring.jobAdCost - B.hiring.rerollCost);
    expect(store.getState().hiring!.candidates.map((c) => c.candidateId)).not.toEqual(first);

    await user.keyboard('o5 ');
    expect(ownerDept(store)).toBe('sales');
    expect(pressedSpeed()).toBe('Pause');
    expect(screen.getByRole('dialog', { name: 'Hiring · Sales' })).toBeInTheDocument();
  });

  it('keys typed into the language select do not trigger hotkeys', async () => {
    const store = createGameStore(gameOnDay(1));
    const user = mount(store);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    screen.getByLabelText('Language').focus();
    await user.keyboard('o5h ');
    expect(ownerDept(store)).toBe('sales');
    expect(store.getState().hiring).toBeNull();
    expect(pressedSpeed()).toBe('1×');
  });

  it('? opens the hotkey help, which lists every key; Escape closes it', async () => {
    const user = mount(createGameStore(gameOnDay(1)));
    await user.keyboard('?');
    const help = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(help.contains(document.activeElement)).toBe(true);
    expect(screen.getByRole('button', { name: '1×' }).closest('[inert]')).not.toBeNull();
    for (const key of ['Space', '1', '3', '5', 'S', 'O', 'A', 'H', 'R', 'Esc', '?']) {
      expect(within(help).getAllByText(key, { selector: 'kbd' }).length).toBeGreaterThan(0);
    }
    expect(within(help).getByText('Pause or resume')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.keyboard('?');
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    await user.keyboard('?');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each<[Lang, string, string]>([
    ['zh-Hant', '鍵盤快速鍵', '暫停或繼續'],
    ['zh-Hans', '键盘快捷键', '暂停或继续'],
  ])('the help is translated (%s)', async (lang, title, line) => {
    const user = mount(createGameStore(gameOnDay(1)), { ...baseSettings, lang });
    await user.keyboard('?');
    const help = screen.getByRole('dialog', { name: title });
    expect(within(help).getByText(line)).toBeInTheDocument();
  });

  it('Ctrl+S, Meta+5, Alt+O and key repeats do nothing', async () => {
    const store = createGameStore(gameOnDay(1));
    const user = mount(store);
    await user.keyboard('{Control>}s{/Control}{Meta>}5{/Meta}{Alt>}o{/Alt}');
    expect(ownerDept(store)).toBe('sales');
    expect(pressedSpeed()).toBe('1×');

    fireEvent.keyDown(document.body, { key: '3', code: 'Digit3', repeat: true });
    expect(pressedSpeed()).toBe('1×');
  });

  it('Space on a focused button pauses instead of pressing the button', async () => {
    const store = createGameStore(gameOnDay(1));
    const user = mount(store);
    within(screen.getByRole('region', { name: 'Operations' })).getByRole('button', { name: 'Work here' }).focus();
    await user.keyboard(' ');
    expect(ownerDept(store)).toBe('sales');
    expect(pressedSpeed()).toBe('Pause');
  });

  it('buttons show their hotkeys', async () => {
    const store = createGameStore(gameOnDay(1));
    const user = mount(store);
    const speed = screen.getByRole('group', { name: 'Game speed' });
    expect(within(speed).getByRole('button', { name: 'Pause' })).toHaveAttribute('aria-keyshortcuts', 'Space');
    expect(within(speed).getByRole('button', { name: 'Pause' })).toHaveAttribute('title', 'Pause (Space)');
    for (const n of ['1', '3', '5']) {
      expect(within(speed).getByRole('button', { name: `${n}×` })).toHaveAttribute('aria-keyshortcuts', n);
    }
    const ops = within(screen.getByRole('region', { name: 'Operations' })).getByRole('button', { name: 'Work here' });
    expect(ops).toHaveAttribute('aria-keyshortcuts', 'O');
    expect(ops.getAttribute('title')).toMatch(/\(O\)$/);
    // H posts for the owner's department, so only that job-ad button carries it.
    expect(screen.getByRole('button', { name: /^Sales · \$800/ })).toHaveAttribute('aria-keyshortcuts', 'H');
    expect(screen.getByRole('button', { name: /^Operations · \$800/ })).not.toHaveAttribute('aria-keyshortcuts');

    await user.keyboard('h');
    const dialog = screen.getByRole('dialog', { name: 'Hiring · Sales' });
    expect(within(dialog).getAllByRole('button', { name: 'Hire' }).map((b) => b.getAttribute('aria-keyshortcuts'))).toEqual([
      '1',
      '2',
      '3',
    ]);
    expect(within(dialog).getByRole('button', { name: /^Re-roll/ })).toHaveAttribute('aria-keyshortcuts', 'R');
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveAttribute('aria-keyshortcuts', 'Escape');
  });
});

describe('hotkeyOf', () => {
  const event = (init: KeyboardEventInit, target: Element = document.body) => {
    const e = new KeyboardEvent('keydown', { bubbles: true, ...init });
    Object.defineProperty(e, 'target', { value: target });
    return e;
  };

  it('names keys by their physical position, the same in every language', () => {
    expect(hotkeyOf(event({ key: ' ', code: 'Space' }))).toBe('space');
    expect(hotkeyOf(event({ key: '3', code: 'Digit3' }))).toBe('3');
    expect(hotkeyOf(event({ key: '3', code: 'Numpad3' }))).toBe('3');
    // An input method can report the key as "Process"; the code still says which key it was.
    expect(hotkeyOf(event({ key: 'Process', code: 'KeyO' }))).toBe('o');
    expect(hotkeyOf(event({ key: 'S', code: 'KeyS', shiftKey: true }))).toBe('s');
    expect(hotkeyOf(event({ key: '?', code: 'Slash', shiftKey: true }))).toBe('?');
    expect(hotkeyOf(event({ key: 'Enter', code: 'Enter' }))).toBe('enter');
  });

  it('ignores modifier combos, repeats and typing in form fields', () => {
    expect(hotkeyOf(event({ key: 's', code: 'KeyS', ctrlKey: true }))).toBeNull();
    expect(hotkeyOf(event({ key: 's', code: 'KeyS', metaKey: true }))).toBeNull();
    expect(hotkeyOf(event({ key: 's', code: 'KeyS', altKey: true }))).toBeNull();
    expect(hotkeyOf(event({ key: 's', code: 'KeyS', repeat: true }))).toBeNull();
    for (const tag of ['input', 'select', 'textarea']) {
      expect(hotkeyOf(event({ key: 's', code: 'KeyS' }, document.createElement(tag)))).toBeNull();
    }
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    expect(hotkeyOf(event({ key: 's', code: 'KeyS' }, editable))).toBeNull();
  });
});
