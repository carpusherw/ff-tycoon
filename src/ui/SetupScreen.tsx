import { useT } from '../i18n/I18nProvider';
import { HOME_PORTS, PORTS, type HomePortId } from '../rules/world';

export interface SetupScreenProps {
  hasSave: boolean;
  onContinue: () => void;
  onNewGame: (homePortId: HomePortId) => void;
}

export function SetupScreen({ hasSave, onContinue, onNewGame }: SetupScreenProps) {
  const { t } = useT();
  return (
    <main className="screen">
      <section className="card screen-card">
        <h1 className="screen-title">{t('setup.title')}</h1>
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
                type="button"
                className={hasSave ? 'btn btn-soft btn-wide' : 'btn btn-wide'}
                onClick={() => onNewGame(portId)}
              >
                {t(PORTS[portId].cityKey)}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
