import { createGame } from './newGame';
import { officeAlerts } from './overview';
import type { DeptKey, Employee, GameState, Task } from './types';

function newGame(): GameState {
  return createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
}

/** A second office, pushed in directly. */
function addOffice(s: GameState, id: string): void {
  s.offices.push({ id, portId: 'RTM', regionId: 'NL', rent: 3200 });
}

function addEmployee(s: GameState, id: string, officeId: string, dept: DeptKey): void {
  const e: Employee = {
    id, name: 'Wei', officeId, dept, isOwner: false, salary: 3000, hiredDay: 0, speed: 1, capacity: 5, winRate: 0,
  };
  s.employees.push(e);
}

function addTask(s: GameState, id: string, officeId: string, dept: DeptKey, deadline: number, late = false): void {
  const t: Task = {
    id, kind: dept === 'sales' ? 'quote' : dept === 'ops' ? 'booking' : 'invoice', officeId, dept, shipmentId: 'sh1',
    workload: 2, progress: 0, minDuration: 1, createdDay: 0, deadline, assigneeId: null, late,
  };
  s.tasks.push(t);
}

describe('office alerts', () => {
  it('a fresh game has no alerts', () => {
    expect(officeAlerts(newGame())).toEqual([]);
  });

  it('a new office with nobody is flagged noStaff', () => {
    const s = newGame();
    addOffice(s, 'o2');

    expect(officeAlerts(s)).toEqual([{ officeId: 'o2', kind: 'noStaff' }]);
  });

  it('late Ops tasks at the second office flag that office and department', () => {
    const s = newGame();
    s.day = 20;
    addOffice(s, 'o2');
    addEmployee(s, 'e90', 'o2', 'ops');
    addTask(s, 't1', 'o2', 'ops', 15, true);
    addTask(s, 't2', 'o2', 'ops', 19);
    addTask(s, 't3', 'o2', 'ops', 20);
    addTask(s, 't4', 'o1', 'ops', 30);

    expect(officeAlerts(s)).toEqual([{ officeId: 'o2', kind: 'late', dept: 'ops', count: 2 }]);
  });

  it('noStaff comes first, then the most late tasks', () => {
    const s = newGame();
    s.day = 20;
    addOffice(s, 'o2');
    addEmployee(s, 'e90', 'o2', 'ops');
    addOffice(s, 'o3');
    addTask(s, 't1', 'o1', 'accounting', 10, true);
    addTask(s, 't2', 'o2', 'ops', 10, true);
    addTask(s, 't3', 'o2', 'ops', 12, true);
    addTask(s, 't4', 'o2', 'ops', 15);

    expect(officeAlerts(s)).toEqual([
      { officeId: 'o3', kind: 'noStaff' },
      { officeId: 'o2', kind: 'late', dept: 'ops', count: 3 },
      { officeId: 'o1', kind: 'late', dept: 'accounting', count: 1 },
    ]);
  });
});
