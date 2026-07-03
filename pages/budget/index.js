const budgetService = require('../../services/budgetService');

const budgetTypes = [
  { id: 'month', name: '月度预算' },
  { id: 'year', name: '年度预算' }
];

Page({
  data: {
    budgetTypes,
    budgetTypeIndex: 0,
    selectedType: 'month',
    selectedPeriod: '',
    formVisible: false,
    formData: {
      amount: '',
      thresholdPercent: 80,
      period: ''
    },
    progress: {
      budget: {
        amount: 0,
        threshold: 0.8,
        period: ''
      },
      totalAmount: 0,
      remainingAmount: 0,
      percent: 0,
      thresholdPercent: 80,
      isOverThreshold: false,
      isOverBudget: false
    },
    categoryStats: [],
    monthTrend: []
  },

  onLoad() {
    this.setData({
      selectedPeriod: budgetService.getCurrentMonth()
    });
  },

  onShow() {
    this.refreshPage();
  },

  refreshPage() {
    const dashboard = budgetService.getBudgetDashboard(this.data.selectedType, this.data.selectedPeriod);
    this.setData({
      progress: dashboard.progress,
      categoryStats: dashboard.categoryStats,
      monthTrend: dashboard.monthTrend
    });
  },

  handleBudgetTypeChange(event) {
    const budgetTypeIndex = Number(event.detail.value);
    const selectedType = this.data.budgetTypes[budgetTypeIndex].id;
    this.setData({
      budgetTypeIndex,
      selectedType,
      selectedPeriod: budgetService.getDefaultPeriod(selectedType)
    });
    this.refreshPage();
  },

  handleMonthChange(event) {
    this.setData({
      selectedPeriod: event.detail.value
    });
    this.refreshPage();
  },

  handleYearInput(event) {
    const value = event.detail.value.slice(0, 4);
    this.setData({
      selectedPeriod: value
    });
    if (value.length === 4) {
      this.refreshPage();
    }
  },

  handleOpenBudgetForm() {
    const budget = this.data.progress.budget;
    this.setData({
      formVisible: true,
      formData: {
        amount: budget.amount ? String(budget.amount) : '',
        thresholdPercent: budget.threshold ? Math.round(budget.threshold * 100) : 80,
        period: this.data.selectedPeriod
      }
    });
  },

  handleCloseBudgetForm() {
    this.setData({
      formVisible: false
    });
  },

  handleFormInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`formData.${field}`]: event.detail.value
    });
  },

  handleFormMonthChange(event) {
    this.setData({
      'formData.period': event.detail.value
    });
  },

  handleSaveBudget() {
    const result = budgetService.saveBudget({
      budgetType: this.data.selectedType,
      period: this.data.formData.period,
      amount: this.data.formData.amount,
      threshold: Number(this.data.formData.thresholdPercent || 80) / 100
    });

    if (!result.valid) {
      wx.showToast({
        title: result.message,
        icon: 'none'
      });
      return;
    }

    wx.showToast({
      title: '已保存预算',
      icon: 'success'
    });
    this.setData({
      formVisible: false,
      selectedPeriod: result.data.period
    });
    this.refreshPage();
  },

  noop() {}
});
