import { useId } from 'react';
import { useT } from '../i18n/I18nProvider';
import type { MsgKey } from '../i18n';
import { B } from '../rules/balance';
import { companyValue } from '../rules/score';
import type { GameState, Mode, YearReport } from '../rules/types';
import { signedMoney } from './format';
import { ReportRow } from './YearReportDialog';

export const DEMO_URL = 'https://gofreight.com/get-demo';

const MODE_KEYS: Record<Mode, MsgKey> = { easy: 'mode.easy', normal: 'mode.normal', hardcore: 'mode.hardcore' };

export interface EndScreenProps {
  state: GameState;
  onPlayAgain: () => void;
  /** The run's last save failed, so a reload would open an older save. */
  saveFailed?: boolean;
}

export function EndScreen({ state, onPlayAgain, saveFailed = false }: EndScreenProps) {
  const { t, money } = useT();
  const bankrupt = state.ended?.reason === 'bankrupt';
  const value = companyValue(state);
  // Day 360 is the last day of year 1, so the year is counted from the day before.
  const fellInYear = Math.floor(((state.ended?.day ?? state.day) - 1) / B.daysPerYear) + 1;
  // The last year-end report: the year the run ended in when it ended on a year end, else the last full year.
  const lastReport = state.yearReports.at(-1) ?? null;

  return (
    <main className="screen">
      <section className="card screen-card">
        {/* Takes focus when the end screen comes up (see EndTransition). */}
        <h1 className="screen-title" tabIndex={-1}>{t(bankrupt ? 'end.titleBankrupt' : 'end.titleCompleted')}</h1>
        {bankrupt && <p className="screen-note">{t('end.fellInYear', { year: fellInYear })}</p>}
        {saveFailed && (
          <p className="end-save-warning" role="alert">
            {t('end.saveFailed')}
          </p>
        )}

        <dl className="breakdown">
          <div className="breakdown-term">
            <dt>{t('end.cash')}</dt>
            <dd>{money(value.cash)}</dd>
          </div>
          <div className="breakdown-term">
            <dt>{t('end.network')}</dt>
            <dd>{money(value.network)}</dd>
          </div>
          <div className="breakdown-term">
            <dt>{t('end.customerBook')}</dt>
            <dd>{money(value.customerBook)}</dd>
          </div>
          <div className="breakdown-total">
            <dt>{t('end.total')}</dt>
            <dd>{money(value.total)}</dd>
          </div>
        </dl>
        <p className="mode-tag">{t(MODE_KEYS[state.mode])}</p>
        {lastReport && <LastYear report={lastReport} final={lastReport.year === fellInYear} />}

        <div className="demo">
          <p>{t(bankrupt ? 'end.bankruptLine' : 'end.demoLine')}</p>
          <a className="btn btn-wide" href={DEMO_URL} target="_blank" rel="noopener noreferrer">
            {t('end.demoCta')}
          </a>
        </div>

        <button type="button" className="btn btn-soft btn-wide" onClick={onPlayAgain}>
          {t('end.playAgain')}
        </button>
      </section>
    </main>
  );
}

/** The last reported year, compact: money in and out, profit, cash, and the year's work. */
function LastYear({ report, final }: { report: YearReport; final: boolean }) {
  const { t, money } = useT();
  const titleId = useId();
  const costs = report.salaries + report.rent + report.fees + report.hiring;
  return (
    <section className="final-year" aria-labelledby={titleId}>
      <h2 id={titleId} className="final-year-title">
        {t(final ? 'end.finalYear' : 'end.lastFullYear', { year: report.year })}
      </h2>
      <dl className="money-rows">
        <ReportRow label={t('report.revenue')} className="is-income">
          {signedMoney(money, report.revenue)}
        </ReportRow>
        <ReportRow label={t('end.costs')}>−{money(costs)}</ReportRow>
        <ReportRow label={t('report.profit')} className={report.profit >= 0 ? 'money-net is-good' : 'money-net is-bad'}>
          {signedMoney(money, report.profit)}
        </ReportRow>
        <ReportRow label={t('report.cash')}>
          {t('report.cashValue', { start: money(report.cashStart), end: money(report.cashEnd) })}
        </ReportRow>
        <ReportRow label={t('report.quotes')}>
          {t('report.quotesValue', { won: report.quotesWon, lost: report.quotesLost })}
        </ReportRow>
        <ReportRow label={t('report.delivered')}>{report.shipmentsDelivered}</ReportRow>
        <ReportRow label={t('report.staff')}>{report.staffEnd}</ReportRow>
      </dl>
    </section>
  );
}
