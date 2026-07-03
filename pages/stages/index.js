const stageService = require('../../services/stageService');

Page({
  data: {
    stages: [],
    stats: {
      total: 0,
      lightedCount: 0,
      unlockedSongCount: 0
    }
  },

  onShow() {
    this.refreshPage();
  },

  refreshPage() {
    this.setData({
      stages: stageService.listStages(),
      stats: stageService.getStageStats()
    });
  },

  handleToggleStage(event) {
    const { id } = event.currentTarget.dataset;
    stageService.lightStage(id);
    this.refreshPage();
  }
});
