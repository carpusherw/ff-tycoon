import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createGame } from '../rules/newGame';
import { App } from './App';
import { loadGame, loadSettings, SAVE_KEY, saveGame, saveSettings } from './persistence';

/** The top bar's date as read: its year and day sit in boxes of their own, so it spans several elements. */
const dateText = () => document.querySelector('.pill-date b')?.textContent;

/** A `matchMedia` stand-in whose dark-mode answer the test can flip, firing `change` listeners. */
function mockColorScheme(dark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    get matches() {
      return dark;
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  vi.stubGlobal('matchMedia', () => query);
  return {
    set(next: boolean) {
      dark = next;
      act(() => listeners.forEach((fn) => fn()));
    },
    listenerCount: () => listeners.size,
  };
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('no save shows setup', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Start your forwarding company' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument();
  });

  it('an ended save shows the end screen', () => {
    const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
    s.day = 3600;
    s.ended = { reason: 'completed', day: 3600 };
    saveGame(localStorage, s);

    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Ten years in business!' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Book a demo with GoFreight' })).toBeInTheDocument();
  });

  it('Play again clears the save and goes back to setup', async () => {
    const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
    s.day = 420;
    s.ended = { reason: 'bankrupt', day: 420 };
    saveGame(localStorage, s);

    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Play again' }));
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Start your forwarding company' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument();
  });

  it('a running save offers Continue, which opens that game', async () => {
    const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
    s.day = 42;
    saveGame(localStorage, s);

    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(dateText()).toBe('Year 1 of 10 · Day 42');
  });

  it('Continue on a save paused at a year end shows the banner with Resume', async () => {
    const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
    s.day = 360;
    s.pauseReasons = ['yearEnd', 'yearEnd'];
    saveGame(localStorage, s);

    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText('The year is over. Check your numbers, then play on.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1×' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('settings changed in game update the app and are saved', async () => {
    saveGame(localStorage, createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' }));
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await userEvent.selectOptions(screen.getByLabelText('Theme'), 'dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    await userEvent.selectOptions(screen.getByLabelText('Language'), 'zh-Hant');
    expect(document.documentElement.lang).toBe('zh-Hant');
    expect(screen.getByRole('heading', { name: '設定' })).toBeInTheDocument();
    expect(loadSettings(localStorage, [])).toEqual({ lang: 'zh-Hant', theme: 'dark', autoPause: true });
  });

  it('New game from the settings clears the save and goes back to setup', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    saveGame(localStorage, createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' }));
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await userEvent.click(screen.getByRole('button', { name: 'New game' }));
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Start your forwarding company' })).toBeInTheDocument();
  });

  it('a new game starts from the chosen city with a fresh seed and is saved', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(2 ** 32 + 7);
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Rotterdam' }));

    expect(dateText()).toBe('Year 1 of 10 · Day 0');
    const saved = loadGame(localStorage);
    expect(saved?.offices[0].portId).toBe('RTM');
    expect(saved?.mode).toBe('normal');
    expect(saved?.seed).toBe(7);
  });

  it('sets the page title and <html lang> from the language setting', () => {
    saveSettings(localStorage, { lang: 'zh-Hant', theme: 'system', autoPause: true });
    render(<App />);
    expect(document.documentElement.lang).toBe('zh-Hant');
    expect(document.title).toBe('FF Tycoon');
    expect(screen.getByRole('heading', { level: 1, name: '創立你的貨代公司' })).toBeInTheDocument();
  });

  it('follows the system color scheme while the setting is system', () => {
    const scheme = mockColorScheme(true);
    const { unmount } = render(<App />);
    expect(document.documentElement.dataset.theme).toBe('dark');

    scheme.set(false);
    expect(document.documentElement.dataset.theme).toBe('light');

    unmount();
    expect(scheme.listenerCount()).toBe(0);
  });

  it('an explicit theme setting ignores the system color scheme', () => {
    const scheme = mockColorScheme(true);
    saveSettings(localStorage, { lang: 'en', theme: 'light', autoPause: true });
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe('light');

    scheme.set(true);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(scheme.listenerCount()).toBe(0);
  });
});
