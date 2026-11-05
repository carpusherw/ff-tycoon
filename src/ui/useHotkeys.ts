import { useEffect, useRef } from 'react';
import type { DeptKey } from '../rules/types';

/** Handlers by key name, as `hotkeyOf` names keys: `space`, `enter`, `?`, digits and lower-case letters. */
export type HotkeyMap = Partial<Record<string, () => void>>;

/** The key that moves the owner to each department, as shown to the player. */
export const DEPT_HOTKEYS: Record<DeptKey, string> = { sales: 'S', ops: 'O', accounting: 'A' };

const EDITABLE = 'input, select, textarea, [contenteditable]:not([contenteditable="false"])';

/**
 * Names the key a keydown is for, or null when it's no hotkey: a repeat, a Ctrl / Meta / Alt combo, or
 * typing in a form field. Letters and digits go by physical key (`event.code`), so they work the same in
 * every language and input method; `?` goes by the character, wherever the layout puts it.
 */
export function hotkeyOf(e: KeyboardEvent): string | null {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return null;
  if (e.target instanceof Element && e.target.closest(EDITABLE)) return null;
  if (e.key === '?' || (e.code === 'Slash' && e.shiftKey)) return '?';
  const letter = /^Key([A-Z])$/.exec(e.code);
  if (letter) return letter[1].toLowerCase();
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
  if (digit) return digit[1];
  if (e.code === 'Space' || (!e.code && e.key === ' ')) return 'space';
  if (e.key === 'Enter') return 'enter';
  if (!e.code && /^[a-z0-9]$/i.test(e.key)) return e.key.toLowerCase();
  return null;
}

/**
 * Runs `keys` from document keydowns while `enabled`. A handled key's default action is cancelled, so
 * Space pauses rather than also pressing the focused button or scrolling the page.
 */
export function useHotkeys(enabled: boolean, keys: HotkeyMap): void {
  const keysRef = useRef(keys);
  useEffect(() => {
    keysRef.current = keys;
  });

  useEffect(() => {
    if (!enabled) return;
    // Some browsers press a focused button on Space's keyup, so that keyup is cancelled too.
    let spaceDown = false;
    const onKeyDown = (e: KeyboardEvent) => {
      const name = hotkeyOf(e);
      const run = name === null ? undefined : keysRef.current[name];
      if (!run) return;
      e.preventDefault();
      if (name === 'space') spaceDown = true;
      run();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!spaceDown || e.code !== 'Space') return;
      spaceDown = false;
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
