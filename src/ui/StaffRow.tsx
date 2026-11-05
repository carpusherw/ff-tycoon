import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useT } from '../i18n/I18nProvider';
import type { Employee, GameState } from '../rules/types';
import { oneDecimal } from './format';
import { useHoldHotkeys } from './useHotkeys';

/** Chip widths in px, set on the row as CSS variables so the fit below matches what is drawn. */
const CHIP_W = 64;
const OWNER_CHIP_W = 76; // the owner's chip also has a star
const MORE_CHIP_W = 40;
const GAP = 6;
/** The line width assumed until the row has been measured (a laptop column's staff row). */
const DEFAULT_LINE_W = 272;
const LINES = 2;

function linesUsed(widths: number[], lineWidth: number, gap: number): number {
  let lines = 0;
  let x = 0;
  for (const w of widths) {
    if (lines === 0 || x + gap + w > lineWidth) {
      lines += 1;
      x = w;
    } else {
      x += gap + w;
    }
  }
  return lines;
}

/**
 * How many chips (from the start) fit in two wrapped lines. When they don't all fit, the count leaves
 * room for a `moreWidth` "+N" chip after them.
 */
export function fitChips(widths: number[], lineWidth: number, gap: number, moreWidth: number): number {
  if (linesUsed(widths, lineWidth, gap) <= LINES) return widths.length;
  for (let k = widths.length - 1; k > 0; k--) {
    if (linesUsed([...widths.slice(0, k), moreWidth], lineWidth, gap) <= LINES) return k;
  }
  return 0;
}

/** The row's inner width, kept up to date as the column resizes (never as tasks tick). */
function useLineWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(DEFAULT_LINE_W);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const style = getComputedStyle(el);
      const inner = el.clientWidth - parseFloat(style.paddingLeft || '0') - parseFloat(style.paddingRight || '0');
      // No layout (tests, a hidden tab) keeps the default instead of hiding everyone.
      if (inner > 0) setWidth(inner);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

const ALL = 'all';

/**
 * Up to two lines of staff chips (as many as fit) and a "+N" chip for the rest; it never scrolls.
 * A chip opens that person's stats; "+N" opens the whole department's list.
 */
