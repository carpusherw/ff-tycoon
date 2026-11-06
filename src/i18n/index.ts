import { en, type MsgKey } from './en';
import { zhHans } from './zhHans';
import { zhHant } from './zhHant';

export type { MsgKey } from './en';

export type Lang = 'en' | 'zh-Hant' | 'zh-Hans';

const dicts: Record<Lang, Record<MsgKey, string>> = { en, 'zh-Hant': zhHant, 'zh-Hans': zhHans };

const TRADITIONAL_REGIONS = ['tw', 'hk', 'mo'];

/** The game language a browser language tag asks for, or null when the game doesn't offer it. */
function langOf(tag: string): Lang | null {
  const parts = tag.toLowerCase().split(/[-_]/);
  if (parts[0] === 'en') return 'en';
  if (parts[0] !== 'zh') return null;
  if (parts.includes('hant')) return 'zh-Hant';
  if (parts.includes('hans')) return 'zh-Hans';
  return parts.some((p) => TRADITIONAL_REGIONS.includes(p)) ? 'zh-Hant' : 'zh-Hans';
}

/** Picks the game language from the browser's preferred languages: the first one the game offers wins. */
export function detectLang(languages: readonly string[]): Lang {
  for (const tag of languages) {
    const lang = langOf(tag);
    if (lang) return lang;
  }
  return 'en';
}

const HAN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

/**
 * Chinese typesetting puts a space between Chinese characters and a Latin word ("為 OP 招募"). The copy has
 * those spaces where it can see the word; a param dropped in ("OP", a name) gets them here.
 */
function spaced(value: string, before: string | undefined, after: string | undefined): string {
  let out = value;
  if (before && HAN.test(before) && /^[A-Za-z]/.test(value)) out = ` ${out}`;
  if (after && HAN.test(after) && /[A-Za-z]$/.test(value)) out = `${out} `;
  return out;
}

export function t(lang: Lang, key: MsgKey, params?: Record<string, string | number>): string {
  const template = dicts[lang][key] || en[key] || key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string, offset: number) => {
    if (!Object.hasOwn(params, name)) return match;
    const value = String(params[name]);
    return lang === 'en' ? value : spaced(value, template[offset - 1], template[offset + match.length]);
  });
}

export function formatMoney(lang: Lang, n: number): string {
  return new Intl.NumberFormat(lang, {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/** The base of every key that comes in plural forms: `<base>.one` and `<base>.other` both exist. */
export type PluralKey = {
  [K in MsgKey]: K extends `${infer Base}.other` ? (`${Base}.one` extends MsgKey ? Base : never) : never;
}[MsgKey];

const pluralRules = new Map<Lang, Intl.PluralRules>();

/**
 * A count string in the right plural form for `n` ("1 task", "2 tasks"). `n` is also passed as the `{n}`
 * param. English has `one` and `other`; Chinese has no plural, so its forms are the same text.
 */
export function tn(lang: Lang, base: PluralKey, n: number, params?: Record<string, string | number>): string {
  let rules = pluralRules.get(lang);
  if (!rules) {
    rules = new Intl.PluralRules(lang);
    pluralRules.set(lang, rules);
  }
  const key: MsgKey = rules.select(n) === 'one' ? `${base}.one` : `${base}.other`;
  return t(lang, key, { n, ...params });
}
