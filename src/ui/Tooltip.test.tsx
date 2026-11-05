import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip, TOOLTIP_DELAY_MS } from './Tooltip';

const tipOf = (button: HTMLElement) => {
  const id = button.getAttribute('aria-describedby');
  return id ? document.getElementById(id) : null;
};

describe('Tooltip', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows on hover after a short delay, linked from the button by aria-describedby', () => {
    vi.useFakeTimers();
    render(
      <Tooltip text="Pause" keys={['Space']}>
        <button type="button" aria-keyshortcuts="Space">
          ❚❚
        </button>
      </Tooltip>,
    );
    const button = screen.getByRole('button');
    expect(button).not.toHaveAttribute('title');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.pointerEnter(button.parentElement!, { pointerType: 'mouse' });
    act(() => {
      vi.advanceTimersByTime(TOOLTIP_DELAY_MS - 50);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(50);
    });
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Pause (Space)');
    expect(tip.querySelector('kbd')).toHaveTextContent(/^Space$/);
    expect(tipOf(button)).toBe(tip);
    expect(button).toHaveAttribute('aria-keyshortcuts', 'Space');

    fireEvent.pointerLeave(button.parentElement!, { pointerType: 'mouse' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows at once on keyboard focus and hides on blur', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Tooltip text="3×" keys={['3']}>
          <button type="button">3×</button>
        </Tooltip>
        <button type="button">next</button>
      </>,
    );
    await user.tab();
    expect(screen.getByRole('tooltip')).toHaveTextContent('3× (3)');
    expect(tipOf(screen.getByRole('button', { name: '3×' }))).toBe(screen.getByRole('tooltip'));
    await user.tab();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('Escape dismisses it while the button keeps focus', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip text="Settings">
        <button type="button">gear</button>
      </Tooltip>,
    );
    await user.tab();
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('button'));
  });

  it('works on a disabled button: the wrapper takes the hover', () => {
    vi.useFakeTimers();
    render(
      <Tooltip text="Re-roll the candidates" keys={['R']}>
        <button type="button" disabled>
          Re-roll
        </button>
      </Tooltip>,
    );
    const button = screen.getByRole('button');
    fireEvent.pointerEnter(button.parentElement!, { pointerType: 'mouse' });
    act(() => {
      vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
    });
    expect(screen.getByRole('tooltip').querySelector('kbd')).toHaveTextContent(/^R$/);
    expect(tipOf(button)).toBe(screen.getByRole('tooltip'));
  });

  it('keeps a button\'s own description and adds its own', () => {
    render(
      <>
        <span id="why">Not enough cash</span>
        <Tooltip text="Re-roll" keys={['R']}>
          <button type="button" aria-describedby="why">
            Re-roll
          </button>
        </Tooltip>
      </>,
    );
    const ids = screen.getByRole('button').getAttribute('aria-describedby')!.split(' ');
    expect(ids[0]).toBe('why');
    expect(document.getElementById(ids[1])).toHaveAttribute('role', 'tooltip');
  });

  it('shows keys as keycaps after the label, alternatives split by a slash, and a hint line below', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip text="Keyboard shortcuts" keys={['?', '/', 'Shift']} hint="Only you can switch departments.">
        <button type="button">keys</button>
      </Tooltip>,
    );
    await user.tab();
    const tip = screen.getByRole('tooltip');
    const caps = [...tip.querySelectorAll('kbd')];
    expect(caps.map((k) => k.textContent)).toEqual(['?', '/', '⇧']);
    // A key shown as a symbol keeps its name for screen readers.
    expect(caps[2]).toHaveAttribute('aria-label', 'Shift');
    expect(caps[0]).not.toHaveAttribute('aria-label');
    expect(tip.querySelector('.tooltip-label')).toHaveTextContent('Keyboard shortcuts (? / / / ⇧)');
    expect(tip.querySelector('.tooltip-hint')).toHaveTextContent('Only you can switch departments.');
  });

  it('no text means no tooltip', () => {
    vi.useFakeTimers();
    render(
      <Tooltip text={null}>
        <button type="button">Operations · $800</button>
      </Tooltip>,
    );
    fireEvent.pointerEnter(screen.getByRole('button').parentElement!, { pointerType: 'mouse' });
    act(() => {
      vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
    });
    expect(screen.queryByRole('tooltip', { hidden: true })).not.toBeInTheDocument();
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-describedby');
  });
});
