const expenseService = require('../../services/expenseService');
const budgetService = require('../../services/budgetService');
const stageService = require('../../services/stageService');

function createDefaultFormData() {
  return {
    expenseId: '',
    category: 'meet',
    subType: 'concert',
    itemName: '',
    amount: '',
    quantity: 1,
    date: '',
    paymentMethod: '微信支付',
    remark: '',
    images: [],
    fees: {
      premium: '',
      travel: '',
      hotel: '',
      rental: '',
      other: '',
      shipping: ''
    },
    outfieldOnly: false,
    includeInTotal: true,
    collectionId: '',
    stageId: '',
    stageDate: '',
    priceTier: ''
  };
}

Page({
  data: {
    expenses: [],
    categories: expenseService.expenseCategories,
    subTypes: [],
    filterCategories: [{ id: 'all', name: '全部分类' }, ...expenseService.expenseCategories],
    filterCategoryIndex: 0,
    keyword: '',
    paymentMethods: ['微信支付', '支付宝', '银行卡', '现金', '其他'],
    concertStages: [],
    concertStageIndex: 0,
    priceTiers: [],
    priceTierLabels: [],
    priceTierIndex: 0,
    matchedMeetStageName: '',
    searchKeyword: '',
    searchResults: [],
    formVisible: false,
    formMode: 'create',
    formTitle: '新增消费记录',
    formData: createDefaultFormData(),
    categoryIndex: 0,
    subTypeIndex: 0,
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
    const formData = {
      ...createDefaultFormData(),
      date: this.getToday()
    };
    this.applyFormState({
      formVisible: true,
      formMode: 'create',
      formTitle: '新增消费记录',
      formData,
      categoryIndex: 0,
      subTypeIndex: 0,
      paymentMethodIndex: 0,
      searchKeyword: '',
      searchResults: []
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
    const category = this.data.categories[categoryIndex];
    const subTypes = category.subTypes || [];
    const subTypeIndex = Math.max(subTypes.findIndex((item) => item.id === expense.subType), 0);
    const paymentMethodIndex = Math.max(this.data.paymentMethods.indexOf(expense.paymentMethod), 0);
    this.applyFormState({
      formVisible: true,
      formMode: 'edit',
      formTitle: '编辑消费记录',
      formData: {
        ...createDefaultFormData(),
        ...expense,
        amount: String(expense.amount || ''),
        quantity: String(expense.quantity || 1),
        fees: {
          ...createDefaultFormData().fees,
          ...(expense.fees || {})
        }
      },
      categoryIndex,
      subTypeIndex,
      paymentMethodIndex,
      searchKeyword: '',
      searchResults: []
    });
  },

  applyFormState(nextState) {
    const formData = nextState.formData || this.data.formData;
    const categoryIndex =
      typeof nextState.categoryIndex === 'number'
        ? nextState.categoryIndex
        : this.data.categories.findIndex((item) => item.id === formData.category);
    const safeCategoryIndex = Math.max(categoryIndex, 0);
    const category = this.data.categories[safeCategoryIndex];
    const subTypes = category.subTypes || [];
    const subTypeIndex =
      typeof nextState.subTypeIndex === 'number'
        ? nextState.subTypeIndex
        : subTypes.findIndex((item) => item.id === formData.subType);
    const safeSubTypeIndex = Math.max(subTypeIndex, 0);
    const concertStages = stageService.listStages().filter((item) => item.stageType === 'concert' || item.stageType === 'festival');
    const isDateMatchedMeet =
      formData.category === 'meet' && (formData.subType === 'concert' || formData.subType === 'festival');
    const matchedStage =
      isDateMatchedMeet
        ? stageService.findStageByDate(formData.date, formData.subType)
        : null;
    const concertStageIndex = matchedStage
      ? Math.max(concertStages.findIndex((item) => item.id === matchedStage.stageId), 0)
      : 0;
    const priceTiers = matchedStage ? matchedStage.priceTiers || [] : [];
    const priceTierLabels = priceTiers.map((price) => `${price} 元`);
    const priceTierIndex = Math.max(priceTiers.findIndex((price) => String(price) === String(formData.priceTier)), 0);
    const shouldAutoFillStage =
      formData.category === 'meet' &&
      (formData.subType === 'concert' || formData.subType === 'festival') &&
      matchedStage &&
      (!formData.stageId || formData.stageDate !== formData.date);
    const nextFormData = shouldAutoFillStage
      ? {
          ...formData,
          stageId: matchedStage.stageId,
          stageDate: matchedStage.date,
          itemName: matchedStage.stageName,
          amount: priceTiers.length ? String(priceTiers[0]) : formData.amount,
          priceTier: priceTiers.length ? String(priceTiers[0]) : ''
        }
      : matchedStage
        ? formData
        : {
            ...formData,
            stageId: '',
            stageDate: '',
            priceTier: isDateMatchedMeet ? '' : formData.priceTier
          };

    this.setData({
      ...nextState,
      formData: nextFormData,
      categoryIndex: safeCategoryIndex,
      subTypes,
      subTypeIndex: safeSubTypeIndex,
      concertStages,
      concertStageIndex,
      priceTiers,
      priceTierLabels,
      priceTierIndex,
      matchedMeetStageName: matchedStage ? matchedStage.stageName : ''
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

  handleFeeInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`formData.fees.${field}`]: event.detail.value
    });
  },

  handleCategoryChange(event) {
    const categoryIndex = Number(event.detail.value);
    const category = this.data.categories[categoryIndex];
    const firstSubType = category.subTypes[0];
    this.applyFormState({
      categoryIndex,
      subTypeIndex: 0,
      formData: {
        ...this.data.formData,
        category: category.id,
        subType: firstSubType.id,
        itemName: category.id === 'meet' ? firstSubType.name : '',
        amount: '',
        stageId: '',
        stageDate: '',
        priceTier: ''
      },
      searchKeyword: '',
      searchResults: []
    });
  },

  handleSubTypeChange(event) {
    const subTypeIndex = Number(event.detail.value);
    const subType = this.data.subTypes[subTypeIndex];
    this.applyFormState({
      subTypeIndex,
      formData: {
        ...this.data.formData,
        subType: subType.id,
        itemName: this.data.formData.category === 'meet' ? subType.name : this.data.formData.itemName
      }
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
    const date = event.detail.value;
    if (
      this.data.formData.category === 'meet' &&
      (this.data.formData.subType === 'concert' || this.data.formData.subType === 'festival')
    ) {
      const matchedStage = stageService.findStageByDate(date, this.data.formData.subType);
      if (matchedStage) {
        const priceTiers = matchedStage.priceTiers || [];
        const priceTierLabels = priceTiers.map((price) => `${price} 元`);
        this.setData({
          'formData.date': date,
          'formData.stageId': matchedStage.stageId,
          'formData.stageDate': matchedStage.date,
          'formData.itemName': matchedStage.stageName,
          'formData.amount': priceTiers.length ? String(priceTiers[0]) : '',
          'formData.priceTier': priceTiers.length ? String(priceTiers[0]) : '',
          concertStageIndex: Math.max(
            this.data.concertStages.findIndex((item) => item.id === matchedStage.stageId),
            0
          ),
          priceTiers,
          priceTierLabels,
          priceTierIndex: 0,
          matchedMeetStageName: matchedStage.stageName
        });
        return;
      }

      const fallbackName = this.data.formData.subType === 'festival' ? '音乐节|拼盘' : '演唱会';
      this.setData({
        'formData.date': date,
        'formData.stageId': '',
        'formData.stageDate': '',
        'formData.itemName': this.data.matchedMeetStageName ? fallbackName : this.data.formData.itemName || fallbackName,
        'formData.amount': '',
        'formData.priceTier': '',
        priceTiers: [],
        priceTierLabels: [],
        priceTierIndex: 0,
        matchedMeetStageName: ''
      });
      return;
    }

    this.setData({
      'formData.date': date
    });
  },

  handleConcertStageChange(event) {
    const concertStageIndex = Number(event.detail.value);
    const stage = this.data.concertStages[concertStageIndex];
    const priceTiers = stage.priceTiers || [];
    const priceTierLabels = priceTiers.map((price) => `${price} 元`);
    this.setData({
      concertStageIndex,
      priceTiers,
      priceTierLabels,
      priceTierIndex: 0,
      'formData.stageId': stage.id,
      'formData.stageDate': stage.date,
      'formData.date': stage.date,
      'formData.itemName': stage.stageName,
      'formData.amount': priceTiers.length ? String(priceTiers[0]) : '',
      'formData.priceTier': priceTiers.length ? String(priceTiers[0]) : ''
    });
  },

  handlePriceTierChange(event) {
    const priceTierIndex = Number(event.detail.value);
    const priceTier = this.data.priceTiers[priceTierIndex];
    if (typeof priceTier === 'undefined') {
      return;
    }
    this.setData({
      priceTierIndex,
      'formData.amount': String(priceTier),
      'formData.priceTier': String(priceTier)
    });
  },

  handleOutfieldChange(event) {
    const outfieldOnly = event.detail.value;
    this.setData({
      'formData.outfieldOnly': outfieldOnly,
      'formData.includeInTotal': !outfieldOnly
    });
  },

  handleIncludeChange(event) {
    this.setData({
      'formData.includeInTotal': event.detail.value,
      'formData.outfieldOnly': !event.detail.value
    });
  },

  handleItemSearchInput(event) {
    const searchKeyword = event.detail.value;
    const category = this.data.formData.category;
    const results = expenseService.searchableItems.filter((item) => {
      const keywordMatched = !searchKeyword || item.name.indexOf(searchKeyword) >= 0;
      return item.mainType === category && keywordMatched;
    });
    this.setData({
      searchKeyword,
      searchResults: results
    });
  },

  handleSelectSearchItem(event) {
    const { id } = event.currentTarget.dataset;
    const item = expenseService.searchableItems.find((candidate) => candidate.id === id);
    if (!item) {
      return;
    }
    const subTypeIndex = Math.max(this.data.subTypes.findIndex((subType) => subType.id === item.subType), 0);
    this.setData({
      subTypeIndex,
      'formData.subType': item.subType,
      'formData.itemName': item.name,
      searchKeyword: item.name,
      searchResults: []
    });
  },

  handleChooseImages() {
    const remainCount = 9 - this.data.formData.images.length;
    if (remainCount <= 0) {
      wx.showToast({
        title: '最多选择 9 张图片',
        icon: 'none'
      });
      return;
    }
    wx.chooseMedia({
      count: remainCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const nextImages = [
          ...this.data.formData.images,
          ...res.tempFiles.map((file) => file.tempFilePath)
        ].slice(0, 9);
        this.setData({
          'formData.images': nextImages
        });
      }
    });
  },

  handleRemoveImage(event) {
    const index = Number(event.currentTarget.dataset.index);
    const nextImages = this.data.formData.images.filter((_, imageIndex) => imageIndex !== index);
    this.setData({
      'formData.images': nextImages
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
