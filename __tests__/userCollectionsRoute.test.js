const mockUserRoutes = {
  get: {},
  post: {}
};

const mockUserRouter = {
  get: jest.fn((path, handler) => {
    mockUserRoutes.get[path] = handler;
  }),
  post: jest.fn((path, handler) => {
    mockUserRoutes.post[path] = handler;
  })
};

const mockUserPool = {
  execute: jest.fn()
};

jest.mock('express', () => ({
  Router: () => mockUserRouter
}), { virtual: true });

jest.mock('../server/src/db', () => mockUserPool);

require('../server/src/routes/userCollections');

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

describe('M2 - userCollections 后端路由', () => {
  beforeEach(() => {
    mockUserPool.execute.mockReset();
  });

  test('GET / 缺少 userId 时返回 400', async () => {
    const req = { query: {} };
    const res = createResponse();
    const next = jest.fn();

    await mockUserRoutes.get['/'](req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      message: '缺少userId'
    });
    expect(mockUserPool.execute).not.toHaveBeenCalled();
  });

  test('GET / 返回用户藏品点亮状态', async () => {
    mockUserPool.execute.mockResolvedValue([[
      {
        collection_id: 'C001',
        collection_name: '测试徽章',
        collection_category: '实体周边',
        primary_category: '商务',
        secondary_category: '徽章',
        product_style: '单人款',
        reference_price: '39.90',
        price_text: '39.9元',
        acquisition_type: '购买',
        is_owned: 1,
        light_time: '2026-07-10 12:00:00'
      },
      {
        collection_id: 'C002',
        collection_name: '测试卡片',
        collection_category: '纸质周边',
        primary_category: '卡片',
        secondary_category: '未分类',
        product_style: '普通款',
        reference_price: null,
        price_text: '',
        acquisition_type: '',
        is_owned: 0,
        light_time: null
      }
    ]]);

    const req = {
      query: {
        userId: ' test-user '
      }
    };
    const res = createResponse();
    const next = jest.fn();

    await mockUserRoutes.get['/'](req, res, next);

    expect(mockUserPool.execute).toHaveBeenCalledWith(
      expect.stringContaining('LEFT JOIN user_collections'),
      ['test-user']
    );

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: [
        expect.objectContaining({
          collectionId: 'C001',
          referencePrice: 39.9,
          isOwned: true
        }),
        expect.objectContaining({
          collectionId: 'C002',
          referencePrice: null,
          isOwned: false
        })
      ]
    });
  });

  test('POST /light 缺少 collectionId 时交给 next 返回参数错误', async () => {
    const req = {
      body: {
        userId: 'test-user'
      }
    };
    const res = createResponse();
    const next = jest.fn();

    await mockUserRoutes.post['/light'](req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    const error = next.mock.calls[0][0];

    expect(error.message).toBe('缺少参数：collectionId');
    expect(error.status).toBe(400);
    expect(mockUserPool.execute).not.toHaveBeenCalled();
  });

  test('POST /light 藏品不存在时返回 404', async () => {
    mockUserPool.execute.mockResolvedValueOnce([[]]);

    const req = {
      body: {
        userId: 'test-user',
        collectionId: 'UNKNOWN'
      }
    };
    const res = createResponse();
    const next = jest.fn();

    await mockUserRoutes.post['/light'](req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      message: '藏品不存在'
    });
    expect(mockUserPool.execute).toHaveBeenCalledTimes(1);
  });

  test('POST /light 成功点亮藏品', async () => {
    mockUserPool.execute
      .mockResolvedValueOnce([[{ collection_id: 'C001' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const req = {
      body: {
        userId: 'test-user',
        collectionId: 'C001'
      }
    };
    const res = createResponse();
    const next = jest.fn();

    await mockUserRoutes.post['/light'](req, res, next);

    expect(mockUserPool.execute).toHaveBeenCalledTimes(2);

    const [writeSql, writeParams] =
      mockUserPool.execute.mock.calls[1];

    expect(writeSql).toContain('ON DUPLICATE KEY UPDATE');
    expect(writeSql).toContain('is_owned = 1');
    expect(writeParams).toEqual(['test-user', 'C001']);

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: {
        userId: 'test-user',
        collectionId: 'C001',
        isOwned: true
      }
    });
  });

  test('POST /unlight 成功取消点亮并清空 light_time', async () => {
    mockUserPool.execute.mockResolvedValue([
      { affectedRows: 1 }
    ]);

    const req = {
      body: {
        userId: 'test-user',
        collectionId: 'C001'
      }
    };
    const res = createResponse();
    const next = jest.fn();

    await mockUserRoutes.post['/unlight'](req, res, next);

    const [sql, params] = mockUserPool.execute.mock.calls[0];

    expect(sql).toContain('is_owned = 0');
    expect(sql).toContain('light_time = NULL');
    expect(params).toEqual(['test-user', 'C001']);

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: {
        userId: 'test-user',
        collectionId: 'C001',
        isOwned: false
      }
    });
  });
});
