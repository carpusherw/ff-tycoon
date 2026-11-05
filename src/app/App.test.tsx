import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { B } from '../rules/balance';
import { createGame } from '../rules/newGame';
import type { GameState } from '../rules/types';
import { App } from './App';
import { loadGame, loadSettings, SAVE_KEY, saveGame, saveSettings } from './persistence';

/** The top bar's date as read: its year and day sit in boxes of their own, so it spans several elements. */
const dateText = () => document.querySelector('.pill-date b')?.textContent;
/** The game board (everything under the dialogs), or null once it's gone. */
const board = () => document.querySelector('.game-body');

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

  it('an ended save shows the end screen straight away, with no celebration replay', () => {
    const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
    s.day = 3600;
    s.ended = { reason: 'completed', day: 3600 };
    saveGame(localStorage, s);

    render(<App />);
    const heading = screen.getByRole('heading', { level: 1, name: 'Ten years in business!' });
    expect(screen.getByRole('link', { name: 'Book a demo with GoFreight' })).toBeInTheDocument();
    expect(board()).toBeNull();
    expect(screen.queryByText('10 years in business!')).not.toBeInTheDocument();
    expect(screen.queryByText('Run complete')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(heading);
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

  describe('the end of a run', () => {
    const REDUCED = '(prefers-reduced-motion: reduce)';
    const COMPLETED = 'Ten years in business!';
    const BANKRUPT = 'Your company went bankrupt';

    /** Media queries answer `matching` and nothing else. */
    function stubMedia(matching: string[] = []) {
      vi.stubGlobal('matchMedia', (q: string) => ({
        matches: matching.includes(q),
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));
    }

    /** Opens a running save one day before it ends, then plays that day. */
    function playToTheEnd(prepare: (s: GameState) => void) {
      const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
      prepare(s);
      saveGame(localStorage, s);
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      advance(B.dayMs * 2);
    }
    const lastDayOfTheRun = (s: GameState) => {
      s.day = B.runDays - 1;
    };
    // Day 390 is a month end; payroll and rent take the cash below zero.
    const lastDayBeforeBankruptcy = (s: GameState) => {
      s.day = 389;
      s.cash = 1;
    };

    const advance = (ms: number) =>
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    const endHeading = (name: string) => screen.queryByRole('heading', { level: 1, name });

    beforeEach(() => {
      vi.useFakeTimers();
      stubMedia();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('freezes the board, celebrates a completed run, then fades into the end screen', () => {
      playToTheEnd(lastDayOfTheRun);

      // Frozen: the board stays, inert, with no year report on top and the clock stopped.
      expect(board()).toHaveAttribute('inert');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('10 years in business!')).toBeInTheDocument();
      expect(document.querySelectorAll('.fx-burst').length).toBeGreaterThan(0);
      expect(screen.queryByText('Closed')).not.toBeInTheDocument();
      expect(endHeading(COMPLETED)).not.toBeInTheDocument();
      expect(screen.getByText('Run complete')).toHaveAttribute('role', 'status');
      // The overlay carries the message, so the board's pause banner steps aside.
      expect(screen.queryByText('Your ten years are up.')).not.toBeInTheDocument();
    });

    it('runs the completed celebration for 2.5 s, then a 600 ms cross-fade', () => {
      playToTheEnd(lastDayOfTheRun);
      advance(2499);
      expect(endHeading(COMPLETED)).not.toBeInTheDocument();
      expect(board()).not.toBeNull();

      advance(1);
      // The cross-fade: the end screen is in, but inert until it's done; the frozen board is still under it.
      const heading = endHeading(COMPLETED);
      expect(heading).toBeInTheDocument();
      expect(heading?.closest('[inert]')).not.toBeNull();
      expect(board()).not.toBeNull();
      advance(599);
      expect(board()).not.toBeNull();

      advance(1);
      expect(board()).toBeNull();
      expect(screen.queryByText('10 years in business!')).not.toBeInTheDocument();
      expect(endHeading(COMPLETED)).toBe(heading);
      expect(heading?.closest('[inert]')).toBeNull();
      expect(document.activeElement).toBe(heading);
      expect(screen.getByRole('link', { name: 'Book a demo with GoFreight' })).toBeInTheDocument();
    });

    it('a tap during the cross-fade only finishes it: it never opens the demo or clears the save', () => {
      playToTheEnd(lastDayOfTheRun);
      advance(2500);
      const link = screen.getByRole('link', { name: 'Book a demo with GoFreight' });
      const linkClicked = vi.fn();
      link.addEventListener('click', linkClicked);

      // A click on the fading demo link is swallowed (not followed) and ends the fade.
      expect(fireEvent.click(link)).toBe(false);
      expect(linkClicked).not.toHaveBeenCalled();
      expect(board()).toBeNull();

      // The next clicks reach the end screen as usual.
      expect(fireEvent.click(link)).toBe(true);
      expect(linkClicked).toHaveBeenCalledOnce();
      fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
      expect(localStorage.getItem(SAVE_KEY)).toBeNull();
      expect(screen.getByRole('heading', { level: 1, name: 'Start your forwarding company' })).toBeInTheDocument();
    });

    it('a tap on Play again during the cross-fade keeps the save', () => {
      playToTheEnd(lastDayBeforeBankruptcy);
      advance(1800);
      expect(fireEvent.click(screen.getByRole('button', { name: 'Play again' }))).toBe(false);
      expect(localStorage.getItem(SAVE_KEY)).not.toBeNull();
      expect(endHeading(BANKRUPT)).toBeInTheDocument();
      expect(board()).toBeNull();
    });

    it('a key used to skip is swallowed', () => {
      playToTheEnd(lastDayOfTheRun);
      const seen = vi.fn();
      document.body.addEventListener('keydown', seen);
      expect(fireEvent.keyDown(document.body, { key: 'Enter' })).toBe(false);
      expect(seen).not.toHaveBeenCalled();
      expect(endHeading(COMPLETED)).toBeInTheDocument();
      document.body.removeEventListener('keydown', seen);
    });

    it('a bankruptcy gets the Closed stamp, not fireworks, for 1.8 s', () => {
      playToTheEnd(lastDayBeforeBankruptcy);
      expect(board()).toHaveAttribute('inert');
      expect(screen.getByText('Closed')).toBeInTheDocument();
      expect(document.querySelector('.fx-burst')).toBeNull();
      expect(screen.queryByText('10 years in business!')).not.toBeInTheDocument();
      expect(screen.getByText('Company closed')).toHaveAttribute('role', 'status');

      advance(1799);
      expect(endHeading(BANKRUPT)).not.toBeInTheDocument();
      advance(1);
      expect(endHeading(BANKRUPT)).toBeInTheDocument();
      advance(600);
      expect(board()).toBeNull();
    });

    it('a key press skips straight to the end screen', () => {
      playToTheEnd(lastDayOfTheRun);
      fireEvent.keyDown(document, { key: 'x', code: 'KeyX' });

      const heading = endHeading(COMPLETED);
      expect(heading).toBeInTheDocument();
      expect(board()).toBeNull();
      expect(screen.queryByText('10 years in business!')).not.toBeInTheDocument();
      expect(document.activeElement).toBe(heading);
    });

    it('a click skips straight to the end screen', () => {
      playToTheEnd(lastDayBeforeBankruptcy);
      fireEvent.click(screen.getByText('Closed'));

      expect(endHeading(BANKRUPT)).toBeInTheDocument();
      expect(board()).toBeNull();
    });

    it('with reduced motion, shows the caption still, without fireworks, and fades in 300 ms', () => {
      stubMedia([REDUCED]);
      playToTheEnd(lastDayOfTheRun);
      expect(screen.getByText('10 years in business!')).toBeInTheDocument();
      expect(document.querySelector('.fx-burst')).toBeNull();

      advance(2500);
      expect(endHeading(COMPLETED)).toBeInTheDocument();
      advance(299);
      expect(board()).not.toBeNull();
      advance(1);
      expect(board()).toBeNull();
    });

    it('with reduced motion, the Closed stamp stays still', () => {
      stubMedia([REDUCED]);
      playToTheEnd(lastDayBeforeBankruptcy);
      expect(screen.getByText('Closed').closest('.end-fx')).toHaveClass('is-still');
    });
  });
});
