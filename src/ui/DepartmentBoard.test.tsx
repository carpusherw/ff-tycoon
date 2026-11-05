import { fireEvent, render, screen, within } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nProvider';
import { createGame } from '../rules/newGame';
import type { DeptKey, Employee, GameState, Task, TaskKind } from '../rules/types';
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

function mount(s: GameState, onWorkHere = vi.fn()) {
  const view = render(
    <I18nProvider lang="en">
      <DepartmentBoard state={s} onWorkHere={onWorkHere} />
    </I18nProvider>,
  );
  return { ...view, onWorkHere };
}

/** Adds a non-owner employee to a department. */
function addStaff(s: GameState, dept: DeptKey, name: string, over: Partial<Employee> = {}): Employee {
  seq += 1;
  const e: Employee = {
    id: `e9${seq}`,
    name,
    officeId: 'o1',
    dept,
    isOwner: false,
    salary: 2400,
    hiredDay: s.day,
    speed: 0.8,
    capacity: 2,
    winRate: 0.3,
    ...over,
  };
  s.employees.push(e);
  return e;
}

const staffRow = (region: HTMLElement) => within(region).getByRole('list', { name: 'Staff' });

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
    const chip = within(staffRow(sales)).getByRole('button', { name: 'You, 3 of 4 tasks open' });
    expect(chip).toHaveTextContent('3/4');
    expect(chip).toHaveAttribute('title', 'You');
    expect(within(chip).getByText('★')).toBeInTheDocument();
    expect(within(sales).getAllByText('Quote · Glimfrondle Crafts — Taipei → Los Angeles')).toHaveLength(3);
  });

  it.each([
    { n: 3, label: 'due soon' },
    { n: 1, label: 'due soon' },
    { n: 0, label: 'due soon' },
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

  it('a deadline more than 3 days away shows "due in {n}d" and is not red', () => {
    const s = game();
    s.day = 10;
    addTask(s, 'quote', { deadline: 14 });
    mount(s);

    const later = screen.getByText('due in 4d');
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

  it('"Work here" sits in every column but the owner\'s, which says "You work here" instead', () => {
    const { onWorkHere } = mount(game());
    const sales = column('Sales');
    expect(within(sales).getByText('You work here')).toBeInTheDocument();
    expect(within(sales).queryByRole('button', { name: 'Work here' })).not.toBeInTheDocument();

    for (const name of ['Operations', 'Accounting']) {
      expect(within(column(name)).queryByText('You work here')).not.toBeInTheDocument();
    }
    fireEvent.click(within(column('Operations')).getByRole('button', { name: 'Work here' }));
    expect(onWorkHere).toHaveBeenCalledWith('ops');
  });

  it('a column with overdue tasks shows "{n} late"; none hides the badge', () => {
    const s = game();
    s.day = 20;
    addTask(s, 'booking', { deadline: 18 });
    addTask(s, 'arrival', { deadline: 19 });
    addTask(s, 'booking', { deadline: 20 }); // due today is not late yet
    addTask(s, 'quote', { deadline: 25 });
    mount(s);

    const late = within(column('Operations')).getByText('2 late');
    expect(late).toHaveClass('dept-late');
    expect(within(column('Sales')).queryByText(/late$/)).not.toBeInTheDocument();
    expect(within(column('Accounting')).queryByText(/late$/)).not.toBeInTheDocument();
  });

  it('staff sit in one compact row per column, one chip per person', () => {
    const s = game();
    addStaff(s, 'sales', 'Bramwell Oakes');
    addStaff(s, 'sales', 'Tilda Quenby');
    addStaff(s, 'ops', 'Orrin Vale');
    mount(s);

    expect(within(staffRow(column('Sales'))).getAllByRole('button')).toHaveLength(3);
    expect(within(staffRow(column('Operations'))).getAllByRole('button')).toHaveLength(1);
    expect(within(column('Accounting')).queryByRole('list', { name: 'Staff' })).not.toBeInTheDocument();
    // Names live in the tooltip and the stats card, not on the chip itself.
    const chip = within(staffRow(column('Operations'))).getByRole('button', { name: /^Orrin Vale/ });
    expect(chip).toHaveAttribute('title', 'Orrin Vale');
    expect(chip).toHaveTextContent('0/2');
  });

  it("clicking the owner's chip shows their stats; Escape closes and returns focus", () => {
    mount(game());
    const chip = within(staffRow(column('Sales'))).getByRole('button', { name: /^You,/ });
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'true');

    const card = document.getElementById(chip.getAttribute('aria-controls')!)!;
    expect(within(card).getByRole('heading', { name: 'You' })).toBeInTheDocument();
    const value = (label: string) => within(card).getByText(label).nextElementSibling?.textContent;
    expect(value('Speed')).toBe('1.2 / day');
    expect(value('Capacity')).toBe('3 tasks');
    expect(value('Win rate')).toBe('45%');
    expect(value('Salary')).toBe('No salary');

    fireEvent.keyDown(chip, { key: 'Escape' });
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('heading', { name: 'You' })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(chip);
  });

  it("a hired operator's stats show salary and no win rate", () => {
    const s = game();
    addStaff(s, 'ops', 'Orrin Vale', { speed: 0.9, capacity: 4, salary: 2600 });
    mount(s);
    const chip = within(staffRow(column('Operations'))).getByRole('button', { name: /^Orrin Vale/ });
    fireEvent.click(chip);
    const card = document.getElementById(chip.getAttribute('aria-controls')!)!;
    const value = (label: string) => within(card).getByText(label).nextElementSibling?.textContent;
    expect(within(card).getByRole('heading', { name: 'Orrin Vale' })).toBeInTheDocument();
    expect(value('Speed')).toBe('0.9 / day');
    expect(value('Capacity')).toBe('4 tasks');
    expect(value('Salary')).toBe('$2,600 / mo');
    expect(within(card).queryByText('Win rate')).not.toBeInTheDocument();

    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'false');
  });
});
