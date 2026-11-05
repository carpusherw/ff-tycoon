import { newId } from './ids';
import { createGame } from './newGame';
import { companyValue } from './score';
import type { Customer, GameState } from './types';

function addCustomer(s: GameState, status: Customer['status'], payments: Customer['payments']): void {
  s.customers.push({ id: newId(s, 'c'), name: 'Test Co', officeId: s.offices[0].id, status, payments });
}

describe('company value', () => {
  it('new game value', () => {
    const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
    expect(s.offices).toHaveLength(1);
    expect(s.agents).toHaveLength(2);
    expect(companyValue(s)).toEqual({ cash: 60000, network: 60000, customerBook: 0, total: 120000 });
  });

  it('payments in the last year count', () => {
    const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
    addCustomer(s, 'active', [{ day: 300, amount: 10000 }]);
    s.day = 360;
    expect(companyValue(s).customerBook).toBe(10000);
    expect(companyValue(s).total).toBe(130000);
  });

  it("payments older than a year don't count", () => {
    const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
    // The window is the 360 days ending today: at day 360, day 1 is inside and day 0 is not.
    addCustomer(s, 'active', [
      { day: 0, amount: 7000 },
      { day: 1, amount: 3000 },
    ]);
    s.day = 360;
    expect(companyValue(s).customerBook).toBe(3000);
  });

  it("prospects' payments don't count", () => {
    const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
    addCustomer(s, 'prospect', [{ day: 300, amount: 10000 }]);
    s.day = 360;
    expect(companyValue(s).customerBook).toBe(0);
  });
});
