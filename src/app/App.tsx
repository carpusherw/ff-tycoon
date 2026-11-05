import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { t as translate } from '../i18n';
import { I18nProvider } from '../i18n/I18nProvider';
import { createGame } from '../rules/newGame';
import type { GameState } from '../rules/types';
import type { HomePortId } from '../rules/world';
import { applyTheme, resolveTheme, type ThemePref } from '../theme/theme';
import { EndScreen } from '../ui/EndScreen';
import { EndTransition } from '../ui/EndTransition';
import { GameScreen } from '../ui/GameScreen';
import { SetupScreen } from '../ui/SetupScreen';
import { clearGame, getStorage, loadGame, loadSettings, saveGame, saveSettings, type Settings } from './persistence';
import { createGameStore, useGameState, type GameStore } from './store';

type Screen = { kind: 'setup'; save: GameState | null } | { kind: 'game'; store: GameStore };

const DARK_QUERY = '(prefers-color-scheme: dark)';

function browserLanguages(): readonly string[] {
  if (navigator.languages?.length) return navigator.languages;
  return navigator.language ? [navigator.language] : [];
}

function browserMatchMedia(): ((q: string) => MediaQueryList) | undefined {
  return typeof window.matchMedia === 'function' ? (q) => window.matchMedia(q) : undefined;
}

/** Applies the theme now and, while the setting is `system`, again whenever the browser's scheme changes. */
function useTheme(pref: ThemePref): void {
  useLayoutEffect(() => {
    const matchMedia = browserMatchMedia();
    const apply = () => applyTheme(resolveTheme(pref, matchMedia));
    apply();
    if (pref !== 'system' || !matchMedia) return;
    let query: MediaQueryList;
    try {
      query = matchMedia(DARK_QUERY);
      query.addEventListener('change', apply);
    } catch {
      return;
    }
    return () => query.removeEventListener('change', apply);
  }, [pref]);
}

export function App() {
  const [storage] = useState(getStorage);
  const [settings, setSettings] = useState<Settings>(() => loadSettings(storage, browserLanguages()));
  // Whether the last save failed, kept here so the warning outlives the switch from the board to the end screen.
  const [saveFailed, setSaveFailed] = useState(false);
  const onSaved = useCallback((ok: boolean) => setSaveFailed(!ok), []);
  const [screen, setScreen] = useState<Screen>(() => {
    const save = loadGame(storage);
    return save?.ended ? { kind: 'game', store: createGameStore(save) } : { kind: 'setup', save };
  });

  useTheme(settings.theme);

  useEffect(() => {
    document.documentElement.lang = settings.lang;
    document.title = translate(settings.lang, 'app.title');
  }, [settings.lang]);

  const startNewGame = useCallback(
    (homePortId: HomePortId) => {
      const s = createGame({ seed: Date.now() >>> 0, homePortId, mode: 'normal' });
      onSaved(saveGame(storage, s));
      setScreen({ kind: 'game', store: createGameStore(s) });
    },
    [storage, onSaved],
  );

  const changeSettings = useCallback(
    (next: Settings) => {
      setSettings(next);
      saveSettings(storage, next);
    },
    [storage],
  );

  const playAgain = useCallback(() => {
    clearGame(storage);
    setScreen({ kind: 'setup', save: null });
  }, [storage]);

  let content;
  if (screen.kind === 'setup') {
    const { save } = screen;
    content = (
      <SetupScreen
        hasSave={save !== null}
        onContinue={() => save && setScreen({ kind: 'game', store: createGameStore(save) })}
        onNewGame={startNewGame}
      />
    );
  } else {
    content = (
      <RunningGame
        store={screen.store}
        settings={settings}
        onSettingsChange={changeSettings}
        onPlayAgain={playAgain}
        saveFailed={saveFailed}
        onSaved={onSaved}
      />
    );
  }

  return <I18nProvider lang={settings.lang}>{content}</I18nProvider>;
}

function RunningGame(props: {
  store: GameStore;
  settings: Settings;
  onSettingsChange: (next: Settings) => void;
  onPlayAgain: () => void;
  saveFailed: boolean;
  onSaved: (ok: boolean) => void;
}) {
  const state = useGameState(props.store, (s) => s);
  return (
    <EndTransition
      ended={state.ended}
      board={
        <GameScreen
          store={props.store}
          settings={props.settings}
          onSettingsChange={props.onSettingsChange}
          onNewGame={props.onPlayAgain}
          saveFailed={props.saveFailed}
          onSaved={props.onSaved}
        />
      }
      end={<EndScreen state={state} onPlayAgain={props.onPlayAgain} saveFailed={props.saveFailed} />}
    />
  );
}
