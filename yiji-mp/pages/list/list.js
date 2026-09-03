const store = require('../../utils/store.js');
const util = require('../../utils/util.js');

Page({
  data: {
    groups: [],
    totalIncome: '0.00',
    totalExpense: '0.00',
    empty: false
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const ledger = store.getCurrentLedger();
    const catMap = {};
    (ledger.categories || []).forEach((c) => (catMap[c.id] = c));
    const accMap = {};
    (ledger.accounts || []).forEach((a) => (accMap[a.id] = a));

    const tx = (ledger.transactions || [])
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

    const groups = [];
    let cur = null;
    let inc = 0;
    let exp = 0;

    tx.forEach((t) => {
      if (t.type === 'income') inc += Number(t.amount) || 0;
      else exp += Number(t.amount) || 0;
      if (!cur || cur.date !== t.date) {
        cur = { date: t.date, items: [], income: 0, expense: 0 };
        groups.push(cur);
      }
      const cat = catMap[t.categoryId] || { name: '未分类', icon: '❓' };
      const acc = accMap[t.accountId] || { name: '', icon: '' };
      cur.items.push({
        id: t.id,
        icon: cat.icon,
        catName: cat.name,
        accName: acc.name,
        note: t.note || '',
        sign: t.type === 'income' ? '+' : '-',
        amount: util.fmt(t.amount),
        cls: t.type === 'income' ? 'c-green' : 'c-red'
      });
      if (t.type === 'income') cur.income += Number(t.amount) || 0;
      else cur.expense += Number(t.amount) || 0;
    });

    groups.forEach((g) => {
      g.dateLabel = util.friendlyDate(g.date);
      g.incomeLabel = util.fmt(g.income);
      g.expenseLabel = util.fmt(g.expense);
    });

    this.setData({
      groups,
      totalIncome: util.fmt(inc),
      totalExpense: util.fmt(exp),
      empty: tx.length === 0
    });
  },

  del(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除记录',
      content: '确定删除这条记录吗？',
      success: (r) => {
        if (r.confirm) {
          const ledger = store.getCurrentLedger();
          store.removeTransaction(ledger, id);
          this.refresh();
        }
      }
    });
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/add/add' });
  }
});
