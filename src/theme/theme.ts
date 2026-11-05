export type ThemePref = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

/** The theme to show: an explicit pref wins; `system` follows the browser and falls back to light. */
export function resolveTheme(pref: ThemePref, matchMedia?: (q: string) => { matches: boolean }): Theme {
  if (pref !== 'system') return pref;
  try {
    return matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme;
}
