const stageService = require('../../services/stageService');

Page({
  data: {
    loading: true,
    stageTypeOptions: [
      { id: 'concert', name: '演唱会' },
      { id: 'special', name: '运动会/新年音乐会' }
    ],
    stageTypeIndex: 0,
    yearOptions: [{ id: 'all', name: '全部年份' }],
    statsYearOptions: [],
    statsYearIndex: 0,
    statusOptions: [
      { id: 'all', name: '全部状态' },
      { id: 'lighted', name: '已点亮' },
      { id: 'unlighted', name: '未点亮' }
    ],
    yearIndex: 0,
    statusIndex: 0,
    keyword: '',
    stages: [],
    songSearchResults: [],
    stats: {
      total: 0,
      lightedCount: 0,
      unlockedSongCount: 0,
      progressPercent: 0
    },
    meetTimeline: {
      hasMeetStages: false,
      lastMeet: { daysText: '--', dateText: '暂无记录', stageName: '' },
      nextMeet: { daysText: '--', dateText: '暂无记录', stageName: '' },
      firstMeetDateText: '暂无记录'
    },
    songStats: [],
    albumProgress: [],
    yearStats: {
      year: '',
      hasRecords: false,
      lightedCount: 0,
      unlockedSongCount: 0,
      cityCount: 0,
      songAppearCount: 0,
      topSongs: [],
      stages: []
    },
    expenseModalVisible: false,
    expenseModalStageId: ''
  },

  onShow() {
    this.bindNetworkReload();
    this.loadPage();
  },

  onHide() {
    this.unbindNetworkReload();
  },

  bindNetworkReload() {
    this.unbindNetworkReload();
    this._networkReloadHandler = (res) => {
      if (res.isConnected) {
        stageService.invalidateStageCache();
        this.loadPage();
      }
    };
    wx.onNetworkStatusChange(this._networkReloadHandler);
  },

  unbindNetworkReload() {
    if (this._networkReloadHandler) {
      wx.offNetworkStatusChange(this._networkReloadHandler);
      this._networkReloadHandler = null;
    }
  },

  onPullDownRefresh() {
    stageService.invalidateStageCache();
    this.loadPage().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadPage() {
    this.setData({ loading: true });
    try {
      await stageService.ensureStagesLoaded({ refresh: true });
      this.refreshPage();
    } catch (error) {
      wx.showToast({ title: '舞台数据加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  refreshPage() {
    const statsYearOptions = stageService.getStatsYearOptions();
    const yearOptions = stageService.getYearOptions();
    const stageTypeOptions = stageService.getMeetCategoryOptions();
    const statsYearIndex = Math.min(this.data.statsYearIndex, Math.max(statsYearOptions.length - 1, 0));
    const stageTypeIndex = Math.min(this.data.stageTypeIndex, Math.max(stageTypeOptions.length - 1, 0));
    const activeStageType = stageTypeOptions[stageTypeIndex].id;
    const dashboard = stageService.getStageDashboard({
      stageType: activeStageType,
      year: yearOptions[this.data.yearIndex] ? yearOptions[this.data.yearIndex].id : 'all',
      lightStatus: this.data.statusOptions[this.data.statusIndex].id,
      keyword: this.data.keyword,
      statsYear: statsYearOptions[statsYearIndex] ? statsYearOptions[statsYearIndex].id : ''
    });
    this.setData({
      stageTypeOptions,
      stageTypeIndex,
      yearOptions,
      statsYearOptions,
      statsYearIndex,
      meetTimeline: dashboard.meetTimeline,
      stages: dashboard.stages,
      songSearchResults: dashboard.songSearchResults,
      stats: dashboard.stats,
      songStats: dashboard.songStats,
      albumProgress: dashboard.albumProgress,
      yearStats: dashboard.yearStats
    });
  },

  handleKeywordInput(event) {
    this.setData({ keyword: event.detail.value });
    this.refreshPage();
  },

  handleStageTypeChange(event) {
    this.setData({ stageTypeIndex: Number(event.currentTarget.dataset.index) });
    this.refreshPage();
  },

  handleYearChange(event) {
    this.setData({ yearIndex: Number(event.detail.value) });
    this.refreshPage();
  },

  handleStatsYearChange(event) {
    this.setData({ statsYearIndex: Number(event.detail.value) });
    this.refreshPage();
  },

  handleStatusChange(event) {
    this.setData({ statusIndex: Number(event.detail.value) });
    this.refreshPage();
  },

  handleClearFilter() {
    this.setData({ keyword: '', yearIndex: 0, statusIndex: 0 });
    this.refreshPage();
  },

  handleOpenMeetMemory() {
    const type = this.data.stageTypeOptions[this.data.stageTypeIndex].id;
    wx.navigateTo({ url: `/pages/memories/index?type=${type}` });
  },

  handleOpenDetail(event) {
    const { id } = event.currentTarget.dataset;
    if (!id) {
      wx.showToast({ title: '场次信息缺失', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/stage-detail/index?id=${id}` });
  },

  stopTap() {},

  handleSongStageAction(event) {
    const { stageId, lighted } = event.currentTarget.dataset;
    if (lighted === 'true' || lighted === true) {
      this.handleOpenDetail({ currentTarget: { dataset: { id: stageId } } });
      return;
    }
    this.handleLightStage({ currentTarget: { dataset: { id: stageId } } });
  },

  handleLightStage(event) {
    const { id } = event.currentTarget.dataset;
    this.lightStageById(id);
  },

  async lightStageById(id) {
    const result = await stageService.lightStage(id);
    if (!result.valid) {
      wx.showToast({ title: result.message, icon: 'none' });
      return;
    }
    const stage = result.data || this.data.stages.find((item) => item.stageId === id);
    if (stageService.hasStageLinkedExpense(id)) {
      wx.showToast({ title: '已点亮', icon: 'success' });
      this.refreshPage();
      return;
    }
    wx.showModal({
      title: '同步消费记录',
      content: '已点亮该场次，是否新增见面消费记录？',
      cancelText: '仅点亮',
      confirmText: '去新增',
      confirmColor: '#c84d69',
      success: (res) => {
        if (!res.confirm) {
          wx.showToast({ title: '已点亮', icon: 'success' });
          this.refreshPage();
          return;
        }
        this.setData({
          expenseModalVisible: true,
          expenseModalStageId: id
        });
      }
    });
  },

  handleCloseExpenseModal() {
    this.setData({
      expenseModalVisible: false,
      expenseModalStageId: ''
    });
    this.refreshPage();
  },

  handleExpenseModalSuccess() {
    this.setData({
      expenseModalVisible: false,
      expenseModalStageId: ''
    });
    this.refreshPage();
  },

  handleCreateExpenseFromStage(stage) {
    if (!stage) {
      wx.showToast({ title: '舞台场次不存在', icon: 'none' });
      this.refreshPage();
      return;
    }
    this.setData({
      expenseModalVisible: true,
      expenseModalStageId: stage.stageId
    });
  },

  handleUnlightStage(event) {
    const { id } = event.currentTarget.dataset;
    stageService.confirmUnlightStage(id, {
      onDone: () => {
        this.loadPage();
      }
    });
  }
});
