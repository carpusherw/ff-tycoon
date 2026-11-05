import { createGame } from './newGame';
import type { Employee, GameState, Task } from './types';
import { assignTasks, progressTasks, unassignAll } from './work';

function setup(capacity: number): { s: GameState; owner: Employee } {
  const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
  const owner = s.employees.find((e) => e.isOwner)!;
  owner.dept = 'ops';
  owner.speed = 2;
  owner.capacity = capacity;
  return { s, owner };
}

function addTask(s: GameState, id: string, over: Partial<Task> = {}): Task {
  const task: Task = {
    id,
    kind: 'booking',
    officeId: 'o1',
    dept: 'ops',
    shipmentId: 'sh1',
    workload: 2,
    progress: 0,
    minDuration: 4,
    createdDay: 0,
    deadline: 10,
    assigneeId: null,
    late: false,
    ...over,
  };
  s.tasks.push(task);
  return task;
}

function runDays(s: GameState, n: number): Task[] {
  const done: Task[] = [];
  for (let i = 0; i < n; i++) {
    assignTasks(s);
    done.push(...progressTasks(s));
  }
  return done;
}

describe('work engine', () => {
  it("a task can't beat its minimum duration", () => {
    const { s } = setup(3);
    const task = addTask(s, 't1');

    expect(runDays(s, 1)).toEqual([]);
    expect(task.progress).toBe(0.5);

    expect(runDays(s, 2)).toEqual([]);
    expect(s.tasks).toContain(task);

    const done = runDays(s, 1);
    expect(done.map((t) => t.id)).toEqual(['t1']);
    expect(s.tasks).toEqual([]);
  });

  it('capacity 1 leaves speed unused', () => {
    const { s } = setup(1);
    for (const id of ['t1', 't2', 't3', 't4']) addTask(s, id);

    const done = runDays(s, 4);
    expect(done.length).toBe(1);
    expect(s.tasks.length).toBe(3);
  });

  it('capacity 4 uses the whole day', () => {
    const { s } = setup(4);
    for (const id of ['t1', 't2', 't3', 't4']) addTask(s, id);

    const done = runDays(s, 4);
    expect(done.length).toBe(4);
    expect(s.tasks).toEqual([]);
  });

  it('earliest deadline is assigned first', () => {
    const { s, owner } = setup(1);
    const late = addTask(s, 't1', { deadline: 9 });
    const early = addTask(s, 't2', { deadline: 5 });

    assignTasks(s);
    expect(early.assigneeId).toBe(owner.id);
    expect(late.assigneeId).toBeNull();
  });

  it('nobody in the department means the task waits', () => {
    const { s } = setup(3);
    const task = addTask(s, 't1', { kind: 'invoice', dept: 'accounting' });

    runDays(s, 3);
    expect(task.assigneeId).toBeNull();
    expect(task.progress).toBe(0);
    expect(s.tasks).toContain(task);
  });

  it('unassignAll frees only that employee', () => {
    const { s, owner } = setup(3);
    const mine = addTask(s, 't1', { assigneeId: owner.id });
    const other = addTask(s, 't2', { assigneeId: 'e99' });

    unassignAll(s, owner.id);
    expect(mine.assigneeId).toBeNull();
    expect(other.assigneeId).toBe('e99');
  });
});
