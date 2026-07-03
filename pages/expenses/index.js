const expenseService = require('../../services/expenseService');
const budgetService = require('../../services/budgetService');

Page({
  data: {
    expenses: [],
    summary: {
      totalAmount: 0,
      count: 0
    },
    budgetProgress: {
      percent: 0
    }
  },

  onShow() {
    this.refreshPage();
  },

  refreshPage() {
    this.setData({
      expenses: expenseService.listExpenses(),
      summary: expenseService.getExpenseSummary(),
      budgetProgress: budgetService.getBudgetProgress()
    });
  },

  handleAddSample() {
    expenseService.addExpense({
      category: 'goods',
      itemName: '示例周边消费',
      amount: 39,
      quantity: 1,
      date: this.getToday(),
      paymentMethod: '微信支付',
      remark: '第一阶段本地示例记录'
    });
    wx.showToast({
      title: '已添加示例',
      icon: 'success'
    });
    this.refreshPage();
  },

  getToday() {
    const date = new Date();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }
});
