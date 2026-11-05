import { Fragment } from 'react';

/** Keys shown as their standard symbol; the key's name stays as the accessible name. */
const SYMBOLS: Partial<Record<string, string>> = { Shift: '⇧' };

/** One key ("R"), or keys pressed together (["Shift", "O"]). */
export type KeyCombo = string | readonly string[];

/** One key as a keycap. Key names are not translated ("Space", "Esc"), like the labels on a keyboard. */
export function Kbd({ k }: { k: string }) {
  const symbol = SYMBOLS[k];
  return symbol ? <kbd aria-label={k}>{symbol}</kbd> : <kbd>{k}</kbd>;
}

/** A key, or keys pressed together as keycaps inside one combination (HTML's nested `kbd`), named "Shift+O". */
export function Combo({ keys }: { keys: KeyCombo }) {
  if (typeof keys === 'string') return <Kbd k={keys} />;
  return (
    <kbd className="kbd-combo" aria-label={keys.join('+')}>
      {keys.map((k) => (
        <Kbd key={k} k={k} />
      ))}
    </kbd>
  );
}

const comboId = (c: KeyCombo) => (typeof c === 'string' ? c : c.join('+'));

/** Alternative keys for one action, split by a slash ("? / /"). */
export function Keys({ keys }: { keys: readonly KeyCombo[] }) {
  return keys.map((c, i) => (
    <Fragment key={comboId(c)}>
      {i > 0 && ' / '}
      <Combo keys={c} />
    </Fragment>
  ));
}
