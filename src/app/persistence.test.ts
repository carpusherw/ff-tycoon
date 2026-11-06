import { createGame } from '../rules/newGame';
import { pruneState } from '../rules/prune';
import { hireCandidate, startHiring } from '../rules/staff';
import { stepDay } from '../rules/step';
import type { GameState } from '../rules/types';
import { CURRENT_SAVE_VERSION } from './migrations';
import {
  BACKUP_KEY,
  clearGame,
  getStorage,
  loadGame,
  loadSettings,
  readSave,
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

  it('always saves at the current save version', () => {
    const storage = fakeStorage();
    expect(saveGame(storage, { ...newGame(), version: 0 } as unknown as GameState)).toBe(true);
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).version).toBe(CURRENT_SAVE_VERSION);
  });

  describe('a stored save that cannot be loaded is backed up before anything can overwrite it', () => {
    const newer = () => JSON.stringify({ ...newGame(), version: CURRENT_SAVE_VERSION + 1 });

    it.each<[string, () => string]>([
      ['corrupt JSON', () => '{not json'],
      ['JSON that is not a save', () => 'null'],
      ['a save that fails validation', () => JSON.stringify({ ...newGame(), cash: 'lots' })],
      ['a save made by a newer version', newer],
      ['an old-format hiring session with a null candidate', () =>
        JSON.stringify({ ...newGame(), hiring: { officeId: 'o1', dept: 'ops', candidates: [null] } })],
    ])('%s: the exact raw text is copied to the backup slot', (_name, raw) => {
      const storage = fakeStorage();
      const text = raw();
      storage.setItem(SAVE_KEY, text);
      expect(readSave(storage)).toEqual({ kind: 'unreadable', backedUp: true });
      expect(storage.getItem(BACKUP_KEY)).toBe(text);
      expect(storage.getItem(SAVE_KEY)).toBe(text);
      expect(loadGame(storage)).toBeNull();
    });

    it('keeps only the latest backup', () => {
      const storage = fakeStorage();
      storage.setItem(SAVE_KEY, '{first');
      readSave(storage);
      storage.setItem(SAVE_KEY, '{second');
      readSave(storage);
      expect(storage.getItem(BACKUP_KEY)).toBe('{second');
      expect(storage.length).toBe(2);
    });

    it('a good save or no save writes no backup, and leaves an earlier backup alone', () => {
      const storage = fakeStorage();
      expect(readSave(storage)).toEqual({ kind: 'none' });
      expect(storage.getItem(BACKUP_KEY)).toBeNull();
      storage.setItem(BACKUP_KEY, '{older');
      const s = newGame();
      saveGame(storage, s);
      expect(readSave(storage)).toEqual({ kind: 'loaded', state: s });
      expect(storage.getItem(BACKUP_KEY)).toBe('{older');
    });

    it('reports when the backup could not be written, without throwing', () => {
      const storage = fakeStorage();
      storage.setItem(SAVE_KEY, '{not json');
      storage.setItem = () => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      };
      expect(readSave(storage)).toEqual({ kind: 'unreadable', backedUp: false });
      expect(readSave(null)).toEqual({ kind: 'none' });
    });
  });

  it('round-trips a stepped game', () => {
    const storage = fakeStorage();
    const s = steppedGame();
    expect(saveGame(storage, s)).toBe(true);
    expect(loadGame(storage)).toEqual(s);
  });

  it('round-trips a partly hired session with its slots', () => {
    const storage = fakeStorage();
    const s = steppedGame();
    hireCandidate(s, s.hiring!.candidates[1].candidateId);
    expect(s.hiring!.hired).toHaveLength(1);
    expect(saveGame(storage, s)).toBe(true);
    expect(loadGame(storage)?.hiring).toEqual(s.hiring);
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
    ['a hired slot without its position', (s) => (s.hiring.hired = [{ name: 'Mei', employeeId: 'e9' }])],
  ])('rejects a save with corrupted nested state: %s', (_name, corrupt) => {
    const storage = fakeStorage();
    const s = structuredClone(steppedGame()) as unknown as Record<string, any>;
    corrupt(s);
    storage.setItem(SAVE_KEY, JSON.stringify(s));
    expect(loadGame(storage)).toBeNull();
  });

  describe('a save from before hired slots existed (pre fix round 1)', () => {
    /** The pre-fix format: the session has only `candidates`, no `hired`. */
    function preFixSave(hiresBeforeSave: number) {
      const s = steppedGame();
      for (let i = 0; i < hiresBeforeSave; i++) hireCandidate(s, s.hiring!.candidates[0].candidateId);
      const old = structuredClone(s) as unknown as Record<string, any>;
      delete old.hiring.hired;
      expect(Object.keys(old.hiring).sort()).toEqual(['candidates', 'dept', 'officeId']);
      return { s, old };
    }

    it.each([0, 1])('loads with the open session cancelled and everything else intact (%i hired)', (hires) => {
      const storage = fakeStorage();
      const { s, old } = preFixSave(hires);
      storage.setItem(SAVE_KEY, JSON.stringify(old));
      const loaded = loadGame(storage);
      expect(loaded).not.toBeNull();
      expect(loaded!.hiring).toBeNull();
      expect(loaded).toEqual({ ...s, hiring: null });
    });

    it('still rejects a pre-fix session that is itself corrupt', () => {
      const storage = fakeStorage();
      const { old } = preFixSave(0);
      old.hiring.dept = 'marketing';
      storage.setItem(SAVE_KEY, JSON.stringify(old));
      expect(loadGame(storage)).toBeNull();
    });
  });

  describe('hiring session invariants', () => {
    /** A game with a session where the candidate in roll slot 1 is hired: candidates [0, 2], hired at 1. */
    function partlyHired() {
      const s = steppedGame();
      hireCandidate(s, s.hiring!.candidates[1].candidateId);
      expect(s.hiring!.hired.map((h) => h.slot)).toEqual([1]);
      return structuredClone(s) as unknown as Record<string, any>;
    }

    it('accepts a partly hired session and a session with two hires', () => {
      const storage = fakeStorage();
      const s = partlyHired();
      storage.setItem(SAVE_KEY, JSON.stringify(s));
      expect(loadGame(storage)?.hiring).toEqual(s.hiring);
      const two = steppedGame();
      hireCandidate(two, two.hiring!.candidates[2].candidateId);
      hireCandidate(two, two.hiring!.candidates[0].candidateId);
      expect(two.hiring!.hired.map((h) => h.slot)).toEqual([2, 0]);
      storage.setItem(SAVE_KEY, JSON.stringify(two));
      expect(loadGame(storage)?.hiring).toEqual(two.hiring);
    });

    it('accepts a session with every slot hired (it stays open for a re-roll)', () => {
      const storage = fakeStorage();
      const s = steppedGame();
      for (const c of [...s.hiring!.candidates]) hireCandidate(s, c.candidateId);
      expect(s.hiring!.candidates).toEqual([]);
      storage.setItem(SAVE_KEY, JSON.stringify(s));
      expect(loadGame(storage)?.hiring).toEqual(s.hiring);
    });

    it.each<[string, (s: Record<string, any>) => void]>([
      ['a negative slot', (s) => (s.hiring.hired[0].slot = -1)],
      ['a fractional slot', (s) => (s.hiring.hired[0].slot = 0.5)],
      ['a slot past the roll', (s) => (s.hiring.hired[0].slot = 3)],
      ['two hires in the same slot', (s) => {
        s.hiring.hired.push({ ...s.hiring.hired[0], employeeId: s.employees[0].id });
        s.hiring.candidates.pop();
      }],
      ['too few slots in total', (s) => s.hiring.candidates.pop()],
      ['too many slots in total', (s) => s.hiring.candidates.push({ ...s.hiring.candidates[0], candidateId: 'c999' })],
      ['a fresh roll one candidate short', (s) => {
        s.hiring.hired = [];
        s.hiring.candidates = s.hiring.candidates.slice(0, 2);
      }],
      ['a hire pointing at no employee', (s) => (s.hiring.hired[0].employeeId = 'e999')],
    ])('rejects %s', (_name, corrupt) => {
      const storage = fakeStorage();
      const s = partlyHired();
      corrupt(s);
      storage.setItem(SAVE_KEY, JSON.stringify(s));
      expect(loadGame(storage)).toBeNull();
    });
  });

  describe('links between records', () => {
    /** A stepped game where every kind of link is in use, as a plain save object. */
    function linked() {
      const s = steppedGame();
      const ops = s.employees.length;
      hireCandidate(s, s.hiring!.candidates[0].candidateId);
      expect(s.employees).toHaveLength(ops + 1);
      expect(s.tasks.some((t) => t.assigneeId !== null)).toBe(true);
      return structuredClone(s) as unknown as Record<string, any>;
    }

    it('accepts a game where every link points at a record', () => {
      const storage = fakeStorage();
      storage.setItem(SAVE_KEY, JSON.stringify(linked()));
      expect(loadGame(storage)).not.toBeNull();
    });

    it("accepts a lost quote whose prospect is already gone (it's pruned at the month end)", () => {
      const storage = fakeStorage();
      const s = linked();
      s.shipments[0].status = 'lost';
      s.shipments[0].customerId = 'c999';
      s.tasks = s.tasks.filter((t: { shipmentId: string }) => t.shipmentId !== s.shipments[0].id);
      storage.setItem(SAVE_KEY, JSON.stringify(s));
      expect(loadGame(storage)).not.toBeNull();
    });

    it.each<[string, (s: Record<string, any>) => void]>([
      ['a task pointing at no shipment', (s) => (s.tasks[0].shipmentId = 'sh999')],
      ['a task in no office', (s) => (s.tasks[0].officeId = 'o999')],
      ['a task assigned to no employee', (s) => (s.tasks[0].assigneeId = 'e999')],
      ['a shipment under way for no customer', (s) => {
        const sh = s.shipments.find((x: { status: string }) => x.status !== 'done' && x.status !== 'lost');
        sh.customerId = 'c999';
      }],
      ['a shipment sold by no office', (s) => (s.shipments[0].sellingOfficeId = 'o999')],
      ['a shipment end at no office', (s) => (s.shipments[0].origin = { kind: 'office', officeId: 'o999' })],
      ['a shipment end at no agent', (s) => (s.shipments[0].destination = { kind: 'agent', agentId: 'a999' })],
      ['an employee in no office', (s) => (s.employees[0].officeId = 'o999')],
      ['a customer of no office', (s) => (s.customers[0].officeId = 'o999')],
      ['a hiring session for no office', (s) => (s.hiring.officeId = 'o999')],
      ['two shipments with one id', (s) => (s.shipments[1].id = s.shipments[0].id)],
      ['two employees with one id', (s) => (s.employees[1].id = s.employees[0].id)],
    ])('rejects %s', (_name, corrupt) => {
      const storage = fakeStorage();
      const s = linked();
      corrupt(s);
      storage.setItem(SAVE_KEY, JSON.stringify(s));
      expect(loadGame(storage)).toBeNull();
    });

    it('a ten-year run stays loadable at every month end', () => {
      const s = newGame();
      s.cash = 1_000_000;
      for (const dept of ['sales', 'ops', 'accounting'] as const) {
        startHiring(s, s.offices[0].id, dept);
        hireCandidate(s, s.hiring!.candidates[0].candidateId);
        s.hiring = null;
      }
      const storage = fakeStorage();
      for (let day = 1; day <= 3600; day++) {
        stepDay(s);
        if (day % 30 !== 0) continue;
        storage.setItem(SAVE_KEY, JSON.stringify(s));
        expect(loadGame(storage), `day ${day}`).not.toBeNull();
      }
    });
  });

  it('round-trips a game with year reports', () => {
    const storage = fakeStorage();
    const s = newGame();
    s.cash = 1_000_000;
    s.yearStart.cash = s.cash;
    // A month end, which has just pruned, so loading has nothing left to drop.
    for (let i = 0; i < 390; i++) stepDay(s);
    expect(s.yearReports).toHaveLength(1);
    expect(saveGame(storage, s)).toBe(true);
    expect(loadGame(storage)).toEqual(s);
  });

  it('loading prunes finished shipments and history older than a year from a save written before pruning', () => {
    const storage = fakeStorage();
    const s = newGame();
    s.cash = 1_000_000;
    for (let i = 0; i < 400; i++) stepDay(s);
    // What a save from before pruning still carries: finished shipments and payments from long ago.
    const template = s.shipments[0];
    s.shipments.unshift({ ...template, id: 'sh-old-done', status: 'done' }, { ...template, id: 'sh-old-lost', status: 'lost' });
    s.stats.revenue.unshift({ day: 3, amount: 900 });
    s.stats.deliveredDays.unshift(3);
    s.customers.find((c) => c.status === 'active')!.payments.unshift({ day: 3, amount: 900 });
    expect(saveGame(storage, s)).toBe(true);

    const loaded = loadGame(storage)!;
    const expected = structuredClone(s);
    pruneState(expected);
    expect(loaded).toEqual(expected);
    expect(loaded.shipments.some((sh) => sh.status === 'done' || sh.status === 'lost')).toBe(false);
    expect(loaded.stats.revenue.some((r) => r.day === 3)).toBe(false);
    expect(loaded.shipments.length).toBeLessThan(s.shipments.length);
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

  describe('getStorage', () => {
    const quotaError = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
    afterEach(() => {
      vi.restoreAllMocks();
      localStorage.clear();
    });

    it('returns localStorage when it can be written to', () => {
      expect(getStorage()).toBe(localStorage);
      expect(localStorage.length).toBe(0);
    });

    it('still returns a full storage for reading, so the save can be continued, and saving reports false', () => {
      const s = newGame();
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(quotaError);
      const storage = getStorage();
      expect(storage).toBe(localStorage);
      expect(loadGame(storage)).toEqual(s);
      expect(saveGame(storage, s)).toBe(false);
    });

    it('returns null when storage can be neither written nor read', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(quotaError);
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(quotaError);
      expect(getStorage()).toBeNull();
    });
  });
});
