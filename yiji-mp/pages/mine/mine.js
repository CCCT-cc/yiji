const store = require('../../utils/store.js');

Page({
  data: {
    ledgerName: '',
    accountCount: 0,
    txCount: 0
  },

  onShow() {
    const ledger = store.getCurrentLedger();
    this.setData({
      ledgerName: ledger.name,
      accountCount: (ledger.accounts || []).length,
      txCount: (ledger.transactions || []).length
    });
  },

  goAccounts() {
    wx.navigateTo({ url: '/pages/accounts/accounts' });
  },
  goCategories() {
    wx.navigateTo({ url: '/pages/categories/categories' });
  },
  goLedgers() {
    wx.navigateTo({ url: '/pages/ledgers/ledgers' });
  },

  exportBackup() {
    const ledger = store.getCurrentLedger();
    const csv = store.exportCSV(ledger);
    wx.setClipboardData({
      data: csv,
      success: () => {
        wx.showModal({
          title: '备份已复制',
          content: 'CSV 备份已复制到剪贴板，可粘贴到备忘录/微信文件传输助手保存。当前账本「' + ledger.name + '」共 ' + (ledger.transactions || []).length + ' 条记录。',
          showCancel: false
        });
      }
    });
  },

  clearAll() {
    wx.showModal({
      title: '清空全部数据',
      content: '将删除本机所有账本、账户与记录，且不可恢复。确定吗？',
      confirmColor: '#e54d42',
      success: (r) => {
        if (r.confirm) {
          wx.removeStorageSync('yiji_ledgers_v1');
          wx.removeStorageSync('yiji_cur_ledger_v1');
          store.ensureInit();
          wx.showToast({ title: '已清空', icon: 'success' });
          this.onShow();
        }
      }
    });
  },

  about() {
    wx.showModal({
      title: '关于一记',
      content: '一记 · 极简记账\n\n所有数据仅保存在你本机，不上传任何服务器，不收集隐私。\n版本 1.0.0',
      showCancel: false
    });
  }
});
