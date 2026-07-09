const apiService = require('./apiService');
const config = require('./config');

const COLLECTION_API_BASE_URL = config.collectionApiBaseUrl || config.apiBaseUrl;

function requestCollectionApi(options) {
  return apiService.request({
    ...options,
    baseUrl: COLLECTION_API_BASE_URL
  });
}

function listCollections() {
  return requestCollectionApi({
    url: '/collections'
  });
}

function searchCollections(keyword, filters = {}) {
  const normalizedFilters = typeof filters === 'string'
    ? { category: filters }
    : filters;

  return requestCollectionApi({
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
  return requestCollectionApi({
    url: `/collections/${collectionId}`
  });
}

module.exports = {
  listCollections,
  searchCollections,
  getCollection
};
