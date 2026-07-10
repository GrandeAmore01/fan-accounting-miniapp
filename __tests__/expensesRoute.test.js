const mockRoutes = {
  get: {},
  post: {},
  put: {},
  delete: {}
};

const mockRouter = {
  get: jest.fn((path, handler) => {
    mockRoutes.get[path] = handler;
  }),
  post: jest.fn((path, handler) => {
    mockRoutes.post[path] = handler;
  }),
  put: jest.fn((path, handler) => {
    mockRoutes.put[path] = handler;
  }),
  delete: jest.fn((path, handler) => {
    mockRoutes.delete[path] = handler;
  })
};

const mockPool = {
  execute: jest.fn(),
  getConnection: jest.fn()
};

jest.mock('express', () => ({
  Router: () => mockRouter
}), {
  virtual: true
});

jest.mock('../server/src/db', () => mockPool);

require('../server/src/routes/expenses');

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

function validBody(overrides = {}) {
  return {
    category: 'collection',
    subType: 'goods',
    itemName: '测试徽章',
    amount: '20',
    quantity: 2,
    date: '2026-07-10',
    pricingMode: 'unit',
    includeInTotal: true,
    collectionId: 'C001',
    ...overrides
  };
}

function createConnection() {
  return {
    beginTransaction: jest.fn().mockResolvedValue(),
    execute: jest.fn().mockResolvedValue([
      {
        affectedRows: 1
      }
    ]),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn()
  };
}

describe('后端 - expenses 路由', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET / 按 userId 查询消费记录并完成字段转换', async () => {
    mockPool.execute.mockResolvedValue([[
      {
        expense_id: 'E001',
        user_id: 'user-1',
        category: 'collection',
        sub_type: 'goods',
        item_name: '测试徽章',
        amount: '20',
        quantity: '2',
        expense_date: '2026-07-10',
        images_json: '[]',
        fees_json: '{}',
        include_in_total: 1,
        collection_id: 'C001',
        reference_price: null,
        unit_price: null,
        base_amount: '40',
        total_amount: '40',
        included_amount: '40'
      }
    ]]);

    const req = {
      query: {
        userId: 'user-1'
      },
      body: {}
    };
    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.get['/'](req, res, next);

    expect(mockPool.execute).toHaveBeenCalledWith(
      expect.stringContaining('WHERE user_id = ?'),
      ['user-1']
    );

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: [
        expect.objectContaining({
          expenseId: 'E001',
          amount: 20,
          quantity: 2,
          collectionId: 'C001',
          totalAmount: 40
        })
      ]
    });

    expect(next).not.toHaveBeenCalled();
  });

  test('GET /:expenseId 查询不到记录时返回404', async () => {
    mockPool.execute.mockResolvedValue([[]]);

    const req = {
      query: {
        userId: 'user-1'
      },
      body: {},
      params: {
        expenseId: 'UNKNOWN'
      }
    };
    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.get['/:expenseId'](
      req,
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      message: '消费记录不存在'
    });
  });

  test('POST / 输入校验失败时返回400且不启动事务', async () => {
    const req = {
      query: {},
      body: validBody({
        itemName: ''
      })
    };
    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.post['/'](req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      message: '请填写消费项目名称'
    });

    expect(mockPool.getConnection)
      .not.toHaveBeenCalled();
  });

  test('POST / 新增关联藏品消费时事务写入消费并点亮藏品', async () => {
    const connection = createConnection();

    mockPool.getConnection.mockResolvedValue(
      connection
    );

    const req = {
      query: {
        userId: 'route-user'
      },
      body: validBody()
    };
    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.post['/'](req, res, next);

    expect(connection.beginTransaction)
      .toHaveBeenCalledTimes(1);

    expect(connection.execute)
      .toHaveBeenCalledTimes(2);

    expect(connection.execute.mock.calls[0][0])
      .toContain('INSERT INTO expenses');

    expect(connection.execute.mock.calls[1][0])
      .toContain('INSERT INTO user_collections');

    expect(connection.execute.mock.calls[1][1])
      .toEqual([
        'route-user',
        'C001'
      ]);

    expect(connection.commit)
      .toHaveBeenCalledTimes(1);

    expect(connection.rollback)
      .not.toHaveBeenCalled();

    expect(connection.release)
      .toHaveBeenCalledTimes(1);

    expect(res.status).toHaveBeenCalledWith(201);

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: expect.objectContaining({
        userId: 'route-user',
        category: 'collection',
        collectionId: 'C001',
        quantity: 2,
        totalAmount: 40
      })
    });

    expect(next).not.toHaveBeenCalled();
  });

  test('POST / 事务写入失败时回滚、释放连接并交给 next', async () => {
    const connection = createConnection();
    const error = new Error('数据库写入失败');

    connection.execute.mockRejectedValueOnce(error);

    mockPool.getConnection.mockResolvedValue(
      connection
    );

    const req = {
      query: {},
      body: validBody()
    };
    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.post['/'](req, res, next);

    expect(connection.rollback)
      .toHaveBeenCalledTimes(1);

    expect(connection.commit)
      .not.toHaveBeenCalled();

    expect(connection.release)
      .toHaveBeenCalledTimes(1);

    expect(next).toHaveBeenCalledWith(error);
  });

  test('PUT /:expenseId 修改不存在的记录时返回404', async () => {
    mockPool.execute.mockResolvedValue([
      {
        affectedRows: 0
      }
    ]);

    const req = {
      query: {
        userId: 'user-1'
      },
      body: validBody(),
      params: {
        expenseId: 'E404'
      }
    };
    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.put['/:expenseId'](
      req,
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      message: '消费记录不存在'
    });
  });

  test('DELETE /:expenseId 成功删除指定用户消费记录', async () => {
    mockPool.execute.mockResolvedValue([
      {
        affectedRows: 1
      }
    ]);

    const req = {
      query: {
        userId: 'user-1'
      },
      body: {},
      params: {
        expenseId: 'E001'
      }
    };
    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.delete['/:expenseId'](
      req,
      res,
      next
    );

    expect(mockPool.execute).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM expenses'),
      [
        'E001',
        'user-1'
      ]
    );

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: {
        expenseId: 'E001'
      }
    });
  });
});
