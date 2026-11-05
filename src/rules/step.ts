import { B } from './balance';
import { advanceShipments, onTaskCompleted } from './chain';
import { handleMissedDeadlines } from './deadlines';
import { generateRequests } from './demand';
import { addLog } from './log';
import { monthEnd } from './money';
import type { GameState } from './types';
import { assignTasks, progressTasks } from './work';

/** Plays one in-game day. Does nothing once the run has ended (completed or bankrupt). */
export function stepDay(s: GameState): void {
  if (s.ended) return;
  s.day += 1;
  advanceShipments(s);
  generateRequests(s);
  assignTasks(s);
  for (const task of progressTasks(s)) onTaskCompleted(s, task);
  assignTasks(s);
  handleMissedDeadlines(s);
  if (s.day % B.daysPerMonth === 0) monthEnd(s);
  if (s.day % B.daysPerYear === 0 && !s.ended) {
    s.pauseReasons.push('yearEnd');
    addLog(s, 'info', { key: 'log.yearEnd', params: { year: s.day / B.daysPerYear } });
  }
  if (s.day >= B.runDays && !s.ended) {
    s.ended = { reason: 'completed', day: s.day };
    s.pauseReasons.push('runEnded');
  }
}
