import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import type { GameStore } from '../../app/store';
import { useT } from '../../i18n/I18nProvider';
import { B } from '../../rules/balance';
import { AGENT_NAMES } from '../../rules/names';
import { canOpen, canSign, openOffice, signAgent } from '../../rules/network';
import type { GameState } from '../../rules/types';
import { COUNTRIES, PORTS, REGIONS, type PortId } from '../../rules/world';
import { runAction } from '../actions';
import { Tooltip } from '../Tooltip';
import { useBackdropDismiss } from '../useBackdropDismiss';
import { toPagePoint, viewScale } from './hits';
import type { XY } from './projection';

/** Anchored to the pin on a laptop; a bottom sheet under the map on the phone (owner decision 8). */
export type PopupVariant = 'anchored' | 'sheet';

export interface PinPopupProps {
  state: GameState;
  portId: PortId;
  variant: PopupVariant;
  /** Signing and opening go through the store. */
  store: GameStore;
  /** ✕, or the sheet's backdrop. */
  onClose: () => void;
  /** After an office opens here; the popup's job is done, so the caller closes it. */
  onOfficeOpened: (officeId: string) => void;
  /** The map card the anchored popup stays inside and the sheet sits under. */
  cardRef: RefObject<HTMLElement | null>;
  /** The map, to find the pin on the page. */
  svgRef: RefObject<SVGSVGElement | null>;
  /** The pin's head (or the port's dot) in map units, which the anchored popup sits beside. */
  at: XY | null;
}

/** The cash figure the message line is sized for, so the box doesn't grow as cash changes. */
const WIDEST_CASH = -88_888;

/**
 * A pin's popup: sign an agent at a port outside the network, or open an office where there's none. Its width is
 * set by the widest label it can show in the language, and its rows are fixed, so signing doesn't change its size.
 * It doesn't hold the clock.
 */
