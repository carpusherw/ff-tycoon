import { useT } from '../i18n/I18nProvider';
import { officeAlerts } from '../rules/overview';
import type { GameState } from '../rules/types';
import { PORTS, type PortId } from '../rules/world';
import { Tooltip } from './Tooltip';
import { OFFICE_HOTKEYS } from './useHotkeys';

/** The office `step` places away from `officeId` in office order, wrapping round; null with fewer than two offices. */
export function stepOffice(state: GameState, officeId: string, step: 1 | -1): string | null {
  const ids = state.offices.map((o) => o.id);
  if (ids.length < 2) return null;
  const i = Math.max(0, ids.indexOf(officeId));
  return ids[(i + step + ids.length) % ids.length];
}

export interface OfficeSwitcherProps {
  state: GameState;
  /** The office on screen. */
  officeId: string;
  onSelect: (officeId: string) => void;
}

/**
 * One button per office, with a star where the owner works and a badge for late tasks or no staff, between
 * arrows for the previous and next office. Left out with a single office.
 */
export function OfficeSwitcher({ state, officeId, onSelect }: OfficeSwitcherProps) {
  const { t, tn } = useT();
  if (state.offices.length < 2) return null;
  const late = new Map<string, number>();
  const noStaff = new Set<string>();
  for (const alert of officeAlerts(state)) {
    if (alert.kind === 'late') late.set(alert.officeId, (late.get(alert.officeId) ?? 0) + alert.count);
    else noStaff.add(alert.officeId);
  }
  const ownerOfficeId = state.employees.find((e) => e.isOwner)?.officeId;
  const step = (n: 1 | -1) => {
    const id = stepOffice(state, officeId, n);
    if (id) onSelect(id);
  };
  const arrow = (n: 1 | -1) => {
    const label = t(n < 0 ? 'office.prev' : 'office.next');
    const key = n < 0 ? OFFICE_HOTKEYS.prev : OFFICE_HOTKEYS.next;
    return (
      <Tooltip text={label} keys={[key]}>
        <button type="button" className="step-btn" aria-label={label} aria-keyshortcuts={key} onClick={() => step(n)}>
          <span aria-hidden="true">{n < 0 ? '‹' : '›'}</span>
        </button>
      </Tooltip>
    );
  };

  return (
    <div className="office-switch" role="group" aria-label={t('office.switcher')}>
      {arrow(-1)}
      <div className="office-switch-list">
        {state.offices.map((office, i) => {
          const lateCount = late.get(office.id) ?? 0;
          const ownerHere = office.id === ownerOfficeId;
          return (
            <button
              key={office.id}
              type="button"
              className="office-tab"
              data-office={office.id}
              aria-pressed={office.id === officeId}
              onClick={() => onSelect(office.id)}
            >
              <span className="office-dot" aria-hidden="true">
                {i === 0 ? '⌂' : '●'}
              </span>
              {ownerHere && (
                <span className="star" aria-hidden="true">
                  ★
                </span>
              )}
              <span>{t(PORTS[office.portId as PortId].cityKey)}</span>
              {ownerHere && <span className="sr-only">{t('dept.youWorkHere')}</span>}
              {lateCount > 0 ? (
                <span className="badge-late num">{tn('dept.late', lateCount)}</span>
              ) : noStaff.has(office.id) ? (
                <span className="badge-warn">{t('office.noStaff')}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {arrow(1)}
    </div>
  );
}
