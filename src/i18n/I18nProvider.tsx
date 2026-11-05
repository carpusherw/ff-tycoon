import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { formatMoney, t, type Lang, type MsgKey } from './index';

export interface I18n {
  lang: Lang;
  t: (key: MsgKey, params?: Record<string, string | number>) => string;
  money: (n: number) => string;
}

function make(lang: Lang): I18n {
  return {
    lang,
    t: (key, params) => t(lang, key, params),
    money: (n) => formatMoney(lang, n),
  };
}

const I18nContext = createContext<I18n>(make('en'));

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo(() => make(lang), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18n {
  return useContext(I18nContext);
}
