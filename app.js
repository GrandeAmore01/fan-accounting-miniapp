App({
  globalData: {
    appName: '时代少年团粉丝消费收藏管理系统',
    userId: 'local-user'
  },

  onLaunch() {
    // 第一阶段使用本地缓存；云开发接口后续在 services 中逐步替换。
    const storage = require('./services/storageService');
    storage.initUserStorage(this.globalData.userId);
  }
});
