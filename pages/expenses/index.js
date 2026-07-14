const expenseService = require('../../services/expenseService');
const budgetService = require('../../services/budgetService');
const collectionCatalogService = require('../../services/collectionCatalogService');
const stageService = require('../../services/stageService');

const PENDING_COLLECTION_DRAFT_KEY = 'pendingCollectionExpenseDraft';
const PENDING_STAGE_DRAFT_KEY = 'pendingStageExpenseDraft';
const PENDING_COLLECTION_DRAFT_MAX_AGE = 10 * 60 * 1000;
const MAX_SEARCH_LENGTH = 40;
const MAX_NAME_LENGTH = 80;
const MAX_TEXT_LENGTH = 120;
const MAX_REMARK_LENGTH = 160;
const MAX_CUSTOM_TAG_LENGTH = 12;
const MAX_AMOUNT = 1000000;
const MAX_COLLECTION_QUANTITY = 100;
const REMARK_PREVIEW_LENGTH = 42;
const MEET_BUNDLE_PREFIX = 'mb:';

const TEXT_FIELD_LIMITS = {
  itemName: MAX_NAME_LENGTH,
  city: MAX_TEXT_LENGTH,
  location: MAX_TEXT_LENGTH,
  seat: MAX_TEXT_LENGTH,
  remark: MAX_REMARK_LENGTH
};

const TEXT_FIELD_NAMES = {
  itemName: '\u9879\u76ee\u540d\u79f0',
  city: '\u57ce\u5e02',
  location: '\u5730\u70b9',
  seat: '\u5ea7\u4f4d',
  remark: '\u5907\u6ce8'
};

const QUICK_REMARK_TAGS = {
  meet: ['官票', '二级票务', '抢票', '补款', '尾款', '同行', '应援'],
  transport: ['高铁', '飞机', '打车', '地铁', '拼车', '往返'],
  accommodation: ['酒店', '民宿', '拼房', '定金', '尾款', '连住'],
  collection: ['官方', '现货', '预售', '补款', '代购', '运费', '周边', '应援物'],
  other: ['餐饮', '寄存', '手续费', '临时支出']
};

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
    expectedCity: '',
    expectedLocation: '',
    includeTransportCost: false,
    transportAmount: '',
    includeAccommodationCost: false,
    accommodationAmount: '',
    bundledTransportExpenseId: '',
    bundledAccommodationExpenseId: '',
    expenseSource: 'manual'
  };
}

function parseMeetBundleSource(expenseSource = '') {
  const source = String(expenseSource || '');
  if (!source.startsWith(MEET_BUNDLE_PREFIX)) {
    return null;
  }
  const parts = source.split(':');
  if (parts.length < 3) {
    return null;
  }
  return {
    bundleId: parts[1],
    role: parts[2]
  };
}

function getBundleRoleName(role) {
  if (role === 'ticket') {
    return '门票';
  }
  if (role === 'transport') {
    return '交通';
  }
  if (role === 'accommodation') {
    return '住宿';
  }
  return '关联';
}

function getRemarkTagText(tag) {
  return `#${String(tag || '').replace(/^#/, '').trim()}`;
}

function parseRemarkParts(remark = '') {
  const source = String(remark || '');
  const tags = [];
  const text = source.replace(/#[^\s#]+/g, (match) => {
    const tag = match.replace(/^#/, '').trim();
    if (tag && !tags.includes(tag)) {
      tags.push(tag);
    }
    return ' ';
  }).replace(/\s+/g, ' ').trim();
  return { tags, text };
}

