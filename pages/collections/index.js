const collectionService = require('../../services/collectionService');

Page({
  data: {
    collections: [],
    categories: [{ id: 'all', name: '全部分类' }, ...collectionService.collectionCategories],
    statusOptions: [
      { id: 'all', name: '全部状态' },
      { id: 'owned', name: '已点亮' },
      { id: 'missing', name: '未点亮' }
    ],
    categoryIndex: 0,
    statusIndex: 0,
    keyword: '',
    progress: {
      total: 0,
      ownedCount: 0,
      percent: 0
    }
  },

  onShow() {
    this.refreshPage();
  },

  refreshPage() {
    const category = this.data.categories[this.data.categoryIndex].id;
    const ownedStatus = this.data.statusOptions[this.data.statusIndex].id;
    this.setData({
      collections: collectionService.filterCollections({
        category,
        ownedStatus,
        keyword: this.data.keyword
      }),
      progress: collectionService.getCollectionProgress()
    });
  },

  handleKeywordInput(event) {
    this.setData({
      keyword: event.detail.value
    });
    this.refreshPage();
  },

  handleCategoryChange(event) {
    this.setData({
      categoryIndex: Number(event.detail.value)
    });
    this.refreshPage();
  },

  handleStatusChange(event) {
    this.setData({
      statusIndex: Number(event.detail.value)
    });
    this.refreshPage();
  },

  handleClearFilter() {
    this.setData({
      keyword: '',
      categoryIndex: 0,
      statusIndex: 0
    });
    this.refreshPage();
  },

  handleLightCollection(event) {
    const { id } = event.currentTarget.dataset;
    const result = collectionService.lightCollection(id);
    if (!result.valid) {
      wx.showToast({
        title: result.message,
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '同步消费记录',
      content: '已点亮该藏品，是否根据官方参考价同步生成一条消费记录？',
      cancelText: '仅点亮',
      confirmText: '生成记录',
      confirmColor: '#c84d69',
      success: (res) => {
        if (res.confirm) {
          const expenseResult = collectionService.createExpenseFromCollection(id);
          wx.showToast({
            title: expenseResult.valid ? '已生成记录' : expenseResult.message,
            icon: expenseResult.valid ? 'success' : 'none'
          });
        } else {
          wx.showToast({
            title: '已点亮',
            icon: 'success'
          });
        }
        this.refreshPage();
      }
    });
  },

  handleUnlightCollection(event) {
    const { id } = event.currentTarget.dataset;
    const collection = this.data.collections.find((item) => item.collectionId === id);
    const hasLinkedExpense = Boolean(collection && collection.expenseId);
    wx.showModal({
      title: '取消点亮',
      content: hasLinkedExpense
        ? '取消点亮后，是否同时删除这条藏品同步生成的消费记录？'
        : '取消后仅更新图鉴状态。',
      cancelText: hasLinkedExpense ? '保留记录' : '再想想',
      confirmText: hasLinkedExpense ? '删除记录' : '取消点亮',
      confirmColor: '#c84d69',
      success: (res) => {
        if (!res.confirm && !hasLinkedExpense) {
          return;
        }
        collectionService.unlightCollection(id, {
          deleteExpense: hasLinkedExpense && res.confirm
        });
        wx.showToast({
          title: hasLinkedExpense && res.confirm ? '已删除记录' : '已取消',
          icon: 'success'
        });
        this.refreshPage();
      }
    });
  }
});
