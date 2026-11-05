import { memo, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useT } from '../i18n/I18nProvider';
import type { MsgKey } from '../i18n';
import { byUrgency } from '../rules/work';
import { DEPTS, type DeptKey, type GameState, type Task } from '../rules/types';
import { PORTS, type PortId } from '../rules/world';
import { DEPT_KEYS, fixedOne } from './format';
import { DeptIcon } from './Icons';
import { StaffRow } from './StaffRow';
import { DEPT_HOTKEYS } from './useHotkeys';

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
  /** Each task list scrolls inside its column; otherwise the page around it scrolls. Tabs always scroll. */
  scrollTasks?: boolean;
  /** Three columns side by side (the laptop), or one department at a time behind tabs (the phone). */
  layout?: 'columns' | 'tabs';
}

/** Each task's card title, worked out once per render with lookup maps, so hundreds of tasks stay cheap. */
type TaskLabel = (task: Task) => string;

export function DepartmentBoard({ state, onWorkHere, scrollTasks = false, layout = 'columns' }: DepartmentBoardProps) {
  const { t } = useT();
  const { shipments, customers } = state;
  const labelOf = useMemo<TaskLabel>(() => {
    const shipmentById = new Map(shipments.map((sh) => [sh.id, sh]));
    const customerName = new Map(customers.map((c) => [c.id, c.name]));
    const city = (portId: string | undefined) => (portId && portId in PORTS ? t(PORTS[portId as PortId].cityKey) : '');
    return (task) => {
      const sh = shipmentById.get(task.shipmentId);
      const customer = (sh && customerName.get(sh.customerId)) ?? '';
      return t(`task.${task.kind}`, { customer, from: city(sh?.fromPortId), to: city(sh?.toPortId) });
    };
  }, [shipments, customers, t]);
  if (layout === 'tabs') return <DeptTabs state={state} onWorkHere={onWorkHere} labelOf={labelOf} />;
  return (
    <div className="depts">
      {DEPTS.map((dept) => (
        <DeptColumn
          key={dept}
          dept={dept}
          state={state}
          onWorkHere={onWorkHere}
          scrollTasks={scrollTasks}
          labelOf={labelOf}
        />
      ))}
    </div>
  );
}

/**
 * The phone board: a tab per department (name, task count, late count when there are late tasks) and
 * the chosen department's column below. It opens on the owner's department and then stays where the
 * player put it, even when the owner moves.
 */
