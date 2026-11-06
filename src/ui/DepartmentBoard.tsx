import { memo, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useT } from '../i18n/I18nProvider';
import type { MsgKey } from '../i18n';
import { B } from '../rules/balance';
import { customerName } from '../rules/chain';
import { isDueSoon } from '../rules/deadlines';
import { byUrgency } from '../rules/work';
import { DEPTS, type DeptKey, type GameState, type Task } from '../rules/types';
import { PORTS, type PortId } from '../rules/world';
import { DEPT_KEYS, fixedOne } from './format';
import { DeptIcon, PersonIcon } from './Icons';
import { Combo, Kbd } from './Kbd';
import { StaffRow } from './StaffRow';
import { Tooltip } from './Tooltip';
import { useDoubleActivate } from './useDoubleActivate';
import { DEPT_HOTKEYS, hireKeys } from './useHotkeys';

const HINT_KEYS: Record<DeptKey, MsgKey> = {
  sales: 'dept.salesHint',
  ops: 'dept.opsHint',
  accounting: 'dept.accountingHint',
};

/** Department color tokens, handed to the column as custom properties. */
const deptVars = (dept: DeptKey) =>
  ({ '--dept': `var(--${dept})`, '--dept-soft': `var(--${dept}-soft)` }) as CSSProperties;

/** Why the last job ad was refused, shown under that department's header. */
export interface HireError {
  officeId: string;
  dept: DeptKey;
  reason: MsgKey;
}

export interface DepartmentBoardProps {
  state: GameState;
  /** The office on screen: only its staff and tasks are shown. */
  officeId: string;
  /** Moves the owner to that department of the office on screen. */
  onWorkHere: (dept: DeptKey) => void;
  /** Posts a job ad for that department of the office on screen. */
  onHire: (dept: DeptKey) => void;
  hireError?: HireError | null;
  /** Each task list scrolls inside its column; otherwise the page around it scrolls. Tabs always scroll. */
  scrollTasks?: boolean;
  /** Three columns side by side (the laptop), or one department at a time behind tabs (the phone). */
  layout?: 'columns' | 'tabs';
  /** The phone's selected department tab, when the screen holds it; otherwise the board keeps its own. */
  deptTab?: DeptKey;
  onDeptTab?: (dept: DeptKey) => void;
}

/** A task card's title, and the tag before it on an agent's handling shipment or a local-charges bill. */
interface TaskText {
  label: string;
  tag: string | null;
  agentTag: boolean;
}
/** Each task's card text, worked out once per render with lookup maps, so hundreds of tasks stay cheap. */
type TaskLabel = (task: Task) => TaskText;

/** The office's staff and tasks in one department, and whether the owner works there. */
function deptOf(state: GameState, officeId: string, dept: DeptKey) {
  const staff = state.employees.filter((e) => e.officeId === officeId && e.dept === dept);
  const tasks = state.tasks.filter((task) => task.officeId === officeId && task.dept === dept);
  const late = tasks.filter((task) => task.deadline < state.day).length;
  return { staff, tasks, late, ownerHere: staff.some((e) => e.isOwner) };
}

export function DepartmentBoard(props: DepartmentBoardProps) {
  const { state, layout = 'columns' } = props;
  const { t, money } = useT();
  const labelOf = useMemo<TaskLabel>(() => {
    const shipmentById = new Map(state.shipments.map((sh) => [sh.id, sh]));
    const customerById = new Map(state.customers.map((c) => [c.id, c.name]));
    const city = (portId: string | undefined) => (portId && portId in PORTS ? t(PORTS[portId as PortId].cityKey) : '');
    return (task) => {
      const sh = shipmentById.get(task.shipmentId);
      // A sale's customer from the map; an agent's handling shipment is named for its agent.
      const customer = !sh ? '' : sh.kind === 'sale' ? (customerById.get(sh.customerId ?? '') ?? '') : customerName(state, sh);
      const label = t(`task.${task.kind}`, { customer, from: city(sh?.fromPortId), to: city(sh?.toPortId) });
      const amount = sh ? money(sh.localCharges) : '';
      if (sh && task.kind === 'charges') return { label, tag: t('task.chargesTag', { amount }), agentTag: false };
      if (sh?.kind === 'handling') return { label, tag: t('task.agentTag', { amount }), agentTag: true };
      return { label, tag: null, agentTag: false };
    };
  }, [state, t, money]);
  if (layout === 'tabs') return <DeptTabs {...props} labelOf={labelOf} />;
  return (
    <div className="depts">
      {DEPTS.map((dept) => (
        <DeptColumn key={dept} dept={dept} {...props} labelOf={labelOf} />
      ))}
    </div>
  );
}

