const storageService = require('../../services/storageService');
const stageService = require('../../services/stageService');

Page({
  data: {
    profile: { nickname: '微信用户', loginStatus: false },
    counts: {
      expenses: 0, budgets: 0, userCollections: 0,
      lightedCollections: 0, userStages: 0, lightedStages: 0
    },
    hasLocalData: false,
    cloudStatus: { enabled: true, loginReady: false, databaseReady: false, message: '' }
  },

  onShow() {
    this.refreshPage();
  },

  async refreshPage() {
    const summary = storageService.getLocalDataSummary();
    let stageStats = {
      lightedCount: summary.counts.lightedStages,
      total: summary.counts.userStages
    };
    try {
      await stageService.ensureStagesLoaded();
      stageStats = stageService.getStageStats();
    } catch (error) {
      console.warn('舞台统计加载失败，使用本地缓存计数', error);
    }
    this.setData({
      profile: summary.profile,
      counts: {
        ...summary.counts,
        lightedStages: stageStats.lightedCount,
        userStages: stageStats.total
      },
      hasLocalData: summary.hasLocalData,
      cloudStatus: storageService.getCloudStatus()
    });
  },

  handleCloudStatusTap() {
    wx.showModal({
      title: '云端同步状态',
      content: this.data.cloudStatus.message,
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#c84d69'
    });
  },

  handleClearLocalData() {
    wx.showModal({
      title: '清理本地缓存',
      content: '只清理当前微信用户在本机的缓存，不会删除云端消费、预算、藏品或舞台数据。下次打开页面时会重新从云端加载。',
      confirmText: '清理缓存',
      confirmColor: '#c84d69',
      success: (res) => {
        if (!res.confirm) return;
        storageService.resetUserData();
        wx.showToast({ title: '缓存已清理', icon: 'success' });
        this.refreshPage();
      }
    });
  }
});
