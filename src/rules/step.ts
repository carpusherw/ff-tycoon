import { B } from './balance';
import { advanceShipments, onTaskCompleted } from './chain';
import { handleMissedDeadlines } from './deadlines';
import { generateRequests } from './demand';
import { generateHandling } from './handling';
import { addLog } from './log';
import { monthEnd } from './money';
import { pruneState } from './prune';
import type { GameState } from './types';
import { assignTasks, progressTasks } from './work';
import { recordYearReport } from './yearReport';

/** Plays one in-game day. Does nothing once the run has ended (completed or bankrupt). */
export function stepDay(s: GameState): void {
  if (s.ended) return;
  s.day += 1;
  advanceShipments(s);
  generateRequests(s);
  generateHandling(s);
  assignTasks(s);
  for (const task of progressTasks(s)) onTaskCompleted(s, task);
  assignTasks(s);
  handleMissedDeadlines(s);
  if (s.day % B.daysPerMonth === 0) {
    monthEnd(s);
    pruneState(s);
  }
  // The year is reported even when its last month end just bankrupted the company.
  if (s.day % B.daysPerYear === 0) recordYearReport(s);
  if (s.day % B.daysPerYear === 0 && !s.ended) {
    // With auto-pause off nobody answers a year end until Resume, so one is kept, not one per year.
    if (!s.pauseReasons.includes('yearEnd')) s.pauseReasons.push('yearEnd');
    addLog(s, 'info', { key: 'log.yearEnd', params: { year: s.day / B.daysPerYear } });
  }
  if (s.day >= B.runDays && !s.ended) {
    s.ended = { reason: 'completed', day: s.day };
    s.pauseReasons.push('runEnded');
  }
}
