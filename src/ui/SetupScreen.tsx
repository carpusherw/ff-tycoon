import { useEffect, useId, useRef, useState } from 'react';
import { useT } from '../i18n/I18nProvider';
import { HOME_PORTS, PORTS, type HomePortId } from '../rules/world';
import { useModalKeys } from './useModalKeys';

export interface SetupScreenProps {
  hasSave: boolean;
  /** The stored save couldn't be loaded, and whether a backup of it was kept. */
  loadFailed?: 'backedUp' | 'notBackedUp' | null;
  onContinue: () => void;
  onNewGame: (homePortId: HomePortId) => void;
}

export function SetupScreen({ hasSave, loadFailed = null, onContinue, onNewGame }: SetupScreenProps) {
  const { t } = useT();
  // With no backup kept, a new game would overwrite the only copy of the old save, so the player confirms first.
  const [pending, setPending] = useState<HomePortId | null>(null);
  const cityRefs = useRef(new Map<HomePortId, HTMLButtonElement>());
  const pick = (portId: HomePortId) => (loadFailed === 'notBackedUp' ? setPending(portId) : onNewGame(portId));
  const cancel = () => {
    const portId = pending;
    setPending(null);
    if (portId) cityRefs.current.get(portId)?.focus();
  };

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
      {pending && <DiscardDialog onCancel={cancel} onConfirm={() => onNewGame(pending)} />}
    </main>
  );
}

/** Asks before a new game overwrites a save that could be neither loaded nor backed up. Cancel is focused first. */
function DiscardDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
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
          {t('setup.discardConfirm')}
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
