import type { MsgKey } from './en';

export const zhHans: Record<MsgKey, string> = {
  'app.title': 'FF Tycoon',

  'setup.title': '创立你的货代公司',

  'end.demoCta': '预约 GoFreight 产品演示',
  'end.demoLine': '真正的货代都用 GoFreight。来看看实际的样子。',
  'end.bankruptLine': '看看什么能让你撑下去。',

  'city.TPE': '台北',
  'city.SHA': '上海',
  'city.SZX': '深圳',
  'city.SIN': '新加坡',
  'city.PUS': '釜山',
  'city.TYO': '东京',
  'city.LAX': '洛杉矶',
  'city.NYC': '纽约',
  'city.RTM': '鹿特丹',
  'city.HAM': '汉堡',
  'city.SYD': '悉尼',
  'city.DXB': '迪拜',

  'log.quoteWon': '{customer} 接受了报价，这单拿下了。',
  'log.quoteLost': '{customer} 的报价没谈成。',
  'log.paid': '收到 {customer} 的付款 {amount}。',
  'log.quoteExpired': '给 {customer} 的报价已失效。',
  'log.opsLate': '操作没赶上 {customer} 的截关时间，罚款 {fee}。',
  'log.invoiceLate': '{customer} 的账单开晚了，罚款 {fee}。',
  'log.hired': '成功招聘 {name}。',
  'log.payroll': '支付工资和房租 {amount}。',
  'log.bankrupt': '月底账上资金为负，公司破产了。',
  'log.yearEnd': '第 {year} 年结束了。',

  'error.cannotAfford': '资金不够，付不起。',
  'error.noHiring': '目前没有正在进行的招聘。',
  'error.noCandidate': '这位候选人已经不能招聘了。',
};
