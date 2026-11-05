import { resolveTheme } from './theme';

const prefersDark = (q: string) => ({ matches: q === '(prefers-color-scheme: dark)' });
const prefersLight = () => ({ matches: false });

describe('theme', () => {
  it('system follows dark preference', () => {
    expect(resolveTheme('system', prefersDark)).toBe('dark');
    expect(resolveTheme('system', prefersLight)).toBe('light');
  });

  it('system falls back to light without matchMedia', () => {
    expect(resolveTheme('system')).toBe('light');
    expect(resolveTheme('system', undefined)).toBe('light');
  });

  it('system falls back to light when matchMedia throws', () => {
    const throwing = () => {
      throw new Error('matchMedia unavailable');
    };
    expect(resolveTheme('system', throwing)).toBe('light');
  });

  it('explicit prefs win', () => {
    expect(resolveTheme('light', prefersDark)).toBe('light');
    expect(resolveTheme('dark', prefersLight)).toBe('dark');
    expect(resolveTheme('dark')).toBe('dark');
  });
});
