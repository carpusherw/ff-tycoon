import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Settings } from '../app/persistence';
import { useGameState, type GameStore } from '../app/store';
import { useGameClock } from '../app/useGameClock';
import { useT } from '../i18n/I18nProvider';
import type { MsgKey } from '../i18n';
import { DepartmentBoard } from './DepartmentBoard';
import { HiringDialog } from './HiringDialog';
import { PauseBanner } from './PauseBanner';
import { HireSection, LogSection, MoneySection, OwnerSection, SettingsSection, SidePanel } from './SidePanel';
import { TopBar } from './TopBar';

export const NARROW_QUERY = '(max-width: 768px)';

export interface GameScreenProps {
  store: GameStore;
  settings: Settings;
  onSettingsChange: (next: Settings) => void;
  onNewGame: () => void;
}

/** Whether a media query matches, kept up to date; false when the browser can't tell. */
function useMediaQuery(query: string): boolean {
  const read = () => {
    try {
      return typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
    } catch {
      return false;
    }
  };
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    let list: MediaQueryList;
    try {
      list = window.matchMedia(query);
    } catch {
      return;
    }
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener?.('change', update);
    return () => list.removeEventListener?.('change', update);
  }, [query]);
  return matches;
}

type Tab = 'departments' | 'hiring' | 'money' | 'log' | 'settings';
const TABS: { id: Tab; key: MsgKey }[] = [
  { id: 'departments', key: 'tab.departments' },
  { id: 'hiring', key: 'tab.hiring' },
  { id: 'money', key: 'tab.money' },
  { id: 'log', key: 'tab.log' },
  { id: 'settings', key: 'tab.settings' },
];

export function GameScreen({ store, settings, onSettingsChange, onNewGame }: GameScreenProps) {
  const state = useGameState(store, (s) => s);
  const clock = useGameClock(store, settings);
  const narrow = useMediaQuery(NARROW_QUERY);
  const hiringOpen = state.hiring !== null;
  const { pauseFor } = clock;
  // The job-ad button that opened the dialog gets focus back when it closes.
  const openerRef = useRef<HTMLElement | null>(null);
  const onHireOpen = useCallback((el: HTMLElement) => {
    openerRef.current = el;
  }, []);

  // The clock holds still while you pick a candidate, then comes back to the speed you had.
  useEffect(() => {
    if (!hiringOpen || !settings.autoPause) return;
    return pauseFor('hiring');
  }, [hiringOpen, settings.autoPause, pauseFor]);

  const settingsProps = { settings, onSettingsChange, onNewGame };
  const sections: Record<Tab, ReactNode> = {
    departments: <DepartmentBoard state={state} />,
    hiring: (
      <>
        <HireSection store={store} state={state} onOpen={onHireOpen} />
        <OwnerSection store={store} state={state} />
      </>
    ),
    money: <MoneySection state={state} />,
    log: <LogSection state={state} />,
    settings: <SettingsSection {...settingsProps} />,
  };

  return (
    <div className={narrow ? 'game is-narrow' : 'game'}>
      {/* While the hiring dialog is open everything behind it is inert: no clicks, no focus, hidden from screen readers. */}
      <div className="game-body" inert={hiringOpen}>
        <TopBar state={state} speed={clock.speed} onSpeed={clock.setSpeed} locked={clock.locked} />
        <PauseBanner reasons={state.pauseReasons} onResume={clock.resume} />
        {narrow ? (
          <main className="game-main">
            {/* Task 17 mounts the world map here, above the tabs. */}
            <PhoneTabs sections={sections} />
          </main>
        ) : (
          <main className="game-main game-grid">
            <div className="game-left">
              {/* Task 17 mounts the world map here, above the departments. */}
              {sections.departments}
            </div>
            <SidePanel store={store} state={state} onHireOpen={onHireOpen} {...settingsProps} />
          </main>
        )}
      </div>
      <HiringDialog store={store} returnFocusRef={openerRef} />
    </div>
  );
}

function PhoneTabs({ sections }: { sections: Record<Tab, ReactNode> }) {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>('departments');
  const base = useId();
  const tabId = (id: Tab) => `${base}-tab-${id}`;
  const panelId = (id: Tab) => `${base}-panel-${id}`;

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    const next = TABS[(TABS.findIndex((x) => x.id === tab) + step + TABS.length) % TABS.length].id;
    setTab(next);
    document.getElementById(tabId(next))?.focus();
  };

  return (
    <>
      <div className="tabs" role="tablist" onKeyDown={onKeyDown}>
        {TABS.map(({ id, key }) => (
          <button
            key={id}
            id={tabId(id)}
            type="button"
            role="tab"
            className="tab"
            aria-selected={tab === id}
            aria-controls={tab === id ? panelId(id) : undefined}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
          >
            {t(key)}
          </button>
        ))}
      </div>
      <div className="tab-panel" role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)}>
        {sections[tab]}
      </div>
    </>
  );
}
