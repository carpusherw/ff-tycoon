import { act, renderHook } from '@testing-library/react';
import { createGame } from '../rules/newGame';
import { createGameStore, useGameState } from './store';

const newGame = () => createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });

describe('game store', () => {
  it('update produces a new object and notifies', () => {
    const store = createGameStore(newGame());
    const before = store.getState();
    const listener = vi.fn();
    store.subscribe(listener);

    store.update((s) => {
      s.cash += 100;
    });

    expect(store.getState()).not.toBe(before);
    expect(store.getState().cash).toBe(before.cash + 100);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("the mutator can't touch the previous state", () => {
    const store = createGameStore(newGame());
    const before = store.getState();
    const snapshot = structuredClone(before);

    store.update((s) => {
      s.cash = 0;
      s.day = 99;
      s.pauseReasons.push('yearEnd');
      s.employees[0].capacity = 42;
    });

    expect(before).toEqual(snapshot);
  });

  it('replace swaps the state and unsubscribe stops notifications', () => {
    const store = createGameStore(newGame());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const other = createGame({ seed: 2, homePortId: 'TPE', mode: 'normal' });

    store.replace(other);
    expect(store.getState()).toBe(other);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.update((s) => {
      s.cash += 1;
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('useGameState accepts a selector that builds a new object, and re-renders on change', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const store = createGameStore(newGame());
      const start = store.getState().cash;
      const { result } = renderHook(() => useGameState(store, (s) => ({ cash: s.cash })));
      expect(result.current).toEqual({ cash: start });

      act(() => {
        store.update((s) => {
          s.cash += 5;
        });
      });
      expect(result.current).toEqual({ cash: start + 5 });
      expect(errors).not.toHaveBeenCalled();
    } finally {
      errors.mockRestore();
    }
  });
});
