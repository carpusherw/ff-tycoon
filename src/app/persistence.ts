import { detectLang, type Lang } from '../i18n';
import { pruneState } from '../rules/prune';
import type { GameState } from '../rules/types';
import type { ThemePref } from '../theme/theme';
import { CURRENT_SAVE_VERSION, migrateSave } from './migrations';
import { isRecord, isValidSave } from './validateSave';

export interface Settings {
  lang: Lang;
  theme: ThemePref;
  autoPause: boolean;
}

/**
 * Where the game is saved. The `v1` in the key is not the save format's version: that is the `version` field
 * inside the save (`CURRENT_SAVE_VERSION`), and older saves are migrated in place, so the key never changes.
 */
export const SAVE_KEY = 'ff-tycoon/save/v1';
/** The latest stored save that couldn't be loaded or that a new game replaced, kept exactly as it was stored. */
export const BACKUP_KEY = 'ff-tycoon/save/backup';
export const SETTINGS_KEY = 'ff-tycoon/settings/v1';

const PROBE_KEY = 'ff-tycoon/probe';
const LANGS: Record<Lang, true> = { en: true, 'zh-Hant': true, 'zh-Hans': true };
const THEME_PREFS: Record<ThemePref, true> = { system: true, light: true, dark: true };

/**
 * `localStorage` when it can be written to or at least read, otherwise null (private mode, blocked, no window).
 * A storage too full for the probe write is still returned, so its save can be continued; saving into it then
 * reports false.
 */
export function getStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    try {
      storage.setItem(PROBE_KEY, '1');
      storage.removeItem(PROBE_KEY);
    } catch {
      storage.getItem(SAVE_KEY);
    }
    return storage;
  } catch {
    return null;
  }
}

function readRaw(storage: Storage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** The parsed value, or undefined when `raw` isn't JSON. */
function parse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function readJson(storage: Storage | null, key: string): unknown {
  const raw = readRaw(storage, key);
  return raw === null ? null : parse(raw);
}

function writeRaw(storage: Storage | null, key: string, raw: string): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}

function writeJson(storage: Storage | null, key: string, value: unknown): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export type SaveRead =
  | { kind: 'none' }
  | { kind: 'loaded'; state: GameState }
  /** A save is stored but can't be loaded; `backedUp` says whether its text was copied to `BACKUP_KEY`. */
  | { kind: 'unreadable'; backedUp: boolean };

/**
 * Reads the stored game: parse, migrate to the current version, validate. Loading prunes it, so a save written
 * before pruning existed shrinks. A stored save that can't be loaded is copied, exactly as stored, to the backup
 * slot before anything (a new game) can overwrite it; only the latest backup is kept.
 */
export function readSave(storage: Storage | null): SaveRead {
  const raw = readRaw(storage, SAVE_KEY);
  if (raw === null) return { kind: 'none' };
  const migrated = migrateSave(parse(raw));
  if (migrated.ok && isValidSave(migrated.state)) {
    pruneState(migrated.state);
    return { kind: 'loaded', state: migrated.state };
  }
  // When storage is full or blocked, the player is told no backup was kept.
  return { kind: 'unreadable', backedUp: writeRaw(storage, BACKUP_KEY, raw) };
}

/** The stored game, or null when there is none or it can't be loaded (see `readSave`). */
export function loadGame(storage: Storage | null): GameState | null {
  const read = readSave(storage);
  return read.kind === 'loaded' ? read.state : null;
}

/** Always writes the current save version. */
export function saveGame(storage: Storage | null, s: GameState): boolean {
  return writeJson(storage, SAVE_KEY, { ...s, version: CURRENT_SAVE_VERSION } satisfies GameState);
}

/**
 * Copies the stored save, exactly as stored, to the backup slot before a new game replaces it; only the latest
 * backup is kept. False when there is no save or the backup can't be written.
 */
export function backupSave(storage: Storage | null): boolean {
  const raw = readRaw(storage, SAVE_KEY);
  return raw !== null && writeRaw(storage, BACKUP_KEY, raw);
}

export function clearGame(storage: Storage | null): void {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear when storage is unusable.
  }
}

export function loadSettings(storage: Storage | null, languages: readonly string[]): Settings {
  const settings: Settings = { lang: detectLang(languages), theme: 'system', autoPause: true };
  const stored = readJson(storage, SETTINGS_KEY);
  if (!isRecord(stored)) return settings;
  if (typeof stored.lang === 'string' && Object.hasOwn(LANGS, stored.lang)) settings.lang = stored.lang as Lang;
  if (typeof stored.theme === 'string' && Object.hasOwn(THEME_PREFS, stored.theme)) {
    settings.theme = stored.theme as ThemePref;
  }
  if (typeof stored.autoPause === 'boolean') settings.autoPause = stored.autoPause;
  return settings;
}

export function saveSettings(storage: Storage | null, settings: Settings): boolean {
  return writeJson(storage, SETTINGS_KEY, settings);
}
