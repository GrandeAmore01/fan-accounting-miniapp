const stageService = require('../../services/stageService');

Page({
  data: {
    loading: true,
    typeOptions: [
      { id: 'concert', name: '演唱会' },
      { id: 'festival', name: '音乐节/拼盘' }
    ],
    activeTypeIndex: 0,
    yearOptions: [],
    yearIndex: 0,
    report: {},
    annualReport: {},
    calendar: [],
    songCollection: {},
    photoWall: { hasPhotos: false, groups: [] },
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
      await stageService.ensureStagesLoaded();
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
      photoWall: stageService.getPhotoWall(),
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

  handlePreviewPhoto(event) {
    const { groupIndex, photoIndex } = event.currentTarget.dataset;
    const group = this.data.photoWall.groups[groupIndex];
    if (!group) return;
    wx.previewImage({
      current: group.photos[photoIndex],
      urls: group.photos
    });
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
