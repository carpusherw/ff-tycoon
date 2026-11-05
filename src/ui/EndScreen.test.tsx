import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../i18n/I18nProvider';
import { newId } from '../rules/ids';
import { createGame } from '../rules/newGame';
import type { GameState } from '../rules/types';
import { EndScreen } from './EndScreen';

/** A new game (1 office + 2 agents = $60,000 network) that ended on `day`, with one active customer. */
function endedGame(reason: 'completed' | 'bankrupt', day: number, cash: number): GameState {
  const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
  s.day = day;
  s.cash = cash;
  s.customers.push({
    id: newId(s, 'c'),
    name: 'Test Co',
    officeId: s.offices[0].id,
    status: 'active',
    payments: [{ day: day - 10, amount: 45_000 }],
  });
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

  it('a bankruptcy on the last day of a year counts in that year', () => {
    mount(endedGame('bankrupt', 360, -1));
    expect(screen.getByText('The company fell in year 1.')).toBeInTheDocument();
  });
});
