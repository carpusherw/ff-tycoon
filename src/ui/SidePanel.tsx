import { useId, useState, type ReactNode } from 'react';
import type { Settings } from '../app/persistence';
import type { GameStore } from '../app/store';
import { useT } from '../i18n/I18nProvider';
import type { Lang, MsgKey } from '../i18n';
import { B } from '../rules/balance';
import { cashFlowPerMonth } from '../rules/money';
import { moveOwner, startHiring } from '../rules/staff';
import { DEPTS, type DeptKey, type GameState } from '../rules/types';
import type { ThemePref } from '../theme/theme';
import { runAction } from './actions';
import { DEPT_KEYS, renderMsg, signedMoney } from './format';

const LOG_LINES = 40;

const LANGS: { value: Lang; key: MsgKey }[] = [
  { value: 'en', key: 'lang.en' },
  { value: 'zh-Hant', key: 'lang.zhHant' },
  { value: 'zh-Hans', key: 'lang.zhHans' },
];
const THEMES: { value: ThemePref; key: MsgKey }[] = [
  { value: 'system', key: 'settings.themeSystem' },
  { value: 'light', key: 'settings.themeLight' },
  { value: 'dark', key: 'settings.themeDark' },
];

export interface SettingsProps {
  settings: Settings;
  onSettingsChange: (next: Settings) => void;
  onNewGame: () => void;
}

export interface SidePanelProps extends SettingsProps {
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

export function OwnerSection({ store, state }: { store: GameStore; state: GameState }) {
  const { t } = useT();
  const groupId = useId();
  const current = state.employees.find((e) => e.isOwner)?.dept;
  return (
    <Card title={t('side.owner')}>
      <p className="side-hint" id={groupId}>
        {t('side.ownerHint')}
      </p>
      <div className="side-buttons seg" role="group" aria-label={t('side.owner')} aria-describedby={groupId}>
        {DEPTS.map((dept) => (
          <button
            key={dept}
            type="button"
            className="seg-btn"
            aria-pressed={current === dept}
            onClick={() => current !== dept && store.update((s) => moveOwner(s, dept))}
          >
            {t(DEPT_KEYS[dept])}
          </button>
        ))}
      </div>
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

export function SettingsSection({ settings, onSettingsChange, onNewGame }: SettingsProps) {
  const { t } = useT();
  const langId = useId();
  const themeId = useId();
  const autoId = useId();
  return (
    <Card title={t('side.settings')}>
      <div className="settings">
        <label htmlFor={langId}>{t('settings.language')}</label>
        <select
          id={langId}
          value={settings.lang}
          onChange={(e) => onSettingsChange({ ...settings, lang: e.target.value as Lang })}
        >
          {LANGS.map(({ value, key }) => (
            <option key={value} value={value}>
              {t(key)}
            </option>
          ))}
        </select>

        <label htmlFor={themeId}>{t('settings.theme')}</label>
        <select
          id={themeId}
          value={settings.theme}
          onChange={(e) => onSettingsChange({ ...settings, theme: e.target.value as ThemePref })}
        >
          {THEMES.map(({ value, key }) => (
            <option key={value} value={value}>
              {t(key)}
            </option>
          ))}
        </select>

        <div className="settings-check">
          <input
            id={autoId}
            type="checkbox"
            checked={settings.autoPause}
            onChange={(e) => onSettingsChange({ ...settings, autoPause: e.target.checked })}
          />
          <label htmlFor={autoId}>{t('settings.autoPause')}</label>
        </div>

        <button
          type="button"
          className="btn btn-soft"
          onClick={() => {
            if (window.confirm(t('settings.confirmNewGame'))) onNewGame();
          }}
        >
          {t('settings.newGame')}
        </button>
      </div>
    </Card>
  );
}

/** The laptop side column: every section stacked. */
export function SidePanel({ store, state, ...settingsProps }: SidePanelProps) {
  return (
    <aside className="side">
      <HireSection store={store} state={state} />
      <OwnerSection store={store} state={state} />
      <MoneySection state={state} />
      <LogSection state={state} />
      <SettingsSection {...settingsProps} />
    </aside>
  );
}
