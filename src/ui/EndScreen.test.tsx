import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../i18n/I18nProvider';
import { newId } from '../rules/ids';
import { createGame } from '../rules/newGame';
import type { GameState, YearReport } from '../rules/types';
import { EndScreen } from './EndScreen';

const REPORT: YearReport = {
  year: 10,
  revenue: 52_000,
  salaries: 18_000,
  rent: 12_000,
  fees: 1_500,
  hiring: 1_200,
  expansion: 0,
  profit: 19_300,
  cashStart: 190_700,
  cashEnd: 210_000,
  quotesWon: 30,
  quotesLost: 10,
  shipmentsDelivered: 25,
  staffEnd: 4,
};

/** A new game (1 office + 2 agents = $60,000 network) that ended on `day`, with one active customer who paid $45,000. */
function endedGame(reason: 'completed' | 'bankrupt', day: number, cash: number): GameState {
  const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
  s.day = day;
  s.cash = cash;
  s.customers.push({
    id: newId(s, 'c'),
    name: 'Test Co',
    officeId: s.offices[0].id,
    status: 'active',
  });
  s.stats.revenue.push({ day: day - 10, invoices: 45_000, charges: 0 });
  s.ended = { reason, day };
  return s;
}

function mount(state: GameState) {
  const onPlayAgain = vi.fn();
  render(
    <I18nProvider lang="en">
      <EndScreen state={state} onPlayAgain={onPlayAgain} />
    </I18nProvider>,
  );
  return { onPlayAgain };
}

/** The text of the <dd> paired with the <dt> labelled `label`. */
function valueOf(label: string): string | null | undefined {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;
}

describe('EndScreen', () => {
  it('completed run shows the value breakdown and the demo link', async () => {
    const { onPlayAgain } = mount(endedGame('completed', 3600, 210_000));

    expect(screen.getByRole('heading', { level: 1, name: 'Ten years in business!' })).toBeInTheDocument();
    expect(valueOf('Cash')).toBe('$210,000');
    expect(valueOf('Network')).toBe('$60,000');
    expect(valueOf('Customer book')).toBe('$45,000');
    expect(valueOf('Company value')).toBe('$315,000');
    expect(screen.getByText('Normal')).toBeInTheDocument();
    expect(screen.queryByText(/fell in year/)).not.toBeInTheDocument();

    expect(screen.getByText('Real forwarders run on GoFreight. See it for real.')).toBeInTheDocument();
    expect(screen.queryByText('See what would have kept you afloat.')).not.toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Book a demo with GoFreight' });
    expect(link).toHaveAttribute('href', 'https://gofreight.com/get-demo');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.getAttribute('rel')).toContain('noreferrer');

    await userEvent.click(screen.getByRole('button', { name: 'Play again' }));
    expect(onPlayAgain).toHaveBeenCalledOnce();
  });

  it('bankrupt run shows the bankrupt line and year', () => {
    // Day 420 is the last day of month 14, inside year 2.
    mount(endedGame('bankrupt', 420, -1_500));

    expect(screen.getByRole('heading', { level: 1, name: 'Your company went bankrupt' })).toBeInTheDocument();
    expect(screen.getByText('The company fell in year 2.')).toBeInTheDocument();
    expect(screen.getByText('See what would have kept you afloat.')).toBeInTheDocument();
    expect(screen.queryByText('Real forwarders run on GoFreight. See it for real.')).not.toBeInTheDocument();
    expect(valueOf('Cash')).toBe('-$1,500');
    expect(valueOf('Company value')).toBe('$103,500');
    expect(screen.getByRole('link', { name: 'Book a demo with GoFreight' })).toHaveAttribute(
      'href',
      'https://gofreight.com/get-demo',
    );
  });

  it("a completed run shows its final year's report", () => {
    const s = endedGame('completed', 3600, 210_000);
    s.yearReports.push({ ...REPORT, year: 9, profit: 1 }, REPORT);
    mount(s);

    const section = screen.getByRole('region', { name: 'Your final year (year 10)' });
    const row = (label: string) => within(section).getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;
    expect(row('Invoices paid')).toBe('+$52,000');
    expect(row('Costs')).toBe('−$32,700');
    expect(row('Profit')).toBe('+$19,300');
    expect(within(section).getByText('Profit', { selector: 'dt' }).parentElement).toHaveClass('is-good');
    expect(row('Cash (start → end)')).toBe('$190,700 → $210,000');
    expect(row('Quotes won / lost')).toBe('30 / 10');
    expect(row('Shipments delivered')).toBe('25');
    expect(row('Staff at year end')).toBe('4');
  });

  it('a loss in the final year is marked bad', () => {
    const s = endedGame('bankrupt', 360, -1);
    s.yearReports.push({ ...REPORT, year: 1, profit: -2_500 });
    mount(s);
    const section = screen.getByRole('region', { name: 'Your final year (year 1)' });
    const profit = within(section).getByText('Profit', { selector: 'dt' });
    expect(profit.nextElementSibling?.textContent).toBe('−$2,500');
    expect(profit.parentElement).toHaveClass('is-bad');
  });

  it("no final-year section without that year's report", () => {
    mount(endedGame('completed', 3600, 210_000));
    expect(screen.queryByRole('region', { name: /year \(year/ })).not.toBeInTheDocument();
  });

  it('a bankruptcy mid-year shows the last full year instead', () => {
    // Day 420 is inside year 2; the last report is year 1's.
    const s = endedGame('bankrupt', 420, -1_500);
    s.yearReports.push({ ...REPORT, year: 1, cashStart: 60_000, cashEnd: 79_300 });
    mount(s);

    expect(screen.queryByRole('region', { name: /final year/ })).not.toBeInTheDocument();
    const section = screen.getByRole('region', { name: 'Your last full year (year 1)' });
    const row = (label: string) => within(section).getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;
    expect(row('Invoices paid')).toBe('+$52,000');
    expect(row('Costs')).toBe('−$32,700');
    expect(row('Profit')).toBe('+$19,300');
    expect(row('Cash (start → end)')).toBe('$60,000 → $79,300');
    expect(row('Quotes won / lost')).toBe('30 / 10');
    expect(row('Shipments delivered')).toBe('25');
    expect(row('Staff at year end')).toBe('4');
  });

  it('a bankruptcy with no year reported shows no recap', () => {
    mount(endedGame('bankrupt', 120, -1_500));
    expect(screen.queryByRole('region', { name: /year \(year/ })).not.toBeInTheDocument();
  });

  it('a bankruptcy on the last day of a year counts in that year', () => {
    mount(endedGame('bankrupt', 360, -1));
    expect(screen.getByText('The company fell in year 1.')).toBeInTheDocument();
  });
});