export function PinPopup({ state, portId, variant, store, onClose, onOfficeOpened, cardRef, svgRef, at }: PinPopupProps) {
  const { t, money } = useT();
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [signed, setSigned] = useState<string | null>(null);
  const [place, setPlace] = useState<CSSProperties>({ left: 0, top: 0 });
  const [mapBottom, setMapBottom] = useState(0);
  const backdrop = useBackdropDismiss(onClose);
  const sheet = variant === 'sheet';

  const city = t(PORTS[portId].cityKey);
  const regionId = PORTS[portId].regionId;
  const agent = state.agents.find((a) => a.regionId === regionId) ?? null;
  const rent = Math.round(B.offices.baseRent * COUNTRIES[REGIONS[regionId].country].rentMult);
  // A button shows when its rule would pass apart from cash; short of cash it's disabled and the message says why.
  const signCheck = canSign(state, portId);
  const openCheck = canOpen(state, portId);
  const showSign = signed === null && (signCheck.ok || signCheck.reason === 'error.cannotAfford');
  const showOpen = openCheck.ok || openCheck.reason === 'error.cannotAfford';
  const short = (showSign && !signCheck.ok) || (showOpen && !openCheck.ok);
  const line = signed ? t('pop.agentShort', { name: signed }) : agent ? t('pop.agent', { name: agent.name }) : t('pop.notCovered');

  const signLabel = t('pop.sign', { cost: money(B.agents.signCost) });
  const openLabel = t('pop.open', { cost: money(B.offices.openCost) });
  const rentLine = t('pop.rent', { rent: money(rent) });

  // Focus moves into the popup when it opens (the caller takes it back to the pin on close).
  useEffect(() => {
    ref.current?.focus();
  }, []);

  // Anchored: beside the pin, flipped to its left when there's no room on the right, and kept inside the map card.
  // Sheet: under the map card, so the map stays in view.
  const atX = at?.[0];
  const atY = at?.[1];
  useLayoutEffect(() => {
    const measure = () => {
      const card = cardRef.current?.getBoundingClientRect();
      if (!card) return;
      if (sheet) {
        setMapBottom(card.bottom);
        return;
      }
      const pop = ref.current?.getBoundingClientRect();
      const view = viewScale(svgRef.current);
      if (!pop || !view || atX === undefined || atY === undefined) return;
      const [px, py] = toPagePoint(view, atX, atY);
      const x = px - card.left;
      const y = py - card.top;
      const edge = 8;
      const gap = 16;
      let left = x + gap;
      if (left + pop.width > card.width - edge) left = x - gap - pop.width;
      left = Math.max(edge, Math.min(left, card.width - pop.width - edge));
      const top = Math.max(edge, Math.min(y - pop.height / 2, card.height - pop.height - edge));
      setPlace({ left, top });
    };
    measure();
    // Placed again when the window or the popup's own size changes (the web font arriving, say).
    window.addEventListener('resize', measure);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (ref.current) ro?.observe(ref.current);
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [sheet, atX, atY, cardRef, svgRef]);

  const sign = () => {
    const r = runAction(store, (s) => signAgent(s, portId));
    if (r.ok) setSigned(store.getState().agents.find((a) => a.portId === portId)?.name ?? null);
  };
  const open = () => {
    const r = runAction(store, (s) => openOffice(s, portId));
    const office = r.ok ? store.getState().offices.find((o) => o.portId === portId) : undefined;
    if (office) onOfficeOpened(office.id);
  };

  const style: CSSProperties = sheet ? { maxHeight: Math.max(0, window.innerHeight - mapBottom) } : place;

  const card = (
    <div
      ref={ref}
      className={sheet ? 'pin-pop is-sheet' : 'pin-pop is-anchored'}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      style={style}
      data-pop={portId}
    >
      <Tooltip text={t('pop.close')} keys={['Esc']} className="pop-close-tip">
        <button type="button" className="pop-close" aria-label={t('pop.close')} aria-keyshortcuts="Escape" onClick={onClose}>
          <span aria-hidden="true">✕</span>
        </button>
      </Tooltip>
      <div className="pop-inner">
        <h3 id={titleId}>{city}</h3>
        <p className="pop-sub pop-fill">{line}</p>
        <div className="pop-actions">
          {(showSign || signed) && (
            <div data-row="action">
              {signed ? (
                <p className="pop-signed pop-btn" role="status">
                  {t('pop.signed', { name: signed })}
                </p>
              ) : (
                <Tooltip text={t('pop.signTip', { city, pct: Math.round(B.agents.profitShare * 100) })} className="tip-block">
                  <button type="button" className="btn btn-agent pop-btn" disabled={!signCheck.ok} onClick={sign}>
                    {signLabel}
                  </button>
                </Tooltip>
              )}
            </div>
          )}
          {showOpen && (
            <div data-row="open">
              <Tooltip text={t('pop.openTip')} className="tip-block">
                <button type="button" className="btn pop-btn" disabled={!openCheck.ok} onClick={open}>
                  {openLabel}
                </button>
              </Tooltip>
              <p className="pop-rent">{rentLine}</p>
            </div>
          )}
        </div>
        {/* Kept even when empty, so a message coming or going doesn't change the box's height. */}
        <p className="pop-msg pop-fill" data-row="message" role="status">
          {short ? t('pop.cantAfford', { cash: money(state.cash) }) : ''}
        </p>
        {/* Invisible: every label the popup can show in this language, so its width is the widest of them. */}
        <div className="pop-sizer" aria-hidden="true">
          <span className="btn">{signLabel}</span>
          <span className="btn">{openLabel}</span>
          <span className="pop-rent">{rentLine}</span>
          <span className="pop-sub">{t('pop.notCovered')}</span>
          <span className="pop-msg">{t('pop.cantAfford', { cash: `−${money(-WIDEST_CASH)}` })}</span>
          {AGENT_NAMES.map((name) => (
            <span key={name} className="pop-signed">
              {t('pop.signed', { name })}
            </span>
          ))}
          {AGENT_NAMES.map((name) => (
            <span key={name} className="pop-sub">
              {t('pop.agentShort', { name })}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  if (!sheet) return card;
  return (
    <>
      <div className="pop-backdrop" style={{ top: mapBottom }} {...backdrop} />
      {card}
    </>
  );
}
