import { useEffect, useRef } from 'react';
import { useT } from '../i18n/I18nProvider';
import type { MsgKey } from '../i18n';
import { B } from '../rules/balance';
import { companyValue } from '../rules/score';
import type { GameState, Mode } from '../rules/types';

export const DEMO_URL = 'https://gofreight.com/get-demo';

const MODE_KEYS: Record<Mode, MsgKey> = { easy: 'mode.easy', normal: 'mode.normal', hardcore: 'mode.hardcore' };

export interface EndScreenProps {
  state: GameState;
  onPlayAgain: () => void;
}

export function EndScreen({ state, onPlayAgain }: EndScreenProps) {
  const { t, money } = useT();
  const bankrupt = state.ended?.reason === 'bankrupt';
  const value = companyValue(state);
  // Day 360 is the last day of year 1, so the year is counted from the day before.
  const fellInYear = Math.floor(((state.ended?.day ?? state.day) - 1) / B.daysPerYear) + 1;
  const headingRef = useRef<HTMLHeadingElement>(null);
  // The end screen replaces the whole game, so focus starts on its heading.
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <main className="screen">
      <section className="card screen-card">
        <h1 ref={headingRef} className="screen-title" tabIndex={-1}>{t(bankrupt ? 'end.titleBankrupt' : 'end.titleCompleted')}</h1>
        {bankrupt && <p className="screen-note">{t('end.fellInYear', { year: fellInYear })}</p>}

        <dl className="breakdown">
          <div className="breakdown-term">
            <dt>{t('end.cash')}</dt>
            <dd>{money(value.cash)}</dd>
          </div>
          <div className="breakdown-term">
            <dt>{t('end.network')}</dt>
            <dd>{money(value.network)}</dd>
          </div>
          <div className="breakdown-term">
            <dt>{t('end.customerBook')}</dt>
            <dd>{money(value.customerBook)}</dd>
          </div>
          <div className="breakdown-total">
            <dt>{t('end.total')}</dt>
            <dd>{money(value.total)}</dd>
          </div>
        </dl>
        <p className="mode-tag">{t(MODE_KEYS[state.mode])}</p>

        <div className="demo">
          <p>{t(bankrupt ? 'end.bankruptLine' : 'end.demoLine')}</p>
          <a className="btn btn-wide" href={DEMO_URL} target="_blank" rel="noopener noreferrer">
            {t('end.demoCta')}
          </a>
        </div>

        <button type="button" className="btn btn-soft btn-wide" onClick={onPlayAgain}>
          {t('end.playAgain')}
        </button>
      </section>
    </main>
  );
}
