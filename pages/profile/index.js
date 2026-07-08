const storageService = require('../../services/storageService');
const stageService = require('../../services/stageService');
const config = require('../../services/config');

const USER_ID = config.userId || 'local-user';

Page({
  data: {
    profile: {
      nickname: '本地用户',
      loginStatus: false
    },
    counts: {
      expenses: 0,
      budgets: 0,
      userCollections: 0,
      lightedCollections: 0,
      userStages: 0,
      lightedStages: 0
    },
    hasLocalData: false,
    cloudStatus: {
      enabled: false,
      loginReady: false,
      databaseReady: false,
      message: ''
    }
  },

  onShow() {
    this.refreshPage();
  },

  async refreshPage() {
    const summary = storageService.getLocalDataSummary(USER_ID);
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

  handleLocalModeTap() {
    wx.showToast({
      title: '当前为本地模式',
      icon: 'none'
    });
  },

  handleCloudReserveTap() {
    wx.showModal({
      title: '云开发预留',
      content: this.data.cloudStatus.message,
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#c84d69'
    });
  },

  handleClearLocalData() {
    if (!this.data.hasLocalData) {
      wx.showToast({
        title: '暂无本地数据',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '清理本地数据',
      content: '将清空消费记录、预算、图鉴点亮和舞台点亮状态，确定继续吗？',
      confirmText: '清空',
      confirmColor: '#c84d69',
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        storageService.resetUserData(USER_ID);
        wx.showToast({
          title: '已清空',
          icon: 'success'
        });
        this.refreshPage();
      }
    });
  }
});
