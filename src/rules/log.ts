import type { GameState, LogEntry, Msg } from './types';

const MAX_LOG = 60;

/** Prepends a log entry for the current day and keeps at most 60 entries. */
export function addLog(s: GameState, tone: LogEntry['tone'], msg: Msg): void {
  s.log.unshift({ day: s.day, tone, msg });
  if (s.log.length > MAX_LOG) s.log.length = MAX_LOG;
}
