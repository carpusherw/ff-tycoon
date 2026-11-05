import { useT } from '../i18n/I18nProvider';
import type { PauseReason } from '../rules/types';
import { Tooltip } from './Tooltip';

export interface PauseBannerProps {
  reasons: readonly PauseReason[];
  onResume: () => void;
}

/** One line per distinct pause reason (year ends can pile up while auto-pause is off) and a Resume button. */
export function PauseBanner({ reasons, onResume }: PauseBannerProps) {
  const { t } = useT();
  if (reasons.length === 0) return null;
  const distinct = [...new Set(reasons)];
  return (
    <div className="card pause-banner" role="status">
      <ul className="pause-reasons">
        {distinct.map((reason) => (
          <li key={reason}>{t(`pause.${reason}`)}</li>
        ))}
      </ul>
      <Tooltip text={t('pause.resume')} keys={['Space']}>
        <button type="button" className="btn" aria-keyshortcuts="Space" onClick={onResume}>
          {t('pause.resume')}
        </button>
      </Tooltip>
    </div>
  );
}
