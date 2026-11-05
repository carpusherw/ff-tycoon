import { DEPTS, type Candidate } from '../rules/types';

/**
 * The format of the saved game. Any change to `GameState`'s shape bumps it, adds a step to `migrations` and a new
 * fixture folder under `__fixtures__/saves/` (see AGENTS.md). `GameState['version']` must be bumped with it.
 */
export const CURRENT_SAVE_VERSION = 1;

type SaveRecord = Record<string, unknown>;
type Step = (s: SaveRecord) => unknown;

export interface MigrationChain {
  current: number;
  /** Step N upgrades a version-N save to version N + 1; the chain then stamps the new version on it. */
  steps: Record<number, Step>;
  /** Fixes for a save at version N that run before it moves on (or, at the current version, before validation). */
  normalize: Record<number, (s: SaveRecord) => SaveRecord>;
}

export type MigrateResult = { ok: true; state: unknown } | { ok: false; reason: string };

const isRecord = (v: unknown): v is SaveRecord => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Upgrade steps for every past save version. Empty while version 1 is the only one released. */
export const migrations: Record<number, Step> = {};

/** Every field of a candidate and its type; `satisfies` makes a field added to `Candidate` fail to compile here. */
const CANDIDATE_FIELDS = {
  candidateId: 'string', name: 'string', salary: 'number', speed: 'number', capacity: 'number', winRate: 'number',
} as const satisfies Record<keyof Candidate, 'string' | 'number'>;

const isCandidate = (v: unknown): boolean =>
  isRecord(v) &&
  Object.entries(CANDIDATE_FIELDS).every(([key, type]) =>
    type === 'string' ? typeof v[key] === 'string' : typeof v[key] === 'number' && Number.isFinite(v[key]),
  );

/** A hiring session exactly as saved before hired slots existed: no `hired`, and every other part well formed. */
function isPreSlotsHiringSession(h: unknown): boolean {
  return (
    isRecord(h) &&
    !Object.hasOwn(h, 'hired') &&
    typeof h.officeId === 'string' &&
    typeof h.dept === 'string' &&
    (DEPTS as readonly string[]).includes(h.dept) &&
    Array.isArray(h.candidates) &&
    h.candidates.every(isCandidate)
  );
}

/**
 * Version 1 before release: a hiring session saved before hired slots existed can't show its slots, so only that
 * session is cancelled (its job ad was already paid for, as when the player closes it); the rest of the game is
 * kept. Any other session is left as it is, so a malformed one fails validation and the save is backed up.
 */
function cancelPreSlotsHiring(s: SaveRecord): SaveRecord {
  return isPreSlotsHiringSession(s.hiring) ? { ...s, hiring: null } : s;
}

const CHAIN: MigrationChain = {
  current: CURRENT_SAVE_VERSION,
  steps: migrations,
  normalize: { 1: cancelPreSlotsHiring },
};

/**
 * Brings a parsed save up to the current version, before `isValidSave` checks it. Fails for anything without a
 * whole-numbered version, a version with no way up from it, or a save made by a newer version of the game.
 */
export function migrateSave(raw: unknown, chain: MigrationChain = CHAIN): MigrateResult {
  if (!isRecord(raw)) return { ok: false, reason: 'not a save' };
  const from = raw.version;
  if (typeof from !== 'number' || !Number.isInteger(from) || from < 1) return { ok: false, reason: 'no save version' };
  if (from > chain.current) return { ok: false, reason: `made by a newer version (save version ${from})` };

  let s: SaveRecord = raw;
  try {
    for (let v = from; ; v++) {
      const fix = chain.normalize[v];
      if (fix) s = fix(s);
      if (v === chain.current) return { ok: true, state: s };
      const step = chain.steps[v];
      if (!step) return { ok: false, reason: `no migration from version ${v}` };
      const next = step(s);
      if (!isRecord(next)) return { ok: false, reason: `migration from version ${v} returned no save` };
      s = { ...next, version: v + 1 };
    }
  } catch (e) {
    return { ok: false, reason: `migration failed: ${String(e)}` };
  }
}
