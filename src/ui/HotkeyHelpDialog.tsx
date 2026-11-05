import { useEffect, useId, useRef } from 'react';
import { useT } from '../i18n/I18nProvider';
import type { MsgKey } from '../i18n';
import { DEPT_HOTKEYS } from './useHotkeys';
import { useModalKeys } from './useModalKeys';

export interface HotkeyHelpDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after the dialog closes when the element focused before it is gone. */
  onClosed?: () => void;
}

type Row = { keys: (string | MsgKey)[]; what: MsgKey };
const SPACE: MsgKey = 'hotkey.space';
const GROUPS: { title?: MsgKey; rows: Row[] }[] = [
  {
    rows: [
      { keys: [SPACE], what: 'hotkey.pause' },
      { keys: ['1', '3', '5'], what: 'hotkey.speed' },
      { keys: [DEPT_HOTKEYS.sales, DEPT_HOTKEYS.ops, DEPT_HOTKEYS.accounting], what: 'hotkey.move' },
      { keys: ['H'], what: 'hotkey.hire' },
      { keys: ['?'], what: 'hotkey.help' },
    ],
  },
  {
    title: 'hotkey.inHiring',
    rows: [
      { keys: ['1', '2', '3'], what: 'hotkey.hireCandidate' },
      { keys: ['R'], what: 'hotkey.reroll' },
    ],
  },
  {
    title: 'hotkey.inDialogs',
    rows: [
      { keys: ['Enter', SPACE], what: 'hotkey.continue' },
      { keys: ['Esc'], what: 'hotkey.closeDialog' },
    ],
  },
];

/** The modal list of keyboard shortcuts, toggled with `?`. Renders nothing while closed. */
export function HotkeyHelpDialog({ open, onClose, onClosed }: HotkeyHelpDialogProps) {
  const { t } = useT();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const before = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      const active = document.activeElement;
      before.current = active instanceof HTMLElement && active !== document.body ? active : null;
      dialogRef.current?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      const back = before.current;
      before.current = null;
      if (back?.isConnected) back.focus();
      else onClosed?.();
    }
  }, [open, onClosed]);

  useModalKeys(open, dialogRef, onClose, { '?': onClose });

  if (!open) return null;
  const keyLabel = (k: string) => (k === SPACE ? t(SPACE) : k);
  return (
    <div className="dialog-backdrop">
      <div ref={dialogRef} className="card small-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="ribbon">
          <div className="ribbon-text">
            <h2 id={titleId}>{t('hotkey.title')}</h2>
          </div>
          <button
            type="button"
            className="close"
            aria-label={t('hotkey.close')}
            title={t('hotkey.tip', { label: t('hotkey.close'), key: 'Esc' })}
            aria-keyshortcuts="Escape"
            onClick={onClose}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        {GROUPS.map(({ title, rows }, i) => (
          <section key={title ?? i} className="hotkeys">
            {title && <h3>{t(title)}</h3>}
            <dl>
              {rows.map(({ keys, what }) => (
                <div key={what} className="hotkey-row">
                  <dt>
                    {keys.map((k) => (
                      <kbd key={k}>{keyLabel(k)}</kbd>
                    ))}
                  </dt>
                  <dd>{t(what)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
