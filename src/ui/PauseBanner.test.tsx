import { fireEvent, render, screen } from '@testing-library/react';
import type { Settings } from '../app/persistence';
import { createGameStore, useGameState, type GameStore } from '../app/store';
import { useGameClock } from '../app/useGameClock';
import { I18nProvider } from '../i18n/I18nProvider';
import { zhHant } from '../i18n/zhHant';
import { createGame } from '../rules/newGame';
import { PauseBanner } from './PauseBanner';

const settings: Settings = { lang: 'en', theme: 'system', autoPause: true };

/** The banner wired to a real clock, the way GameScreen uses it. */
function Harness({ store }: { store: GameStore }) {
  const clock = useGameClock(store, settings);
  const reasons = useGameState(store, (s) => s.pauseReasons);
  return (
    <>
      <PauseBanner reasons={reasons} onResume={clock.resume} />
      <output data-testid="speed">{clock.speed}</output>
    </>
  );
}

describe('PauseBanner', () => {
  it('lists each reason in the current language', () => {
    render(
      <I18nProvider lang="zh-Hant">
        <PauseBanner reasons={['yearEnd', 'yearEnd', 'bankrupt']} onResume={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getAllByText(zhHant['pause.yearEnd'])).toHaveLength(1);
    expect(screen.getByText(zhHant['pause.bankrupt'])).toBeInTheDocument();
    expect(screen.getByRole('button', { name: zhHant['pause.resume'] })).toBeInTheDocument();
  });

  it('is hidden when there are no reasons', () => {
    render(<PauseBanner reasons={[]} onResume={vi.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('Resume on a freshly loaded paused save clears reasons and plays at 1×', () => {
    const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
    s.day = 360;
    s.pauseReasons = ['yearEnd'];
    const store = createGameStore(s);
    render(
      <I18nProvider lang="en">
        <Harness store={store} />
      </I18nProvider>,
    );
    expect(screen.getByTestId('speed')).toHaveTextContent('0');

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(store.getState().pauseReasons).toEqual([]);
    expect(screen.getByTestId('speed')).toHaveTextContent('1');
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument();
  });
});
