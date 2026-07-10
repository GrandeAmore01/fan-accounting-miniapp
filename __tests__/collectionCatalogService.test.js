jest.mock('../services/apiService', () => ({
  request: jest.fn(),
  buildQuery: jest.fn()
}));

jest.mock('../services/config', () => ({
  collectionApiBaseUrl: 'http://collection.test',
  apiBaseUrl: 'http://api.test'
}));

const apiService = require('../services/apiService');
const collectionCatalogService = require('../services/collectionCatalogService');

describe('M2 - collectionCatalogService', () => {
  beforeEach(() => {
    apiService.request.mockResolvedValue([]);
    apiService.buildQuery.mockImplementation((params = {}) => {
      const query = Object.keys(params)
        .filter((key) =>
          typeof params[key] !== 'undefined' &&
          params[key] !== ''
        )
        .map((key) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
        )
        .join('&');

      return query ? `?${query}` : '';
    });
  });

  test('获取全部藏品时请求 /collections', async () => {
    await collectionCatalogService.listCollections();

    expect(apiService.request).toHaveBeenCalledWith({
      baseUrl: 'http://collection.test',
      url: '/collections'
    });
  });

  test('搜索时正确传递关键词和多级筛选条件', async () => {
    await collectionCatalogService.searchCollections('周边', {
      category: '实体周边',
      primaryCategory: '商务',
      secondaryCategory: '徽章',
      productStyle: '单人款'
    });

    expect(apiService.buildQuery).toHaveBeenCalledWith({
      keyword: '周边',
      category: '实体周边',
      primaryCategory: '商务',
      secondaryCategory: '徽章',
      productStyle: '单人款'
    });

    expect(apiService.request).toHaveBeenCalledWith({
      baseUrl: 'http://collection.test',
      url:
        '/collections/search' +
        '?keyword=%E5%91%A8%E8%BE%B9' +
        '&category=%E5%AE%9E%E4%BD%93%E5%91%A8%E8%BE%B9' +
        '&primaryCategory=%E5%95%86%E5%8A%A1' +
        '&secondaryCategory=%E5%BE%BD%E7%AB%A0' +
        '&productStyle=%E5%8D%95%E4%BA%BA%E6%AC%BE'
    });
  });

  test('兼容旧版字符串 category 参数', async () => {
    await collectionCatalogService.searchCollections('卡片', '纸质周边');

    expect(apiService.buildQuery).toHaveBeenCalledWith({
      keyword: '卡片',
      category: '纸质周边',
      primaryCategory: '',
      secondaryCategory: '',
      productStyle: ''
    });
  });

  test('按 collectionId 获取藏品详情', async () => {
    await collectionCatalogService.getCollection('C100');

    expect(apiService.request).toHaveBeenCalledWith({
      baseUrl: 'http://collection.test',
      url: '/collections/C100'
    });
  });
});
