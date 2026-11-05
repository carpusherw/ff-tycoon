import { B } from './balance';
import { createGame } from './newGame';
import { cancelHiring, hireCandidate, hiringSlots, moveOwner, rerollCandidates, rollCandidate, startHiring } from './staff';
import { DEPTS, type Candidate, type DeptKey, type GameState, type Task } from './types';
import { COUNTRIES, REGIONS } from './world';

function newGame(): GameState {
  return createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' });
}

/** Mean position of each rolled stat within its range, as the brief defines quality. */
function quality(c: Candidate, dept: DeptKey, skillMult: number): number {
  const [sMin, sMax] = B.hiring.speed;
  const [cMin, cMax] = B.hiring.capacity[dept];
  const parts = [(c.speed / skillMult - sMin) / (sMax - sMin), (c.capacity - cMin) / (cMax - cMin)];
  if (dept === 'sales') {
    const [wMin, wMax] = B.hiring.winRate;
    parts.push((c.winRate / skillMult - wMin) / (wMax - wMin));
  }
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

describe('gacha hiring', () => {
  it('a job ad costs 800 and rolls 3 candidates', () => {
    const s = newGame();
    const before = s.cash;

    expect(startHiring(s, 'o1', 'ops')).toEqual({ ok: true });

    expect(s.cash).toBe(before - 800);
    expect(s.hiring).not.toBeNull();
    expect(s.hiring!.officeId).toBe('o1');
    expect(s.hiring!.dept).toBe('ops');
    expect(s.hiring!.candidates).toHaveLength(3);
    expect(new Set(s.hiring!.candidates.map((c) => c.candidateId)).size).toBe(3);
  });

  it("can't post a job ad without the cash", () => {
    const s = newGame();
    s.cash = 500;

    expect(startHiring(s, 'o1', 'ops')).toEqual({ ok: false, reason: 'error.cannotAfford' });

    expect(s.cash).toBe(500);
    expect(s.hiring).toBeNull();
  });

  it('re-roll costs 400 and replaces all candidates', () => {
    const s = newGame();
    startHiring(s, 'o1', 'sales');
    const oldIds = s.hiring!.candidates.map((c) => c.candidateId);
    const before = s.cash;

    expect(rerollCandidates(s)).toEqual({ ok: true });

    expect(s.cash).toBe(before - 400);
    expect(s.hiring!.dept).toBe('sales');
    expect(s.hiring!.candidates).toHaveLength(3);
    for (const c of s.hiring!.candidates) expect(oldIds).not.toContain(c.candidateId);
  });

  it('re-roll is refused without the cash', () => {
    const s = newGame();
    startHiring(s, 'o1', 'sales');
    const candidates = s.hiring!.candidates;
    s.cash = 300;

    expect(rerollCandidates(s)).toEqual({ ok: false, reason: 'error.cannotAfford' });

    expect(s.cash).toBe(300);
    expect(s.hiring!.candidates).toBe(candidates);
  });

  it("can't re-roll without a hiring session", () => {
    const s = newGame();
    const before = s.cash;

    expect(rerollCandidates(s)).toEqual({ ok: false, reason: 'error.noHiring' });
    expect(s.cash).toBe(before);
  });

  it('hiring adds the employee and keeps the session open with the other candidates', () => {
    const s = newGame();
    s.day = 12;
    startHiring(s, 'o1', 'sales');
    const [first, pick, third] = s.hiring!.candidates;
    const pickId = pick.candidateId;

    expect(hireCandidate(s, pickId)).toEqual({ ok: true });

    expect(s.employees).toHaveLength(2);
    const hired = s.employees[1];
    expect(hired.id).toMatch(/^e\d+$/);
    expect(hired).toMatchObject({
      name: pick.name,
      officeId: 'o1',
      dept: 'sales',
      isOwner: false,
      salary: pick.salary,
      hiredDay: 12,
      speed: pick.speed,
      capacity: pick.capacity,
      winRate: pick.winRate,
    });
    expect(s.hiring).not.toBeNull();
    expect(s.hiring!.candidates).toEqual([first, third]);
    expect(s.log[0].msg.key).toBe('log.hired');
    expect(s.log[0].msg.params).toEqual({ name: pick.name });
  });

  it('a hire marks its slot, so the roll keeps its order in the session', () => {
    const s = newGame();
    startHiring(s, 'o1', 'sales');
    const [a, b, c] = s.hiring!.candidates;
    expect(s.hiring!.hired).toEqual([]);
    expect(hiringSlots(s.hiring!)).toEqual([
      { kind: 'open', candidate: a },
      { kind: 'open', candidate: b },
      { kind: 'open', candidate: c },
    ]);

    hireCandidate(s, b.candidateId);
    const bId = s.employees.at(-1)!.id;
    expect(s.hiring!.hired).toEqual([{ slot: 1, name: b.name, employeeId: bId }]);
    expect(hiringSlots(s.hiring!)).toEqual([
      { kind: 'open', candidate: a },
      { kind: 'hired', name: b.name, employeeId: bId },
      { kind: 'open', candidate: c },
    ]);

    hireCandidate(s, a.candidateId);
    expect(hiringSlots(s.hiring!).map((x) => x.kind)).toEqual(['hired', 'hired', 'open']);
    expect(s.hiring!.hired.map((h) => h.slot).sort()).toEqual([0, 1]);

    rerollCandidates(s);
    expect(s.hiring!.hired).toEqual([]);
    expect(hiringSlots(s.hiring!).map((x) => x.kind)).toEqual(['open', 'open', 'open']);
  });

  it('two hires from one roll add two employees for a single job-ad fee', () => {
    const s = newGame();
    const before = s.cash;
    startHiring(s, 'o1', 'ops');
    const [a, b] = s.hiring!.candidates;

    expect(hireCandidate(s, a.candidateId)).toEqual({ ok: true });
    expect(hireCandidate(s, b.candidateId)).toEqual({ ok: true });

    expect(s.employees.map((e) => e.name).slice(1)).toEqual([a.name, b.name]);
    expect(s.employees.slice(1).every((e) => e.dept === 'ops' && e.officeId === 'o1')).toBe(true);
    expect(s.cash).toBe(before - B.hiring.jobAdCost);
    expect(s.hiring!.candidates).toHaveLength(1);
  });

  it('hiring the last remaining candidate closes the session', () => {
    const s = newGame();
    startHiring(s, 'o1', 'accounting');
    for (const c of [...s.hiring!.candidates]) {
      expect(s.hiring).not.toBeNull();
      expect(hireCandidate(s, c.candidateId)).toEqual({ ok: true });
    }

    expect(s.employees).toHaveLength(1 + B.hiring.candidatesPerRoll);
    expect(s.hiring).toBeNull();
  });

  it("a hired candidate can't be hired twice", () => {
    const s = newGame();
    startHiring(s, 'o1', 'sales');
    const id = s.hiring!.candidates[0].candidateId;
    hireCandidate(s, id);

    expect(hireCandidate(s, id)).toEqual({ ok: false, reason: 'error.noCandidate' });
    expect(s.employees).toHaveLength(2);
  });

  it('re-roll after a hire gives a full fresh set', () => {
    const s = newGame();
    startHiring(s, 'o1', 'sales');
    hireCandidate(s, s.hiring!.candidates[0].candidateId);
    const leftIds = s.hiring!.candidates.map((c) => c.candidateId);
    const before = s.cash;

    expect(rerollCandidates(s)).toEqual({ ok: true });

    expect(s.cash).toBe(before - B.hiring.rerollCost);
    expect(s.hiring!.candidates).toHaveLength(B.hiring.candidatesPerRoll);
    for (const c of s.hiring!.candidates) expect(leftIds).not.toContain(c.candidateId);
  });

  it("hiring without a session or with an unknown candidate doesn't add anyone", () => {
    const s = newGame();
    expect(hireCandidate(s, 'c999')).toEqual({ ok: false, reason: 'error.noHiring' });

    startHiring(s, 'o1', 'ops');
    expect(hireCandidate(s, 'c999')).toEqual({ ok: false, reason: 'error.noCandidate' });
    expect(s.employees).toHaveLength(1);
    expect(s.hiring).not.toBeNull();
  });

  it('cancelling closes the session without a refund', () => {
    const s = newGame();
    startHiring(s, 'o1', 'ops');
    const cash = s.cash;

    cancelHiring(s);

    expect(s.hiring).toBeNull();
    expect(s.cash).toBe(cash);
  });

  it('cancelling after a hire closes the session and keeps the hire', () => {
    const s = newGame();
    startHiring(s, 'o1', 'ops');
    hireCandidate(s, s.hiring!.candidates[0].candidateId);

    cancelHiring(s);

    expect(s.hiring).toBeNull();
    expect(s.employees).toHaveLength(2);
  });

  // TW has skillMult 1; SG (1.1) checks the pool scaling. Capacity is an integer range
  // that skillMult doesn't scale.
  it.each(['TW', 'SG'])('candidate stats stay in range (%s pool)', (regionId) => {
    const s = newGame();
    s.offices[0].regionId = regionId;
    const { skillMult, salaryMult } = COUNTRIES[REGIONS[regionId].country].pool;
    const [sMin, sMax] = B.hiring.speed;
    const [wMin, wMax] = B.hiring.winRate;

    for (const dept of DEPTS) {
      const [cMin, cMax] = B.hiring.capacity[dept];
      const base = B.hiring.baseSalary[dept] * salaryMult;
      for (let i = 0; i < 500; i++) {
        const c = rollCandidate(s, 'o1', dept);
        expect(c.speed).toBeGreaterThanOrEqual(sMin * skillMult);
        expect(c.speed).toBeLessThanOrEqual(sMax * skillMult);
        expect(Number.isInteger(c.capacity)).toBe(true);
        expect(c.capacity).toBeGreaterThanOrEqual(cMin);
        expect(c.capacity).toBeLessThanOrEqual(cMax);
        if (dept === 'sales') {
          expect(c.winRate).toBeGreaterThanOrEqual(wMin * skillMult);
          expect(c.winRate).toBeLessThanOrEqual(wMax * skillMult);
        } else {
          expect(c.winRate).toBe(0);
        }
        expect(c.salary).toBeGreaterThanOrEqual(Math.round(base * 0.75));
        expect(c.salary).toBeLessThanOrEqual(Math.round(base * 1.25));
      }
    }
  });

  it('better candidates ask for more', () => {
    const s = newGame();
    const rolls = Array.from({ length: 500 }, () => rollCandidate(s, 'o1', 'sales'))
      .map((c) => ({ q: quality(c, 'sales', 1), salary: c.salary }))
      .sort((a, b) => a.q - b.q);
    const mean = (xs: { salary: number }[]) => xs.reduce((a, x) => a + x.salary, 0) / xs.length;

    expect(mean(rolls.slice(-50))).toBeGreaterThan(mean(rolls.slice(0, 50)));
  });
});

describe('owner moves', () => {
  it('moving the owner returns their tasks to the queue', () => {
    const s = newGame();
    const owner = s.employees.find((e) => e.isOwner)!;
    const task: Task = {
      id: 't1',
      kind: 'quote',
      officeId: 'o1',
      dept: 'sales',
      shipmentId: 'sh1',
      workload: 2,
      progress: 0.5,
      minDuration: 1,
      createdDay: 0,
      deadline: 5,
      assigneeId: owner.id,
      late: false,
    };
    s.tasks.push(task);

    moveOwner(s, 'ops');

    expect(owner.dept).toBe('ops');
    expect(task.assigneeId).toBeNull();
    expect(task.progress).toBe(0.5);
  });
});
