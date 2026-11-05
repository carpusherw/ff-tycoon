import { createGame } from '../rules/newGame';
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
