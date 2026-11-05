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
import { SetupScreen, type SetupScreenProps } from '../ui/SetupScreen';
import {
  backupSave,
  clearGame,
  getStorage,
  loadSettings,
  readSave,
  saveGame,
  saveSettings,
  type Settings,
} from './persistence';
import { createGameStore, useGameState, type GameStore } from './store';

type Screen =
  | { kind: 'setup'; save: GameState | null; loadFailed?: SetupScreenProps['loadFailed'] }
  | { kind: 'game'; store: GameStore };

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
  // Storage is looked up for each read or write, like the clock's saves: storage blocked when the page loaded may be
  // open later (the end screen's retry), and every write after that must reach it too.
  const [settings, setSettings] = useState<Settings>(() => loadSettings(getStorage(), browserLanguages()));
  // Whether the last save failed, kept here so the warning outlives the switch from the board to the end screen.
  const [saveFailed, setSaveFailed] = useState(false);
  const onSaved = useCallback((ok: boolean) => setSaveFailed(!ok), []);
  // Reading a save that can't be loaded backs it up here, before the player can start a new game over it.
  const [screen, setScreen] = useState<Screen>(() => {
    const read = readSave(getStorage());
    if (read.kind === 'unreadable') {
      return { kind: 'setup', save: null, loadFailed: read.backedUp ? 'backedUp' : 'notBackedUp' };
    }
    const save = read.kind === 'loaded' ? read.state : null;
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
      onSaved(saveGame(getStorage(), s));
      setScreen({ kind: 'game', store: createGameStore(s) });
    },
    [onSaved],
  );

  const changeSettings = useCallback(
    (next: Settings) => {
      setSettings(next);
      saveSettings(getStorage(), next);
    },
    [],
  );

  const playAgain = useCallback(() => {
    clearGame(getStorage());
    setScreen({ kind: 'setup', save: null });
  }, []);

  // The player confirmed throwing away the running game: save its latest progress and keep that in the backup slot
  // first. A backup that can't be written doesn't stop the new game.
  const newGameFromSettings = useCallback(
    (store: GameStore) => {
      const storage = getStorage();
      saveGame(storage, store.getState());
      backupSave(storage);
      playAgain();
    },
    [playAgain],
  );

  let content;
  if (screen.kind === 'setup') {
    const { save } = screen;
    content = (
      <SetupScreen
        hasSave={save !== null}
        savedDay={save?.day}
        loadFailed={screen.loadFailed}
        onContinue={() => save && setScreen({ kind: 'game', store: createGameStore(save) })}
        onNewGame={(homePortId) => {
          // Confirmed over a run that loaded fine: keep it in the backup slot, but start even if that can't be written.
          if (save) backupSave(getStorage());
          startNewGame(homePortId);
        }}
      />
    );
  } else {
    content = (
      <RunningGame
        store={screen.store}
        settings={settings}
        onSettingsChange={changeSettings}
        onPlayAgain={playAgain}
        onNewGame={() => newGameFromSettings(screen.store)}
        saveFailed={saveFailed}
        onSaved={onSaved}
        onRetrySave={() => {
          const ok = saveGame(getStorage(), screen.store.getState());
          onSaved(ok);
          return ok;
        }}
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
  onNewGame: () => void;
  saveFailed: boolean;
  onSaved: (ok: boolean) => void;
  onRetrySave: () => boolean;
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
          onNewGame={props.onNewGame}
          saveFailed={props.saveFailed}
          onSaved={props.onSaved}
        />
      }
      end={
        <EndScreen state={state} onPlayAgain={props.onPlayAgain} saveFailed={props.saveFailed} onRetrySave={props.onRetrySave} />
      }
    />
  );
}
