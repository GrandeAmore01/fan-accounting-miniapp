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
    wx.showModal({
      title: '取消点亮',
      content: '取消后仅更新图鉴状态，不会自动删除已生成的消费记录。',
      confirmText: '取消点亮',
      confirmColor: '#c84d69',
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        collectionService.unlightCollection(id);
        wx.showToast({
          title: '已取消',
          icon: 'success'
        });
        this.refreshPage();
      }
    });
  }
});
