/** Every tuning number in the game. Ranges are [min, max] tuples. */
export const B = {
  daysPerMonth: 30,
  daysPerYear: 360,
  runDays: 3600,
  dayMs: 1000,

  startCash: 60000,
  homeRent: 2000,
  starterAgents: { easy: 3, normal: 2, hardcore: 1 },

  owner: { speed: 1.2, capacity: 3, winRate: 0.45 },

  tasks: {
    quote: { workload: [1, 2], minDuration: 1, deadlineDays: 5 },
    booking: { workload: [1.5, 2.5], minDuration: 4, deadlineDays: 10 },
    arrival: { workload: [1, 2], minDuration: 3, deadlineDays: 8 },
    invoice: { workload: [0.5, 1], minDuration: 1, deadlineDays: 5 },
  },

  agentHandlingDays: 5,
  agentProfitShare: 0.25,

  roughRateFactor: 0.6,
  winClamp: [0.05, 0.95],

  demand: { newProspectPerDay: 0.35, repeatPerCustomerPerDay: 0.04, exportShare: 0.6 },

  margin: { base: 800, perTransitDay: 120, jitter: [0.85, 1.15] },

  penalties: { opsMissFee: 600, invoiceLateFee: 150 },

  hiring: {
    jobAdCost: 800,
    rerollCost: 400,
    candidatesPerRoll: 3,
    speed: [0.7, 1.6],
    capacity: { sales: [1, 3], ops: [2, 5], accounting: [2, 5] },
    winRate: [0.3, 0.6],
    baseSalary: { sales: 3200, ops: 3000, accounting: 2800 },
  },

  score: { homeOfficeValue: 50000, agentContractValue: 5000 },

  ship: { kmPerDay: 750, minTransitDays: 3 },

  clock: { tickMs: 50, maxCatchUpDays: 3, maxElapsedMs: 1000 },
} as const;
