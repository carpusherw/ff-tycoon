import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
/** The tooltip a button's aria-describedby points at (its last id). */
const tipOf = (button: HTMLElement) => {
  const id = button.getAttribute('aria-describedby')?.split(' ').at(-1);
  return id ? document.getElementById(id) : null;
};
/** The tooltip's first line, its label and keys, as text. */
const tipText = (button: HTMLElement) => {
  const tip = tipOf(button);
  return (tip?.querySelector('.tooltip-label') ?? tip)?.textContent;
};
/** The keycaps (kbd elements) in a button's tooltip. */
const tipKeys = (button: HTMLElement) => [...(tipOf(button)?.querySelectorAll('kbd') ?? [])].map((k) => k.textContent);
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

  it('after the Pause button, Space resumes at the speed from before', async () => {
    const user = mount(createGameStore(gameOnDay(1)));
    await user.click(screen.getByRole('button', { name: '3×' }));
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(pressedSpeed()).toBe('Pause');
    // Off the button (Space there would press it): a click on the board puts focus on the game.
    await user.click(screen.getByRole('heading', { name: 'Sales' }));
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

  it('Shift+A opens hiring for Accounting while the owner works in Sales, and the owner stays put', async () => {
    const store = createGameStore(gameOnDay(1));
    const user = mount(store);
    expect(ownerDept(store)).toBe('sales');
    await user.keyboard('{Shift>}a{/Shift}');
    expect(screen.getByRole('dialog', { name: 'Hiring · Accounting' })).toBeInTheDocument();
    expect(store.getState().hiring?.dept).toBe('accounting');
    expect(ownerDept(store)).toBe('sales');
    expect(store.getState().cash).toBe(B.startCash - B.hiring.jobAdCost);
    // Never a second session while one is open: Shift+O inside the dialog charges nothing.
    await user.keyboard('{Shift>}o{/Shift}');
    expect(store.getState().hiring?.dept).toBe('accounting');
    expect(store.getState().cash).toBe(B.startCash - B.hiring.jobAdCost);
  });

  it('Shift+O hires for Operations and does not move the owner', async () => {
    const store = createGameStore(gameOnDay(1));
    const user = mount(store);
    await user.keyboard('{Shift>}o{/Shift}');
    expect(screen.getByRole('dialog', { name: 'Hiring · Operations' })).toBeInTheDocument();
    expect(ownerDept(store)).toBe('sales');
  });

  it('a Shift combo with no binding of its own runs the plain key: Shift+H hires like H', async () => {
    const store = createGameStore(gameOnDay(1));
    const user = mount(store);
    await user.keyboard('o');
    await user.keyboard('{Shift>}h{/Shift}');
    expect(screen.getByRole('dialog', { name: 'Hiring · Operations' })).toBeInTheDocument();
    expect(store.getState().cash).toBe(B.startCash - B.hiring.jobAdCost);
  });

  it('Shift+R re-rolls like R inside the hiring dialog', async () => {
    const store = createGameStore(gameOnDay(1));
    const user = mount(store);
    await user.keyboard('h');
    const before = store.getState().hiring!.candidates.map((c) => c.candidateId);
    await user.keyboard('{Shift>}r{/Shift}');
    expect(store.getState().cash).toBe(B.startCash - B.hiring.jobAdCost - B.hiring.rerollCost);
    expect(store.getState().hiring!.candidates.map((c) => c.candidateId)).not.toEqual(before);
  });

  it('plain A moves the owner and opens no hiring', async () => {
    const store = createGameStore(gameOnDay(1));
    const user = mount(store);
    await user.keyboard('a');
    expect(ownerDept(store)).toBe('accounting');
    expect(store.getState().hiring).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Shift+O you cannot afford shows the reason and opens nothing', async () => {
    const s = gameOnDay(1);
    s.cash = 100;
    const store = createGameStore(s);
    const user = mount(store);
    await user.keyboard('{Shift>}o{/Shift}');
    expect(store.getState().hiring).toBeNull();
    expect(store.getState().cash).toBe(100);
    expect(screen.getByText("You can't afford that.")).toBeInTheDocument();
  });

  it('every job ad has the same tooltip shape: its Shift key, or H when you work there; moving changes nothing', async () => {
    const store = createGameStore(gameOnDay(1));
    const user = mount(store);
    const ad = (dept: string) => screen.getByRole('button', { name: new RegExp(`^${dept} · \\$800`) });
    const expected = {
      Sales: ['S', 'Hire for Sales (⇧S, or H when you work here)'],
      Operations: ['O', 'Hire for Operations (⇧O, or H when you work here)'],
      Accounting: ['A', 'Hire for Accounting (⇧A, or H when you work here)'],
    };
    const checkAll = () => {
      for (const [dept, [letter, text]] of Object.entries(expected)) {
        expect(ad(dept)).toHaveAttribute('aria-keyshortcuts', `Shift+${letter}`);
        expect(tipText(ad(dept))).toBe(text);
        expect(tipKeys(ad(dept))).toEqual([`⇧${letter}`, '⇧', letter, 'H']);
      }
    };
    checkAll();
    const shift = tipOf(ad('Operations'))!.querySelector('kbd kbd')!;
    expect(shift).toHaveAttribute('aria-label', 'Shift');
    expect(shift.parentElement).toHaveAttribute('aria-label', 'Shift+O');

    await user.keyboard('o');
    expect(ownerDept(store)).toBe('ops');
    checkAll();
  });

  it('the job-ad tooltip is translated around untranslated keycaps', () => {
    mount(createGameStore(gameOnDay(1)), { ...baseSettings, lang: 'zh-Hant' });
    const ad = screen.getByRole('button', { name: /^OP · / });
    expect(tipText(ad)).toBe('為OP招募（⇧O，你在這裡工作時也可按 H）');
    expect(tipKeys(ad)).toEqual(['⇧O', '⇧', 'O', 'H']);
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

  it('hiring all three keeps the dialog open and the clock held until Close', async () => {
    const store = createGameStore(gameOnDay(1));
    const user = mount(store);
    await user.keyboard('3');
    await user.keyboard('h');
    await user.keyboard('123');
    expect(store.getState().employees).toHaveLength(4);
    expect(screen.getByRole('dialog', { name: 'Hiring · Sales' })).toBeInTheDocument();
    expect(pressedSpeed()).toBe('Pause');
    await user.keyboard('r');
    expect(store.getState().hiring?.candidates).toHaveLength(3);
    expect(pressedSpeed()).toBe('Pause');
    await user.keyboard('{Escape}');
    expect(store.getState().hiring).toBeNull();
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
    // Every row, in order: what it does, then each binding as its keycap reads (a combination by its
    // accessible name, e.g. "Shift+S"), then the keycaps inside each combination with their names.
    const rows = [...help.querySelectorAll('.hotkey-row')].map((row) => ({
      what: row.querySelector('dd')!.textContent,
      keys: [...row.querySelectorAll('dt > kbd')].map((k) => k.getAttribute('aria-label') ?? k.textContent),
      caps: [...row.querySelectorAll('dt > kbd.kbd-combo')].map((c) =>
        [...c.querySelectorAll('kbd')].map((k) => `${k.textContent}${k.hasAttribute('aria-label') ? `=${k.getAttribute('aria-label')}` : ''}`),
      ),
    }));
    expect(rows).toEqual([
      { what: 'Pause or resume', keys: ['Space'], caps: [] },
      { what: '1× speed', keys: ['1'], caps: [] },
      { what: '3× speed', keys: ['3'], caps: [] },
      { what: '5× speed', keys: ['5'], caps: [] },
      { what: 'Have owner work in Sales, Operations or Accounting', keys: ['S', 'O', 'A'], caps: [] },
      { what: 'Post a job ad for the department you work in', keys: ['H'], caps: [] },
      {
        what: 'Post a job ad for Sales, Operations or Accounting',
        keys: ['Shift+S', 'Shift+O', 'Shift+A'],
        caps: [
          ['⇧=Shift', 'S'],
          ['⇧=Shift', 'O'],
          ['⇧=Shift', 'A'],
        ],
      },
      { what: 'Show this list', keys: ['?', '/'], caps: [] },
      { what: 'Hire that candidate', keys: ['1', '2', '3'], caps: [] },
      { what: 'Re-roll the candidates', keys: ['R'], caps: [] },
      { what: 'Continue after a year report', keys: ['Enter', 'Space'], caps: [] },
      { what: 'Close', keys: ['Esc'], caps: [] },
    ]);

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

  it('Space on a focused button pauses and does not press the button', async () => {
    const store = createGameStore(gameOnDay(1));
    const user = mount(store);
    within(screen.getByRole('region', { name: 'Operations' })).getByRole('button', { name: 'Work here' }).focus();
    await user.keyboard(' ');
    expect(ownerDept(store)).toBe('sales');
    expect(pressedSpeed()).toBe('Pause');
    await user.keyboard(' ');
    expect(pressedSpeed()).toBe('1×');
    expect(ownerDept(store)).toBe('sales');
  });

  it('Enter on a focused button still presses it and leaves the clock alone', async () => {
    const store = createGameStore(gameOnDay(1));
    const user = mount(store);
    within(screen.getByRole('region', { name: 'Operations' })).getByRole('button', { name: 'Work here' }).focus();
    await user.keyboard('{Enter}');
    expect(ownerDept(store)).toBe('ops');
    expect(pressedSpeed()).toBe('1×');
  });

  it('after the hiring dialog closes onto the job-ad button, Space pauses and posts no new job ad', async () => {
    const store = createGameStore(gameOnDay(1));
    const user = mount(store);
    await user.keyboard('3');
    await user.click(screen.getByRole('button', { name: /^Sales · \$800/ }));
    const cash = store.getState().cash;
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Sales · \$800/ }));
    expect(pressedSpeed()).toBe('3×');

    await user.keyboard(' ');
    expect(pressedSpeed()).toBe('Pause');
    expect(store.getState().hiring).toBeNull();
    expect(store.getState().cash).toBe(cash);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Space on the game body (a non-interactive element) pauses', async () => {
    const store = createGameStore(gameOnDay(1));
    const user = mount(store);
    (document.querySelector('.game') as HTMLElement).focus();
    await user.keyboard(' ');
    expect(pressedSpeed()).toBe('Pause');
  });

  it.each(['link', 'checkbox', 'tab'])('Space on a focused %s pauses instead of pressing it', (role) => {
    mount(createGameStore(gameOnDay(1)));
    const control = document.createElement(role === 'link' ? 'a' : 'div');
    if (role === 'link') control.setAttribute('href', '#');
    else {
      control.setAttribute('role', role);
      control.tabIndex = 0;
    }
    document.body.append(control);
    try {
      control.focus();
      const e = new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true });
      act(() => {
        control.dispatchEvent(e);
      });
      expect(e.defaultPrevented).toBe(true);
      expect(pressedSpeed()).toBe('Pause');
    } finally {
      control.remove();
    }
  });

  it('inside the hiring dialog Space is left to the dialog: it presses the focused Hire button', async () => {
    const store = createGameStore(gameOnDay(1));
    const user = mount(store);
    await user.keyboard('h');
    const dialog = screen.getByRole('dialog', { name: 'Hiring · Sales' });
    const first = store.getState().hiring!.candidates[0];
    within(dialog).getAllByRole('button', { name: 'Hire' })[0].focus();
    await user.keyboard(' ');
    expect(store.getState().employees.map((e) => e.name)).toContain(first.name);
    expect(pressedSpeed()).toBe('Pause');
  });

  it('while the "+N" staff list is open the game keys do nothing; after it closes they work again', async () => {
    const s = gameOnDay(1);
    for (let i = 0; i < 12; i++) {
      s.employees.push({ ...s.employees[0], id: `e9${i}`, name: `Seller ${i + 1}`, isOwner: false, salary: 2400 });
    }
    const store = createGameStore(s);
    const user = mount(store);
    await user.click(screen.getByRole('button', { name: 'Show all 13 staff' }));
    const list = screen.getByRole('dialog', { name: 'Sales staff' });
    expect(list.contains(document.activeElement)).toBe(true);

    await user.keyboard('o5 h');
    expect(ownerDept(store)).toBe('sales');
    expect(pressedSpeed()).toBe('1×');
    expect(store.getState().hiring).toBeNull();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Sales staff' })).not.toBeInTheDocument();
    await user.keyboard('o');
    expect(ownerDept(store)).toBe('ops');
  });

  it('a plain / opens the help too, but not while typing or inside another dialog', async () => {
    const user = mount(createGameStore(gameOnDay(1)));
    await user.keyboard('/');
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    await user.keyboard('/');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    await user.keyboard('/');
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();
  });

  it('the ? button beside the gear opens the help', async () => {
    const user = mount(createGameStore(gameOnDay(1)));
    const button = screen.getByRole('button', { name: 'Keyboard shortcuts' });
    expect(button).toHaveAttribute('aria-keyshortcuts', '? /');
    await user.click(button);
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(button);
  });

  it('the ? button is translated', () => {
    mount(createGameStore(gameOnDay(1)), { ...baseSettings, lang: 'zh-Hans' });
    expect(screen.getByRole('button', { name: '键盘快捷键' })).toHaveAttribute('aria-keyshortcuts', '? /');
  });

  it('buttons show their hotkeys as keycaps in a tooltip linked by aria-describedby', async () => {
    const store = createGameStore(gameOnDay(1));
    const user = mount(store);
    const speed = screen.getByRole('group', { name: 'Game speed' });
    const pause = within(speed).getByRole('button', { name: 'Pause' });
    expect(pause).toHaveAttribute('aria-keyshortcuts', 'Space');
    expect(tipText(pause)).toBe('Pause (Space)');
    expect(tipKeys(pause)).toEqual(['Space']);
    for (const n of ['1', '3', '5']) {
      const button = within(speed).getByRole('button', { name: `${n}×` });
      expect(button).toHaveAttribute('aria-keyshortcuts', n);
      // One format everywhere: a descriptive action, then the keys as keycaps in parentheses.
      expect(tipText(button)).toBe(`${n}× speed (${n})`);
      expect(tipKeys(button)).toEqual([n]);
      expect(button).not.toHaveAttribute('title');
    }
    const x3 = tipOf(within(speed).getByRole('button', { name: '3×' }))!.querySelector('.tooltip-label')!;
    expect(x3.innerHTML).toMatch(/^3× speed \(<kbd>3<\/kbd>\)$/);
    const help = screen.getByRole('button', { name: 'Keyboard shortcuts' });
    expect(help).toHaveAttribute('aria-keyshortcuts', '? /');
    expect(tipText(help)).toBe('Keyboard shortcuts (? / /)');
    expect(tipKeys(help)).toEqual(['?', '/']);
    expect(tipText(screen.getByRole('button', { name: 'Settings' }))).toBe('Settings');
    expect(tipKeys(screen.getByRole('button', { name: 'Settings' }))).toEqual([]);
    const ops = within(screen.getByRole('region', { name: 'Operations' })).getByRole('button', { name: 'Work here' });
    expect(ops).toHaveAttribute('aria-keyshortcuts', 'O');
    expect(tipText(ops)).toBe('Work here (O)');
    expect(tipKeys(ops)).toEqual(['O']);
    expect(tipOf(ops)?.querySelector('.tooltip-hint')?.textContent).toMatch(/^Only you/);
    // Each job ad has its Shift key; H (where the owner works) is told in the text.
    const salesAd = screen.getByRole('button', { name: /^Sales · \$800/ });
    expect(salesAd).toHaveAttribute('aria-keyshortcuts', 'Shift+S');
    expect(tipKeys(salesAd)).toContain('H');

    await user.keyboard('h');
    const dialog = screen.getByRole('dialog', { name: 'Hiring · Sales' });
    const hires = within(dialog).getAllByRole('button', { name: 'Hire' });
    expect(hires.map((b) => b.getAttribute('aria-keyshortcuts'))).toEqual(['1', '2', '3']);
    expect(hires.map(tipText)).toEqual(['Hire (1)', 'Hire (2)', 'Hire (3)']);
    const reroll = within(dialog).getByRole('button', { name: /^Re-roll/ });
    expect(reroll).toHaveAttribute('aria-keyshortcuts', 'R');
    expect(tipKeys(reroll)).toEqual(['R']);
    const close = within(dialog).getByRole('button', { name: 'Close' });
    expect(close).toHaveAttribute('aria-keyshortcuts', 'Escape');
    expect(tipText(close)).toBe('Close (Esc)');
    expect(tipKeys(close)).toEqual(['Esc']);
  });

  it('key names stay untranslated; the words around them are translated', async () => {
    const user = mount(createGameStore(gameOnDay(1)), { ...baseSettings, lang: 'zh-Hant' });
    const pause = within(screen.getByRole('group', { name: '遊戲速度' })).getByRole('button', { name: '暫停' });
    expect(tipText(pause)).toBe('暫停（Space）');
    expect(tipKeys(pause)).toEqual(['Space']);
    const x3 = within(screen.getByRole('group', { name: '遊戲速度' })).getByRole('button', { name: '3×' });
    expect(tipText(x3)).toBe('3 倍速（3）');
    await user.keyboard('?');
    const help = screen.getByRole('dialog', { name: '鍵盤快速鍵' });
    expect(within(help).getAllByText('Space', { selector: 'kbd' }).length).toBeGreaterThan(0);
    expect(within(help).queryByText('空白鍵')).not.toBeInTheDocument();
  });

  it('hovering a hotkey button shows its tooltip with the key; focusing one shows it at once', async () => {
    const user = mount(createGameStore(gameOnDay(1)));
    const pause = screen.getByRole('button', { name: 'Pause' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await user.hover(pause);
    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent('Pause (Space)');
    expect(tip.querySelector('kbd')).toHaveTextContent(/^Space$/);
    expect(pause.getAttribute('aria-describedby')).toContain(tip.id);
    await user.unhover(pause);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Keyboard focus: Tab from Pause lands on 1×, whose tooltip shows without waiting.
    act(() => pause.focus());
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '1×' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('1× speed (1)');
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
    // Shift+letter is a key of its own, so it never also runs the plain letter.
    expect(hotkeyOf(event({ key: 'S', code: 'KeyS', shiftKey: true }))).toBe('shift+s');
    expect(hotkeyOf(event({ key: '?', code: 'Slash', shiftKey: true }))).toBe('?');
    expect(hotkeyOf(event({ key: 'Enter', code: 'Enter' }))).toBe('enter');
    expect(hotkeyOf(event({ key: '/', code: 'Slash' }))).toBe('?');
  });

  it('Space is the game-wide pause key even on a control; Enter is left to the control', () => {
    const button = document.createElement('button');
    expect(hotkeyOf(event({ key: ' ', code: 'Space' }, button))).toBe('space');
    expect(hotkeyOf(event({ key: 'Enter', code: 'Enter' }, button))).toBeNull();
    for (const tag of ['input', 'select', 'textarea']) {
      expect(hotkeyOf(event({ key: ' ', code: 'Space' }, document.createElement(tag)))).toBeNull();
    }
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
