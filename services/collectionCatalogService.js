const apiService = require('./apiService');

function listCollections() {
  return apiService.request({
    url: '/collections'
  });
}

function searchCollections(keyword, filters = {}) {
  const normalizedFilters = typeof filters === 'string'
    ? { category: filters }
    : filters;

  return apiService.request({
    url: `/collections/search${apiService.buildQuery({
      keyword,
      category: normalizedFilters.category || '',
      primaryCategory: normalizedFilters.primaryCategory || '',
      secondaryCategory: normalizedFilters.secondaryCategory || '',
      productStyle: normalizedFilters.productStyle || ''
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
