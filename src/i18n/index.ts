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

export function t(lang: Lang, key: MsgKey, params?: Record<string, string | number>): string {
  const template = dicts[lang][key] || en[key] || key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}

export function formatMoney(lang: Lang, n: number): string {
  return new Intl.NumberFormat(lang, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}
