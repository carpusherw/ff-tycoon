import { B } from './balance';
import { createGame } from './newGame';

describe('createGame', () => {
  it('starts with the owner only', () => {
    const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
    expect(s.employees.length).toBe(1);
    expect(s.employees[0].isOwner).toBe(true);
    expect(s.employees[0].salary).toBe(0);
    expect(s.employees[0].dept).toBe('sales');
    expect(s.employees[0].officeId).toBe('o1');
    expect(s.offices).toEqual([{ id: 'o1', portId: 'TPE', regionId: 'TW', rent: B.homeRent }]);
    expect(s.day).toBe(0);
    expect(s.cash).toBe(B.startCash);
    expect(s.rngState).toBe(1);
  });

  it('normal mode has two starter agents from the priority list', () => {
    const s = createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
    expect(s.agents.map((a) => a.portId)).toEqual(['LAX', 'SHA']);
    expect(s.agents.map((a) => a.regionId)).toEqual(['US-W', 'CN-N']);
  });

  it('easy has three and hardcore one', () => {
    expect(createGame({ seed: 1, homePortId: 'TPE', mode: 'easy' }).agents.map((a) => a.portId)).toEqual([
      'LAX',
      'SHA',
      'RTM',
    ]);
    expect(createGame({ seed: 1, homePortId: 'TPE', mode: 'hardcore' }).agents.map((a) => a.portId)).toEqual([
      'LAX',
    ]);
  });

  it('is reproducible', () => {
    const opts = { seed: 1, homePortId: 'TPE', mode: 'normal' } as const;
    expect(createGame(opts)).toEqual(createGame(opts));
  });
});
