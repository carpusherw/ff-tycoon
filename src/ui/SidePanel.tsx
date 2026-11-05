import { useId, useState, type ReactNode } from 'react';
import type { GameStore } from '../app/store';
import { useT } from '../i18n/I18nProvider';
import type { MsgKey } from '../i18n';
import { B } from '../rules/balance';
import { cashFlowPerMonth } from '../rules/money';
import { startHiring } from '../rules/staff';
import { DEPTS, type DeptKey, type GameState } from '../rules/types';
import { runAction } from './actions';
import { DEPT_KEYS, renderMsg, signedMoney } from './format';

const LOG_LINES = 40;

export interface SidePanelProps {
  store: GameStore;
  state: GameState;
}

function Card({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className={`card side-card ${className ?? ''}`} aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

export function HireSection({ store, state }: { store: GameStore; state: GameState }) {
  const { t, money } = useT();
  const [error, setError] = useState<MsgKey | null>(null);
  const officeId = state.offices[0]?.id;
  const cost = money(B.hiring.jobAdCost);

  const post = (dept: DeptKey) => {
    if (!officeId) return;
    const r = runAction(store, (s) => startHiring(s, officeId, dept));
    setError(r.ok ? null : r.reason);
  };

  return (
    <Card title={t('side.hire')}>
      <p className="side-hint">{t('side.hireHint', { cost, n: B.hiring.candidatesPerRoll })}</p>
      <div className="side-buttons">
        {DEPTS.map((dept) => (
          <button
            key={dept}
            type="button"
            className="btn"
            // An open session would be charged again and replaced, so no second job ad while one is open.
            disabled={state.hiring !== null || !officeId}
            data-hire-dept={dept}
            onClick={() => post(dept)}
          >
            {t('side.hireButton', { dept: t(DEPT_KEYS[dept]), cost })}
          </button>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
    </Card>
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

export function LogSection({ state }: { state: GameState }) {
  const i18n = useT();
  const lines = state.log.slice(0, LOG_LINES);
  return (
    <Card title={i18n.t('side.log')} className="log">
      {lines.length === 0 ? (
        <p className="side-hint">{i18n.t('side.logEmpty')}</p>
      ) : (
        <ol className="log-lines">
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

/** The laptop side column: every section stacked. */
export function SidePanel({ store, state }: SidePanelProps) {
  return (
    <aside className="side">
      <HireSection store={store} state={state} />
      <MoneySection state={state} />
      <LogSection state={state} />
    </aside>
  );
}
