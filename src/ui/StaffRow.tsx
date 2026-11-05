import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useT } from '../i18n/I18nProvider';
import type { Employee, GameState } from '../rules/types';
import { oneDecimal } from './format';

/** One compact row of staff chips; a chip opens that person's stats. */
export function StaffRow({ staff, state }: { staff: Employee[]; state: GameState }) {
  const { t } = useT();
  const [openId, setOpenId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popId = useId();
  const open = staff.find((e) => e.id === openId) ?? null;

  // A click anywhere else closes the card.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpenId(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !open) return;
    e.stopPropagation();
    setOpenId(null);
    wrapRef.current?.querySelector<HTMLElement>(`[data-chip="${open.id}"]`)?.focus();
  };

  return (
    <div className="staff-wrap" ref={wrapRef} onKeyDown={onKeyDown}>
      <ul className="staff" aria-label={t('staff.row')}>
        {staff.map((e) => {
          const name = e.isOwner ? t('staff.owner') : e.name;
          const busy = state.tasks.filter((x) => x.assigneeId === e.id).length;
          const isOpen = e.id === open?.id;
          return (
            <li key={e.id}>
              <button
                type="button"
                className={busy >= e.capacity ? 'chip is-full' : 'chip'}
                data-chip={e.id}
                title={name}
                aria-label={t('staff.chip', { name, open: busy, capacity: e.capacity })}
                aria-expanded={isOpen}
                aria-controls={isOpen ? popId : undefined}
                onClick={() => setOpenId(isOpen ? null : e.id)}
              >
                <span className="avatar" aria-hidden="true">
                  {name.slice(0, 1)}
                </span>
                {e.isOwner && (
                  <span className="star" aria-hidden="true">
                    ★
                  </span>
                )}
                <span className="chip-load">{t('staff.load', { open: busy, capacity: e.capacity })}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {open && <StaffCard id={popId} employee={open} />}
    </div>
  );
}

function StaffCard({ id, employee: e }: { id: string; employee: Employee }) {
  const { t, money, lang } = useT();
  const name = e.isOwner ? t('staff.owner') : e.name;
  // Win rate only matters for whoever answers quotes: Sales staff, and the owner wherever they sit.
  const showWin = e.isOwner || e.dept === 'sales';
  return (
    <div id={id} className="staff-pop">
      <h3>{name}</h3>
      <dl className="staff-stats">
        <dt>{t('hire.speed')}</dt>
        <dd>{t('hire.speedValue', { v: oneDecimal(lang, e.speed) })}</dd>
        <dt>{t('hire.capacity')}</dt>
        <dd>{t('hire.capacityValue', { n: e.capacity })}</dd>
        {showWin && (
          <>
            <dt>{t('hire.winRate')}</dt>
            <dd>{t('hire.winRateValue', { pct: Math.round(e.winRate * 100) })}</dd>
          </>
        )}
        <dt>{t('staff.salary')}</dt>
        <dd>{e.isOwner ? t('staff.noSalary') : t('money.perMonth', { amount: money(e.salary) })}</dd>
      </dl>
    </div>
  );
}
