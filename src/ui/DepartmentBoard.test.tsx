import { render, screen, within } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nProvider';
import { createGame } from '../rules/newGame';
import type { DeptKey, GameState, Task, TaskKind } from '../rules/types';
import { DepartmentBoard } from './DepartmentBoard';

const game = () => createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });

const DEPT_OF: Record<TaskKind, DeptKey> = { quote: 'sales', booking: 'ops', arrival: 'ops', invoice: 'accounting' };

let seq = 0;

/** Adds a customer, a TPE → LAX shipment and one task for it. */
function addTask(s: GameState, kind: TaskKind, over: Partial<Task> = {}): Task {
  seq += 1;
  const customerId = `c9${seq}`;
  const shipmentId = `s9${seq}`;
  s.customers.push({ id: customerId, name: 'Glimfrondle Crafts', officeId: 'o1', status: 'prospect', payments: [] });
  s.shipments.push({
    id: shipmentId,
    customerId,
    sellingOfficeId: 'o1',
    direction: 'export',
    fromPortId: 'TPE',
    toPortId: 'LAX',
    origin: { kind: 'office', officeId: 'o1' },
    destination: { kind: 'agent', agentId: s.agents[0].id },
    status: 'quoting',
    margin: 1000,
    agentShare: 250,
    departDay: null,
    arriveDay: null,
    agentReadyDay: null,
    arrived: false,
    paid: false,
    arrivalDone: false,
  });
  const task: Task = {
    id: `t9${seq}`,
    kind,
    officeId: 'o1',
    dept: DEPT_OF[kind],
    shipmentId,
    workload: 2,
    progress: 0,
    minDuration: 1,
    createdDay: s.day,
    deadline: s.day + 5,
    assigneeId: null,
    late: false,
    ...over,
  };
  s.tasks.push(task);
  return task;
}

function mount(s: GameState) {
  return render(
    <I18nProvider lang="en">
      <DepartmentBoard state={s} />
    </I18nProvider>,
  );
}

const column = (name: string) => screen.getByRole('region', { name });

describe('DepartmentBoard', () => {
  it('shows progress and capacity', () => {
    const s = game();
    const owner = s.employees[0];
    owner.capacity = 4;
    addTask(s, 'quote', { progress: 1.5, workload: 3, assigneeId: owner.id });
    addTask(s, 'quote', { assigneeId: owner.id });
    addTask(s, 'quote', { assigneeId: owner.id });
    mount(s);

    const sales = column('Sales');
    expect(within(sales).getByText('1.5 / 3')).toBeInTheDocument();
    expect(within(sales).getByText('3 / 4 open')).toBeInTheDocument();
    expect(within(sales).getByText('You')).toBeInTheDocument();
    expect(within(sales).getByText('★')).toBeInTheDocument();
    expect(within(sales).getAllByText('Quote · Glimfrondle Crafts — Taipei → Los Angeles')).toHaveLength(3);
  });

  it.each([
    { n: 1, label: 'due today' },
    { n: 0, label: 'due today' },
    { n: -1, label: 'overdue' },
  ])('shows "$label" in red when n = $n', ({ n, label }) => {
    const s = game();
    s.day = 10;
    addTask(s, 'booking', { deadline: s.day + n });
    mount(s);

    const due = screen.getByText(label);
    expect(due).toHaveClass('is-due');
    expect(due.closest('.task')).toHaveClass('is-hot');
  });

  it('a later deadline shows "due in {n}d" and is not red', () => {
    const s = game();
    s.day = 10;
    addTask(s, 'quote', { deadline: 15 });
    mount(s);

    const later = screen.getByText('due in 5d');
    expect(later).not.toHaveClass('is-due');
    expect(later.closest('.task')).not.toHaveClass('is-hot');
  });

  it('empty department hint', () => {
    mount(game());
    const hint = 'Nobody works here yet. Hire someone, or move yourself here.';
    expect(within(column('Operations')).getByText(hint)).toBeInTheDocument();
    expect(within(column('Accounting')).getByText(hint)).toBeInTheDocument();
    expect(within(column('Sales')).queryByText(hint)).not.toBeInTheDocument();
  });

  it('shows at most 6 task cards, the most urgent first, and counts the rest', () => {
    const s = game();
    for (let i = 0; i < 8; i++) addTask(s, 'quote', { deadline: 20 - i });
    mount(s);

    const sales = column('Sales');
    const dues = within(sales)
      .getAllByText(/^due in/)
      .map((el) => el.textContent);
    expect(dues).toEqual(['due in 13d', 'due in 14d', 'due in 15d', 'due in 16d', 'due in 17d', 'due in 18d']);
    expect(within(sales).getByText('+2 more waiting')).toBeInTheDocument();
  });
});
