import { useEffect, useRef, type RefObject } from 'react';
import { useHotkeys, type HotkeyMap } from './useHotkeys';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard handling for a modal dialog while `open`: Escape calls `onEscape`, and Tab / Shift+Tab wrap
 * around inside `ref`. Listens on the document, so it still works when focus has fallen back to the page body.
 * `keys` are the dialog's own hotkeys (see `useHotkeys`); the game's hotkeys are off while a dialog is open.
 */
export function useModalKeys(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  onEscape: () => void,
  keys: HotkeyMap = {},
): void {
  useHotkeys(open, keys);
  const escapeRef = useRef(onEscape);
  useEffect(() => {
    escapeRef.current = onEscape;
  });

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        escapeRef.current();
        return;
      }
      const root = ref.current;
      if (e.key !== 'Tab' || !root) return;
      // Inert content (a hired candidate's hidden card) can't take focus, so it's no stop.
      const stops = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest('[inert]'));
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
  }, [open, ref]);
}
