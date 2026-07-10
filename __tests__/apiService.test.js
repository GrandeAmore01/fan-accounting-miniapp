const apiService = require('../services/apiService');

describe('M2 - apiService.buildQuery', () => {
  test('空参数生成空字符串', () => {
    expect(apiService.buildQuery()).toBe('');
    expect(apiService.buildQuery({})).toBe('');
  });

  test('过滤空字符串和 undefined', () => {
    expect(apiService.buildQuery({
      keyword: '',
      category: undefined,
      page: 0,
      owned: false
    })).toBe('?page=0&owned=false');
  });

  test('正确编码中文、空格和特殊字符', () => {
    expect(apiService.buildQuery({
      keyword: '张三 周边',
      category: '徽章&卡片'
    })).toBe(
      '?keyword=%E5%BC%A0%E4%B8%89%20%E5%91%A8%E8%BE%B9&category=%E5%BE%BD%E7%AB%A0%26%E5%8D%A1%E7%89%87'
    );
  });
});

describe('M2 - apiService.request', () => {
  beforeEach(() => {
    global.wx = {
      request: jest.fn()
    };
  });

  afterEach(() => {
    delete global.wx;
  });

  test('2xx 且 ok 不为 false 时返回 data', async () => {
    global.wx.request.mockImplementation((options) => {
      options.success({
        statusCode: 200,
        data: {
          ok: true,
          data: { collectionId: 'C001' }
        }
      });
    });

    await expect(apiService.request({
      baseUrl: 'http://127.0.0.1:3000',
      url: '/collections/C001'
    })).resolves.toEqual({
      collectionId: 'C001'
    });

    expect(global.wx.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://127.0.0.1:3000/collections/C001',
        method: 'GET',
        data: {},
        header: expect.objectContaining({
          'content-type': 'application/json'
        })
      })
    );
  });

  test('业务响应 ok=false 时抛出服务端错误信息', async () => {
    global.wx.request.mockImplementation((options) => {
      options.success({
        statusCode: 200,
        data: {
          ok: false,
          message: '藏品不存在'
        }
      });
    });

    await expect(apiService.request({
      baseUrl: 'http://127.0.0.1:3000',
      url: '/collections/UNKNOWN'
    })).rejects.toThrow('藏品不存在');
  });

  test('非 2xx 状态码时抛出请求失败错误', async () => {
    global.wx.request.mockImplementation((options) => {
      options.success({
        statusCode: 500,
        data: {}
      });
    });

    await expect(apiService.request({
      baseUrl: 'http://127.0.0.1:3000',
      url: '/collections'
    })).rejects.toThrow('请求失败：500');
  });

  test('微信网络请求失败时返回 errMsg', async () => {
    global.wx.request.mockImplementation((options) => {
      options.fail({
        errMsg: 'request:fail timeout'
      });
    });

    await expect(apiService.request({
      baseUrl: 'http://127.0.0.1:3000',
      url: '/collections'
    })).rejects.toThrow('request:fail timeout');
  });
});
