const store = require('../../utils/store.js');
const util = require('../../utils/util.js');

Page({
  data: {
    ledger: null,
    accounts: [],
    icons: store.ACCOUNT_ICONS,
    showForm: false,
    name: '',
    initial: '',
    iconIndex: 0,
    editingId: ''
  },

  onShow() {
    this.load();
  },

  load() {
    const ledger = store.getCurrentLedger();
    const accounts = (ledger.accounts || []).map((a) => ({
      id: a.id,
      name: a.name,
      icon: a.icon,
      initial: util.fmt(a.initial || 0),
      balance: util.fmt(store.accountBalance(ledger, a.id))
    }));
    this.setData({ ledger, accounts });
  },

  openAdd() {
    this.setData({ showForm: true, name: '', initial: '', iconIndex: 0, editingId: '' });
  },

  closeForm() {
    this.setData({ showForm: false });
  },

  noop() {},

  pickIcon(e) {
    this.setData({ iconIndex: Number(e.currentTarget.dataset.i) });
  },

  onName(e) {
    this.setData({ name: e.detail.value });
  },

  onInitial(e) {
    this.setData({ initial: e.detail.value });
  },

  save() {
    const name = (this.data.name || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入名称', icon: 'none' });
      return;
    }
    const icon = this.data.icons[this.data.iconIndex];
    if (this.data.editingId) {
      store.updateAccount(this.data.ledger, this.data.editingId, {
        name,
        icon,
        initial: parseFloat(this.data.initial) || 0
      });
    } else {
      store.addAccount(this.data.ledger, {
        name,
        icon,
        initial: parseFloat(this.data.initial) || 0
      });
    }
    this.setData({ showForm: false });
    this.load();
  },

  del(e) {
    const id = e.currentTarget.dataset.id;
    const acc = (this.data.ledger.accounts || []).find((a) => a.id === id);
    wx.showModal({
      title: '删除账户',
      content: '删除「' + (acc ? acc.name : '') + '」及其下所有交易？',
      confirmColor: '#e54d42',
      success: (r) => {
        if (r.confirm) {
          store.removeAccount(this.data.ledger, id);
          this.load();
        }
      }
    });
  }
});
