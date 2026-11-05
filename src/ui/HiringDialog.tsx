import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { useGameState, type GameStore } from '../app/store';
import { useT } from '../i18n/I18nProvider';
import type { MsgKey } from '../i18n';
import { B } from '../rules/balance';
import { cancelHiring, hireCandidate, rerollCandidates } from '../rules/staff';
import type { Candidate, DeptKey, GameState, Result } from '../rules/types';
import { COUNTRIES } from '../rules/world';
import { runAction } from './actions';
import { DEPT_KEYS, oneDecimal } from './format';
import { DiceIcon } from './Icons';
import type { HotkeyMap } from './useHotkeys';
import { useModalKeys } from './useModalKeys';

const HIRE_KEYS = ['1', '2', '3'];

const MAX_SKILL = Math.max(...Object.values(COUNTRIES).map((c) => c.pool.skillMult));
const PIP_MAX = {
  speed: B.hiring.speed[1] * MAX_SKILL,
  capacity: Math.max(...Object.values(B.hiring.capacity).map(([, max]) => max)),
  winRate: B.hiring.winRate[1] * MAX_SKILL,
};

export interface HiringDialogProps {
  store: GameStore;
  /** Called after the dialog closes with the department it was hiring for, so focus can go somewhere sensible. */
  onClosed?: (dept: DeptKey) => void;
}

/** The open hiring session: candidates side by side, Hire, Re-roll and Close. Renders nothing without a session. */
export function HiringDialog({ store, onClosed }: HiringDialogProps) {
  const { t, money } = useT();
  const state = useGameState(store, (s) => s);
  const session = state.hiring;
  const [error, setError] = useState<MsgKey | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  // A fresh object per hire, so hiring two people with the same name still re-runs the focus effect.
  const [hired, setHired] = useState<{ name: string } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const reasonId = useId();
  const open = session !== null;
  const dept = session?.dept ?? null;
  // The department is remembered rather than the button that opened the dialog: that button may be
  // gone by the time it closes (the layout changed, or the session came from a save).
  const openDept = useRef<DeptKey | null>(null);

  useEffect(() => {
    if (open) {
      openDept.current = dept;
      dialogRef.current?.focus();
    } else if (openDept.current) {
      const closedDept = openDept.current;
      openDept.current = null;
      onClosed?.(closedDept);
    }
    setError(null);
    setHired(null);
  }, [open, dept, onClosed]);

  const act = (rule: (s: GameState) => Result) => {
    const r = runAction(store, rule);
    setError(r.ok ? null : r.reason);
    return r.ok;
  };
  const hire = (c: Candidate) => {
    if (act((s) => hireCandidate(s, c.candidateId))) setHired({ name: c.name });
  };
  const reroll = () => {
    if (act(rerollCandidates)) setHired(null);
  };
  const close = () => store.update(cancelHiring);

  // Slots keep the whole roll in its order, so hiring one candidate leaves a placeholder and the others
  // stay where they are. A roll with any id not seen before (a re-roll, a new session) refills the slots.
  const [roll, setRoll] = useState<Candidate[]>(() => session?.candidates ?? []);
  const newRoll = session !== null && session.candidates.some((c) => !roll.some((r) => r.candidateId === c.candidateId));
  if (newRoll) setRoll(session.candidates);
  const slots = (newRoll ? session.candidates : roll).map((c) => ({
    candidate: c,
    open: session?.candidates.some((x) => x.candidateId === c.candidateId) ?? false,
  }));

  // 1 / 2 / 3 hire the candidate in that slot (a hired slot's key does nothing), R re-rolls; the game's
  // own keys (speed too) are off meanwhile.
  const keys: HotkeyMap = { r: reroll };
  slots.slice(0, HIRE_KEYS.length).forEach(({ candidate, open: available }, i) => {
    if (available) keys[HIRE_KEYS[i]] = () => hire(candidate);
  });
  useModalKeys(open, dialogRef, close, keys);

  // The Hire button just pressed is gone, so focus moves to the next candidate's.
  useEffect(() => {
    if (hired) dialogRef.current?.querySelector<HTMLElement>('.cand:not(.is-hired) .btn')?.focus();
  }, [hired]);

  if (!session) return null;

  const canReroll = state.cash >= B.hiring.rerollCost;
  const focused = session.candidates.find((c) => c.candidateId === focusId) ?? session.candidates[0];

  return (
    <div className="dialog-backdrop">
      <div
        ref={dialogRef}
        className="card hire"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ '--dept': `var(--${session.dept})` } as CSSProperties}
      >
        <div className="ribbon">
          <div className="ribbon-text">
            <h2 id={titleId}>{t('hire.title', { dept: t(DEPT_KEYS[session.dept]) })}</h2>
            <p role="status">
              {hired ? t('hire.hired', { name: hired.name }) : t('hire.hint', { n: session.candidates.length })}
            </p>
          </div>
          <button
            type="button"
            className="close"
            aria-label={t('hire.close')}
            title={t('hotkey.tip', { label: t('hire.close'), key: 'Esc' })}
            aria-keyshortcuts="Escape"
            onClick={close}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <ul className="cands">
          {slots.map(({ candidate: c, open: available }, i) =>
            available ? (
              <CandidateCard
                key={c.candidateId}
                candidate={c}
                hotkey={HIRE_KEYS[i]}
                dept={session.dept}
                onFocus={() => setFocusId(c.candidateId)}
                onHire={() => hire(c)}
              />
            ) : (
              <HiredSlot key={c.candidateId} candidate={c} dept={session.dept} />
            ),
          )}
        </ul>

        {focused && (
          <p className="hire-preview">{t('hire.preview', { name: focused.name, amount: money(focused.salary) })}</p>
        )}

        <div className="hire-foot">
          <button
            type="button"
            className="btn btn-soft"
            disabled={!canReroll}
            aria-describedby={canReroll ? undefined : reasonId}
            aria-keyshortcuts="R"
            title={t('hotkey.tip', { label: t('hotkey.reroll'), key: 'R' })}
            onClick={reroll}
          >
            <DiceIcon /> {t('hire.reroll', { cost: money(B.hiring.rerollCost) })}
          </button>
          {canReroll ? (
            <span>{t('hire.rerollHint')}</span>
          ) : (
            <span id={reasonId} className="error">
              {t('error.cannotAfford')}
            </span>
          )}
        </div>
        {error && (
          <p className="error" role="alert">
            {t(error)}
          </p>
        )}
      </div>
    </div>
  );
}

