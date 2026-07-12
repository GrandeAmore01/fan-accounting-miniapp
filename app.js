const { CLOUD_ENV_ID } = require('./services/config');

App({
  globalData: {
    appName: '时代少年团粉丝消费收藏管理系统',
    userId: 'local-user'
  },

  onLaunch() {
    // CLOUD_ENV_ID 的填写位置：services/config.js。
    wx.cloud.init({
      env: CLOUD_ENV_ID,
      traceUser: true
    });

    // 提前登录；业务请求内部也会兜底等待登录并在 401 时自动重试。
    require('./utils/request').login().catch((error) => {
      console.warn('微信身份初始化失败', error);
    });

    // 第一阶段使用本地缓存；云开发接口后续在 services 中逐步替换。
    const storage = require('./services/storageService');
    storage.initUserStorage(this.globalData.userId);

    wx.onNetworkStatusChange((res) => {
      if (res.isConnected) {
        require('./services/stageService').invalidateStageCache();
      }
    });
  }
});
