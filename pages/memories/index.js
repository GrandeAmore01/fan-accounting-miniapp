const stageService = require('../../services/stageService');

const emptyReport = {
  stageType: 'concert',
  typeName: '演唱会',
  hasRecords: false,
  meetCount: 0,
  cityCount: 0,
  venueCount: 0,
  topCity: { name: '暂无记录', count: 0 },
  topVenue: { name: '暂无记录', count: 0 },
  firstVenueName: '暂无记录',
  firstCityName: '暂无记录',
  earliestDateText: '暂无记录',
  latestDateText: '暂无记录',
  cityRanking: [],
  venueRanking: []
};

Page({
  data: {
    typeOptions: [
      { id: 'concert', name: '演唱会' },
      { id: 'festival', name: '音乐节/拼盘' }
    ],
    activeTypeIndex: 0,
    report: emptyReport
  },

  onLoad(options) {
    const type = options.type || 'concert';
    const activeTypeIndex = Math.max(this.data.typeOptions.findIndex((item) => item.id === type), 0);
    this.setData({
      activeTypeIndex
    });
    this.refreshReport();
  },

  onShow() {
    this.refreshReport();
  },

  refreshReport() {
    const type = this.data.typeOptions[this.data.activeTypeIndex].id;
    this.setData({
      report: stageService.getMeetMemoryReport(type)
    });
  },

  handleTypeChange(event) {
    this.setData({
      activeTypeIndex: Number(event.currentTarget.dataset.index)
    });
    this.refreshReport();
  },

  handleBackHome() {
    wx.switchTab({
      url: '/pages/stages/index'
    });
  }
});