interface CandidateCardProps {
  candidate: Candidate;
  /** The key that hires this candidate, if any. */
  hotkey?: string;
  dept: DeptKey;
  onFocus: () => void;
  onHire: () => void;
}

/**
 * A hired candidate's slot: the card stays laid out but invisible, inert and hidden from screen readers,
 * so the slot keeps its exact size, with the "Hired" note on top.
 */
function HiredSlot({ candidate: c, dept }: { candidate: Candidate; dept: DeptKey }) {
  const { t } = useT();
  return (
    <li className="cand is-hired">
      <div className="cand-ghost" aria-hidden="true" inert>
        <CandidateBody candidate={c} dept={dept} onHire={() => {}} />
      </div>
      <div className="cand-hired">
        <span className="cand-avatar" aria-hidden="true">
          {c.name.slice(0, 1)}
        </span>
        <p>{t('hire.slotHired', { name: c.name })}</p>
      </div>
    </li>
  );
}

function CandidateCard({ onFocus, ...props }: CandidateCardProps) {
  return (
    <li className="cand" onMouseEnter={onFocus} onFocus={onFocus}>
      <CandidateBody {...props} />
    </li>
  );
}

function CandidateBody({ candidate: c, hotkey, dept, onHire }: Omit<CandidateCardProps, 'onFocus'>) {
  const { t, money, lang } = useT();
  return (
    <>
      <span className="cand-avatar" aria-hidden="true">
        {c.name.slice(0, 1)}
      </span>
      <h3>{c.name}</h3>
      <dl className="stats">
        <Stat label={t('hire.speed')} value={t('hire.speedValue', { v: oneDecimal(lang, c.speed) })} fill={c.speed / PIP_MAX.speed} />
        <Stat
          label={t('hire.capacity')}
          value={t('hire.capacityValue', { n: c.capacity })}
          fill={c.capacity / PIP_MAX.capacity}
        />
        {dept === 'sales' && (
          <Stat
            label={t('hire.winRate')}
            value={t('hire.winRateValue', { pct: Math.round(c.winRate * 100) })}
            fill={c.winRate / PIP_MAX.winRate}
          />
        )}
      </dl>
      <span className="salary">{t('money.perMonth', { amount: money(c.salary) })}</span>
      <button
        type="button"
        className="btn"
        aria-keyshortcuts={hotkey}
        title={hotkey ? t('hotkey.tip', { label: t('hire.hire'), key: hotkey }) : undefined}
        onClick={onHire}
      >
        {t('hire.hire')}
      </button>
    </>
  );
}

function Stat({ label, value, fill }: { label: string; value: string; fill: number }) {
  const filled = Math.max(1, Math.min(5, Math.round(fill * 5)));
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>
        <span className="pips" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <i key={i} className={i < filled ? 'on' : undefined} />
          ))}
        </span>
        <span className="stat-value">{value}</span>
      </dd>
    </div>
  );
}
