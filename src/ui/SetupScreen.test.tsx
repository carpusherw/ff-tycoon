import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Lang } from '../i18n';
import { I18nProvider } from '../i18n/I18nProvider';
import { SetupScreen, type SetupScreenProps } from './SetupScreen';

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

  it.each<[Lang, NonNullable<SetupScreenProps['loadFailed']>, string]>([
    ['en', 'backedUp', "We couldn't load your saved game, so we kept a backup and you can start fresh."],
    ['en', 'notBackedUp', "We couldn't load your saved game. You can start fresh."],
    ['zh-Hant', 'backedUp', '無法載入你的存檔，我們已保留一份備份，你可以重新開始。'],
    ['zh-Hant', 'notBackedUp', '無法載入你的存檔，你可以重新開始。'],
    ['zh-Hans', 'backedUp', '无法加载你的存档，我们已保留一份备份，你可以重新开始。'],
    ['zh-Hans', 'notBackedUp', '无法加载你的存档，你可以重新开始。'],
  ])('a save that could not be loaded shows a one-line notice (%s, %s)', (lang, loadFailed, text) => {
    render(
      <I18nProvider lang={lang}>
        <SetupScreen hasSave={false} loadFailed={loadFailed} onContinue={() => {}} onNewGame={() => {}} />
      </I18nProvider>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(text);
  });

  it('shows no notice when nothing failed to load', () => {
    mount();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows Traditional Chinese title under zh-Hant', () => {
    mount({ lang: 'zh-Hant' });
    expect(screen.getByRole('heading', { level: 1, name: '創立你的貨代公司' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '台北' })).toBeInTheDocument();
  });
});