function composeRemark(tags = [], text = '') {
  const tagText = tags
    .map((tag) => getRemarkTagText(tag))
    .filter((tag) => tag !== '#')
    .join(' ');
  return [tagText, String(text || '').trim()].filter(Boolean).join(' ').trim();
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
    mergeMeetRelatedInAll: false,
    expenseDisplayCache: [],
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
    meetSearchFocused: false,
    collectionSearchKeyword: '',
    selectedCollectionMeta: '',
    searchResults: [],
    expandedRemarkMap: {},
    quickRemarkTags: [],
    selectedRemarkTags: [],
    formRemarkText: '',
    remarkLimitHint: `备注最多 ${MAX_REMARK_LENGTH} 字，超过后将不再继续输入`,
    customRemarkTag: '',
    deleteConfirmVisible: false,
    deleteSubmitting: false,
    deleteCurrentExpense: null,
    deleteLinkedItems: [],
    deleteLinkedText: '',
    deleteWithLinked: false,
    stageDateOptions: [],
    stageDateLabels: [],
    stageDateIndex: 0,
    formVisible: false,
    formMode: 'create',
    formSubmitting: false,
    formTitle: '新增消费记录',
    formErrors: {},
    formWarnings: {},
    focusedWarningField: '',
    formTouched: false,
    formData: createDefaultFormData(),
    today: '',
    expenseDateEnd: '',
    categoryIndex: 0,
    subTypeIndex: 0,
    showSubTypePicker: true,
    subTypeLabel: '',
    paymentMethodIndex: 0,
    summary: {
      totalAmount: 0,
      count: 0
    },
    activeSummary: {
      name: '全部消费',
      amountText: '0.00',
      actualAmountText: '0.00',
      count: 0
    },
    categoryStats: [],
    budgetProgress: {
      percent: 0
    }
  },

  async onShow() {
    const today = this.getToday();
    this.setData({
      today,
      expenseDateEnd: this.getExpenseDateEnd(this.data.formData, today)
    });
    await this.refreshPage();
    await this.openPendingCollectionExpenseDraft();
    await this.openPendingStageExpenseDraft();
  },

  async refreshPage() {
    const filterCategory = this.data.categoryTabs[this.data.activeCategoryIndex].id;
    try {
      await this.loadMeetStages();
      const expenseList = await expenseService.filterExpensesAsync({
        category: filterCategory,
        keyword: this.data.keyword
      });
      const sortedExpenseList = this.sortExpenseList(expenseList);
      const decoratedExpenses = this.getDecoratedExpenses(sortedExpenseList);
      const expenses = this.getDisplayExpenses(decoratedExpenses, filterCategory);
      const summary = await expenseService.getExpenseSummaryAsync();
      const categoryStats = await expenseService.getCategoryStatsAsync();
      const nextCategoryStats = categoryStats.map((item) => ({
        ...item,
        amountText: expenseService.formatMoney(item.amount),
        actualAmountText: expenseService.formatMoney(item.actualAmount)
      }));
      const activeSummary = nextCategoryStats[this.data.activeCategoryIndex] || nextCategoryStats[0] || {
        name: '全部消费',
        amountText: '0.00',
        actualAmountText: '0.00',
        count: 0
      };
      this.setData({
        expenseDisplayCache: sortedExpenseList,
        expenses,
        summary: {
          ...summary,
          totalAmountText: expenseService.formatMoney(summary.totalAmount),
          actualAmountText: expenseService.formatMoney(summary.actualAmount)
        },
        activeSummary,
        categoryStats: nextCategoryStats,
        budgetProgress: budgetService.getBudgetProgress()
      });
    } catch (error) {
      wx.showToast({
        title: this.getFriendlyErrorMessage(error, '加载消费记录失败'),
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

  decorateExpenseItem(item) {
    const bundleMeta = parseMeetBundleSource(item.expenseSource);
    return {
      ...item,
      bundleMeta,
      bundleRoleName: getBundleRoleName((bundleMeta || {}).role),
      bundleLinkTags: [],
      hasMeetBundleLink: false,
      remarkTags: parseRemarkParts(item.remark).tags,
      includedAmountText: expenseService.formatMoney(item.includedAmount),
      totalAmountText: expenseService.formatMoney(item.totalAmount),
      displayAmountLabel: this.data.showActualAmount ? '实际' : '计入',
      displayAmountText: expenseService.formatMoney(
        this.data.showActualAmount ? item.totalAmount : item.includedAmount
      ),
      remarkExpanded: Boolean(this.data.expandedRemarkMap[item.expenseId]),
      remarkCanExpand: parseRemarkParts(item.remark).text.length > REMARK_PREVIEW_LENGTH,
      remarkDisplayText:
        parseRemarkParts(item.remark).text.length > REMARK_PREVIEW_LENGTH &&
        !this.data.expandedRemarkMap[item.expenseId]
          ? `${parseRemarkParts(item.remark).text.slice(0, REMARK_PREVIEW_LENGTH)}...`
          : parseRemarkParts(item.remark).text,
      metaText: [item.date, item.city, item.location, item.seat].filter(Boolean).join(' · ')
    };
  },

  getDecoratedExpenses(expenseList) {
    const decoratedExpenses = expenseList.map((item) => this.decorateExpenseItem(item));
    const bundleMap = {};
    decoratedExpenses.forEach((item) => {
      const bundleMeta = item.bundleMeta;
      if (!bundleMeta || !bundleMeta.bundleId) {
        return;
      }
      if (!bundleMap[bundleMeta.bundleId]) {
        bundleMap[bundleMeta.bundleId] = [];
      }
      bundleMap[bundleMeta.bundleId].push(item);
    });
    return decoratedExpenses.map((item) => {
      const bundleMeta = item.bundleMeta;
      if (!bundleMeta || !bundleMeta.bundleId) {
        return item;
      }
      const bundleItems = bundleMap[bundleMeta.bundleId] || [];
      const linkedRoles = bundleItems
        .map((entry) => entry.bundleMeta && entry.bundleMeta.role)
        .filter((role) => role && role !== bundleMeta.role);
      const bundleLinkTags = bundleMeta.role === 'ticket'
        ? linkedRoles
            .filter((role) => role === 'transport' || role === 'accommodation')
            .map((role) => `已关联${getBundleRoleName(role)}`)
        : ['已关联见面'];
      return {
        ...item,
        bundleLinkTags,
        hasMeetBundleLink: bundleLinkTags.length > 0
      };
    });
  },

  refreshDisplayExpensesFromCache() {
    const filterCategory = this.data.categoryTabs[this.data.activeCategoryIndex].id;
    const decoratedExpenses = this.getDecoratedExpenses(this.data.expenseDisplayCache || []);
    this.setData({
      expenses: this.getDisplayExpenses(decoratedExpenses, filterCategory)
    });
  },

  getDisplayExpenses(expenses, filterCategory) {
    if (filterCategory !== 'all' || !this.data.mergeMeetRelatedInAll) {
      return expenses;
    }
    const bundleMap = {};
    const result = [];
    expenses.forEach((item) => {
      const bundleMeta = item.bundleMeta;
      if (!bundleMeta || !bundleMeta.bundleId) {
        result.push(item);
        return;
      }
      if (!bundleMap[bundleMeta.bundleId]) {
        bundleMap[bundleMeta.bundleId] = [];
        result.push({
          ...item,
          expenseId: `bundle_${bundleMeta.bundleId}`,
          isCombinedBundle: true,
          bundleId: bundleMeta.bundleId,
          bundleItems: bundleMap[bundleMeta.bundleId]
        });
      }
      bundleMap[bundleMeta.bundleId].push(item);
    });

    return result.map((item) => {
      if (!item.isCombinedBundle) {
        return item;
      }
      const bundleItems = item.bundleItems || [];
      const ticket = bundleItems.find((entry) => entry.bundleMeta && entry.bundleMeta.role === 'ticket') || bundleItems[0];
      const totalAmount = bundleItems.reduce((sum, entry) => sum + Number(entry.totalAmount || 0), 0);
      const includedAmount = bundleItems.reduce((sum, entry) => sum + Number(entry.includedAmount || 0), 0);
      const roles = bundleItems
        .map((entry) => getBundleRoleName(entry.bundleMeta && entry.bundleMeta.role))
        .filter(Boolean);
      return {
        ...item,
        itemName: ticket ? ticket.itemName : item.itemName,
        categoryName: '合并见面消费',
        totalAmount,
        includedAmount,
        displayAmountLabel: this.data.showActualAmount ? '实际' : '计入',
        displayAmountText: expenseService.formatMoney(
          this.data.showActualAmount ? totalAmount : includedAmount
        ),
        totalAmountText: expenseService.formatMoney(totalAmount),
        includedAmountText: expenseService.formatMoney(includedAmount),
        metaText: [ticket && ticket.stageDate, ticket && ticket.city, ticket && ticket.location]
          .filter(Boolean)
          .join(' · '),
        remarkDisplayText: `已合并：${roles.join('、')}`,
        remarkCanExpand: false,
        feeTags: bundleItems.map((entry) => ({
          key: entry.expenseId,
          label: getBundleRoleName(entry.bundleMeta && entry.bundleMeta.role),
          amount: this.data.showActualAmount ? entry.totalAmount : entry.includedAmount,
          amountText: expenseService.formatMoney(
            this.data.showActualAmount ? entry.totalAmount : entry.includedAmount
          )
        }))
      };
    });
  },

  async loadMeetStages() {
    try {
      const meetStages = await expenseService.listMeetStagesAsync();
      this.setData({
        meetStages
      });
      return meetStages;
    } catch (error) {
      wx.showToast({
        title: '场次加载超时，可手动填写',
        icon: 'none'
      });
      return this.data.meetStages || [];
    }
  },

  async openPendingCollectionExpenseDraft() {
    const draft = wx.getStorageSync(PENDING_COLLECTION_DRAFT_KEY);
    if (!draft || !draft.collectionId) {
      return;
    }
    wx.removeStorageSync(PENDING_COLLECTION_DRAFT_KEY);

    if (Date.now() - Number(draft.createdAt || 0) > PENDING_COLLECTION_DRAFT_MAX_AGE) {
      wx.showToast({
        title: '藏品信息加载失败，请重新尝试',
        icon: 'none'
      });
      return;
    }

    try {
      const collection = await collectionCatalogService.getCollection(draft.collectionId);
      this.openCollectionExpenseDraft(collection);
    } catch (error) {
      wx.showToast({
        title: this.getFriendlyErrorMessage(error, '藏品信息加载失败，请重新尝试'),
        icon: 'none'
      });
    }
  },

  async openPendingStageExpenseDraft() {
    const draft = wx.getStorageSync(PENDING_STAGE_DRAFT_KEY);
    if (!draft || !draft.stageId) {
      return;
    }
    wx.removeStorageSync(PENDING_STAGE_DRAFT_KEY);

    if (Date.now() - Number(draft.createdAt || 0) > PENDING_COLLECTION_DRAFT_MAX_AGE) {
      wx.showToast({
        title: '场次信息加载失败，请重新尝试',
        icon: 'none'
      });
      return;
    }

    try {
      const meetStages = await this.loadMeetStages();
      let stage = (meetStages || []).find((item) => item.stageId === draft.stageId);
      if (!stage) {
        await stageService.ensureStagesLoaded();
        const cached = stageService.getStageById(draft.stageId);
        if (cached) {
          stage = {
            stageId: cached.stageId,
            stageName: cached.stageName,
            stageType: inferMeetStageType(cached),
            date: cached.date,
            city: cached.cityName || cached.city || '',
            venue: cached.venueName || cached.venue || '',
            location: cached.venueName || cached.location || '',
            priceTiers: cached.priceTiers || []
          };
        }
      }
      if (!stage) {
        throw new Error('场次信息加载失败，请重新尝试');
      }
      this.openStageExpenseDraft(stage);
    } catch (error) {
      wx.showToast({
        title: this.getFriendlyErrorMessage(error, '场次信息加载失败，请重新尝试'),
        icon: 'none'
      });
    }
  },

  handleKeywordInput(event) {
    const nextKeyword = this.limitPlainText(
      event.detail.value,
      this.data.keyword,
      MAX_SEARCH_LENGTH,
      '\u641c\u7d22\u5173\u952e\u8bcd'
    );
    this.setData({
      keyword: nextKeyword
    });
    this.refreshPage();
    return nextKeyword;
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
    this.refreshDisplayExpensesFromCache();
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
    wx.showLoading({
      title: '正在打开',
      mask: true
    });
    try {
      await this.loadMeetStages();
    } finally {
      wx.hideLoading();
    }
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
      formTouched: true,
      formData,
      categoryIndex,
      subTypeIndex: 0,
      paymentMethodIndex: 0,
      purchaseChannelIndex: 0,
      pricingModeIndex: 0,
      searchKeyword: '',
      meetSearchKeyword: '',
      meetSearchFocused: false,
      collectionSearchKeyword: '',
      selectedCollectionMeta: '',
      searchResults: [],
      stageDateOptions: [],
      stageDateLabels: [],
      stageDateIndex: 0
    });
  },

  openCollectionExpenseDraft(collection) {
    const categoryIndex = Math.max(
      this.data.categories.findIndex((item) => item.id === 'collection'),
      0
    );
    const category = this.data.categories[categoryIndex];
    const subType = expenseService.inferCollectionSubType(collection);
    const subTypeIndex = Math.max(
      (category.subTypes || []).findIndex((item) => item.id === subType),
      0
    );
    const referencePrice = collection.referencePrice === null ||
      typeof collection.referencePrice === 'undefined'
        ? ''
        : String(collection.referencePrice);

    this.applyFormState({
      formVisible: true,
      formMode: 'create',
      formTitle: '新增消费记录',
      formTouched: true,
      formData: {
        ...createDefaultFormData(),
        category: 'collection',
        subType: (category.subTypes[subTypeIndex] || {}).id || subType,
        itemName: collection.collectionName || '',
        amount: referencePrice,
        quantity: 1,
        date: this.getToday(),
        collectionId: collection.collectionId || '',
        referencePrice,
        unitPrice: referencePrice,
        expenseSource: 'collection',
        purchaseChannel: 'official',
        pricingMode: 'official_unit'
      },
      categoryIndex,
      subTypeIndex,
      paymentMethodIndex: 0,
      purchaseChannelIndex: 0,
      pricingModeIndex: 0,
      searchKeyword: collection.collectionName || '',
      meetSearchKeyword: '',
      meetSearchFocused: false,
      collectionSearchKeyword: collection.collectionName || '',
      selectedCollectionMeta: [buildCollectionDetailText(collection), buildCollectionPriceText(collection)]
        .filter(Boolean)
        .join(' · '),
      searchResults: [],
      stageDateOptions: [],
      stageDateLabels: [],
      stageDateIndex: 0
    });
  },

  openStageExpenseDraft(stage) {
    const categoryIndex = Math.max(
      this.data.categories.findIndex((item) => item.id === 'meet'),
      0
    );
    const formData = {
      ...createDefaultFormData(),
      category: 'meet',
      subType: inferMeetStageType(stage),
      date: this.getToday(),
      purchaseChannel: 'official',
      pricingMode: 'official_unit'
    };
    this.applyFormState({
      formVisible: true,
      formMode: 'create',
      formTitle: '新增消费记录',
      formTouched: true,
      formData,
      categoryIndex,
      subTypeIndex: 0,
      paymentMethodIndex: 0,
      purchaseChannelIndex: 0,
      pricingModeIndex: 0,
      searchKeyword: '',
      meetSearchKeyword: '',
      meetSearchFocused: false,
      collectionSearchKeyword: '',
      selectedCollectionMeta: '',
      searchResults: [],
      stageDateOptions: [],
      stageDateLabels: [],
      stageDateIndex: 0
    });
    this.applySelectedMeetStage(stage);
  },

  async handleOpenEdit(event) {
    await this.loadMeetStages();
    const expenseId = event.currentTarget.dataset.id;
    const selectedExpense = this.data.expenses.find((item) => item.expenseId === expenseId);
    const expense = selectedExpense && selectedExpense.isCombinedBundle
      ? (selectedExpense.bundleItems || []).find((item) => item.bundleMeta && item.bundleMeta.role === 'ticket') ||
        (selectedExpense.bundleItems || [])[0]
      : selectedExpense;
    if (!expense) {
      wx.showToast({
        title: '记录不存在',
        icon: 'none'
      });
      return;
    }
    const bundleMeta = selectedExpense && selectedExpense.isCombinedBundle
      ? { role: 'ticket', bundleId: selectedExpense.bundleId }
      : parseMeetBundleSource(expense.expenseSource);
    const relatedBundleItems = selectedExpense && selectedExpense.isCombinedBundle
      ? (selectedExpense.bundleItems || [])
      : bundleMeta && bundleMeta.bundleId && bundleMeta.role === 'ticket'
        ? this.getDecoratedExpenses(this.data.expenseDisplayCache || []).filter((item) => (
            item.bundleMeta && item.bundleMeta.bundleId === bundleMeta.bundleId
          ))
        : [];
    const transportExpense = relatedBundleItems.find((item) => item.bundleMeta && item.bundleMeta.role === 'transport') || null;
    const accommodationExpense = relatedBundleItems.find((item) => item.bundleMeta && item.bundleMeta.role === 'accommodation') || null;
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
    const matchedStage = expense.category === 'meet' && expense.stageId
      ? (this.data.meetStages || []).find((item) => item.stageId === expense.stageId)
      : null;
    this.applyFormState({
      formVisible: true,
      formMode: relatedBundleItems.length && bundleMeta && bundleMeta.role === 'ticket' ? 'edit_bundle' : 'edit',
      formTitle: '编辑消费记录',
      formTouched: true,
      formData: {
        ...createDefaultFormData(),
        ...expense,
        expectedCity: expense.expectedCity || (matchedStage && matchedStage.city) || '',
        expectedLocation: expense.expectedLocation || (matchedStage && matchedStage.location) || '',
        amount: String(expense.amount || ''),
        quantity: String(expense.quantity || 1),
        includeTransportCost: Boolean(transportExpense),
        transportAmount: transportExpense ? String(transportExpense.amount || '') : '',
        includeAccommodationCost: Boolean(accommodationExpense),
        accommodationAmount: accommodationExpense ? String(accommodationExpense.amount || '') : '',
        bundledTransportExpenseId: transportExpense ? transportExpense.expenseId : '',
        bundledAccommodationExpenseId: accommodationExpense ? accommodationExpense.expenseId : '',
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
      meetSearchFocused: false,
      focusedWarningField: '',
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
    let nextFormData = shouldAutoFillStage
      ? {
          ...formData,
          stageId: matchedStage.stageId,
          stageDate: matchedStage.date,
          itemName: matchedStage.stageName,
          city: matchedStage.city || formData.city,
          location: matchedStage.location || formData.location,
          expectedCity: matchedStage.city || '',
          expectedLocation: matchedStage.location || '',
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
    const today = this.data.today || this.getToday();
    const expenseDateEnd = this.getExpenseDateEnd(nextFormData, today);
    if (nextFormData.date && nextFormData.date > expenseDateEnd) {
      nextFormData = {
        ...nextFormData,
        date: expenseDateEnd
      };
    }
    const nextFormTouched =
      typeof nextState.formTouched === 'boolean'
        ? nextState.formTouched
        : this.data.formTouched;
    const nextFormErrors =
      typeof nextState.formErrors !== 'undefined'
        ? nextState.formErrors
        : nextFormTouched
          ? this.getFormErrors(nextFormData)
          : {};

    this.setData({
      ...nextState,
      today,
      expenseDateEnd,
      formData: nextFormData,
      formTouched: nextFormTouched,
      formErrors: nextFormErrors,
      formWarnings: nextFormTouched ? this.getFormWarnings(nextFormData) : {},
      categoryIndex: safeCategoryIndex,
      subTypes,
      subTypeIndex: safeSubTypeIndex,
      showSubTypePicker: !['transport', 'accommodation', 'other'].includes(category.id),
      subTypeLabel: this.getSubTypeLabel(category.id),
      quickRemarkTags: this.getQuickRemarkTags(category.id, nextFormData.remark),
      selectedRemarkTags: Array.isArray(nextState.selectedRemarkTags)
        ? nextState.selectedRemarkTags
        : parseRemarkParts(nextFormData.remark).tags,
      formRemarkText: typeof nextState.formRemarkText === 'string'
        ? nextState.formRemarkText
        : parseRemarkParts(nextFormData.remark).text,
      customRemarkTag: typeof nextState.customRemarkTag === 'string' ? nextState.customRemarkTag : '',
      concertStages,
      concertStageIndex,
        priceTiers,
        priceTierLabels,
      priceTierIndex,
      matchedMeetStageName: matchedStage ? matchedStage.stageName : ''
    });
  },

  handleCloseForm() {
    if (this.data.formSubmitting) {
      return;
    }
    this.setData({
      formVisible: false
    });
  },

  handleFormInput(event) {
    const field = event.currentTarget.dataset.field;
    if (field === 'remark') {
      const composedRemark = composeRemark(this.data.selectedRemarkTags, event.detail.value);
      if (composedRemark.length >= MAX_REMARK_LENGTH) {
        this.showInputLimitToast(`备注最多 ${MAX_REMARK_LENGTH} 字`);
      }
      const safeRemark = this.sanitizeFormInput('remark', composedRemark);
      const remarkParts = parseRemarkParts(safeRemark);
      const formData = {
        ...this.data.formData,
        remark: safeRemark
      };
      this.setData({
        formTouched: true,
        formData,
        formRemarkText: remarkParts.text,
        selectedRemarkTags: remarkParts.tags,
        formErrors: this.getFormErrors(formData),
        formWarnings: this.getFormWarnings(formData),
        quickRemarkTags: this.getQuickRemarkTags(formData.category, formData.remark)
      });
      return undefined;
    }
    const value = this.sanitizeFormInput(field, event.detail.value);
    const formData = {
      ...this.data.formData,
      [field]: value
    };
    this.setData({
      formTouched: true,
      formData,
      formErrors: this.getFormErrors(formData),
      formWarnings: this.getFormWarnings(formData),
      quickRemarkTags: this.data.quickRemarkTags
    });
    return value;
  },

  handleQuickRemarkTagTap(event) {
    const tag = event.currentTarget.dataset.tag;
    if (!tag) {
      return;
    }
    const selectedTags = this.data.selectedRemarkTags || [];
    const nextTags = selectedTags.includes(tag)
      ? selectedTags.filter((item) => item !== tag)
      : [...selectedTags, tag];
    this.updateRemarkTags(nextTags, this.data.formRemarkText);
  },

  handleRemoveRemarkTag(event) {
    const tag = event.currentTarget.dataset.tag;
    if (!tag) {
      return;
    }
    this.updateRemarkTags((this.data.selectedRemarkTags || []).filter((item) => item !== tag), this.data.formRemarkText);
  },

  handleCustomRemarkTagInput(event) {
    const cleanedValue = String(event.detail.value || '').replace(/[#\s]/g, '');
    let value = cleanedValue;
    if (cleanedValue.length > MAX_CUSTOM_TAG_LENGTH) {
      this.showInputLimitToast(`标签上限为 ${MAX_CUSTOM_TAG_LENGTH} 个字`);
      value = this.data.customRemarkTag || '';
    }
    this.setData({
      customRemarkTag: value
    });
    return undefined;
  },

  handleAddCustomRemarkTag() {
    const tag = String(this.data.customRemarkTag || '').trim();
    if (!tag) {
      wx.showToast({
        title: '请先输入标签',
        icon: 'none'
      });
      return;
    }
    const selectedTags = this.data.selectedRemarkTags || [];
    this.updateRemarkTags(selectedTags.includes(tag) ? selectedTags : [...selectedTags, tag], this.data.formRemarkText, {
      customRemarkTag: ''
    });
  },

  updateRemarkTags(nextTags, remarkText, extraData = {}) {
    const limitedRemark = this.sanitizeFormInput('remark', composeRemark(nextTags, remarkText));
    const remarkParts = parseRemarkParts(limitedRemark);
    const formData = {
      ...this.data.formData,
      remark: limitedRemark
    };
    this.setData({
      formTouched: true,
      formData,
      selectedRemarkTags: remarkParts.tags,
      formRemarkText: remarkParts.text,
      formErrors: this.getFormErrors(formData),
      formWarnings: this.getFormWarnings(formData),
      quickRemarkTags: this.getQuickRemarkTags(formData.category, formData.remark),
      ...extraData
    });
  },

  handleUseExpectedField(event) {
    const field = event.currentTarget.dataset.field;
    const expectedField = field === 'city' ? 'expectedCity' : 'expectedLocation';
    const expectedValue = this.data.formData[expectedField] || '';
    const formData = {
      ...this.data.formData,
      [field]: expectedValue
    };
    this.setData({
      formTouched: true,
      formData,
      formErrors: this.getFormErrors(formData),
      formWarnings: this.getFormWarnings(formData),
      focusedWarningField: ''
    });
  },

  handleWarningFieldFocus(event) {
    this.setData({
      focusedWarningField: event.currentTarget.dataset.field || ''
    });
  },

  handleWarningFieldBlur() {
    setTimeout(() => {
      this.setData({
        focusedWarningField: ''
      });
    }, 160);
  },

  handleMergeMeetRelatedChange(event) {
    this.setData({
      mergeMeetRelatedInAll: event.detail.value
    });
    this.refreshDisplayExpensesFromCache();
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
        includeTransportCost: false,
        transportAmount: '',
        includeAccommodationCost: false,
        accommodationAmount: '',
        expenseSource: 'manual'
      },
      purchaseChannelIndex: 0,
      pricingModeIndex: 0,
      searchKeyword: '',
      meetSearchKeyword: '',
      meetSearchFocused: false,
      collectionSearchKeyword: '',
      selectedCollectionMeta: '',
      searchResults: [],
      stageDateOptions: [],
      stageDateLabels: [],
      stageDateIndex: 0,
      formTouched: true
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
      meetSearchFocused: false,
      collectionSearchKeyword: '',
      selectedCollectionMeta: '',
      searchResults: [],
      stageDateOptions: [],
      stageDateLabels: [],
      stageDateIndex: 0,
      formTouched: true
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
    const isCollection = this.data.formData.category === 'collection';
    const hasPriceTier = this.data.priceTiers.length > 0;
    const pricingMode =
      (isMeet && purchaseChannel.id === 'official' && hasPriceTier) ||
      (isCollection && purchaseChannel.id === 'official')
        ? 'official_unit'
        : 'total';
    const pricingModeIndex = Math.max(
      this.data.pricingModes.findIndex((item) => item.id === pricingMode),
      0
    );
    const formData = {
      ...this.data.formData,
      purchaseChannel: purchaseChannel.id,
      pricingMode,
      amount:
        isMeet && purchaseChannel.id === 'official' && hasPriceTier
          ? this.data.formData.priceTier
          : isCollection && purchaseChannel.id === 'official'
            ? this.data.formData.referencePrice || this.data.formData.amount
            : ''
    };
    this.setData({
      purchaseChannelIndex,
      pricingModeIndex,
      formTouched: true,
      formData,
      formErrors: this.getFormErrors(formData)
    });
  },

  handlePricingModeChange(event) {
    const pricingModeIndex = Number(event.detail.value);
    const pricingMode = this.data.pricingModes[pricingModeIndex];
    const formData = {
      ...this.data.formData,
      pricingMode: pricingMode.id
    };
    this.setData({
      pricingModeIndex,
      formTouched: true,
      formData,
      formErrors: this.getFormErrors(formData)
    });
  },

  handleDateChange(event) {
    const date = event.detail.value;
    const formData = {
      ...this.data.formData,
      date
    };
    this.setData({
      formTouched: true,
      formData,
      formErrors: this.getFormErrors(formData)
    });
  },

  handleMeetNameFocus() {
    this.setData({ meetSearchFocused: true });
    this.updateMeetSearchResults(this.data.formData.itemName || '');
  },

  handleMeetNameBlur() {
    setTimeout(() => {
      this.setData({ meetSearchFocused: false });
    }, 160);
  },

  handleMeetNameInput(event) {
    const value = this.sanitizeFormInput('itemName', event.detail.value);
    const formData = {
      ...this.data.formData,
      itemName: value
    };
    this.setData({
      formTouched: true,
      formData,
      searchKeyword: value,
      meetSearchKeyword: value,
      meetSearchFocused: true,
      formErrors: this.getFormErrors(formData)
    });
    this.updateMeetSearchResults(value);
    return value;
  },

  updateMeetSearchResults(value) {
    const keyword = String(value || '').trim();
    if (!keyword) {
      this.setData({ searchResults: [] });
      return;
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
  },

  handleBundleCostToggle(event) {
    const field = event.currentTarget.dataset.field;
    const checked = event.detail.value;
    const amountField =
      field === 'includeTransportCost'
        ? 'transportAmount'
        : 'accommodationAmount';
    const formData = {
      ...this.data.formData,
      [field]: checked,
      [amountField]: checked ? this.data.formData[amountField] : ''
    };
    this.setData({
      formTouched: true,
      formData,
      formErrors: this.getFormErrors(formData)
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
          stageDateIndex: 0,
          formTouched: true
        });
        return;
      }

      const fallbackName = getMeetStageLabel(this.data.formData.subType);
      const formData = {
        ...this.data.formData,
        stageId: '',
        stageDate: date,
        itemName: this.data.matchedMeetStageName ? fallbackName : this.data.formData.itemName || fallbackName,
        city: this.data.matchedMeetStageName ? '' : this.data.formData.city,
        location: this.data.matchedMeetStageName ? '' : this.data.formData.location,
        expectedCity: '',
        expectedLocation: '',
        priceTier: ''
      };
      this.setData({
        formTouched: true,
        formData,
        formErrors: this.getFormErrors(formData),
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
    this.applySelectedMeetStage(stage, { concertStageIndex, formTouched: true });
  },

  handleStageDateOptionChange(event) {
    const stageDateIndex = Number(event.detail.value);
    const stage = this.data.stageDateOptions[stageDateIndex];
    if (!stage) {
      return;
    }
    this.applySelectedMeetStage(stage, { stageDateIndex, formTouched: true });
  },

  handleStageDateOptionTap(event) {
    const stageDateIndex = Number(event.currentTarget.dataset.index);
    const stage = this.data.stageDateOptions[stageDateIndex];
    if (!stage) {
      return;
    }
    this.applySelectedMeetStage(stage, { stageDateIndex, formTouched: true });
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
    const formData = {
      ...this.data.formData,
      subType: stageType,
      stageId: stage.stageId,
      stageDate: stage.date,
      itemName: stage.stageName,
      city: stage.city || '',
      location: stage.venue || stage.location || '',
      expectedCity: stage.city || '',
      expectedLocation: stage.venue || stage.location || '',
      amount: shouldUseOfficialTier && priceTiers.length ? String(priceTiers[0]) : '',
      priceTier: priceTiers.length ? String(priceTiers[0]) : '',
      pricingMode: shouldUseOfficialTier && priceTiers.length ? 'official_unit' : 'total'
    };
    const formTouched = this.data.formTouched || Boolean(extraState.formTouched);
    this.setData({
      ...extraState,
      formTouched,
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
      formData,
      formErrors: formTouched ? this.getFormErrors(formData) : {}
    });
  },

  handlePriceTierChange(event) {
    const priceTierIndex = Number(event.detail.value);
    const priceTier = this.data.priceTiers[priceTierIndex];
    if (typeof priceTier === 'undefined') {
      return;
    }
    const formData = {
      ...this.data.formData,
      amount: this.data.formData.purchaseChannel === 'official' ? String(priceTier) : this.data.formData.amount,
      priceTier: String(priceTier)
    };
    this.setData({
      priceTierIndex,
      formTouched: true,
      formData,
      formErrors: this.getFormErrors(formData)
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
    const category = this.data.formData.category;
    const searchType = event.currentTarget.dataset.searchType || category;
    const previousSearchKeyword =
      searchType === 'collection' ? this.data.collectionSearchKeyword : this.data.meetSearchKeyword;
    const searchKeyword = rawValue === 'undefined'
      ? ''
      : this.limitPlainText(
          rawValue,
          previousSearchKeyword,
          MAX_SEARCH_LENGTH,
          '\u641c\u7d22\u5173\u952e\u8bcd'
        );
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
            title: this.getFriendlyErrorMessage(error, '搜索藏品失败'),
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
        meetSearchKeyword: firstStage.stageName || '',
        formTouched: true
      });
      return;
    }
    if (this.data.formData.category === 'collection') {
      const item = this.data.searchResults.find((candidate) => candidate.collectionId === id);
      if (!item) {
        return;
      }
      const categoryIndex = Math.max(
        this.data.categories.findIndex((candidate) => candidate.id === 'collection'),
        0
      );
      const category = this.data.categories[categoryIndex];
      const subType = expenseService.inferCollectionSubType(item);
      const subTypeIndex = Math.max(
        (category.subTypes || []).findIndex((candidate) => candidate.id === subType),
        0
      );
      const referencePrice = item.referencePrice === null || typeof item.referencePrice === 'undefined'
        ? ''
        : String(item.referencePrice);
      const formData = {
        ...this.data.formData,
        category: 'collection',
        subType: (category.subTypes[subTypeIndex] || {}).id || subType,
        collectionId: item.collectionId,
        itemName: item.collectionName,
        referencePrice,
        amount: referencePrice,
        unitPrice: referencePrice,
        expenseSource: 'collection'
      };
      this.setData({
        categoryIndex,
        subTypes: category.subTypes || [],
        subTypeIndex,
        formTouched: true,
        formData,
        formErrors: this.getFormErrors(formData),
        searchKeyword: item.collectionName || '',
        collectionSearchKeyword: item.collectionName || '',
        selectedCollectionMeta: [buildCollectionDetailText(item), buildCollectionPriceText(item)]
          .filter(Boolean)
          .join(' · '),
        searchResults: []
      });
      return;
    }
    return;
  },

  async handleSubmitForm() {
    if (this.data.formSubmitting) {
      return;
    }

    const formErrors = this.getFormErrors(this.data.formData);
    if (Object.keys(formErrors).length) {
      this.setData({
        formTouched: true,
        formErrors
      });
      wx.showToast({
        title: this.getFirstValidationMessage(formErrors),
        icon: 'none'
      });
      return;
    }
    const formWarnings = this.getFormWarnings(this.data.formData);
    if (Object.keys(formWarnings).length) {
      this.setData({ formWarnings });
      const confirmed = await this.confirmFormWarnings(formWarnings);
      if (!confirmed) {
        return;
      }
    }

    this.setData({ formSubmitting: true });

    try {
      const result = await this.submitExpenseForm();

      if (!result.valid) {
        this.setData({
          formTouched: true,
          formErrors: this.getFormErrors(this.data.formData)
        });
        wx.showToast({
          title: this.getFriendlyErrorMessage(result.message, '保存失败，请重试'),
          icon: 'none'
        });
        return;
      }

      wx.showToast({
        title: this.data.formMode === 'edit' ? '已保存' : '已新增',
        icon: 'success'
      });
      this.setData({
        formVisible: false,
        formErrors: {},
        formWarnings: {},
        formTouched: false
      });
      this.refreshPage();
    } catch (error) {
      wx.showToast({
        title: this.getFriendlyErrorMessage(error, '保存失败，请重试'),
        icon: 'none'
      });
    } finally {
      this.setData({ formSubmitting: false });
    }
  },

  confirmFormWarnings(formWarnings) {
    return new Promise((resolve) => {
      wx.showModal({
        title: '继续保存？',
        content: `${this.getFirstValidationMessage(formWarnings)}，是否继续保存？`,
        cancelText: '再检查',
        confirmText: '继续保存',
        confirmColor: '#9c6a00',
        success: (res) => resolve(Boolean(res.confirm)),
        fail: () => resolve(false)
      });
    });
  },

  async submitExpenseForm() {
    if (this.data.formMode === 'edit') {
      return expenseService.updateExpenseAsync(this.data.formData.expenseId, this.data.formData);
    }
    if (this.data.formMode === 'edit_bundle') {
      return this.updateBundledExpenseForm();
    }
    const formData = this.data.formData;
    const hasBundledCost =
      formData.category === 'meet' &&
      (formData.includeTransportCost || formData.includeAccommodationCost);
    if (!hasBundledCost) {
      return expenseService.addExpenseAsync(formData);
    }

    const bundleId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const ticketResult = await expenseService.addExpenseAsync({
      ...formData,
      expenseSource: `${MEET_BUNDLE_PREFIX}${bundleId}:ticket`
    });
    if (!ticketResult.valid) {
      return ticketResult;
    }

    const linkedRemark = ['关联见面消费', formData.remark].filter(Boolean).join('；');
    const commonLinkedExpense = {
      date: formData.date,
      paymentMethod: formData.paymentMethod,
      city: formData.city,
      location: formData.location,
      remark: linkedRemark,
      includeInTotal: formData.includeInTotal,
      purchaseChannel: 'none',
      pricingMode: 'direct',
      stageDate: formData.stageDate,
      quantity: 1
    };

    if (formData.includeTransportCost) {
      const transportResult = await expenseService.addExpenseAsync({
        ...commonLinkedExpense,
        category: 'transport',
        subType: 'travel',
        itemName: `${formData.itemName || '见面'} 交通`,
        amount: formData.transportAmount,
        expenseSource: `${MEET_BUNDLE_PREFIX}${bundleId}:transport`
      });
      if (!transportResult.valid) {
        return transportResult;
      }
    }

    if (formData.includeAccommodationCost) {
      const accommodationResult = await expenseService.addExpenseAsync({
        ...commonLinkedExpense,
        category: 'accommodation',
        subType: 'hotel',
        itemName: `${formData.itemName || '见面'} 住宿`,
        amount: formData.accommodationAmount,
        expenseSource: `${MEET_BUNDLE_PREFIX}${bundleId}:accommodation`
      });
      if (!accommodationResult.valid) {
        return accommodationResult;
      }
    }

    return ticketResult;
  },

  async updateBundledExpenseForm() {
    const formData = this.data.formData;
    const ticketResult = await expenseService.updateExpenseAsync(formData.expenseId, formData);
    if (!ticketResult.valid) {
      return ticketResult;
    }

    const bundleMeta = parseMeetBundleSource(formData.expenseSource);
    const bundleId = bundleMeta && bundleMeta.bundleId
      ? bundleMeta.bundleId
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const linkedRemark = ['关联见面消费', formData.remark].filter(Boolean).join('；');
    const commonLinkedExpense = {
      date: formData.date,
      paymentMethod: formData.paymentMethod,
      city: formData.city,
      location: formData.location,
      remark: linkedRemark,
      includeInTotal: formData.includeInTotal,
      purchaseChannel: 'none',
      pricingMode: 'direct',
      stageDate: formData.stageDate,
      quantity: 1
    };

    const transportPayload = {
      ...commonLinkedExpense,
      category: 'transport',
      subType: 'travel',
      itemName: `${formData.itemName || '见面'} 交通`,
      amount: formData.transportAmount,
      expenseSource: `${MEET_BUNDLE_PREFIX}${bundleId}:transport`
    };
    if (formData.includeTransportCost) {
      const result = formData.bundledTransportExpenseId
        ? await expenseService.updateExpenseAsync(formData.bundledTransportExpenseId, {
            ...transportPayload,
            expenseId: formData.bundledTransportExpenseId
          })
        : await expenseService.addExpenseAsync(transportPayload);
      if (!result.valid) {
        return result;
      }
    } else if (formData.bundledTransportExpenseId) {
      await expenseService.removeExpenseAsync(formData.bundledTransportExpenseId);
    }

    const accommodationPayload = {
      ...commonLinkedExpense,
      category: 'accommodation',
      subType: 'hotel',
      itemName: `${formData.itemName || '见面'} 住宿`,
      amount: formData.accommodationAmount,
      expenseSource: `${MEET_BUNDLE_PREFIX}${bundleId}:accommodation`
    };
    if (formData.includeAccommodationCost) {
      const result = formData.bundledAccommodationExpenseId
        ? await expenseService.updateExpenseAsync(formData.bundledAccommodationExpenseId, {
            ...accommodationPayload,
            expenseId: formData.bundledAccommodationExpenseId
          })
        : await expenseService.addExpenseAsync(accommodationPayload);
      if (!result.valid) {
        return result;
      }
    } else if (formData.bundledAccommodationExpenseId) {
      await expenseService.removeExpenseAsync(formData.bundledAccommodationExpenseId);
    }

    return ticketResult;
  },

  handleToggleRemark(event) {
    const expenseId = event.currentTarget.dataset.id;
    if (!expenseId) {
      return;
    }
    const expanded = !this.data.expandedRemarkMap[expenseId];
    const expenses = (this.data.expenses || []).map((item) => {
      if (item.expenseId !== expenseId) {
        return item;
      }
      const remark = parseRemarkParts(item.remark).text;
      return {
        ...item,
        remarkExpanded: expanded,
        remarkDisplayText:
          remark.length > REMARK_PREVIEW_LENGTH && !expanded
            ? `${remark.slice(0, REMARK_PREVIEW_LENGTH)}...`
            : remark
      };
    });
    this.setData({
      [`expandedRemarkMap.${expenseId}`]: expanded,
      expenses
    });
  },

  getExpenseFromDisplay(expenseId) {
    const expense = this.data.expenses.find((item) => item.expenseId === expenseId) || null;
    if (!expense || !expense.isCombinedBundle) {
      return expense;
    }
    return (expense.bundleItems || []).find((item) => item.bundleMeta && item.bundleMeta.role === 'ticket') ||
      (expense.bundleItems || [])[0] ||
      expense;
  },

  getBundleItemsForDelete(displayExpense) {
    if (!displayExpense) {
      return [];
    }
    if (displayExpense.isCombinedBundle) {
      return displayExpense.bundleItems || [];
    }
    const bundleMeta = parseMeetBundleSource(displayExpense.expenseSource);
    if (!bundleMeta || !bundleMeta.bundleId) {
      return [];
    }
    return this.getDecoratedExpenses(this.data.expenseDisplayCache || []).filter((item) => (
      item.bundleMeta && item.bundleMeta.bundleId === bundleMeta.bundleId
    ));
  },

  getDeleteRoleText(expense) {
    const bundleMeta = expense && expense.bundleMeta
      ? expense.bundleMeta
      : parseMeetBundleSource(expense && expense.expenseSource);
    if (bundleMeta && bundleMeta.role) {
      if (bundleMeta.role === 'ticket') {
        return '见面';
      }
      return getBundleRoleName(bundleMeta.role);
    }
    return expense && expense.categoryName ? expense.categoryName : '消费记录';
  },

  handleDeleteExpense(event) {
    const expenseId = event.currentTarget.dataset.id;
    const displayExpense = this.data.expenses.find((item) => item.expenseId === expenseId) || null;
    const currentExpense = this.getExpenseFromDisplay(expenseId);
    if (!currentExpense) {
      wx.showToast({
        title: '记录不存在',
        icon: 'none'
      });
      return;
    }
    const bundleItems = this.getBundleItemsForDelete(displayExpense || currentExpense);
    const linkedItems = bundleItems.filter((item) => item.expenseId !== currentExpense.expenseId);
    const linkedText = linkedItems
      .map((item) => this.getDeleteRoleText(item))
      .filter(Boolean)
      .join('、');
    this.setData({
      deleteConfirmVisible: true,
      deleteSubmitting: false,
      deleteCurrentExpense: currentExpense,
      deleteLinkedItems: linkedItems,
      deleteLinkedText: linkedText,
      deleteWithLinked: Boolean(displayExpense && displayExpense.isCombinedBundle && linkedItems.length)
    });
  },

  handleDeleteLinkedToggle(event) {
    const value = event && event.detail ? event.detail.value : undefined;
    const checked = Array.isArray(value)
      ? value.length > 0
      : typeof value === 'boolean'
        ? value
        : !this.data.deleteWithLinked;
    this.setData({
      deleteWithLinked: checked
    });
  },

  handleCancelDelete() {
    if (this.data.deleteSubmitting) {
      return;
    }
    this.setData({
      deleteConfirmVisible: false,
      deleteCurrentExpense: null,
      deleteLinkedItems: [],
      deleteLinkedText: '',
      deleteWithLinked: false
    });
  },

  async handleConfirmDelete() {
    if (this.data.deleteSubmitting || !this.data.deleteCurrentExpense) {
      return;
    }
    const currentExpense = this.data.deleteCurrentExpense;
    const deleteItems = this.data.deleteWithLinked
      ? [currentExpense, ...(this.data.deleteLinkedItems || [])]
      : [currentExpense];
    const uniqueItems = [];
    deleteItems.forEach((item) => {
      if (item && item.expenseId && !uniqueItems.some((candidate) => candidate.expenseId === item.expenseId)) {
        uniqueItems.push(item);
      }
    });
    this.setData({ deleteSubmitting: true });
    try {
      for (const item of uniqueItems) {
        await expenseService.removeExpenseAsync(item.expenseId, item);
      }
      wx.showToast({
        title: '已删除',
        icon: 'success'
      });
      this.setData({
        deleteConfirmVisible: false,
        deleteSubmitting: false,
        deleteCurrentExpense: null,
        deleteLinkedItems: [],
        deleteLinkedText: '',
        deleteWithLinked: false
      });
      this.refreshPage();
    } catch (error) {
      wx.showToast({
        title: this.getFriendlyErrorMessage(error, '删除失败，请重试'),
        icon: 'none'
      });
      this.setData({ deleteSubmitting: false });
    }
  },

  showInputLimitToast(title) {
    const now = Date.now();
    if (now - (this.inputLimitToastAt || 0) < 1200) {
      return;
    }
    this.inputLimitToastAt = now;
    wx.showToast({
      title,
      icon: 'none'
    });
  },

  limitPlainText(value, previousValue, maxLength, fieldName) {
    const nextValue = String(value || '');
    if (nextValue.length <= maxLength) {
      return nextValue;
    }
    this.showInputLimitToast(`${fieldName}\u4e0a\u9650\u4e3a ${maxLength} \u4e2a\u5b57`);
    return String(previousValue || '');
  },

  sanitizeAmountInput(value, previousValue) {
    const nextValue = String(value || '');
    const previous = String(previousValue || '');
    if (!nextValue) {
      return '';
    }
    if (!/^\d*(\.\d{0,2})?$/.test(nextValue)) {
      this.showInputLimitToast('\u91d1\u989d\u6700\u591a\u4fdd\u7559 2 \u4f4d\u5c0f\u6570');
      return previous;
    }
    const amount = Number(nextValue);
    if (Number.isFinite(amount) && amount > MAX_AMOUNT) {
      this.showInputLimitToast(`\u91d1\u989d\u4e0a\u9650\u4e3a ${MAX_AMOUNT}`);
      return previous;
    }
    return nextValue;
  },

  sanitizeQuantityInput(value, previousValue) {
    const nextValue = String(value || '');
    const previous = String(previousValue || '');
    if (!nextValue) {
      return '';
    }
    if (!/^\d+$/.test(nextValue)) {
      this.showInputLimitToast('\u6570\u91cf\u53ea\u80fd\u586b\u5199\u6574\u6570');
      return previous;
    }
    const quantity = Number(nextValue);
    if (quantity > MAX_COLLECTION_QUANTITY) {
      this.showInputLimitToast(`\u85cf\u54c1\u6570\u91cf\u4e0a\u9650\u4e3a ${MAX_COLLECTION_QUANTITY}`);
      return previous;
    }
    return nextValue;
  },

  sanitizeFormInput(field, value) {
    const previousValue = this.data.formData[field];
    if (['amount', 'transportAmount', 'accommodationAmount'].includes(field)) {
      return this.sanitizeAmountInput(value, previousValue);
    }
    if (field === 'quantity') {
      return this.sanitizeQuantityInput(value, previousValue);
    }
    if (TEXT_FIELD_LIMITS[field]) {
      return this.limitPlainText(
        value,
        previousValue,
        TEXT_FIELD_LIMITS[field],
        TEXT_FIELD_NAMES[field] || field
      );
    }
    return value;
  },

  getFriendlyErrorMessage(error, fallback) {
    const message = String((error && error.message) || error || '');
    if (
      /timeout|超时|cloud\.callContainer|request:fail|fail|network|网络|102002/i.test(message)
    ) {
      return '网络异常，请稍后重试';
    }
    return message || fallback;
  },

  getExpenseDateEnd(formData = {}, today = this.getToday()) {
    return today;
  },

  getFirstValidationMessage(messages = {}) {
    const firstKey = Object.keys(messages)[0];
    return firstKey ? messages[firstKey] : '请检查填写内容';
  },

  getSubTypeLabel(categoryId) {
    if (categoryId === 'meet') {
      return '见面分类';
    }
    if (categoryId === 'collection') {
      return '藏品分类';
    }
    if (categoryId === 'other') {
      return '其他分类';
    }
    return '';
  },

  getQuickRemarkTags(categoryId, remark = '') {
    const selectedTags = parseRemarkParts(remark).tags;
    return (QUICK_REMARK_TAGS[categoryId] || QUICK_REMARK_TAGS.other).map((tag) => ({
      name: tag,
      active: selectedTags.includes(tag)
    }));
  },

  getFormWarnings(formData = this.data.formData) {
    const warnings = {};
    if (formData.category === 'meet' && formData.stageId) {
      const city = String(formData.city || '').trim();
      const expectedCity = String(formData.expectedCity || '').trim();
      const location = String(formData.location || '').trim();
      const expectedLocation = String(formData.expectedLocation || '').trim();
      if (expectedCity && city !== expectedCity) {
        warnings.city = '城市可能与所选云端场次不一致';
      }
      if (expectedLocation && location !== expectedLocation) {
        warnings.location = '地点可能与所选云端场次不一致';
      }
    }
    return warnings;
  },

  getFormErrors(formData = this.data.formData) {
    const errors = {};
    const today = this.data.today || this.getToday();
    const amountText = String(formData.amount || '').trim();
    if (!String(formData.date || '').trim()) {
      errors.date = '请选择消费日期';
    } else if (formData.date > today) {
      errors.date = '消费日期不能晚于今天';
    }
    if (formData.category === 'meet') {
      if (!String(formData.stageDate || '').trim()) {
        errors.stageDate = '请选择见面日期';
      }
    }
    if (!String(formData.itemName || '').trim()) {
      errors.itemName = '请填写消费项目名称';
    }
    if (!amountText) {
      errors.amount = '请输入金额';
    } else if (!/^\d+(\.\d{1,2})?$/.test(amountText)) {
      errors.amount = '金额最多保留 2 位小数';
    } else if (Number(amountText) <= 0) {
      errors.amount = '金额必须大于 0';
    } else if (Number(amountText) > MAX_AMOUNT) {
      errors.amount = `金额上限为 ${MAX_AMOUNT}`;
    }
    if (formData.category === 'collection') {
      const quantityText = String(formData.quantity || '').trim();
      const quantity = Number(quantityText);
      if (!quantityText) {
        errors.quantity = '请输入数量';
      } else if (!/^\d+$/.test(quantityText)) {
        errors.quantity = '数量只能填写整数';
      } else if (quantity < 1 || quantity > MAX_COLLECTION_QUANTITY) {
        errors.quantity = `藏品数量必须是 1 到 ${MAX_COLLECTION_QUANTITY} 之间的整数`;
      }
    }
    if (formData.category === 'meet' && formData.includeTransportCost) {
      const transportAmount = String(formData.transportAmount || '').trim();
      if (!transportAmount) {
        errors.transportAmount = '请输入交通金额';
      } else if (!/^\d+(\.\d{1,2})?$/.test(transportAmount)) {
        errors.transportAmount = '交通金额最多保留 2 位小数';
      } else if (Number(transportAmount) <= 0) {
        errors.transportAmount = '交通金额必须大于 0';
      } else if (Number(transportAmount) > MAX_AMOUNT) {
        errors.transportAmount = `交通金额上限为 ${MAX_AMOUNT}`;
      }
    }
    if (formData.category === 'meet' && formData.includeAccommodationCost) {
      const accommodationAmount = String(formData.accommodationAmount || '').trim();
      if (!accommodationAmount) {
        errors.accommodationAmount = '请输入住宿金额';
      } else if (!/^\d+(\.\d{1,2})?$/.test(accommodationAmount)) {
        errors.accommodationAmount = '住宿金额最多保留 2 位小数';
      } else if (Number(accommodationAmount) <= 0) {
        errors.accommodationAmount = '住宿金额必须大于 0';
      } else if (Number(accommodationAmount) > MAX_AMOUNT) {
        errors.accommodationAmount = `住宿金额上限为 ${MAX_AMOUNT}`;
      }
    }
    return errors;
  },

  noop() {},

  getToday() {
    const date = new Date();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }
});
