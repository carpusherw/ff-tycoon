import { newId } from './ids';
import { addLog } from './log';
import { createGame } from './newGame';

const game = () => createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });

describe('ids', () => {
  it('each id is its prefix and the shared counter, which then moves on', () => {
    const s = game();
    const n = s.nextId;
    expect(newId(s, 't')).toBe(`t${n}`);
    expect(newId(s, 'sh')).toBe(`sh${n + 1}`);
    expect(s.nextId).toBe(n + 2);
  });

  it('ids stay unique across prefixes, also after a save round trip', () => {
    const s = game();
    const ids = Array.from({ length: 50 }, (_, i) => newId(s, i % 2 ? 'c' : 'k'));
    expect(new Set(ids.map((id) => id.replace(/^\D+/, ''))).size).toBe(50);
    const loaded = JSON.parse(JSON.stringify(s)) as typeof s;
    expect(ids).not.toContain(newId(loaded, 'c'));
    expect(ids).not.toContain(newId(loaded, 'k'));
  });
});

describe('log', () => {
  it('puts the newest entry first, stamped with the day', () => {
    const s = game();
    s.day = 7;
    addLog(s, 'good', { key: 'log.hired', params: { name: 'Mei' } });
    expect(s.log[0]).toEqual({ day: 7, tone: 'good', msg: { key: 'log.hired', params: { name: 'Mei' } } });
  });

  it('keeps the 60 newest entries and drops the oldest', () => {
    const s = game();
    s.log = [];
    for (let day = 1; day <= 75; day++) {
      s.day = day;
      addLog(s, 'info', { key: 'log.yearEnd', params: { year: day } });
    }
    expect(s.log).toHaveLength(60);
    expect(s.log[0].day).toBe(75);
    expect(s.log.at(-1)!.day).toBe(16);
  });
});
