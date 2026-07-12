const mockRoutes = {
  get: {},
  put: {}
};

const mockRouter = {
  get: jest.fn((path, handler) => {
    mockRoutes.get[path] = handler;
  }),

  put: jest.fn((path, handler) => {
    mockRoutes.put[path] = handler;
  })
};

const mockPool = {
  execute: jest.fn()
};

jest.mock('express', () => ({
  Router: () => mockRouter
}), {
  virtual: true
});

jest.mock('../server/src/db', () => mockPool);

require('../server/src/routes/budgets');

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

function validBudget(overrides = {}) {
  return {
    userId: 'forged-client-user',
    budgetType: 'month',
    period: '2026-07',
    amount: 1650,
    threshold: 0.8,
    categoryBudgets: {
      meet: 1000,
      collection: 200,
      accommodation: 300,
      transport: 100,
      other: 50
    },
    ...overrides
  };
}

describe('预算路由认证与云端隔离', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET预算只查询令牌对应用户', async () => {
    mockPool.execute.mockResolvedValue([
      [{
        budget_id: 'budget_user-A_month_2026-07',
        budget_type: 'month',
        period: '2026-07',
        amount: 1650,
        threshold: 0.8,
        category_budgets_json: JSON.stringify({
          meet: 1000,
          collection: 200,
          accommodation: 300,
          transport: 100,
          other: 50
        })
      }]
    ]);

    const req = {
      auth: { userId: 'user-A' },
      query: { userId: 'user-B' }
    };

    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.get['/'](req, res, next);

    expect(mockPool.execute)
      .toHaveBeenCalledWith(
        expect.stringContaining(
          'WHERE user_id = ?'
        ),
        ['user-A']
      );

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        data: expect.any(Array)
      })
    );
  });

  test('PUT预算忽略客户端伪造userId并保存五分类', async () => {
    mockPool.execute.mockResolvedValue([
      { affectedRows: 1 }
    ]);

    const req = {
      auth: { userId: 'user-A' },
      body: validBudget()
    };

    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.put['/'](req, res, next);

    expect(next).not.toHaveBeenCalled();

    const params =
      mockPool.execute.mock.calls[0][1];

    expect(params[0]).toBe(
      'budget_user-A_month_2026-07'
    );

    expect(params[1]).toBe('user-A');
    expect(params[1]).not.toBe(
      'forged-client-user'
    );

    expect(JSON.parse(params[6])).toEqual({
      meet: 1000,
      collection: 200,
      accommodation: 300,
      transport: 100,
      other: 50
    });

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: expect.objectContaining({
        userId: 'user-A',
        amount: 1650
      })
    });
  });

  test('同一月份的两个用户生成不同预算记录', async () => {
    mockPool.execute.mockResolvedValue([
      { affectedRows: 1 }
    ]);

    const next = jest.fn();

    await mockRoutes.put['/'](
      {
        auth: { userId: 'user-A' },
        body: validBudget()
      },
      createResponse(),
      next
    );

    await mockRoutes.put['/'](
      {
        auth: { userId: 'user-B' },
        body: validBudget()
      },
      createResponse(),
      next
    );

    const userAParams =
      mockPool.execute.mock.calls[0][1];

    const userBParams =
      mockPool.execute.mock.calls[1][1];

    expect(userAParams[0]).toBe(
      'budget_user-A_month_2026-07'
    );

    expect(userBParams[0]).toBe(
      'budget_user-B_month_2026-07'
    );

    expect(userAParams[1]).toBe('user-A');
    expect(userBParams[1]).toBe('user-B');
  });

  test('分类预算总额超过总预算时拒绝写入数据库', async () => {
    const req = {
      auth: { userId: 'user-A' },
      body: validBudget({
        amount: 1000,
        categoryBudgets: {
          meet: 700,
          collection: 400,
          accommodation: 100,
          transport: 0,
          other: 0
        }
      })
    };

    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.put['/'](req, res, next);

    expect(mockPool.execute)
      .not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 400,
        message: '分类预算总额不能超过总预算'
      })
    );
  });
});
