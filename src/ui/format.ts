import type { I18n } from '../i18n/I18nProvider';
import type { MsgKey } from '../i18n';
import { B } from '../rules/balance';
import { PORTS, type PortId } from '../rules/world';
import type { DeptKey, Msg } from '../rules/types';

export const DEPT_KEYS: Record<DeptKey, MsgKey> = {
  sales: 'dept.sales',
  ops: 'dept.ops',
  accounting: 'dept.accounting',
};

/** The year a day falls in: day 360 is the last day of year 1, and day 0 (before the first step) is year 1 too. */
export function yearOfDay(day: number): number {
  return Math.max(1, Math.floor((day - 1) / B.daysPerYear) + 1);
}

/** "+$1,100" or "−$500" (a true minus sign), for cash-flow figures. */
export function signedMoney(money: I18n['money'], n: number): string {
  return n < 0 ? `−${money(-n)}` : `+${money(n)}`;
}

/** Exactly one decimal: 1.5 → "1.5", 3 → "3.0", so a live figure keeps its number of characters. */
export function fixedOne(lang: I18n['lang'], n: number): string {
  return new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
}

/** At most one decimal: 1.5 → "1.5", 3 → "3". */
export function oneDecimal(lang: I18n['lang'], n: number): string {
  return new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(n);
}

const MONEY_PARAMS = new Set(['amount', 'fee', 'rent']);

const PORT_PARAMS = new Set(['city', 'from', 'to']);

/** Renders a log message in the current language: money-like params as money, and port-id params as their cities. */
export function renderMsg({ t, money }: I18n, msg: Msg): string {
  if (!msg.params) return t(msg.key);
  const params: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(msg.params)) {
    if (MONEY_PARAMS.has(name) && typeof value === 'number') params[name] = money(value);
    else if (PORT_PARAMS.has(name) && value in PORTS) params[name] = t(PORTS[value as PortId].cityKey);
    else params[name] = value;
  }
  return t(msg.key, params);
}
