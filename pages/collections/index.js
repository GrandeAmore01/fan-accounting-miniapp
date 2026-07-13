const collectionService = require('../../services/collectionService');

const PENDING_COLLECTION_DRAFT_KEY = 'pendingCollectionExpenseDraft';
const MAX_SEARCH_LENGTH = 40;
const PAGE_SIZE = 30;

const ALL = '全部';
const STYLE_ORDER = ['团体款', '单人款', '套装款', '普通款', '高会款', '组合款', '单品款'];

Page({
  data: {
    loading: true,
    loadError: '',
    allCollections: [],
    groups: [],
    filteredCollections: [],
    visibleCollections: [],
    visibleCount: PAGE_SIZE,
    hasMoreCollections: false,
    primaryOptions: [ALL],
    secondaryOptions: [ALL],
    primaryTabs: [{ name: ALL, count: 0, active: true }],
    secondaryTabs: [{ name: ALL, count: 0, active: true }],
    styleOptions: [ALL, ...STYLE_ORDER],
    statusOptions: ['全部', '已点亮', '未点亮'],
    primaryIndex: 0,
    secondaryIndex: 0,
    styleIndex: 0,
    statusIndex: 0,
    keyword: '',
    appliedFilters: {
      primary: ALL,
      secondary: ALL,
      style: ALL,
      status: '全部',
      keyword: ''
    },
    progress: { total: 0, ownedCount: 0, percent: 0 },
    resultSummary: {
      total: 0,
      text: ''
    },
    detailVisible: false,
    selectedCollection: null,
    busyCollectionId: ''
  },

  onShow() {
    this.loadCollections();
  },

  async loadCollections() {
    this.setData({ loading: true, loadError: '' });
    try {
      const allCollections = await collectionService.listCollections();
      const primaryOptions = [ALL, ...this.unique(allCollections.map((item) => item.primaryCategory))];
      const styleOptions = this.buildStyleOptions(allCollections);
      const secondaryOptions = [ALL];
      this.setData({
        allCollections,
        primaryOptions,
        secondaryOptions,
        styleOptions,
        primaryTabs: this.buildPrimaryTabs(allCollections, primaryOptions, 0),
        secondaryTabs: this.buildSecondaryTabs(allCollections, secondaryOptions, 0),
        loading: false
      });
      this.applyFilters();
    } catch (error) {
      console.warn('藏品图鉴加载失败', error);
      this.setData({
        loading: false,
        loadError: this.getFriendlyErrorMessage(error, '藏品加载失败，请稍后重试')
      });
    }
  },

  getFriendlyErrorMessage(error, fallback) {
    const message = String((error && error.message) || error || '');
    if (/timeout|超时|cloud\.callContainer|request:fail|fail|network|网络|102002/i.test(message)) {
      return '网络连接失败，请稍后重试';
    }
    return fallback || '操作失败，请稍后重试';
  },

  unique(values) {
    return values.filter(Boolean).filter((value, index, list) => list.indexOf(value) === index);
  },

  buildStyleOptions(collections) {
    const available = this.unique(collections.map((item) => item.productStyle));
    const ordered = STYLE_ORDER.filter((style) => available.includes(style));
    const extras = available.filter((style) => !STYLE_ORDER.includes(style));
    return [ALL, ...ordered, ...extras];
  },

  getStyleOrderIndex(style) {
    const index = STYLE_ORDER.indexOf(style);
    return index >= 0 ? index : STYLE_ORDER.length;
  },

  sortCollections(collections) {
    return [...collections].sort((a, b) => {
      const styleDiff = this.getStyleOrderIndex(a.productStyle) - this.getStyleOrderIndex(b.productStyle);
      if (styleDiff !== 0) return styleDiff;
      return String(a.collectionName || '').localeCompare(String(b.collectionName || ''), 'zh-Hans-CN');
    });
  },

  buildPrimaryTabs(collections, options, activeIndex) {
    return options.map((name, index) => ({
      name,
      count: name === ALL
        ? collections.length
        : collections.filter((item) => item.primaryCategory === name).length,
      active: index === activeIndex
    }));
  },

  buildSecondaryTabs(collections, options, activeIndex) {
    return options.map((name, index) => ({
      name,
      count: name === ALL
        ? collections.length
        : collections.filter((item) => item.secondaryCategory === name).length,
      active: index === activeIndex
    }));
  },

  getPrimaryCollections(primary) {
    return primary === ALL
      ? this.data.allCollections
      : this.data.allCollections.filter((item) => item.primaryCategory === primary);
  },

  rebuildCategoryTabs(primaryIndex = this.data.primaryIndex, secondaryIndex = this.data.secondaryIndex) {
    const primary = this.data.primaryOptions[primaryIndex] || ALL;
    const primaryCollections = this.getPrimaryCollections(primary);
    const secondaryCategories = primary === ALL
      ? []
      : this.unique(primaryCollections.map((item) => item.secondaryCategory));
    const visibleSecondaryCategories = secondaryCategories.length === 1 && secondaryCategories[0] === '未分类'
      ? []
      : secondaryCategories;
    const secondaryOptions = [ALL, ...visibleSecondaryCategories];
    const safeSecondaryIndex = Math.min(secondaryIndex, Math.max(secondaryOptions.length - 1, 0));
    const styleOptions = this.buildStyleOptions(primaryCollections);
    const safeStyleIndex = Math.min(this.data.styleIndex, Math.max(styleOptions.length - 1, 0));
    return {
      primary,
      primaryCollections,
      secondaryOptions,
      secondaryIndex: safeSecondaryIndex,
      styleOptions,
      styleIndex: safeStyleIndex,
      primaryTabs: this.buildPrimaryTabs(this.data.allCollections, this.data.primaryOptions, primaryIndex),
      secondaryTabs: this.buildSecondaryTabs(primaryCollections, secondaryOptions, safeSecondaryIndex)
    };
  },

  applyFilters() {
    const { allCollections, appliedFilters, visibleCount } = this.data;
    const primary = appliedFilters.primary;
    const secondary = appliedFilters.secondary;
    const style = appliedFilters.style;
    const status = appliedFilters.status;
    const keyword = (appliedFilters.keyword || '').trim().toLowerCase();
    const filtered = this.sortCollections(allCollections.filter((item) => {
      const text = [item.collectionName, item.seriesName, item.saleType,
        item.primaryCategory, item.secondaryCategory, item.productStyle]
        .join(' ').toLowerCase();
      return (primary === ALL || item.primaryCategory === primary) &&
        (secondary === ALL || item.secondaryCategory === secondary) &&
        (style === ALL || item.productStyle === style) &&
        (status === '全部' || (status === '已点亮' ? item.isOwned : !item.isOwned)) &&
        (!keyword || text.includes(keyword));
    }));
    const ownedCount = new Set(allCollections.filter((item) => item.isOwned).map((item) => item.collectionId)).size;
    const total = new Set(allCollections.map((item) => item.collectionId)).size;
    const safeVisibleCount = Math.min(Math.max(visibleCount, PAGE_SIZE), filtered.length || PAGE_SIZE);
    const visibleCollections = filtered.slice(0, safeVisibleCount);
    this.setData({
      filteredCollections: filtered,
      visibleCollections: visibleCollections.map((item) => ({ ...item, ...this.getNameDisplay(item.collectionName) })),
      visibleCount: safeVisibleCount,
      hasMoreCollections: safeVisibleCount < filtered.length,
      groups: this.buildGroups(visibleCollections),
      resultSummary: {
        total: filtered.length,
        text: `已查询到 ${filtered.length} 件藏品，当前展示 ${visibleCollections.length} 件`
      },
      progress: { total, ownedCount, percent: total ? Math.round(ownedCount * 100 / total) : 0 }
    });
    return filtered.length;
  },

  buildGroups(collections) {
    const oldState = {};
    this.data.groups.forEach((primary) => {
      oldState[primary.name] = primary.expanded;
      primary.children.forEach((secondary) => { oldState[`${primary.name}/${secondary.name}`] = secondary.expanded; });
    });
    const result = [];
    collections.forEach((item) => {
      let primary = result.find((group) => group.name === item.primaryCategory);
      if (!primary) {
        primary = { name: item.primaryCategory, count: 0, expanded: oldState[item.primaryCategory] !== false, children: [] };
        result.push(primary);
      }
      primary.count += 1;
      let secondary = primary.children.find((group) => group.name === item.secondaryCategory);
      if (!secondary) {
        secondary = { name: item.secondaryCategory, expanded: oldState[`${primary.name}/${item.secondaryCategory}`] !== false, items: [] };
        primary.children.push(secondary);
      }
      secondary.items.push({ ...item, ...this.getNameDisplay(item.collectionName) });
    });
    result.forEach((primary) => {
      primary.hasSecondaryLevel = primary.children.some((secondary) => secondary.name !== '未分类');
    });
    return result;
  },

  getNameDisplay(name) {
    const text = String(name || '');
    const visualLength = Array.from(text).reduce((total, char) =>
      total + (/^[\x00-\xff]$/.test(char) ? 0.55 : 1), 0);
    return {
      isLongName: visualLength > 9,
      marqueeDuration: Math.max(9, Math.round(visualLength * 0.9 * 10) / 10)
    };
  },

  handleKeywordInput(event) {
    const value = String(event.detail.value || '');
    if (value.length > MAX_SEARCH_LENGTH) {
      wx.showToast({ title: `\u641c\u7d22\u5173\u952e\u8bcd\u4e0a\u9650\u4e3a ${MAX_SEARCH_LENGTH} \u4e2a\u5b57`, icon: 'none' });
      return this.data.keyword;
    }
    this.setData({ keyword: value });
    return value;
  },
  handlePrimaryChange(event) {
    const primaryIndex = Number(event.detail.value);
    const next = this.rebuildCategoryTabs(primaryIndex, 0);
    this.setData({ primaryIndex, secondaryOptions: next.secondaryOptions, secondaryIndex: next.secondaryIndex, styleOptions: next.styleOptions, styleIndex: 0, primaryTabs: next.primaryTabs, secondaryTabs: next.secondaryTabs });
  },
  handleSecondaryChange(event) { this.setData({ secondaryIndex: Number(event.detail.value) }); },
  handleStyleChange(event) { this.setData({ styleIndex: Number(event.detail.value) }); },
  handleStatusChange(event) { this.setData({ statusIndex: Number(event.detail.value) }); },
  handlePrimaryTap(event) {
    const primaryIndex = Number(event.currentTarget.dataset.index);
    const next = this.rebuildCategoryTabs(primaryIndex, 0);
    this.setData({
      primaryIndex,
      secondaryOptions: next.secondaryOptions,
      secondaryIndex: next.secondaryIndex,
      styleOptions: next.styleOptions,
      styleIndex: 0,
      primaryTabs: next.primaryTabs,
      secondaryTabs: next.secondaryTabs,
      visibleCount: PAGE_SIZE,
      appliedFilters: {
        primary: this.data.primaryOptions[primaryIndex] || ALL,
        secondary: ALL,
        style: ALL,
        status: this.data.statusOptions[this.data.statusIndex] || '全部',
        keyword: this.data.keyword
      }
    });
    this.applyFilters();
  },
  handleSecondaryTap(event) {
    const secondaryIndex = Number(event.currentTarget.dataset.index);
    const next = this.rebuildCategoryTabs(this.data.primaryIndex, secondaryIndex);
    this.setData({
      secondaryIndex,
      secondaryTabs: next.secondaryTabs,
      visibleCount: PAGE_SIZE,
      appliedFilters: {
        primary: this.data.primaryOptions[this.data.primaryIndex] || ALL,
        secondary: next.secondaryOptions[secondaryIndex] || ALL,
        style: this.data.styleOptions[this.data.styleIndex] || ALL,
        status: this.data.statusOptions[this.data.statusIndex] || '全部',
        keyword: this.data.keyword
      }
    });
    this.applyFilters();
  },
  handleConfirmFilter() {
    const next = this.rebuildCategoryTabs(this.data.primaryIndex, this.data.secondaryIndex);
    this.setData({
      secondaryOptions: next.secondaryOptions,
      secondaryIndex: next.secondaryIndex,
      styleOptions: next.styleOptions,
      styleIndex: next.styleIndex,
      primaryTabs: next.primaryTabs,
      secondaryTabs: next.secondaryTabs,
      visibleCount: PAGE_SIZE,
      appliedFilters: {
        primary: this.data.primaryOptions[this.data.primaryIndex] || ALL,
        secondary: next.secondaryOptions[next.secondaryIndex] || ALL,
        style: next.styleOptions[next.styleIndex] || ALL,
        status: this.data.statusOptions[this.data.statusIndex] || '全部',
        keyword: this.data.keyword
      }
    });
    const count = this.applyFilters();
    wx.showToast({ title: `已查询到 ${count} 件藏品`, icon: 'none' });
  },
  handleClearFilter() {
    this.setData({
      keyword: '', primaryIndex: 0, secondaryIndex: 0, secondaryOptions: [ALL],
      styleOptions: this.buildStyleOptions(this.data.allCollections), styleIndex: 0, statusIndex: 0,
      primaryTabs: this.buildPrimaryTabs(this.data.allCollections, this.data.primaryOptions, 0),
      secondaryTabs: this.buildSecondaryTabs(this.data.allCollections, [ALL], 0),
      visibleCount: PAGE_SIZE,
      appliedFilters: { primary: ALL, secondary: ALL, style: ALL, status: '全部', keyword: '' }
    });
    this.applyFilters();
    wx.showToast({ title: '已重置筛选', icon: 'none' });
  },
  handleLoadMore() {
    this.setData({ visibleCount: this.data.visibleCount + PAGE_SIZE });
    this.applyFilters();
  },
  togglePrimary(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.setData({ [`groups[${index}].expanded`]: !this.data.groups[index].expanded });
  },
  toggleSecondary(event) {
    const primary = Number(event.currentTarget.dataset.primary);
    const secondary = Number(event.currentTarget.dataset.secondary);
    this.setData({ [`groups[${primary}].children[${secondary}].expanded`]: !this.data.groups[primary].children[secondary].expanded });
  },
  handleImageError(event) {
    const id = event.currentTarget.dataset.id;
    const allCollections = this.data.allCollections.map((item) => item.collectionId === id ? { ...item, imageFailed: true } : item);
    const selectedCollection = this.data.selectedCollection && this.data.selectedCollection.collectionId === id
      ? { ...this.data.selectedCollection, imageFailed: true }
      : this.data.selectedCollection;
    this.setData({ allCollections, selectedCollection }); this.applyFilters();
  },
  handleCollectionTap(event) {
    const id = event.currentTarget.dataset.id;
    const collection = this.data.allCollections.find((item) => item.collectionId === id);
    if (!collection || this.data.busyCollectionId) return;
    this.openCollectionDetail(collection);
  },
  openCollectionDetail(collection) {
    this.setData({
      detailVisible: true,
      selectedCollection: {
        ...collection,
        ...this.getNameDisplay(collection.collectionName)
      }
    });
  },
  closeCollectionDetail() {
    if (this.data.busyCollectionId) return;
    this.setData({ detailVisible: false, selectedCollection: null });
  },
  stopDetailTap() {},
  handleDetailPrimaryAction() {
    const collection = this.data.selectedCollection;
    if (!collection || this.data.busyCollectionId) return;
    if (collection.isOwned) this.confirmUnlight(collection); else this.confirmLight(collection);
  },
  confirmLight(collection) {
    wx.showModal({
      title: '\u70b9\u4eae\u85cf\u54c1',
      content: `\u786e\u8ba4\u70b9\u4eae\u300c${collection.collectionName}\u300d\u5417\uff1f`,
      confirmText: '\u70b9\u4eae',
      confirmColor: '#E9A6B3',
      success: async (res) => {
        if (res.confirm) {
          await this.lightCollection(collection);
        }
      }
    });
  },
  async lightCollection(collection) {
    this.setData({ busyCollectionId: collection.collectionId });
    let shouldPromptDraft = false;
    try {
      await collectionService.lightCollection(collection.collectionId);
      this.updateOwned(collection.collectionId, true);
      shouldPromptDraft = true;
    } catch (error) {
      console.warn('藏品点亮失败', error);
      wx.showToast({ title: this.getFriendlyErrorMessage(error, '点亮失败，请稍后重试'), icon: 'none' });
    }
    finally { this.setData({ busyCollectionId: '' }); }
    if (shouldPromptDraft) {
      setTimeout(() => {
        this.promptCreateExpenseDraft(collection);
      }, 150);
    }
  },
  promptCreateExpenseDraft(collection) {
    wx.showModal({
      title: '\u5df2\u70b9\u4eae',
      content: `\u662f\u5426\u4e3a\u300c${collection.collectionName}\u300d\u65b0\u589e\u4e00\u6761\u6d88\u8d39\u8bb0\u5f55\uff1f`,
      cancelText: '\u4ec5\u70b9\u4eae',
      confirmText: '\u53bb\u65b0\u589e',
      confirmColor: '#E9A6B3',
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        wx.setStorageSync(PENDING_COLLECTION_DRAFT_KEY, {
          collectionId: collection.collectionId,
          createdAt: Date.now()
        });
        wx.switchTab({
          url: '/pages/expenses/index',
          fail: () => {
            wx.removeStorageSync(PENDING_COLLECTION_DRAFT_KEY);
            wx.showToast({
              title: '\u8df3\u8f6c\u5931\u8d25\uff0c\u8bf7\u91cd\u65b0\u5c1d\u8bd5',
              icon: 'none'
            });
          }
        });
      },
      fail: () => {
        wx.showToast({
          title: '\u5df2\u70b9\u4eae\uff0c\u8bf7\u5230\u6d88\u8d39\u9875\u624b\u52a8\u65b0\u589e',
          icon: 'none'
        });
      }
    });
  },
  confirmUnlight(collection) {
    wx.showModal({ title: '取消点亮', content: `确认取消“${collection.collectionName}”的点亮状态吗？仅会取消图鉴中的拥有状态，不会删除已有消费记录。`, cancelText: '再想想', confirmText: '确认取消', confirmColor: '#E9A6B3',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ busyCollectionId: collection.collectionId });
        try { await collectionService.unlightCollection(collection.collectionId); this.updateOwned(collection.collectionId, false); wx.showToast({ title: '已取消点亮', icon: 'success' }); }
        catch (error) {
          console.warn('取消点亮失败', error);
          wx.showToast({ title: this.getFriendlyErrorMessage(error, '取消失败，请稍后重试'), icon: 'none' });
        }
        finally { this.setData({ busyCollectionId: '' }); }
      } });
  },
  updateOwned(collectionId, isOwned) {
    const allCollections = this.data.allCollections.map((item) => item.collectionId === collectionId ? { ...item, isOwned } : item);
    const selectedCollection = this.data.selectedCollection && this.data.selectedCollection.collectionId === collectionId
      ? { ...this.data.selectedCollection, isOwned }
      : this.data.selectedCollection;
    this.setData({ allCollections, selectedCollection });
    this.applyFilters();
  }
});
