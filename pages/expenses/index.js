const expenseService = require('../../services/expenseService');
const budgetService = require('../../services/budgetService');
const stageService = require('../../services/stageService');
const collectionCatalogService = require('../../services/collectionCatalogService');

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
    seat: '',
    location: '',
    city: '',
    remark: '',
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
    priceTier: '',
    purchaseChannel: 'none',
    pricingMode: 'direct',
    referencePrice: '',
    unitPrice: '',
    expenseSource: 'manual'
  };
}

Page({
  data: {
    expenses: [],
    categoryTabs: [{ id: 'all', name: '全部' }, ...expenseService.expenseCategories],
    activeCategoryIndex: 0,
    categories: expenseService.expenseCategories,
    subTypes: [],
    filterCategories: [{ id: 'all', name: '全部分类' }, ...expenseService.expenseCategories],
    filterCategoryIndex: 0,
    keyword: '',
    showActualAmount: false,
    paymentMethods: ['微信支付', '支付宝', '银行卡', '现金', '其他'],
    purchaseChannels: [
      { id: 'none', name: '未选择' },
      { id: 'official', name: '官方渠道' },
      { id: 'other', name: '其他渠道' }
    ],
    pricingModes: [
      { id: 'direct', name: '直接填写总金额' },
      { id: 'official_unit', name: '官方单价 × 数量' },
      { id: 'unit', name: '实际单价 × 数量' },
      { id: 'total', name: '按总价记录' }
    ],
    purchaseChannelIndex: 0,
    pricingModeIndex: 0,
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
    categoryStats: [],
    budgetProgress: {
      percent: 0
    }
  },

  onShow() {
    this.refreshPage();
  },

  async refreshPage() {
    const filterCategory = this.data.categoryTabs[this.data.activeCategoryIndex].id;
    try {
      const expenseList = await expenseService.filterExpensesAsync({
        category: filterCategory,
        keyword: this.data.keyword
      });
      const expenses = expenseList.map((item) => ({
        ...item,
        includedAmountText: expenseService.formatMoney(item.includedAmount),
        totalAmountText: expenseService.formatMoney(item.totalAmount),
        displayAmountLabel: this.data.showActualAmount ? '实际' : '计入',
        displayAmountText: expenseService.formatMoney(
          this.data.showActualAmount ? item.totalAmount : item.includedAmount
        ),
        metaText: [item.date, item.city, item.location, item.seat].filter(Boolean).join(' · ')
      }));
      const summary = await expenseService.getExpenseSummaryAsync();
      const categoryStats = await expenseService.getCategoryStatsAsync();
      this.setData({
        expenses,
        summary: {
          ...summary,
          totalAmountText: expenseService.formatMoney(summary.totalAmount),
          actualAmountText: expenseService.formatMoney(summary.actualAmount)
        },
        categoryStats: categoryStats.map((item) => ({
          ...item,
          amountText: expenseService.formatMoney(item.amount),
          actualAmountText: expenseService.formatMoney(item.actualAmount)
        })),
        budgetProgress: budgetService.getBudgetProgress()
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '加载消费记录失败',
        icon: 'none'
      });
    }
  },

  handleKeywordInput(event) {
    this.setData({
      keyword: event.detail.value
    });
    this.refreshPage();
  },

  handleFilterCategoryChange(event) {
    const filterCategoryIndex = Number(event.detail.value);
    this.setData({
      filterCategoryIndex,
      activeCategoryIndex: filterCategoryIndex
    });
    this.refreshPage();
  },

  handleCategoryTabChange(event) {
    const activeCategoryIndex = Number(event.currentTarget.dataset.index);
    this.setData({
      activeCategoryIndex,
      filterCategoryIndex: activeCategoryIndex
    });
    this.refreshPage();
  },

  handleShowActualAmountChange(event) {
    this.setData({
      showActualAmount: event.detail.value
    });
    this.refreshPage();
  },

  handleClearFilter() {
    this.setData({
      keyword: '',
      filterCategoryIndex: 0,
      activeCategoryIndex: 0
    });
    this.refreshPage();
  },

  handleOpenCreate() {
    const activeCategoryId = this.data.categoryTabs[this.data.activeCategoryIndex].id;
    const categoryIndex =
      activeCategoryId === 'all'
        ? 0
        : Math.max(this.data.categories.findIndex((item) => item.id === activeCategoryId), 0);
    const category = this.data.categories[categoryIndex];
    const firstSubType = (category.subTypes || [])[0] || {};
    const formData = {
      ...createDefaultFormData(),
      category: category.id,
      subType: firstSubType.id || '',
      itemName: category.id === 'meet' ? firstSubType.name || '' : '',
      amount: '',
      stageId: '',
      stageDate: '',
      priceTier: '',
      date: this.getToday()
    };
    this.applyFormState({
      formVisible: true,
      formMode: 'create',
      formTitle: '新增消费记录',
      formData,
      categoryIndex,
      subTypeIndex: 0,
      paymentMethodIndex: 0,
      purchaseChannelIndex: 0,
      pricingModeIndex: 0,
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
    const purchaseChannelIndex = Math.max(
      this.data.purchaseChannels.findIndex((item) => item.id === expense.purchaseChannel),
      0
    );
    const pricingModeIndex = Math.max(
      this.data.pricingModes.findIndex((item) => item.id === expense.pricingMode),
      0
    );
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
      purchaseChannelIndex,
      pricingModeIndex,
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
          city: matchedStage.city || formData.city,
          location: matchedStage.location || formData.location,
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
    const isCollection = category.id === 'collection';
    const isDirectCost = ['transport', 'accommodation', 'other'].includes(category.id);
    this.applyFormState({
      categoryIndex,
      subTypeIndex: 0,
      formData: {
        ...this.data.formData,
        category: category.id,
        subType: firstSubType.id,
        itemName: category.id === 'meet' ? firstSubType.name : '',
        amount: '',
        quantity: isCollection ? 1 : 1,
        stageId: '',
        stageDate: '',
        priceTier: '',
        collectionId: '',
        city: '',
        location: '',
        seat: '',
        purchaseChannel: isDirectCost ? 'none' : 'none',
        pricingMode: isDirectCost ? 'direct' : 'direct',
        referencePrice: '',
        unitPrice: '',
        expenseSource: 'manual'
      },
      purchaseChannelIndex: 0,
      pricingModeIndex: 0,
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

  handlePurchaseChannelChange(event) {
    const purchaseChannelIndex = Number(event.detail.value);
    const purchaseChannel = this.data.purchaseChannels[purchaseChannelIndex];
    this.setData({
      purchaseChannelIndex,
      'formData.purchaseChannel': purchaseChannel.id
    });
  },

  handlePricingModeChange(event) {
    const pricingModeIndex = Number(event.detail.value);
    const pricingMode = this.data.pricingModes[pricingModeIndex];
    this.setData({
      pricingModeIndex,
      'formData.pricingMode': pricingMode.id
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
          'formData.city': matchedStage.city || '',
          'formData.location': matchedStage.location || '',
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
        'formData.city': this.data.matchedMeetStageName ? '' : this.data.formData.city,
        'formData.location': this.data.matchedMeetStageName ? '' : this.data.formData.location,
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
      'formData.city': stage.city || '',
      'formData.location': stage.location || '',
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
    const isConcert = this.data.formData.category === 'meet' && this.data.formData.subType === 'concert';
    this.setData({
      'formData.outfieldOnly': outfieldOnly,
      'formData.includeInTotal': isConcert ? true : !outfieldOnly
    });
  },

  handleIncludeChange(event) {
    this.setData({
      'formData.includeInTotal': event.detail.value,
      'formData.outfieldOnly': !event.detail.value
    });
  },

  async handleItemSearchInput(event) {
    const searchKeyword = event.detail.value;
    const category = this.data.formData.category;
    if (category === 'collection') {
      this.setData({
        searchKeyword
      });
      if (!searchKeyword.trim()) {
        this.setData({
          searchResults: []
        });
        return;
      }
      try {
        const results = await collectionCatalogService.searchCollections(searchKeyword.trim());
        this.setData({
          searchResults: (results || []).slice(0, 8).map((item) => ({
            ...item,
            displayMeta: item.priceText || (
              item.referencePrice ? `参考价 ¥${item.referencePrice}` : '暂无参考价'
            )
          }))
        });
      } catch (error) {
        wx.showToast({
          title: error.message || '搜索藏品失败',
          icon: 'none'
        });
      }
      return;
    }
    this.setData({
      searchKeyword,
      searchResults: []
    });
  },

  handleSelectSearchItem(event) {
    const { id } = event.currentTarget.dataset;
    if (this.data.formData.category === 'collection') {
      const item = this.data.searchResults.find((candidate) => candidate.collectionId === id);
      if (!item) {
        return;
      }
      const referencePrice = item.referencePrice === null || typeof item.referencePrice === 'undefined'
        ? ''
        : String(item.referencePrice);
      const pricingMode = referencePrice ? 'official_unit' : 'direct';
      const pricingModeIndex = Math.max(
        this.data.pricingModes.findIndex((mode) => mode.id === pricingMode),
        0
      );
      this.setData({
        'formData.collectionId': item.collectionId,
        'formData.itemName': item.collectionName,
        'formData.referencePrice': referencePrice,
        'formData.amount': referencePrice,
        'formData.unitPrice': referencePrice,
        'formData.purchaseChannel': referencePrice ? 'official' : 'none',
        'formData.pricingMode': pricingMode,
        'formData.expenseSource': 'collection',
        searchKeyword: item.collectionName,
        searchResults: [],
        purchaseChannelIndex: referencePrice ? 1 : 0,
        pricingModeIndex
      });
      return;
    }
    return;
  },

  async handleSubmitForm() {
    const result =
      this.data.formMode === 'edit'
        ? await expenseService.updateExpenseAsync(this.data.formData.expenseId, this.data.formData)
        : await expenseService.addExpenseAsync(this.data.formData);

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
      confirmColor: '#9c4f00',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }
        try {
          await expenseService.removeExpenseAsync(expenseId);
          wx.showToast({
            title: '已删除',
            icon: 'success'
          });
          this.refreshPage();
        } catch (error) {
          wx.showToast({
            title: error.message || '删除失败',
            icon: 'none'
          });
        }
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
