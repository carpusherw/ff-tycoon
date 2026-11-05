import { useRef, type MouseEvent, type PointerEvent } from 'react';

/**
 * Props for a dialog's backdrop: a click or tap on the backdrop itself calls `onDismiss`, the same
 * handler as the dialog's close button. A press that starts inside the dialog (selecting text, then
 * releasing outside) doesn't count.
 */
export function useBackdropDismiss(onDismiss: () => void) {
  const pressedBackdrop = useRef(false);
  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      pressedBackdrop.current = e.target === e.currentTarget;
    },
    onClick: (e: MouseEvent<HTMLElement>) => {
      const dismiss = pressedBackdrop.current && e.target === e.currentTarget;
      pressedBackdrop.current = false;
      if (dismiss) onDismiss();
    },
  };
}
