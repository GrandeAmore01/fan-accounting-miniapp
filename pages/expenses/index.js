const expenseService = require('../../services/expenseService');
const budgetService = require('../../services/budgetService');
const collectionCatalogService = require('../../services/collectionCatalogService');

function inferMeetStageType(stage) {
  const name = `${stage.stageName || ''}${stage.name || ''}`;
  if (name.indexOf('新年音乐会') >= 0) {
    return 'new_year_concert';
  }
  if (name.indexOf('运动会') >= 0) {
    return 'sports_day';
  }
  return stage.stageType || 'concert';
}

function isMeetStageType(subType) {
  return ['concert', 'new_year_concert', 'sports_day'].includes(subType);
}

function getMeetStageLabel(subType) {
  const match = expenseService.getSubType('meet', subType);
  return match ? match.name : '见面';
}

function getPositivePriceTiers(stage) {
  return (stage.priceTiers || [])
    .map((price) => Number(price))
    .filter((price) => Number.isFinite(price) && price > 0);
}

function buildHighlightedSegments(text, keyword) {
  const source = String(text || '');
  const target = String(keyword || '').trim();
  if (!source || !target) {
    return [{ text: source, matched: false }];
  }
  const lowerSource = source.toLowerCase();
  const lowerTarget = target.toLowerCase();
  const segments = [];
  let cursor = 0;
  let index = lowerSource.indexOf(lowerTarget);
  while (index >= 0) {
    if (index > cursor) {
      segments.push({ text: source.slice(cursor, index), matched: false });
    }
    segments.push({ text: source.slice(index, index + target.length), matched: true });
    cursor = index + target.length;
    index = lowerSource.indexOf(lowerTarget, cursor);
  }
  if (cursor < source.length) {
    segments.push({ text: source.slice(cursor), matched: false });
  }
  return segments.length ? segments : [{ text: source, matched: false }];
}

function buildCollectionDetailText(item) {
  return [
    item.saleType,
    item.primaryCategory,
    item.secondaryCategory,
    item.productStyle,
    item.seriesName,
    item.priceNote
  ]
    .filter(Boolean)
    .join(' · ');
}

function buildCollectionPriceText(item) {
  return item.priceText || (
    item.referencePrice ? `参考价 ¥${item.referencePrice}` : '暂无参考价'
  );
}

