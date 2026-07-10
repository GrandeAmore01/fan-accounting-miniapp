jest.mock('../services/apiService', () => ({
  request: jest.fn(),
  buildQuery: jest.fn()
}));

jest.mock('../services/collectionCatalogService', () => ({
  listCollections: jest.fn()
}));

jest.mock('../services/config', () => ({
  userId: 'test-user',
  collectionApiBaseUrl: 'http://collection.test',
  apiBaseUrl: 'http://api.test'
}));

const apiService = require('../services/apiService');
const collectionCatalogService =
  require('../services/collectionCatalogService');
const collectionService = require('../services/collectionService');

describe('M2 - collectionService', () => {
  beforeEach(() => {
    apiService.buildQuery.mockReturnValue('?userId=test-user');
  });

  test('合并藏品目录和用户点亮状态', async () => {
    collectionCatalogService.listCollections.mockResolvedValue([
      {
        collectionId: 1,
        collectionName: '测试徽章',
        category: '实体周边',
        primaryCategory: '商务',
        secondaryCategory: '徽章',
        productStyle: '单人款',
        isOwned: false
      },
      {
        collectionId: 2,
        collectionName: '测试卡片',
        primaryCategory: '',
        secondaryCategory: '',
        productStyle: ''
      }
    ]);

    apiService.request.mockResolvedValue([
      {
        collectionId: '1',
        isOwned: true,
        lightTime: '2026-07-10 12:00:00'
      }
    ]);

    const result = await collectionService.listCollections();

    expect(apiService.request).toHaveBeenCalledWith({
      baseUrl: 'http://collection.test',
      url: '/user-collections?userId=test-user'
    });

    expect(result).toHaveLength(2);

    expect(result[0]).toEqual(
      expect.objectContaining({
        collectionId: '1',
        collectionName: '测试徽章',
        collectionCategory: '实体周边',
        primaryCategory: '商务',
        secondaryCategory: '徽章',
        productStyle: '单人款',
        isOwned: true,
        lightTime: '2026-07-10 12:00:00',
        imageFailed: false
      })
    );

    expect(result[1]).toEqual(
      expect.objectContaining({
        collectionId: '2',
        collectionName: '测试卡片',
        collectionCategory: '其他',
        primaryCategory: '其他',
        secondaryCategory: '未分类',
        productStyle: '未标注',
        isOwned: false,
        lightTime: '',
        imageFailed: false
      })
    );
  });

  test('点亮藏品时发送 light POST 请求', async () => {
    apiService.request.mockResolvedValue({
      collectionId: 'C001',
      isOwned: true
    });

    await collectionService.lightCollection('C001');

    expect(apiService.request).toHaveBeenCalledWith({
      baseUrl: 'http://collection.test',
      url: '/user-collections/light',
      method: 'POST',
      data: {
        userId: 'test-user',
        collectionId: 'C001'
      }
    });
  });

  test('取消点亮时发送 unlight POST 请求', async () => {
    apiService.request.mockResolvedValue({
      collectionId: 'C001',
      isOwned: false
    });

    await collectionService.unlightCollection('C001');

    expect(apiService.request).toHaveBeenCalledWith({
      baseUrl: 'http://collection.test',
      url: '/user-collections/unlight',
      method: 'POST',
      data: {
        userId: 'test-user',
        collectionId: 'C001'
      }
    });
  });
});
