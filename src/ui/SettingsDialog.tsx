import { useEffect, useId, useRef, type RefObject } from 'react';
import type { Settings } from '../app/persistence';
import { useT } from '../i18n/I18nProvider';
import type { Lang, MsgKey } from '../i18n';
import type { ThemePref } from '../theme/theme';
import { useModalKeys } from './useModalKeys';

const LANGS: { value: Lang; key: MsgKey }[] = [
  { value: 'en', key: 'lang.en' },
  { value: 'zh-Hant', key: 'lang.zhHant' },
  { value: 'zh-Hans', key: 'lang.zhHans' },
];
const THEMES: { value: ThemePref; key: MsgKey }[] = [
  { value: 'system', key: 'settings.themeSystem' },
  { value: 'light', key: 'settings.themeLight' },
  { value: 'dark', key: 'settings.themeDark' },
];

export interface SettingsProps {
  settings: Settings;
  onSettingsChange: (next: Settings) => void;
  onNewGame: () => void;
}

export interface SettingsDialogProps extends SettingsProps {
  open: boolean;
  onClose: () => void;
  /** Where focus goes back to once the dialog closes: the gear that opened it. */
  returnFocus: RefObject<HTMLElement | null>;
}

/** The modal settings panel opened from the top bar's gear. Renders nothing while closed. */
export function SettingsDialog({ open, onClose, returnFocus, ...props }: SettingsDialogProps) {
  const { t } = useT();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      dialogRef.current?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      // A dialog that opened as this one closed (the deferred year report) has already taken focus; leave it there.
      if (document.activeElement?.closest('[role="dialog"]')) return;
      returnFocus.current?.focus();
    }
  }, [open, returnFocus]);

  useModalKeys(open, dialogRef, onClose);

  if (!open) return null;
  return (
    <div className="dialog-backdrop">
      <div ref={dialogRef} className="card small-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="ribbon">
          <div className="ribbon-text">
            <h2 id={titleId}>{t('settings.title')}</h2>
          </div>
          <button type="button" className="close" aria-label={t('settings.close')} title={t('settings.close')} onClick={onClose}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <SettingsForm {...props} />
      </div>
    </div>
  );
}

function SettingsForm({ settings, onSettingsChange, onNewGame }: SettingsProps) {
  const { t } = useT();
  const langId = useId();
  const themeId = useId();
  const autoId = useId();
  return (
    <div className="settings">
      <label htmlFor={langId}>{t('settings.language')}</label>
      <select id={langId} value={settings.lang} onChange={(e) => onSettingsChange({ ...settings, lang: e.target.value as Lang })}>
        {LANGS.map(({ value, key }) => (
          <option key={value} value={value}>
            {t(key)}
          </option>
        ))}
      </select>

      <label htmlFor={themeId}>{t('settings.theme')}</label>
      <select
        id={themeId}
        value={settings.theme}
        onChange={(e) => onSettingsChange({ ...settings, theme: e.target.value as ThemePref })}
      >
        {THEMES.map(({ value, key }) => (
          <option key={value} value={value}>
            {t(key)}
          </option>
        ))}
      </select>

      <div className="settings-check">
        <input
          id={autoId}
          type="checkbox"
          checked={settings.autoPause}
          onChange={(e) => onSettingsChange({ ...settings, autoPause: e.target.checked })}
        />
        <label htmlFor={autoId}>{t('settings.autoPause')}</label>
      </div>

      <button
        type="button"
        className="btn btn-soft"
        onClick={() => {
          if (window.confirm(t('settings.confirmNewGame'))) onNewGame();
        }}
      >
        {t('settings.newGame')}
      </button>
    </div>
  );
}
