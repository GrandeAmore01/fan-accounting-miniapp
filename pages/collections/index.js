const collectionService = require('../../services/collectionService');

const PENDING_COLLECTION_DRAFT_KEY = 'pendingCollectionExpenseDraft';
const MAX_SEARCH_LENGTH = 40;

const ALL = '全部';
const STYLE_ORDER = ['单人款', '团体款', '套装款', '普通款', '高会款', '组合款', '单品款'];

Page({
  data: {
    loading: true,
    loadError: '',
    allCollections: [],
    groups: [],
    primaryOptions: [ALL],
    secondaryOptions: [ALL],
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
      this.setData({ allCollections, primaryOptions, styleOptions, loading: false });
      this.applyFilters();
    } catch (error) {
      this.setData({ loading: false, loadError: error.message || '藏品加载失败' });
    }
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

  applyFilters() {
    const { allCollections, appliedFilters } = this.data;
    const primary = appliedFilters.primary;
    const secondary = appliedFilters.secondary;
    const style = appliedFilters.style;
    const status = appliedFilters.status;
    const keyword = (appliedFilters.keyword || '').trim().toLowerCase();
    const filtered = allCollections.filter((item) => {
      const text = [item.collectionName, item.seriesName, item.saleType,
        item.primaryCategory, item.secondaryCategory, item.productStyle]
        .join(' ').toLowerCase();
      return (primary === ALL || item.primaryCategory === primary) &&
        (secondary === ALL || item.secondaryCategory === secondary) &&
        (style === ALL || item.productStyle === style) &&
        (status === '全部' || (status === '已点亮' ? item.isOwned : !item.isOwned)) &&
        (!keyword || text.includes(keyword));
    });
    const ownedCount = new Set(allCollections.filter((item) => item.isOwned).map((item) => item.collectionId)).size;
    const total = new Set(allCollections.map((item) => item.collectionId)).size;
    this.setData({
      groups: this.buildGroups(filtered),
      progress: { total, ownedCount, percent: total ? Math.round(ownedCount * 100 / total) : 0 }
    });
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
    const primary = this.data.primaryOptions[primaryIndex];
    const primaryCollections = primary === ALL
      ? this.data.allCollections
      : this.data.allCollections.filter((item) => item.primaryCategory === primary);
    const secondaryOptions = primary === ALL
      ? [ALL]
      : [ALL, ...this.unique(primaryCollections.map((item) => item.secondaryCategory))];
    const styleOptions = this.buildStyleOptions(primaryCollections);
    this.setData({ primaryIndex, secondaryOptions, secondaryIndex: 0, styleOptions, styleIndex: 0 });
  },
  handleSecondaryChange(event) { this.setData({ secondaryIndex: Number(event.detail.value) }); },
  handleStyleChange(event) { this.setData({ styleIndex: Number(event.detail.value) }); },
  handleStatusChange(event) { this.setData({ statusIndex: Number(event.detail.value) }); },
  handleConfirmFilter() {
    this.setData({
      appliedFilters: {
        primary: this.data.primaryOptions[this.data.primaryIndex] || ALL,
        secondary: this.data.secondaryOptions[this.data.secondaryIndex] || ALL,
        style: this.data.styleOptions[this.data.styleIndex] || ALL,
        status: this.data.statusOptions[this.data.statusIndex] || '全部',
        keyword: this.data.keyword
      }
    });
    this.applyFilters();
  },
  handleClearFilter() {
    this.setData({
      keyword: '', primaryIndex: 0, secondaryIndex: 0, secondaryOptions: [ALL],
      styleOptions: this.buildStyleOptions(this.data.allCollections), styleIndex: 0, statusIndex: 0,
      appliedFilters: { primary: ALL, secondary: ALL, style: ALL, status: '全部', keyword: '' }
    });
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
    this.setData({ allCollections }); this.applyFilters();
  },
  handleCollectionTap(event) {
    const id = event.currentTarget.dataset.id;
    const collection = this.data.allCollections.find((item) => item.collectionId === id);
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
    } catch (error) { wx.showToast({ title: error.message || '\u70b9\u4eae\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5', icon: 'none' }); }
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
    wx.showModal({ title: '取消点亮', content: `确认取消“${collection.collectionName}”的点亮状态吗？`, confirmText: '取消点亮', confirmColor: '#E9A6B3',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ busyCollectionId: collection.collectionId });
        try { await collectionService.unlightCollection(collection.collectionId); this.updateOwned(collection.collectionId, false); wx.showToast({ title: '已取消点亮', icon: 'success' }); }
        catch (error) { wx.showToast({ title: error.message || '取消失败', icon: 'none' }); }
        finally { this.setData({ busyCollectionId: '' }); }
      } });
  },
  updateOwned(collectionId, isOwned) {
    this.setData({ allCollections: this.data.allCollections.map((item) => item.collectionId === collectionId ? { ...item, isOwned } : item) });
    this.applyFilters();
  }
});
