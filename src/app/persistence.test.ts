import { createGame } from '../rules/newGame';
import { startHiring } from '../rules/staff';
import { stepDay } from '../rules/step';
import {
  clearGame,
  loadGame,
  loadSettings,
  SAVE_KEY,
  saveGame,
  saveSettings,
  SETTINGS_KEY,
} from './persistence';

function fakeStorage(opts: { setItemThrows?: boolean } = {}): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (opts.setItemThrows) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      data.set(k, String(v));
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
    clear: () => data.clear(),
  };
}

const newGame = () => createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });

/** A game 120 days in with a hiring session open, so every nested part of the state has data. */
function steppedGame() {
  const s = newGame();
  for (let i = 0; i < 120; i++) stepDay(s);
  expect(startHiring(s, s.offices[0].id, 'ops')).toEqual({ ok: true });
  expect(s.tasks.length).toBeGreaterThan(0);
  expect(s.shipments.length).toBeGreaterThan(0);
  return s;
}

function yearOneReport() {
  const s = newGame();
  s.cash = 1_000_000;
  for (let i = 0; i < 360; i++) stepDay(s);
  expect(s.yearReports).toHaveLength(1);
  return s.yearReports[0];
}

describe('persistence', () => {
  it('round-trips a game', () => {
    const storage = fakeStorage();
    const s = newGame();
    expect(saveGame(storage, s)).toBe(true);
    expect(loadGame(storage)).toEqual(s);
    clearGame(storage);
    expect(loadGame(storage)).toBeNull();
  });

  it('returns null for corrupt JSON', () => {
    const storage = fakeStorage();
    storage.setItem(SAVE_KEY, '{not json');
    expect(loadGame(storage)).toBeNull();
    storage.setItem(SAVE_KEY, 'null');
    expect(loadGame(storage)).toBeNull();
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 1 }));
    expect(loadGame(storage)).toBeNull();
  });

  it('round-trips a stepped game', () => {
    const storage = fakeStorage();
    const s = steppedGame();
    expect(saveGame(storage, s)).toBe(true);
    expect(loadGame(storage)).toEqual(s);
  });

  it.each<[string, (s: Record<string, any>) => void]>([
    ['a null task', (s) => (s.tasks = [null])],
    ['empty stats', (s) => (s.stats = {})],
    ['a task in an unknown department', (s) => (s.tasks[0].dept = 'marketing')],
    ['a shipment with an unknown origin kind', (s) => (s.shipments[0].origin = { kind: 'x' })],
    ['NaN cash', (s) => (s.cash = NaN)],
    ['no year reports (a save from before they existed)', (s) => delete s.yearReports],
    ['a year report missing its profit', (s) => (s.yearReports = [{ ...yearOneReport(), profit: undefined }])],
    ['no year-start snapshot', (s) => delete s.yearStart],
    ['no year totals', (s) => delete s.yearTotals],
    ['year totals without hiring costs', (s) => delete s.yearTotals.hiring],
  ])('rejects a save with corrupted nested state: %s', (_name, corrupt) => {
    const storage = fakeStorage();
    const s = structuredClone(steppedGame()) as unknown as Record<string, any>;
    corrupt(s);
    storage.setItem(SAVE_KEY, JSON.stringify(s));
    expect(loadGame(storage)).toBeNull();
  });

  it('round-trips a game with year reports', () => {
    const storage = fakeStorage();
    const s = newGame();
    s.cash = 1_000_000;
    s.yearStart.cash = s.cash;
    for (let i = 0; i < 400; i++) stepDay(s);
    expect(s.yearReports).toHaveLength(1);
    expect(saveGame(storage, s)).toBe(true);
    expect(loadGame(storage)).toEqual(s);
  });

  it('returns null for another version', () => {
    const storage = fakeStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ ...newGame(), version: 2 }));
    expect(loadGame(storage)).toBeNull();
  });

  it('returns null with no storage', () => {
    expect(loadGame(null)).toBeNull();
    expect(loadGame(fakeStorage())).toBeNull();
    expect(saveGame(null, newGame())).toBe(false);
    expect(() => clearGame(null)).not.toThrow();
  });

  it('save reports false when setItem throws (quota)', () => {
    const storage = fakeStorage({ setItemThrows: true });
    expect(saveGame(storage, newGame())).toBe(false);
    expect(saveSettings(storage, { lang: 'en', theme: 'dark', autoPause: false })).toBe(false);
  });

  it('settings default from browser language', () => {
    const expected = { lang: 'zh-Hant', theme: 'system', autoPause: true };
    expect(loadSettings(null, ['zh-TW'])).toEqual(expected);
    expect(loadSettings(fakeStorage(), ['zh-TW'])).toEqual(expected);
  });

  it('invalid stored settings fall back to defaults', () => {
    const storage = fakeStorage();
    const defaults = { lang: 'zh-Hant', theme: 'system', autoPause: true };

    storage.setItem(SETTINGS_KEY, '{not json');
    expect(loadSettings(storage, ['zh-TW'])).toEqual(defaults);

    storage.setItem(SETTINGS_KEY, JSON.stringify({ lang: 'fr', theme: 'purple', autoPause: 'yes' }));
    expect(loadSettings(storage, ['zh-TW'])).toEqual(defaults);

    storage.setItem(SETTINGS_KEY, JSON.stringify({ lang: 'zh-Hans', theme: 42 }));
    expect(loadSettings(storage, ['zh-TW'])).toEqual({ ...defaults, lang: 'zh-Hans' });

    expect(saveSettings(storage, { lang: 'en', theme: 'dark', autoPause: false })).toBe(true);
    expect(loadSettings(storage, ['zh-TW'])).toEqual({ lang: 'en', theme: 'dark', autoPause: false });
  });
});
