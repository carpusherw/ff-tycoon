import { useRef, type MouseEvent } from 'react';

/** Two clicks or taps this close together count as a double, whatever the device reports. */
const DOUBLE_MS = 400;

/**
 * Controls inside the area keep their own clicks; a double on them isn't the area's. So does anything
 * marked `data-own-clicks`, such as the staff row with its stat cards.
 */
const OWN_CLICKS = 'button, a, input, select, textarea, [role="dialog"], [data-own-clicks]';

/**
 * Props that call `onDouble` on a double-click, or a double-tap on a phone (where browsers don't
 * reliably report one), anywhere in the element. With `ignoreControls`, clicks on buttons and other
 * controls inside it don't count. Keyboard clicks (Enter, Space) never count. The second press of a
 * mouse double-click doesn't select a word.
 */
export function useDoubleActivate(onDouble: () => void, { ignoreControls = false } = {}) {
  const last = useRef(Number.NEGATIVE_INFINITY);
  return {
    onClick: (e: MouseEvent<HTMLElement>) => {
      const target = e.target as Element;
      const own = ignoreControls && target.closest(OWN_CLICKS);
      if (e.detail === 0 || (own && own !== e.currentTarget && e.currentTarget.contains(own))) {
        last.current = Number.NEGATIVE_INFINITY;
        return;
      }
      const isDouble = e.detail >= 2 || e.timeStamp - last.current <= DOUBLE_MS;
      last.current = isDouble ? Number.NEGATIVE_INFINITY : e.timeStamp;
      if (isDouble) onDouble();
    },
    onMouseDown: (e: MouseEvent<HTMLElement>) => {
      if (e.detail >= 2) e.preventDefault();
    },
  };
}
