const stageService = require('../../services/stageService');

Page({
  data: {
    stageTypeOptions: [
      { id: 'concert', name: '演唱会' },
      { id: 'festival', name: '音乐节|拼盘' }
    ],
    stageTypeIndex: 0,
    yearOptions: stageService.getYearOptions(),
    statusOptions: [
      { id: 'all', name: '全部状态' },
      { id: 'lighted', name: '已点亮' },
      { id: 'unlighted', name: '未点亮' }
    ],
    yearIndex: 0,
    statusIndex: 0,
    keyword: '',
    stages: [],
    stats: {
      total: 0,
      lightedCount: 0,
      unlockedSongCount: 0,
      progressPercent: 0
    },
    songStats: [],
    albumProgress: []
  },

  onShow() {
    this.refreshPage();
  },

  refreshPage() {
    const dashboard = stageService.getStageDashboard({
      stageType: this.data.stageTypeOptions[this.data.stageTypeIndex].id,
      year: this.data.yearOptions[this.data.yearIndex].id,
      lightStatus: this.data.statusOptions[this.data.statusIndex].id,
      keyword: this.data.keyword
    });
    this.setData({
      stages: dashboard.stages,
      stats: dashboard.stats,
      songStats: dashboard.songStats,
      albumProgress: dashboard.albumProgress
    });
  },

  handleKeywordInput(event) {
    this.setData({
      keyword: event.detail.value
    });
    this.refreshPage();
  },

  handleStageTypeChange(event) {
    const stageTypeIndex = Number(event.currentTarget.dataset.index);
    this.setData({
      stageTypeIndex
    });
    this.refreshPage();
  },

  handleYearChange(event) {
    this.setData({
      yearIndex: Number(event.detail.value)
    });
    this.refreshPage();
  },

  handleStatusChange(event) {
    this.setData({
      statusIndex: Number(event.detail.value)
    });
    this.refreshPage();
  },

  handleClearFilter() {
    this.setData({
      keyword: '',
      yearIndex: 0,
      statusIndex: 0
    });
    this.refreshPage();
  },

  handleLightStage(event) {
    const { id } = event.currentTarget.dataset;
    stageService.lightStage(id);
    wx.showToast({
      title: '已点亮',
      icon: 'success'
    });
    this.refreshPage();
  },

  handleUnlightStage(event) {
    const { id } = event.currentTarget.dataset;
    wx.showModal({
      title: '取消点亮',
      content: '取消后会同步更新歌曲统计和专辑进度，确定要取消吗？',
      confirmText: '取消点亮',
      confirmColor: '#c84d69',
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        stageService.unlightStage(id);
        wx.showToast({
          title: '已取消',
          icon: 'success'
        });
        this.refreshPage();
      }
    });
  }
});
