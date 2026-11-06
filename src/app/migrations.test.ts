import { AGENT_NAMES } from '../rules/names';
import { createGame } from '../rules/newGame';
import { CURRENT_SAVE_VERSION, migrateSave, migrations } from './migrations';
import { isValidSave } from './validateSave';

type SaveRecord = Record<string, any>;

const newGame = () => createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
const asJson = (v: unknown) => JSON.parse(JSON.stringify(v)) as SaveRecord;

/** The frozen version-1 saves, by file name. */
const v1Saves = Object.entries(
  import.meta.glob<string>('./__fixtures__/saves/v1/*.json', { eager: true, query: '?raw', import: 'default' }),
).map(([path, raw]) => [path.replace('./__fixtures__/saves/v1/', ''), JSON.parse(raw) as SaveRecord] as const);
const v1NewGame = () => structuredClone(v1Saves.find(([name]) => name === 'day-0000-new-game.json')![1]);

/** What `migrateSave` makes of `raw`, which must succeed. */
function migrated(raw: unknown): SaveRecord {
  const result = migrateSave(structuredClone(raw));
  if (!result.ok) throw new Error(result.reason);
  return result.state as SaveRecord;
}

describe('migrateSave', () => {
  it('the current version is 2, a new game has it, and version 1 has an upgrade step', () => {
    expect(CURRENT_SAVE_VERSION).toBe(2);
    expect(newGame().version).toBe(CURRENT_SAVE_VERSION);
    expect(Object.keys(migrations)).toEqual(['1']);
  });

  it('passes a current save through unchanged', () => {
    const s = asJson(newGame());
    expect(migrateSave(structuredClone(s))).toEqual({ ok: true, state: s });
  });

  it.each<[string, unknown]>([
    ['null', null],
    ['an array', []],
    ['a number', 1],
    ['no version', { day: 3 }],
    ['a text version', { version: '1' }],
    ['a fractional version', { version: 1.5 }],
    ['version 0', { version: 0 }],
  ])('rejects %s', (_name, raw) => {
    expect(migrateSave(raw)).toEqual({ ok: false, reason: expect.any(String) });
  });

  it('rejects a save made by a newer version', () => {
    const result = migrateSave({ ...asJson(newGame()), version: CURRENT_SAVE_VERSION + 1 });
    expect(result).toEqual({ ok: false, reason: expect.stringMatching(/newer version/) });
  });

  it('a save claiming version 3 is refused as newer', () => {
    expect(migrateSave({ ...asJson(newGame()), version: 3 })).toEqual({
      ok: false,
      reason: expect.stringMatching(/newer version \(save version 3\)/),
    });
  });

  describe('the upgrade chain', () => {
    const calls: string[] = [];
    const chain = {
      current: 3,
      steps: {
        1: (s: Record<string, unknown>) => {
          calls.push('1→2');
          return { ...s, a: 'added in 2' };
        },
        2: (s: Record<string, unknown>) => {
          calls.push('2→3');
          return { ...s, b: `${String(s.a)}, then 3` };
        },
      },
      normalize: {
        1: (s: Record<string, unknown>) => {
          calls.push('fix 1');
          return s;
        },
      },
    };
    beforeEach(() => (calls.length = 0));

    it('runs each step in order from the save version to the current one, stamping each new version', () => {
      expect(migrateSave({ version: 1, day: 7 }, chain)).toEqual({
        ok: true,
        state: { version: 3, day: 7, a: 'added in 2', b: 'added in 2, then 3' },
      });
      expect(calls).toEqual(['fix 1', '1→2', '2→3']);
    });

    it('starts from the save version, so a version-2 save skips the first step and its fixes', () => {
      expect(migrateSave({ version: 2, a: 'x' }, chain)).toEqual({ ok: true, state: { version: 3, a: 'x', b: 'x, then 3' } });
      expect(calls).toEqual(['2→3']);
    });

    it('fails when a step is missing', () => {
      expect(migrateSave({ version: 1 }, { ...chain, steps: { 2: chain.steps[2] } })).toEqual({
        ok: false,
        reason: expect.stringMatching(/version 1/),
      });
    });

    it('fails, instead of throwing, when a step throws or returns something that is not a save', () => {
      const throws = { ...chain, steps: { ...chain.steps, 1: () => { throw new Error('boom'); } } };
      expect(migrateSave({ version: 1 }, throws)).toEqual({ ok: false, reason: expect.any(String) });
      const returnsNull = { ...chain, steps: { ...chain.steps, 1: () => null } };
      expect(migrateSave({ version: 1 }, returnsNull)).toEqual({ ok: false, reason: expect.any(String) });
    });
  });

  describe('version 1 fixes', () => {
    it('cancels a hiring session saved before hired slots existed, keeping the rest of the game', () => {
      const v1 = v1NewGame();
      const old = { ...v1, hiring: { officeId: 'o1', dept: 'ops', candidates: [] } };
      expect(migrateSave(old)).toEqual({ ok: true, state: migrated(v1) });
    });

    it.each<[string, SaveRecord]>([
      ['an unknown department', { officeId: 'o1', dept: 'marketing', candidates: [] }],
      ['a null candidate', { officeId: 'o1', dept: 'ops', candidates: [null] }],
      ['a candidate without a salary', { officeId: 'o1', dept: 'ops', candidates: [{ candidateId: 'c1', name: 'Mei', speed: 1, capacity: 2, winRate: 0 }] }],
      ['a candidate with a NaN speed', { officeId: 'o1', dept: 'ops', candidates: [{ candidateId: 'c1', name: 'Mei', salary: 3000, speed: NaN, capacity: 2, winRate: 0 }] }],
    ])('leaves a pre-slots session with %s for validation to reject', (_name, hiring) => {
      const old = { ...v1NewGame(), hiring };
      expect(migrateSave(old)).toEqual({ ok: true, state: { ...migrated(v1NewGame()), hiring } });
      expect(isValidSave(migrated(old))).toBe(false);
    });

    it('cancels a pre-slots session whose candidates are all well formed', () => {
      const v1 = v1NewGame();
      const candidate = { candidateId: 'c1', name: 'Mei', salary: 3000, speed: 1.1, capacity: 3, winRate: 0 };
      const old = { ...v1, hiring: { officeId: 'o1', dept: 'ops', candidates: [candidate] } };
      expect(migrateSave(old)).toEqual({ ok: true, state: migrated(v1) });
    });

    it('a v1 hiring session from before slots still gets cancelled before the step', () => {
      const [, v1] = v1Saves.find(([name]) => name === 'day-0150-hiring-open.json')!;
      const old = structuredClone(v1);
      delete old.hiring.hired;
      const step = vi.spyOn(migrations, 1);
      try {
        const loaded = migrated(old);
        expect(step).toHaveBeenCalledTimes(1);
        expect(step.mock.calls[0][0].hiring).toBeNull();
        expect(loaded).toEqual({ ...migrated(v1), hiring: null });
        expect(isValidSave(loaded)).toBe(true);
      } finally {
        step.mockRestore();
      }
    });
  });

  describe('version 1 to 2', () => {
    it.each(v1Saves)('v1 → v2 names every agent and keeps the rest (%s)', (_name, v1) => {
      const v2 = migrated(v1);
      expect(v2.version).toBe(2);
      expect(isValidSave(v2)).toBe(true);

      expect(v2.agents).toEqual(
        v1.agents.map((a: SaveRecord, i: number) => ({ ...a, name: AGENT_NAMES[i % AGENT_NAMES.length], signedDay: 0 })),
      );
      const names = v2.agents.map((a: SaveRecord) => a.name);
      expect(names.every((n: unknown) => typeof n === 'string' && n !== '')).toBe(true);
      expect(new Set(names).size).toBe(names.length);

      expect(v2.shipments).toEqual(
        v1.shipments.map((sh: SaveRecord) => ({ ...sh, kind: 'sale', localCharges: 0, chargesPaid: false })),
      );
      expect(v2.yearTotals).toEqual({ ...v1.yearTotals, expansion: 0 });
      expect(v2.yearReports).toEqual(v1.yearReports.map((r: SaveRecord) => ({ ...r, expansion: 0 })));
      for (const key of ['tasks', 'cash', 'day', 'rngState', 'nextId', 'seed', 'offices', 'employees', 'customers', 'hiring', 'log', 'stats', 'yearStart', 'pauseReasons', 'ended']) {
        expect(v2[key], key).toEqual(v1[key]);
      }
    });

    it('does not change the save it is given', () => {
      const v1 = structuredClone(v1Saves.find(([name]) => name === 'day-2000-late-game.json')![1]);
      const before = structuredClone(v1);
      migrations[1](v1);
      expect(v1).toEqual(before);
    });

    it('names agents past the end of the list by wrapping around it', () => {
      const v1 = v1NewGame();
      v1.agents = Array.from({ length: AGENT_NAMES.length + 1 }, (_, i) => ({ id: `a${i}`, portId: 'LAX', regionId: 'US-W' }));
      const v2 = migrations[1](v1) as SaveRecord;
      expect(v2.agents[AGENT_NAMES.length].name).toBe(AGENT_NAMES[0]);
    });
  });
});
