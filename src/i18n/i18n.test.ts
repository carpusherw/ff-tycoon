import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { en } from './en';
import { detectLang, formatMoney, t, tn } from './index';
import { I18nProvider, useT } from './I18nProvider';
import { zhHans } from './zhHans';
import { zhHant } from './zhHant';

describe('i18n', () => {
  it('detectLang maps browser languages', () => {
    expect(detectLang(['zh-TW'])).toBe('zh-Hant');
    expect(detectLang(['zh-CN'])).toBe('zh-Hans');
    expect(detectLang(['zh'])).toBe('zh-Hans');
    expect(detectLang(['fr', 'zh-HK'])).toBe('zh-Hant');
    expect(detectLang(['de'])).toBe('en');
    expect(detectLang([])).toBe('en');
  });

  it('detectLang treats Hant script tags and Macau as Traditional', () => {
    expect(detectLang(['zh-MO'])).toBe('zh-Hant');
    expect(detectLang(['zh-Hant-CN'])).toBe('zh-Hant');
    expect(detectLang(['zh-Hans-TW'])).toBe('zh-Hans');
    expect(detectLang(['en-US', 'zh-TW'])).toBe('en');
    expect(detectLang(['fr', 'de'])).toBe('en');
  });

  it('interpolates params', () => {
    expect(t('en', 'log.paid', { customer: 'Acme', amount: '$1' })).toContain('Acme');
    expect(t('zh-Hant', 'log.paid', { customer: 'Acme', amount: '$1' })).toContain('Acme');
  });

  it('leaves unknown placeholders as they are', () => {
    expect(t('en', 'log.paid', { customer: 'Acme' })).toBe('Acme paid {amount}.');
  });

  it('falls back to English for an empty translation', () => {
    const saved = zhHant['log.hired'];
    zhHant['log.hired'] = '';
    try {
      expect(t('zh-Hant', 'log.hired', { name: 'Mei' })).toBe(t('en', 'log.hired', { name: 'Mei' }));
    } finally {
      zhHant['log.hired'] = saved;
    }
  });

  it('no empty translations ship', () => {
    for (const dict of [zhHant, zhHans]) {
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        expect(typeof dict[key]).toBe('string');
        expect(dict[key].trim()).not.toBe('');
      }
    }
  });

  it('keeps the same placeholders in every language', () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(names(zhHant[key]), `zh-Hant ${key}`).toEqual(names(en[key]));
      expect(names(zhHans[key]), `zh-Hans ${key}`).toEqual(names(en[key]));
    }
  });

  it('uses the fixed end-screen and setup copy', () => {
    expect(t('en', 'end.demoCta')).toBe('Book a demo with GoFreight');
    expect(t('zh-Hant', 'end.demoCta')).toBe('預約 GoFreight 產品展示');
    expect(t('zh-Hans', 'setup.title')).toBe('创立你的货代公司');
  });

  it('formats money as whole US dollars', () => {
    expect(formatMoney('en', 12345.6)).toBe('$12,346');
    expect(formatMoney('zh-Hant', 1000)).toContain('1,000');
    expect(formatMoney('zh-Hans', -500)).toContain('500');
  });

  it('shows a plain $ in every language', () => {
    expect(formatMoney('en', 1235)).toBe('$1,235');
    expect(formatMoney('zh-Hant', 1235)).toBe('$1,235');
    expect(formatMoney('zh-Hans', 1235)).toBe('$1,235');
  });

  it('count strings take the plural form for the count in English', () => {
    expect(tn('en', 'dept.tabTasks', 1)).toBe('1 task');
    expect(tn('en', 'dept.tabTasks', 0)).toBe('0 tasks');
    expect(tn('en', 'dept.tabTasks', 2)).toBe('2 tasks');
    expect(tn('en', 'dept.inQueue', 1)).toBe('task');
    expect(tn('en', 'hire.capacityValue', 1)).toBe('1 task');
    expect(tn('en', 'hire.hint', 1)).toBe('1 person answered your job ad!');
    expect(tn('en', 'hire.hint', 3)).toBe('3 people answered your job ad!');
    expect(tn('en', 'side.hireHint', 1, { cost: '$800' })).toBe('A job ad costs $800 and brings 1 candidate.');
    expect(tn('en', 'staff.chip', 1, { name: 'Mei', open: 0, capacity: 1 })).toBe('Mei, 0 of 1 task open');
    expect(tn('en', 'dept.late', 1)).toBe('1 late');
    expect(tn('en', 'map.shipsAtSea', 1)).toBe('Ships at sea: 1');
    expect(tn('en', 'staff.showAll', 13)).toBe('Show all 13 staff');
  });

  it('Chinese has no plural: one count string for every number', () => {
    for (const lang of ['zh-Hant', 'zh-Hans'] as const) {
      expect(tn(lang, 'dept.tabTasks', 1)).toBe(tn(lang, 'dept.tabTasks', 2).replace('2', '1'));
    }
    expect(tn('zh-Hant', 'dept.tabTasks', 1)).toBe('1 項任務');
    expect(tn('zh-Hans', 'dept.tabTasks', 1)).toBe('1 项任务');
  });

  it('every plural key has both forms in every language', () => {
    const bases = (Object.keys(en) as (keyof typeof en)[]).filter((k) => k.endsWith('.other')).map((k) => k.slice(0, -6));
    expect(bases.length).toBeGreaterThanOrEqual(9);
    for (const base of bases) {
      for (const dict of [en, zhHant, zhHans] as Record<string, string>[]) {
        expect(dict[`${base}.one`], `${base}.one`).toBeTruthy();
        expect(dict[`${base}.other`], `${base}.other`).toBeTruthy();
      }
    }
  });

  it('useT exposes the provider language', () => {
    function Probe() {
      const { lang, t: tr, money } = useT();
      return createElement('p', null, `${lang}|${tr('log.hired', { name: 'Mei' })}|${money(5)}`);
    }
    render(createElement(I18nProvider, { lang: 'zh-Hans', children: createElement(Probe) }));
    expect(screen.getByText(/^zh-Hans\|.*Mei.*\|.*5$/)).toBeInTheDocument();
  });
});
