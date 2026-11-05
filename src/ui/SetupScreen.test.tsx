import { render, screen, within } from '@testing-library/react';
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

  it.each<[Lang, string, string, string]>([
    ['en', "Your old save couldn't be read or backed up. Start a new game and discard it?", 'Cancel', 'Start new game'],
    ['zh-Hant', '你的舊存檔無法讀取，也無法備份。要開始新遊戲並捨棄它嗎？', '取消', '開始新遊戲'],
    ['zh-Hans', '你的旧存档无法读取，也无法备份。要开始新游戏并舍弃它吗？', '取消', '开始新游戏'],
  ])('with no backup kept, a city asks before starting over (%s)', async (lang, question, cancel, start) => {
    const onNewGame = vi.fn();
    render(
      <I18nProvider lang={lang}>
        <SetupScreen hasSave={false} loadFailed="notBackedUp" onContinue={() => {}} onNewGame={onNewGame} />
      </I18nProvider>,
    );
    await userEvent.click(screen.getAllByRole('button')[1]);
    const dialog = screen.getByRole('dialog', { name: question });
    expect(within(dialog).getByRole('button', { name: cancel })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole('button', { name: cancel }));
    expect(onNewGame).not.toHaveBeenCalled();
    await userEvent.click(screen.getAllByRole('button')[1]);
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: start }));
    expect(onNewGame).toHaveBeenCalledExactlyOnceWith('SHA');
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
