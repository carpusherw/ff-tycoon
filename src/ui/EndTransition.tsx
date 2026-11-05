import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useT } from '../i18n/I18nProvider';
import type { GameState } from '../rules/types';
import { useMediaQuery } from './useMediaQuery';

type Ended = NonNullable<GameState['ended']>;
type EndReason = Ended['reason'];

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** How long each part of the end-of-run transition lasts, in milliseconds. */
export const END_TIMING = {
  hold: { completed: 2500, bankrupt: 1800 } satisfies Record<EndReason, number>,
  fade: 600,
  quickFade: 300,
} as const;

/** Where each firework bursts (percent of the screen) and when it goes off (ms). */
const BURSTS = [
  { x: 22, y: 30, delay: 0 },
  { x: 76, y: 24, delay: 300 },
  { x: 50, y: 14, delay: 650 },
  { x: 30, y: 54, delay: 1000 },
  { x: 70, y: 50, delay: 1250 },
  { x: 50, y: 34, delay: 1450 },
];
const SPARKS = 14;

/** celebrate: the frozen board under the fireworks or stamp; reveal: the end screen fading in over it. */
type Stage = 'celebrate' | 'reveal' | 'done';

export interface EndTransitionProps {
  ended: GameState['ended'];
  /** The game screen, shown while playing and frozen under the celebration. */
  board: ReactNode;
  /** The end screen. */
  end: ReactNode;
}

/**
 * Plays the end of a run: the board freezes, fireworks (a completed run) or a Closed stamp (bankruptcy)
 * go over it, then the end screen fades in. Any click or key skips to the end screen. A run that had
 * already ended when it was opened goes straight to the end screen.
 */
export function EndTransition({ ended, board, end }: EndTransitionProps) {
  const { t } = useT();
  const reduced = useMediaQuery(REDUCED_MOTION);
  const [endedOnOpen] = useState(ended !== null);
  const [stage, setStage] = useState<Stage>(endedOnOpen ? 'done' : 'celebrate');
  const reason = ended?.reason ?? null;
  const playing = reason !== null && stage !== 'done';

  useEffect(() => {
    if (!reason || stage === 'done') return;
    const ms = stage === 'celebrate' ? END_TIMING.hold[reason] : reduced ? END_TIMING.quickFade : END_TIMING.fade;
    const id = setTimeout(() => setStage(stage === 'celebrate' ? 'reveal' : 'done'), ms);
    return () => clearTimeout(id);
  }, [reason, stage, reduced]);

  useEffect(() => {
    if (!playing) return;
    const skip = () => setStage('done');
    // Plain keys are only a skip; shortcuts like reloading the page keep working.
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
      skip();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('click', skip, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('click', skip, true);
    };
  }, [playing]);

  const announcement =
    reason && !endedOnOpen ? t(reason === 'bankrupt' ? 'end.announceBankrupt' : 'end.announceCompleted') : '';

  // Each slot keeps its place, so the end screen isn't remounted when the fade finishes.
  return (
    <>
      {reason === null || stage !== 'done' ? board : null}
      {reason !== null && stage !== 'done' ? <EndCelebration reason={reason} still={reduced} /> : null}
      {reason !== null && stage !== 'celebrate' ? (
        <div className={stage === 'reveal' ? (reduced ? 'end-reveal is-quick' : 'end-reveal') : undefined}>{end}</div>
      ) : null}
      {/* Always there, so the one announcement is made when it fills in. */}
      <p className="sr-only" role="status">
        {announcement}
      </p>
    </>
  );
}

/** The layer over the frozen board: fireworks and a caption, or the Closed stamp. `still` drops all motion. */
function EndCelebration({ reason, still }: { reason: EndReason; still: boolean }) {
  const { t } = useT();
  const className = `end-fx is-${reason}${still ? ' is-still' : ''}`;
  if (reason === 'bankrupt') {
    return (
      <div className={className} aria-hidden="true">
        <span className="end-stamp">{t('end.fxClosed')}</span>
      </div>
    );
  }
  return (
    <div className={className} aria-hidden="true">
      {!still &&
        BURSTS.map((b, i) => (
          <span
            key={i}
            className="fx-burst"
            style={{ left: `${b.x}%`, top: `${b.y}%`, '--fx-delay': `${b.delay}ms` } as CSSProperties}
          >
            {Array.from({ length: SPARKS }, (_, j) => (
              <i key={j} className="fx-spark" style={{ '--fx-angle': `${(360 / SPARKS) * j}deg` } as CSSProperties} />
            ))}
          </span>
        ))}
      <span className="end-caption">{t('end.fxCompleted')}</span>
    </div>
  );
}
