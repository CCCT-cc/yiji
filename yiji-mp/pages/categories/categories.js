const store = require('../../utils/store.js');

Page({
  data: {
    ledger: null,
    categories: [],
    icons: store.CATEGORY_ICONS,
    showForm: false,
    name: '',
    type: 'expense',
    iconIndex: 0
  },

  onShow() {
    this.load();
  },

  load() {
    const ledger = store.getCurrentLedger();
    const categories = (ledger.categories || []).map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      type: c.type,
      typeLabel: c.type === 'income' ? '收入' : '支出'
    }));
    this.setData({ ledger, categories });
  },

  openAdd() {
    this.setData({ showForm: true, name: '', type: 'expense', iconIndex: 0 });
  },

  closeForm() {
    this.setData({ showForm: false });
  },

  noop() {},

  pickIcon(e) {
    this.setData({ iconIndex: Number(e.currentTarget.dataset.i) });
  },

  switchType(e) {
    this.setData({ type: e.currentTarget.dataset.type });
  },

  onName(e) {
    this.setData({ name: e.detail.value });
  },

  save() {
    const name = (this.data.name || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入名称', icon: 'none' });
      return;
    }
    store.addCategory(this.data.ledger, {
      name,
      icon: this.data.icons[this.data.iconIndex],
      type: this.data.type
    });
    this.setData({ showForm: false });
    this.load();
  },

  del(e) {
    const id = e.currentTarget.dataset.id;
    const cat = (this.data.ledger.categories || []).find((c) => c.id === id);
    wx.showModal({
      title: '删除分类',
      content: '删除分类「' + (cat ? cat.name : '') + '」？',
      confirmColor: '#e54d42',
      success: (r) => {
        if (r.confirm) {
          store.removeCategory(this.data.ledger, id);
          this.load();
        }
      }
    });
  }
});
