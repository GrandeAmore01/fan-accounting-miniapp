const apiService = require('./apiService');

function listCollections() {
  return apiService.request({
    url: '/collections'
  });
}

function searchCollections(keyword, category = '') {
  return apiService.request({
    url: `/collections/search${apiService.buildQuery({
      keyword,
      category
    })}`
  });
}

function getCollection(collectionId) {
  return apiService.request({
    url: `/collections/${collectionId}`
  });
}

module.exports = {
  listCollections,
  searchCollections,
  getCollection
};