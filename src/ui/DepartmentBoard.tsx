import type { CSSProperties } from 'react';
import { useT } from '../i18n/I18nProvider';
import type { MsgKey } from '../i18n';
import { byUrgency } from '../rules/work';
import { DEPTS, type DeptKey, type Employee, type GameState, type Task } from '../rules/types';
import { PORTS, type PortId } from '../rules/world';
import { DEPT_KEYS, oneDecimal } from './format';
import { DeptIcon } from './Icons';

const MAX_CARDS = 6;

const HINT_KEYS: Record<DeptKey, MsgKey> = {
  sales: 'dept.salesHint',
  ops: 'dept.opsHint',
  accounting: 'dept.accountingHint',
};

/** Department color tokens, handed to the column as custom properties. */
const deptVars = (dept: DeptKey) =>
  ({ '--dept': `var(--${dept})`, '--dept-soft': `var(--${dept}-soft)` }) as CSSProperties;

export function DepartmentBoard({ state }: { state: GameState }) {
  return (
    <div className="depts">
      {DEPTS.map((dept) => (
        <DeptColumn key={dept} dept={dept} state={state} />
      ))}
    </div>
  );
}

function DeptColumn({ dept, state }: { dept: DeptKey; state: GameState }) {
  const { t } = useT();
  const staff = state.employees.filter((e) => e.dept === dept);
  const tasks = state.tasks.filter((task) => task.dept === dept).sort(byUrgency);
  const shown = tasks.slice(0, MAX_CARDS);
  const headingId = `dept-${dept}`;

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
      </div>

      {staff.length === 0 ? (
        <p className="dept-empty">{t('dept.empty')}</p>
      ) : (
        <ul className="staff">
          {staff.map((e) => (
            <StaffChip key={e.id} employee={e} open={state.tasks.filter((x) => x.assigneeId === e.id).length} />
          ))}
        </ul>
      )}

      <ul className="tasks">
        {shown.map((task) => (
          <TaskCard key={task.id} task={task} state={state} />
        ))}
      </ul>
      {tasks.length > shown.length && <p className="more">{t('dept.more', { n: tasks.length - shown.length })}</p>}
    </section>
  );
}

function StaffChip({ employee, open }: { employee: Employee; open: number }) {
  const { t } = useT();
  const name = employee.isOwner ? t('staff.owner') : employee.name;
  const full = open >= employee.capacity;
  return (
    <li className={full ? 'chip is-full' : 'chip'}>
      <span className="avatar" aria-hidden="true">
        {name.slice(0, 1)}
      </span>
      <span className="chip-name">{name}</span>
      {employee.isOwner && (
        <span className="star" aria-hidden="true">
          ★
        </span>
      )}
      <span className="chip-load">{t('dept.open', { open, capacity: employee.capacity })}</span>
    </li>
  );
}

function TaskCard({ task, state }: { task: Task; state: GameState }) {
  const { t, lang } = useT();
  const shipment = state.shipments.find((sh) => sh.id === task.shipmentId);
  const customer = state.customers.find((c) => c.id === shipment?.customerId)?.name ?? '';
  const city = (portId: string | undefined) => (portId && portId in PORTS ? t(PORTS[portId as PortId].cityKey) : '');
  const label = t(`task.${task.kind}`, { customer, from: city(shipment?.fromPortId), to: city(shipment?.toPortId) });

  const daysLeft = task.deadline - state.day;
  const hot = daysLeft <= 1;
  const due = daysLeft < 0 ? t('task.overdue') : hot ? t('task.dueToday') : t('task.dueIn', { n: daysLeft });
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
