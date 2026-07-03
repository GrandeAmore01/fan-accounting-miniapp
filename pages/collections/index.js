const collectionService = require('../../services/collectionService');

Page({
  data: {
    collections: [],
    progress: {
      total: 0,
      ownedCount: 0
    }
  },

  onShow() {
    this.refreshPage();
  },

  refreshPage() {
    this.setData({
      collections: collectionService.listCollections(),
      progress: collectionService.getCollectionProgress()
    });
  },

  handleToggleOwned(event) {
    const { id } = event.currentTarget.dataset;
    collectionService.lightCollection(id);
    this.refreshPage();
  }
});
