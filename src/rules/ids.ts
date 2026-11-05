import type { GameState } from './types';

export function newId(s: GameState, prefix: string): string {
  const id = `${prefix}${s.nextId}`;
  s.nextId += 1;
  return id;
}
