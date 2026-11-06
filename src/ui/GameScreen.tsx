import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Speed } from '../app/clock';
import type { Settings } from '../app/persistence';
import { useGameState, type GameStore } from '../app/store';
import { useGameClock } from '../app/useGameClock';
import { useT } from '../i18n/I18nProvider';
import type { MsgKey } from '../i18n';
import { moveOwner, startHiring } from '../rules/staff';
import type { DeptKey } from '../rules/types';
import { runAction } from './actions';
import { DepartmentBoard, type HireError } from './DepartmentBoard';
import { HiringDialog } from './HiringDialog';
import { HotkeyHelpDialog } from './HotkeyHelpDialog';
import { HotkeyHoldContext, useHotkeys } from './useHotkeys';
import { WorldMap } from './map/WorldMap';
import { OfficeSwitcher, stepOffice } from './OfficeSwitcher';
import { PauseBanner } from './PauseBanner';
import { SettingsDialog } from './SettingsDialog';
import { LogSection, MoneySection, SidePanel } from './SidePanel';
import { TopBar } from './TopBar';
import { useMediaQuery } from './useMediaQuery';
import { YearReportDialog } from './YearReportDialog';

export const NARROW_QUERY = '(max-width: 768px)';
/**
 * Touch only: some input is a finger, and none is a precise pointer or can hover. Then there's most likely
 * no keyboard to use the shortcuts with, so the shortcuts button is left out. Any mouse, trackpad or pen
 * keeps it. Browsers can't report a keyboard, so a tablet with only a keyboard attached counts as touch only.
 */
function useTouchOnly(): boolean {
  const coarse = useMediaQuery('(any-pointer: coarse)');
  const fine = useMediaQuery('(any-pointer: fine)');
  const hover = useMediaQuery('(any-hover: hover)');
  return coarse && !fine && !hover;
}

export interface GameScreenProps {
  store: GameStore;
  settings: Settings;
  onSettingsChange: (next: Settings) => void;
  onNewGame: () => void;
  /** The last save failed; a warning shows until a save works again. */
  saveFailed?: boolean;
  /** Told whether each of the clock's saves worked. */
  onSaved?: (ok: boolean) => void;
}

type Tab = 'offices' | 'money' | 'log';
const TABS: { id: Tab; key: MsgKey }[] = [
  { id: 'offices', key: 'tab.offices' },
  { id: 'money', key: 'tab.money' },
  { id: 'log', key: 'tab.log' },
];

