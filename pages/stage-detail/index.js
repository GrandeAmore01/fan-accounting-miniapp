const stageService = require('../../services/stageService');

Page({
  data: {
    loading: true,
    loadError: '',
    stageId: '',
    detail: null,
    editingNote: false,
    noteForm: {
      seat: '',
      companions: '',
      actualTicketPrice: '',
      note: ''
    }
  },

  onLoad(options) {
    this.setData({
      stageId: options.id || ''
    });
  },

  onShow() {
    this.loadDetail();
  },

  async loadDetail() {
    this.setData({ loading: true, loadError: '' });
    try {
      await stageService.ensureStagesLoaded();
      const detail = stageService.getStageDetail(this.data.stageId);
      if (!detail) {
        this.setData({
          loading: false,
          detail: null,
          loadError: '场次不存在，请返回列表重试'
        });
        wx.showToast({ title: '场次不存在', icon: 'none' });
        return;
      }
      this.setData({
        loading: false,
        detail,
        noteForm: {
          seat: detail.note.seat || '',
          companions: detail.note.companions || '',
          actualTicketPrice: detail.note.actualTicketPrice ? String(detail.note.actualTicketPrice) : '',
          note: detail.note.note || ''
        }
      });
    } catch (error) {
      this.setData({
        loading: false,
        detail: null,
        loadError: '舞台数据加载失败，请确认后端已启动'
      });
      wx.showToast({ title: '数据加载失败', icon: 'none' });
    }
  },

  handleToggleNoteEdit() {
    this.setData({
      editingNote: !this.data.editingNote
    });
  },

  handleNoteInput(event) {
    const { field } = event.currentTarget.dataset;
    let value = event.detail.value;
    if (field === 'actualTicketPrice') {
      value = String(value || '').replace(/[^\d]/g, '');
    }
    this.setData({
      [`noteForm.${field}`]: value
    });
  },

  handleSaveNote() {
    const { noteForm, stageId, detail } = this.data;
    const result = stageService.saveStageNote(stageId, {
      ...noteForm,
      photos: detail.note.photos || []
    });
    if (!result.valid) {
      wx.showToast({ title: result.message, icon: 'none' });
      return;
    }
    wx.showToast({ title: '已保存', icon: 'success' });
    this.setData({ editingNote: false });
    this.loadDetail();
  },

  handleChoosePhotos() {
    const currentCount = (this.data.detail.note.photos || []).length;
    const remain = stageService.MAX_PHOTOS - currentCount;
    if (remain <= 0) {
      wx.showToast({ title: '最多上传9张', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const paths = (res.tempFiles || []).map((item) => item.tempFilePath);
        stageService.addStagePhotos(this.data.stageId, paths);
        wx.showToast({ title: '已添加', icon: 'success' });
        this.loadDetail();
      }
    });
  },

  handlePreviewPhoto(event) {
    const { url } = event.currentTarget.dataset;
    const photos = this.data.detail.note.photos || [];
    wx.previewImage({
      current: url,
      urls: photos
    });
  },

  handleRemovePhoto(event) {
    const { url } = event.currentTarget.dataset;
    wx.showModal({
      title: '删除照片',
      content: '确定删除这张照片吗？',
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        stageService.removeStagePhoto(this.data.stageId, url);
        wx.showToast({ title: '已删除', icon: 'success' });
        this.loadDetail();
      }
    });
  },

  handleLightStage() {
    const result = stageService.lightStage(this.data.stageId);
    if (!result.valid) {
      wx.showToast({ title: result.message, icon: 'none' });
      return;
    }
    const stage = result.data;
    if (stageService.hasStageLinkedExpense(this.data.stageId)) {
      wx.showToast({ title: '已点亮', icon: 'success' });
      this.loadDetail();
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
          wx.showToast({ title: '已点亮', icon: 'success' });
          this.loadDetail();
          return;
        }
        setTimeout(() => {
          this.createExpense(stage);
        }, 350);
      }
    });
  },

  createExpense(stage) {
    stageService.promptPriceTier(stage, {
      onSelect: (priceTier) => {
        const result = stageService.createExpenseFromStage(stage.stageId, priceTier);
        wx.showToast({
          title: result.valid ? '已生成记录' : result.message,
          icon: result.valid ? 'success' : 'none'
        });
        this.loadDetail();
      },
      onCancel: () => {
        wx.showToast({ title: '已点亮', icon: 'success' });
        this.loadDetail();
      }
    });
  },

  handleUnlightStage() {
    stageService.confirmUnlightStage(this.data.stageId, {
      onDone: () => {
        this.loadDetail();
      }
    });
  }
});
