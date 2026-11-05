import { createContext, useContext, useEffect, useRef } from 'react';
import type { DeptKey } from '../rules/types';

/** Handlers by key name, as `hotkeyOf` names keys: `space`, `enter`, `?`, digits and lower-case letters. */
export type HotkeyMap = Partial<Record<string, () => void>>;

/** The key that moves the owner to each department, as shown to the player. */
export const DEPT_HOTKEYS: Record<DeptKey, string> = { sales: 'S', ops: 'O', accounting: 'A' };

const EDITABLE = 'input, select, textarea, [contenteditable]:not([contenteditable="false"])';
/** Controls that Enter presses on its own. */
const CONTROL =
  'button, a[href], summary, [role="button"], [role="link"], [role="checkbox"], [role="switch"], ' +
  '[role="radio"], [role="tab"], [role="menuitem"], [role="option"]';

/**
 * Names the key a keydown is for, or null when it's no hotkey: a repeat, a Ctrl / Meta / Alt combo, or
 * typing in a form field. Letters and digits go by physical key (`event.code`), so they work the same in
 * every language and input method; `?` goes by the character, wherever the layout puts it, and a plain
 * `/` (the same key without Shift) is named `?` too.
 *
 * Space is the game-wide pause key, so it's named even on a focused button (the handler cancels the
 * button's own press); Enter on a control is left to the control.
 */
export function hotkeyOf(e: KeyboardEvent): string | null {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return null;
  if (e.target instanceof Element && e.target.closest(EDITABLE)) return null;
  if (e.key === '?' || e.key === '/' || e.code === 'Slash') return '?';
  const letter = /^Key([A-Z])$/.exec(e.code);
  if (letter) return letter[1].toLowerCase();
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
  if (digit) return digit[1];
  if (e.code === 'Space' || (!e.code && e.key === ' ')) return 'space';
  // Enter presses a focused control on its own, so there it's left to it.
  const onControl = e.target instanceof Element && e.target.closest(CONTROL) !== null;
  if (e.key === 'Enter') return onControl ? null : 'enter';
  if (!e.code && /^[a-z0-9]$/i.test(e.key)) return e.key.toLowerCase();
  return null;
}

/**
 * Runs `keys` from document keydowns while `enabled`. A handled key's default action is cancelled, so
 * Space on the game body pauses rather than also scrolling the page. A handled Space's keyup is cancelled
 * too: some browsers press a focused button on keyup even when the keydown was cancelled.
 */
export function useHotkeys(enabled: boolean, keys: HotkeyMap): void {
  const keysRef = useRef(keys);
  useEffect(() => {
    keysRef.current = keys;
  });

  useEffect(() => {
    if (!enabled) return;
    let spaceHandled = false;
    const onKeyDown = (e: KeyboardEvent) => {
      const name = hotkeyOf(e);
      const run = name === null ? undefined : keysRef.current[name];
      if (!run) return;
      e.preventDefault();
      if (name === 'space') spaceHandled = true;
      run();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!spaceHandled || e.code !== 'Space') return;
      spaceHandled = false;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [enabled]);
}

/**
 * How a popover inside the screen (the "+N" staff list) turns the game's keys off while it's open, as a
 * modal dialog does. The screen counts the holds; the default does nothing.
 */
export const HotkeyHoldContext = createContext<(held: boolean) => void>(() => {});

/** Holds the game's keys while `held`. */
export function useHoldHotkeys(held: boolean): void {
  const hold = useContext(HotkeyHoldContext);
  useEffect(() => {
    if (!held) return;
    hold(true);
    return () => hold(false);
  }, [held, hold]);
}
