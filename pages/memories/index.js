const stageService = require('../../services/stageService');

Page({
  data: {
    loading: true,
    typeOptions: [
      { id: 'concert', name: '演唱会' },
      { id: 'special', name: '运动会/新年音乐会' }
    ],
    activeTypeIndex: 0,
    yearOptions: [],
    yearIndex: 0,
    report: {
      hasRecords: false,
      typeName: '',
      meetCount: 0,
      topCity: { name: '暂无记录', count: 0 },
      cityRanking: []
    },
    annualReport: {
      hasRecords: false,
      year: '',
      meetCount: 0,
      unlockedSongCount: 0,
      cityCount: 0,
      stageSpending: '0.00',
      expenseCount: 0,
      songAppearCount: 0,
      topCity: { name: '暂无记录', count: 0 },
      topSongs: []
    },
    calendar: [],
    songCollection: {
      heardCount: 0,
      libraryCount: 0,
      isComplete: false,
      topHeardSongs: [],
      unheardSongs: []
    },
    companions: [],
    activeCompanion: null
  },

  onLoad(options) {
    const type = options.type || 'concert';
    const activeTypeIndex = Math.max(this.data.typeOptions.findIndex((item) => item.id === type), 0);
    this.setData({ activeTypeIndex });
  },

  onShow() {
    this.loadPage();
  },

  async loadPage() {
    this.setData({ loading: true });
    try {
      await stageService.ensureStagesLoaded({ refresh: true });
      this.refreshReport();
    } catch (error) {
      wx.showToast({ title: '回忆数据加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  refreshReport() {
    const type = this.data.typeOptions[this.data.activeTypeIndex].id;
    const yearOptions = stageService.getStatsYearOptions();
    const yearIndex = Math.min(this.data.yearIndex, Math.max(yearOptions.length - 1, 0));
    const year = yearOptions[yearIndex] ? yearOptions[yearIndex].id : String(new Date().getFullYear());
    this.setData({
      yearOptions,
      yearIndex,
      report: stageService.getMeetMemoryReport(type),
      annualReport: stageService.getAnnualMemoryReport(year, type),
      calendar: stageService.getMeetCalendar(year, type),
      songCollection: stageService.getSongCollectionStats(),
      companions: stageService.getCompanionProfiles(),
      activeCompanion: null
    });
  },

  handleTypeChange(event) {
    this.setData({ activeTypeIndex: Number(event.currentTarget.dataset.index) });
    this.refreshReport();
  },

  handleYearChange(event) {
    this.setData({ yearIndex: Number(event.detail.value) });
    this.refreshReport();
  },

  handleOpenDetail(event) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/stage-detail/index?id=${id}` });
  },

  handleCompanionTap(event) {
    const { name } = event.currentTarget.dataset;
    const activeCompanion = this.data.companions.find((item) => item.name === name) || null;
    this.setData({ activeCompanion });
  },

  handleBackHome() {
    wx.switchTab({ url: '/pages/stages/index' });
  }
});
