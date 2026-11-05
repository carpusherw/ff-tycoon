import type { GameStore } from '../app/store';
import type { GameState, Result } from '../rules/types';

/** Runs a player action as a store update and hands back the rule's result. */
export function runAction(store: GameStore, rule: (s: GameState) => Result): Result {
  let result: Result = { ok: true };
  store.update((s) => {
    result = rule(s);
  });
  return result;
}
