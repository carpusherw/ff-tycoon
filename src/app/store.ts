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
 * Subscribes a component to the state and returns `selector(state)`. React tracks the state object
 * itself, which only changes on update/replace, so the selector may build new objects freely.
 */
export function useGameState<T>(store: GameStore, selector: (s: GameState) => T): T {
  return selector(useSyncExternalStore(store.subscribe, store.getState));
}
