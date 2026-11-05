import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { en } from './en';
import { detectLang, formatMoney, t } from './index';
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

  it('useT exposes the provider language', () => {
    function Probe() {
      const { lang, t: tr, money } = useT();
      return createElement('p', null, `${lang}|${tr('log.hired', { name: 'Mei' })}|${money(5)}`);
    }
    render(createElement(I18nProvider, { lang: 'zh-Hans', children: createElement(Probe) }));
    expect(screen.getByText(/^zh-Hans\|.*Mei.*\|.*5$/)).toBeInTheDocument();
  });
});
