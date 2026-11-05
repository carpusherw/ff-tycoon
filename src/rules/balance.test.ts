import { B } from './balance';

describe('balance', () => {
  it('every task deadline leaves room for its minimum duration', () => {
    for (const k of Object.keys(B.tasks) as (keyof typeof B.tasks)[]) {
      expect(B.tasks[k].deadlineDays).toBeGreaterThanOrEqual(B.tasks[k].minDuration + 1);
    }
  });

  it('a day lasts one second at 1×', () => {
    expect(B.dayMs).toBe(1000);
  });

  it('runDays equals 10 years', () => {
    expect(B.runDays).toBe(10 * B.daysPerYear);
  });
});