export function StaffRow({ staff, state, title }: { staff: Employee[]; state: GameState; title: string }) {
  const { t, tn } = useT();
  const [openId, setOpenId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLUListElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const popId = useId();
  const lineWidth = useLineWidth(rowRef);
  const listOpen = openId === ALL;
  const open = staff.find((e) => e.id === openId) ?? null;
  // The list is a dialog of its own: the game's keys wait until it closes.
  useHoldHotkeys(listOpen);

  const shownCount = fitChips(
    staff.map((e) => (e.isOwner ? OWNER_CHIP_W : CHIP_W)),
    lineWidth,
    GAP,
    MORE_CHIP_W,
  );
  const shown = staff.slice(0, shownCount);
  const hidden = staff.length - shownCount;

  // A click anywhere else closes the card or the list.
  useEffect(() => {
    if (!openId) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpenId(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [openId]);

  useEffect(() => {
    if (listOpen) listRef.current?.focus({ preventScroll: true });
  }, [listOpen]);

  // The list floats over the page next to the row, below it or above it, wherever there's more room,
  // and never runs off the window; it follows the row when the window resizes or the panel scrolls.
  const [place, setPlace] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    if (!listOpen) return;
    const update = () => {
      const row = rowRef.current?.getBoundingClientRect();
      if (!row) return;
      const margin = 10;
      const below = window.innerHeight - row.bottom - margin;
      const above = row.top - margin;
      const vertical =
        below >= Math.min(above, 240)
          ? { top: row.bottom + 6, bottom: 'auto' }
          : { top: 'auto', bottom: window.innerHeight - row.top + 6 };
      setPlace({ position: 'fixed', left: row.left, width: row.width, maxHeight: Math.min(360, Math.max(120, Math.max(below, above) - 6)), ...vertical });
    };
    update();
    window.addEventListener('resize', update);
    document.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      document.removeEventListener('scroll', update, true);
    };
  }, [listOpen]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !openId) return;
    e.stopPropagation();
    const back = listOpen ? moreRef.current : wrapRef.current?.querySelector<HTMLElement>(`[data-chip="${openId}"]`);
    setOpenId(null);
    back?.focus();
  };

  const vars = {
    '--chip-w': `${CHIP_W}px`,
    '--chip-owner-w': `${OWNER_CHIP_W}px`,
    '--chip-more-w': `${MORE_CHIP_W}px`,
    '--chip-gap': `${GAP}px`,
  } as CSSProperties;

  return (
    <div className="staff-wrap" ref={wrapRef} onKeyDown={onKeyDown}>
      <ul className="staff" aria-label={t('staff.row')} ref={rowRef} style={vars}>
        {shown.map((e) => {
          const name = e.isOwner ? t('staff.owner') : e.name;
          const busy = state.tasks.filter((x) => x.assigneeId === e.id).length;
          const isOpen = e.id === open?.id;
          const classes = ['chip', e.isOwner && 'is-owner', busy >= e.capacity && 'is-full'].filter(Boolean).join(' ');
          return (
            <li key={e.id}>
              <button
                type="button"
                className={classes}
                data-chip={e.id}
                title={name}
                aria-label={tn('staff.chip', e.capacity, { name, open: busy, capacity: e.capacity })}
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
                <span className="chip-load num">{t('staff.load', { open: busy, capacity: e.capacity })}</span>
              </button>
            </li>
          );
        })}
        {hidden > 0 && (
          <li>
            <button
              ref={moreRef}
              type="button"
              className="chip chip-more num"
              aria-label={tn('staff.showAll', staff.length)}
              title={tn('staff.showAll', staff.length)}
              aria-haspopup="dialog"
              aria-expanded={listOpen}
              aria-controls={listOpen ? popId : undefined}
              onClick={() => setOpenId(listOpen ? null : ALL)}
            >
              {t('staff.more', { n: hidden })}
            </button>
          </li>
        )}
      </ul>
      {open && <StaffCard id={popId} employee={open} />}
      {listOpen && (
        <div
          ref={listRef}
          id={popId}
          className="staff-pop staff-list scroll"
          role="dialog"
          aria-label={t('staff.listTitle', { dept: title })}
          tabIndex={-1}
          style={place}
        >
          <ul>
            {staff.map((e) => (
              <li key={e.id}>
                <StaffStats employee={e} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StaffCard({ id, employee }: { id: string; employee: Employee }) {
  return (
    <div id={id} className="staff-pop">
      <StaffStats employee={employee} />
    </div>
  );
}

/** One person's name and stats, for the chip's card and the department's list. */
function StaffStats({ employee: e }: { employee: Employee }) {
  const { t, tn, money, lang } = useT();
  const name = e.isOwner ? t('staff.owner') : e.name;
  // Win rate only matters for whoever answers quotes: Sales staff, and the owner wherever they sit.
  const showWin = e.isOwner || e.dept === 'sales';
  return (
    <>
      <h3>{name}</h3>
      <dl className="staff-stats">
        <dt>{t('hire.speed')}</dt>
        <dd>{t('hire.speedValue', { v: oneDecimal(lang, e.speed) })}</dd>
        <dt>{t('hire.capacity')}</dt>
        <dd>{tn('hire.capacityValue', e.capacity)}</dd>
        {showWin && (
          <>
            <dt>{t('hire.winRate')}</dt>
            <dd>{t('hire.winRateValue', { pct: Math.round(e.winRate * 100) })}</dd>
          </>
        )}
        <dt>{t('staff.salary')}</dt>
        <dd>{e.isOwner ? t('staff.noSalary') : t('money.perMonth', { amount: money(e.salary) })}</dd>
      </dl>
    </>
  );
}
