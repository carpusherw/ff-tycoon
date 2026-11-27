import { useId, type ReactNode } from 'react';
import { useT } from '../i18n/I18nProvider';
import { cashFlowPerMonth } from '../rules/money';
import type { GameState } from '../rules/types';
import { renderMsg, signedMoney } from './format';

const LOG_LINES = 40;

function Card({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className={`card side-card ${className ?? ''}`} aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

export function MoneySection({ state }: { state: GameState }) {
  const { t, money } = useT();
  const flow = cashFlowPerMonth(state);
  return (
    <Card title={t('side.money')}>
      <dl className="money-rows">
        <div className="money-row">
          <dt>{t('money.revenue')}</dt>
          <dd className="is-good">{signedMoney(money, flow.revenue)}</dd>
        </div>
        <div className="money-row">
          <dt>{t('money.salaries')}</dt>
          <dd>−{money(flow.salaries)}</dd>
        </div>
        <div className="money-row">
          <dt>{t('money.rent')}</dt>
          <dd>−{money(flow.rent)}</dd>
        </div>
        <div className={flow.net < 0 ? 'money-row money-net is-bad' : 'money-row money-net is-good'}>
          <dt>{t('money.net')}</dt>
          <dd>{t('money.perMonth', { amount: signedMoney(money, flow.net) })}</dd>
        </div>
        <div className="money-row money-sub">
          <dt>{t('money.cash')}</dt>
          <dd>{money(state.cash)}</dd>
        </div>
      </dl>
    </Card>
  );
}

/** `scroll`: the lines scroll inside the card (the laptop side column); otherwise the page around it scrolls. */
export function LogSection({ state, scroll = false }: { state: GameState; scroll?: boolean }) {
  const i18n = useT();
  const lines = state.log.slice(0, LOG_LINES);
  return (
    <Card title={i18n.t('side.log')} className="log">
      {lines.length === 0 ? (
        <p className="side-hint">{i18n.t('side.logEmpty')}</p>
      ) : (
        <ol
          className={scroll ? 'log-lines scroll' : 'log-lines'}
          aria-label={i18n.t('side.log')}
          tabIndex={scroll ? 0 : undefined}
        >
          {lines.map((entry, i) => (
            <li key={`${entry.day}-${i}`} className={`log-line is-${entry.tone}`}>
              <span className="log-day">{i18n.t('game.day', { day: entry.day })}</span>
              <span className="log-msg">{renderMsg(i18n, entry.msg)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** The laptop side column: money, then what happened. */
export function SidePanel({ state }: { state: GameState }) {
  return (
    <aside className="side">
      <MoneySection state={state} />
      <LogSection state={state} scroll />
    </aside>
  );
}
