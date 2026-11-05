import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Lang } from '../i18n';
import { I18nProvider } from '../i18n/I18nProvider';
import { SetupScreen } from './SetupScreen';

function mount(opts: { hasSave?: boolean; lang?: Lang } = {}) {
  const onContinue = vi.fn();
  const onNewGame = vi.fn();
  render(
    <I18nProvider lang={opts.lang ?? 'en'}>
      <SetupScreen hasSave={opts.hasSave ?? false} onContinue={onContinue} onNewGame={onNewGame} />
    </I18nProvider>,
  );
  return { onContinue, onNewGame };
}

describe('SetupScreen', () => {
  it("starting a game from Taipei calls onNewGame('TPE')", async () => {
    const { onNewGame } = mount();
    expect(screen.getByRole('heading', { level: 1, name: 'Start your forwarding company' })).toBeInTheDocument();
    for (const city of ['Taipei', 'Shanghai', 'Singapore', 'Los Angeles', 'Rotterdam']) {
      expect(screen.getByRole('button', { name: city })).toBeInTheDocument();
    }

    await userEvent.click(screen.getByRole('button', { name: 'Taipei' }));
    expect(onNewGame).toHaveBeenCalledExactlyOnceWith('TPE');
  });

  it('Continue only shows with a save', async () => {
    const { unmount } = render(
      <I18nProvider lang="en">
        <SetupScreen hasSave={false} onContinue={() => {}} onNewGame={() => {}} />
      </I18nProvider>,
    );
    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument();
    unmount();

    const { onContinue, onNewGame } = mount({ hasSave: true });
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onContinue).toHaveBeenCalledOnce();
    expect(onNewGame).not.toHaveBeenCalled();
  });

  it('shows Traditional Chinese title under zh-Hant', () => {
    mount({ lang: 'zh-Hant' });
    expect(screen.getByRole('heading', { level: 1, name: '創立你的貨代公司' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '台北' })).toBeInTheDocument();
  });
});
