import { useCallback, useEffect, useRef, useState } from 'react';
import { B } from '../rules/balance';
import { stepDay } from '../rules/step';
import type { GameState } from '../rules/types';
import { createClock, type Clock, type Speed } from './clock';
import { getStorage, saveGame, type Settings } from './persistence';
import { useGameState, type GameStore } from './store';

export interface GameClock {
  speed: Speed;
  /** Changes the speed; playing (1× / 3×) is ignored while the clock is `locked`. */
  setSpeed(v: Speed): void;
  /** True while a pause reason stops the clock or a `pauseFor` hold is active: only Resume or the hold's end restarts it. */
  locked: boolean;
  /** How far the current in-game day has run (0 to 1), for smooth ship movement. */
  fraction: () => number;
  /** Clears the pause reasons and plays at 1× (once any `pauseFor` hold has ended). */
  resume(): void;
  /** Pauses until the returned function is called, which brings back the speed from before. */
  pauseFor(reason: string): () => void;
}

/** Year ends only stop the clock with auto-pause on; bankruptcy and the end of the run always do. */
function mustPause(s: GameState, autoPause: boolean): boolean {
  if (s.pauseReasons.length === 0) return false;
  return autoPause || s.pauseReasons.includes('bankrupt') || s.pauseReasons.includes('runEnded');
}

const monthOf = (day: number) => Math.floor(day / B.daysPerMonth);

/** Plays the game in real time: steps the rules, auto-pauses and saves. */
export function useGameClock(store: GameStore, settings: Settings): GameClock {
  const [speed, setSpeedState] = useState<Speed>(() => (mustPause(store.getState(), settings.autoPause) ? 0 : 1));
  const speedRef = useRef(speed);
  const autoPauseRef = useRef(settings.autoPause);
  const clockRef = useRef<Clock | null>(null);
  const holdsRef = useRef({ active: new Set<{ reason: string }>(), restoreTo: 1 as Speed });
  const [held, setHeld] = useState(false);
  const blocked = useGameState(store, (s) => mustPause(s, settings.autoPause));

  useEffect(() => {
    autoPauseRef.current = settings.autoPause;
  }, [settings.autoPause]);

  const applySpeed = useCallback((v: Speed) => {
    speedRef.current = v;
    clockRef.current?.setSpeed(v);
    setSpeedState(v);
  }, []);

  const setSpeed = useCallback(
    (v: Speed) => {
      const holds = holdsRef.current;
      if (holds.active.size > 0) {
        // Pausing during a hold is remembered for when the hold ends; playing waits for it.
        if (v === 0) holds.restoreTo = 0;
        return;
      }
      if (v !== 0 && mustPause(store.getState(), autoPauseRef.current)) return;
      applySpeed(v);
    },
    [store, applySpeed],
  );

  useEffect(() => {
    const clock = createClock({
      now: () => Date.now(),
      dayMs: B.dayMs,
      ...B.clock,
      onDays(n) {
        const before = store.getState();
        store.update((s) => {
          for (let i = 0; i < n; i++) {
            stepDay(s);
            // Intended: stop on the exact pause day, so 3× or catch-up never plays past it.
            if (mustPause(s, autoPauseRef.current)) break;
          }
        });
        const after = store.getState();
        if (monthOf(after.day) !== monthOf(before.day)) saveGame(getStorage(), after);
        if (mustPause(after, autoPauseRef.current)) applySpeed(0);
      },
    });
    clock.setSpeed(speedRef.current);
    clock.start();
    clockRef.current = clock;

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') saveGame(getStorage(), store.getState());
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clock.stop();
      clockRef.current = null;
    };
  }, [store, applySpeed]);

  const fraction = useCallback(() => clockRef.current?.fraction() ?? 0, []);

  const resume = useCallback(() => {
    store.update((s) => {
      s.pauseReasons = [];
    });
    const holds = holdsRef.current;
    if (holds.active.size > 0) holds.restoreTo = 1;
    else applySpeed(1);
  }, [store, applySpeed]);

  const pauseFor = useCallback(
    (reason: string) => {
      const holds = holdsRef.current;
      if (holds.active.size === 0) holds.restoreTo = speedRef.current;
      const hold = { reason };
      holds.active.add(hold);
      setHeld(true);
      applySpeed(0);
      return () => {
        if (!holds.active.delete(hold)) return;
        if (holds.active.size > 0) return;
        setHeld(false);
        // A pause reason that arrived during the hold still keeps the clock stopped.
        applySpeed(mustPause(store.getState(), autoPauseRef.current) ? 0 : holds.restoreTo);
      };
    },
    [store, applySpeed],
  );

  return { speed, setSpeed, locked: held || blocked, fraction, resume, pauseFor };
}
