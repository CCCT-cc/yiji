const store = require('../../utils/store.js');

Page({
  data: {
    ledgers: [],
    curId: '',
    showForm: false,
    name: ''
  },

  onShow() {
    this.load();
  },

  load() {
    const list = store.getLedgers();
    const cur = store.getCurrentLedger();
    const ledgers = list.map((l) => ({
      id: l.id,
      name: l.name,
      count: (l.transactions || []).length,
      icon: l.icon || '📒',
      cur: cur && l.id === cur.id
    }));
    this.setData({ ledgers, curId: cur ? cur.id : '' });
  },

  switchLedger(e) {
    const id = e.currentTarget.dataset.id;
    store.setCurrentLedger(id);
    this.load();
    wx.showToast({ title: '已切换账本', icon: 'success' });
  },

  openAdd() {
    this.setData({ showForm: true, name: '' });
  },

  closeForm() {
    this.setData({ showForm: false });
  },

  noop() {},

  onName(e) {
    this.setData({ name: e.detail.value });
  },

  save() {
    const name = (this.data.name || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入账本名', icon: 'none' });
      return;
    }
    store.addLedger(name);
    this.setData({ showForm: false });
    this.load();
  },

  rename(e) {
    const id = e.currentTarget.dataset.id;
    const l = (this.data.ledgers || []).find((x) => x.id === id);
    wx.showModal({
      title: '重命名账本',
      editable: true,
      placeholderText: '输入新名称',
      content: l ? l.name : '',
      success: (r) => {
        if (r.confirm && r.content && r.content.trim()) {
          store.updateLedger(id, { name: r.content.trim() });
          this.load();
        }
      }
    });
  },

  del(e) {
    const id = e.currentTarget.dataset.id;
    if (this.data.ledgers.length <= 1) {
      wx.showToast({ title: '至少保留一个账本', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '删除账本',
      content: '删除后该账本内所有账户、分类、流水将一并清除，且不可恢复。确定？',
      confirmColor: '#e54d42',
      success: (r) => {
        if (r.confirm) {
          const ok = store.removeLedger(id);
          if (!ok) wx.showToast({ title: '至少保留一个账本', icon: 'none' });
          this.load();
        }
      }
    });
  }
});
