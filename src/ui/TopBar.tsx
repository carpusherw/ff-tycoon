import type { Speed } from '../app/clock';
import { useT } from '../i18n/I18nProvider';
import type { MsgKey } from '../i18n';
import { B } from '../rules/balance';
import { cashFlowPerMonth } from '../rules/money';
import type { GameState } from '../rules/types';
import { oneDecimal, signedMoney } from './format';
import { BoatIcon } from './Icons';

export interface TopBarProps {
  state: GameState;
  speed: Speed;
  onSpeed: (v: Speed) => void;
}

const SPEEDS: { value: Speed; key: MsgKey; glyph?: string }[] = [
  { value: 0, key: 'speed.pause', glyph: '❚❚' },
  { value: 1, key: 'speed.x1' },
  { value: 3, key: 'speed.x3' },
];

/** Deliveries in the 30 days ending today, per operator (at least one, so an empty Ops still divides). */
function shipmentsPerOperator(s: GameState): number {
  const since = s.day - B.daysPerMonth;
  const delivered = s.stats.deliveredDays.filter((d) => d > since).length;
  const operators = s.employees.filter((e) => e.dept === 'ops').length;
  return delivered / Math.max(1, operators);
}

export function TopBar({ state, speed, onSpeed }: TopBarProps) {
  const { t, money, lang } = useT();
  const net = cashFlowPerMonth(state).net;
  // Day 360 is the last day of year 1; day 0 (before the first step) also counts as year 1.
  const year = Math.max(1, Math.floor((state.day - 1) / B.daysPerYear) + 1);
  const quotes = state.stats.quotesWon + state.stats.quotesLost;
  const winRate = quotes === 0 ? '—' : `${Math.round((100 * state.stats.quotesWon) / quotes)}%`;

  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">
          <BoatIcon size={24} />
        </span>
        <span className="brand-name">{t('app.title')}</span>
      </div>

      <div className="pill">
        <b>{money(state.cash)}</b>
        <small className={net < 0 ? 'is-bad' : 'is-good'}>
          {t('money.perMonth', { amount: signedMoney(money, net) })}
        </small>
      </div>

      <div className="pill pill-date">
        <b>{t('top.date', { year, years: B.runDays / B.daysPerYear, day: state.day })}</b>
        <div className="speed" role="group" aria-label={t('speed.label')}>
          {SPEEDS.map(({ value, key, glyph }) => (
            <button
              key={value}
              type="button"
              className="speed-btn"
              aria-pressed={speed === value}
              aria-label={glyph ? t(key) : undefined}
              title={glyph ? t(key) : undefined}
              onClick={() => onSpeed(value)}
            >
              {glyph ? <span aria-hidden="true">{glyph}</span> : t(key)}
            </button>
          ))}
        </div>
      </div>

      <div className="pill">
        <b>{winRate}</b>
        <small>{t('top.winRate')}</small>
      </div>
      <div className="pill">
        <b>{oneDecimal(lang, shipmentsPerOperator(state))}</b>
        <small>{t('top.shipmentsPerOp')}</small>
      </div>
      <div className="pill">
        <b>{state.employees.length}</b>
        <small>{t('top.staff')}</small>
      </div>
    </header>
  );
}
