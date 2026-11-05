import css from './styles.css?raw';

/** The color tokens of one theme block (`:root { … }` or `:root[data-theme='dark'] { … }`). */
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Text on a background, as the page uses them (the safe list in docs/superpowers/specs/2026-11-04-visual-style.md):
 * each pair needs WCAG AA for body text (4.5 : 1).
 */
const TEXT_PAIRS: [text: string, background: string][] = [
  ...['bg', 'panel', 'panel-2'].flatMap((bg): [string, string][] => [
    ['text', bg],
    ['muted', bg],
  ]),
  ...['brand-soft', 'good-soft', 'bad-soft', 'sales-soft', 'ops-soft', 'accounting-soft'].map(
    (bg): [string, string] => ['text', bg],
  ),
  ['on-accent', 'accent'],
  ['accent', 'panel'],
  ['accent', 'panel-2'],
  ['good', 'panel'],
  ['good', 'panel-2'],
  ['good', 'good-soft'],
  ['bad', 'panel'],
  ['bad', 'panel-2'],
  ['on-bad', 'bad'],
];

/**
 * A control against what's around it needs 3 : 1 (WCAG non-text contrast). The accent is GoFreight's button
 * green and sits on --brand-soft only as a button (the pause banner's Resume, the end screen's demo button),
 * never as text, so it stays as it is.
 */
const CONTROL_PAIRS: [control: string, background: string][] = [
  ['accent', 'brand-soft'],
  ['accent', 'panel'],
];

describe.each([
  ['light', ':root'],
  ['dark', ":root[data-theme='dark']"],
])('%s theme colors', (_theme, selector) => {
  const t = tokens(selector);
  it.each(TEXT_PAIRS)('--%s on --%s meets WCAG AA', (text, background) => {
    expect(t[text], text).toBeDefined();
    expect(t[background], background).toBeDefined();
    expect(contrast(t[text], t[background])).toBeGreaterThanOrEqual(4.5);
  });
  it.each(CONTROL_PAIRS)('--%s as a control on --%s meets WCAG non-text contrast', (control, background) => {
    expect(contrast(t[control], t[background])).toBeGreaterThanOrEqual(3);
  });
});
