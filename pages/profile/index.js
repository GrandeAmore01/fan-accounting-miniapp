const storageService = require('../../services/storageService');

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

  refreshPage() {
    const summary = storageService.getLocalDataSummary('local-user');
    this.setData({
      profile: summary.profile,
      counts: summary.counts,
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
        storageService.resetUserData('local-user');
        wx.showToast({
          title: '已清空',
          icon: 'success'
        });
        this.refreshPage();
      }
    });
  }
});
