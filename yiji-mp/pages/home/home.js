const store = require('../../utils/store.js');
const util = require('../../utils/util.js');

Page({
  data: {
    ledgerName: '',
    accounts: [],
    netWorth: '0.00',
    income: '0.00',
    expense: '0.00',
    balance: '0.00',
    monthLabel: '',
    recent: []
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const ledger = store.getCurrentLedger();
    if (!ledger) return;
    const ym = util.ym(new Date());
    const accounts = (ledger.accounts || [])
      .map((a) => ({
        id: a.id,
        name: a.name,
        icon: a.icon,
        balance: util.fmt(store.accountBalance(ledger, a.id))
      }))
      .sort((x, y) => parseFloat(y.balance.replace(/,/g, '')) - parseFloat(x.balance.replace(/,/g, '')));
    const ms = store.monthSummary(ledger, ym);
    const nw = store.netWorth(ledger);
    // 最近记录：跨全部历史的最近 8 笔（不限于本月），点按可编辑、🗑 快捷删除
    const catMap = {};
    (ledger.categories || []).forEach((c) => (catMap[c.id] = c));
    const accMap = {};
    (ledger.accounts || []).forEach((a) => (accMap[a.id] = a));
    const recent = (ledger.transactions || [])
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
      .slice(0, 8)
      .map((t) => {
        const cat = catMap[t.categoryId] || { name: '未分类', icon: '•' };
        const acc = accMap[t.accountId];
        const dayLabel = util.friendlyDate(t.date);
        const sub = dayLabel + (acc && acc.name ? ' · ' + acc.name : '') + (t.note ? ' · ' + t.note : '');
        return {
          id: t.id,
          icon: cat.icon,
          catName: cat.name,
          sub,
          sign: t.type === 'income' ? '+' : '-',
          amount: util.fmt(t.amount),
          cls: t.type === 'income' ? 'c-green' : 'c-red'
        };
      });
    this.setData({
      ledgerName: ledger.name,
      accounts,
      netWorth: util.fmt(nw),
      income: util.fmt(ms.income),
      expense: util.fmt(ms.expense),
      balance: util.fmt(ms.income - ms.expense),
      monthLabel: ym + ' 本月',
      recent
    });
    wx.setNavigationBarTitle({ title: ledger.name });
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/add/add' });
  },

  goAccounts() {
    wx.navigateTo({ url: '/pages/accounts/accounts' });
  },

  goLedgers() {
    wx.navigateTo({ url: '/pages/ledgers/ledgers' });
  },

  goList() {
    wx.switchTab({ url: '/pages/list/list' });
  },

  editTx(e) {
    wx.navigateTo({ url: '/pages/add/add?id=' + e.currentTarget.dataset.id });
  },

  delTx(e) {
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
  }
});