function getSortDateValue(item) {
  return new Date(item.date || '1970-01-01').getTime();
}

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
    purchaseChannel: 'official',
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
    sortOptions: [
      { id: 'date_desc', name: '日期从新到旧' },
      { id: 'date_asc', name: '日期从旧到新' },
      { id: 'amount_desc', name: '总价格从高到低' },
      { id: 'amount_asc', name: '总价格从低到高' }
    ],
    sortIndex: 0,
    paymentMethods: ['微信支付', '支付宝', '银行卡', '现金', '其他'],
    purchaseChannels: [
      { id: 'official', name: '官方渠道' },
      { id: 'other', name: '其他渠道' }
    ],
    pricingModes: [
      { id: 'direct', name: '直接填写总金额' },
      { id: 'official_unit', name: '官方金额档位' },
      { id: 'total', name: '按总价记录' }
    ],
    purchaseChannelIndex: 0,
    pricingModeIndex: 0,
    concertStages: [],
    meetStages: [],
    concertStageIndex: 0,
    priceTiers: [],
    priceTierLabels: [],
    priceTierIndex: 0,
    matchedMeetStageName: '',
    searchKeyword: '',
    meetSearchKeyword: '',
    collectionSearchKeyword: '',
    selectedCollectionMeta: '',
    searchResults: [],
    stageDateOptions: [],
    stageDateLabels: [],
    stageDateIndex: 0,
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
      await this.loadMeetStages();
      const expenseList = await expenseService.filterExpensesAsync({
        category: filterCategory,
        keyword: this.data.keyword
      });
      const expenses = this.sortExpenseList(expenseList).map((item) => ({
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

  sortExpenseList(expenseList) {
    const sortOption = this.data.sortOptions[this.data.sortIndex] || this.data.sortOptions[0];
    return [...expenseList].sort((a, b) => {
      if (sortOption.id === 'date_asc') {
        return getSortDateValue(a) - getSortDateValue(b);
      }
      if (sortOption.id === 'amount_desc') {
        return Number(b.totalAmount || 0) - Number(a.totalAmount || 0);
      }
      if (sortOption.id === 'amount_asc') {
        return Number(a.totalAmount || 0) - Number(b.totalAmount || 0);
      }
      return getSortDateValue(b) - getSortDateValue(a);
    });
  },

  async loadMeetStages() {
    const meetStages = await expenseService.listMeetStagesAsync();
    this.setData({
      meetStages
    });
    return meetStages;
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

  handleSortChange(event) {
    this.setData({
      sortIndex: Number(event.detail.value)
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

  async handleOpenCreate() {
    await this.loadMeetStages();
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
      purchaseChannel: ['meet', 'collection'].includes(category.id) ? 'official' : 'none',
      pricingMode: ['meet', 'collection'].includes(category.id) ? 'official_unit' : 'direct',
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
      meetSearchKeyword: '',
      collectionSearchKeyword: '',
      selectedCollectionMeta: '',
      searchResults: [],
      stageDateOptions: [],
      stageDateLabels: [],
      stageDateIndex: 0
    });
  },

  async handleOpenEdit(event) {
    await this.loadMeetStages();
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
      meetSearchKeyword: '',
      collectionSearchKeyword: '',
      selectedCollectionMeta: '',
      searchResults: [],
      stageDateOptions: [],
      stageDateLabels: [],
      stageDateIndex: 0
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
    const isMeetStage = formData.category === 'meet' && isMeetStageType(formData.subType);
    const concertStages = (this.data.meetStages || []).filter((item) => (
      inferMeetStageType(item) === formData.subType
    ));
    const isDateMatchedMeet =
      isMeetStage && Boolean(formData.stageDate);
    const matchedStage =
      isDateMatchedMeet
        ? concertStages.find((item) => item.date === formData.stageDate)
        : null;
    const concertStageIndex = matchedStage
      ? Math.max(concertStages.findIndex((item) => item.stageId === matchedStage.stageId), 0)
      : 0;
    const priceTiers = matchedStage ? getPositivePriceTiers(matchedStage) : [];
    const priceTierLabels = priceTiers.map((price) => `${price} 元`);
    const priceTierIndex = Math.max(priceTiers.findIndex((price) => String(price) === String(formData.priceTier)), 0);
    const shouldAutoFillStage =
      formData.category === 'meet' &&
      isMeetStage &&
      matchedStage &&
      formData.stageId !== matchedStage.stageId;
    const shouldUseOfficialTier = formData.category === 'meet' && formData.purchaseChannel === 'official';
    const nextFormData = shouldAutoFillStage
      ? {
          ...formData,
          stageId: matchedStage.stageId,
          stageDate: matchedStage.date,
          itemName: matchedStage.stageName,
          city: matchedStage.city || formData.city,
          location: matchedStage.location || formData.location,
          amount: shouldUseOfficialTier && priceTiers.length ? String(priceTiers[0]) : formData.amount,
          priceTier: priceTiers.length ? String(priceTiers[0]) : ''
        }
      : matchedStage
        ? formData
        : {
            ...formData,
            stageId: '',
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

  handleCategoryChange(event) {
    const categoryIndex = Number(event.detail.value);
    const category = this.data.categories[categoryIndex];
    const firstSubType = category.subTypes[0];
    const isCollection = category.id === 'collection';
    const isDirectCost = ['transport', 'accommodation', 'other'].includes(category.id);
    const hasPurchaseChannel = ['meet', 'collection'].includes(category.id);
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
        purchaseChannel: hasPurchaseChannel ? 'official' : isDirectCost ? 'none' : 'none',
        pricingMode: hasPurchaseChannel ? 'official_unit' : 'direct',
        referencePrice: '',
        unitPrice: '',
        expenseSource: 'manual'
      },
      purchaseChannelIndex: 0,
      pricingModeIndex: 0,
      searchKeyword: '',
      meetSearchKeyword: '',
      collectionSearchKeyword: '',
      selectedCollectionMeta: '',
      searchResults: [],
      stageDateOptions: [],
      stageDateLabels: [],
      stageDateIndex: 0
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
        itemName: this.data.formData.category === 'meet' ? subType.name : this.data.formData.itemName,
        stageId: '',
        stageDate: '',
        priceTier: '',
        amount: this.data.formData.category === 'meet' ? '' : this.data.formData.amount
      }
    ,
      searchKeyword: '',
      meetSearchKeyword: '',
      collectionSearchKeyword: '',
      selectedCollectionMeta: '',
      searchResults: [],
      stageDateOptions: [],
      stageDateLabels: [],
      stageDateIndex: 0
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
    const isMeet = this.data.formData.category === 'meet';
    const hasPriceTier = this.data.priceTiers.length > 0;
    const pricingMode = isMeet && purchaseChannel.id === 'official' && hasPriceTier ? 'official_unit' : 'total';
    const pricingModeIndex = Math.max(
      this.data.pricingModes.findIndex((item) => item.id === pricingMode),
      0
    );
    this.setData({
      purchaseChannelIndex,
      pricingModeIndex,
      'formData.purchaseChannel': purchaseChannel.id,
      'formData.pricingMode': pricingMode,
      'formData.amount': isMeet && purchaseChannel.id === 'official' && hasPriceTier ? this.data.formData.priceTier : ''
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
    this.setData({
      'formData.date': date
    });
  },

  handleMeetDateChange(event) {
    const date = event.detail.value;
    if (this.data.formData.category === 'meet' && isMeetStageType(this.data.formData.subType)) {
      const matchedStage =
        (this.data.meetStages || []).find((item) => (
          inferMeetStageType(item) === this.data.formData.subType && item.date === date
        )) ||
        (this.data.meetStages || []).find((item) => item.date === date);
      if (matchedStage) {
        this.applySelectedMeetStage(matchedStage, {
          stageDateOptions: [],
          stageDateLabels: [],
          stageDateIndex: 0
        });
        return;
      }

      const fallbackName = getMeetStageLabel(this.data.formData.subType);
      this.setData({
        'formData.stageId': '',
        'formData.stageDate': date,
        'formData.itemName': this.data.matchedMeetStageName ? fallbackName : this.data.formData.itemName || fallbackName,
        'formData.city': this.data.matchedMeetStageName ? '' : this.data.formData.city,
        'formData.location': this.data.matchedMeetStageName ? '' : this.data.formData.location,
        'formData.amount': this.data.formData.purchaseChannel === 'official' ? '' : this.data.formData.amount,
        'formData.priceTier': '',
        priceTiers: [],
        priceTierLabels: [],
        priceTierIndex: 0,
        matchedMeetStageName: '',
        stageDateOptions: [],
        stageDateLabels: [],
        stageDateIndex: 0
      });
      return;
    }
  },

  handleConcertStageChange(event) {
    const concertStageIndex = Number(event.detail.value);
    const stage = this.data.concertStages[concertStageIndex];
    this.applySelectedMeetStage(stage, { concertStageIndex });
  },

  handleStageDateOptionChange(event) {
    const stageDateIndex = Number(event.detail.value);
    const stage = this.data.stageDateOptions[stageDateIndex];
    if (!stage) {
      return;
    }
    this.applySelectedMeetStage(stage, { stageDateIndex });
  },

  applySelectedMeetStage(stage, extraState = {}) {
    const priceTiers = getPositivePriceTiers(stage);
    const priceTierLabels = priceTiers.map((price) => `${price} 元`);
    const shouldUseOfficialTier = this.data.formData.purchaseChannel === 'official';
    const stageType = inferMeetStageType(stage);
    const category = this.data.categories[this.data.categoryIndex] || {};
    const subTypes = category.subTypes || [];
    const subTypeIndex = Math.max(subTypes.findIndex((item) => item.id === stageType), 0);
    const concertStages = (this.data.meetStages || []).filter((item) => (
      inferMeetStageType(item) === stageType
    ));
    this.setData({
      ...extraState,
      subTypeIndex,
      concertStages,
      concertStageIndex: Math.max(
        concertStages.findIndex((item) => item.stageId === stage.stageId),
        0
      ),
      priceTiers,
      priceTierLabels,
      priceTierIndex: 0,
      matchedMeetStageName: stage.stageName,
      searchKeyword: stage.stageName,
      meetSearchKeyword: stage.stageName || '',
      searchResults: [],
      'formData.subType': stageType,
      'formData.stageId': stage.stageId,
      'formData.stageDate': stage.date,
      'formData.itemName': stage.stageName,
      'formData.city': stage.city || '',
      'formData.location': stage.venue || stage.location || '',
      'formData.amount': shouldUseOfficialTier && priceTiers.length ? String(priceTiers[0]) : '',
      'formData.priceTier': priceTiers.length ? String(priceTiers[0]) : '',
      'formData.pricingMode': shouldUseOfficialTier && priceTiers.length ? 'official_unit' : 'total'
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
      'formData.amount': this.data.formData.purchaseChannel === 'official' ? String(priceTier) : this.data.formData.amount,
      'formData.priceTier': String(priceTier)
    });
  },

  handleIncludeChange(event) {
    this.setData({
      'formData.includeInTotal': event.detail.value
    });
  },

  handleItemSearchInput(event) {
    const rawValue =
      event &&
      event.detail &&
      typeof event.detail.value !== 'undefined'
        ? String(event.detail.value)
        : '';
    const searchKeyword = rawValue === 'undefined' ? '' : rawValue;
    const category = this.data.formData.category;
    const searchType = event.currentTarget.dataset.searchType || category;
    if (searchType === 'meet') {
      this.setData({
        searchKeyword,
        meetSearchKeyword: searchKeyword
      });
      const keyword = searchKeyword.trim();
      if (!keyword) {
        this.setData({
          searchResults: []
        });
        return searchKeyword;
      }
      const stageGroups = [];
      const stageGroupMap = {};
      (this.data.meetStages || [])
        .filter((stage) => String(stage.stageName || '').indexOf(keyword) >= 0)
        .forEach((stage) => {
          const key = stage.stageName || stage.stageId;
          if (!stageGroupMap[key]) {
            stageGroupMap[key] = {
              id: key,
              type: 'stage',
              stageName: stage.stageName,
              highlightSegments: buildHighlightedSegments(stage.stageName, keyword),
              displayMeta: `${getMeetStageLabel(inferMeetStageType(stage))} · ${stage.city || ''} · ${stage.venue || stage.location || ''}`,
              stages: []
            };
            stageGroups.push(stageGroupMap[key]);
          }
          stageGroupMap[key].stages.push(stage);
        });
      this.setData({
        searchResults: stageGroups.slice(0, 8)
      });
      return searchKeyword;
    }
    if (searchType === 'collection') {
      this.setData({
        searchKeyword,
        collectionSearchKeyword: searchKeyword
      });
      if (!searchKeyword.trim()) {
        this.setData({
          searchResults: []
        });
        return searchKeyword;
      }
      collectionCatalogService.searchCollections(searchKeyword.trim())
        .then((results) => {
          if (this.data.collectionSearchKeyword !== searchKeyword) {
            return;
          }
          this.setData({
          searchResults: (results || []).slice(0, 8).map((item) => ({
            ...item,
            type: 'collection',
            highlightSegments: buildHighlightedSegments(item.collectionName, searchKeyword.trim()),
            detailText: buildCollectionDetailText(item),
            detailSegments: buildHighlightedSegments(buildCollectionDetailText(item), searchKeyword.trim()),
            priceDisplayText: buildCollectionPriceText(item)
          }))
          });
        })
        .catch((error) => {
          if (this.data.collectionSearchKeyword !== searchKeyword) {
            return;
          }
          wx.showToast({
            title: error.message || '搜索藏品失败',
            icon: 'none'
          });
        });
      return searchKeyword;
    }
    this.setData({
      searchResults: []
    });
    return searchKeyword;
  },

  handleSelectSearchItem(event) {
    const { id } = event.currentTarget.dataset;
    if (this.data.formData.category === 'meet') {
      const group = this.data.searchResults.find((candidate) => candidate.id === id);
      if (!group) {
        return;
      }
      const stageDateOptions = group.stages || [];
      const stageDateLabels = stageDateOptions.map((stage) => `${stage.date} ${stage.city || ''} ${stage.venue || stage.location || ''}`);
      const firstStage = stageDateOptions[0];
      if (!firstStage) {
        return;
      }
      this.setData({
        stageDateOptions,
        stageDateLabels,
        stageDateIndex: 0
      });
      this.applySelectedMeetStage(firstStage, {
        stageDateOptions,
        stageDateLabels,
        stageDateIndex: 0,
        meetSearchKeyword: firstStage.stageName || ''
      });
      return;
    }
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
        searchKeyword: item.collectionName || '',
        collectionSearchKeyword: item.collectionName || '',
        selectedCollectionMeta: [buildCollectionDetailText(item), buildCollectionPriceText(item)]
          .filter(Boolean)
          .join(' · '),
        searchResults: [],
        purchaseChannelIndex: referencePrice ? 0 : 1,
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
