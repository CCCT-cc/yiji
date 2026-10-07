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
    note: '',
    editId: ''
  },

  onLoad(options) {
    const ledger = store.getCurrentLedger();
    const base = {
      ledger,
      accounts: ledger.accounts || [],
      categories: (ledger.categories || []).filter((c) => c.type === 'expense'),
      date: util.ymd(new Date())
    };
    // 编辑模式：/pages/add/add?id=xxx —— 预填该笔记录，保存时走更新而非新增
    if (options && options.id) {
      const tx = (ledger.transactions || []).find((t) => t.id === options.id);
      if (tx) {
        const catsOfType = (ledger.categories || []).filter((c) => c.type === tx.type);
        const accIndex = (ledger.accounts || []).findIndex((a) => a.id === tx.accountId);
        const catIndex = catsOfType.findIndex((c) => c.id === tx.categoryId);
        Object.assign(base, {
          type: tx.type,
          categories: catsOfType,
          accountIndex: accIndex < 0 ? 0 : accIndex,
          categoryIndex: catIndex < 0 ? 0 : catIndex,
          amount: String(tx.amount),
          date: tx.date,
          note: tx.note || '',
          editId: tx.id
        });
        wx.setNavigationBarTitle({ title: '编辑记录' });
      }
    }
    this.setData(base);
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
    const payload = {
      accountId: acc.id,
      categoryId: cat.id,
      type: this.data.type,
      amount: amt,
      date: this.data.date,
      note: this.data.note
    };
    if (this.data.editId) {
      store.updateTransaction(this.data.ledger, this.data.editId, payload);
      wx.showToast({ title: '已更新', icon: 'success' });
    } else {
      store.addTransaction(this.data.ledger, Object.assign({ id: store.uid() }, payload));
      wx.showToast({ title: '已保存', icon: 'success' });
    }
    setTimeout(() => wx.navigateBack(), 500);
  }
});
