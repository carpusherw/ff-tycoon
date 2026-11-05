import type { ReactNode, Ref } from 'react';
import type { Speed } from '../app/clock';
import { useT } from '../i18n/I18nProvider';
import type { MsgKey } from '../i18n';
import { B } from '../rules/balance';
import { cashFlowPerMonth } from '../rules/money';
import type { GameState } from '../rules/types';
import { oneDecimal, signedMoney } from './format';
import { BoatIcon, GearIcon, KeyboardIcon } from './Icons';

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
const SPEEDS: { value: Speed; key: MsgKey; hotkey: string; glyph?: string }[] = [
  { value: 0, key: 'speed.pause', hotkey: 'Space', glyph: '❚❚' },
  { value: 1, key: 'speed.x1', hotkey: '1' },
  { value: 3, key: 'speed.x3', hotkey: '3' },
  { value: 5, key: 'speed.x5', hotkey: '5' },
];

/**
 * A number that changes during play, laid over an invisible copy of its widest value, so the pill
 * keeps one width as the day goes from 9 to 10 or a rate from 9% to 10%.
 */
function Steady({ value, widest }: { value: ReactNode; widest: ReactNode }) {
  return (
    <b className="num steady">
      <span>{value}</span>
      <span className="steady-sizer" aria-hidden="true">
        {widest}
      </span>
    </b>
  );
}

/** Deliveries in the 30 days ending today, per operator (at least one, so an empty Ops still divides). */
function shipmentsPerOperator(s: GameState): number {
  const since = s.day - B.daysPerMonth;
  const delivered = s.stats.deliveredDays.filter((d) => d > since).length;
  const operators = s.employees.filter((e) => e.dept === 'ops').length;
  return delivered / Math.max(1, operators);
}

export function TopBar({ state, speed, onSpeed, locked = false, onSettings, gearRef, onHelp }: TopBarProps) {
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
        <b className="num">{money(state.cash)}</b>
        <small className={net < 0 ? 'num is-bad' : 'num is-good'}>
          {t('money.perMonth', { amount: signedMoney(money, net) })}
        </small>
      </div>

      <div className="pill pill-date">
        <Steady
          value={t('top.date', { year, years: B.runDays / B.daysPerYear, day: state.day })}
          widest={t('top.date', { year: B.runDays / B.daysPerYear, years: B.runDays / B.daysPerYear, day: B.runDays })}
        />
        <div className="speed" role="group" aria-label={t('speed.label')}>
          {SPEEDS.map(({ value, key, hotkey, glyph }) => (
            <button
              key={value}
              type="button"
              className="speed-btn"
              aria-pressed={speed === value}
              disabled={locked && value !== 0}
              aria-label={glyph ? t(key) : undefined}
              aria-keyshortcuts={hotkey}
              title={t('hotkey.tip', { label: t(key), key: hotkey === 'Space' ? t('hotkey.space') : hotkey })}
              onClick={() => onSpeed(value)}
            >
              {glyph ? <span aria-hidden="true">{glyph}</span> : t(key)}
            </button>
          ))}
        </div>
      </div>

      <div className="pill">
        <Steady value={winRate} widest="100%" />
        <small>{t('top.winRate')}</small>
      </div>
      <div className="pill">
        <Steady value={oneDecimal(lang, shipmentsPerOperator(state))} widest={oneDecimal(lang, 88.8)} />
        <small>{t('top.shipmentsPerOp')}</small>
      </div>
      <div className="pill">
        <Steady value={state.employees.length} widest="88" />
        <small>{t('top.staff')}</small>
      </div>
      {onHelp && (
        <button
          type="button"
          className="gear help-btn"
          aria-label={t('hotkey.title')}
          title={t('hotkey.tip', { label: t('hotkey.title'), key: '?' })}
          aria-keyshortcuts="?"
          onClick={onHelp}
        >
          <KeyboardIcon />
        </button>
      )}
      {onSettings && (
        <button
          ref={gearRef}
          type="button"
          className="gear"
          aria-label={t('settings.title')}
          title={t('settings.title')}
          onClick={onSettings}
        >
          <GearIcon />
        </button>
      )}
    </header>
  );
}
