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
    monthLabel: ''
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
    this.setData({
      ledgerName: ledger.name,
      accounts,
      netWorth: util.fmt(nw),
      income: util.fmt(ms.income),
      expense: util.fmt(ms.expense),
      balance: util.fmt(ms.income - ms.expense),
      monthLabel: ym + ' 本月'
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
  }
});
