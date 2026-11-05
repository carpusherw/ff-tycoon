import { useSyncExternalStore } from 'react';
import type { GameState } from '../rules/types';

export interface GameStore {
  getState(): GameState;
  /** Runs `mutator` on a deep copy of the state, swaps the copy in and notifies subscribers. */
  update(mutator: (draft: GameState) => void): void;
  replace(s: GameState): void;
  subscribe(fn: () => void): () => void;
}

export function createGameStore(initial: GameState): GameStore {
  let state = initial;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const fn of [...listeners]) fn();
  };
  return {
    getState: () => state,
    update(mutator) {
      const draft = structuredClone(state);
      mutator(draft);
      state = draft;
      notify();
    },
    replace(s) {
      state = s;
      notify();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}

/**
 * Subscribes a component to part of the state. The selector must return a value that stays the
 * same (`Object.is`) while the state doesn't change: a primitive or an existing part of the state.
 */
export function useGameState<T>(store: GameStore, selector: (s: GameState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}
