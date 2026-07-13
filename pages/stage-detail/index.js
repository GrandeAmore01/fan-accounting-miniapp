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
    },
    expenseModalVisible: false
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
      await stageService.ensureStagesLoaded({ refresh: true });
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
        editingNote: detail.isLighted ? this.data.editingNote : false,
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
    if (!this.data.detail || !this.data.detail.isLighted) {
      wx.showToast({ title: '请先点亮该场次', icon: 'none' });
      return;
    }
    this.setData({
      editingNote: !this.data.editingNote
    });
  },

  handleNoteInput(event) {
    const { field } = event.currentTarget.dataset;
    let value = event.detail.value;
    if (field === 'actualTicketPrice') {
      value = this.sanitizeActualTicketPriceInput(
        value,
        this.data.noteForm.actualTicketPrice
      );
    }
    this.setData({
      [`noteForm.${field}`]: value
    });
  },

  sanitizeActualTicketPriceInput(value, previousValue = '') {
    const nextValue = String(value || '');
    const previous = String(previousValue || '');
    if (!nextValue) {
      return '';
    }
    if (!/^\d*(\.\d{0,2})?$/.test(nextValue)) {
      return previous;
    }
    return nextValue;
  },

  async handleSaveNote() {
    if (!this.data.detail || !this.data.detail.isLighted) {
      wx.showToast({ title: '请先点亮该场次', icon: 'none' });
      return;
    }
    const { noteForm, stageId } = this.data;
    const result = await stageService.saveStageNote(stageId, noteForm);
    if (!result.valid) {
      wx.showToast({ title: result.message, icon: 'none' });
      return;
    }
    wx.showToast({ title: '已保存', icon: 'success' });
    this.setData({ editingNote: false });
    this.loadDetail();
  },

  async handleLightStage() {
    const result = await stageService.lightStage(this.data.stageId);
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
      content: '已点亮该场次，是否新增见面消费记录？',
      cancelText: '仅点亮',
      confirmText: '去新增',
      confirmColor: '#c84d69',
      success: (res) => {
        if (!res.confirm) {
          wx.showToast({ title: '已点亮', icon: 'success' });
          this.loadDetail();
          return;
        }
        this.setData({ expenseModalVisible: true });
      }
    });
  },

  handleCloseExpenseModal() {
    this.setData({ expenseModalVisible: false });
    this.loadDetail();
  },

  handleExpenseModalSuccess() {
    this.setData({ expenseModalVisible: false });
    wx.showToast({ title: '已生成记录', icon: 'success' });
    this.loadDetail();
  },

  handleUnlightStage() {
    stageService.confirmUnlightStage(this.data.stageId, {
      onDone: () => {
        this.loadDetail();
      }
    });
  }
});
