import { createContext, Fragment, useContext, useMemo, type ReactNode } from 'react';
import { formatMoney, t, tn, type Lang, type MsgKey, type PluralKey } from './index';

export interface I18n {
  lang: Lang;
  t: (key: MsgKey, params?: Record<string, string | number>) => string;
  /** A count string in the plural form for `n`; see `tn` in `./index`. */
  tn: (base: PluralKey, n: number, params?: Record<string, string | number>) => string;
  /** Like `t`, but the params are elements, so a number inside a sentence can sit in a box of its own. */
  tx: (key: MsgKey, parts: Record<string, ReactNode>) => ReactNode;
  money: (n: number) => string;
}

function interpolate(template: string, parts: Record<string, ReactNode>): ReactNode {
  // split() with a capture group puts each placeholder's name at the odd indexes.
  return template.split(/\{(\w+)\}/).map((piece, i) =>
    i % 2 === 0 ? piece : <Fragment key={i}>{Object.hasOwn(parts, piece) ? parts[piece] : `{${piece}}`}</Fragment>,
  );
}

function make(lang: Lang): I18n {
  return {
    lang,
    t: (key, params) => t(lang, key, params),
    tn: (base, n, params) => tn(lang, base, n, params),
    tx: (key, parts) => interpolate(t(lang, key), parts),
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
