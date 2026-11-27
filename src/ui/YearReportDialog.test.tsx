import { render, screen, within } from '@testing-library/react';
import { type Lang } from '../i18n';
import { I18nProvider } from '../i18n/I18nProvider';
import type { YearReport } from '../rules/types';
import { YearReportDialog } from './YearReportDialog';

const REPORT: YearReport = {
  year: 2,
  revenue: 120_000,
  salaries: 40_000,
  rent: 24_000,
  fees: 500,
  hiring: 1_600,
  expansion: 55_000,
  profit: -1_100,
  cashStart: 80_000,
  cashEnd: 78_900,
  quotesWon: 12,
  quotesLost: 4,
  shipmentsDelivered: 30,
  staffEnd: 6,
};

function mount(lang: Lang = 'en') {
  render(
    <I18nProvider lang={lang}>
      <YearReportDialog report={REPORT} onContinue={() => {}} />
    </I18nProvider>,
  );
  return screen.getByRole('dialog');
}

const row = (dialog: HTMLElement, label: string) =>
  within(dialog).getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;

describe('YearReportDialog', () => {
  it('shows the Expansion row', () => {
    const dialog = mount();
    expect(row(dialog, 'Expansion (agents and offices)')).toBe('−$55,000');
    // It sits with the other costs, after hiring and before the profit.
    const labels = [...dialog.querySelectorAll('dt')].map((dt) => dt.textContent);
    expect(labels.indexOf('Expansion (agents and offices)')).toBe(labels.indexOf('Hiring (job ads and re-rolls)') + 1);
    expect(labels.indexOf('Profit')).toBe(labels.indexOf('Expansion (agents and offices)') + 1);
  });

  it.each<[Lang, string]>([
    ['zh-Hant', '拓展（國外代理與辦公室）'],
    ['zh-Hans', '拓展（国外代理与办公室）'],
  ])('names the Expansion row in %s', (lang, label) => {
    expect(row(mount(lang), label)).toBe('−$55,000');
  });
});
