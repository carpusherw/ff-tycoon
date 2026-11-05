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
} as const;

export type MsgKey = keyof typeof en;
