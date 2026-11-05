import type { Ref } from 'react';
import type { Speed } from '../app/clock';
import { useT } from '../i18n/I18nProvider';
import type { MsgKey } from '../i18n';
import { B } from '../rules/balance';
import { cashFlowPerMonth } from '../rules/money';
import type { GameState } from '../rules/types';
import { fixedOne, signedMoney } from './format';
import { BoatIcon, GearIcon, KeyboardIcon } from './Icons';
import { Tooltip } from './Tooltip';

export interface TopBarProps {
  state: GameState;
  speed: Speed;
  onSpeed: (v: Speed) => void;
  /** While true only Pause is offered: a pause reason or the hiring dialog holds the clock. */
  locked?: boolean;
  /** Opens the settings panel; the gear is left out without it. */
  onSettings?: () => void;
  /** The gear button, so focus can come back to it when the settings panel closes. */
  gearRef?: Ref<HTMLButtonElement>;
  /** Opens the keyboard-shortcuts help; the keyboard button is left out without it. */
  onHelp?: () => void;
}

/** `hotkey` is the key's ARIA name; Space's shown name is translated. */
/** `key` is the button's label, `action` what its tooltip calls it. */
const SPEEDS: { value: Speed; key: MsgKey; action: MsgKey; hotkey: string; glyph?: string }[] = [
  { value: 0, key: 'speed.pause', action: 'speed.pause', hotkey: 'Space', glyph: '❚❚' },
  { value: 1, key: 'speed.x1', action: 'speed.x1Action', hotkey: '1' },
  { value: 3, key: 'speed.x3', action: 'speed.x3Action', hotkey: '3' },
  { value: 5, key: 'speed.x5', action: 'speed.x5Action', hotkey: '5' },
];

/** Deliveries in the 30 days ending today, per operator (at least one, so an empty Ops still divides). */
function shipmentsPerOperator(s: GameState): number {
  const since = s.day - B.daysPerMonth;
  const delivered = s.stats.deliveredDays.filter((d) => d > since).length;
  const operators = s.employees.filter((e) => e.dept === 'ops').length;
  return delivered / Math.max(1, operators);
}

export function TopBar({ state, speed, onSpeed, locked = false, onSettings, gearRef, onHelp }: TopBarProps) {
  const { t, tx, money, lang } = useT();
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
        {/* Numbers that change all the time reserve the width of their widest value (see .num-* in styles.css). */}
        <b className="num num-cash">{money(state.cash)}</b>
        <small className={net < 0 ? 'num num-flow is-bad' : 'num num-flow is-good'}>
          {t('money.perMonth', { amount: signedMoney(money, net) })}
        </small>
      </div>

      <div className="pill pill-date">
        <b className="num">
          {tx('top.date', {
            year: <span className="num-year">{year}</span>,
            years: B.runDays / B.daysPerYear,
            day: <span className="num-day">{state.day}</span>,
          })}
        </b>
        <div className="speed" role="group" aria-label={t('speed.label')}>
          {SPEEDS.map(({ value, key, action, hotkey, glyph }) => (
            <Tooltip key={value} text={t(action)} keys={[hotkey]}>
              <button
                type="button"
                className="speed-btn"
                aria-pressed={speed === value}
                disabled={locked && value !== 0}
                aria-label={glyph ? t(key) : undefined}
                aria-keyshortcuts={hotkey}
                onClick={() => onSpeed(value)}
              >
                {glyph ? <span aria-hidden="true">{glyph}</span> : t(key)}
              </button>
            </Tooltip>
          ))}
        </div>
      </div>

      <div className="pill">
        <b className="num num-rate">{winRate}</b>
        <small>{t('top.winRate')}</small>
      </div>
      <div className="pill">
        <b className="num num-perop">{fixedOne(lang, shipmentsPerOperator(state))}</b>
        <small>{t('top.shipmentsPerOp')}</small>
      </div>
      <div className="pill">
        <b className="num">{state.employees.length}</b>
        <small>{t('top.staff')}</small>
      </div>
      {onHelp && (
        <Tooltip text={t('hotkey.title')} keys={['?', '/']} className="tip-gear tip-help">
          <button type="button" className="gear help-btn" aria-label={t('hotkey.title')} aria-keyshortcuts="? /" onClick={onHelp}>
            <KeyboardIcon />
          </button>
        </Tooltip>
      )}
      {onSettings && (
        <Tooltip text={t('settings.title')} className="tip-gear">
          <button ref={gearRef} type="button" className="gear" aria-label={t('settings.title')} onClick={onSettings}>
            <GearIcon />
          </button>
        </Tooltip>
      )}
    </header>
  );
}
