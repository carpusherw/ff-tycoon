import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { Settings } from '../app/persistence';
import { createGameStore, type GameStore } from '../app/store';
import { I18nProvider } from '../i18n/I18nProvider';
import { B } from '../rules/balance';
import { createGame } from '../rules/newGame';
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

    const tabs = within(screen.getByRole('tablist')).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Departments', 'Hiring', 'Money', 'Log', 'Settings']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Sales' })).toBeInTheDocument();

    fireEvent.click(tabs[1]);
    expect(screen.queryByRole('region', { name: 'Sales' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hire' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Where you work' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Money this month' })).not.toBeInTheDocument();
  });

  it('wide layout shows every section and no tabs', () => {
    stubWidth(false);
    mount(createGameStore(gameOnDay(1)));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    for (const name of ['Hire', 'Where you work', 'Money this month', 'What happened', 'Settings']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('region', { name: 'Operations' })).toBeInTheDocument();
  });

  it('a run paused at a year end shows the banner and Resume restarts the clock', () => {
    vi.useFakeTimers();
    const store = createGameStore(gameOnDay(359));
    mount(store);
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(B.dayMs * 3);
    });
    expect(store.getState().day).toBe(360);
    expect(screen.getByText('The year is over. Check your numbers, then play on.')).toBeInTheDocument();
    expect(pressed('Pause')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(pressed('1×')).toBe('true');
    act(() => {
      vi.advanceTimersByTime(B.dayMs * 3);
    });
    expect(store.getState().day).toBeGreaterThan(360);
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument();
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

  it('moving the owner changes their department', () => {
    const store = createGameStore(gameOnDay(1));
    mount(store);
    const owner = screen.getByRole('group', { name: 'Where you work' });
    expect(within(owner).getByRole('button', { name: 'Sales' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(within(owner).getByRole('button', { name: 'Operations' }));
    expect(store.getState().employees[0].dept).toBe('ops');
    expect(within(screen.getByRole('region', { name: 'Operations' })).getByText('You')).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'New game' }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(onNewGame).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'New game' }));
    expect(onNewGame).toHaveBeenCalledOnce();
  });
});
