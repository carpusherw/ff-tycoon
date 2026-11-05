import { useId, type ReactNode } from 'react';
import { useT } from '../i18n/I18nProvider';
import type { MsgKey } from '../i18n';
import { B } from '../rules/balance';
import { cashFlowPerMonth } from '../rules/money';
import { DEPTS, type DeptKey, type GameState } from '../rules/types';
import { DEPT_KEYS, renderMsg, signedMoney } from './format';
import { Tooltip } from './Tooltip';

const LOG_LINES = 40;

export interface SidePanelProps {
  state: GameState;
  onPost: (dept: DeptKey) => void;
  hireError: MsgKey | null;
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

export interface HireSectionProps {
  state: GameState;
  /** Posts a job ad for that department (H does the same for the owner's department). */
  onPost: (dept: DeptKey) => void;
  /** Why the last job ad failed, if it did. */
  error: MsgKey | null;
}

export function HireSection({ state, onPost, error }: HireSectionProps) {
  const { t, tn, money } = useT();
  const officeId = state.offices[0]?.id;
  const cost = money(B.hiring.jobAdCost);
  const ownerDept = state.employees.find((e) => e.isOwner)?.dept;

  return (
    <Card title={t('side.hire')}>
      <p className="side-hint">{tn('side.hireHint', B.hiring.candidatesPerRoll, { cost })}</p>
      <div className="side-buttons">
        {DEPTS.map((dept) => {
          const label = t('side.hireButton', { dept: t(DEPT_KEYS[dept]), cost });
          // H posts for the department the owner works in, so only that button carries it.
          const hotkey = dept === ownerDept;
          return (
            <Tooltip key={dept} text={hotkey ? t('hotkey.tip', { label: t('hotkey.hire'), key: 'H' }) : null} className="tip-grow">
              <button
                type="button"
                className="btn"
                // An open session would be charged again and replaced, so no second job ad while one is open.
                disabled={state.hiring !== null || !officeId}
                data-hire-dept={dept}
                aria-keyshortcuts={hotkey ? 'H' : undefined}
                onClick={() => onPost(dept)}
              >
                {label}
              </button>
            </Tooltip>
          );
        })}
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

/** The laptop side column: every section stacked. */
export function SidePanel({ state, onPost, hireError }: SidePanelProps) {
  return (
    <aside className="side">
      <HireSection state={state} onPost={onPost} error={hireError} />
      <MoneySection state={state} />
      <LogSection state={state} scroll />
    </aside>
  );
}
