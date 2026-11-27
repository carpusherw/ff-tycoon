import { formatMoney, t, type Lang } from '../i18n';
import type { I18n } from '../i18n/I18nProvider';
import { renderMsg } from './format';

function i18n(lang: Lang): I18n {
  return { lang, t: (key, params) => t(lang, key, params), money: (n) => formatMoney(lang, n) } as I18n;
}

describe('renderMsg', () => {
  it('renders a handling request with its ports as cities', () => {
    const msg = { key: 'log.handlingRequest', params: { agent: 'Brinequoll Lines', from: 'SHA', to: 'TPE' } } as const;
    expect(renderMsg(i18n('en'), msg)).toBe('Brinequoll Lines sent you a shipment to handle: Shanghai → Taipei.');
    expect(renderMsg(i18n('zh-Hant'), msg)).toBe('國外代理 Brinequoll Lines 交給你一票指定貨：上海 → 台北。');
    expect(renderMsg(i18n('zh-Hans'), msg)).toBe('国外代理 Brinequoll Lines 交给你一票指定货：上海 → 台北。');
  });
});
