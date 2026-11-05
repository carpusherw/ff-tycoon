import { stepDay } from '../rules/step';
import { CURRENT_SAVE_VERSION } from './migrations';
import { loadGame, SAVE_KEY } from './persistence';
import { isValidSave } from './validateSave';

/**
 * Real saves from every released save version, frozen (see AGENTS.md). Each must keep loading and playing, so a
 * format change that would break players' saves fails here unless it comes with a migration step.
 */
const fixtures = Object.entries(
  import.meta.glob<string>('./__fixtures__/saves/*/*.json', { eager: true, query: '?raw', import: 'default' }),
).map(([path, raw]) => [path.replace('./__fixtures__/saves/', ''), raw] as const);

function storageWith(raw: string): Storage {
  const data = new Map([[SAVE_KEY, raw]]);
  return {
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
}

describe('golden save fixtures', () => {
  it('has fixtures for the current save version, each filed under the version it was saved at', () => {
    const folders = new Set(fixtures.map(([path]) => path.split('/')[0]));
    expect(folders).toContain(`v${CURRENT_SAVE_VERSION}`);
    for (const [path, raw] of fixtures) {
      expect(`v${(JSON.parse(raw) as { version: unknown }).version}`, path).toBe(path.split('/')[0]);
    }
  });

  it.each(fixtures)('%s loads at the current version and plays on for 30 days', (_path, raw) => {
    const s = loadGame(storageWith(raw));
    expect(s).not.toBeNull();
    expect(s!.version).toBe(CURRENT_SAVE_VERSION);
    // As the player pressing Resume on a save paused at a year end.
    s!.pauseReasons = [];
    expect(() => {
      for (let i = 0; i < 30; i++) stepDay(s!);
    }).not.toThrow();
    expect(isValidSave(JSON.parse(JSON.stringify(s)))).toBe(true);
  });
});