function DeptTabs({ state, onWorkHere, labelOf }: { labelOf: TaskLabel } & DepartmentBoardProps) {
  const { t, tn } = useT();
  const [selected, setSelected] = useState<DeptKey>(
    () => state.employees.find((e) => e.isOwner)?.dept ?? DEPTS[0],
  );
  const base = useId();
  const tabId = (dept: DeptKey) => `${base}-tab-${dept}`;
  const panelId = `${base}-panel`;

  const onKeyDown = (e: KeyboardEvent) => {
    const i = DEPTS.indexOf(selected);
    const next =
      e.key === 'ArrowRight' ? DEPTS[(i + 1) % DEPTS.length]
      : e.key === 'ArrowLeft' ? DEPTS[(i - 1 + DEPTS.length) % DEPTS.length]
      : e.key === 'Home' ? DEPTS[0]
      : e.key === 'End' ? DEPTS[DEPTS.length - 1]
      : null;
    if (!next) return;
    e.preventDefault();
    setSelected(next);
    document.getElementById(tabId(next))?.focus();
  };

  return (
    <>
      <div className="dept-tabs" role="tablist" aria-label={t('tab.departments')} onKeyDown={onKeyDown}>
        {DEPTS.map((dept) => {
          const tasks = state.tasks.filter((task) => task.dept === dept);
          const late = tasks.filter((task) => task.deadline < state.day).length;
          const isOn = dept === selected;
          return (
            <button
              key={dept}
              id={tabId(dept)}
              type="button"
              role="tab"
              className="dept-tab"
              style={deptVars(dept)}
              aria-selected={isOn}
              aria-controls={isOn ? panelId : undefined}
              tabIndex={isOn ? 0 : -1}
              onClick={() => setSelected(dept)}
            >
              <span className="dept-tab-name">{t(DEPT_KEYS[dept])}</span>
              <span className="dept-tab-counts">
                <span className="num num-tabtasks">{tn('dept.tabTasks', tasks.length)}</span>
                {late > 0 && <span className="dept-tab-late num num-late">{tn('dept.late', late)}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <div className="depts dept-tab-panel" role="tabpanel" id={panelId} aria-labelledby={tabId(selected)}>
        <DeptColumn dept={selected} state={state} onWorkHere={onWorkHere} scrollTasks labelOf={labelOf} />
      </div>
    </>
  );
}

function DeptColumn({
  dept,
  state,
  onWorkHere,
  scrollTasks,
  labelOf,
}: { dept: DeptKey; labelOf: TaskLabel } & DepartmentBoardProps) {
  const { t, tn } = useT();
  const staff = state.employees.filter((e) => e.dept === dept);
  // Every task is shown; the list scrolls inside the column.
  const tasks = state.tasks.filter((task) => task.dept === dept).sort(byUrgency);
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
          <b className="num num-queue">{tasks.length}</b>
          {tn('dept.inQueue', tasks.length)}
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
              title={`${t('hotkey.tip', { label: t('dept.workHere'), key: DEPT_HOTKEYS[dept] })}\n${t('dept.workHereHint')}`}
              aria-keyshortcuts={DEPT_HOTKEYS[dept]}
              onClick={() => {
                moved.current = true;
                onWorkHere(dept);
              }}
            >
              {t('dept.workHere')}
            </button>
          )}
          {late > 0 && <span className="dept-late num num-late">{tn('dept.late', late)}</span>}
        </div>
      </div>

      {staff.length === 0 ? (
        <p className="dept-empty">{t('dept.empty')}</p>
      ) : (
        <StaffRow staff={staff} state={state} title={t(DEPT_KEYS[dept])} />
      )}

      {/* A scrolling list takes focus (tabIndex 0) so the keyboard can scroll it. */}
      <div
        className={scrollTasks ? 'dept-tasks scroll' : 'dept-tasks'}
        role={scrollTasks ? 'region' : undefined}
        aria-label={scrollTasks ? t('dept.tasks', { dept: t(DEPT_KEYS[dept]) }) : undefined}
        tabIndex={scrollTasks ? 0 : undefined}
      >
        <ul className="tasks">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              label={labelOf(task)}
              daysLeft={task.deadline - state.day}
              progress={task.progress}
              workload={task.workload}
              waiting={task.assigneeId === null}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

interface TaskCardProps {
  label: string;
  daysLeft: number;
  progress: number;
  workload: number;
  waiting: boolean;
}

/** Plain-value props, so a card whose task didn't change skips re-rendering. */
const TaskCard = memo(function TaskCard({ label, daysLeft, progress: done, workload, waiting }: TaskCardProps) {
  const { t, lang } = useT();
  const hot = daysLeft <= DUE_SOON_DAYS;
  const due = daysLeft < 0 ? t('task.overdue') : hot ? t('task.dueSoon') : t('task.dueIn', { n: daysLeft });
  // Progress is rounded down so a nearly finished task never reads as done; both figures always have
  // one decimal, so 0.0 → 0.1 → 1.0 never changes the number of characters.
  const progress = fixedOne(lang, Math.floor(done * 10) / 10);
  const pct = Math.min(100, (100 * done) / workload);

  const classes = ['task', hot && 'is-hot', waiting && 'is-waiting'].filter(Boolean).join(' ');
  return (
    <li className={classes}>
      <div className="task-title">{label}</div>
      <div className="task-meta">
        <span className="bar" aria-hidden="true">
          <i style={{ width: `${Math.max(4, pct)}%` }} />
        </span>
        <span className="task-progress num num-progress">{`${progress} / ${fixedOne(lang, workload)}`}</span>
        <span className={hot ? 'due num num-due is-due' : 'due num num-due'}>{due}</span>
      </div>
    </li>
  );
});
