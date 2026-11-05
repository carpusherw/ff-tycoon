export const en = {
  'app.title': 'FF Tycoon',

  'city.TPE': 'Taipei',
  'city.SHA': 'Shanghai',
  'city.SZX': 'Shenzhen',
  'city.SIN': 'Singapore',
  'city.PUS': 'Busan',
  'city.TYO': 'Tokyo',
  'city.LAX': 'Los Angeles',
  'city.NYC': 'New York',
  'city.RTM': 'Rotterdam',
  'city.HAM': 'Hamburg',
  'city.SYD': 'Sydney',
  'city.DXB': 'Dubai',

  'log.quoteWon': 'Won the quote for {customer}.',
  'log.quoteLost': 'Lost the quote for {customer}.',
  'log.paid': '{customer} paid {amount}.',
  'log.quoteExpired': 'The quote for {customer} expired.',
  'log.opsLate': 'Missed the Ops cut-off for {customer}: {fee} fee.',
  'log.invoiceLate': 'Late invoice for {customer}: {fee} fee.',
  'log.hired': 'Hired {name}.',

  'error.cannotAfford': "You can't afford that.",
  'error.noHiring': 'No hiring session is open.',
  'error.noCandidate': 'That candidate is no longer available.',
} as const;

export type MsgKey = keyof typeof en;