export function GameScreen({
  store,
  settings,
  onSettingsChange,
  onNewGame,
  saveFailed = false,
  onSaved,
}: GameScreenProps) {
  const { t } = useT();
  const state = useGameState(store, (s) => s);
  const clock = useGameClock(store, settings, onSaved);
  const narrow = useMediaQuery(NARROW_QUERY);
  const touchOnly = useTouchOnly();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [hireError, setHireError] = useState<HireError | null>(null);
  // The office on screen: the owner's at first, and theirs again if the chosen one is gone.
  const ownerOfficeId = state.employees.find((e) => e.isOwner)?.officeId ?? state.offices[0]?.id ?? '';
  const [chosenOfficeId, setViewedOfficeId] = useState(ownerOfficeId);
  const viewedOfficeId = state.offices.some((o) => o.id === chosenOfficeId) ? chosenOfficeId : ownerOfficeId;
  // The phone's section tab and department tab live here, so a job ad's outcome can bring its department on screen.
  const [phoneTab, setPhoneTab] = useState<Tab>('offices');
  const [deptTab, setDeptTab] = useState<DeptKey>(() => state.employees.find((e) => e.isOwner)?.dept ?? 'sales');
  /** Puts an office's department on screen: that office, and on the phone the Offices tab and that department. */
  const reveal = useCallback((officeId: string, dept: DeptKey) => {
    setViewedOfficeId(officeId);
    setPhoneTab('offices');
    setDeptTab(dept);
  }, []);
  /** Puts an office on screen from the map: that office, and on the phone the Offices tab with its board. */
  const showOffice = useCallback((officeId: string) => {
    setViewedOfficeId(officeId);
    setPhoneTab('offices');
  }, []);
  const gearRef = useRef<HTMLButtonElement>(null);
  // Popovers that hold the game's keys while open (the "+N" staff list), counted.
  const [holds, setHolds] = useState(0);
  const hold = useCallback((held: boolean) => setHolds((n) => n + (held ? 1 : -1)), []);
  // Once the run has ended the board is frozen under the end-of-run celebration: no dialogs, no keys, no clicks.
  const frozen = state.ended !== null;
  const hiringOpen = state.hiring !== null && !frozen;
  // A year end with auto-pause on gets the year's report as a modal; old saves without a report keep the banner.
  // It waits for any other open dialog, so only one dialog listens for Escape at a time.
  const lastReport = state.yearReports.at(-1) ?? null;
  const yearEnded = settings.autoPause && state.pauseReasons.includes('yearEnd');
  const report = yearEnded && !frozen && !hiringOpen && !settingsOpen && !helpOpen ? lastReport : null;
  const modalOpen = hiringOpen || report !== null || settingsOpen || helpOpen;
  const bannerReasons = report ? state.pauseReasons.filter((r) => r !== 'yearEnd') : state.pauseReasons;
  const { pauseFor } = clock;
  const rootRef = useRef<HTMLDivElement>(null);
  // The office and department of the open (or last) hiring session, which may have come from a save.
  const session = useRef<{ officeId: string; dept: DeptKey } | null>(null);
  useEffect(() => {
    if (state.hiring) session.current = { officeId: state.hiring.officeId, dept: state.hiring.dept };
  }, [state.hiring]);
  // After hiring, that office and department come on screen and focus goes to its Hire button (else the game
  // itself), so keyboard users never land on the bare page. The button is focused once it has rendered.
  const [focusHire, setFocusHire] = useState<{ dept: DeptKey } | null>(null);
  const returnFocus = useCallback(
    (dept: DeptKey) => {
      const officeId = session.current?.dept === dept ? session.current.officeId : null;
      if (officeId && store.getState().offices.some((o) => o.id === officeId)) reveal(officeId, dept);
      setFocusHire({ dept });
    },
    [store, reveal],
  );
  useEffect(() => {
    if (!focusHire) return;
    const root = rootRef.current;
    (root?.querySelector<HTMLElement>(`[data-hire-dept="${focusHire.dept}"]:not(:disabled)`) ?? root)?.focus();
  }, [focusHire]);
  const focusRoot = useCallback(() => rootRef.current?.focus(), []);
  const workHere = useCallback(
    (dept: DeptKey) => store.update((s) => moveOwner(s, dept, viewedOfficeId)),
    [store, viewedOfficeId],
  );
  // Pays for a job ad; an open session would be charged again and replaced, so there's never a second one.
  const postJobAd = useCallback(
    (officeId: string, dept: DeptKey) => {
      if (!officeId || store.getState().hiring) return;
      const r = runAction(store, (s) => startHiring(s, officeId, dept));
      setHireError(r.ok ? null : { officeId, dept, reason: r.reason });
      // A refusal is shown under that office's department, so it comes on screen.
      if (!r.ok) reveal(officeId, dept);
    },
    [store, reveal],
  );
  const hireHere = useCallback((dept: DeptKey) => postJobAd(viewedOfficeId, dept), [postJobAd, viewedOfficeId]);

  // The clock holds still while you pick a candidate, then comes back to the speed you had.
  useEffect(() => {
    if (!hiringOpen || !settings.autoPause) return;
    return pauseFor('hiring');
  }, [hiringOpen, settings.autoPause, pauseFor]);
  // Settings and the shortcut list are menus the player opened, so they hold the clock even with auto-pause off.
  useEffect(() => {
    if (!settingsOpen) return;
    return pauseFor('settings');
  }, [settingsOpen, pauseFor]);
  useEffect(() => {
    if (!helpOpen) return;
    return pauseFor('help');
  }, [helpOpen, pauseFor]);

  const play = (v: Speed) => () => {
    if (!clock.locked) clock.setSpeed(v);
  };
  const moveTo = (dept: DeptKey) => () => {
    // Moving sends the owner's open tasks back to the queue, so the key for where they already are does nothing.
    const owner = store.getState().employees.find((e) => e.isOwner);
    if (owner?.dept !== dept || owner.officeId !== viewedOfficeId) workHere(dept);
  };
  const stepTo = (step: 1 | -1) => () => {
    const id = stepOffice(store.getState(), viewedOfficeId, step);
    if (id) setViewedOfficeId(id);
  };
  // The game's own keys; each dialog brings its own keys while it's open.
  useHotkeys(!frozen && !modalOpen && holds === 0, {
    space: () => {
      // A pause reason holding the clock is cleared the way the banner's Resume does it; either way
      // play comes back at the last speed played.
      if (clock.locked) clock.resume();
      else clock.setSpeed(clock.speed === 0 ? clock.lastSpeed : 0);
    },
    '1': play(1),
    '3': play(3),
    '5': play(5),
    s: moveTo('sales'),
    o: moveTo('ops'),
    a: moveTo('accounting'),
    h: () => {
      const owner = store.getState().employees.find((e) => e.isOwner);
      if (owner) postJobAd(owner.officeId, owner.dept);
    },
    'shift+s': () => hireHere('sales'),
    'shift+o': () => hireHere('ops'),
    'shift+a': () => hireHere('accounting'),
    '[': stepTo(-1),
    ']': stepTo(1),
    '?': () => setHelpOpen(true),
  });

  const switcher = <OfficeSwitcher state={state} officeId={viewedOfficeId} onSelect={setViewedOfficeId} />;
  const board = (
    <DepartmentBoard
      state={state}
      officeId={viewedOfficeId}
      onWorkHere={workHere}
      onHire={hireHere}
      hireError={hireError}
      scrollTasks={!narrow}
      layout={narrow ? 'tabs' : 'columns'}
      deptTab={deptTab}
      onDeptTab={setDeptTab}
    />
  );
  const sections: Record<Tab, ReactNode> = {
    offices: (
      <>
        {switcher}
        {board}
      </>
    ),
    money: <MoneySection state={state} />,
    log: <LogSection state={state} />,
  };

  return (
    // The screen is exactly the viewport's height, so growing queues scroll in place instead of moving the page.
    <HotkeyHoldContext.Provider value={hold}>
      <div ref={rootRef} className={narrow ? 'game is-fixed-height is-narrow' : 'game is-fixed-height'} tabIndex={-1}>
        {/* Outside the board, which goes inert under dialogs and the end of the run; once frozen it sits above
            the celebration. Play goes on, and the next save that works clears it. */}
        {saveFailed && (
          <p className={frozen ? 'card save-warning is-raised' : 'card save-warning'} role="alert">
            {t('save.failed')}
          </p>
        )}
        {/* While a dialog is open everything behind it is inert: no clicks, no focus, hidden from screen readers. */}
        <div className="game-body" inert={modalOpen || frozen}>
          <TopBar
            state={state}
            speed={clock.speed}
            onSpeed={clock.setSpeed}
            locked={clock.locked}
            onSettings={() => setSettingsOpen(true)}
            gearRef={gearRef}
            onHelp={touchOnly ? undefined : () => setHelpOpen(true)}
          />
          {/* The end-of-run overlay carries the message, so the banner steps aside. */}
          {!frozen && <PauseBanner reasons={bannerReasons} onResume={clock.resume} />}
          {narrow ? (
            <main className="game-main">
              <WorldMap
                state={state}
                fraction={clock.fraction}
                compact
                store={store}
                viewedOfficeId={viewedOfficeId}
                onSelectOffice={showOffice}
                onOfficeOpened={showOffice}
                popupVariant="sheet"
              />
              <PhoneTabs sections={sections} tab={phoneTab} onTab={setPhoneTab} />
            </main>
          ) : (
            <main className="game-main game-grid">
              <div className="game-left">
                <WorldMap
                  state={state}
                  fraction={clock.fraction}
                  store={store}
                  viewedOfficeId={viewedOfficeId}
                  onSelectOffice={showOffice}
                  onOfficeOpened={showOffice}
                  popupVariant="anchored"
                />
                {switcher}
                {board}
              </div>
              <SidePanel state={state} />
            </main>
          )}
        </div>
        {!frozen && (
          <>
            <HiringDialog store={store} onClosed={returnFocus} />
            <YearReportDialog report={report} onContinue={clock.resume} onClosed={focusRoot} />
            <HotkeyHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} onClosed={focusRoot} />
            <SettingsDialog
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              returnFocus={gearRef}
              settings={settings}
              onSettingsChange={onSettingsChange}
              onNewGame={onNewGame}
            />
          </>
        )}
      </div>
    </HotkeyHoldContext.Provider>
  );
}

function PhoneTabs({ sections, tab, onTab: setTab }: { sections: Record<Tab, ReactNode>; tab: Tab; onTab: (tab: Tab) => void }) {
  const { t } = useT();
  const board = tab === 'offices';
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
      <div className="tabs" role="tablist" aria-label={t('tab.label')} onKeyDown={onKeyDown}>
        {TABS.map(({ id, key }) => (
          <button
            key={id}
            id={tabId(id)}
            type="button"
            role="tab"
            data-tab={id}
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
      {/* Under the fixed top bar, map and tabs, the panel is the scroll area, except on the board,
          where the department tabs and column header stay put and the task list scrolls. */}
      <div
        className={board ? 'tab-panel is-board' : 'tab-panel scroll'}
        role="tabpanel"
        id={panelId(tab)}
        aria-labelledby={tabId(tab)}
        tabIndex={board ? undefined : 0}
      >
        {sections[tab]}
      </div>
    </>
  );
}
