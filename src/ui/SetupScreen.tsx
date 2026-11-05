import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useT } from '../i18n/I18nProvider';
import { HOME_PORTS, PORTS, type HomePortId } from '../rules/world';
import { yearOfDay } from './format';
import { useModalKeys } from './useModalKeys';

export interface SetupScreenProps {
  hasSave: boolean;
  /** The saved run's day, named when the player confirms replacing it. */
  savedDay?: number;
  /** The stored save couldn't be loaded, and whether a backup of it was kept. */
  loadFailed?: 'backedUp' | 'notBackedUp' | null;
  onContinue: () => void;
  onNewGame: (homePortId: HomePortId) => void;
}

export function SetupScreen({ hasSave, savedDay = 0, loadFailed = null, onContinue, onNewGame }: SetupScreenProps) {
  const { t } = useT();
  // A new game replaces a run that's still going, or the only copy of a save that couldn't be backed up, so the
  // player confirms first.
  const [pending, setPending] = useState<HomePortId | null>(null);
  const cityRefs = useRef(new Map<HomePortId, HTMLButtonElement>());
  const question = hasSave
    ? t('setup.replaceConfirm', { year: yearOfDay(savedDay), day: savedDay })
    : loadFailed === 'notBackedUp'
      ? t('setup.discardConfirm')
      : null;
  const pick = (portId: HomePortId) => (question ? setPending(portId) : onNewGame(portId));
  // The city to focus once the dialog has closed. Focus waits for the commit that drops `inert`, because the
  // browser won't focus a button inside an inert section.
  const returnFocusTo = useRef<HomePortId | null>(null);
  const cancel = () => {
    returnFocusTo.current = pending;
    setPending(null);
  };
  useLayoutEffect(() => {
    const portId = returnFocusTo.current;
    if (pending !== null || portId === null) return;
    returnFocusTo.current = null;
    (cityRefs.current.get(portId) ?? cityRefs.current.get(HOME_PORTS[0]))?.focus();
  }, [pending]);

  return (
    <main className="screen">
      <section className="card screen-card" inert={pending !== null}>
        <h1 className="screen-title">{t('setup.title')}</h1>
        {loadFailed && (
          <p className="load-warning" role="alert">
            {t(loadFailed === 'backedUp' ? 'setup.loadFailed' : 'setup.loadFailedNoBackup')}
          </p>
        )}
        {hasSave && (
          <button type="button" className="btn btn-wide" onClick={onContinue}>
            {t('setup.continue')}
          </button>
        )}
        <h2 className="screen-subtitle">{t('setup.chooseHome')}</h2>
        <ul className="city-list">
          {HOME_PORTS.map((portId) => (
            <li key={portId}>
              <button
                ref={(el) => {
                  if (el) cityRefs.current.set(portId, el);
                  else cityRefs.current.delete(portId);
                }}
                type="button"
                className={hasSave ? 'btn btn-soft btn-wide' : 'btn btn-wide'}
                onClick={() => pick(portId)}
              >
                {t(PORTS[portId].cityKey)}
              </button>
            </li>
          ))}
        </ul>
      </section>
      {pending && question && <ConfirmDialog text={question} onCancel={cancel} onConfirm={() => onNewGame(pending)} />}
    </main>
  );
}

/** Asks before a new game replaces the stored save. Cancel is focused first. */
function ConfirmDialog({ text, onCancel, onConfirm }: { text: string; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useT();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const textId = useId();
  useEffect(() => cancelRef.current?.focus(), []);
  useModalKeys(true, dialogRef, onCancel);
  return (
    <div className="dialog-backdrop">
      <div ref={dialogRef} className="card small-dialog confirm-dialog" role="dialog" aria-modal="true" aria-labelledby={textId}>
        <p id={textId} className="confirm-text">
          {text}
        </p>
        <div className="confirm-actions">
          <button ref={cancelRef} type="button" className="btn btn-soft" onClick={onCancel}>
            {t('setup.discardCancel')}
          </button>
          <button type="button" className="btn" onClick={onConfirm}>
            {t('setup.discardStart')}
          </button>
        </div>
      </div>
    </div>
  );
}
