const apiService = require('./apiService');
const collectionCatalogService = require('./collectionCatalogService');
const config = require('./config');

const USER_ID = config.userId || 'local-user';
const COLLECTION_API_BASE_URL = config.collectionApiBaseUrl || config.apiBaseUrl;

function normalizeCollection(item = {}) {
  return {
    collectionId: String(item.collectionId || ''),
    collectionName: item.collectionName || '未命名藏品',
    saleType: item.saleType || '',
    collectionCategory: item.collectionCategory || item.category || '其他',
    primaryCategory: item.primaryCategory || '其他',
    secondaryCategory: item.secondaryCategory || '未分类',
    productStyle: item.productStyle || '未标注',
    saleDateText: item.saleDateText || '',
    stageId: item.stageId || '',
    referencePrice: item.referencePrice,
    priceText: item.priceText || '',
    brand: item.brand || '',
    seriesName: item.seriesName || '',
    imageUrl: item.imageUrl || '',
    isOwned: Boolean(item.isOwned),
    lightTime: item.lightTime || '',
    imageFailed: false
  };
}

async function listCollections() {
  const [catalog, userStates] = await Promise.all([
    collectionCatalogService.listCollections(),
    apiService.request({
      baseUrl: COLLECTION_API_BASE_URL,
      url: `/user-collections${apiService.buildQuery({ userId: USER_ID })}`
    })
  ]);
  const states = new Map((userStates || []).map((item) => [String(item.collectionId), item]));
  return (catalog || []).map((item) => {
    const normalized = normalizeCollection(item);
    const state = states.get(normalized.collectionId);
    return {
      ...normalized,
      isOwned: Boolean(state && state.isOwned),
      lightTime: state ? state.lightTime || '' : ''
    };
  });
}

function setOwned(collectionId, isOwned) {
  return apiService.request({
    baseUrl: COLLECTION_API_BASE_URL,
    url: `/user-collections/${isOwned ? 'light' : 'unlight'}`,
    method: 'POST',
    data: { userId: USER_ID, collectionId }
  });
}

function lightCollection(collectionId) {
  return setOwned(collectionId, true);
}

function unlightCollection(collectionId) {
  return setOwned(collectionId, false);
}

module.exports = {
  listCollections,
  lightCollection,
  unlightCollection
};
