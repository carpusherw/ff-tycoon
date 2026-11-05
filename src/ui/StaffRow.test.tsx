import { fitChips } from './StaffRow';

describe('fitChips', () => {
  // A 100 px line with a 10 px gap holds two 40 px chips, so two lines hold four.
  it('shows everything that fits in two lines', () => {
    expect(fitChips([40, 40, 40, 40], 100, 10, 30)).toBe(4);
    expect(fitChips([], 100, 10, 30)).toBe(0);
  });

  it('leaves room for the "+N" chip on the second line when the rest overflows', () => {
    // Line 1: 40 + 40; line 2: 40 + 40 — a fifth chip would need a third line, so the last
    // chip on line 2 makes way for the 30 px "+N".
    expect(fitChips([40, 40, 40, 40, 40], 100, 10, 30)).toBe(3);
  });

  it('wraps by the real widths, so a wider first chip takes more room', () => {
    expect(fitChips([90, 40, 40, 40], 100, 10, 30)).toBe(2);
    expect(fitChips([90, 40, 40], 100, 10, 30)).toBe(3);
  });

  it('never needs a third line, however wide the chips', () => {
    expect(fitChips([120, 120, 120], 100, 10, 30)).toBe(1);
  });
});