/**
 * The phone board: a tab per department (name, staff count, task count, late count when there are late tasks) and
 * the chosen department's column below. It opens on the owner's department and then stays where the
 * player put it, even when the owner moves.
 */
function DeptTabs({ labelOf, ...props }: { labelOf: TaskLabel } & DepartmentBoardProps) {
  const { state, officeId, onWorkHere, deptTab, onDeptTab } = props;
  const { t } = useT();
  const [ownSelected, setOwnSelected] = useState<DeptKey>(
    () => state.employees.find((e) => e.isOwner)?.dept ?? DEPTS[0],
  );
  const selected = deptTab ?? ownSelected;
  const setSelected = onDeptTab ?? setOwnSelected;
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
      <div className="dept-tabs" role="tablist" aria-label={t('dept.tabsLabel')} onKeyDown={onKeyDown}>
        {DEPTS.map((dept) => (
          <DeptTab
            key={dept}
            dept={dept}
            state={state}
            officeId={officeId}
            id={tabId(dept)}
            panelId={panelId}
            selected={dept === selected}
            onSelect={() => setSelected(dept)}
            onWorkHere={onWorkHere}
          />
        ))}
      </div>
      <div className="depts dept-tab-panel" role="tabpanel" id={panelId} aria-labelledby={tabId(selected)}>
        <DeptColumn {...props} dept={selected} scrollTasks labelOf={labelOf} />
      </div>
    </>
  );
}

/** One department tab. A double-click or double-tap also moves the owner there. */
function DeptTab({
  dept,
  state,
  officeId,
  id,
  panelId,
  selected,
  onSelect,
  onWorkHere,
}: {
  dept: DeptKey;
  state: GameState;
  officeId: string;
  id: string;
  panelId: string;
  selected: boolean;
  onSelect: () => void;
  onWorkHere: (dept: DeptKey) => void;
}) {
  const { t, tn } = useT();
  const { tasks, late, ownerHere, staff: people } = deptOf(state, officeId, dept);
  const staff = people.length;
  const double = useDoubleActivate(() => {
    if (!ownerHere) onWorkHere(dept);
  });
  return (
    <button
      id={id}
      type="button"
      role="tab"
      className="dept-tab"
      style={deptVars(dept)}
      aria-selected={selected}
      aria-controls={selected ? panelId : undefined}
      tabIndex={selected ? 0 : -1}
      onMouseDown={double.onMouseDown}
      onClick={(e) => {
        onSelect();
        double.onClick(e);
      }}
    >
      <span className="dept-tab-head">
        <span className="dept-tab-name">{t(DEPT_KEYS[dept])}</span>
        <span className="dept-tab-staff">
          <PersonIcon />
          <span className="num" aria-hidden="true">
            {staff}
          </span>
          <span className="sr-only">{tn('dept.tabStaff', staff)}</span>
        </span>
      </span>
      <span className="dept-tab-counts">
        <span className="num">{tn('dept.tabTasks', tasks.length)}</span>
        {late > 0 && <span className="dept-tab-late num">{tn('dept.late', late)}</span>}
      </span>
    </button>
  );
}

