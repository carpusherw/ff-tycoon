import { detectLang, type Lang } from '../i18n';
import type { GameState } from '../rules/types';
import type { ThemePref } from '../theme/theme';
import { isRecord, isValidSave } from './validateSave';

export interface Settings {
  lang: Lang;
  theme: ThemePref;
  autoPause: boolean;
}

export const SAVE_KEY = 'ff-tycoon/save/v1';
export const SETTINGS_KEY = 'ff-tycoon/settings/v1';

const PROBE_KEY = 'ff-tycoon/probe';
const LANGS: Record<Lang, true> = { en: true, 'zh-Hant': true, 'zh-Hans': true };
const THEME_PREFS: Record<ThemePref, true> = { system: true, light: true, dark: true };

/** `localStorage` when it can actually be written to, otherwise null (private mode, blocked, no window). */
export function getStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    storage.setItem(PROBE_KEY, '1');
    storage.removeItem(PROBE_KEY);
    return storage;
  } catch {
    return null;
  }
}

function readJson(storage: Storage | null, key: string): unknown {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
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

export function loadGame(storage: Storage | null): GameState | null {
  const v = readJson(storage, SAVE_KEY);
  return isValidSave(v) ? v : null;
}

export function saveGame(storage: Storage | null, s: GameState): boolean {
  return writeJson(storage, SAVE_KEY, s);
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
