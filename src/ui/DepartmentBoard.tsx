import { useEffect, useRef, type CSSProperties } from 'react';
import { useT } from '../i18n/I18nProvider';
import type { MsgKey } from '../i18n';
import { byUrgency } from '../rules/work';
import { DEPTS, type DeptKey, type GameState, type Task } from '../rules/types';
import { PORTS, type PortId } from '../rules/world';
import { DEPT_KEYS, oneDecimal } from './format';
import { DeptIcon } from './Icons';
import { StaffRow } from './StaffRow';
import { DEPT_HOTKEYS } from './useHotkeys';

const MAX_CARDS = 6;
/** A task this many days from its deadline, or fewer, is flagged "due soon". */
const DUE_SOON_DAYS = 3;

const HINT_KEYS: Record<DeptKey, MsgKey> = {
  sales: 'dept.salesHint',
  ops: 'dept.opsHint',
  accounting: 'dept.accountingHint',
};

/** Department color tokens, handed to the column as custom properties. */
const deptVars = (dept: DeptKey) =>
  ({ '--dept': `var(--${dept})`, '--dept-soft': `var(--${dept}-soft)` }) as CSSProperties;

export interface DepartmentBoardProps {
  state: GameState;
  /** Moves the owner to that department. */
  onWorkHere: (dept: DeptKey) => void;
  /** Each task list scrolls inside its column (the laptop layout); otherwise the page around it scrolls. */
  scrollTasks?: boolean;
}

export function DepartmentBoard({ state, onWorkHere, scrollTasks = false }: DepartmentBoardProps) {
  return (
    <div className="depts">
      {DEPTS.map((dept) => (
        <DeptColumn key={dept} dept={dept} state={state} onWorkHere={onWorkHere} scrollTasks={scrollTasks} />
      ))}
    </div>
  );
}

function DeptColumn({ dept, state, onWorkHere, scrollTasks }: { dept: DeptKey } & DepartmentBoardProps) {
  const { t } = useT();
  const staff = state.employees.filter((e) => e.dept === dept);
  const tasks = state.tasks.filter((task) => task.dept === dept).sort(byUrgency);
  const shown = tasks.slice(0, MAX_CARDS);
  const late = tasks.filter((task) => task.deadline < state.day).length;
  const ownerHere = state.employees.some((e) => e.isOwner && e.dept === dept);
  const headingId = `dept-${dept}`;

  // The Work here button disappears once pressed, so focus follows to the "You work here" tag.
  const hereRef = useRef<HTMLSpanElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (ownerHere && moved.current) hereRef.current?.focus();
    moved.current = false;
  }, [ownerHere]);

  return (
    <section className="card dept" style={deptVars(dept)} aria-labelledby={headingId}>
      <div className="dept-head">
        <span className="dept-badge">
          <DeptIcon dept={dept} />
        </span>
        <div className="dept-name">
          <h2 id={headingId}>{t(DEPT_KEYS[dept])}</h2>
          <small>{t(HINT_KEYS[dept])}</small>
        </div>
        <span className="dept-queue">
          <b>{tasks.length}</b>
          {t('dept.inQueue')}
        </span>
        <div className="dept-tools">
          {ownerHere ? (
            <span className="dept-here" ref={hereRef} tabIndex={-1}>
              <span className="star" aria-hidden="true">
                ★
              </span>{' '}
              {t('dept.youWorkHere')}
            </span>
          ) : (
            <button
              type="button"
              className="btn btn-soft btn-small"
              title={t('hotkey.tip', { label: t('dept.workHereHint'), key: DEPT_HOTKEYS[dept] })}
              aria-keyshortcuts={DEPT_HOTKEYS[dept]}
              onClick={() => {
                moved.current = true;
                onWorkHere(dept);
              }}
            >
              {t('dept.workHere')}
            </button>
          )}
          {late > 0 && <span className="dept-late">{t('dept.late', { n: late })}</span>}
        </div>
      </div>

      {staff.length === 0 ? (
        <p className="dept-empty">{t('dept.empty')}</p>
      ) : (
        <StaffRow staff={staff} state={state} />
      )}

      {/* A scrolling list takes focus (tabIndex 0) so the keyboard can scroll it. */}
      <div
        className={scrollTasks ? 'dept-tasks scroll' : 'dept-tasks'}
        role={scrollTasks ? 'region' : undefined}
        aria-label={scrollTasks ? t('dept.tasks', { dept: t(DEPT_KEYS[dept]) }) : undefined}
        tabIndex={scrollTasks ? 0 : undefined}
      >
        <ul className="tasks">
          {shown.map((task) => (
            <TaskCard key={task.id} task={task} state={state} />
          ))}
        </ul>
        {tasks.length > shown.length && <p className="more">{t('dept.more', { n: tasks.length - shown.length })}</p>}
      </div>
    </section>
  );
}

function TaskCard({ task, state }: { task: Task; state: GameState }) {
  const { t, lang } = useT();
  const shipment = state.shipments.find((sh) => sh.id === task.shipmentId);
  const customer = state.customers.find((c) => c.id === shipment?.customerId)?.name ?? '';
  const city = (portId: string | undefined) => (portId && portId in PORTS ? t(PORTS[portId as PortId].cityKey) : '');
  const label = t(`task.${task.kind}`, { customer, from: city(shipment?.fromPortId), to: city(shipment?.toPortId) });

  const daysLeft = task.deadline - state.day;
  const hot = daysLeft <= DUE_SOON_DAYS;
  const due = daysLeft < 0 ? t('task.overdue') : hot ? t('task.dueSoon') : t('task.dueIn', { n: daysLeft });
  // Progress is rounded down so a nearly finished task never reads as done.
  const progress = oneDecimal(lang, Math.floor(task.progress * 10) / 10);
  const pct = Math.min(100, (100 * task.progress) / task.workload);

  const classes = ['task', hot && 'is-hot', task.assigneeId === null && 'is-waiting'].filter(Boolean).join(' ');
  return (
    <li className={classes}>
      <div className="task-title">{label}</div>
      <div className="task-meta">
        <span className="bar" aria-hidden="true">
          <i style={{ width: `${Math.max(4, pct)}%` }} />
        </span>
        <span className="task-progress">
          {`${progress} / ${oneDecimal(lang, task.workload)}`}
        </span>
        <span className={hot ? 'due is-due' : 'due'}>{due}</span>
      </div>
    </li>
  );
}
