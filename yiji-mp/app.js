const store = require('./utils/store.js');

App({
  globalData: {
    version: '1.0.0'
  },
  onLaunch() {
    // 首次启动确保有默认账本与默认分类/账户（结构默认值，非用户数据）
    store.ensureInit();
  }
});
