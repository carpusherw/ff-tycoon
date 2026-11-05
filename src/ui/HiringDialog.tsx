import { useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from 'react';
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

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const MAX_SKILL = Math.max(...Object.values(COUNTRIES).map((c) => c.pool.skillMult));
const PIP_MAX = {
  speed: B.hiring.speed[1] * MAX_SKILL,
  capacity: Math.max(...Object.values(B.hiring.capacity).map(([, max]) => max)),
  winRate: B.hiring.winRate[1] * MAX_SKILL,
};

export interface HiringDialogProps {
  store: GameStore;
  /** The element to focus again once the dialog closes (the job-ad button that opened it). */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/** The open hiring session: candidates side by side, Hire, Re-roll and Close. Renders nothing without a session. */
export function HiringDialog({ store, returnFocusRef }: HiringDialogProps) {
  const { t, money } = useT();
  const state = useGameState(store, (s) => s);
  const session = state.hiring;
  const [error, setError] = useState<MsgKey | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const reasonId = useId();
  const open = session !== null;
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      dialogRef.current?.focus();
    } else if (wasOpen.current) {
      const opener = returnFocusRef?.current;
      if (opener?.isConnected) opener.focus();
    }
    wasOpen.current = open;
    setError(null);
  }, [open, returnFocusRef]);

  // Listens on the document, so Escape and Tab still work when focus has fallen back to the page body.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        store.update(cancelHiring);
        return;
      }
      const root = dialogRef.current;
      if (e.key !== 'Tab' || !root) return;
      const stops = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;
      const outside = !root.contains(active) || active === root;
      if (e.shiftKey ? outside || active === first : outside || active === last) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, store]);

  if (!session) return null;

  const act = (rule: (s: GameState) => Result) => {
    const r = runAction(store, rule);
    setError(r.ok ? null : r.reason);
  };
  const close = () => store.update(cancelHiring);
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
            <p>{t('hire.hint', { n: session.candidates.length })}</p>
          </div>
          <button type="button" className="close" aria-label={t('hire.close')} title={t('hire.close')} onClick={close}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <ul className="cands">
          {session.candidates.map((c) => (
            <CandidateCard
              key={c.candidateId}
              candidate={c}
              dept={session.dept}
              onFocus={() => setFocusId(c.candidateId)}
              onHire={() => act((s) => hireCandidate(s, c.candidateId))}
            />
          ))}
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
            onClick={() => act(rerollCandidates)}
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
  dept: DeptKey;
  onFocus: () => void;
  onHire: () => void;
}

function CandidateCard({ candidate: c, dept, onFocus, onHire }: CandidateCardProps) {
  const { t, money, lang } = useT();
  return (
    <li className="cand" onMouseEnter={onFocus} onFocus={onFocus}>
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
      <button type="button" className="btn" onClick={onHire}>
        {t('hire.hire')}
      </button>
    </li>
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
