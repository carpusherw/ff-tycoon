import type { Candidate, DeptKey } from '../rules/types';

/**
 * The building blocks of the save checks, shared by `validateSave` (the current format) and `migrations` (older
 * saves). They live apart from both so neither imports the other's module just for a guard.
 */
export type Guard = (v: unknown) => boolean;

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** `spec` must name every field of `T`, so a field added to a type can't be skipped here. */
export function shape<T>(spec: { [K in keyof T]-?: Guard }): Guard {
  const entries = Object.entries(spec) as [string, Guard][];
  return (v) => isRecord(v) && entries.every(([key, guard]) => guard(v[key]));
}

export function oneOf<T extends string>(allowed: Record<T, true>): Guard {
  return (v) => typeof v === 'string' && Object.hasOwn(allowed, v);
}

export const arrayOf = (guard: Guard): Guard => (v) => Array.isArray(v) && v.every(guard);
export const nullOr = (guard: Guard): Guard => (v) => v === null || guard(v);
export const num: Guard = (v) => typeof v === 'number' && Number.isFinite(v);
export const str: Guard = (v) => typeof v === 'string';
export const bool: Guard = (v) => typeof v === 'boolean';

export const dept = oneOf<DeptKey>({ sales: true, ops: true, accounting: true });

export const candidate = shape<Candidate>({
  candidateId: str, name: str, salary: num, speed: num, capacity: num, winRate: num,
});
