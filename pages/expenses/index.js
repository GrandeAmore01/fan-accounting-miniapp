const expenseService = require('../../services/expenseService');
const budgetService = require('../../services/budgetService');

const defaultFormData = {
  expenseId: '',
  category: 'goods',
  itemName: '',
  amount: '',
  quantity: 1,
  date: '',
  paymentMethod: '微信支付',
  remark: '',
  includeInTotal: true,
  collectionId: '',
  stageId: ''
};

Page({
  data: {
    expenses: [],
    categories: expenseService.expenseCategories,
    filterCategories: [{ id: 'all', name: '全部分类' }, ...expenseService.expenseCategories],
    filterCategoryIndex: 0,
    keyword: '',
    paymentMethods: ['微信支付', '支付宝', '银行卡', '现金', '其他'],
    formVisible: false,
    formMode: 'create',
    formTitle: '新增消费记录',
    formData: { ...defaultFormData },
    categoryIndex: 1,
    paymentMethodIndex: 0,
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
    const filterCategory = this.data.filterCategories[this.data.filterCategoryIndex].id;
    this.setData({
      expenses: expenseService.filterExpenses({
        category: filterCategory,
        keyword: this.data.keyword
      }),
      summary: expenseService.getExpenseSummary(),
      budgetProgress: budgetService.getBudgetProgress()
    });
  },

  handleKeywordInput(event) {
    this.setData({
      keyword: event.detail.value
    });
    this.refreshPage();
  },

  handleFilterCategoryChange(event) {
    this.setData({
      filterCategoryIndex: Number(event.detail.value)
    });
    this.refreshPage();
  },

  handleClearFilter() {
    this.setData({
      keyword: '',
      filterCategoryIndex: 0
    });
    this.refreshPage();
  },

  handleOpenCreate() {
    this.setData({
      formVisible: true,
      formMode: 'create',
      formTitle: '新增消费记录',
      formData: {
        ...defaultFormData,
        date: this.getToday()
      },
      categoryIndex: 1,
      paymentMethodIndex: 0
    });
  },

  handleOpenEdit(event) {
    const expenseId = event.currentTarget.dataset.id;
    const expense = this.data.expenses.find((item) => item.expenseId === expenseId);
    if (!expense) {
      wx.showToast({
        title: '记录不存在',
        icon: 'none'
      });
      return;
    }
    const categoryIndex = Math.max(
      this.data.categories.findIndex((item) => item.id === expense.category),
      0
    );
    const paymentMethodIndex = Math.max(this.data.paymentMethods.indexOf(expense.paymentMethod), 0);
    this.setData({
      formVisible: true,
      formMode: 'edit',
      formTitle: '编辑消费记录',
      formData: {
        ...expense,
        amount: String(expense.amount),
        quantity: String(expense.quantity)
      },
      categoryIndex,
      paymentMethodIndex
    });
  },

  handleCloseForm() {
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

  handleCategoryChange(event) {
    const categoryIndex = Number(event.detail.value);
    this.setData({
      categoryIndex,
      'formData.category': this.data.categories[categoryIndex].id
    });
  },

  handlePaymentMethodChange(event) {
    const paymentMethodIndex = Number(event.detail.value);
    this.setData({
      paymentMethodIndex,
      'formData.paymentMethod': this.data.paymentMethods[paymentMethodIndex]
    });
  },

  handleDateChange(event) {
    this.setData({
      'formData.date': event.detail.value
    });
  },

  handleIncludeChange(event) {
    this.setData({
      'formData.includeInTotal': event.detail.value
    });
  },

  handleSubmitForm() {
    const result =
      this.data.formMode === 'edit'
        ? expenseService.updateExpense(this.data.formData.expenseId, this.data.formData)
        : expenseService.addExpense(this.data.formData);

    if (!result.valid) {
      wx.showToast({
        title: result.message,
        icon: 'none'
      });
      return;
    }

    wx.showToast({
      title: this.data.formMode === 'edit' ? '已保存' : '已新增',
      icon: 'success'
    });
    this.setData({
      formVisible: false
    });
    this.refreshPage();
  },

  handleDeleteExpense(event) {
    const expenseId = event.currentTarget.dataset.id;
    wx.showModal({
      title: '删除消费记录',
      content: '删除后无法在本地恢复，确定要删除吗？',
      confirmText: '删除',
      confirmColor: '#c84d69',
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        expenseService.removeExpense(expenseId);
        wx.showToast({
          title: '已删除',
          icon: 'success'
        });
        this.refreshPage();
      }
    });
  },

  noop() {},

  getToday() {
    const date = new Date();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }
});
