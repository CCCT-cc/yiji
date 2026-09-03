const store = require('../../utils/store.js');
const util = require('../../utils/util.js');

Page({
  data: {
    ym: '',
    income: '0.00',
    expense: '0.00',
    balance: '0.00',
    rows: []
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const ledger = store.getCurrentLedger();
    const ym = util.ym(new Date());
    const ms = store.monthSummary(ledger, ym);
    const map = store.categoryStats(ledger, ym, 'expense');
    const catMap = {};
    (ledger.categories || []).forEach((c) => (catMap[c.id] = c));
    const total = ms.expense || 1;
    const rows = Object.keys(map)
      .map((cid) => {
        const c = catMap[cid] || { name: '未分类', icon: '❓' };
        const amount = map[cid];
        return {
          name: c.name,
          icon: c.icon,
          amount: util.fmt(amount),
          pct: Math.round((amount / total) * 100)
        };
      })
      .sort((a, b) => parseFloat(b.amount.replace(/,/g, '')) - parseFloat(a.amount.replace(/,/g, '')));

    this.setData({
      ym,
      income: util.fmt(ms.income),
      expense: util.fmt(ms.expense),
      balance: util.fmt(ms.income - ms.expense),
      rows
    });
  }
});
