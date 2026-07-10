const mockRoutes = {
  get: {},
  post: {}
};

const mockRouter = {
  get: jest.fn((path, handler) => {
    mockRoutes.get[path] = handler;
  }),
  post: jest.fn((path, handler) => {
    mockRoutes.post[path] = handler;
  })
};

const mockPool = {
  execute: jest.fn()
};

jest.mock('express', () => ({
  Router: () => mockRouter
}), { virtual: true });

jest.mock('../server/src/db', () => mockPool);

require('../server/src/routes/collections');

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

describe('M2 - collections 后端路由', () => {
  beforeEach(() => {
    mockPool.execute.mockReset();
  });

  test('GET / 返回全部藏品并完成字段转换', async () => {
    mockPool.execute.mockResolvedValue([[
      {
        collection_id: 'C001',
        collection_name: '测试徽章',
        sale_type: '预售',
        collection_category: '实体周边',
        primary_category: '商务',
        secondary_category: '徽章',
        product_style: '单人款',
        sale_date: '2026-07-01T00:00:00.000Z',
        sale_date_text: '2026年7月',
        stage_id: null,
        reference_price: '39.90',
        price_text: '39.9元',
        acquisition_type: '购买',
        price_note: '',
        brand: '测试品牌',
        series_name: '测试系列',
        image_url: '/images/C001.png'
      }
    ]]);

    const req = {};
    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.get['/'](req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockPool.execute).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: [
        expect.objectContaining({
          collectionId: 'C001',
          collectionName: '测试徽章',
          category: '实体周边',
          collectionCategory: '实体周边',
          stageId: '',
          referencePrice: 39.9
        })
      ]
    });
  });

  test('GET /search 正确组合关键词和多级筛选条件', async () => {
    mockPool.execute.mockResolvedValue([[]]);

    const req = {
      query: {
        keyword: ' 徽章 ',
        category: '实体周边',
        primaryCategory: '商务',
        secondaryCategory: '徽章',
        productStyle: '单人款'
      }
    };
    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.get['/search'](req, res, next);

    expect(next).not.toHaveBeenCalled();

    const [sql, params] = mockPool.execute.mock.calls[0];

    expect(sql).toContain('collection_name LIKE ?');
    expect(sql).toContain('collection_category = ?');
    expect(sql).toContain('primary_category = ?');
    expect(sql).toContain('secondary_category = ?');
    expect(sql).toContain('product_style = ?');
    expect(sql).toContain('LIMIT 50');

    expect(params).toEqual([
      '%徽章%',
      '%徽章%',
      '%徽章%',
      '%徽章%',
      '%徽章%',
      '%徽章%',
      '%徽章%',
      '实体周边',
      '商务',
      '徽章',
      '单人款'
    ]);

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: []
    });
  });

  test('GET /search 无条件时不生成 WHERE', async () => {
    mockPool.execute.mockResolvedValue([[]]);

    const req = { query: {} };
    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.get['/search'](req, res, next);

    const [sql, params] = mockPool.execute.mock.calls[0];

    expect(sql).not.toContain('WHERE');
    expect(params).toEqual([]);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: []
    });
  });

  test('GET /:collectionId 查询不到藏品时返回 404', async () => {
    mockPool.execute.mockResolvedValue([[]]);

    const req = {
      params: {
        collectionId: 'UNKNOWN'
      }
    };
    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.get['/:collectionId'](req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      message: '藏品不存在'
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('数据库异常时交给 next 统一处理', async () => {
    const error = new Error('数据库连接失败');
    mockPool.execute.mockRejectedValue(error);

    const req = {};
    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.get['/'](req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
