const budgetService = require('../../services/budgetService');

Page({
  data: {
    progress: {
      budget: {
        amount: 0,
        threshold: 0.8
      },
      totalAmount: 0,
      percent: 0
    }
  },

  onShow() {
    this.refreshPage();
  },

  refreshPage() {
    this.setData({
      progress: budgetService.getBudgetProgress()
    });
  },

  handleSetSampleBudget() {
    budgetService.saveBudget({
      amount: 1000,
      threshold: 0.8,
      budgetType: 'month'
    });
    wx.showToast({
      title: '已设置预算',
      icon: 'success'
    });
    this.refreshPage();
  }
});
