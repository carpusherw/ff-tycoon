import {
  cloneElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/I18nProvider';
import { Keys, type KeyCombo } from './Kbd';

/** How long the pointer rests on a button before its tooltip shows; keyboard focus shows it at once. */
export const TOOLTIP_DELAY_MS = 300;
/** The smallest gap kept between a tooltip and the window's edge, and between it and its button. */
const EDGE = 8;
const GAP = 6;

export interface TooltipProps {
  /** The tooltip's label (the action's name when there are keys); null gives the button no tooltip but keeps the wrapper. */
  text: string | null;
  /** The button's hotkeys, shown as a `HotkeyHint` (alternatives split by a slash). */
  keys?: readonly KeyCombo[];
  /** Instead of `keys`: keycaps with words around them, for the parentheses ("⇧ S, or H when you work here"). */
  keysLabel?: ReactNode;
  /** A second line under the label. */
  hint?: string;
  /** One button (or other control). It gets `aria-describedby` pointing at the tooltip. */
  children: ReactElement<{ 'aria-describedby'?: string }>;
  /** Extra classes for the wrapper, which takes the button's place in the layout. */
  className?: string;
}

/**
 * The one format for a hotkey hint: the action's name, then its keys as keycaps in parentheses,
 * "3× speed (3)" ("3 倍速（3）" in Chinese). `keys` are split by a slash; `keysLabel` replaces them when
 * the keys need words around them.
 */
export function HotkeyHint({ action, keys = [], keysLabel }: { action: string; keys?: readonly KeyCombo[]; keysLabel?: ReactNode }) {
  const { tx } = useT();
  return tx('hotkey.hint', { action, keys: keysLabel ?? <Keys keys={keys} /> });
}

const focusVisible = (el: Element) => {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
};

/**
 * A styled tooltip for a button: it shows after the pointer rests on the button for a moment, or at once
 * when the button gets keyboard focus, and hides on leave, blur or Escape. The button sits in a wrapper
 * that takes the hover, so a disabled button (which some browsers give no pointer events) still shows it.
 * The tooltip floats over the page (no layout shift) and is kept inside the window.
 */
export function Tooltip({ text, keys, keysLabel, hint, children, className }: TooltipProps) {
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CSSProperties>({ left: 0, top: 0 });

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const show = () => {
    clearTimer();
    setOpen(true);
  };
  const hide = () => {
    clearTimer();
    setOpen(false);
  };
  useEffect(() => clearTimer, []);

  // Escape dismisses it without moving focus; the key still reaches whatever else listens (a dialog).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Below the button, or above it when there's no room below, and never past the window's edges.
  useLayoutEffect(() => {
    if (!open) return;
    const anchor = wrapRef.current?.getBoundingClientRect();
    const tip = tipRef.current?.getBoundingClientRect();
    if (!anchor || !tip) return;
    const maxLeft = Math.max(EDGE, window.innerWidth - tip.width - EDGE);
    const left = Math.min(maxLeft, Math.max(EDGE, anchor.left + anchor.width / 2 - tip.width / 2));
    const below = anchor.bottom + GAP;
    const top = below + tip.height + EDGE <= window.innerHeight ? below : Math.max(EDGE, anchor.top - GAP - tip.height);
    setPlace({ left, top });
  }, [open, text, hint]);

  if (text === null) return <span className={['tip', className].filter(Boolean).join(' ')}>{children}</span>;

  const describedBy = [children.props['aria-describedby'], id].filter(Boolean).join(' ');
  return (
    <span
      ref={wrapRef}
      className={['tip', className].filter(Boolean).join(' ')}
      onPointerEnter={(e: PointerEvent) => {
        if (e.pointerType === 'touch') return;
        clearTimer();
        timer.current = setTimeout(show, TOOLTIP_DELAY_MS);
      }}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={(e: FocusEvent) => {
        if (focusVisible(e.target)) show();
      }}
      onBlur={hide}
    >
      {cloneElement(children, { 'aria-describedby': describedBy })}
      {createPortal(
        <div ref={tipRef} id={id} role="tooltip" className="tooltip" hidden={!open} style={place}>
          <span className="tooltip-label">
            {keysLabel || (keys && keys.length > 0) ? <HotkeyHint action={text} keys={keys} keysLabel={keysLabel} /> : text}
          </span>
          {hint && <span className="tooltip-hint">{hint}</span>}
        </div>,
        document.body,
      )}
    </span>
  );
}
