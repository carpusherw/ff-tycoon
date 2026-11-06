import { DEPTS, type DeptKey, type GameState } from './types';

/** Something the company overview flags about one office. */
export type OfficeAlert =
  | { officeId: string; kind: 'late'; dept: DeptKey; count: number }
  | { officeId: string; kind: 'noStaff' };

/**
 * The company overview's flags: each office with nobody in it, then each department with overdue tasks (already
 * marked late, or past their deadline today), the most overdue first. Ties keep office order, then department order.
 */
export function officeAlerts(s: GameState): OfficeAlert[] {
  const noStaff: OfficeAlert[] = [];
  const late: Extract<OfficeAlert, { kind: 'late' }>[] = [];
  for (const office of s.offices) {
    if (!s.employees.some((e) => e.officeId === office.id)) noStaff.push({ officeId: office.id, kind: 'noStaff' });
    for (const dept of DEPTS) {
      const count = s.tasks.filter(
        (t) => t.officeId === office.id && t.dept === dept && (t.late || t.deadline < s.day),
      ).length;
      if (count > 0) late.push({ officeId: office.id, kind: 'late', dept, count });
    }
  }
  late.sort((a, b) => b.count - a.count);
  return [...noStaff, ...late];
}
