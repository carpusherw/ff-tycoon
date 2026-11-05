import { createGame } from '../rules/newGame';
import { CURRENT_SAVE_VERSION, migrateSave, migrations } from './migrations';

const newGame = () => createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
const asJson = (v: unknown) => JSON.parse(JSON.stringify(v)) as Record<string, unknown>;

describe('migrateSave', () => {
  it('the current version is 1, a new game has it, and no upgrade step exists yet', () => {
    expect(CURRENT_SAVE_VERSION).toBe(1);
    expect(newGame().version).toBe(CURRENT_SAVE_VERSION);
    expect(Object.keys(migrations)).toEqual([]);
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
      const s = asJson(newGame());
      const old = { ...s, hiring: { officeId: 'o1', dept: 'ops', candidates: [] } };
      expect(migrateSave(old)).toEqual({ ok: true, state: { ...s, hiring: null } });
    });

    it('leaves a pre-slots session that is itself corrupt for validation to reject', () => {
      const old = { ...asJson(newGame()), hiring: { officeId: 'o1', dept: 'marketing', candidates: [] } };
      expect(migrateSave(structuredClone(old))).toEqual({ ok: true, state: old });
    });
  });
});
