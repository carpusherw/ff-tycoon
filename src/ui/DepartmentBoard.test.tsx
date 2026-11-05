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
    expect(within(sales).getByText('1.5 / 3.0')).toBeInTheDocument();
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

  it('shows every task card, the most urgent first (the list scrolls)', () => {
    const s = game();
    for (let i = 0; i < 8; i++) addTask(s, 'quote', { deadline: 20 - i });
    mount(s);

    const sales = column('Sales');
    const dues = within(sales)
      .getAllByText(/^due in/)
      .map((el) => el.textContent);
    expect(dues).toEqual([13, 14, 15, 16, 17, 18, 19, 20].map((d) => `due in ${d}d`));
    expect(within(sales).queryByText(/more waiting/)).not.toBeInTheDocument();
  });

  it('renders hundreds of tasks with their customer and ports', () => {
    const s = game();
    for (let i = 0; i < 400; i++) addTask(s, 'booking', { deadline: 30 + (i % 50) });
    mount(s);
    const ops = column('Operations');
    expect(within(ops).getAllByText('Booking · Glimfrondle Crafts — Taipei → Los Angeles')).toHaveLength(400);
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

  describe('double-click or double-tap on a column moves the owner there', () => {
    function mountColumns(s: GameState) {
      const onWorkHere = vi.fn();
      render(
        <I18nProvider lang="en">
          <DepartmentBoard state={s} onWorkHere={onWorkHere} />
        </I18nProvider>,
      );
      return onWorkHere;
    }
    afterEach(() => {
      vi.useRealTimers();
    });

    it('a mouse double-click anywhere in another column', () => {
      const onWorkHere = mountColumns(game());
      const heading = screen.getByRole('heading', { name: 'Operations' });
      fireEvent.click(heading, { detail: 1 });
      expect(onWorkHere).not.toHaveBeenCalled();
      fireEvent.click(heading, { detail: 2 });
      expect(onWorkHere).toHaveBeenCalledExactlyOnceWith('ops');
    });

    it('two quick taps (each reported as a single click), but not two slow ones', () => {
      vi.useFakeTimers();
      const onWorkHere = mountColumns(game());
      const empty = within(screen.getByRole('region', { name: 'Accounting' })).getByText(/^Nobody works here yet/);
      fireEvent.click(empty, { detail: 1 });
      vi.advanceTimersByTime(500);
      fireEvent.click(empty, { detail: 1 });
      expect(onWorkHere).not.toHaveBeenCalled();
      vi.advanceTimersByTime(200);
      fireEvent.click(empty, { detail: 1 });
      expect(onWorkHere).toHaveBeenCalledExactlyOnceWith('accounting');
    });

    it("does nothing in the owner's own column, so their open tasks stay theirs", () => {
      const onWorkHere = mountColumns(game());
      const heading = screen.getByRole('heading', { name: 'Sales' });
      fireEvent.click(heading, { detail: 1 });
      fireEvent.click(heading, { detail: 2 });
      expect(onWorkHere).not.toHaveBeenCalled();
    });

    it('keyboard clicks and clicks on the column\'s own buttons are not a double', () => {
      const onWorkHere = mountColumns(game());
      const ops = screen.getByRole('region', { name: 'Operations' });
      fireEvent.click(ops, { detail: 0 });
      fireEvent.click(ops, { detail: 0 });
      expect(onWorkHere).not.toHaveBeenCalled();
      // Each press of Work here moves the owner once; the pair adds no third move.
      const button = within(ops).getByRole('button', { name: 'Work here' });
      fireEvent.click(button, { detail: 1 });
      fireEvent.click(button, { detail: 2 });
      expect(onWorkHere).toHaveBeenCalledTimes(2);
    });
  });

  it('counts, badges, progress, due labels and staff loads use tabular figures', () => {
    const s = game();
    s.day = 20;
    addTask(s, 'booking', { deadline: 18 });
    addTask(s, 'booking', { deadline: 30, progress: 1.5 });
    mount(s);
    const ops = column('Operations');
    expect(within(ops).getByText('1 late')).toHaveClass('num');
    expect(within(ops).getByText('2', { selector: '.dept-queue b' })).toHaveClass('num');
    expect(within(ops).getByText('1.5 / 2.0')).toHaveClass('num');
    expect(within(ops).getByText('due in 10d')).toHaveClass('num');
    expect(within(ops).getByText('overdue')).toHaveClass('num');
    const load = within(column('Sales')).getByText('0/3');
    expect(load).toHaveClass('chip-load');
    expect(load).toHaveClass('num');
  });

  it('progress reserves its widest width; short labels and counts hug their text', () => {
    const s = game();
    s.day = 20;
    addTask(s, 'booking', { deadline: 18 });
    addTask(s, 'booking', { deadline: 30, progress: 1.5 });
    mount(s);
    const ops = column('Operations');
    // Progress changes all the time, so it keeps a box; always one decimal: 0 → 0.1 → 1.0 keeps its characters.
    expect(within(ops).getByText('1.5 / 2.0')).toHaveClass('num', 'num-progress');
    expect(within(ops).getByText('0.0 / 2.0')).toHaveClass('num', 'num-progress');
    // Badges and labels change now and then: same-width digits, but no reserved box.
    const hugs = [
      within(ops).getByText('1 late'),
      within(ops).getByText('2', { selector: '.dept-queue b' }),
      within(ops).getByText('due in 10d'),
      within(ops).getByText('overdue'),
      within(column('Sales')).getByText('0/3'),
    ];
    for (const el of hugs) {
      expect(el).toHaveClass('num');
      expect([...el.classList].filter((c) => c.startsWith('num-'))).toEqual([]);
    }
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

  it('a full staff row shows two lines of chips and a "+N" chip instead of scrolling', () => {
    const s = game();
    for (let i = 0; i < 12; i++) addStaff(s, 'sales', `Seller ${i + 1}`);
    mount(s);
    const row = staffRow(column('Sales'));
    expect(row).not.toHaveClass('scroll');
    // With no layout to measure, the row assumes a 272 px line: two lines hold 6 chips and the "+N".
    const more = within(row).getByRole('button', { name: 'Show all 13 staff' });
    expect(more).toHaveTextContent('+7');
    expect(within(row).getAllByRole('button')).toHaveLength(7);

    fireEvent.click(more);
    const list = screen.getByRole('dialog', { name: 'Sales staff' });
    expect(list.contains(document.activeElement)).toBe(true);
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(13);
    expect(within(items[0]).getByRole('heading', { name: 'You' })).toBeInTheDocument();
    expect(within(items[12]).getByRole('heading', { name: 'Seller 12' })).toBeInTheDocument();
    expect(within(items[12]).getByText('Salary').nextElementSibling).toHaveTextContent('/ mo');

    fireEvent.keyDown(list, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(more);
  });

  it('a row that fits shows every chip and no "+N"', () => {
    const s = game();
    for (let i = 0; i < 5; i++) addStaff(s, 'ops', `Op ${i + 1}`);
    mount(s);
    const row = staffRow(column('Operations'));
    expect(within(row).getAllByRole('button')).toHaveLength(5);
    expect(within(row).queryByRole('button', { name: /^Show all/ })).not.toBeInTheDocument();
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

describe('DepartmentBoard as tabs (phone)', () => {
  function mountTabs(s: GameState) {
    return render(
      <I18nProvider lang="en">
        <DepartmentBoard state={s} onWorkHere={vi.fn()} layout="tabs" />
      </I18nProvider>,
    );
  }
  const tabs = () => within(screen.getByRole('tablist', { name: 'Departments' })).getAllByRole('tab');

  it('shows three department tabs with task counts, and late counts only when there are some', () => {
    const s = game();
    s.day = 20;
    addTask(s, 'quote', { deadline: 25 });
    addTask(s, 'booking', { deadline: 18 });
    addTask(s, 'arrival', { deadline: 19 });
    addTask(s, 'booking', { deadline: 30 });
    mountTabs(s);
    expect(tabs().map((tab) => tab.querySelector('.dept-tab-counts')?.textContent)).toEqual(['1 task', '3 tasks2 late', '0 tasks']);
    for (const text of ['2 late', '3 tasks']) {
      const count = within(tabs()[1]).getByText(text);
      expect(count).toHaveClass('num');
      expect([...count.classList].filter((c) => c.startsWith('num-'))).toEqual([]);
    }
  });

  it('each tab shows how many staff work there, the owner included', () => {
    const s = game();
    const hire = (dept: DeptKey, id: string): Employee => ({ ...s.employees[0], id, dept, isOwner: false, name: id, salary: 2000 });
    s.employees.push(hire('ops', 'e8'), hire('ops', 'e9'));
    mountTabs(s);
    expect(tabs().map((tab) => tab.querySelector('.dept-tab-staff')?.textContent)).toEqual([
      '11 staff',
      '22 staff',
      '00 staff',
    ]);
    // The visible figure is a plain tabular number; the words are for screen readers.
    const shown = tabs()[1].querySelector('.dept-tab-staff .num')!;
    expect(shown).toHaveTextContent('2');
    expect(shown).toHaveAttribute('aria-hidden', 'true');
    expect(within(tabs()[1]).getByText('2 staff')).toHaveClass('sr-only');
  });

  it.each([
    ['zh-Hant', '1 位員工'],
    ['zh-Hans', '1 位员工'],
  ] as const)('the staff count is translated (%s)', (lang, text) => {
    render(
      <I18nProvider lang={lang}>
        <DepartmentBoard state={game()} onWorkHere={vi.fn()} layout="tabs" />
      </I18nProvider>,
    );
    expect(within(screen.getAllByRole('tab')[0]).getByText(text)).toHaveClass('sr-only');
  });

  it("opens on the owner's department and shows only that column", () => {
    const s = game();
    s.employees[0].dept = 'ops';
    mountTabs(s);
    expect(tabs()[1]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Operations' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Sales' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Accounting' })).not.toBeInTheDocument();
  });

  it('selecting a tab shows that column; arrow keys move between tabs', () => {
    mountTabs(game());
    fireEvent.click(tabs()[1]);
    expect(screen.getByRole('region', { name: 'Operations' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Sales' })).not.toBeInTheDocument();
    expect(screen.getByRole('tabpanel', { name: /^Operations/ })).toBeInTheDocument();

    fireEvent.keyDown(tabs()[1], { key: 'ArrowRight' });
    expect(tabs()[2]).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(tabs()[2]);
    fireEvent.keyDown(tabs()[2], { key: 'ArrowRight' });
    expect(tabs()[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(tabs()[0], { key: 'ArrowLeft' });
    expect(tabs()[2]).toHaveAttribute('aria-selected', 'true');
    expect(tabs().map((tab) => tab.getAttribute('tabindex'))).toEqual(['-1', '-1', '0']);
  });

  it('a double-tap on a tab selects it and moves the owner there; Enter twice only selects', () => {
    const onWorkHere = vi.fn();
    render(
      <I18nProvider lang="en">
        <DepartmentBoard state={game()} onWorkHere={onWorkHere} layout="tabs" />
      </I18nProvider>,
    );
    fireEvent.click(tabs()[2], { detail: 0 });
    fireEvent.click(tabs()[2], { detail: 0 });
    expect(tabs()[2]).toHaveAttribute('aria-selected', 'true');
    expect(onWorkHere).not.toHaveBeenCalled();

    fireEvent.click(tabs()[1], { detail: 1 });
    expect(tabs()[1]).toHaveAttribute('aria-selected', 'true');
    expect(onWorkHere).not.toHaveBeenCalled();
    fireEvent.click(tabs()[1], { detail: 1 });
    expect(onWorkHere).toHaveBeenCalledExactlyOnceWith('ops');

    // The owner's own tab: nothing to do.
    fireEvent.click(tabs()[0], { detail: 1 });
    fireEvent.click(tabs()[0], { detail: 2 });
    expect(onWorkHere).toHaveBeenCalledTimes(1);
  });

  it('taps on two different tabs are not a double', () => {
    const onWorkHere = vi.fn();
    render(
      <I18nProvider lang="en">
        <DepartmentBoard state={game()} onWorkHere={onWorkHere} layout="tabs" />
      </I18nProvider>,
    );
    fireEvent.click(tabs()[1], { detail: 1 });
    fireEvent.click(tabs()[2], { detail: 1 });
    expect(onWorkHere).not.toHaveBeenCalled();
  });

  it('keeps the chosen tab when the owner moves', () => {
    const s = game();
    const view = mountTabs(s);
    fireEvent.click(tabs()[2]);
    const moved = structuredClone(s);
    moved.employees[0].dept = 'ops';
    view.rerender(
      <I18nProvider lang="en">
        <DepartmentBoard state={moved} onWorkHere={vi.fn()} layout="tabs" />
      </I18nProvider>,
    );
    expect(tabs()[2]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Accounting' })).toBeInTheDocument();
  });
});
