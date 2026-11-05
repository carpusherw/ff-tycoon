import type { MsgKey } from './en';

export const zhHant: Record<MsgKey, string> = {
  'app.title': 'FF Tycoon',

  'setup.title': '創立你的貨代公司',

  'end.demoCta': '預約 GoFreight 產品展示',
  'end.demoLine': '真正的貨代都用 GoFreight。來看看實際的樣子。',
  'end.bankruptLine': '看看什麼能讓你撐下去。',

  'city.TPE': '台北',
  'city.SHA': '上海',
  'city.SZX': '深圳',
  'city.SIN': '新加坡',
  'city.PUS': '釜山',
  'city.TYO': '東京',
  'city.LAX': '洛杉磯',
  'city.NYC': '紐約',
  'city.RTM': '鹿特丹',
  'city.HAM': '漢堡',
  'city.SYD': '雪梨',
  'city.DXB': '杜拜',

  'log.quoteWon': '{customer} 接受了你的報價。',
  'log.quoteLost': '{customer} 的報價沒有成交。',
  'log.paid': '{customer} 已付款 {amount}。',
  'log.quoteExpired': '給 {customer} 的報價已過期。',
  'log.opsLate': 'OP 沒趕上 {customer} 的結關時間，罰款 {fee}。',
  'log.invoiceLate': '{customer} 的帳單開晚了，罰款 {fee}。',
  'log.hired': '已錄用 {name}。',
  'log.payroll': '支付薪資和房租 {amount}。',
  'log.bankrupt': '月底現金跌破零，公司破產了。',
  'log.yearEnd': '第 {year} 年結束了。',

  'error.cannotAfford': '錢不夠，付不起。',
  'error.noHiring': '目前沒有開放中的職缺。',
  'error.noCandidate': '這位應徵者已經無法錄用了。',
};
