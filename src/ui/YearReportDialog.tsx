import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useT } from '../i18n/I18nProvider';
import type { YearReport } from '../rules/types';
import { signedMoney } from './format';
import { useModalKeys } from './useModalKeys';

export interface YearReportDialogProps {
  /** The finished year to show; null keeps the dialog closed. */
  report: YearReport | null;
  /** Continue or Escape: the caller resumes the clock. */
  onContinue: () => void;
  /** Called after the dialog closes when the element focused before it is gone. */
  onClosed?: () => void;
}

function Row({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`money-row ${className ?? ''}`}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** The modal year-end report: that year's money and work, and a Continue button. */
export function YearReportDialog({ report, onContinue, onClosed }: YearReportDialogProps) {
  const { t, money } = useT();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const open = report !== null;
  const before = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      const active = document.activeElement;
      before.current = active instanceof HTMLElement && active !== document.body ? active : null;
      dialogRef.current?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      const back = before.current;
      before.current = null;
      if (back?.isConnected) back.focus();
      if (document.activeElement !== back || !back) onClosed?.();
    }
  }, [open, onClosed]);

  useModalKeys(open, dialogRef, onContinue);

  if (!report) return null;

  const quotes = report.quotesWon + report.quotesLost;
  const winRate = quotes === 0 ? '—' : t('hire.winRateValue', { pct: Math.round((100 * report.quotesWon) / quotes) });
  const good = report.profit >= 0;

  return (
    <div className="dialog-backdrop">
      <div ref={dialogRef} className="card small-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="ribbon">
          <div className="ribbon-text">
            <h2 id={titleId}>{t('report.title', { year: report.year })}</h2>
            <p>{t('report.hint')}</p>
          </div>
        </div>

        <dl className="money-rows">
          <Row label={t('report.revenue')} className="is-income">
            {signedMoney(money, report.revenue)}
          </Row>
          <Row label={t('money.salaries')}>−{money(report.salaries)}</Row>
          <Row label={t('money.rent')}>−{money(report.rent)}</Row>
          <Row label={t('report.fees')}>−{money(report.fees)}</Row>
          <Row label={t('report.hiring')}>−{money(report.hiring)}</Row>
          <Row label={t('report.profit')} className={good ? 'money-net is-good' : 'money-net is-bad'}>
            {signedMoney(money, report.profit)}
          </Row>
          <Row label={t('report.cash')}>
            {t('report.cashValue', { start: money(report.cashStart), end: money(report.cashEnd) })}
          </Row>
          <Row label={t('report.quotes')}>{t('report.quotesValue', { won: report.quotesWon, lost: report.quotesLost })}</Row>
          <Row label={t('hire.winRate')}>{winRate}</Row>
          <Row label={t('report.delivered')}>{report.shipmentsDelivered}</Row>
          <Row label={t('report.staff')}>{report.staffEnd}</Row>
        </dl>

        <button type="button" className="btn btn-wide" onClick={onContinue}>
          {t('report.continue')}
        </button>
      </div>
    </div>
  );
}
