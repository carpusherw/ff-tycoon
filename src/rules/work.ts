import { DEPTS, type Employee, type GameState, type Task } from './types';

const DONE_EPSILON = 1e-9;

/** The order the engine hands out and works tasks in: earliest deadline, then oldest, then id. */
export function byUrgency(a: Task, b: Task): number {
  if (a.deadline !== b.deadline) return a.deadline - b.deadline;
  if (a.createdDay !== b.createdDay) return a.createdDay - b.createdDay;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function openCounts(s: GameState): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of s.tasks) {
    if (t.assigneeId !== null) counts.set(t.assigneeId, (counts.get(t.assigneeId) ?? 0) + 1);
  }
  return counts;
}

/** Gives queued tasks to the department staff member with the most free capacity slots. */
export function assignTasks(s: GameState): void {
  const open = openCounts(s);
  for (const office of s.offices) {
    for (const dept of DEPTS) {
      const staff = s.employees.filter((e) => e.officeId === office.id && e.dept === dept);
      if (staff.length === 0) continue;
      const queue = s.tasks
        .filter((t) => t.assigneeId === null && t.officeId === office.id && t.dept === dept)
        .sort(byUrgency);
      for (const task of queue) {
        let best: Employee | null = null;
        let bestFree = 0;
        for (const e of staff) {
          const free = e.capacity - (open.get(e.id) ?? 0);
          if (free > bestFree) {
            best = e;
            bestFree = free;
          }
        }
        if (best === null) break;
        task.assigneeId = best.id;
        open.set(best.id, (open.get(best.id) ?? 0) + 1);
      }
    }
  }
}

/** Spends each employee's speed on their open tasks for one day; returns and removes finished tasks. */
export function progressTasks(s: GameState): Task[] {
  for (const e of s.employees) {
    let budget = e.speed;
    const mine = s.tasks.filter((t) => t.assigneeId === e.id).sort(byUrgency);
    for (const task of mine) {
      if (budget <= 0) break;
      const gain = Math.max(0, Math.min(budget, task.workload / task.minDuration, task.workload - task.progress));
      task.progress += gain;
      budget -= gain;
    }
  }
  const done = s.tasks.filter((t) => t.progress >= t.workload - DONE_EPSILON);
  s.tasks = s.tasks.filter((t) => t.progress < t.workload - DONE_EPSILON);
  return done;
}

/** Puts every task held by the employee back in the queue. */
export function unassignAll(s: GameState, employeeId: string): void {
  for (const t of s.tasks) {
    if (t.assigneeId === employeeId) t.assigneeId = null;
  }
}
