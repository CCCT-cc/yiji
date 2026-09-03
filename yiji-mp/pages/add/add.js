const store = require('../../utils/store.js');
const util = require('../../utils/util.js');

Page({
  data: {
    type: 'expense',
    ledger: null,
    accounts: [],
    categories: [],
    accountIndex: 0,
    categoryIndex: 0,
    amount: '',
    date: '',
    note: ''
  },

  onLoad() {
    const ledger = store.getCurrentLedger();
    this.setData({
      ledger,
      accounts: ledger.accounts || [],
      categories: (ledger.categories || []).filter((c) => c.type === 'expense'),
      date: util.ymd(new Date())
    });
  },

  switchType(e) {
    const type = e.currentTarget.dataset.type;
    const cats = (this.data.ledger.categories || []).filter((c) => c.type === type);
    this.setData({ type, categories: cats, categoryIndex: 0 });
  },

  onAccount(e) {
    this.setData({ accountIndex: Number(e.detail.value) });
  },

  onCategory(e) {
    this.setData({ categoryIndex: Number(e.detail.value) });
  },

  onAmount(e) {
    this.setData({ amount: e.detail.value });
  },

  onDate(e) {
    this.setData({ date: e.detail.value });
  },

  onNote(e) {
    this.setData({ note: e.detail.value });
  },

  save() {
    const amt = parseFloat(this.data.amount);
    if (!(amt > 0)) {
      wx.showToast({ title: '请输入金额', icon: 'none' });
      return;
    }
    if ((this.data.accounts || []).length === 0) {
      wx.showToast({ title: '请先添加账户', icon: 'none' });
      return;
    }
    if ((this.data.categories || []).length === 0) {
      wx.showToast({ title: '请先添加分类', icon: 'none' });
      return;
    }
    const acc = this.data.accounts[this.data.accountIndex];
    const cat = this.data.categories[this.data.categoryIndex];
    store.addTransaction(this.data.ledger, {
      id: store.uid(),
      accountId: acc.id,
      categoryId: cat.id,
      type: this.data.type,
      amount: amt,
      date: this.data.date,
      note: this.data.note
    });
    wx.showToast({ title: '已保存', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 500);
  }
});