function DeptColumn({
  dept,
  state,
  officeId,
  onWorkHere,
  onHire,
  hireError,
  scrollTasks,
  labelOf,
}: { dept: DeptKey; labelOf: TaskLabel } & DepartmentBoardProps) {
  const { t, tn, tx, money } = useT();
  const { staff, tasks, late, ownerHere } = deptOf(state, officeId, dept);
  // Every task is shown; the list scrolls inside the column.
  tasks.sort(byUrgency);
  const headingId = `dept-${dept}`;
  const shift = hireKeys(dept);
  // A double-click or double-tap anywhere in the column (but on its buttons) moves the owner here too:
  // one gesture on a phone. Where the owner already is it does nothing, as their open tasks would go back.
  const double = useDoubleActivate(
    () => {
      if (!ownerHere) onWorkHere(dept);
    },
    { ignoreControls: true },
  );

  // The Work here button disappears once pressed, so focus follows to the "You work here" tag.
  const hereRef = useRef<HTMLSpanElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (ownerHere && moved.current) hereRef.current?.focus();
    moved.current = false;
  }, [ownerHere]);

  return (
    <section className="card dept" style={deptVars(dept)} aria-labelledby={headingId} {...double}>
      <div className="dept-head">
        <span className="dept-badge">
          <DeptIcon dept={dept} />
        </span>
        <div className="dept-name">
          <h2 id={headingId}>{t(DEPT_KEYS[dept])}</h2>
          <small>{t(HINT_KEYS[dept])}</small>
        </div>
        <span className="dept-queue">
          <b className="num">{tasks.length}</b>
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
            <Tooltip text={t('dept.workHere')} keys={[DEPT_HOTKEYS[dept]]} hint={t('dept.workHereHint')}>
              <button
                type="button"
                className="btn btn-soft btn-small"
                aria-keyshortcuts={DEPT_HOTKEYS[dept]}
                onClick={() => {
                  moved.current = true;
                  onWorkHere(dept);
                }}
              >
                {t('dept.workHere')}
              </button>
            </Tooltip>
          )}
          {late > 0 && <span className="dept-late num">{tn('dept.late', late)}</span>}
          {/* Last in the row and pushed to its right end, so it stays put whatever is on its left. Shift and the
              department's letter post for it; H (where the owner works) is told in the text, so the tooltip stays
              the same when the owner moves. */}
          <Tooltip
            text={tn('hire.tip', B.hiring.candidatesPerRoll, { dept: t(DEPT_KEYS[dept]) })}
            keysLabel={tx('side.hireKeys', { shift: <Combo keys={shift} />, h: <Kbd k="H" /> })}
            className="dept-hire"
          >
            <button
              type="button"
              className="btn btn-small"
              // An open session would be charged again and replaced, so no second job ad while one is open.
              disabled={state.hiring !== null}
              data-hire-dept={dept}
              aria-keyshortcuts={shift.join('+')}
              onClick={() => onHire(dept)}
            >
              {t('hire.button', { cost: money(B.hiring.jobAdCost) })}
            </button>
          </Tooltip>
        </div>
        {hireError?.officeId === officeId && hireError.dept === dept && (
          <p className="error dept-error" role="alert">
            {t(hireError.reason)}
          </p>
        )}
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
              {...labelOf(task)}
              daysLeft={task.deadline - state.day}
              dueSoon={isDueSoon(task, state.day)}
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

interface TaskCardProps extends TaskText {
  daysLeft: number;
  /** Measured against the task's own deadline window (see `isDueSoon`). */
  dueSoon: boolean;
  progress: number;
  workload: number;
  waiting: boolean;
}

/** Plain-value props, so a card whose task didn't change skips re-rendering. */
const TaskCard = memo(function TaskCard({
  label,
  tag,
  agentTag,
  daysLeft,
  dueSoon: hot,
  progress: done,
  workload,
  waiting,
}: TaskCardProps) {
  const { t, lang } = useT();
  const due = daysLeft < 0 ? t('task.overdue') : hot ? t('task.dueSoon') : t('task.dueIn', { n: daysLeft });
  // Progress is rounded down so a nearly finished task never reads as done; both figures always have
  // one decimal, so 0.0 → 0.1 → 1.0 never changes the number of characters.
  const progress = fixedOne(lang, Math.floor(done * 10) / 10);
  const pct = Math.min(100, (100 * done) / workload);

  const classes = ['task', hot && 'is-hot', waiting && 'is-waiting'].filter(Boolean).join(' ');
  return (
    <li className={classes}>
      <div className="task-title">
        {tag && <span className={agentTag ? 'task-tag is-agent' : 'task-tag'}>{tag}</span>}
        {label}
      </div>
      <div className="task-meta">
        <span className="bar" aria-hidden="true">
          <i style={{ width: `${Math.max(4, pct)}%` }} />
        </span>
        <span className="task-progress num num-progress">{`${progress} / ${fixedOne(lang, workload)}`}</span>
        <span className={hot ? 'due num is-due' : 'due num'}>{due}</span>
      </div>
    </li>
  );
});
