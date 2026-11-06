import { createGame } from './newGame';
import { companyValue } from './score';

describe('company value', () => {
  it('new game value', () => {
    const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
    expect(s.offices).toHaveLength(1);
    expect(s.agents).toHaveLength(2);
    expect(companyValue(s)).toEqual({ cash: 60000, network: 60000, customerBook: 0, total: 120000 });
  });

  it('payments in the last year count', () => {
    const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
    s.stats.revenue = [{ day: 300, invoices: 10000, charges: 0 }];
    s.day = 360;
    expect(companyValue(s).customerBook).toBe(10000);
    expect(companyValue(s).total).toBe(130000);
  });

  it("payments older than a year don't count", () => {
    const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
    // The window is the 360 days ending today: at day 360, day 1 is inside and day 0 is not.
    s.stats.revenue = [
      { day: 0, invoices: 7000, charges: 0 },
      { day: 1, invoices: 3000, charges: 0 },
    ];
    s.day = 360;
    expect(companyValue(s).customerBook).toBe(3000);
  });

  it("local charges don't count: they come from agents' and other offices' shipments, not customers", () => {
    const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
    s.stats.revenue = [{ day: 300, invoices: 0, charges: 450 }];
    s.day = 360;
    expect(companyValue(s).customerBook).toBe(0);
  });
});
