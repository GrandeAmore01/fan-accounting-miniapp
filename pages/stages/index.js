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
    meetTimeline: {
      hasMeetStages: false,
      lastMeet: {
        daysText: '--',
        dateText: '暂无记录',
        stageName: ''
      },
      nextMeet: {
        daysText: '--',
        dateText: '暂无记录',
        stageName: ''
      },
      firstMeetDateText: '暂无记录'
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
      meetTimeline: dashboard.meetTimeline,
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

  handleOpenMeetMemory() {
    const type = this.data.stageTypeOptions[this.data.stageTypeIndex].id;
    wx.navigateTo({
      url: `/pages/memories/index?type=${type}`
    });
  },

  handleLightStage(event) {
    const { id } = event.currentTarget.dataset;
    const result = stageService.lightStage(id);
    if (!result.valid) {
      wx.showToast({
        title: result.message,
        icon: 'none'
      });
      return;
    }
    const stage = result.data || this.data.stages.find((item) => item.stageId === id);
    if (stage && stage.expenseId) {
      wx.showToast({
        title: '已点亮',
        icon: 'success'
      });
      this.refreshPage();
      return;
    }

    wx.showModal({
      title: '同步消费记录',
      content: '已点亮该场次，是否按票档同步生成一条消费记录？',
      cancelText: '仅点亮',
      confirmText: '生成记录',
      confirmColor: '#c84d69',
      success: (res) => {
        if (!res.confirm) {
          wx.showToast({
            title: '已点亮',
            icon: 'success'
          });
          this.refreshPage();
          return;
        }
        this.handleCreateExpenseFromStage(stage);
      }
    });
  },

  handleCreateExpenseFromStage(stage) {
    if (!stage) {
      wx.showToast({
        title: '舞台场次不存在',
        icon: 'none'
      });
      this.refreshPage();
      return;
    }
    const priceTiers = stage && stage.priceTiers ? stage.priceTiers : [];
    if (priceTiers.length > 1) {
      wx.showActionSheet({
        itemList: priceTiers.map((price) => `${price} 元`),
        success: (res) => {
          this.createExpenseFromStage(stage.stageId, priceTiers[res.tapIndex]);
        },
        fail: () => {
          wx.showToast({
            title: '已点亮',
            icon: 'success'
          });
          this.refreshPage();
        }
      });
      return;
    }
    this.createExpenseFromStage(stage.stageId, priceTiers[0]);
  },

  createExpenseFromStage(stageId, priceTier) {
    const expenseResult = stageService.createExpenseFromStage(stageId, priceTier);
    wx.showToast({
      title: expenseResult.valid ? '已生成记录' : expenseResult.message,
      icon: expenseResult.valid ? 'success' : 'none'
    });
    this.refreshPage();
  },

  handleUnlightStage(event) {
    const { id } = event.currentTarget.dataset;
    const stage = this.data.stages.find((item) => item.stageId === id);
    const hasLinkedExpense = Boolean(stage && stage.expenseId);
    wx.showModal({
      title: '取消点亮',
      content: hasLinkedExpense
        ? '取消点亮后，是否同时删除这条舞台同步生成的消费记录？'
        : '取消后会同步更新歌曲统计和专辑进度，确定要取消吗？',
      cancelText: hasLinkedExpense ? '保留记录' : '再想想',
      confirmText: hasLinkedExpense ? '删除记录' : '取消点亮',
      confirmColor: '#c84d69',
      success: (res) => {
        if (!res.confirm && !hasLinkedExpense) {
          return;
        }
        stageService.unlightStage(id, {
          deleteExpense: hasLinkedExpense && res.confirm
        });
        wx.showToast({
          title: hasLinkedExpense && res.confirm ? '已删除记录' : '已取消',
          icon: 'success'
        });
        this.refreshPage();
      }
    });
  }
});
