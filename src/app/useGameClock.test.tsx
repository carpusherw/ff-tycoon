import { act, renderHook } from '@testing-library/react';
import { B } from '../rules/balance';
import { createGame } from '../rules/newGame';
import type { GameState } from '../rules/types';
import { getStorage, loadGame, type Settings } from './persistence';
import { createGameStore, type GameStore } from './store';
import { useGameClock } from './useGameClock';

const settings = (autoPause: boolean): Settings => ({ lang: 'en', theme: 'system', autoPause });

function gameOnDay(day: number, cash = 1_000_000): GameState {
  const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
  s.day = day;
  s.cash = cash;
  return s;
}

function mount(store: GameStore, autoPause: boolean) {
  return renderHook(() => useGameClock(store, settings(autoPause)));
}

/** Lets real time pass in small ticks, as a running browser would. */
function run(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('useGameClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at 1×', () => {
    const { result, unmount } = mount(createGameStore(gameOnDay(0)), true);
    expect(result.current.speed).toBe(1);
    run(B.dayMs * 2);
    unmount();
  });

  it("with auto-pause off, a year end doesn't stop the clock", () => {
    const store = createGameStore(gameOnDay(359));
    const { result, unmount } = mount(store, false);

    run(B.dayMs + B.clock.tickMs);
    expect(store.getState().day).toBeGreaterThanOrEqual(360);
    expect(store.getState().pauseReasons).toContain('yearEnd');
    expect(result.current.speed).toBe(1);

    const day = store.getState().day;
    run(B.dayMs * 3);
    expect(store.getState().day).toBeGreaterThan(day);
    unmount();
  });

  it('bankruptcy stops the clock even with auto-pause off', () => {
    const store = createGameStore(gameOnDay(29, -1_000_000));
    const { result, unmount } = mount(store, false);

    run(B.dayMs + B.clock.tickMs);
    expect(store.getState().ended?.reason).toBe('bankrupt');
    expect(result.current.speed).toBe(0);
    unmount();
  });

  it('with auto-pause on, a year end stops the clock on that day, even at 3×', () => {
    const store = createGameStore(gameOnDay(359));
    const { result, unmount } = mount(store, true);
    act(() => result.current.setSpeed(3));

    run(1000);
    expect(store.getState().day).toBe(360);
    expect(result.current.speed).toBe(0);
    run(1000);
    expect(store.getState().day).toBe(360);
    unmount();
  });

  it('resume clears the pause reasons and plays at the speed from before the year end', () => {
    const store = createGameStore(gameOnDay(359));
    const { result, unmount } = mount(store, true);
    act(() => result.current.setSpeed(5));
    run(B.dayMs + B.clock.tickMs);
    expect(store.getState().day).toBe(360);
    expect(result.current.speed).toBe(0);

    act(() => result.current.resume());
    expect(store.getState().pauseReasons).toEqual([]);
    expect(result.current.speed).toBe(5);
    run(B.dayMs * 2);
    expect(store.getState().day).toBeGreaterThan(360);
    unmount();
  });

  it('resume after pressing Pause plays at the speed from before', () => {
    const { result, unmount } = mount(createGameStore(gameOnDay(1)), true);
    act(() => result.current.setSpeed(3));
    act(() => result.current.setSpeed(0));
    act(() => result.current.resume());
    expect(result.current.speed).toBe(3);
    unmount();
  });

  it('resume on a freshly loaded paused save plays at 1×', () => {
    const s = gameOnDay(360);
    s.pauseReasons = ['yearEnd'];
    const { result, unmount } = mount(createGameStore(s), true);
    expect(result.current.speed).toBe(0);
    act(() => result.current.resume());
    expect(result.current.speed).toBe(1);
    unmount();
  });

  it('resume during a hold brings back the speed from before the pause once the hold ends', () => {
    const store = createGameStore(gameOnDay(359));
    const { result, unmount } = mount(store, true);
    act(() => result.current.setSpeed(3));
    run(B.dayMs + B.clock.tickMs);
    expect(result.current.speed).toBe(0);

    let restore = () => {};
    act(() => {
      restore = result.current.pauseFor('hiring');
    });
    act(() => result.current.resume());
    expect(result.current.speed).toBe(0);
    act(() => restore());
    expect(result.current.speed).toBe(3);
    unmount();
  });

  it('pauseFor pauses until its restore function runs, then brings back the previous speed', () => {
    const store = createGameStore(gameOnDay(0));
    const { result, unmount } = mount(store, true);
    act(() => result.current.setSpeed(3));

    let restore = () => {};
    act(() => {
      restore = result.current.pauseFor('hiring');
    });
    expect(result.current.speed).toBe(0);
    const day = store.getState().day;
    run(1000);
    expect(store.getState().day).toBe(day);

    act(() => restore());
    expect(result.current.speed).toBe(3);
    act(() => restore());
    expect(result.current.speed).toBe(3);
    unmount();
  });

  it('setSpeed cannot restart a clock stopped by a pause reason; only resume can', () => {
    const s = gameOnDay(360);
    s.pauseReasons = ['yearEnd'];
    const store = createGameStore(s);
    const { result, unmount } = mount(store, true);
    expect(result.current.locked).toBe(true);

    act(() => result.current.setSpeed(3));
    expect(result.current.speed).toBe(0);
    run(1000);
    expect(store.getState().day).toBe(360);

    act(() => result.current.resume());
    expect(result.current.locked).toBe(false);
    act(() => result.current.setSpeed(3));
    expect(result.current.speed).toBe(3);
    unmount();
  });

  it('5× plays five days per dayMs, is refused during a year-end pause and comes back after a hold', () => {
    const s = gameOnDay(360);
    s.pauseReasons = ['yearEnd'];
    const store = createGameStore(s);
    const { result, unmount } = mount(store, true);
    act(() => result.current.setSpeed(5));
    expect(result.current.speed).toBe(0);

    act(() => result.current.resume());
    act(() => result.current.setSpeed(5));
    expect(result.current.speed).toBe(5);
    run(B.dayMs * 2);
    expect(store.getState().day).toBe(370);

    let restore = () => {};
    act(() => {
      restore = result.current.pauseFor('hiring');
    });
    act(() => result.current.setSpeed(5));
    expect(result.current.speed).toBe(0);
    act(() => restore());
    expect(result.current.speed).toBe(5);
    unmount();
  });

  it("with auto-pause off, a year-end reason doesn't lock the speed", () => {
    const s = gameOnDay(360);
    s.pauseReasons = ['yearEnd'];
    const { result, unmount } = mount(createGameStore(s), false);
    expect(result.current.locked).toBe(false);
    act(() => result.current.setSpeed(3));
    expect(result.current.speed).toBe(3);
    unmount();
  });

  it('setSpeed cannot restart the clock during a pauseFor hold', () => {
    const store = createGameStore(gameOnDay(0));
    const { result, unmount } = mount(store, true);
    act(() => result.current.setSpeed(3));

    let restore = () => {};
    act(() => {
      restore = result.current.pauseFor('hiring');
    });
    expect(result.current.locked).toBe(true);
    act(() => result.current.setSpeed(1));
    expect(result.current.speed).toBe(0);
    const day = store.getState().day;
    run(1000);
    expect(store.getState().day).toBe(day);

    act(() => restore());
    expect(result.current.locked).toBe(false);
    expect(result.current.speed).toBe(3);
    unmount();
  });

  it('resume during a hold clears the reasons but waits for the hold to end', () => {
    const s = gameOnDay(360);
    s.pauseReasons = ['yearEnd'];
    const store = createGameStore(s);
    const { result, unmount } = mount(store, true);

    let restore = () => {};
    act(() => {
      restore = result.current.pauseFor('hiring');
    });
    act(() => result.current.resume());
    expect(store.getState().pauseReasons).toEqual([]);
    expect(result.current.speed).toBe(0);

    act(() => restore());
    expect(result.current.speed).toBe(1);
    unmount();
  });

  it('saves when the in-game month changes', () => {
    const store = createGameStore(gameOnDay(28));
    const { unmount } = mount(store, false);

    run(B.dayMs + B.clock.tickMs);
    expect(store.getState().day).toBe(29);
    expect(loadGame(getStorage())).toBeNull();

    run(B.dayMs);
    expect(store.getState().day).toBe(30);
    expect(loadGame(getStorage())).toEqual(store.getState());
    unmount();
  });

  it('saves when the tab is hidden', () => {
    const store = createGameStore(gameOnDay(3));
    const { unmount } = mount(store, false);
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    try {
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(loadGame(getStorage())).toEqual(store.getState());
    } finally {
      visibility.mockRestore();
      unmount();
    }
  });
});
